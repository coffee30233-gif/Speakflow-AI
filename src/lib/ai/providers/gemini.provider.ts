import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  AIProvider,
  SpeechProcessInput,
  SpeechProcessResult,
} from "@/lib/ai/types";
import { buildSpeechPrompt } from "@/lib/ai/prompt-builder";
import { speechProcessResultSchema } from "@/lib/ai/schemas";

/**
 * Gemini 2.5 Flash Provider
 *
 * 注意：這個檔案只能在 Server 端執行（route.ts / server actions），
 * 依賴 "server-only" 套件在編譯期防止被誤 import 進前端 bundle。
 * GEMINI_API_KEY 絕不可加 NEXT_PUBLIC_ 前綴。
 *
 * 設計重點：不使用 Whisper 做語音辨識。Gemini 支援原生音訊輸入（inlineData），
 * 搭配 responseSchema 可以一次請求同時拿到「逐字稿＋發音評分＋文法建議＋AI回覆」，
 * 不需要「錄音→轉文字→再丟給LLM」的兩段式管線。
 */

const MODEL_ID = "gemini-2.5-flash";

/**
 * Gemini 官方文件列出的支援音訊格式：wav / mp3 / aiff / aac / ogg / flac。
 * iOS Safari 的 MediaRecorder 實際會產生什麼 mimeType（例如 "audio/mp4"），
 * 要等下一步做錄音功能時實測確認，屆時可能需要在前端轉檔或在這裡做格式映射。
 * 這裡先做寬鬆檢查＋警告，不擋住流程，避免格式問題卡死整個功能。
 */
const KNOWN_SUPPORTED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
]);

export class GeminiProvider implements AIProvider {
  readonly id = "gemini-2.5-flash";
  readonly displayName = "Gemini 2.5 Flash（免費⚡）";

  private readonly client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async processSpeech(input: SpeechProcessInput): Promise<SpeechProcessResult> {
    if (!KNOWN_SUPPORTED_MIME_TYPES.has(input.audioFormat)) {
      // 不擋流程，但留下明確紀錄，方便之後除錯格式問題
      console.warn(
        `[GeminiProvider] audioFormat "${input.audioFormat}" 不在已知支援清單中，仍嘗試送出請求`,
      );
    }

    const prompt = buildSpeechPrompt(input);

    const response = await this.client.models.generateContent({
      model: MODEL_ID,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: input.audioFormat,
            data: input.audioBase64,
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.STRING,
              description: "使用者語音的逐字稿",
            },
            pronunciationScore: {
              type: Type.NUMBER,
              description: "發音評分，0-100",
            },
            grammarFeedback: {
              type: Type.ARRAY,
              description: "文法／用字修正建議，若無錯誤則為空陣列",
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ["original", "suggestion", "reason"],
              },
            },
            aiReplyText: {
              type: Type.STRING,
              description: "教練口吻的回應或延續對話的下一句",
            },
          },
          required: ["transcript", "aiReplyText"],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("GeminiProvider: model returned an empty response");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(
        `GeminiProvider: model returned invalid JSON: ${rawText.slice(0, 200)}`,
      );
    }

    // 用 Zod 做運行時驗證，避免格式不符的資料流向 ChatService / UI
    const result = speechProcessResultSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new Error(
        `GeminiProvider: response failed schema validation: ${result.error.message}`,
      );
    }

    return result.data;
  }

  async textToSpeech(text: string): Promise<string> {
    // TODO: 下一個開發步驟再實作。Gemini TTS 走的是另一個 model
    // （例如 gemini-2.5-flash-preview-tts），回傳 PCM 音訊，
    // 需要另外處理成瀏覽器可播放的格式（如轉 WAV data URI），先保留介面。
    void text;
    throw new Error("GeminiProvider.textToSpeech: not yet implemented");
  }
}
