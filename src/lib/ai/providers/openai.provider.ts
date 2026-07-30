import "server-only";
import type {
  AIProvider,
  SpeechProcessInput,
  SpeechProcessResult,
} from "@/lib/ai/types";
import { buildSpeechPrompt } from "@/lib/ai/prompt-builder";

/**
 * OpenAI GPT-5.5 Provider
 *
 * 與 GeminiProvider 實作同一組 AIProvider 介面。
 * ChatService／UI 不會知道也不需要知道這裡的實作細節。
 */
export class OpenAIProvider implements AIProvider {
  readonly id = "gpt-5.5";
  readonly displayName = "GPT-5.5（最佳品質✨）";

  private readonly apiKey: string;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.apiKey = key;
  }

  async processSpeech(input: SpeechProcessInput): Promise<SpeechProcessResult> {
    const prompt = buildSpeechPrompt(input);

    // TODO: 實作實際 OpenAI API 呼叫（原生音訊輸入 + structured output / JSON mode）
    void prompt;
    void this.apiKey;

    throw new Error("OpenAIProvider.processSpeech: not yet implemented");
  }

  async textToSpeech(text: string): Promise<string> {
    // TODO: 實作 OpenAI TTS 呼叫，回傳音檔 URL 或 base64 data URI
    void text;
    throw new Error("OpenAIProvider.textToSpeech: not yet implemented");
  }
}
