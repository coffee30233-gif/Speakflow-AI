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
