"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { LiveAudioPlayer } from "@/lib/audio/live-audio-player";

/**
 * Live API 前端連線 Hook。
 *
 * 這一步的範圍：建立 WebSocket 連線 + 麥克風連續串流擷取 + 送出音訊 +
 * 即時播放 Gemini 回傳的串流語音 + 處理使用者打斷。
 * 還沒做：整合進實際練習流程（面試／Recall）——那是下一步，
 * 這裡先確保完整的雙向即時語音對話這個地基是通的。
 *
 * @google/genai SDK 在瀏覽器直接用 ai.live.connect() 已經實測確認可以正常運作
 * （2026-08-01 真機測試成功，收到正確的 inputTranscription 跟串流音訊回覆）。
 */

const LIVE_MODEL_ID = "gemini-3.1-flash-live-preview";
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

/**
 * 教練模式的 system instruction。重點是「自然糾正」，不是「打斷考試」——
 * 對話節奏不能被破壞，糾正要像真人教練順口帶過，不是逐句判定對錯。
 *
 * 注意：這個糾正是「用語音講出來的建議」，不是結構化 JSON——Live API 的原生語音模型
 * 只能輸出語音，沒辦法像 processSpeech() 那樣同時吐出可以存檔、算分數的評分資料。
 * 這是 Live API 跟現有跟讀/面試/Recall 評分流程本質上的差異，不是這次要解決的問題。
 */
const COACH_SYSTEM_PROMPT = `你是一位親切、有耐心的英文口說教練，個性溫暖自然，像朋友一樣對話，不是嚴肅的考官。

在對話過程中，如果聽到使用者的文法錯誤、用字不自然，或發音明顯不對的地方，
請用自然、不打斷對話節奏的方式順口糾正——例如「對了，這裡比較自然的說法會是...」，
糾正完立刻自然地接回對話，不要生硬地停下來說教，也不要每一句話都糾正，
只挑比較重要、值得學的地方講就好，維持對話的流暢感跟輕鬆感。`;

interface ConnectOptions {
  /** 開啟後，AI 會在對話中自然糾正文法/用字，不開啟就是一般對話助理 */
  coachMode?: boolean;
}

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

/** Live API 訊息裡我們會用到的欄位（其餘欄位不影響功能，用 unknown 帶過即可） */
interface LiveServerMessage {
  serverContent?: {
    modelTurn?: {
      parts?: { inlineData?: { mimeType?: string; data?: string } }[];
    };
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
  };
}

interface UseLiveSessionResult {
  status: LiveSessionStatus;
  errorMessage: string | null;
  messageLog: LiveMessageLogEntry[];
  connect: (options?: ConnectOptions) => Promise<void>;
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
  const playerRef = useRef<LiveAudioPlayer | null>(null);

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

  const connect = useCallback(async (options?: ConnectOptions) => {
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

      const player = new LiveAudioPlayer(OUTPUT_SAMPLE_RATE);
      playerRef.current = player;

      const session = await ai.live.connect({
        model: LIVE_MODEL_ID,
        config: {
          responseModalities: [Modality.AUDIO],
          ...(options?.coachMode ? { systemInstruction: COACH_SYSTEM_PROMPT } : {}),
        },
        callbacks: {
          onopen: () => {
            appendLog("連線已建立（onopen）");
            setStatus("connected");
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;

            // 使用者打斷 AI 說話：把還在播放的音訊全部停掉，避免新舊回覆疊在一起
            if (content?.interrupted) {
              appendLog("使用者打斷了 AI 的回覆，停止播放");
              player.interrupt();
              return;
            }

            // 逐字稿訊息（方便除錯時確認音訊有沒有被正確辨識，不是必要功能）
            if (content?.inputTranscription?.text) {
              appendLog(`使用者說：${content.inputTranscription.text}`);
            }
            if (content?.outputTranscription?.text) {
              appendLog(`AI 說：${content.outputTranscription.text}`);
            }

            // 收到串流音訊，排進播放佇列
            const parts = content?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                void player.enqueueChunk(part.inlineData.data);
              }
            }

            if (content?.turnComplete) {
              appendLog("這一輪對話結束（turnComplete）");
            }
          },
          onerror: (e: { message?: string }) => {
            appendLog(`連線錯誤：${e?.message ?? "unknown"}`);
            setErrorMessage(e?.message ?? "連線發生錯誤");
            setStatus("error");
          },
          onclose: (e: { reason?: string }) => {
            appendLog(`連線關閉：${e?.reason ?? ""}`);
            setStatus("closed");
            // 這裡的關閉可能是 Gemini 那邊主動斷線（不是使用者按了「結束連線」），
            // 麥克風跟播放器的資源一樣要清掉，不然會一直佔用麥克風。
            stopMic();
            playerRef.current?.close();
            playerRef.current = null;
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
  }, [appendLog, startMic, stopMic]);

  const disconnect = useCallback(() => {
    stopMic();
    playerRef.current?.close();
    playerRef.current = null;
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
