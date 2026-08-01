"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLiveSession } from "@/hooks/useLiveSession";
import { GrammarFeedbackList } from "@/components/practice/GrammarFeedbackList";

export function LiveChatSessionClient() {
  const {
    status,
    errorMessage,
    conversationTranscript,
    analysis,
    analyzing,
    connect,
    disconnect,
  } = useLiveSession();

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationTranscript]);

  const isActive = status === "connecting" || status === "connected";

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card border-border rounded-lg border p-3 text-center text-xs">
        {status === "idle" && <span className="text-muted-foreground">準備好後點下方按鈕開始</span>}
        {status === "connecting" && <span className="text-muted-foreground">連線中…</span>}
        {status === "connected" && (
          <span className="text-primary font-medium">● 對話中，直接開口說話就可以</span>
        )}
        {status === "closed" && !analyzing && !analysis && (
          <span className="text-muted-foreground">對話已結束</span>
        )}
        {status === "error" && errorMessage && (
          <span className="text-destructive">{errorMessage}</span>
        )}
      </div>

      {/* 即時對話逐字稿，用聊天氣泡呈現 */}
      {conversationTranscript.length > 0 && (
        <div className="flex flex-col gap-2">
          {conversationTranscript.map((entry, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                entry.role === "user"
                  ? "bg-primary text-primary-foreground self-end"
                  : "bg-card border-border self-start border"
              }`}
            >
              {entry.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* 主要操作按鈕 */}
      <div className="flex flex-col items-center gap-3 py-2">
        <button
          onClick={isActive ? disconnect : connect}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-sm font-medium text-white shadow-lg transition-transform active:scale-95 ${
            status === "connected"
              ? "bg-destructive animate-pulse"
              : status === "connecting"
                ? "bg-muted-foreground"
                : "bg-primary"
          }`}
          disabled={status === "connecting"}
        >
          {status === "connected" ? "結束對話" : status === "connecting" ? "連線中…" : "開始對話"}
        </button>
      </div>

      {analyzing && (
        <div className="bg-card border-border rounded-lg border p-4 text-center text-sm">
          <p className="text-muted-foreground">教練正在整理這次對話的重點…</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
            <p className="mb-1 text-xs font-medium text-green-600">這次聊了什麼</p>
            <p className="text-sm">{analysis.summary}</p>
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs">值得注意的地方</p>
            <GrammarFeedbackList items={analysis.improvementPoints} />
          </div>
        </div>
      )}

      <Link href="/" className="text-muted-foreground text-center text-xs">
        返回首頁
      </Link>
    </div>
  );
}
