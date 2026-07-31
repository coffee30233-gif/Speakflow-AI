"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BuildMindMapFormProps {
  storyId: string;
  companyId: string;
  companyBehavioralQuestions: string[];
}

type QuestionChoice = { source: "company_kb"; text: string } | { source: "custom"; text: string };

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export function BuildMindMapForm({
  storyId,
  companyId,
  companyBehavioralQuestions,
}: BuildMindMapFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"company_kb" | "custom">("company_kb");
  const [selectedQuestion, setSelectedQuestion] = useState(companyBehavioralQuestions[0] ?? "");
  const [customQuestion, setCustomQuestion] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  const activeQuestionText = mode === "company_kb" ? selectedQuestion : customQuestion;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeQuestionText.trim()) return;

    setState({ status: "submitting" });
    try {
      const choice: QuestionChoice = { source: mode, text: activeQuestionText };
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          questionText: choice.text,
          source: choice.source,
          companyId: choice.source === "company_kb" ? companyId : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "生成 Mind Map 失敗");
      }
      router.push(`/practice/mindmap/view/${json.mindMap.id}`);
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "發生未知錯誤",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("company_kb")}
          className={`flex-1 rounded-lg border py-2.5 text-sm font-medium ${
            mode === "company_kb" ? "bg-primary text-primary-foreground border-primary" : "border-border"
          }`}
        >
          從公司題庫選
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`flex-1 rounded-lg border py-2.5 text-sm font-medium ${
            mode === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-border"
          }`}
        >
          自訂題目
        </button>
      </div>

      {mode === "company_kb" ? (
        <select
          value={selectedQuestion}
          onChange={(e) => setSelectedQuestion(e.target.value)}
          className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        >
          {companyBehavioralQuestions.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          placeholder="輸入你想準備的面試問題"
          className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      )}

      {state.status === "error" && <p className="text-destructive text-sm">{state.message}</p>}

      <button
        type="submit"
        disabled={state.status === "submitting" || !activeQuestionText.trim()}
        className="bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {state.status === "submitting" ? "生成中…" : "生成 Mind Map"}
      </button>
    </form>
  );
}
