/**
 * React Flow 的資料格式（節點 + 邊），跟一般巢狀 JSON 樹不一樣，
 * 存進 mind_maps.react_flow_data 的格式要跟這個一致。
 * 這裡故意只定義我們用得到的最小子集，不依賴 reactflow 套件本身的型別，
 * 讓 build-mindmap.ts 這種純資料轉換邏輯不用把 reactflow 拉進依賴（那是 B-3 畫布 UI 才需要的）。
 */

export type MindMapNodeKind = "root" | "star" | "keywords" | "keyword";

export interface MindMapNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    kind: MindMapNodeKind;
    /** 完整內容，UI 顯示精簡 label，點開才看到全文 */
    fullText?: string;
  };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface ReactFlowData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

/**
 * Recall Training 一輪練習需要的完整上下文，對應 SpeechProcessInput.recallContext。
 * STAR 內容跟關鍵字直接從 mind_maps.react_flow_data 的節點抽出來，
 * 不用另外查 stories 表——mind_map 本身就是「共用知識核心」。
 */
export interface RecallContext {
  mindMapId: string;
  questionText: string;
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  keywords: string[];
  /** 使用者選擇的練習層級：1=完整顯示，2=只顯示第一層，3=只顯示問題 */
  level: 1 | 2 | 3;
  /** 開口前用了幾層提示，0 代表完全沒用提示 */
  hintLevelUsed: number;
  /** 從看到問題到開始錄音，花了幾秒 */
  recallTimeSeconds: number;
}
