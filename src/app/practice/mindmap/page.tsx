import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface StoryRow {
  id: string;
  title: string;
  keywords: string[] | null;
  created_at: string;
}

interface MindMapRow {
  id: string;
  question_id: string;
  interview_questions: { question_text: string } | null;
}

export default async function MindMapHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/mindmap");
  }

  const { data: stories, error: storiesError } = await supabase
    .from("stories")
    .select("id, title, keywords, created_at")
    .order("created_at", { ascending: false });

  if (storiesError) {
    console.error("[mindmap] failed to load stories:", storiesError);
  }

  const { data: mindMaps, error: mindMapsError } = await supabase
    .from("mind_maps")
    .select("id, question_id, interview_questions ( question_text )")
    .order("created_at", { ascending: false });

  if (mindMapsError) {
    console.error("[mindmap] failed to load mind maps:", mindMapsError);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          Mind Map Recall
        </span>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">我的故事庫</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          先寫下你的個人故事，AI 會幫你拆成 STAR 結構、關鍵字跟英文最佳答案，
          之後才能練習「不看稿子」把答案講出來。
        </p>
      </div>

      <Link
        href="/practice/mindmap/stories/new"
        className="bg-primary text-primary-foreground mb-6 rounded-lg py-3 text-center text-sm font-medium"
      >
        + 寫一篇新故事
      </Link>

      {(!stories || stories.length === 0) && (
        <p className="text-muted-foreground text-center text-sm">
          還沒有任何故事，先從上面按鈕開始寫第一篇。
        </p>
      )}

      <div className="space-y-2">
        {(stories as StoryRow[] | null)?.map((story) => (
          <div key={story.id} className="bg-card border-border rounded-lg border p-3">
            <p className="text-sm font-medium">{story.title}</p>
            {story.keywords && story.keywords.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {story.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[10px]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
            <Link
              href={`/practice/mindmap/stories/${story.id}/build`}
              className="text-primary mt-2 inline-block text-xs font-medium"
            >
              生成 Mind Map →
            </Link>
          </div>
        ))}
      </div>

      {mindMaps && mindMaps.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">我的 Mind Map</h2>
          <div className="space-y-2">
            {(mindMaps as unknown as MindMapRow[]).map((mm) => (
              <Link
                key={mm.id}
                href={`/practice/mindmap/view/${mm.id}`}
                className="bg-card border-border block rounded-lg border p-3 text-sm"
              >
                {mm.interview_questions?.question_text ?? "（問題）"}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
