"use client";

import { useCallback, useRef, useState } from "react";

/**
 * useAudioRecorder
 *
 * 封裝 MediaRecorder API，並針對 iOS Safari 做格式偵測。
 *
 * 背景：iOS Safari 不支援 Chrome/Firefox 常用的 audio/webm，
 * 實際上只支援 MP4 容器 + AAC 編碼（mimeType 通常是 "audio/mp4"）。
 * 這個 hook 會依序嘗試一組候選 mimeType，選第一個瀏覽器回報支援的，
 * 並把「實際錄出來的 mimeType」回傳給呼叫端 —— 這個值之後要原封不動
 * 送給 Gemini API 的 inlineData.mimeType，格式錯了 Gemini 會直接報錯，
 * 這也是這次要實測的重點。
 */

export type RecorderStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "stopped"
  | "error";

// 依偏好順序列出候選格式；不同瀏覽器會回報支援不同的組合
const CANDIDATE_MIME_TYPES = [
  "audio/mp4", // iOS Safari 實際會用這個（AAC in MP4）
  "audio/mp4;codecs=mp4a.40.2",
  "audio/aac",
  "audio/webm;codecs=opus", // Chrome / Android
  "audio/webm",
  "audio/ogg;codecs=opus",
];

export function detectSupportedMimeType(): string | null {
  if (typeof window === "undefined" || !window.MediaRecorder) return null;
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

interface UseAudioRecorderResult {
  status: RecorderStatus;
  errorMessage: string | null;
  /** 實際錄音使用的 mimeType，錄完才會有值 */
  recordedMimeType: string | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setErrorMessage(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setStatus("requesting-permission");

    const mimeType = detectSupportedMimeType();
    if (!mimeType) {
      setStatus("error");
      setErrorMessage("這個瀏覽器不支援任何已知的錄音格式（MediaRecorder）");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecordedMimeType(mimeType);
        setStatus("stopped");
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };

      recorder.onerror = () => {
        setStatus("error");
        setErrorMessage("錄音過程發生錯誤");
      };

      recorder.start();
      setStatus("recording");
    } catch (err) {
      setStatus("error");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setErrorMessage("麥克風權限被拒絕，請至 iOS 設定開啟權限");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "無法啟動錄音");
      }
    }
  }, []);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordedMimeType(null);
    chunksRef.current = [];
  }, []);

  return { status, errorMessage, recordedMimeType, audioBlob, audioUrl, start, stop, reset };
}

/** 將錄音 Blob 轉成 base64 字串（不含 data URI 前綴），供上傳 API 使用 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result 格式為 "data:audio/mp4;base64,XXXX"，只取逗號後面的部分
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
