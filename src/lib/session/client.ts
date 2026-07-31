"use client";

import type { PracticeMode } from "@/lib/ai/types";

/**
 * 呼叫 POST /api/sessions 建立一筆 learning_sessions 紀錄。
 * 跟讀模式與面試模式的 hook 都共用這個函式，避免兩邊各寫一份重複邏輯。
 */
export async function createLearningSession(
  mode: PracticeMode,
  aiModelUsed: string,
  scenarioId?: string,
): Promise<string> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, aiModelUsed, scenarioId }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? "建立練習紀錄失敗，請先確認已登入");
  }
  return json.sessionId as string;
}

/** 結束一場練習；失敗只記錄 log，不影響使用者體驗（練習內容已經完成了） */
export async function endLearningSession(sessionId: string, overallScore?: number): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overallScore }),
    });
  } catch (err) {
    console.error("[session] failed to end session:", err);
  }
}
