-- ============================================================================
-- SpeakFlow AI — 完整 Database Schema（合併版）
-- 用途：如果你不想用 Supabase CLI，可以直接把這份檔案整份貼到
--       Supabase Dashboard → SQL Editor 執行一次即可建立所有資料表、
--       trigger、RLS policy 與 Storage bucket。
-- 建議做法：優先使用 supabase/migrations/ 底下個別檔案 + Supabase CLI，
--          這份合併檔只是給不想裝 CLI 的情況用的替代方案，兩者內容一致。
-- ============================================================================

-- ============================================================================
-- 0000: Extensions
-- ============================================================================
-- gen_random_uuid() 需要 pgcrypto（Supabase 專案預設通常已啟用，這裡用 IF NOT EXISTS 保險）
create extension if not exists pgcrypto;


-- ============================================================================
-- 0001: profiles
-- ============================================================================
-- 延伸 auth.users，存放使用者的應用層資料。
-- id 直接沿用 auth.users.id，一對一關係。

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  learning_goal text check (learning_goal in ('travel', 'interview', 'daily_fluency', 'business')),
  preferred_ai_model text not null default 'gemini-2.5-flash'
    check (preferred_ai_model in ('gemini-2.5-flash', 'gpt-5.5')),
  streak_count integer not null default 0,
  last_practice_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '延伸 auth.users 的應用層使用者資料，id 與 auth.users.id 一對一對應';

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- 使用者在 Supabase Auth 註冊成功後，自動建立對應的 profiles 資料列
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 不開放 insert / delete policy：
-- insert 一律透過 handle_new_user() trigger（security definer）自動建立，
-- delete 交由 auth.users 的 cascade 處理（使用者刪除帳號時一併清除）。


-- ============================================================================
-- 0002: scenarios
-- ============================================================================
-- 情境任務內容（點餐、面試等），屬於「公開內容」，所有登入使用者皆可讀取，
-- 但不開放前端使用者新增／修改／刪除 —— 內容由後台／管理端維護
-- （目前階段可直接在 Supabase Studio 手動新增，或用 service role key 寫入）。

create table if not exists public.scenarios (
  id text primary key,
  title text not null,
  description text,
  ai_role_prompt text not null,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now()
);

comment on table public.scenarios is '情境任務內容，公開唯讀，僅供 scenario 練習模式使用';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.scenarios enable row level security;

-- 任何已登入使用者都能讀取情境內容
create policy "scenarios_select_authenticated"
  on public.scenarios for select
  to authenticated
  using (true);

-- 沒有 insert / update / delete policy給一般使用者：
-- 一般使用者（anon / authenticated）皆無法寫入，只有 service role（會繞過 RLS）能維護內容。


-- ============================================================================
-- 0003: learning_sessions
-- ============================================================================
-- 一次完整的練習（可能包含多輪對話），對應規劃文件的「一次開始到結束的練習」。

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('shadowing', 'freetalk', 'scenario')),
  scenario_id text references public.scenarios (id) on delete set null,
  ai_model_used text not null check (ai_model_used in ('gemini-2.5-flash', 'gpt-5.5')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  overall_score numeric check (overall_score >= 0 and overall_score <= 100),

  -- scenario 模式必須帶 scenario_id，其他模式則不應該帶
  constraint scenario_id_matches_mode check (
    (mode = 'scenario' and scenario_id is not null)
    or (mode <> 'scenario' and scenario_id is null)
  )
);

comment on table public.learning_sessions is '一次完整的練習 session，可能包含多輪對話（session_turns）';

create index if not exists learning_sessions_user_id_idx
  on public.learning_sessions (user_id);

create index if not exists learning_sessions_user_id_started_at_idx
  on public.learning_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.learning_sessions enable row level security;

create policy "learning_sessions_select_own"
  on public.learning_sessions for select
  using (auth.uid() = user_id);

create policy "learning_sessions_insert_own"
  on public.learning_sessions for insert
  with check (auth.uid() = user_id);

create policy "learning_sessions_update_own"
  on public.learning_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "learning_sessions_delete_own"
  on public.learning_sessions for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- 0004: session_turns
-- ============================================================================
-- 一次 session 底下的每一輪對話（一次錄音 → 一次 AI 回饋）。
-- 注意：這裡刻意不存原始錄音，只存逐字稿與評分結果（隱私與成本考量，
-- 詳見規劃文件「資料保存策略」）。ai_reply_audio_url 指向 Storage 裡
-- 短期快取的 AI 回覆語音，非永久保存。

