import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  AIProvider,
  SpeechProcessInput,
  SpeechProcessResult,
  StoryDecomposition,
} from "@/lib/ai/types";
import { buildSpeechPrompt } from "@/lib/ai/prompt-builder";
import { speechProcessResultSchema, storyDecompositionSchema } from "@/lib/ai/schemas";
import { requiresTechnicalEvaluation } from "@/lib/interview/prompt-builder";

/**
 * Gemini 3 Flash Provider
 *
 * 注意：這個檔案只能在 Server 端執行（route.ts / server actions），
 * 依賴 "server-only" 套件在編譯期防止被誤 import 進前端 bundle。
 * GEMINI_API_KEY 絕不可加 NEXT_PUBLIC_ 前綴。
 *
 * 設計重點：不使用 Whisper 做語音辨識。Gemini 支援原生音訊輸入（inlineData），
 * 搭配 responseSchema 可以一次請求同時拿到「逐字稿＋發音評分＋文法建議＋AI回覆」，
 * 不需要「錄音→轉文字→再丟給LLM」的兩段式管線。
 */

const MODEL_ID = "gemini-3-flash-preview";

/**
 * 較重的推理任務（Story 拆解、之後的面試/Mind Map 評分）改用 Pro 層級模型，
 * 品質比 Flash 好，代價是速度較慢、成本較高——這種任務通常是一次性、
 * 使用者能接受多等一點時間，跟即時互動的跟讀評分不一樣。
 *
 * 注意：原本規格文件寫的是 gemini-2.5-pro，查證後那個型號已經被 Google 棄用
 * （新專案呼叫會直接 404），這裡換成目前的替代型號 gemini-3.1-pro-preview。
 */
const PRO_MODEL_ID = "gemini-3.1-pro-preview";

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
  readonly id = "gemini-3-flash-preview";
  readonly displayName = "Gemini 3 Flash（免費⚡）";

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

    const isInterview = input.mode === "interview";
    const isTechnicalInterview =
      isInterview && !!input.interviewContext && requiresTechnicalEvaluation(input.interviewContext.interviewMode);

    const baseProperties: Record<string, unknown> = {
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
    };

    // interview 模式才要求模型多回傳 interviewEvaluation，其他模式完全不提這個欄位，
    // 避免非面試模式的請求裡出現用不到的欄位說明，讓 prompt 更乾淨。
    if (isInterview) {
      baseProperties.interviewEvaluation = {
        type: Type.OBJECT,
        description: "面試評分維度，僅面試模式需要",
        properties: isTechnicalInterview
          ? {
              technicalDepth: { type: Type.NUMBER, description: "技術深度，0-100" },
              starStructure: { type: Type.NUMBER, description: "STAR 結構完整度，0-100" },
              communication: { type: Type.NUMBER, description: "溝通表達，0-100" },
              engineeringThinking: { type: Type.NUMBER, description: "工程思維，0-100" },
            }
          : {
              starStructure: { type: Type.NUMBER, description: "STAR 結構完整度，0-100" },
              communication: { type: Type.NUMBER, description: "溝通表達，0-100" },
            },
        required: isTechnicalInterview
          ? ["technicalDepth", "starStructure", "communication", "engineeringThinking"]
          : ["starStructure", "communication"],
      };
    }

    // recall 模式才要求模型多回傳 recallEvaluation
    if (input.mode === "recall") {
      baseProperties.recallEvaluation = {
        type: Type.OBJECT,
        description: "回憶練習評分，僅 recall 模式需要",
        properties: {
          completeness: { type: Type.NUMBER, description: "回憶內容完整度，0-100" },
          confidence: { type: Type.NUMBER, description: "自然度／流暢度，0-100" },
        },
        required: ["completeness", "confidence"],
      };
    }

    // 較重的推理任務（面試評分、Recall 完整度比對）改用 Pro 層級模型，
    // 跟讀等互動節奏快的模式維持 Flash，換取速度。
    // 注意：這裡假設 gemini-3.1-pro-preview 跟 Flash 一樣支援 inlineData 原生音訊輸入，
    // 目前查證資料沒有明確反例，但也沒有查到明確保證，第一次實際呼叫時要留意有沒有報錯，
    // 如果不支援，這兩個模式的語音需要改走「先轉文字再推理」的兩段式管線。
    const isReasoningHeavy = input.mode === "interview" || input.mode === "recall";
    const modelForThisCall = isReasoningHeavy ? PRO_MODEL_ID : MODEL_ID;

    const response = await this.client.models.generateContent({
      model: modelForThisCall,
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
          properties: baseProperties,
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
    // （gemini-3.1-flash-tts-preview），回傳 PCM 音訊，
    // 需要另外處理成瀏覽器可播放的格式（如轉 WAV data URI），先保留介面。
    void text;
    throw new Error("GeminiProvider.textToSpeech: not yet implemented");
  }

  async decomposeStory(storyTextZh: string): Promise<StoryDecomposition> {
    const prompt = `你是一位英文面試教練，同時精通中文。使用者會用中文寫下一段自己的個人經歷或故事，
這段故事之後會被用來準備英文求職面試的口說回答。請你：

1. contentEn：用英文簡潔重寫這個故事的核心內容
2. 拆解成 STAR 架構，每一項都用英文簡短描述：
   - starSituation：情境（當時的背景/處境）
   - starTask：任務（面臨的目標或挑戰）
   - starAction：行動（實際採取了什麼行動）
   - starResult：結果（產生了什麼結果或學到什麼）
3. keywords：抽取 3-6 個英文關鍵字，目的是讓使用者之後只看到這幾個關鍵字，
   就能想起整個故事的脈絡（用於 Mind Map 的回憶提示，不是隨便摘要用字）
4. bestAnswerEn：根據這個故事，草擬一個適合在面試中口說的英文最佳答案，
   長度約 60-90 秒的口說份量（約 150-200 字），符合 STAR 結構

使用者的故事（中文）：
「${storyTextZh}」

請回傳結構化 JSON，所有欄位都用英文（keywords 陣列裡的每個字也是英文）。`;

    const response = await this.client.models.generateContent({
      model: PRO_MODEL_ID,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contentEn: { type: Type.STRING },
            starSituation: { type: Type.STRING },
            starTask: { type: Type.STRING },
            starAction: { type: Type.STRING },
            starResult: { type: Type.STRING },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            bestAnswerEn: { type: Type.STRING },
          },
          required: [
            "contentEn",
            "starSituation",
            "starTask",
            "starAction",
            "starResult",
            "keywords",
            "bestAnswerEn",
          ],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("GeminiProvider.decomposeStory: model returned an empty response");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(
        `GeminiProvider.decomposeStory: model returned invalid JSON: ${rawText.slice(0, 200)}`,
      );
    }

    const result = storyDecompositionSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new Error(
        `GeminiProvider.decomposeStory: response failed schema validation: ${result.error.message}`,
      );
    }

    return result.data;
  }
}
