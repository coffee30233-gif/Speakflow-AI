"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder, blobToBase64 } from "@/hooks/useAudioRecorder";
import { getRandomSentence, type ShadowingSentence } from "@/lib/shadowing/sentences";
import { createLearningSession, endLearningSession } from "@/lib/session/client";
import type { SpeechProcessResult } from "@/lib/ai/types";

export type ShadowingPhase = "ready" | "recording" | "processing" | "feedback" | "error";

/**
 * 目前先固定用 Gemini 2.5 Flash。
 * TODO：接上 profiles.preferred_ai_model 後，這裡要改成讀使用者的設定值，
 * 讓雙模型切換真正生效。
 */
const DEFAULT_PROVIDER_ID = "gemini-3-flash-preview";

interface UseShadowingPracticeResult {
  phase: ShadowingPhase;
  sentence: ShadowingSentence;
  feedback: SpeechProcessResult | null;
  errorMessage: string | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopAndSubmit: () => void;
  retrySentence: () => void;
  nextSentence: () => void;
}

export function useShadowingPractice(): UseShadowingPracticeResult {
  const [sentence, setSentence] = useState<ShadowingSentence>(() => getRandomSentence());
  const [phase, setPhase] = useState<ShadowingPhase>("ready");
  const [feedback, setFeedback] = useState<SpeechProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorder = useAudioRecorder();

  // 一次「跟讀練習」對應一個 learning_sessions 資料列，session 建立後整段練習都沿用同一個，
  // 每一句（含重錄）都是這個 session 底下的一個 turn。
  const sessionIdRef = useRef<string | null>(null);
  const turnIndexRef = useRef(0);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sessionId = await createLearningSession("shadowing", DEFAULT_PROVIDER_ID);
    sessionIdRef.current = sessionId;
    return sessionId;
  }, []);

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

  const submitRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase("processing");
      try {
        const sessionId = await ensureSession();
        const turnIndex = turnIndexRef.current;
        turnIndexRef.current += 1;

        const audioBase64 = await blobToBase64(blob);
        const res = await fetch("/api/speech-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: DEFAULT_PROVIDER_ID,
            mode: "shadowing",
            audioBase64,
            audioFormat: mimeType,
            contextTurns: [],
            targetSentence: sentence.text,
            sessionId,
            turnIndex,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? "AI 處理失敗，請再試一次");
        }

        setFeedback(json as SpeechProcessResult);
        setPhase("feedback");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "發生未知錯誤");
        setPhase("error");
      }
    },
    [sentence.text, ensureSession],
  );

  const stopAndSubmit = useCallback(() => {
    // MediaRecorder.stop() 是非同步的，實際的 blob 會在下面的 onstop callback
    // （反映在 recorder.status 變成 "stopped"）才拿得到，
    // 真正送出 API 的邏輯在下面的 useEffect 裡處理。
    recorder.stop();
  }, [recorder]);

  const submittedForBlobRef = useRef<Blob | null>(null);

  // 錄音一旦停止（recorder.status 變成 "stopped"），且我們正處於「錄音中→等待送出」的狀態，
  // 就自動送出。用 ref 記錄「這個 blob 是否已經送過」，避免 React Strict Mode 下
  // effect 重複執行造成同一段錄音被送出兩次。
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

  const retrySentence = useCallback(() => {
    recorder.reset();
    submittedForBlobRef.current = null;
    setFeedback(null);
    setErrorMessage(null);
    setPhase("ready");
  }, [recorder]);

  const nextSentence = useCallback(() => {
    recorder.reset();
    submittedForBlobRef.current = null;
    setFeedback(null);
    setErrorMessage(null);
    setSentence((prev) => getRandomSentence(prev.id));
    setPhase("ready");
  }, [recorder]);

  // 離開頁面時，把目前的練習 session 標記為結束（best-effort，不阻塞 UI）
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
    sentence,
    feedback,
    errorMessage,
    audioUrl: recorder.audioUrl,
    startRecording,
    stopAndSubmit,
    retrySentence,
    nextSentence,
  };
}
