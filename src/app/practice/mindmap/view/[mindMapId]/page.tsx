import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecallSessionClient } from "@/components/practice/RecallSessionClient";
import type { ReactFlowData } from "@/lib/mindmap/types";

interface RecallPageProps {
  params: Promise<{ mindMapId: string }>;
}

export default async function RecallPage({ params }: RecallPageProps) {
  const { mindMapId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/practice/mindmap/view/${mindMapId}/recall`);
  }

  const { data: mindMap, error } = await supabase
    .from("mind_maps")
    .select("id, react_flow_data, interview_questions ( question_text )")
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
  const findFullText = (id: string) =>
    reactFlowData.nodes.find((n) => n.id === id)?.data.fullText ?? "";
  const keywords = reactFlowData.nodes
    .filter((n) => n.data.kind === "keyword")
    .map((n) => n.data.fullText ?? n.data.label);
  const questionText =
    (mindMap as unknown as { interview_questions: { question_text: string } | null })
      .interview_questions?.question_text ?? findFullText("root");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-4 flex items-center justify-between">
        <Link href={`/practice/mindmap/view/${mindMapId}`} className="text-muted-foreground text-sm">
          ← 返回
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          Recall Training
        </span>
      </header>

      <div className="mb-4">
        <p className="text-muted-foreground text-xs">問題</p>
        <h1 className="text-lg font-medium">{questionText}</h1>
      </div>

      <RecallSessionClient
        mindMapId={mindMap.id}
        allNodes={reactFlowData.nodes}
        allEdges={reactFlowData.edges}
        story={{
          questionText,
          starSituation: findFullText("star-situation"),
          starTask: findFullText("star-task"),
          starAction: findFullText("star-action"),
          starResult: findFullText("star-result"),
          keywords,
        }}
      />
    </main>
  );
}
