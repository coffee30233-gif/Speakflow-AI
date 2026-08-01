"use client";

import { useEffect, useState } from "react";
import { AudioReplyPlayer } from "@/components/practice/AudioReplyPlayer";

interface CoachGreetingProps {
  onContinue: () => void;
}

type State =
  | { status: "loading" }
  | { status: "ready"; text: string; audioUrl?: string }
  | { status: "error" };

/**
 * Voice Coach 的開場小聊天畫面。載入時打一次 /api/coach/greeting，
 * 拿到問候語文字＋語音就顯示，使用者按「準備好了」才進入正式練習。
 *
 * 容錯設計（兩層）：
 *   1. API 明確回傳錯誤／格式不對 → 顯示保底問候語
 *   2. 請求逾時（8 秒內沒回應，例如語音合成卡住或很慢）→ 用 AbortController 主動中斷，
 *      一樣顯示保底問候語
 * 開場問候是體驗加分項，不應該變成使用者卡住進不了練習的擋路石——
 * 之前的版本只做了第 1 層，沒做第 2 層，導致請求卡住時畫面會永遠停在 loading。
 */
const GREETING_TIMEOUT_MS = 8000;

export function CoachGreeting({ onContinue }: CoachGreetingProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GREETING_TIMEOUT_MS);

    fetch("/api/coach/greeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.text) {
          setState({ status: "ready", text: json.text, audioUrl: json.audioUrl });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => {
        // fetch 被 AbortController 中斷、或請求本身失敗，都算進這裡，
        // 一律降級成保底問候語，不管實際原因是什麼。
        if (!cancelled) setState({ status: "error" });
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const fallbackText = "嗨，很高興見到你！準備好開始今天的練習了嗎？";

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full text-2xl">
        🎙️
      </div>

      {state.status === "loading" ? (
        <p className="text-muted-foreground text-sm">教練準備中…</p>
      ) : (
        <>
          <p className="max-w-xs text-sm leading-relaxed">
            {state.status === "ready" ? state.text : fallbackText}
          </p>
          {state.status === "ready" && <AudioReplyPlayer audioUrl={state.audioUrl} />}
        </>
      )}

      <button
        onClick={onContinue}
        disabled={state.status === "loading"}
        className="bg-primary text-primary-foreground mt-2 rounded-lg px-8 py-3 text-sm font-medium disabled:opacity-50"
      >
        準備好了，開始練習
      </button>
    </div>
  );
}
