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


