-- ============================================================================
-- 0014: learning_sessions.mode 加入 "live_chat"
-- ============================================================================
-- Live API 即時對話練習，跟現有的 freetalk 分開記，方便之後篩選/統計。

alter table public.learning_sessions
  drop constraint if exists learning_sessions_mode_check;

alter table public.learning_sessions
  add constraint learning_sessions_mode_check
  check (mode in ('shadowing', 'freetalk', 'scenario', 'interview', 'recall', 'live_chat'));
