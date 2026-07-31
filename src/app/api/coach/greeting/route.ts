import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chatService } from "@/lib/ai/chat.service";

/**
 * POST /api/coach/greeting
 *
 * Voice Coach 開場小聊天用：查教練記憶、生成問候語、合成語音，一次回傳。
 */

const PROVIDER_ID = "gemini-3-flash-preview";

const requestSchema = z.object({
  // 目前用不到，先留著方便之後依模式客製化問候語內容（例如面試 vs Recall 語氣略有不同）
  context: z.enum(["interview", "recall"]).optional(),
});

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const greeting = await chatService.getGreeting(PROVIDER_ID, user.id, supabase);
    return NextResponse.json(greeting);
  } catch (err) {
    console.error("[coach/greeting] failed:", err);
    return NextResponse.json({ error: "產生問候語失敗" }, { status: 502 });
  }
}
