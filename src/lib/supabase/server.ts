import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Server Action / Route Handler 專用。
 * 用來讀寫 cookie 以維持登入狀態（Session）。
 *
 * 注意：Server Component 本身無法寫入 cookie（Next.js 限制），
 * 所以這裡的 setAll 用 try/catch 包起來 —— 如果是在 Server Component 中
 * 呼叫而寫入失敗，屬於預期行為，真正的 session refresh 由 middleware.ts 負責。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // 在 Server Component 中呼叫時會進到這裡，是預期行為。
          // 只要有 middleware.ts 負責 refresh session 即可，這裡忽略即可。
        }
      },
    },
  });
}
