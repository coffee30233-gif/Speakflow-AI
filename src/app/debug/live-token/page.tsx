"use client";

import { useState } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; token: string; model: string }
  | { status: "error"; message: string };

export default function LiveTokenDebugPage() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleTest() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/live/token", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      setState({ status: "success", token: json.token, model: json.model });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-5 py-8">
      <div>
        <h1 className="text-xl font-semibold">Live API Token 實測</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          這是 debug 頁面，只測試 /api/live/token 能不能正常核發臨時憑證，
          還沒有真的建立 WebSocket 連線。
        </p>
      </div>

      <button
        onClick={handleTest}
        disabled={state.status === "loading"}
        className="bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {state.status === "loading" ? "請求中…" : "測試核發 Token"}
      </button>

      {state.status === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-xs">
          <p className="font-medium text-green-600">成功 🎉</p>
          <p className="mt-2">Model: {state.model}</p>
          <p className="mt-1 break-all">Token（前 40 字）: {state.token.slice(0, 40)}…</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-xs">
          <p className="text-destructive font-medium">失敗</p>
          <p className="mt-2 whitespace-pre-wrap">{state.message}</p>
          <p className="text-muted-foreground mt-2">
            如果錯誤訊息提到 INVALID_ARGUMENT，先檢查 GEMINI_API_KEY 是不是新格式（AQ. 開頭）——
            目前這種格式的 Key 呼叫 authTokens.create() 已知會失敗。
          </p>
        </div>
      )}
    </main>
  );
}
