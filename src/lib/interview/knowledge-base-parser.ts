import type { ParsedKnowledgeBase, ParsedSection } from "@/lib/interview/types";

/**
 * 通用的知識庫 Markdown 解析器。
 *
 * 這個檔案完全不知道「ASML」是什麼，只知道 Markdown 標題階層。
 * 只要未來新公司的 .md 檔案遵守跟 ASML 範例一樣的標題慣例
 * （例如用 "# Supported Positions" 這個標題名稱列出職位），
 * 這個 parser 就能正確運作，不需要修改任何程式碼。
 */

const HEADING_REGEX = /^(#{1,2})\s+(.+)$/;
const HORIZONTAL_RULE_REGEX = /^-{3,}$|^\*{3,}$/;

export function parseKnowledgeBaseMarkdown(markdown: string): ParsedKnowledgeBase {
  const lines = markdown.split("\n");
  const sections: ParsedSection[] = [];

  let current: { level: number; heading: string; lines: string[] } | null = null;

  const flush = () => {
    if (current) {
      sections.push({
        level: current.level,
        heading: current.heading,
        content: current.lines.join("\n").trim(),
      });
    }
  };

  for (const line of lines) {
    const headingMatch = HEADING_REGEX.exec(line);
    if (headingMatch) {
      flush();
      current = { level: headingMatch[1]!.length, heading: headingMatch[2]!.trim(), lines: [] };
      continue;
    }
    if (current) {
      // 分隔線（---、***）只是視覺排版用，不算內容，跳過避免混進 prompt
      if (HORIZONTAL_RULE_REGEX.test(line.trim())) continue;
      current.lines.push(line);
    }
  }
  flush();

  return { raw: markdown, sections };
}

/**
 * 依標題名稱取出該段落的文字內容。
 * @param includeSubsections 是否把底下層級更深的子標題也一併包含進來
 *   （例如抓 "Technical Knowledge" 時，順便把底下的 "Optics" / "Measurement" 子標題內容也接進來）
 */
export function getSectionText(
  kb: ParsedKnowledgeBase,
  headingName: string,
  includeSubsections = true,
): string | null {
  const idx = kb.sections.findIndex(
    (s) => s.heading.toLowerCase() === headingName.toLowerCase(),
  );
  if (idx === -1) return null;

  const target = kb.sections[idx]!;
  if (!includeSubsections) return target.content;

  let combined = target.content;
  for (let i = idx + 1; i < kb.sections.length; i++) {
    const s = kb.sections[i]!;
    if (s.level <= target.level) break;
    combined += `\n\n### ${s.heading}\n${s.content}`;
  }
  return combined.trim();
}

/** 把 "- Item" 這種 Markdown 條列文字轉成字串陣列 */
export function extractBulletList(text: string | null): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

/** 從 "**FieldName:** value" 這種格式的文字中取出欄位值 */
export function extractField(text: string | null, fieldName: string): string | null {
  if (!text) return null;
  const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, "i");
  const match = regex.exec(text);
  return match ? match[1]!.trim() : null;
}
