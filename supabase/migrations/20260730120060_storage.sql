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
