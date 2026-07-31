"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface StoryDecompositionResult {
  id: string;
  title: string;
  content_en: string;
  star_situation: string;
  star_task: string;
  star_action: string;
  star_result: string;
  keywords: string[];
  best_answer_en: string;
}

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "result"; story: StoryDecompositionResult }
  | { status: "error"; message: string };

export function NewStoryForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contentZh, setContentZh] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contentZh.trim()) return;

    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, contentZh }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "拆解故事失敗，請再試一次");
      }
      setState({ status: "result", story: json.story });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "發生未知錯誤",
      });
    }
  }

  if (state.status === "result") {
    const { story } = state;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <p className="text-sm font-medium text-green-600">拆解完成 🎉</p>
        </div>

        <Section label="STAR 結構">
          <StarRow label="Situation" text={story.star_situation} />
          <StarRow label="Task" text={story.star_task} />
          <StarRow label="Action" text={story.star_action} />
          <StarRow label="Result" text={story.star_result} />
        </Section>

        <Section label="關鍵字（回憶提示用）">
          <div className="flex flex-wrap gap-1.5">
            {story.keywords.map((kw) => (
              <span
                key={kw}
                className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs"
              >
                {kw}
              </span>
            ))}
          </div>
        </Section>

        <Section label="英文最佳答案草稿">
          <p className="text-sm leading-relaxed">{story.best_answer_en}</p>
        </Section>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setTitle("");
              setContentZh("");
              setState({ status: "idle" });
            }}
            className="border-border flex-1 rounded-lg border py-3 text-sm font-medium"
          >
            再寫一篇
          </button>
          <button
            onClick={() => router.push("/practice/mindmap")}
            className="bg-primary text-primary-foreground flex-1 rounded-lg py-3 text-sm font-medium"
          >
            回到故事庫
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
          故事標題
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：大學專題遇到的技術難題"
          className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
          用中文寫下這個故事
        </label>
        <textarea
          value={contentZh}
          onChange={(e) => setContentZh(e.target.value)}
          rows={8}
          placeholder="不用想英文怎麼講，先用中文把整件事的來龍去脈寫下來就好，AI 會幫你拆解成面試可以用的結構。"
          className="bg-card border-border w-full resize-none rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      {state.status === "error" && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={state.status === "submitting" || !title.trim() || !contentZh.trim()}
        className="bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {state.status === "submitting" ? "AI 拆解中…" : "送出並拆解"}
      </button>

      <Link href="/practice/mindmap" className="text-muted-foreground text-center text-xs">
        取消
      </Link>
    </form>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border-border rounded-lg border p-3">
      <p className="text-muted-foreground mb-2 text-xs">{label}</p>
      {children}
    </div>
  );
}

function StarRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <span className="text-primary text-xs font-semibold">{label}：</span>
      <span className="text-sm">{text}</span>
    </div>
  );
}