create table if not exists public.session_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.learning_sessions (id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  transcript text,
  pronunciation_score numeric check (pronunciation_score >= 0 and pronunciation_score <= 100),
  grammar_feedback jsonb,
  ai_reply_text text,
  ai_reply_audio_url text,
  created_at timestamptz not null default now(),

  unique (session_id, turn_index)
);

comment on table public.session_turns is '單一 session 內的每一輪語音互動紀錄，不含原始錄音';

create index if not exists session_turns_session_id_idx
  on public.session_turns (session_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- session_turns 沒有直接的 user_id 欄位，擁有權透過 learning_sessions 判斷。
-- 用 EXISTS subquery 檢查該 turn 所屬的 session 是否屬於目前登入的使用者。

alter table public.session_turns enable row level security;

create policy "session_turns_select_own"
  on public.session_turns for select
  using (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = session_turns.session_id
        and ls.user_id = auth.uid()
    )
  );

create policy "session_turns_insert_own"
  on public.session_turns for insert
  with check (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = session_turns.session_id
        and ls.user_id = auth.uid()
    )
  );

create policy "session_turns_update_own"
  on public.session_turns for update
  using (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = session_turns.session_id
        and ls.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = session_turns.session_id
        and ls.user_id = auth.uid()
    )
  );

create policy "session_turns_delete_own"
  on public.session_turns for delete
  using (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = session_turns.session_id
        and ls.user_id = auth.uid()
    )
  );


-- ============================================================================
-- 0005: usage_logs
-- ============================================================================
-- AI 呼叫的成本追蹤，架構起始就要有，避免雙模型（Gemini/GPT-5.5）的成本失控。
-- 這張表主要由後端（ChatService／API Route，用 service role 或使用者自己的 session）寫入，
-- 使用者可以讀自己的紀錄（例如未來做「本月使用量」的畫面）。

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_turn_id uuid references public.session_turns (id) on delete set null,
  provider text not null check (provider in ('gemini', 'openai')),
  model text,
  estimated_tokens integer,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now()
);

comment on table public.usage_logs is 'AI 呼叫成本追蹤，用於監控雙模型的實際花費';

create index if not exists usage_logs_user_id_idx
  on public.usage_logs (user_id);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.usage_logs enable row level security;

-- 使用者只能讀自己的用量紀錄，不能自己新增／修改／刪除
-- （寫入這張表的邏輯完全在 ChatService／Edge Function 端執行，用 service role key，
--  可以繞過 RLS；一般使用者的 anon/authenticated session 沒有寫入權限，
--  避免使用者自己竄改用量紀錄）。

create policy "usage_logs_select_own"
  on public.usage_logs for select
  using (auth.uid() = user_id);


-- ============================================================================
-- 0006: Storage — session-audio bucket
-- ============================================================================
-- 用途：只存「AI 回覆的語音」（TTS 輸出），短期快取供使用者重播，
--       不存使用者的原始錄音（依規劃文件的隱私／成本決策，原始錄音分析完即丟棄，
--       從頭到尾不會進到這個 bucket）。
--
-- 檔案路徑規則：{user_id}/{session_turn_id}.mp3
-- 用路徑第一層資料夾當作 user_id，讓 RLS policy 可以用 storage.foldername() 判斷擁有權。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-audio',
  'session-audio',
  false, -- 不公開，一律透過 signed URL 或帶使用者 session 的 client 存取
  10485760, -- 10MB，單一輪 AI 回覆語音檔遠小於此上限
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS（storage.objects）
-- ---------------------------------------------------------------------------
-- 使用者只能存取路徑第一層資料夾等於自己 user_id 的檔案。
-- storage.foldername(name) 會把路徑拆成陣列，例如 "abc-uuid/turn-1.mp3" → ['abc-uuid', 'turn-1.mp3']

