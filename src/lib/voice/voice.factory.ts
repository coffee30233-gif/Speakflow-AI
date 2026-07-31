import "server-only";
import type { VoiceProvider } from "@/lib/voice/types";
import { GeminiVoiceProvider } from "@/lib/voice/providers/gemini-voice.provider";

/**
 * 目前只有一個聲音實作，但刻意包成跟 lib/ai/provider.factory.ts 一樣的 factory pattern。
 * 之後如果要換成 ElevenLabs 或其他 TTS 服務，只需要新增一個 VoiceProvider 實作、
 * 改這裡回傳的實例，ChatService 完全不用改。
 *
 * 重要：這裡永遠回傳同一個聲音實作，完全不看使用者選的是哪個 AIProvider（Gemini/GPT-5.5）——
 * 這是刻意設計，「教練的聲音」跟「文字生成用哪個模型」是兩件獨立的事，
 * 詳見 lib/voice/types.ts 的說明。
 */
let cachedVoiceProvider: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (!cachedVoiceProvider) {
    cachedVoiceProvider = new GeminiVoiceProvider();
  }
  return cachedVoiceProvider;
}
