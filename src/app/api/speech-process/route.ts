import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatService } from "@/lib/ai/chat.service";
import { AVAILABLE_PROVIDER_IDS } from "@/lib/ai/provider.factory";

/**
 * POST /api/speech-process
 *
 * 這是前端唯一會呼叫的端點。前端不知道、也不需要知道
 * 背後究竟是 Gemini 還是 OpenAI 在處理——那是 ChatService 與 Provider 的責任。
 */

const requestSchema = z.object({
  providerId: z.enum(AVAILABLE_PROVIDER_IDS as [string, ...string[]]),
  mode: z.enum(["shadowing", "freetalk", "scenario"]),
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
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { providerId, ...input } = parsed.data;

  try {
    const result = await chatService.processSpeech(providerId, input);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[speech-process] failed:", err);
    return NextResponse.json(
      { error: "AI processing failed. Please try again." },
      { status: 502 },
    );
  }
}
