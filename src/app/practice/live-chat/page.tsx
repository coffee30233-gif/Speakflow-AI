import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LiveChatSessionClient } from "@/components/practice/LiveChatSessionClient";

export default async function LiveChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/live-chat");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          跟教練聊聊
        </span>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">自然對話練習</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          即時語音對話，教練會在你講話時自然糾正文法跟用字，結束後幫你整理這次值得注意的地方。
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          💡 建議戴耳機使用——用喇叭的話，教練的聲音容易被麥克風收回去，
          可能會誤判成你在打斷他，講到一半突然被切斷。
        </p>
      </div>

      <LiveChatSessionClient />
    </main>
  );
}
