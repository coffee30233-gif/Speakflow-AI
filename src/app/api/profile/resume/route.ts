import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/profile/resume
 *
 * 更新使用者的履歷文字。刻意允許空字串（等於清空履歷），
 * 所以這裡不用 .min(1)，讓使用者可以把履歷清掉。
 */

const requestSchema = z.object({
  resumeText: z.string().max(8000),
});

export async function PATCH(req: NextRequest) {
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

  const { error } = await supabase
    .from("profiles")
    .update({ resume_text: parsed.data.resumeText || null })
    .eq("id", user.id);

  if (error) {
    console.error("[profile/resume] update failed:", error);
    return NextResponse.json({ error: "儲存履歷失敗" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
