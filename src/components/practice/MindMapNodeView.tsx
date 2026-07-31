import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MindMapNodeKind } from "@/lib/mindmap/types";

/**
 * 依節點種類決定顏色跟大小，四種：
 *   root     — 問題本身，主色系、字最大
 *   star     — STAR 四個區塊（Situation/Task/Action/Result）
 *   keywords — 「Keywords」分類節點
 *   keyword  — 個別關鍵字，最小、藥丸狀
 */
const KIND_STYLES: Record<MindMapNodeKind, string> = {
  root: "bg-primary text-primary-foreground px-4 py-3 rounded-xl font-semibold text-sm shadow-md min-w-[160px] text-center",
  star: "bg-card border-border border px-3 py-2 rounded-lg text-xs min-w-[140px] max-w-[180px]",
  keywords:
    "bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-xs font-medium min-w-[100px] text-center",
  keyword:
    "bg-accent text-accent-foreground px-2.5 py-1 rounded-full text-[11px] max-w-[110px] text-center",
};

export interface MindMapNodeData {
  label: string;
  kind: MindMapNodeKind;
  fullText?: string;
  [key: string]: unknown;
}

export function MindMapNodeView({ data, selected }: NodeProps) {
  const nodeData = data as MindMapNodeData;
  const isRoot = nodeData.kind === "root";

  return (
    <div
      className={`${KIND_STYLES[nodeData.kind]} transition-shadow ${
        selected ? "ring-primary ring-2 ring-offset-2" : ""
      }`}
    >
      {!isRoot && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}
      <div className="line-clamp-3 break-words">{nodeData.label}</div>
      {nodeData.kind !== "keyword" && (
        <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
      )}
    </div>
  );
}
