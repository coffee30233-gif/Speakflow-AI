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
