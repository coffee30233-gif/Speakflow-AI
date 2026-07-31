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
 * 失敗時不擋住使用者——直接顯示一個保底的靜態問候語跟繼續按鈕，
 * 開場問候是體驗加分項，不應該變成練習的擋路石。
 */
export function CoachGreeting({ onContinue }: CoachGreetingProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach/greeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
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
