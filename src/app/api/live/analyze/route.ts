import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chatService } from "@/lib/ai/chat.service";

/**
 * POST /api/live/analyze
 *
 * Live API 對話結束後呼叫：把累積的逐字稿送去做事後分析，
 * 抓出文法/用字的改進點，寫進 session_turns。
 */

const PROVIDER_ID = "gemini-3-flash-preview";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  transcript: z.string().min(1),
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

  try {
    const analysis = await chatService.analyzeLiveConversation(
      PROVIDER_ID,
      parsed.data.transcript,
      { userId: user.id, sessionId: parsed.data.sessionId },
      supabase,
    );
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[live/analyze] failed:", err);
    return NextResponse.json({ error: "分析對話失敗" }, { status: 502 });
  }
}
