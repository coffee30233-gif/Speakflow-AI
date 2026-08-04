"use client";

import { useState } from "react";

interface ResumeFormProps {
  initialResumeText: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ResumeForm({ initialResumeText }: ResumeFormProps) {
  const [resumeText, setResumeText] = useState(initialResumeText);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function handleSave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/profile/resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      if (!res.ok) throw new Error("儲存失敗");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        rows={16}
        maxLength={8000}
        placeholder={`貼上你的履歷內容，中英文都可以。\n\n例如：\n- 學歷、工作經歷\n- 專案經驗、使用過的技術/工具\n- 職稱、負責的職責範圍\n\n面試模式會參考這些內容，問更貼近你真實背景的問題。`}
        className="bg-card border-border w-full resize-none rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
      />

      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{resumeText.length} / 8000 字</span>
        {saveState === "saved" && <span className="text-green-600">已儲存 ✓</span>}
        {saveState === "error" && <span className="text-destructive">儲存失敗，請再試一次</span>}
      </div>

      <button
        onClick={handleSave}
        disabled={saveState === "saving"}
        className="bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {saveState === "saving" ? "儲存中…" : "儲存履歷"}
      </button>
    </div>
  );
}
