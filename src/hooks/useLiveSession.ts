"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Live API 前端連線 Hook。
 *
 * 這一步的範圍：建立 WebSocket 連線 + 麥克風連續串流擷取 + 送出音訊。
 * 還沒做：播放 Gemini 回傳的串流音訊、處理使用者打斷、整合進練習流程——
 * 那些是下一步的範圍，這裡先確保「連線＋送音訊」這個地基是通的。
 *
 * ⚠️ 這裡直接在瀏覽器用 @google/genai SDK 呼叫 ai.live.connect()，
 * 是照 Google 官方文件的建議寫法（apiKey 帶臨時 Token），但這個 SDK
 * 主要是為 Node.js 設計的，能不能在瀏覽器的 bundle 環境正常運作、
 * 沒有踩到某些 Node-only 的內部依賴，這件事需要實測才能確認。
 * 如果打包或執行時出現奇怪的錯誤，備案是改用不依賴 SDK 的原生 WebSocket 實作
 * （Google 官方也有另一份範例是這樣做的）。
 */

const LIVE_MODEL_ID = "gemini-3.1-flash-live-preview";
const INPUT_SAMPLE_RATE = 16000;

export type LiveSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "closed";

interface LiveMessageLogEntry {
  timestamp: number;
  summary: string;
}

interface UseLiveSessionResult {
  status: LiveSessionStatus;
  errorMessage: string | null;
  messageLog: LiveMessageLogEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function useLiveSession(): UseLiveSessionResult {
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageLog, setMessageLog] = useState<LiveMessageLogEntry[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const appendLog = useCallback((summary: string) => {
    setMessageLog((prev) => [...prev.slice(-49), { timestamp: Date.now(), summary }]);
  }, []);

  const stopMic = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const startMic = useCallback(async () => {
    const audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    audioContextRef.current = audioContext;

    await audioContext.audioWorklet.addModule("/worklets/pcm-recorder-processor.js");

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: INPUT_SAMPLE_RATE },
    });
    micStreamRef.current = micStream;

    const source = audioContext.createMediaStreamSource(micStream);
    const workletNode = new AudioWorkletNode(audioContext, "pcm-recorder-processor");
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const session = sessionRef.current;
      if (!session) return;
      const base64Audio = arrayBufferToBase64(event.data);
      try {
        session.sendRealtimeInput({
          audio: { data: base64Audio, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
        });
      } catch (err) {
        console.error("[useLiveSession] failed to send audio chunk:", err);
      }
    };

    source.connect(workletNode);
    // 這裡不需要把 workletNode 接到 audioContext.destination，
    // 我們只是要擷取音訊送出去，不需要在本機播放使用者自己講的話。
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setErrorMessage(null);
    setMessageLog([]);

    try {
      const tokenRes = await fetch("/api/live/token", { method: "POST" });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenJson?.error ?? "無法取得連線憑證");
      }

      const ai = new GoogleGenAI({ apiKey: tokenJson.token });

      const session = await ai.live.connect({
        model: LIVE_MODEL_ID,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {
            appendLog("連線已建立（onopen）");
            setStatus("connected");
          },
          onmessage: (message: unknown) => {
            appendLog(`收到訊息：${JSON.stringify(message).slice(0, 120)}`);
          },
          onerror: (e: { message?: string }) => {
            appendLog(`連線錯誤：${e?.message ?? "unknown"}`);
            setErrorMessage(e?.message ?? "連線發生錯誤");
            setStatus("error");
          },
          onclose: (e: { reason?: string }) => {
            appendLog(`連線關閉：${e?.reason ?? ""}`);
            setStatus("closed");
          },
        },
      });

      sessionRef.current = session;
      await startMic();
    } catch (err) {
      console.error("[useLiveSession] connect failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "連線失敗");
      setStatus("error");
    }
  }, [appendLog, startMic]);

  const disconnect = useCallback(() => {
    stopMic();
    try {
      sessionRef.current?.close();
    } catch (err) {
      console.error("[useLiveSession] error closing session:", err);
    }
    sessionRef.current = null;
    setStatus("closed");
  }, [stopMic]);

  return { status, errorMessage, messageLog, connect, disconnect };
}
