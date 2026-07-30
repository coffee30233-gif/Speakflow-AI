import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Component 專用。用於在瀏覽器端呼叫 Supabase
 * （例如登入表單、即時讀取使用者自己的資料）。
 *
 * 安全性由 Postgres 的 Row Level Security（RLS）把關，
 * 不是靠隱藏這組 anon key —— 這組 key 本來就設計成可以公開在前端。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
