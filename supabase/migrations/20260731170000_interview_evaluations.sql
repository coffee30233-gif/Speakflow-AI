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
