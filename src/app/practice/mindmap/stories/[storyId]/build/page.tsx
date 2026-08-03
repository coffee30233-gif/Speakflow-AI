import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAllCompanies } from "@/lib/interview/company-registry";
import { listBehavioralQuestions } from "@/lib/interview/opening-question";
import { BuildMindMapForm } from "@/components/practice/BuildMindMapForm";

interface BuildMindMapPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function BuildMindMapPage({ params }: BuildMindMapPageProps) {
  const { storyId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/practice/mindmap/stories/${storyId}/build`);
  }

  const { data: story, error } = await supabase
    .from("stories")
    .select("id, title, star_situation")
    .eq("id", storyId)
    .single();

  if (error || !story) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-destructive text-sm">找不到這則故事。</p>
        <Link
          href="/practice/mindmap"
          className="bg-primary text-primary-foreground rounded-lg px-6 py-3 text-sm font-medium"
        >
          回到故事庫
        </Link>
      </main>
    );
  }

  if (!story.star_situation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-destructive text-sm">
          這則故事還沒有完整的 STAR 拆解，請重新建立一次。
        </p>
        <Link
          href="/practice/mindmap"
          className="bg-primary text-primary-foreground rounded-lg px-6 py-3 text-sm font-medium"
        >
          回到故事庫
        </Link>
      </main>
    );
  }

  // V1 階段目前只有 ASML 一間公司，這裡先簡化直接取第一間；
  // 之後如果 companies/ 底下有多間公司，這裡需要讓使用者先選公司。
  const companies = listAllCompanies();
  const company = companies[0];
  const behavioralQuestions = company ? listBehavioralQuestions(company.id) : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/practice/mindmap" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">生成 Mind Map</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          幫故事「{story.title}」選一個要對應的面試問題。
        </p>
      </div>

      <BuildMindMapForm
        storyId={story.id}
        companyId={company?.id ?? ""}
        companyBehavioralQuestions={behavioralQuestions}
      />
    </main>
  );
}
