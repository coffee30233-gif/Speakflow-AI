import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 組出「教練記憶」摘要，餵進 prompt 讓 AI 能自然提到使用者過去的練習
 * （「上次你...」這種話）。刻意用規則式組字串，不另外呼叫 AI 生成摘要——
 * 這只是查資料庫、組句子，不需要為了一段摘要就多花一次 AI API 呼叫。
 */

const MODE_LABEL: Record<string, string> = {
  shadowing: "跟讀練習",
  freetalk: "自由對話",
  scenario: "情境任務",
  interview: "模擬面試",
  recall: "Mind Map Recall 練習",
};

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "今天稍早";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${Math.floor(diffDays / 7)} 週前`;
}

export async function buildCoachMemoryContext(
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data: sessions } = await supabase
    .from("learning_sessions")
    .select("id, mode, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(3);

  if (!sessions || sessions.length === 0) {
    return "這是使用者第一次使用 SpeakFlow 練習，請用溫暖、歡迎的語氣開場，不要假裝知道對方過去的任何練習紀錄。";
  }

  const sessionIds = sessions.map((s) => s.id as string);
  const { data: turns } = await supabase
    .from("session_turns")
    .select("session_id, pronunciation_score")
    .in("session_id", sessionIds);

  const scoresBySession = new Map<string, number[]>();
  for (const t of turns ?? []) {
    if (t.pronunciation_score == null) continue;
    const arr = scoresBySession.get(t.session_id) ?? [];
    arr.push(t.pronunciation_score);
    scoresBySession.set(t.session_id, arr);
  }

  const lines = sessions.map((s) => {
    const scores = scoresBySession.get(s.id as string) ?? [];
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const timeLabel = formatRelativeTime(s.started_at as string);
    const modeLabel = MODE_LABEL[s.mode as string] ?? (s.mode as string);
    return avgScore != null
      ? `- ${timeLabel}：${modeLabel}，平均發音分數 ${avgScore} 分`
      : `- ${timeLabel}：${modeLabel}`;
  });

  return `這是使用者最近的練習紀錄（教練記憶，可以自然地在對話中適度提及，不用每次都提，避免生硬）：\n${lines.join("\n")}`;
}
