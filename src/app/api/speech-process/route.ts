import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatService } from "@/lib/ai/chat.service";
import { AVAILABLE_PROVIDER_IDS } from "@/lib/ai/provider.factory";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/speech-process
 *
 * 這是前端唯一會呼叫的端點。前端不知道、也不需要知道
 * 背後究竟是 Gemini 還是 OpenAI 在處理——那是 ChatService 與 Provider 的責任。
 *
 * 這個端點現在需要登入：因為結果會寫進 session_turns / usage_logs，
 * 這些資料都需要一個 user_id。sessionId 則需要先呼叫 POST /api/sessions 取得。
 */

const interviewContextSchema = z.object({
  companyId: z.string().min(1),
  position: z.string().min(1),
  interviewMode: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  resumeText: z.string().optional(),
  currentQuestion: z.string().optional(),
});

const requestSchema = z
  .object({
    providerId: z.enum(AVAILABLE_PROVIDER_IDS as [string, ...string[]]),
    mode: z.enum(["shadowing", "freetalk", "scenario", "interview"]),
    audioBase64: z.string().min(1),
    audioFormat: z.string().min(1),
    contextTurns: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string(),
        }),
      )
      .default([]),
    targetSentence: z.string().optional(),
    scenarioSystemPrompt: z.string().optional(),
    interviewContext: interviewContextSchema.optional(),
    sessionId: z.string().uuid(),
    turnIndex: z.number().int().min(0),
  })
  .refine((data) => data.mode !== "interview" || data.interviewContext !== undefined, {
    message: "interview 模式必須提供 interviewContext",
    path: ["interviewContext"],
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

  const { providerId, sessionId, turnIndex, ...input } = parsed.data;

  try {
    const result = await chatService.processSpeech(
      providerId,
      input,
      { userId: user.id, sessionId, turnIndex },
      supabase,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[speech-process] failed:", err);
    return NextResponse.json(
      { error: "AI processing failed. Please try again." },
      { status: 502 },
    );
  }
}
