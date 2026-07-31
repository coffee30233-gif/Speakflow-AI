import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllCompanies } from "@/lib/interview/company-registry";
import { createClient } from "@/lib/supabase/server";
import { InterviewSetupForm } from "@/components/practice/InterviewSetupForm";

/**
 * Server Component：先確認登入狀態（面試結果現在會寫進資料庫，需要 user_id），
 * 沒登入就導去 /login。同時直接呼叫 listAllCompanies()（底層用 fs 讀 companies/ 資料夾），
 * 把結果當作純資料傳給 Client Component。
 *
 * 這樣設計的好處：新增公司時，這個頁面完全不用改，
 * listAllCompanies() 會自動反映 companies/ 底下有哪些資料夾。
 */
export default async function InterviewSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/interview");
  }

  const companies = listAllCompanies();

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
