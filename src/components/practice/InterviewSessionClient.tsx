"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useInterviewPractice } from "@/hooks/useInterviewPractice";
import { PronunciationScoreRing } from "@/components/practice/PronunciationScoreRing";
import { GrammarFeedbackList } from "@/components/practice/GrammarFeedbackList";
import type { DifficultyLevel } from "@/lib/interview/types";

interface InterviewSessionClientProps {
  companyDisplayName: string;
  position: string;
  interviewMode: string;
  initialQuestion: string;
  context: {
    companyId: string;
    position: string;
    interviewMode: string;
    difficulty: DifficultyLevel;
  };
}

export function InterviewSessionClient({
  companyDisplayName,
  position,
  interviewMode,
  initialQuestion,
  context,
}: InterviewSessionClientProps) {
  const {
    phase,
    displayedQuestion,
    feedback,
    errorMessage,
    turnCount,
    startRecording,
    stopAndSubmit,
    continueToNextQuestion,
    retryCurrentQuestion,
    finishInterview,
  } = useInterviewPractice({ initialQuestion, context });

  if (phase === "finished") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="text-xl font-semibold">面試練習結束</h1>
        <p className="text-muted-foreground text-sm">
          這場模擬面試共回答了 {turnCount} 題。
        </p>
        <p className="text-muted-foreground text-xs">
          （目前結果不會被保存，重新整理頁面就會消失——歷史紀錄功能還在後續開發中）
        </p>
        <Link
          href="/practice/interview"
          className="bg-primary text-primary-foreground mt-2 rounded-lg px-6 py-3 text-sm font-medium"
        >
          再模擬一次
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/practice/interview" className="text-muted-foreground text-sm">
          ← 返回設定
        </Link>
        <button onClick={finishInterview} className="text-destructive text-xs font-medium">
          結束面試
        </button>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5">
        <Badge>{companyDisplayName}</Badge>
        <Badge>{position}</Badge>
        <Badge>{interviewMode}</Badge>
        <Badge>第 {turnCount + 1} 題</Badge>
      </div>

      {/* 面試官的問題 */}
      <section className="mb-8">
        <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">面試官問</p>
        <motion.p
          key={displayedQuestion}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-lg leading-snug font-medium"
        >
          {displayedQuestion}
        </motion.p>
      </section>

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
              {phase === "recording" ? "停止" : "開始回答"}
            </button>
            <p className="text-muted-foreground text-xs">
              {phase === "recording" ? "回答中，說完後按停止" : "準備好後點一下開始回答"}
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
            <p className="text-muted-foreground text-sm">面試官正在評估你的回答…</p>
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
              <p className="text-muted-foreground mb-1 text-xs">你的回答</p>
              <p>{feedback.transcript}</p>
            </div>

            <GrammarFeedbackList items={feedback.grammarFeedback ?? []} />

            <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">面試官回應</p>
              <p>{feedback.aiReplyText}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={retryCurrentQuestion}
                className="border-border flex-1 rounded-lg border py-3 text-sm font-medium"
              >
                重新回答這題
              </button>
              <button
                onClick={continueToNextQuestion}
                className="bg-primary text-primary-foreground flex-1 rounded-lg py-3 text-sm font-medium"
              >
                回答下一題
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
              onClick={retryCurrentQuestion}
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-[11px] font-medium">
      {children}
    </span>
  );
}
