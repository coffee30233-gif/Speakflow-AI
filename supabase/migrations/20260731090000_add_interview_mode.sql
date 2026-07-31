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
