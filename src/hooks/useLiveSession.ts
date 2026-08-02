"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { LiveAudioPlayer } from "@/lib/audio/live-audio-player";
import { createLearningSession, endLearningSession } from "@/lib/session/client";
import type { ConversationAnalysis } from "@/lib/ai/types";

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
/** 對話結束後事後分析逐字稿用的 provider（不是即時對話本身用的模型） */
const ANALYSIS_PROVIDER_ID = "gemini-3-flash-preview";

/**
 * 教練模式的 system instruction。重點是「自然糾正」，不是「打斷考試」——
 * 對話節奏不能被破壞，糾正要像真人教練順口帶過，不是逐句判定對錯。
 *
 * 這是 Live API 連線唯一的人格設定，不是可選的開關——方向已經確定
 * （並存架構的「自然對話 / Voice Coach」入口），教練模式就是這個入口的定義，
 * 不需要讓使用者在「一般對話助理」跟「教練」之間切換。
 *
 * 注意：這個糾正是「用語音講出來的建議」，不是結構化 JSON——Live API 的原生語音模型
 * 只能輸出語音，沒辦法像 processSpeech() 那樣同時吐出可以存檔、算分數的評分資料。
 * 這也是為什麼對話結束後還會另外呼叫 analyzeConversation() 做事後文字分析。
 */
const COACH_SYSTEM_PROMPT = `你是一位親切、有耐心的英文口說教練，個性溫暖自然，像朋友一樣對話，不是嚴肅的考官。

在對話過程中，如果聽到使用者的文法錯誤、用字不自然，或發音明顯不對的地方，
請用自然、不打斷對話節奏的方式順口糾正——例如「對了，這裡比較自然的說法會是...」，
糾正完立刻自然地接回對話，不要生硬地停下來說教，也不要每一句話都糾正，
只挑比較重要、值得學的地方講就好，維持對話的流暢感跟輕鬆感。`;

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
  conversationTranscript: { role: "user" | "coach"; text: string }[];
  analysis: ConversationAnalysis | null;
  analyzing: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
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
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [conversationTranscript, setConversationTranscript] = useState<
    { role: "user" | "coach"; text: string }[]
  >([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const learningSessionIdRef = useRef<string | null>(null);
  /** 累積這場對話的逐字稿，斷線時送去做事後分析 */
  const transcriptRef = useRef<{ role: "user" | "coach"; text: string }[]>([]);
  /** 避免 disconnect() 跟 onclose 兩邊都觸發分析，造成重複呼叫 */
  const analysisTriggeredRef = useRef(false);

  const appendLog = useCallback((summary: string) => {
    setMessageLog((prev) => [...prev.slice(-49), { timestamp: Date.now(), summary }]);
  }, []);

  /**
   * Live API 的逐字稿是一段一段串流回來的（每次收到的是新片段，不是完整句子），
   * 如果每段都開一個新的聊天泡泡，畫面會很破碎、很難讀。
   * 這裡改成：同一個角色（使用者／教練）連續講話時，合併進同一個泡泡，
   * 換人講話（角色不同）才開新泡泡——比較接近正常聊天軟體的呈現方式。
   *
   * 假設片段之間是可以直接串接的（API 端已經處理好斷詞的空格），
   * 不會額外補空格；如果之後實測發現文字黏在一起沒有空格，
   * 這裡要改成片段之間補一個空格再串接。
   */
  const appendTranscriptFragment = useCallback((role: "user" | "coach", text: string) => {
    setConversationTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { role, text: last.text + text }];
      }
      return [...prev, { role, text }];
    });

    const lastRef = transcriptRef.current[transcriptRef.current.length - 1];
    if (lastRef && lastRef.role === role) {
      lastRef.text += text;
    } else {
      transcriptRef.current.push({ role, text });
    }
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

  const runAnalysis = useCallback(async () => {
    if (analysisTriggeredRef.current) return;
    analysisTriggeredRef.current = true;

    const sessionId = learningSessionIdRef.current;
    const turns = transcriptRef.current;
    if (!sessionId || turns.length === 0) return;

    const transcriptText = turns
      .map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.text}`)
      .join("\n");

    setAnalyzing(true);
    try {
      const res = await fetch("/api/live/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, transcript: transcriptText }),
      });
      const json = await res.json();
      if (res.ok) {
        setAnalysis(json as ConversationAnalysis);
      } else {
        console.error("[useLiveSession] analyze failed:", json?.error);
      }
    } catch (err) {
      console.error("[useLiveSession] analyze request failed:", err);
    } finally {
      setAnalyzing(false);
      void endLearningSession(sessionId);
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setErrorMessage(null);
    setMessageLog([]);
    setAnalysis(null);
    setConversationTranscript([]);
    transcriptRef.current = [];
    analysisTriggeredRef.current = false;

    try {
      learningSessionIdRef.current = await createLearningSession(
        "live_chat",
        ANALYSIS_PROVIDER_ID,
      );
    } catch (err) {
      console.error("[useLiveSession] failed to create learning session:", err);
      setErrorMessage(err instanceof Error ? err.message : "無法建立練習紀錄，請確認已登入");
      setStatus("error");
      return;
    }

    try {
      const tokenRes = await fetch("/api/live/token", { method: "POST" });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenJson?.error ?? "無法取得連線憑證");
      }

      const ai = new GoogleGenAI({ apiKey: tokenJson.token });
      const systemInstruction = tokenJson.coachMemory
        ? `${COACH_SYSTEM_PROMPT}\n\n${tokenJson.coachMemory}`
        : COACH_SYSTEM_PROMPT;

      const player = new LiveAudioPlayer(OUTPUT_SAMPLE_RATE);
      playerRef.current = player;

      const session = await ai.live.connect({
        model: LIVE_MODEL_ID,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
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

            // 逐字稿訊息：一方面印進 log 方便除錯，一方面累積起來，
            // 斷線後要送去做事後分析（改進點清單）。
            if (content?.inputTranscription?.text) {
              appendLog(`使用者說：${content.inputTranscription.text}`);
              appendTranscriptFragment("user", content.inputTranscription.text);
            }
            if (content?.outputTranscription?.text) {
              appendLog(`AI 說：${content.outputTranscription.text}`);
              appendTranscriptFragment("coach", content.outputTranscription.text);
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
            // 麥克風跟播放器的資源一樣要清掉，不然會一直佔用麥克風，
            // 逐字稿分析也要照樣觸發，不然使用者這場對話的改進點就沒了。
            stopMic();
            playerRef.current?.close();
            playerRef.current = null;
            void runAnalysis();
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
  }, [appendLog, appendTranscriptFragment, startMic, stopMic, runAnalysis]);

  const disconnect = useCallback(async () => {
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
    await runAnalysis();
  }, [stopMic, runAnalysis]);

  return {
    status,
    errorMessage,
    messageLog,
    conversationTranscript,
    analysis,
    analyzing,
    connect,
    disconnect,
  };
}
