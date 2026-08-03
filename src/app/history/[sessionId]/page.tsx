import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/coach/memory";
import { MODE_LABEL } from "@/lib/session/labels";
import { PronunciationScoreRing } from "@/components/practice/PronunciationScoreRing";
import { GrammarFeedbackList } from "@/components/practice/GrammarFeedbackList";
import { InterviewEvaluationBars } from "@/components/practice/InterviewEvaluationBars";
import { RecallEvaluationBars } from "@/components/practice/RecallEvaluationBars";
import { AudioReplyPlayer } from "@/components/practice/AudioReplyPlayer";

interface TurnRow {
  id: string;
  turn_index: number;
  transcript: string | null;
  pronunciation_score: number | null;
  grammar_feedback: { original: string; suggestion: string; reason: string }[] | null;
  ai_reply_text: string | null;
  ai_reply_audio_url: string | null;
}

interface InterviewEvalRow {
  session_turn_id: string;
  technical_depth: number | null;
  star_structure: number;
  communication: number;
  engineering_thinking: number | null;
}

interface RecallAttemptRow {
  session_turn_id: string;
  level: number;
  recall_time_seconds: number | null;
  completeness_score: number | null;
  confidence_score: number | null;
  hint_level_used: number;
}

interface HistoryDetailPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/history/${sessionId}`);
  }

  const { data: session, error: sessionError } = await supabase
    .from("learning_sessions")
    .select("id, mode, started_at, ended_at, overall_score")
    .eq("id", sessionId)
    .single();

  // RLS 會擋掉不屬於自己的 session，查不到就當作 404 處理，不用另外判斷擁有權
  if (sessionError || !session) {
    notFound();
  }

  const { data: turns } = await supabase
    .from("session_turns")
    .select(
      "id, turn_index, transcript, pronunciation_score, grammar_feedback, ai_reply_text, ai_reply_audio_url",
    )
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true });

  const turnIds = (turns ?? []).map((t) => t.id);

  const [{ data: interviewEvals }, { data: recallAttempts }] = await Promise.all([
    turnIds.length > 0
      ? supabase
          .from("interview_evaluations")
          .select(
            "session_turn_id, technical_depth, star_structure, communication, engineering_thinking",
          )
          .in("session_turn_id", turnIds)
      : Promise.resolve({ data: [] as InterviewEvalRow[] }),
    turnIds.length > 0
      ? supabase
          .from("recall_attempts")
          .select(
            "session_turn_id, level, recall_time_seconds, completeness_score, confidence_score, hint_level_used",
          )
          .in("session_turn_id", turnIds)
      : Promise.resolve({ data: [] as RecallAttemptRow[] }),
  ]);

  const interviewEvalByTurn = new Map((interviewEvals ?? []).map((e) => [e.session_turn_id, e]));
  const recallAttemptByTurn = new Map((recallAttempts ?? []).map((a) => [a.session_turn_id, a]));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/history" className="text-muted-foreground text-sm">
          ← 返回歷史紀錄
        </Link>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {MODE_LABEL[session.mode] ?? session.mode}
        </h1>
        <p className="text-muted-foreground mt-1 text-xs">
          {formatRelativeTime(session.started_at)}
          {session.overall_score != null && ` · 總分 ${Math.round(session.overall_score)}`}
        </p>
      </div>

      {(!turns || turns.length === 0) && (
        <p className="text-muted-foreground text-center text-sm">這次練習沒有留下任何紀錄。</p>
      )}

      <div className="space-y-6">
        {(turns as TurnRow[] | null)?.map((turn) => {
          const interviewEval = interviewEvalByTurn.get(turn.id);
          const recallAttempt = recallAttemptByTurn.get(turn.id);

          return (
            <div key={turn.id} className="border-border space-y-3 border-b pb-6 last:border-0">
              <p className="text-muted-foreground text-xs">第 {turn.turn_index + 1} 輪</p>

              {turn.pronunciation_score != null && (
                <div className="flex justify-center">
                  <PronunciationScoreRing score={turn.pronunciation_score} />
                </div>
              )}

              {interviewEval && (
                <InterviewEvaluationBars
                  evaluation={{
                    technicalDepth: interviewEval.technical_depth ?? undefined,
                    starStructure: interviewEval.star_structure,
                    communication: interviewEval.communication,
                    engineeringThinking: interviewEval.engineering_thinking ?? undefined,
                  }}
                />
              )}

              {recallAttempt && (
                <RecallEvaluationBars
                  evaluation={{
                    completeness: recallAttempt.completeness_score ?? 0,
                    confidence: recallAttempt.confidence_score ?? 0,
                  }}
                  recallTimeSeconds={recallAttempt.recall_time_seconds ?? 0}
                  hintLevelUsed={recallAttempt.hint_level_used}
                />
              )}

              {turn.transcript && (
                <div className="bg-card border-border rounded-lg border p-3 text-sm">
                  <p className="text-muted-foreground mb-1 text-xs">內容</p>
                  <p>{turn.transcript}</p>
                </div>
              )}

              {turn.grammar_feedback && turn.grammar_feedback.length > 0 && (
                <GrammarFeedbackList items={turn.grammar_feedback} />
              )}

              {turn.ai_reply_text && (
                <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
                  <p className="text-muted-foreground mb-1 text-xs">回饋</p>
                  <p>{turn.ai_reply_text}</p>
                  <AudioReplyPlayer audioUrl={turn.ai_reply_audio_url ?? undefined} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
