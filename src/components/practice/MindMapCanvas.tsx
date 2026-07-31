"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import { MindMapNodeView, type MindMapNodeData } from "@/components/practice/MindMapNodeView";
import type {
  MindMapNode as StoredNode,
  MindMapEdge as StoredEdge,
} from "@/lib/mindmap/types";

const nodeTypes = { mindMapNode: MindMapNodeView };

interface MindMapCanvasProps {
  mindMapId: string;
  initialNodes: StoredNode[];
  initialEdges: StoredEdge[];
}

function toRFNodes(nodes: StoredNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    position: n.position,
    type: "mindMapNode",
    // 問題節點（root）固定不能拖動，避免整棵樹的錨點被誤觸移位
    draggable: n.data.kind !== "root",
    data: {
      label: n.data.label,
      kind: n.data.kind,
      fullText: n.data.fullText ?? n.data.label,
    },
  }));
}

function toRFEdges(edges: StoredEdge[]): Edge[] {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

export function MindMapCanvas({ mindMapId, initialNodes, initialEdges }: MindMapCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(initialEdges));

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedData = selectedNode?.data as MindMapNodeData | undefined;

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    const data = node.data as MindMapNodeData;
    setEditText(data.fullText ?? data.label);
  }, []);

  function applyEditText() {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, label: editText, fullText: editText } }
          : n,
      ),
    );
  }

  function addKeyword() {
    const keywordNodes = nodes.filter((n) => (n.data as MindMapNodeData).kind === "keyword");
    const keywordsRoot = nodes.find((n) => (n.data as MindMapNodeData).kind === "keywords");
    if (!keywordsRoot) return;

    const newId = `keyword-${Date.now()}`;
    const offsetX = keywordNodes.length * 110;

    setNodes((nds) => [
      ...nds,
      {
        id: newId,
        position: { x: keywordsRoot.position.x - 55 + offsetX, y: keywordsRoot.position.y + 140 },
        type: "mindMapNode",
        data: { label: "新關鍵字", kind: "keyword", fullText: "新關鍵字" },
      },
    ]);
    setEdges((eds) => [...eds, { id: `keywords-${newId}`, source: keywordsRoot.id, target: newId }]);
    setSelectedNodeId(newId);
    setEditText("新關鍵字");
  }

  function deleteSelected() {
    if (!selectedNodeId || !selectedData) return;
    // 只開放刪除 keyword 節點，STAR 骨架跟問題節點是結構核心，不讓使用者誤刪
    if (selectedData.kind !== "keyword") return;

    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  async function handleSave() {
    setSaveState("saving");
    try {
      const storedNodes: StoredNode[] = nodes.map((n) => {
        const data = n.data as MindMapNodeData;
        return {
          id: n.id,
          position: n.position,
          data: { label: data.label, kind: data.kind, fullText: data.fullText },
        };
      });
      const storedEdges: StoredEdge[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));

      const res = await fetch(`/api/mindmaps/${mindMapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactFlowData: { nodes: storedNodes, edges: storedEdges } }),
      });
      if (!res.ok) throw new Error("儲存失敗");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border h-[55vh] w-full overflow-hidden rounded-lg border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selectedNode && selectedData && (
        <div className="bg-card border-border space-y-2 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">
            編輯節點
            {selectedData.kind === "keyword" ? "（關鍵字）" : selectedData.kind === "root" ? "（問題，不可編輯）" : ""}
          </p>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            disabled={selectedData.kind === "root"}
            rows={2}
            className="bg-background border-border w-full resize-none rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          />
          <div className="flex gap-2">
            {selectedData.kind !== "root" && (
              <button
                onClick={applyEditText}
                className="bg-primary text-primary-foreground flex-1 rounded-lg py-2 text-xs font-medium"
              >
                更新文字
              </button>
            )}
            {selectedData.kind === "keyword" && (
              <button
                onClick={deleteSelected}
                className="border-destructive/40 text-destructive flex-1 rounded-lg border py-2 text-xs font-medium"
              >
                刪除這個關鍵字
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={addKeyword}
          className="border-border flex-1 rounded-lg border py-2.5 text-sm font-medium"
        >
          + 新增關鍵字
        </button>
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="bg-primary text-primary-foreground flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {saveState === "saving" ? "儲存中…" : saveState === "saved" ? "已儲存 ✓" : "儲存"}
        </button>
      </div>
      {saveState === "error" && <p className="text-destructive text-xs">儲存失敗，請再試一次</p>}
    </div>
  );
}
