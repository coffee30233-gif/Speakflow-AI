import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service Role Client — 會繞過 RLS，只能在信任的 Server 端程式碼使用
 * （例如 ChatService 寫入 usage_logs、或後台維護 scenarios 內容）。
 *
 * 絕對不可以：
 *   - 把這個 client 暴露給前端
 *   - 用這個 client 處理任何「應該由使用者自己 session 驗證」的操作
 *     （例如讀寫使用者自己的 learning_sessions，那些應該用
 *      src/lib/supabase/server.ts 的一般 client，讓 RLS 正常把關）
 *
 * 這個 client 存在的唯一理由，是 usage_logs 這張表刻意「不」開放
 * 一般使用者 insert（避免使用者自己竄改用量紀錄），所以寫入只能
 * 從我們自己信任的後端程式碼、用 service role key 完成。
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
