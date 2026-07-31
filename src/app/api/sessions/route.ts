import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AVAILABLE_PROVIDER_IDS } from "@/lib/ai/provider.factory";

/**
 * POST /api/sessions
 *
 * 建立一個新的 learning_sessions 資料列。
 * 用的是「使用者 session 綁定」的 Supabase client（不是 admin client），
 * 讓 Postgres RLS 的 insert policy（auth.uid() = user_id）正常把關——
 * 這裡完全不用自己手動檢查 user_id 是否正確，寫錯 RLS 會直接拒絕。
 */

const requestSchema = z.object({
  mode: z.enum(["shadowing", "freetalk", "scenario", "interview"]),
  // 合法的模型 id 直接從 provider.factory 取得，跟 /api/speech-process 共用同一個來源，
  // 避免兩邊各寫一份列表，改了型號卻忘記同步更新。
  aiModelUsed: z.enum(AVAILABLE_PROVIDER_IDS as [string, ...string[]]),
  scenarioId: z.string().optional(),
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

  const { mode, aiModelUsed, scenarioId } = parsed.data;

  const { data, error } = await supabase
    .from("learning_sessions")
    .insert({
      user_id: user.id,
      mode,
      ai_model_used: aiModelUsed,
      scenario_id: mode === "scenario" ? (scenarioId ?? null) : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[sessions] create failed:", error);
    return NextResponse.json({ error: "建立練習紀錄失敗" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: data.id });
}
