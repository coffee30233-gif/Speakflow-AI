"use client";

import { useEffect, useState } from "react";
import { useAudioRecorder, blobToBase64, detectSupportedMimeType } from "@/hooks/useAudioRecorder";

type TestResult =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; data: unknown }
  | { state: "error"; message: string };

export default function RecorderDebugPage() {
  const { status, errorMessage, recordedMimeType, audioBlob, audioUrl, start, stop, reset } =
    useAudioRecorder();

  const [detectedMimeType, setDetectedMimeType] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null);
  const [userAgent, setUserAgent] = useState<string>("");
  const [testResult, setTestResult] = useState<TestResult>({ state: "idle" });

  useEffect(() => {
    setDetectedMimeType(detectSupportedMimeType());
    setUserAgent(navigator.userAgent);
    // iOS PWA 加入主畫面後啟動會是 standalone 模式，這是判斷使用者是否真的用「PWA」開啟的方式
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  async function handleSendToGemini() {
    if (!audioBlob || !recordedMimeType) return;
    setTestResult({ state: "loading" });
    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const res = await fetch("/api/speech-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "gemini-3-flash-preview",
          mode: "shadowing",
          audioBase64,
          audioFormat: recordedMimeType,
          contextTurns: [],
          targetSentence: "I would like to order a large coffee, please.",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTestResult({ state: "error", message: JSON.stringify(json, null, 2) });
        return;
      }
      setTestResult({ state: "success", data: json });
    } catch (err) {
      setTestResult({
        state: "error",
        message: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">錄音功能實測</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          這是 debug 頁面，用來確認 iOS Safari 錄音格式與 Gemini API 的相容性，正式版不會有這個畫面。
        </p>
      </div>

      {/* 環境資訊 */}
      <section className="bg-card border-border space-y-1 rounded-lg border p-4 text-xs">
        <Row label="偵測到的錄音格式" value={detectedMimeType ?? "（尚未偵測到，此瀏覽器可能不支援）"} />
        <Row
          label="是否為 PWA standalone 模式"
          value={isStandalone === null ? "..." : isStandalone ? "是" : "否（目前用瀏覽器分頁開啟）"}
        />
        <Row label="User Agent" value={userAgent} wrap />
      </section>

      {/* 錄音控制 */}
      <section className="flex flex-col items-center gap-3">
        {status === "idle" || status === "error" ? (
          <button
            onClick={start}
            className="bg-primary text-primary-foreground flex h-20 w-20 items-center justify-center rounded-full text-sm font-medium active:scale-95"
          >
            開始錄音
          </button>
        ) : status === "requesting-permission" ? (
          <div className="text-muted-foreground text-sm">請求麥克風權限中…</div>
        ) : status === "recording" ? (
          <button
            onClick={stop}
            className="bg-destructive text-destructive-foreground flex h-20 w-20 animate-pulse items-center justify-center rounded-full text-sm font-medium active:scale-95"
          >
            停止錄音
          </button>
        ) : null}

        {errorMessage && <p className="text-destructive text-center text-sm">{errorMessage}</p>}
      </section>

      {/* 錄音結果 */}
      {status === "stopped" && audioUrl && (
        <section className="space-y-3">
          <div className="bg-card border-border rounded-lg border p-4 text-xs">
            <Row label="實際錄音 mimeType" value={recordedMimeType ?? "-"} />
            <Row
              label="檔案大小"
              value={audioBlob ? `${(audioBlob.size / 1024).toFixed(1)} KB` : "-"}
            />
          </div>

          <audio controls src={audioUrl} className="w-full" />

          <div className="flex gap-2">
            <button
              onClick={handleSendToGemini}
              disabled={testResult.state === "loading"}
              className="bg-primary text-primary-foreground flex-1 rounded-lg py-3 text-sm font-medium disabled:opacity-50"
            >
              {testResult.state === "loading" ? "傳送中…" : "送到 Gemini 測試"}
            </button>
            <button
              onClick={reset}
              className="border-border flex-1 rounded-lg border py-3 text-sm font-medium"
            >
              重錄
            </button>
          </div>
        </section>
      )}

      {/* API 測試結果 */}
      {testResult.state === "success" && (
        <section className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <p className="mb-2 text-sm font-medium text-green-600">Gemini 回應成功</p>
          <pre className="overflow-x-auto text-xs whitespace-pre-wrap">
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        </section>
      )}
      {testResult.state === "error" && (
        <section className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
          <p className="text-destructive mb-2 text-sm font-medium">呼叫失敗</p>
          <pre className="overflow-x-auto text-xs whitespace-pre-wrap">{testResult.message}</pre>
        </section>
      )}
    </main>
  );
}

function Row({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={wrap ? "text-right break-all" : "text-right"}>{value}</span>
    </div>
  );
}
