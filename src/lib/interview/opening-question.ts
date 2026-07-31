import "server-only";
import { getSectionText, extractBulletList } from "@/lib/interview/knowledge-base-parser";
import { loadCompanyKnowledgeBase } from "@/lib/interview/company-registry";

/**
 * 面試模式跟其他模式不一樣：使用者不是先開口，而是「面試官先問問題」。
 * 這裡刻意不為了第一題就多打一次 AI API（多花錢、多一次延遲），
 * 而是直接從知識庫的 "Behavioral Interview Topics" 挑第一題當開場白，
 * 這也更貼近真實面試的習慣（幾乎都是從 "Tell me about yourself" 開始）。
 *
 * 這個函式不含任何公司特定內容——挑選邏輯完全基於知識庫的通用段落結構。
 */
export function getOpeningQuestion(companyId: string): string {
  const kb = loadCompanyKnowledgeBase(companyId);
  const topics = extractBulletList(getSectionText(kb, "Behavioral Interview Topics", false));

  if (topics.length > 0) {
    return topics[0]!;
  }

  // 知識庫沒有提供 Behavioral Interview Topics 段落時的保底開場白
  return "Tell me about yourself and why you're interested in this role.";
}

/**
 * 列出該公司知識庫的全部 Behavioral Interview Topics，
 * 供 Mind Map 選題畫面當作「company_kb 來源」的候選清單。
 */
export function listBehavioralQuestions(companyId: string): string[] {
  const kb = loadCompanyKnowledgeBase(companyId);
  return extractBulletList(getSectionText(kb, "Behavioral Interview Topics", false));
}
