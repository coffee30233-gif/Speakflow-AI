"use client";

import { useMemo } from "react";
import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import { MindMapNodeView } from "@/components/practice/MindMapNodeView";
import type { MindMapNode as StoredNode, MindMapEdge as StoredEdge } from "@/lib/mindmap/types";

const nodeTypes = { mindMapNode: MindMapNodeView };

interface RecallCanvasProps {
  allNodes: StoredNode[];
  allEdges: StoredEdge[];
  /** 目前這個提示層級要顯示哪些節點 id */
  visibleNodeIds: Set<string>;
  /** hintLevel 3：STAR 節點改顯示完整內容，不是只有分類標題 */
  revealFullText: boolean;
}

export function RecallCanvas({
  allNodes,
  allEdges,
  visibleNodeIds,
  revealFullText,
}: RecallCanvasProps) {
  const nodes: Node[] = useMemo(
    () =>
      allNodes
        .filter((n) => visibleNodeIds.has(n.id))
        .map((n) => ({
          id: n.id,
          position: n.position,
          type: "mindMapNode",
          draggable: false,
          selectable: false,
          data: {
            label:
              revealFullText && n.data.kind === "star"
                ? (n.data.fullText ?? n.data.label)
                : n.data.label,
            kind: n.data.kind,
            fullText: n.data.fullText,
          },
        })),
    [allNodes, visibleNodeIds, revealFullText],
  );

  const edges: Edge[] = useMemo(
    () =>
      allEdges
        .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
        .map((e) => ({ id: e.id, source: e.source, target: e.target })),
    [allEdges, visibleNodeIds],
  );

  return (
    <div className="border-border h-[45vh] w-full overflow-hidden rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
