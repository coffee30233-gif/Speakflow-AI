import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeForm } from "@/components/practice/ResumeForm";

export default async function ResumeSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings/resume");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_text")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/practice/interview" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">我的履歷</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          貼上你的履歷內容，面試模式的 AI 面試官會參考這些內容，問更貼近你真實背景的問題
          （不上傳檔案，直接貼文字最可靠）。
        </p>
      </div>

      <ResumeForm initialResumeText={profile?.resume_text ?? ""} />
    </main>
  );
}
