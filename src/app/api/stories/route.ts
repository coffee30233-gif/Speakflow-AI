import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chatService } from "@/lib/ai/chat.service";

/**
 * POST /api/stories
 *
 * 建立一則故事：使用者傳中文原文，這裡呼叫 ChatService.decomposeStory()
 * 拿到 STAR／關鍵字／英文最佳答案，一次寫進 stories 資料表。
 *
 * 目前固定用 Gemini（下面的 PROVIDER_ID）——decomposeStory 是重推理任務，
 * GeminiProvider 內部本來就會自動切去 Pro 層級模型，這裡不用讓使用者選。
 */

const PROVIDER_ID = "gemini-3-flash-preview";

const requestSchema = z.object({
  title: z.string().min(1).max(100),
  contentZh: z.string().min(1).max(4000),
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

  const { title, contentZh } = parsed.data;

  let decomposition;
  try {
    decomposition = await chatService.decomposeStory(PROVIDER_ID, contentZh, user.id);
  } catch (err) {
    console.error("[stories] decomposeStory failed:", err);
    return NextResponse.json(
      { error: "AI 拆解故事失敗，請再試一次" },
      { status: 502 },
    );
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      title,
      content_zh: contentZh,
      content_en: decomposition.contentEn,
      star_situation: decomposition.starSituation,
      star_task: decomposition.starTask,
      star_action: decomposition.starAction,
      star_result: decomposition.starResult,
      keywords: decomposition.keywords,
      best_answer_en: decomposition.bestAnswerEn,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[stories] insert failed:", error);
    return NextResponse.json({ error: "儲存故事失敗" }, { status: 500 });
  }

  return NextResponse.json({ story: data });
}
