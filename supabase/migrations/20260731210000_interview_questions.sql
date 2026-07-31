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
