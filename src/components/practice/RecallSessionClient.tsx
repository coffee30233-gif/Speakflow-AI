"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRecallPractice, type RecallLevel } from "@/hooks/useRecallPractice";
import { RecallCanvas } from "@/components/practice/RecallCanvas";
import { RecallEvaluationBars } from "@/components/practice/RecallEvaluationBars";
import { GrammarFeedbackList } from "@/components/practice/GrammarFeedbackList";
import { computeVisibleNodeIds } from "@/lib/mindmap/build-mindmap";
import type { MindMapNode, MindMapEdge } from "@/lib/mindmap/types";

interface StoryContent {
  questionText: string;
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  keywords: string[];
}

interface RecallSessionClientProps {
  mindMapId: string;
  allNodes: MindMapNode[];
  allEdges: MindMapEdge[];
  story: StoryContent;
}

const LEVEL_OPTIONS: { value: RecallLevel; label: string; description: string }[] = [
  { value: 1, label: "Level 1", description: "完整顯示，複習用" },
  { value: 2, label: "Level 2", description: "只看得到分類，練習回憶細節" },
  { value: 3, label: "Level 3", description: "只看得到問題，完全靠記憶" },
];

export function RecallSessionClient({
  mindMapId,
  allNodes,
  allEdges,
  story,
}: RecallSessionClientProps) {
  const {
    phase,
    level,
    hintLevel,
    elapsedSeconds,
    feedback,
    lastAttemptMeta,
    errorMessage,
    startWithLevel,
    startRecording,
    stopAndSubmit,
    retrySameLevel,
    backToLevelSelect,
  } = useRecallPractice({ mindMapId, story });

  const visibleNodeIds = computeVisibleNodeIds(allNodes, hintLevel);
  const revealFullText = hintLevel >= 3;

  if (phase === "select-level") {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">選一個練習難度：</p>
        {LEVEL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => startWithLevel(opt.value)}
            className="bg-card border-border hover:border-primary w-full rounded-lg border p-3 text-left"
          >
            <p className="text-sm font-medium">{opt.label}</p>
            <p className="text-muted-foreground text-xs">{opt.description}</p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RecallCanvas
        allNodes={allNodes}
        allEdges={allEdges}
        visibleNodeIds={visibleNodeIds}
        revealFullText={revealFullText}
      />

      <AnimatePresence mode="wait">
        {(phase === "ready" || phase === "recording") && (
          <motion.section
            key="record"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            {level !== 1 && phase === "ready" && (
              <p className="text-muted-foreground text-xs">
                已經過 {elapsedSeconds} 秒{hintLevel > 0 ? "，提示已展開" : ""}
              </p>
            )}
            <button
              onClick={phase === "ready" ? startRecording : stopAndSubmit}
              className={`flex h-20 w-20 items-center justify-center rounded-full text-sm font-medium text-white shadow-lg transition-transform active:scale-95 ${
                phase === "recording" ? "bg-destructive animate-pulse" : "bg-primary"
              }`}
            >
              {phase === "recording" ? "停止" : "開始回答"}
            </button>
          </motion.section>
        )}

        {phase === "processing" && (
          <motion.section
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="border-muted border-t-primary h-10 w-10 animate-spin rounded-full border-4" />
            <p className="text-muted-foreground text-sm">教練正在確認你回憶的完整度…</p>
          </motion.section>
        )}

        {phase === "feedback" && feedback && (
          <motion.section
            key="feedback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {feedback.recallEvaluation && (
              <RecallEvaluationBars
                evaluation={feedback.recallEvaluation}
                recallTimeSeconds={lastAttemptMeta?.recallTimeSeconds ?? 0}
                hintLevelUsed={lastAttemptMeta?.hintLevelUsed ?? 0}
              />
            )}

            <div className="bg-card border-border rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">你的回答</p>
              <p>{feedback.transcript}</p>
            </div>

            <GrammarFeedbackList items={feedback.grammarFeedback ?? []} />

            <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">教練回饋</p>
              <p>{feedback.aiReplyText}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={backToLevelSelect}
                className="border-border flex-1 rounded-lg border py-3 text-sm font-medium"
              >
                換個難度
              </button>
              <button
                onClick={retrySameLevel}
                className="bg-primary text-primary-foreground flex-1 rounded-lg py-3 text-sm font-medium"
              >
                再練習一次
              </button>
            </div>
          </motion.section>
        )}

        {phase === "error" && (
          <motion.section
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm">
              <p className="text-destructive font-medium">發生錯誤</p>
              <p className="text-muted-foreground mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={retrySameLevel}
              className="bg-primary text-primary-foreground w-full rounded-lg py-3 text-sm font-medium"
            >
              重試
            </button>
          </motion.section>
        )}
      </AnimatePresence>

      <Link href="/practice/mindmap" className="text-muted-foreground text-center text-xs">
        結束練習，回到故事庫
      </Link>
    </div>
  );
}
