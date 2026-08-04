import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllCompanies } from "@/lib/interview/company-registry";
import { createClient } from "@/lib/supabase/server";
import { InterviewSetupForm } from "@/components/practice/InterviewSetupForm";

export default async function InterviewSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/interview");
  }

  const companies = listAllCompanies();

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_text")
    .eq("id", user.id)
    .single();
  const hasResume = !!profile?.resume_text;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          面試教練模式
        </span>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">模擬面試設定</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          選擇公司、職位與面試模式，開始一場模擬面試練習。
        </p>
      </div>

      <Link
        href="/settings/resume"
        className="bg-card border-border mb-6 flex items-center justify-between rounded-lg border p-3 text-sm"
      >
        <span>{hasResume ? "✓ 已設定我的履歷" : "+ 貼上我的履歷（選填）"}</span>
        <span className="text-muted-foreground text-xs">
          {hasResume ? "編輯" : "設定"} →
        </span>
      </Link>

      {companies.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          目前還沒有任何公司的知識庫資料，請先在 companies/ 底下新增。
        </p>
      ) : (
        <InterviewSetupForm companies={companies} />
      )}
    </main>
  );
}
