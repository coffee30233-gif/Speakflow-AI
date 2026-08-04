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
