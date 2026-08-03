import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/coach/memory";
import { MODE_LABEL } from "@/lib/session/labels";

interface SessionRow {
  id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  overall_score: number | null;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/history");
  }

  const { data: sessions, error } = await supabase
    .from("learning_sessions")
    .select("id, mode, started_at, ended_at, overall_score")
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[history] failed to load sessions:", error);
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);

  // 查每個 session 底下有幾輪對話、平均發音分數多少——跟 buildCoachMemoryContext() 用同一套邏輯，
  // 一次查詢，client 端再依 session_id 分組彙整，避免 N+1（每個 session 各查一次）。
  const { data: turns } =
    sessionIds.length > 0
      ? await supabase
          .from("session_turns")
          .select("session_id, pronunciation_score")
          .in("session_id", sessionIds)
      : { data: [] as { session_id: string; pronunciation_score: number | null }[] };

  const statsBySession = new Map<string, { count: number; scores: number[] }>();
  for (const t of turns ?? []) {
    const stat = statsBySession.get(t.session_id) ?? { count: 0, scores: [] };
    stat.count += 1;
    if (t.pronunciation_score != null) stat.scores.push(t.pronunciation_score);
    statsBySession.set(t.session_id, stat);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          歷史紀錄
        </span>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">練習歷史</h1>
        <p className="text-muted-foreground mt-1 text-sm">回顧每一次練習的內容跟回饋。</p>
      </div>

      {(!sessions || sessions.length === 0) && (
        <p className="text-muted-foreground text-center text-sm">
          還沒有任何練習紀錄，去練習頁面開始第一次練習吧。
        </p>
      )}

      <div className="space-y-2">
        {(sessions as SessionRow[] | null)?.map((session) => {
          const stat = statsBySession.get(session.id);
          const avgScore =
            stat && stat.scores.length > 0
              ? Math.round(stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length)
              : null;

          return (
            <Link
              key={session.id}
              href={`/history/${session.id}`}
              className="bg-card border-border block rounded-lg border p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {MODE_LABEL[session.mode] ?? session.mode}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatRelativeTime(session.started_at)}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
                <span>{stat?.count ?? 0} 輪對話</span>
                {avgScore != null && <span>平均發音 {avgScore} 分</span>}
                {session.overall_score != null && (
                  <span>總分 {Math.round(session.overall_score)}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
