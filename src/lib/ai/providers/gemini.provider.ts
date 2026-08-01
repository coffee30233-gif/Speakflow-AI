import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  AIProvider,
  SpeechProcessInput,
  SpeechProcessResult,
  StoryDecomposition,
  ConversationAnalysis,
} from "@/lib/ai/types";
import { buildSpeechPrompt } from "@/lib/ai/prompt-builder";
import {
  speechProcessResultSchema,
  storyDecompositionSchema,
  conversationAnalysisSchema,
} from "@/lib/ai/schemas";
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
 * 較重的推理任務（Story 拆解、面試/Mind Map 評分）原本設計要用 Pro 層級模型，
 * 品質比 Flash 好，代價是速度較慢、成本較高。
 *
 * ⚠️ 2026-07-31 暫時停用：實測 gemini-3.1-pro-preview 撞到 429（配額/速率限制）——
 * preview 型號的免費額度通常非常嚴格。在確認實際額度限制或升級付費方案之前，
 * 先讓這個常數指回 Flash，讓面試／Recall／Story 拆解都能正常運作。
 * 之後要換回 Pro，只需要把下面這行改回 "gemini-3.1-pro-preview" 這一個地方，
 * 呼叫端（processSpeech / decomposeStory）完全不用動。
 */
const PRO_MODEL_ID = MODEL_ID;

/**
 * Gemini 官方文件列出的支援音訊格式：wav / mp3 / aiff / aac / ogg / flac。
 * `audio/mp4` 沒有寫在官方清單裡，但 **已在真機（iOS Safari）實測確認可以正常運作**
 * （2026-08-01，收到正常的逐字稿／評分回傳）——iOS Safari 的 MediaRecorder 實際上就是
 * 用這個格式錄音，AAC 編碼本身有支援，只是這個 mimeType 字串沒被官方文件明確列出。
 * 保留這個清單跟警告機制，是為了未來如果遇到「真的」不支援的格式時還能及早發現。
 */
const KNOWN_SUPPORTED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/mp4", // iOS Safari 實測確認可用，見上方說明
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

  async generateGreeting(coachMemory: string): Promise<string> {
    const prompt = `你是 SpeakFlow 的英文口說教練，個性溫暖、有耐心、像朋友一樣自然，不是嚴肅的考官。

${coachMemory}

請用繁體中文寫 1-2 句簡短的開場問候語，語氣輕鬆自然，像久違的朋友打招呼。
可以視情況簡單提到過去的練習（不用每次都提、不用列出所有細節，自然帶過就好），
最後可以用一句話自然地帶到「準備好開始今天的練習了嗎」這種意思，但不要生硬地寫成制式問句。
直接回傳問候語文字本身，不要加任何前綴、標籤或引號。`;

    // 開場問候語是輕量任務，用 Flash 就好，不需要 Pro 層級。
    const response = await this.client.models.generateContent({
      model: MODEL_ID,
      contents: [{ text: prompt }],
    });

    const text = response.text;
    if (!text) {
      throw new Error("GeminiProvider.generateGreeting: model returned an empty response");
    }
    return text.trim();
  }

  async analyzeConversation(transcript: string): Promise<ConversationAnalysis> {
    const prompt = `你是一位英文口說教練。以下是使用者跟 AI 教練進行的一段口語對話逐字稿
（"User" 代表使用者說的話，"Coach" 代表 AI 教練說的話）。

請分析這段對話，找出使用者口說中出現的文法錯誤、用字不自然，或可以講得更道地的地方，
整理成清單。如果對話中使用者的英文已經很好、沒有明顯需要改進的地方，improvementPoints
回傳空陣列即可，不要為了湊數硬找問題。

逐字稿：
「${transcript}」

請回傳：
1. summary：這次對話練習的簡短總結（練習了什麼主題、整體表現如何），1-2 句話
2. improvementPoints：陣列，每項包含：
   - original：使用者原本說的（或不夠自然的）片段
   - suggestion：建議的說法
   - reason：為什麼這樣改比較好`;

    const response = await this.client.models.generateContent({
      model: MODEL_ID,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            improvementPoints: {
              type: Type.ARRAY,
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
          },
          required: ["summary", "improvementPoints"],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("GeminiProvider.analyzeConversation: model returned an empty response");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(
        `GeminiProvider.analyzeConversation: model returned invalid JSON: ${rawText.slice(0, 200)}`,
      );
    }

    const result = conversationAnalysisSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new Error(
        `GeminiProvider.analyzeConversation: response failed schema validation: ${result.error.message}`,
      );
    }

    return result.data;
  }
}
