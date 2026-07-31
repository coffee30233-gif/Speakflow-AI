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

export type PracticeMode = "shadowing" | "freetalk" | "scenario" | "interview";

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
}

/** processSpeech 的統一回傳格式，不論底層是哪個供應商，回傳結構都相同 */
export interface SpeechProcessResult {
  transcript: string;
  pronunciationScore?: number;
  grammarFeedback?: GrammarFeedbackItem[];
  aiReplyText: string;
}

/**
 * 所有 AI 供應商都必須實作這個介面。
 * 這是整個 Provider Pattern 的核心契約。
 */
export interface AIProvider {
  /** 供應商識別碼，例如 "gemini-2.5-flash"，會被存進 usage_logs / session_turns */
  readonly id: string;
  /** 顯示於 UI 的名稱，例如 "Gemini 2.5 Flash（免費⚡）" */
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
}
