"use client";

import { useState } from "react";
import { useLiveSession } from "@/hooks/useLiveSession";

export default function LiveSessionDebugPage() {
  const { status, errorMessage, messageLog, analysis, analyzing, connect, disconnect } =
    useLiveSession();
  const [coachMode, setCoachMode] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-5 py-8">
      <div>
        <h1 className="text-xl font-semibold">Live API 連線實測</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          測試前端 WebSocket 連線＋麥克風串流擷取＋即時語音播放。
          連線後直接對著手機說話，應該會聽到 AI 用語音回應。
        </p>
      </div>

      <label className="bg-card border-border flex items-center gap-2 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={coachMode}
          onChange={(e) => setCoachMode(e.target.checked)}
          disabled={status === "connecting" || status === "connected"}
        />
        教練模式：對話中自然糾正文法/用字
      </label>

      <div className="bg-card border-border rounded-lg border p-3 text-xs">
        <p>
          狀態：<span className="font-medium">{status}</span>
        </p>
        {errorMessage && <p className="text-destructive mt-1">{errorMessage}</p>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => connect({ coachMode })}
          disabled={status === "connecting" || status === "connected"}
          className="bg-primary text-primary-foreground flex-1 rounded-lg py-3 text-sm font-medium disabled:opacity-50"
        >
          {status === "connecting" ? "連線中…" : "開始連線＋錄音"}
        </button>
        <button
          onClick={disconnect}
          disabled={status !== "connected"}
          className="border-border flex-1 rounded-lg border py-3 text-sm font-medium disabled:opacity-50"
        >
          結束連線
        </button>
      </div>

      <div className="bg-card border-border rounded-lg border p-3">
        <p className="text-muted-foreground mb-2 text-xs">訊息紀錄（最新在下方）</p>
        <div className="max-h-96 space-y-1 overflow-y-auto text-[11px]">
          {messageLog.length === 0 && (
            <p className="text-muted-foreground">（還沒有任何訊息）</p>
          )}
          {messageLog.map((entry, i) => (
            <p key={i} className="break-all">
              <span className="text-muted-foreground">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>{" "}
              {entry.summary}
            </p>
          ))}
        </div>
      </div>

      {analyzing && (
        <div className="bg-card border-border rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">正在分析這次對話的改進點…</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
            <p className="mb-1 text-xs font-medium text-green-600">對話總結</p>
            <p className="text-sm">{analysis.summary}</p>
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs">
              需要改進的地方（{analysis.improvementPoints.length} 項）
            </p>
            {analysis.improvementPoints.length === 0 ? (
              <p className="bg-card border-border rounded-lg border p-3 text-sm">
                這次對話沒有發現明顯需要改進的地方 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {analysis.improvementPoints.map((item, i) => (
                  <div key={i} className="bg-card border-border rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-destructive line-through decoration-2">
                        {item.original}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-green-600">{item.suggestion}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
