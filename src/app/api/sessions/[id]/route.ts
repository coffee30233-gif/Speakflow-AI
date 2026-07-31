import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/sessions/[id]
 *
 * 結束一場練習：填入 ended_at 與（可選的）overall_score。
 * 一樣透過使用者 session 綁定的 client，RLS 的 update policy
 * （auth.uid() = user_id）會確保使用者只能結束自己的 session。
 */

const requestSchema = z.object({
  overallScore: z.number().min(0).max(100).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("learning_sessions")
    .update({
      ended_at: new Date().toISOString(),
      overall_score: parsed.data.overallScore ?? null,
    })
    .eq("id", id);

  if (error) {
    console.error("[sessions] end failed:", error);
    return NextResponse.json({ error: "結束練習紀錄失敗" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
