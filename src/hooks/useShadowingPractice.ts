"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder, blobToBase64 } from "@/hooks/useAudioRecorder";
import { getRandomSentence, type ShadowingSentence } from "@/lib/shadowing/sentences";
import type { SpeechProcessResult } from "@/lib/ai/types";

export type ShadowingPhase = "ready" | "recording" | "processing" | "feedback" | "error";

/**
 * 目前先固定用 Gemini 2.5 Flash。
 * TODO：接上 Supabase Auth + profiles.preferred_ai_model 後，
 * 這裡要改成讀使用者的設定值，讓雙模型切換真正生效。
 */
const DEFAULT_PROVIDER_ID = "gemini-2.5-flash";

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

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setFeedback(null);
    setPhase("recording");
    await recorder.start();
  }, [recorder]);

  const submitRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase("processing");
      try {
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
    [sentence.text],
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
