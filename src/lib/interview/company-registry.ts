import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  parseKnowledgeBaseMarkdown,
  getSectionText,
  extractBulletList,
  extractField,
} from "@/lib/interview/knowledge-base-parser";
import type { CompanyMeta, ParsedKnowledgeBase } from "@/lib/interview/types";

/**
 * 公司知識庫的動態註冊表。
 *
 * 新增一間公司（例如 NVIDIA）只需要：
 *   1. 建立 companies/nvidia/knowledge-base.md（照 ASML 那份的標題格式寫）
 *   2. 重新部署
 * 不需要改這個檔案，也不需要改任何其他程式碼或 Prompt。
 *
 * 注意：檔名統一規定為 "knowledge-base.md"（不是沿用你上傳檔案原本的
 * "ASML_INTERVIEW_KNOWLEDGE_BASE.md" 這種各自命名的檔名），
 * 這樣程式才能用同一個固定路徑規則去找每間公司的知識庫，
 * 不需要額外維護一份「公司 → 檔名」的對照表。
 */

const COMPANIES_DIR = path.join(process.cwd(), "companies");
const KNOWLEDGE_BASE_FILENAME = "knowledge-base.md";

export function listCompanyIds(): string[] {
  if (!fs.existsSync(COMPANIES_DIR)) return [];
  return fs
    .readdirSync(COMPANIES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => fs.existsSync(path.join(COMPANIES_DIR, id, KNOWLEDGE_BASE_FILENAME)));
}

// 簡單的記憶體快取，避免同一個 serverless instance 內每次請求都重新讀檔＋解析
const knowledgeBaseCache = new Map<string, ParsedKnowledgeBase>();

export function loadCompanyKnowledgeBase(companyId: string): ParsedKnowledgeBase {
  const cached = knowledgeBaseCache.get(companyId);
  if (cached) return cached;

  const filePath = path.join(COMPANIES_DIR, companyId, KNOWLEDGE_BASE_FILENAME);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `找不到公司 "${companyId}" 的知識庫檔案（預期路徑：${filePath}）。` +
        `請確認 companies/${companyId}/knowledge-base.md 存在。`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = parseKnowledgeBaseMarkdown(raw);
  knowledgeBaseCache.set(companyId, parsed);
  return parsed;
}

export function getCompanyMeta(companyId: string): CompanyMeta {
  const kb = loadCompanyKnowledgeBase(companyId);
  const companyInfo = getSectionText(kb, "Company Information", false);

  return {
    id: companyId,
    displayName: extractField(companyInfo, "Company") ?? companyId,
    industry: extractField(companyInfo, "Industry"),
    supportedPositions: extractBulletList(getSectionText(kb, "Supported Positions", false)),
    supportedInterviewModes: extractBulletList(
      getSectionText(kb, "Supported Interview Modes", false),
    ),
  };
}

export function listAllCompanies(): CompanyMeta[] {
  return listCompanyIds().map((id) => getCompanyMeta(id));
}
