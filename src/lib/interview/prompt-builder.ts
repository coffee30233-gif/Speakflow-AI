import "server-only";
import { getSectionText } from "@/lib/interview/knowledge-base-parser";
import { loadCompanyKnowledgeBase, getCompanyMeta } from "@/lib/interview/company-registry";
import type { InterviewContext, DifficultyLevel } from "@/lib/interview/types";
import type { ChatTurn } from "@/lib/ai/types";

/**
 * 依 Interview Mode 決定要從知識庫抽哪些段落塞進 prompt。
 *
 * 重要：這裡出現的段落名稱（"Technical Knowledge"、"STAR Method" 等）
 * 是「知識庫文件格式的共同慣例」，不是針對 ASML 寫死的內容。
 * 只要未來公司的 .md 檔案遵守跟 ASML 範例一樣的標題慣例，這裡完全不用改。
 */
function pickRelevantSectionHeadings(interviewMode: string): string[] {
  const common = [
    "Company Information",
    "Company Culture",
    "Evaluation Criteria",
    "Speaking Rules",
  ];
  const modeLower = interviewMode.toLowerCase();

  if (modeLower.includes("technical")) {
    return [...common, "Technical Knowledge"];
  }
  if (
    modeLower.includes("behavioral") ||
    modeLower.includes("hr") ||
    modeLower.includes("hiring manager")
  ) {
    return [...common, "Behavioral Interview Topics", "STAR Method"];
  }
  if (modeLower.includes("stress")) {
    return [...common, "Behavioral Interview Topics"];
  }
  // 其他/未知模式（例如 "Mock HireVue"）：保守起見給完整背景
  return [...common, "Behavioral Interview Topics", "STAR Method", "Technical Knowledge"];
}

const DIFFICULTY_INSTRUCTION: Record<DifficultyLevel, string> = {
  easy: "提出的問題應該較為基礎，給予候選人更多引導與鼓勵，追問不要太尖銳。",
  medium: "提出中等難度的問題，可以適度追問細節，維持專業但不失友善的語氣。",
  hard: "提出較有挑戰性的深入追問，模擬真實高壓面試情境，對含糊或缺乏細節的回答要進一步追問。",
};

/**
 * 組出面試模式的完整 system prompt。
 *
 * 對應的組合公式：Company + Position + Resume + Knowledge Base + Question + Difficulty + Interview Mode
 * 全部都是「參數」，這個函式本身不包含任何公司特定的文字。
 */
export function buildInterviewPrompt(context: InterviewContext, contextTurns: ChatTurn[]): string {
  const kb = loadCompanyKnowledgeBase(context.companyId);
  const meta = getCompanyMeta(context.companyId);

  const relevantHeadings = pickRelevantSectionHeadings(context.interviewMode);
  const knowledgeBlock = relevantHeadings
    .map((heading) => {
      const text = getSectionText(kb, heading);
      return text ? `## ${heading}\n${text}` : null;
    })
    .filter((block): block is string => block !== null)
    .join("\n\n");

  const resumeBlock = context.resumeText
    ? `\n\n候選人履歷內容：\n${context.resumeText}`
    : "\n\n（候選人尚未提供履歷）";

  const questionBlock = context.currentQuestion
    ? `\n\n這一輪請圍繞這個問題進行：「${context.currentQuestion}」`
    : "";

  const conversationBlock =
    contextTurns.length > 0
      ? `\n\n目前為止的面試對話：\n${contextTurns
          .map((t) => `${t.role === "user" ? "候選人" : "面試官"}：${t.text}`)
          .join("\n")}`
      : "\n\n（這是這場模擬面試的第一個問題）";

  return `你正在為使用者模擬一場「${meta.displayName}」的「${context.interviewMode}」，應徵職位是「${context.position}」。

請你全程扮演這間公司的面試官，語氣與提問方向需符合以下公司文化、技術背景與評分標準：

${knowledgeBlock}

難度設定：${DIFFICULTY_INSTRUCTION[context.difficulty]}${resumeBlock}${questionBlock}${conversationBlock}

請根據使用者剛剛的語音回答，回傳以下結構化資訊：
1. transcript：使用者回答的逐字稿
2. pronunciationScore：發音評分（0-100）
3. grammarFeedback：文法／用字修正建議（陣列，若無錯誤則為空陣列）
4. aiReplyText：以面試官的身份給的簡短回饋，並自然地提出下一個面試問題或追問細節（不要說明你在打分數，維持面試情境的沉浸感）`;
}
