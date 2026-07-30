"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useShadowingPractice } from "@/hooks/useShadowingPractice";
import { PronunciationScoreRing } from "@/components/practice/PronunciationScoreRing";
import { GrammarFeedbackList } from "@/components/practice/GrammarFeedbackList";

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "高級",
};

export default function ShadowingPage() {
  const {
    phase,
    sentence,
    feedback,
    errorMessage,
    startRecording,
    stopAndSubmit,
    retrySentence,
    nextSentence,
  } = useShadowingPractice();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          跟讀模式 · {DIFFICULTY_LABEL[sentence.difficulty]}
        </span>
      </header>

      {/* 目標句子 */}
      <section className="mb-10 flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
          請跟著唸出這句話
        </p>
        <motion.p
          key={sentence.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-2xl leading-snug font-medium"
        >
          {sentence.text}
        </motion.p>
      </section>

      {/* 主要互動區：依 phase 顯示不同內容 */}
      <AnimatePresence mode="wait">
        {(phase === "ready" || phase === "recording") && (
          <motion.section
            key="record"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 pb-4"
          >
            <button
              onClick={phase === "ready" ? startRecording : stopAndSubmit}
              className={`flex h-24 w-24 items-center justify-center rounded-full text-sm font-medium text-white shadow-lg transition-transform active:scale-95 ${
                phase === "recording" ? "bg-destructive animate-pulse" : "bg-primary"
              }`}
            >
              {phase === "recording" ? "停止" : "點一下開始"}
            </button>
            <p className="text-muted-foreground text-xs">
              {phase === "recording" ? "錄音中，說完後按停止" : "準備好後點一下開始錄音"}
            </p>
          </motion.section>
        )}

        {phase === "processing" && (
          <motion.section
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 pb-4"
          >
            <div className="border-muted border-t-primary h-10 w-10 animate-spin rounded-full border-4" />
            <p className="text-muted-foreground text-sm">AI 正在分析你的發音…</p>
          </motion.section>
        )}

        {phase === "feedback" && feedback && (
          <motion.section
            key="feedback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4 pb-2"
          >
            <div className="flex justify-center">
              <PronunciationScoreRing score={feedback.pronunciationScore ?? 0} />
            </div>

            <div className="bg-card border-border rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">你說的內容</p>
              <p>{feedback.transcript}</p>
            </div>

            <GrammarFeedbackList items={feedback.grammarFeedback ?? []} />

            {feedback.aiReplyText && (
              <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground mb-1 text-xs">AI 教練回饋</p>
                <p>{feedback.aiReplyText}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={retrySentence}
                className="border-border flex-1 rounded-lg border py-3 text-sm font-medium"
              >
                重錄這句
              </button>
              <button
                onClick={nextSentence}
                className="bg-primary text-primary-foreground flex-1 rounded-lg py-3 text-sm font-medium"
              >
                下一句
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
            className="space-y-3 pb-4"
          >
            <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm">
              <p className="text-destructive font-medium">發生錯誤</p>
              <p className="text-muted-foreground mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={retrySentence}
              className="bg-primary text-primary-foreground w-full rounded-lg py-3 text-sm font-medium"
            >
              重試
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
