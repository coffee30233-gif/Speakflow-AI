"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder, blobToBase64 } from "@/hooks/useAudioRecorder";
import { createLearningSession, endLearningSession } from "@/lib/session/client";
import type { ChatTurn, SpeechProcessResult } from "@/lib/ai/types";
import type { DifficultyLevel } from "@/lib/interview/types";

export type InterviewPhase =
  | "ready"
  | "recording"
  | "processing"
  | "feedback"
  | "error"
  | "finished";

/** 同樣先固定用 Gemini，等 Auth／使用者設定接上後再改成可切換 */
const DEFAULT_PROVIDER_ID = "gemini-3-flash-preview";

interface InterviewBaseContext {
  companyId: string;
  position: string;
  interviewMode: string;
  difficulty: DifficultyLevel;
}

interface UseInterviewPracticeArgs {
  initialQuestion: string;
  context: InterviewBaseContext;
}

interface UseInterviewPracticeResult {
  phase: InterviewPhase;
  /** 目前顯示給使用者、要回答的問題 */
  displayedQuestion: string;
  feedback: SpeechProcessResult | null;
  errorMessage: string | null;
  turnCount: number;
  startRecording: () => Promise<void>;
  stopAndSubmit: () => void;
  continueToNextQuestion: () => void;
  retryCurrentQuestion: () => void;
  finishInterview: () => void;
}

export function useInterviewPractice({
  initialQuestion,
  context,
}: UseInterviewPracticeArgs): UseInterviewPracticeResult {
  const [phase, setPhase] = useState<InterviewPhase>("ready");
  const [displayedQuestion, setDisplayedQuestion] = useState(initialQuestion);
  const [feedback, setFeedback] = useState<SpeechProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  // 對話歷史：不包含「目前正在問的這一題」，那一題是透過 currentQuestion 單獨傳給後端
  const historyRef = useRef<ChatTurn[]>([]);

  // 一場模擬面試對應一個 learning_sessions 資料列，整場面試（多輪問答）共用同一個 session
  const sessionIdRef = useRef<string | null>(null);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sessionId = await createLearningSession("interview", DEFAULT_PROVIDER_ID);
    sessionIdRef.current = sessionId;
    return sessionId;
  }, []);

  const recorder = useAudioRecorder();

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setFeedback(null);

    try {
      await ensureSession();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "無法建立練習紀錄，請確認已登入");
      setPhase("error");
      return;
    }

    setPhase("recording");
    await recorder.start();
  }, [recorder, ensureSession]);

  const stopAndSubmit = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  const submitRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase("processing");
      try {
        const sessionId = await ensureSession();
        const audioBase64 = await blobToBase64(blob);

        // 第一輪要帶 currentQuestion（因為 historyRef 還是空的，AI 不知道剛剛問了什麼）；
        // 之後每一輪的「問題」都已經包含在 aiReplyText 裡、存進 historyRef 了，不用再重複帶。
        const currentQuestion = turnCount === 0 ? initialQuestion : undefined;

        const res = await fetch("/api/speech-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: DEFAULT_PROVIDER_ID,
            mode: "interview",
            audioBase64,
            audioFormat: mimeType,
            contextTurns: historyRef.current,
            sessionId,
            turnIndex: turnCount,
            interviewContext: {
              companyId: context.companyId,
              position: context.position,
              interviewMode: context.interviewMode,
              difficulty: context.difficulty,
              currentQuestion,
            },
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "AI 處理失敗，請再試一次");
        }

        const result = json as SpeechProcessResult;

        historyRef.current = [
          ...historyRef.current,
          { role: "user", text: result.transcript },
          { role: "assistant", text: result.aiReplyText },
        ];

        setFeedback(result);
        setTurnCount((n) => n + 1);
        setPhase("feedback");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "發生未知錯誤");
        setPhase("error");
      }
    },
    [turnCount, initialQuestion, context, ensureSession],
  );

  const submittedForBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (
      recorder.status === "stopped" &&
      recorder.audioBlob &&
      recorder.recordedMimeType &&
      phase === "recording" &&
      submittedForBlobRef.current !== recorder.audioBlob
    ) {
      submittedForBlobRef.current = recorder.audioBlob;
      void submitRecording(recorder.audioBlob, recorder.recordedMimeType);
    }
  }, [recorder.status, recorder.audioBlob, recorder.recordedMimeType, phase, submitRecording]);

  const continueToNextQuestion = useCallback(() => {
    if (feedback) {
      setDisplayedQuestion(feedback.aiReplyText);
    }
    recorder.reset();
    submittedForBlobRef.current = null;
    setFeedback(null);
    setErrorMessage(null);
    setPhase("ready");
  }, [feedback, recorder]);

  const retryCurrentQuestion = useCallback(() => {
    recorder.reset();
    submittedForBlobRef.current = null;
    setErrorMessage(null);
    setPhase("ready");
  }, [recorder]);

  const finishInterview = useCallback(() => {
    if (sessionIdRef.current) {
      void endLearningSession(sessionIdRef.current);
    }
    setPhase("finished");
  }, []);

  // 離開頁面時（例如直接切換路由）也 best-effort 結束 session
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        void endLearningSession(sessionIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
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
  };
}
