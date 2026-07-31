"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder, blobToBase64 } from "@/hooks/useAudioRecorder";
import { createLearningSession, endLearningSession } from "@/lib/session/client";
import type { SpeechProcessResult } from "@/lib/ai/types";
import type { RecallContext } from "@/lib/mindmap/types";

export type RecallLevel = 1 | 2 | 3;
export type RecallPhase =
  | "select-level"
  | "ready"
  | "recording"
  | "processing"
  | "feedback"
  | "error";

const DEFAULT_PROVIDER_ID = "gemini-3-flash-preview";
const HINT_INTERVAL_MS = 5000;

/** 依練習層級決定一開始的提示層級（0=只顯示問題，1=第一層節點，2=+關鍵字，3=+完整內容） */
function getInitialHintLevel(level: RecallLevel): number {
  if (level === 1) return 3; // Level 1 是複習模式，一開始就全部顯示
  if (level === 2) return 1; // 第一層節點一開始就看得到
  return 0; // Level 3：一開始只有問題
}

interface StoryContent {
  questionText: string;
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  keywords: string[];
}

interface UseRecallPracticeArgs {
  mindMapId: string;
  story: StoryContent;
}

interface UseRecallPracticeResult {
  phase: RecallPhase;
  level: RecallLevel;
  hintLevel: number;
  elapsedSeconds: number;
  feedback: SpeechProcessResult | null;
  lastAttemptMeta: { recallTimeSeconds: number; hintLevelUsed: number } | null;
  errorMessage: string | null;
  startWithLevel: (level: RecallLevel) => void;
  startRecording: () => Promise<void>;
  stopAndSubmit: () => void;
  retrySameLevel: () => void;
  backToLevelSelect: () => void;
}

export function useRecallPractice({
  mindMapId,
  story,
}: UseRecallPracticeArgs): UseRecallPracticeResult {
  const [phase, setPhase] = useState<RecallPhase>("select-level");
  const [level, setLevel] = useState<RecallLevel>(2);
  const [hintLevel, setHintLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [feedback, setFeedback] = useState<SpeechProcessResult | null>(null);
  const [lastAttemptMeta, setLastAttemptMeta] = useState<{
    recallTimeSeconds: number;
    hintLevelUsed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hintEscalationsRef = useRef(0);
  const readyStartedAtRef = useRef<number | null>(null);
  const recallTimeSecondsRef = useRef(0);
  const turnCountRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  const recorder = useAudioRecorder();

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sessionId = await createLearningSession("recall", DEFAULT_PROVIDER_ID);
    sessionIdRef.current = sessionId;
    return sessionId;
  }, []);

  /** 重置成「準備開始回答」的狀態，selectLevel 跟 retry 都共用這段邏輯 */
  const resetToReady = useCallback((targetLevel: RecallLevel) => {
    const initialHint = getInitialHintLevel(targetLevel);
    setHintLevel(initialHint);
    hintEscalationsRef.current = 0;
    setElapsedSeconds(0);
    readyStartedAtRef.current = Date.now();
    setFeedback(null);
    setErrorMessage(null);
    setPhase("ready");
  }, []);

  const startWithLevel = useCallback(
    (newLevel: RecallLevel) => {
      setLevel(newLevel);
      resetToReady(newLevel);
    },
    [resetToReady],
  );

  // 每秒更新畫面上的計時顯示；每 5 秒（level !== 1 時）漸進式提示
  useEffect(() => {
    if (phase !== "ready" || level === 1) return;

    const interval = setInterval(() => {
      const startedAt = readyStartedAtRef.current;
      if (!startedAt) return;
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(seconds);

      const maxEscalations = 3 - getInitialHintLevel(level);
      const expectedEscalations = Math.min(
        maxEscalations,
        Math.floor((seconds * 1000) / HINT_INTERVAL_MS),
      );
      if (expectedEscalations > hintEscalationsRef.current) {
        hintEscalationsRef.current = expectedEscalations;
        setHintLevel(getInitialHintLevel(level) + expectedEscalations);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, level]);

  const startRecording = useCallback(async () => {
    try {
      await ensureSession();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "無法建立練習紀錄，請確認已登入");
      setPhase("error");
      return;
    }

    const startedAt = readyStartedAtRef.current ?? Date.now();
    recallTimeSecondsRef.current = Math.round((Date.now() - startedAt) / 1000);

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
        const turnIndex = turnCountRef.current;
        turnCountRef.current += 1;

        const audioBase64 = await blobToBase64(blob);

        const recallContext: RecallContext = {
          mindMapId,
          questionText: story.questionText,
          starSituation: story.starSituation,
          starTask: story.starTask,
          starAction: story.starAction,
          starResult: story.starResult,
          keywords: story.keywords,
          level,
          hintLevelUsed: hintEscalationsRef.current,
          recallTimeSeconds: recallTimeSecondsRef.current,
        };

        const res = await fetch("/api/speech-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: DEFAULT_PROVIDER_ID,
            mode: "recall",
            audioBase64,
            audioFormat: mimeType,
            contextTurns: [],
            sessionId,
            turnIndex,
            recallContext,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "AI 處理失敗，請再試一次");
        }

        setLastAttemptMeta({
          recallTimeSeconds: recallTimeSecondsRef.current,
          hintLevelUsed: hintEscalationsRef.current,
        });
        setFeedback(json as SpeechProcessResult);
        setPhase("feedback");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "發生未知錯誤");
        setPhase("error");
      }
    },
    [mindMapId, story, level, ensureSession],
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

  const retrySameLevel = useCallback(() => {
    recorder.reset();
    submittedForBlobRef.current = null;
    resetToReady(level);
  }, [recorder, resetToReady, level]);

  const backToLevelSelect = useCallback(() => {
    recorder.reset();
    submittedForBlobRef.current = null;
    setFeedback(null);
    setErrorMessage(null);
    setPhase("select-level");
  }, [recorder]);

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
  };
}
