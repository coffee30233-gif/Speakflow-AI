import type { ReactFlowData, MindMapNode, MindMapEdge } from "@/lib/mindmap/types";

/**
 * 從 Story 的 STAR 拆解規則式產生 React Flow 節點圖。
 * 這裡刻意不呼叫 AI——STAR 四個區塊 + 關鍵字已經是結構化資料
 * （由 B-1 的 decomposeStory 產生），純粹是「資料格式轉換」，
 * 用規則轉換更快、更便宜、結果也更可預期。
 *
 * 結構（對應 Recall Training 的三層隱藏機制）：
 *   Level 0（根節點）：問題本身
 *   Level 1：Situation / Task / Action / Result / Keywords 五個節點
 *            —— 這一層對應 Recall Level 2「只顯示第一層節點」
 *   Level 2：Keywords 底下展開成一個個關鍵字節點
 *            —— 對應 Recall Level 1「完整顯示」時才看得到的細節
 */

interface StoryForMindMap {
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  keywords: string[];
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

export function buildMindMapFromStory(
  questionText: string,
  story: StoryForMindMap,
): ReactFlowData {
  const nodes: MindMapNode[] = [];
  const edges: MindMapEdge[] = [];

  // Level 0：根節點
  const rootId = "root";
  nodes.push({
    id: rootId,
    position: { x: 0, y: 0 },
    data: { label: truncate(questionText, 60), kind: "root", fullText: questionText },
  });

  // Level 1：STAR 四個節點 + Keywords 節點，共 5 個，水平排開
  const level1Defs = [
    { id: "star-situation", label: "Situation", fullText: story.starSituation },
    { id: "star-task", label: "Task", fullText: story.starTask },
    { id: "star-action", label: "Action", fullText: story.starAction },
    { id: "star-result", label: "Result", fullText: story.starResult },
    { id: "keywords", label: "Keywords", fullText: undefined },
  ];

  const level1Spacing = 220;
  const level1StartX = -((level1Defs.length - 1) * level1Spacing) / 2;

  level1Defs.forEach((def, index) => {
    const x = level1StartX + index * level1Spacing;
    nodes.push({
      id: def.id,
      position: { x, y: 160 },
      data: {
        label: def.label,
        kind: def.id === "keywords" ? "keywords" : "star",
        fullText: def.fullText,
      },
    });
    edges.push({ id: `${rootId}-${def.id}`, source: rootId, target: def.id });
  });

  // Level 2：Keywords 節點底下展開成個別關鍵字節點
  const keywordsNodeIndex = level1Defs.findIndex((d) => d.id === "keywords");
  const keywordsX = level1StartX + keywordsNodeIndex * level1Spacing;
  const keywordSpacing = 110;
  const keywordStartX = keywordsX - ((story.keywords.length - 1) * keywordSpacing) / 2;

  story.keywords.forEach((keyword, index) => {
    const id = `keyword-${index}`;
    nodes.push({
      id,
      position: { x: keywordStartX + index * keywordSpacing, y: 300 },
      data: { label: truncate(keyword, 20), kind: "keyword", fullText: keyword },
    });
    edges.push({ id: `keywords-${id}`, source: "keywords", target: id });
  });

  return { nodes, edges };
}

/**
 * 依提示層級（0-3）計算哪些節點應該顯示，供 Recall Training 使用。
 * 純粹依節點的 kind 判斷，不依賴 id 命名慣例，比較不容易因為之後改節點 id
 * 產生的方式（例如 B-3 新增關鍵字用時間戳記當 id）而壞掉。
 *
 *   hintLevel 0：只有 root（問題本身）
 *   hintLevel 1：+ star（STAR 四個分類）跟 keywords（分類節點本身，不含個別關鍵字）
 *   hintLevel 2：+ keyword（個別關鍵字節點）
 *   hintLevel 3：節點集合跟 2 一樣，差別在 UI 端要不要把 star 節點換成顯示完整內容
 *                （這個由呼叫端的 revealFullText 處理，不是這裡的職責）
 */
export function computeVisibleNodeIds(
  nodes: { id: string; data: { kind: string } }[],
  hintLevel: number,
): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (n.data.kind === "root") {
      ids.add(n.id);
      continue;
    }
    if (hintLevel >= 1 && (n.data.kind === "star" || n.data.kind === "keywords")) {
      ids.add(n.id);
      continue;
    }
    if (hintLevel >= 2 && n.data.kind === "keyword") {
      ids.add(n.id);
    }
  }
  return ids;
}
