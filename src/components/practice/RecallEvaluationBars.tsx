import type { RecallEvaluation } from "@/lib/ai/types";

interface RecallEvaluationBarsProps {
  evaluation: RecallEvaluation;
  recallTimeSeconds: number;
  hintLevelUsed: number;
}

function barColorClass(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function RecallEvaluationBars({
  evaluation,
  recallTimeSeconds,
  hintLevelUsed,
}: RecallEvaluationBarsProps) {
  const rows: { label: string; score: number }[] = [
    { label: "回憶完整度", score: evaluation.completeness },
    { label: "自然度／流暢度", score: evaluation.confidence },
  ];

  return (
    <div className="bg-card border-border space-y-3 rounded-lg border p-4">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>回憶花費時間：{recallTimeSeconds} 秒</span>
        <span>使用提示：{hintLevelUsed} 層</span>
      </div>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>{row.label}</span>
            <span className="tabular-nums">{Math.round(row.score)}</span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${barColorClass(row.score)}`}
              style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
