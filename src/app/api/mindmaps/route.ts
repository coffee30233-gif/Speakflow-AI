import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildMindMapFromStory } from "@/lib/mindmap/build-mindmap";

/**
 * POST /api/mindmaps
 *
 * 把一則 story 對應到一個 question，規則式產生 React Flow 節點圖並存檔。
 * 不呼叫 AI——story 的 STAR 拆解在 B-1 階段已經做完了，這裡純粹是資料轉換。
 */

const requestSchema = z.object({
  storyId: z.string().uuid(),
  questionText: z.string().min(1).max(300),
  source: z.enum(["company_kb", "custom"]),
  companyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { storyId, questionText, source, companyId } = parsed.data;

  if (source === "company_kb" && !companyId) {
    return NextResponse.json(
      { error: "company_kb 來源的題目必須提供 companyId" },
      { status: 400 },
    );
  }

  // 1. 確認 story 屬於這個使用者（RLS 也會擋，這裡先明確查一次，順便把內容拿出來用）
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("id, star_situation, star_task, star_action, star_result, keywords")
    .eq("id", storyId)
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: "找不到這則故事" }, { status: 404 });
  }
  if (!story.star_situation || !story.star_task || !story.star_action || !story.star_result) {
    return NextResponse.json(
      { error: "這則故事還沒有完整的 STAR 拆解，無法生成 Mind Map" },
      { status: 400 },
    );
  }

  // 2. Find-or-create 這個問題
  const questionQuery =
    source === "company_kb"
      ? supabase
          .from("interview_questions")
          .select("id")
          .eq("source", "company_kb")
          .eq("company_id", companyId!)
          .eq("question_text", questionText)
      : supabase
          .from("interview_questions")
          .select("id")
          .eq("source", "custom")
          .eq("user_id", user.id)
          .eq("question_text", questionText);

  const { data: existingQuestion } = await questionQuery.maybeSingle();

  let questionId = existingQuestion?.id as string | undefined;

  if (!questionId) {
    const { data: newQuestion, error: insertQuestionError } = await supabase
      .from("interview_questions")
      .insert(
        source === "company_kb"
          ? { source, company_id: companyId, question_text: questionText, user_id: null }
          : { source, user_id: user.id, question_text: questionText },
      )
      .select("id")
      .single();

    if (insertQuestionError || !newQuestion) {
      console.error("[mindmaps] failed to create question:", insertQuestionError);
      return NextResponse.json({ error: "建立問題失敗" }, { status: 500 });
    }
    questionId = newQuestion.id;
  }

  // 3. 規則式產生 React Flow 資料
  const reactFlowData = buildMindMapFromStory(questionText, {
    starSituation: story.star_situation,
    starTask: story.star_task,
    starAction: story.star_action,
    starResult: story.star_result,
    keywords: story.keywords ?? [],
  });

  // 4. Upsert mind_maps（一個使用者、一個問題只有一份）
  const { data: mindMap, error: upsertError } = await supabase
    .from("mind_maps")
    .upsert(
      {
        user_id: user.id,
        question_id: questionId,
        story_id: storyId,
        react_flow_data: reactFlowData,
      },
      { onConflict: "user_id,question_id" },
    )
    .select("*")
    .single();

  if (upsertError) {
    console.error("[mindmaps] upsert failed:", upsertError);
    return NextResponse.json({ error: "儲存 Mind Map 失敗" }, { status: 500 });
  }

  return NextResponse.json({ mindMap });
}
