import "server-only";
import type { SpeechProcessInput } from "@/lib/ai/types";
import { buildInterviewPrompt } from "@/lib/interview/prompt-builder";

/**
 * 依練習模式組出對應的 system instruction。
 * 所有 Provider 共用同一套 prompt 邏輯，確保不同模型的回饋「標準」一致，
 * 使用者切換模型時，體驗規則不會跑掉。
 */
export function buildSpeechPrompt(input: SpeechProcessInput): string {
  const base = `你是一位專業的英文口說教練。請針對使用者的語音輸入，回傳以下結構化資訊：
1. transcript：語音的逐字稿
2. pronunciationScore：發音評分（0-100）
3. grammarFeedback：文法／用字修正建議（陣列，若無錯誤則為空陣列）
4. aiReplyText：以教練口吻給予的簡短回應或延續對話的下一句`;

  switch (input.mode) {
    case "shadowing":
      return `${base}\n\n模式：跟讀練習。使用者被要求跟讀句子：「${
        input.targetSentence ?? ""
      }」，請特別著重比對發音與原句的差異。`;
    case "freetalk":
      return `${base}\n\n模式：自由對話。請延續以下對話脈絡，並在 aiReplyText 中自然地繼續對話：\n${formatContext(
        input.contextTurns,
      )}`;
    case "scenario":
      return `${base}\n\n模式：情境任務。你要扮演的角色設定如下：\n${
        input.scenarioSystemPrompt ?? ""
      }\n\n對話脈絡：\n${formatContext(input.contextTurns)}`;
    case "interview": {
      if (!input.interviewContext) {
        throw new Error("interview 模式必須提供 interviewContext");
      }
      // 面試模式的 prompt 邏輯完全獨立在 lib/interview 底下維護，
      // 這裡只負責「轉發」，不重複組裝邏輯——這是刻意的模組邊界劃分：
      // lib/ai 只管「怎麼跟 AI 溝通」，lib/interview 只管「面試教練這個功能怎麼運作」。
      return buildInterviewPrompt(input.interviewContext, input.contextTurns);
    }
    default:
      return base;
  }
}

function formatContext(turns: SpeechProcessInput["contextTurns"]): string {
  if (turns.length === 0) return "（尚無對話紀錄，這是第一輪）";
  return turns.map((t) => `${t.role === "user" ? "使用者" : "AI"}：${t.text}`).join("\n");
}