create policy "session_audio_select_own"
  on storage.objects for select
  using (
    bucket_id = 'session-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "session_audio_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'session-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "session_audio_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'session-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 注意：實際寫入這個 bucket 的邏輯會在 GeminiProvider/OpenAIProvider 的
-- textToSpeech() 完成後，由後端（ChatService）用使用者的 session 或 service role 寫入，
-- 前端不會直接上傳任何東西到這個 bucket。
--
-- 自動清除機制（7 天後清除舊檔）目前「未」在這個 migration 實作：
-- Postgres 沒有原生的 Storage TTL，直接刪 storage.objects 的資料列不會連帶清掉
-- 底層檔案，需要透過 Storage API（supabase.storage.from().remove()）才能真的刪除檔案。
-- 建議做法：另外做一個排程任務（例如 Vercel Cron 打一支 API Route，
-- 用 service role client 查詢 session_turns.created_at 超過 7 天的紀錄，
-- 呼叫 Storage API 移除對應檔案）。這是後續獨立的功能，不在這次 schema 範圍內。



-- ============================================================================
-- 追加 migration：20260731090000_add_interview_mode.sql
-- ============================================================================
-- ============================================================================
-- 0007: 把 "interview" 加入 learning_sessions.mode 的允許值
-- ============================================================================
-- 面試教練模式是後來加的第四種練習模式，原本 0003 建表時的 check constraint
-- 只允許 shadowing/freetalk/scenario，這裡補上 interview。

alter table public.learning_sessions
  drop constraint if exists learning_sessions_mode_check;

alter table public.learning_sessions
  add constraint learning_sessions_mode_check
  check (mode in ('shadowing', 'freetalk', 'scenario', 'interview'));

-- ============================================================================
-- 追加 migration：20260731150000_upgrade_gemini_model.sql
-- ============================================================================
-- ============================================================================
-- 0008: 升級 Gemini 型號到 gemini-3-flash-preview
-- ============================================================================
-- 應用程式端已經把 GeminiProvider 從 gemini-2.5-flash 升級成 gemini-3-flash-preview。
-- 這裡更新兩個 check constraint 加入新型號。
--
-- 刻意保留 'gemini-2.5-flash' 仍在允許清單裡（沒有整個換掉）：
-- 如果資料庫裡已經有用舊型號建立的歷史紀錄（learning_sessions.ai_model_used），
-- 拿掉舊值會讓那些既有資料列變成不合法狀態。新的 session 建立邏輯
-- （provider.factory.ts）已經不會再選到舊型號了，這裡單純是保留歷史相容性。

alter table public.profiles
  drop constraint if exists profiles_preferred_ai_model_check;

alter table public.profiles
  add constraint profiles_preferred_ai_model_check
  check (preferred_ai_model in ('gemini-2.5-flash', 'gemini-3-flash-preview', 'gpt-5.5'));

alter table public.profiles
  alter column preferred_ai_model set default 'gemini-3-flash-preview';

alter table public.learning_sessions
  drop constraint if exists learning_sessions_ai_model_used_check;

alter table public.learning_sessions
  add constraint learning_sessions_ai_model_used_check
  check (ai_model_used in ('gemini-2.5-flash', 'gemini-3-flash-preview', 'gpt-5.5'));

-- ============================================================================
-- 追加 migration：20260731170000_interview_evaluations.sql
-- ============================================================================
-- ============================================================================
-- 0009: interview_evaluations
-- ============================================================================
-- 面試模式專屬的評分維度（技術深度／STAR結構／溝通表達／工程思維），
-- 對應 V1 產品願景文件的評分要求。
--
-- 設計原則：不擴充 session_turns 本身（那張表要保持所有模式共用的通用格式），
-- 而是用衛星表 + 一對一關聯，模式專屬的欄位不會污染其他模式的資料列。
-- 之後 Mind Map Recall 模式的 recall_attempts 也會採用一樣的模式。

create table if not exists public.interview_evaluations (
  session_turn_id uuid primary key references public.session_turns (id) on delete cascade,
  technical_depth numeric check (technical_depth >= 0 and technical_depth <= 100),
  star_structure numeric not null check (star_structure >= 0 and star_structure <= 100),
  communication numeric not null check (communication >= 0 and communication <= 100),
  engineering_thinking numeric check (engineering_thinking >= 0 and engineering_thinking <= 100),
  created_at timestamptz not null default now()
);

comment on table public.interview_evaluations is
  '面試模式的評分維度擴充，透過 session_turn_id 跟 session_turns 一對一關聯';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- 擁有權透過 session_turns → learning_sessions 的關聯鏈判斷，
-- 寫法跟 session_turns 自己的 RLS policy 是同一套模式。

alter table public.interview_evaluations enable row level security;

create policy "interview_evaluations_select_own"
  on public.interview_evaluations for select
  using (
    exists (
      select 1
      from public.session_turns st
      join public.learning_sessions ls on ls.id = st.session_id
      where st.id = interview_evaluations.session_turn_id
        and ls.user_id = auth.uid()
    )
  );

create policy "interview_evaluations_insert_own"
  on public.interview_evaluations for insert
  with check (
    exists (
      select 1
      from public.session_turns st
      join public.learning_sessions ls on ls.id = st.session_id
      where st.id = interview_evaluations.session_turn_id
        and ls.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 追加 migration：20260731190000_stories.sql
-- ============================================================================
-- ============================================================================
-- 0010: stories（Mind Map Recall B-1）
-- ============================================================================
-- 使用者用中文寫下的個人故事，AI 拆解成 STAR + 關鍵字 + 英文最佳答案。
-- 這張表目前是獨立的（不 FK 到任何 Mind Map / Question），
-- 因為 B-1 階段先讓使用者能建立故事庫，Question ↔ Story ↔ Mind Map
-- 的關聯要等 B-2/B-4 才會加上（新增 interview_questions / mind_maps 時）。

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  content_zh text not null,
  content_en text,
  star_situation text,
  star_task text,
  star_action text,
  star_result text,
  keywords text[],
  best_answer_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stories is
  '使用者的個人故事（中文原始素材），AI 拆解出 STAR／關鍵字／英文最佳答案，供 Mind Map 使用';

create index if not exists stories_user_id_idx on public.stories (user_id);
create index if not exists stories_user_id_created_at_idx on public.stories (user_id, created_at desc);

-- updated_at 自動更新，沿用 0001 建立的共用 trigger function
drop trigger if exists set_stories_updated_at on public.stories;
create trigger set_stories_updated_at
  before update on public.stories
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stories enable row level security;

create policy "stories_select_own"
  on public.stories for select
  using (auth.uid() = user_id);

create policy "stories_insert_own"
  on public.stories for insert
  with check (auth.uid() = user_id);

create policy "stories_update_own"
  on public.stories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "stories_delete_own"
  on public.stories for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 追加 migration：20260731210000_interview_questions.sql
-- ============================================================================
-- ============================================================================
-- 0011: interview_questions（Mind Map Recall B-2）
-- ============================================================================
-- 面試問題，兩種來源：
--   - company_kb：來自公司知識庫的 Behavioral Interview Topics（user_id 為 null，
--     所有登入使用者共用同一份，第一次被選用時才會 materialize 成一筆資料列，
--     不是靠 migration 手動塞資料——避免內容跟 companies/*.md 重複維護、之後失去同步）
--   - custom：使用者自己輸入的題目（user_id 為該使用者）

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  company_id text,
  question_text text not null,
  source text not null check (source in ('company_kb', 'custom')),
  created_at timestamptz not null default now(),

  constraint interview_questions_source_shape check (
    (source = 'company_kb' and user_id is null and company_id is not null)
    or (source = 'custom' and user_id is not null)
  )
);

comment on table public.interview_questions is
  '面試問題庫，來自公司知識庫（共用）或使用者自訂（私有）';

-- company_kb 題目：同一間公司底下題目文字不重複
create unique index if not exists interview_questions_company_kb_unique
  on public.interview_questions (company_id, question_text)
  where source = 'company_kb';

-- custom 題目：同一個使用者底下題目文字不重複
create unique index if not exists interview_questions_custom_unique
  on public.interview_questions (user_id, question_text)
  where source = 'custom';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.interview_questions enable row level security;

-- company_kb 題目所有登入使用者都能讀；custom 題目只有本人能讀
create policy "interview_questions_select"
  on public.interview_questions for select
  to authenticated
  using (source = 'company_kb' or auth.uid() = user_id);

-- 寫入：company_kb 題目允許任何登入使用者 insert（因為是「第一次被選用時才 materialize」，
-- 不是特定使用者專屬的資料，這裡沒有安全疑慮——內容本來就來自公開的公司知識庫檔案）；
-- custom 題目只能新增屬於自己的
create policy "interview_questions_insert"
  on public.interview_questions for insert
  to authenticated
  with check (
    (source = 'company_kb' and user_id is null)
    or (source = 'custom' and auth.uid() = user_id)
  );

-- ============================================================================
-- 追加 migration：20260731210100_mind_maps.sql
-- ============================================================================
-- ============================================================================
-- 0012: mind_maps（Mind Map Recall B-2）
-- ============================================================================
-- 一個使用者、一個問題，一份 Mind Map（React Flow 節點/邊格式）。
-- 從 story 的 STAR 拆解規則式產生，不是另外呼叫 AI 生成。

create table if not exists public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.interview_questions (id) on delete cascade,
  story_id uuid references public.stories (id) on delete set null,
  react_flow_data jsonb not null,      -- { nodes: [...], edges: [...] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, question_id)
);

comment on table public.mind_maps is
  'React Flow 格式的心智圖資料，從 stories 的 STAR 拆解規則式產生';

create index if not exists mind_maps_user_id_idx on public.mind_maps (user_id);

drop trigger if exists set_mind_maps_updated_at on public.mind_maps;
create trigger set_mind_maps_updated_at
  before update on public.mind_maps
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.mind_maps enable row level security;

create policy "mind_maps_select_own"
  on public.mind_maps for select
  using (auth.uid() = user_id);

create policy "mind_maps_insert_own"
  on public.mind_maps for insert
  with check (auth.uid() = user_id);

create policy "mind_maps_update_own"
  on public.mind_maps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "mind_maps_delete_own"
  on public.mind_maps for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 追加 migration：20260731230000_recall_attempts.sql
-- ============================================================================
-- ============================================================================
-- 0013: recall_attempts + learning_sessions.mode 加入 "recall"
-- ============================================================================

alter table public.learning_sessions
  drop constraint if exists learning_sessions_mode_check;

alter table public.learning_sessions
  add constraint learning_sessions_mode_check
  check (mode in ('shadowing', 'freetalk', 'scenario', 'interview', 'recall'));

-- Recall Training 專屬的評分維度，衛星表模式，跟 interview_evaluations 同一套設計原則：
-- session_turns 保持通用格式，模式專屬欄位另開表，一對一關聯。
create table if not exists public.recall_attempts (
  id uuid primary key default gen_random_uuid(),
  session_turn_id uuid not null references public.session_turns (id) on delete cascade,
  mind_map_id uuid not null references public.mind_maps (id) on delete cascade,
  level integer not null check (level in (1, 2, 3)),
  recall_time_seconds numeric check (recall_time_seconds >= 0),
  completeness_score numeric check (completeness_score >= 0 and completeness_score <= 100),
  confidence_score numeric check (confidence_score >= 0 and confidence_score <= 100),
  hint_level_used integer not null default 0 check (hint_level_used between 0 and 3),
  created_at timestamptz not null default now()
);

comment on table public.recall_attempts is
  'Mind Map Recall Training 的練習紀錄，透過 session_turn_id 跟 session_turns 一對一關聯';

create index if not exists recall_attempts_mind_map_id_idx on public.recall_attempts (mind_map_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.recall_attempts enable row level security;

create policy "recall_attempts_select_own"
  on public.recall_attempts for select
  using (
    exists (
      select 1
      from public.session_turns st
      join public.learning_sessions ls on ls.id = st.session_id
      where st.id = recall_attempts.session_turn_id
        and ls.user_id = auth.uid()
    )
  );

create policy "recall_attempts_insert_own"
  on public.recall_attempts for insert
  with check (
    exists (
      select 1
      from public.session_turns st
      join public.learning_sessions ls on ls.id = st.session_id
      where st.id = recall_attempts.session_turn_id
        and ls.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 追加 migration：20260801100000_add_live_chat_mode.sql
-- ============================================================================
-- ============================================================================
-- 0014: learning_sessions.mode 加入 "live_chat"
-- ============================================================================
-- Live API 即時對話練習，跟現有的 freetalk 分開記，方便之後篩選/統計。

alter table public.learning_sessions
  drop constraint if exists learning_sessions_mode_check;

alter table public.learning_sessions
  add constraint learning_sessions_mode_check
  check (mode in ('shadowing', 'freetalk', 'scenario', 'interview', 'recall', 'live_chat'));

-- ============================================================================
-- 追加 migration：20260802120000_coach_notes.sql
-- ============================================================================
-- ============================================================================
-- 0015: coach_notes
-- ============================================================================
-- 教練對使用者的長期質化觀察，跟 buildCoachMemoryContext() 的量化統計互補。
-- 在面試／Recall／Live Chat 練習結束時產生，累積起來後續會餵回教練記憶，
-- 讓 AI 能講出「你在 XX 常常...」這種基於長期模式的觀察，不只是單次分數。

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.learning_sessions (id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now()
);

comment on table public.coach_notes is
  '教練對使用者的長期質化觀察，累積後餵回教練記憶（buildCoachMemoryContext）';

create index if not exists coach_notes_user_id_created_at_idx
  on public.coach_notes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.coach_notes enable row level security;

create policy "coach_notes_select_own"
  on public.coach_notes for select
  using (auth.uid() = user_id);

create policy "coach_notes_insert_own"
  on public.coach_notes for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- 追加 migration：20260802140000_add_resume_text.sql
-- ============================================================================
-- ============================================================================
-- 0016: profiles 加入 resume_text
-- ============================================================================
-- 使用者的履歷內容（純文字貼上，不是檔案上傳），面試模式會把這個內容
-- 塞進 prompt，讓 AI 面試官問更貼近使用者真實背景的問題。
-- 一個使用者只有一份履歷，直接加欄位在 profiles，不用另開一張表。

alter table public.profiles
  add column if not exists resume_text text;
