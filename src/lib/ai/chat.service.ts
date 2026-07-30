import "server-only";
import { getAIProvider } from "@/lib/ai/provider.factory";
import type { SpeechProcessInput, SpeechProcessResult } from "@/lib/ai/types";

/**
 * ChatService — UI／API Route 唯一應該呼叫的入口。
 *
 * 架構規則（重要）：
 *   UI  ─────▶  API Route (route.ts)  ─────▶  ChatService  ─────▶  AIProvider
 *
 * UI 元件與 API Route 都「不應該」直接 import GeminiProvider 或 OpenAIProvider，
 * 一律透過 ChatService。這樣未來如果要加上：
 *   - 使用量計費 / usage_logs 紀錄
 *   - 重試邏輯 / fallback（例如 Gemini 失敗自動改打 OpenAI）
 *   - 回應快取
 * 都只需要修改這一個檔案，UI 完全不受影響。
 */
export class ChatService {
  /**
   * 處理一輪語音互動。
   * @param providerId 使用者當前選擇的模型，例如 "gemini-2.5-flash" 或 "gpt-5.5"
   */
  async processSpeech(
    providerId: string,
    input: SpeechProcessInput,
  ): Promise<SpeechProcessResult> {
    const provider = getAIProvider(providerId);

    const result = await provider.processSpeech(input);

    // TODO: 未來在此處寫入 usage_logs（Firestore），記錄使用的 provider / 預估成本
    // TODO: 未來在此處寫入 session_turns

    return result;
  }

  async textToSpeech(providerId: string, text: string): Promise<string> {
    const provider = getAIProvider(providerId);
    return provider.textToSpeech(text);
  }
}

/** 單例，供 API Route 直接 import 使用 */
export const chatService = new ChatService();
