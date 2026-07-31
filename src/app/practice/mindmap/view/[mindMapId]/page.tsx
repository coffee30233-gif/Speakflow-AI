import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MindMapCanvas } from "@/components/practice/MindMapCanvas";
import type { ReactFlowData } from "@/lib/mindmap/types";

interface MindMapViewPageProps {
  params: Promise<{ mindMapId: string }>;
}

export default async function MindMapViewPage({ params }: MindMapViewPageProps) {
  const { mindMapId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/practice/mindmap/view/${mindMapId}`);
  }

  const { data: mindMap, error } = await supabase
    .from("mind_maps")
    .select("id, react_flow_data, question_id, interview_questions ( question_text )")
    .eq("id", mindMapId)
    .single();

  if (error || !mindMap) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-destructive text-sm">找不到這份 Mind Map。</p>
        <Link
          href="/practice/mindmap"
          className="bg-primary text-primary-foreground rounded-lg px-6 py-3 text-sm font-medium"
        >
          回到故事庫
        </Link>
      </main>
    );
  }

  const reactFlowData = mindMap.react_flow_data as ReactFlowData;
  // Supabase 用 foreign table join 撈出來的關聯資料，型別上是陣列或物件視查詢語法而定，
  // 這裡用型別斷言簡化處理（之後接上 supabase gen types 就不用手動斷言了）
  const questionText =
    (mindMap as unknown as { interview_questions: { question_text: string } | null })
      .interview_questions?.question_text ?? "（問題）";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/practice/mindmap" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
      </header>

      <div className="mb-4">
        <p className="text-muted-foreground text-xs">問題</p>
        <h1 className="text-lg font-medium">{questionText}</h1>
      </div>

      <MindMapCanvas
        mindMapId={mindMap.id}
        initialNodes={reactFlowData.nodes}
        initialEdges={reactFlowData.edges}
      />

      <Link
        href={`/practice/mindmap/view/${mindMap.id}/recall`}
        className="bg-primary text-primary-foreground mt-4 rounded-lg py-3 text-center text-sm font-medium"
      >
        開始 Recall 練習 →
      </Link>
    </main>
  );
}
