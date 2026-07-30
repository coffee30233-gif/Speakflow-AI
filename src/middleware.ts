import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Server Component 無法自己寫入 cookie，
 * 所以需要 middleware 在每次 navigation 時刷新過期的 Auth token，
 * 並把新的 token 寫回 cookie，讓後續的 Server Component 讀到最新的登入狀態。
 *
 * 這是 Supabase 官方文件的標準模式，不是我們自己發明的。
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 這行會觸發 token 刷新（如果需要的話），必須呼叫，不能省略
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 排除不需要驗證 session 的路徑：靜態資源、圖片、manifest、service worker
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
