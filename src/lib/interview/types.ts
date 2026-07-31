/**
 * 面試教練模組的型別定義。
 *
 * 設計原則：這裡的型別完全不出現任何公司名稱（ASML、NVIDIA...）。
 * 公司相關的一切都是「資料」（companies/ 底下的 .md 檔），不是程式碼。
 */

export interface ParsedSection {
  /** 標題階層，1 = "# "，2 = "## " */
  level: number;
  heading: string;
  /** 這個標題底下、下一個「同層級或更高層級」標題之前的內容 */
  content: string;
}

export interface ParsedKnowledgeBase {
  /** 完整原始 markdown，保底用（例如要整份丟給 AI 當背景知識時） */
  raw: string;
  sections: ParsedSection[];
}

/** 從知識庫文件解析出來的公司基本資訊，用於 UI 顯示（公司選擇畫面、職位選擇畫面等） */
export interface CompanyMeta {
  /** 資料夾名稱，同時是系統內部的識別碼，例如 "asml" */
  id: string;
  displayName: string;
  industry: string | null;
  supportedPositions: string[];
  supportedInterviewModes: string[];
}

export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * 面試模式底下，一次 AI 呼叫需要的完整上下文。
 * 對應你要求的組合公式：Company + Position + Resume + Knowledge Base + Question + Difficulty + Interview Mode
 */
export interface InterviewContext {
  companyId: string;
  position: string;
  /** 對應知識庫裡 "Supported Interview Modes" 清單中的其中一項，例如 "Technical Interview" */
  interviewMode: string;
  difficulty: DifficultyLevel;
  /** 履歷內容，履歷上傳功能完成前這裡會是 undefined */
  resumeText?: string;
  /** 這一輪要問／延續的問題，若不指定則由 AI 自行決定下一個問題 */
  currentQuestion?: string;
}
