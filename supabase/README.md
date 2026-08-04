# Supabase Schema

## 目錄結構

```
supabase/
├── migrations/          # 依序執行的 migration（Supabase CLI 慣用格式）
│   ├── 20260730120000_extensions.sql
│   ├── 20260730120010_profiles.sql
│   ├── 20260730120020_scenarios.sql
│   ├── 20260730120030_learning_sessions.sql
│   ├── 20260730120040_session_turns.sql
│   ├── 20260730120050_usage_logs.sql
│   ├── 20260730120060_storage.sql
│   ├── 20260731090000_add_interview_mode.sql
│   ├── 20260731150000_upgrade_gemini_model.sql
│   ├── 20260731170000_interview_evaluations.sql
│   ├── 20260731190000_stories.sql
│   ├── 20260731210000_interview_questions.sql
│   ├── 20260731210100_mind_maps.sql
│   ├── 20260731230000_recall_attempts.sql
│   ├── 20260801100000_add_live_chat_mode.sql
│   ├── 20260802120000_coach_notes.sql
│   └── 20260802140000_add_resume_text.sql
├── schema.sql            # 上面所有 migration 合併成單一檔案，方便手動貼到 SQL Editor
└── seed.sql              # 範例種子資料（3 個情境任務），供之後開發 scenario 模式測試用
```

## 匯入方式（擇一）

### 方式 A：用 Supabase CLI（建議，之後改 schema 比較好管理版本）

```bash
npm install -g supabase
supabase login
supabase link --project-ref <你的 project ref，在 Supabase Dashboard 網址列可以看到>
supabase db push
```

### 方式 B：手動貼到 SQL Editor（不想裝 CLI 的話）

1. 打開 Supabase Dashboard → 你的專案 → SQL Editor
2. 開一個新的 Query
3. 把 `supabase/schema.sql` 整份內容貼進去
4. 執行（Run）

兩種方式建立出來的資料庫結構完全一樣。

## 執行順序很重要

`migrations/` 底下的檔名開頭是時間戳記，**必須照檔名順序執行**，因為後面的 table 會用外鍵參照前面的 table
（例如 `learning_sessions` 參照 `profiles` 和 `scenarios`，`session_turns` 參照 `learning_sessions`）。
如果用 Supabase CLI 或直接執行 `schema.sql`，順序已經處理好了；如果你要自己一個一個檔案貼，記得照順序。

## 建完之後要做的事

1. **確認 Storage bucket 建立成功**：Dashboard → Storage，應該會看到一個叫 `session-audio` 的 private bucket。
2. **（可選）套用種子資料**：如果用 CLI，`supabase db reset` 會自動套用 `seed.sql`；
   如果用 SQL Editor，把 `seed.sql` 的內容另外貼一次執行即可。
3. **產生 TypeScript 型別**（強烈建議，之後查詢資料庫才有型別提示，不用手動維護介面）：
   ```bash
   supabase gen types typescript --project-id <project-ref> > src/types/supabase.ts
   ```
   產生後，`src/lib/supabase/client.ts` 與 `server.ts` 的 `createBrowserClient` / `createServerClient`
   可以再補上泛型 `<Database>`，拿到完整的型別安全查詢——這件事我們可以放到下一步再做。

## 關於 usage_logs 的寫入權限（重要，之前的架構決策延伸）

`usage_logs` 這張表**沒有開放一般使用者 insert**（見 `profiles_own` 之類 policy 的設計邏輯），
是刻意的：這張表是成本追蹤用途，如果讓使用者自己的 session 就能寫入，
使用者可以直接用瀏覽器開發者工具呼叫 Supabase 竄改用量紀錄。

所以寫入 `usage_logs` 必須透過 `src/lib/supabase/admin.ts` 的 `createAdminClient()`
（Service Role Client，會繞過 RLS），而且只能在後端程式碼（`ChatService`）呼叫，
絕對不能把這個 client 暴露給前端。這件事目前還是 TODO，會在串接 `ChatService` 寫入邏輯時一併處理。
