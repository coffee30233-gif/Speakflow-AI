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
