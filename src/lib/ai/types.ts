/**
 * AI Provider Pattern — 型別定義
 *
 * 這個檔案定義了所有 AI 供應商（Gemini / OpenAI / 未來的 Claude / Grok / DeepSeek）
 * 都必須遵守的統一介面。ChatService 與 UI 永遠只依賴這個介面，
 * 不會知道、也不需要知道底層實際呼叫的是哪一家 API。
 *
 * 新增供應商時，只需要：
 *  1. 實作 AIProvider 介面
 *  2. 在 provider.factory.ts 註冊
 * 完全不需要修改 ChatService 或任何 UI 元件。
 */

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export type PracticeMode = "shadowing" | "freetalk" | "scenario" | "interview" | "recall";

export interface GrammarFeedbackItem {
  original: string;
  suggestion: string;
  reason: string;
}

/** 呼叫 processSpeech 時的輸入 */
export interface SpeechProcessInput {
  /** base64 編碼的音訊資料 */
  audioBase64: string;
  /** 音訊格式，例如 "audio/webm" */
  audioFormat: string;
  /** 練習模式，會影響 prompt 策略 */
  mode: PracticeMode;
  /** 先前對話輪次，供多輪對話（freetalk / scenario）使用；shadowing 可為空陣列 */
  contextTurns: ChatTurn[];
  /** shadowing 模式下，使用者被要求跟讀的目標句子（可選） */
  targetSentence?: string;
  /** scenario 模式下，AI 扮演角色的設定（可選） */
  scenarioSystemPrompt?: string;
  /**
   * interview 模式下的完整上下文（公司/職位/履歷/難度/面試模式）。
   * 型別定義在 @/lib/interview/types，這裡刻意用 unknown 避免
   * lib/ai 這一層（Provider Pattern 核心）反過來依賴 lib/interview，
   * 保持模組邊界清楚：interview 是「用」ai provider，不是 ai provider 的一部分。
   */
  interviewContext?: import("@/lib/interview/types").InterviewContext;
  /**
   * recall 模式下的完整上下文（問題/STAR/關鍵字/層級/提示使用狀況/回憶花費秒數）。
   * 型別定義在 @/lib/mindmap/types，理由跟 interviewContext 一樣：
   * 保持 lib/ai 不反過來依賴 lib/mindmap。
   */
  recallContext?: import("@/lib/mindmap/types").RecallContext;
}

/**
 * 面試模式專屬的評分維度（對應 V1 產品願景：技術深度／STAR結構／溝通表達／工程思維）。
 * 只有 mode === "interview" 時才會有值。
 * technicalDepth / engineeringThinking 只在技術相關的面試模式才會出現
 * （由 lib/interview/prompt-builder.ts 決定要不要要求 AI 填寫這兩項）。
 */
export interface InterviewEvaluation {
  technicalDepth?: number;
  starStructure: number;
  communication: number;
  engineeringThinking?: number;
}

/**
 * Recall Training 專屬的評分維度。只有 mode === "recall" 時才會有值。
 * 這裡刻意不評「文法對不對」（那是 grammarFeedback 的事），
 * 而是評「回憶提取」本身的品質——這是 Mind Map Recall 功能的核心價值。
 */
export interface RecallEvaluation {
  /** 這次回答涵蓋了故事關鍵內容（STAR + 關鍵字）的完整度，0-100 */
  completeness: number;
  /** 聽起來的自然度／流暢度，反映記憶提取的順暢程度，0-100 */
  confidence: number;
}

/** processSpeech 的統一回傳格式，不論底層是哪個供應商，回傳結構都相同 */
export interface SpeechProcessResult {
  transcript: string;
  pronunciationScore?: number;
  grammarFeedback?: GrammarFeedbackItem[];
  aiReplyText: string;
  /** 僅 interview 模式會填寫 */
  interviewEvaluation?: InterviewEvaluation;
  /** 僅 recall 模式會填寫 */
  recallEvaluation?: RecallEvaluation;
}

/**
 * Story 拆解結果（Mind Map B-1：使用者寫下中文故事，AI 拆成 STAR + 關鍵字 + 英文最佳答案）。
 * 這是純文字輸入輸出，不涉及語音，跟 processSpeech 是完全不同的能力，
 * 但一樣要能在 Gemini/OpenAI 之間切換，所以放進同一個 AIProvider 介面。
 */
export interface StoryDecomposition {
  /** 故事核心內容的英文重寫版本 */
  contentEn: string;
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  keywords: string[];
  /** 適合口說、約 60-90 秒份量的英文最佳答案草稿 */
  bestAnswerEn: string;
}

/**
 * 所有 AI 供應商都必須實作這個介面。
 * 這是整個 Provider Pattern 的核心契約。
 */
export interface AIProvider {
  /** 供應商識別碼，例如 "gemini-3-flash-preview"，會被存進 usage_logs / session_turns */
  readonly id: string;
  /** 顯示於 UI 的名稱，例如 "Gemini 3 Flash（免費⚡）" */
  readonly displayName: string;

  /**
   * 處理一輪語音互動：語音 → 逐字稿 + 評分 + 文法建議 + AI 文字回覆
   * 各供應商內部如何呼叫底層 API（原生音訊輸入 or 其他方式）由該 Provider 自行負責，
   * 呼叫端完全不需要知道實作細節。
   */
  processSpeech(input: SpeechProcessInput): Promise<SpeechProcessResult>;

  /**
   * 文字轉語音，回傳可播放的音檔 URL（或 base64 audio data URI）。
   */
  textToSpeech(text: string): Promise<string>;

  /**
   * 把使用者寫的中文故事拆解成 STAR 結構＋關鍵字＋英文最佳答案。
   * 這是純文字推理任務，供應商內部可能會選用跟 processSpeech 不同的底層模型
   * （例如 Gemini 這邊會用 Pro 層級的模型，而不是 processSpeech 用的 Flash），
   * 但對呼叫端來說完全透明，一樣只是呼叫這個方法。
   */
  decomposeStory(storyTextZh: string): Promise<StoryDecomposition>;
}
