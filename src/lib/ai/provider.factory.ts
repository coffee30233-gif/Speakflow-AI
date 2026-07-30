import "server-only";
import type { AIProvider } from "@/lib/ai/types";
import { GeminiProvider } from "@/lib/ai/providers/gemini.provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai.provider";

/**
 * 供應商註冊表。
 *
 * 未來新增 Claude / Grok / DeepSeek，只需要：
 *   1. 在 providers/ 底下新增 claude.provider.ts，實作 AIProvider
 *   2. 在下面這個 map 多加一行
 * 不需要修改 ChatService，也不需要修改任何 UI 元件或 API route。
 *
 * 使用 lazy getter 而非直接 new，避免在 constructor 就檢查 API Key，
 * 導致還沒用到某個 Provider 時就因為缺少該 Provider 的 Key 而整個 module 載入失敗。
 */
const providerRegistry: Record<string, () => AIProvider> = {
  "gemini-2.5-flash": () => new GeminiProvider(),
  "gpt-5.5": () => new OpenAIProvider(),
};

export const AVAILABLE_PROVIDER_IDS = Object.keys(providerRegistry);

export function getAIProvider(providerId: string): AIProvider {
  const factory = providerRegistry[providerId];
  if (!factory) {
    throw new Error(
      `Unknown AI provider id: "${providerId}". Available: ${AVAILABLE_PROVIDER_IDS.join(", ")}`,
    );
  }
  return factory();
}
