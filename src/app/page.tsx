import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">SpeakFlow AI</h1>
        <p className="text-muted-foreground mt-1 text-sm">每天開口說英文</p>
        {user && (
          <p className="text-muted-foreground mt-2 text-xs">已登入：{user.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/practice/interview"
          className="bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-center text-sm font-medium shadow-lg active:scale-95"
        >
          模擬面試教練
        </Link>
        <Link
          href="/practice/mindmap"
          className="border-border text-foreground rounded-full border px-8 py-3.5 text-center text-sm font-medium active:scale-95"
        >
          Mind Map Recall
        </Link>
      </div>

      {user ? (
        <form action={logout}>
          <button type="submit" className="text-muted-foreground text-xs underline">
            登出
          </button>
        </form>
      ) : (
        <Link href="/login" className="text-muted-foreground text-xs underline">
          登入 / 註冊
        </Link>
      )}
    </main>
  );
}
