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
