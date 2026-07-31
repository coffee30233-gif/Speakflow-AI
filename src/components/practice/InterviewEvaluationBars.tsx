import type { InterviewEvaluation } from "@/lib/ai/types";

interface InterviewEvaluationBarsProps {
  evaluation: InterviewEvaluation;
}

const DIMENSION_LABELS: Record<keyof InterviewEvaluation, string> = {
  technicalDepth: "技術深度",
  starStructure: "STAR 結構",
  communication: "溝通表達",
  engineeringThinking: "工程思維",
};

/** 依分數決定顏色：>=80 綠、60-79 琥珀、<60 紅，跟 PronunciationScoreRing 用同一套規則 */
function barColorClass(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function InterviewEvaluationBars({ evaluation }: InterviewEvaluationBarsProps) {
  const dimensions = (Object.keys(DIMENSION_LABELS) as (keyof InterviewEvaluation)[]).filter(
    (key) => evaluation[key] !== undefined,
  );

  if (dimensions.length === 0) return null;

  return (
    <div className="bg-card border-border space-y-3 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">面試評分維度</p>
      {dimensions.map((key) => {
        const score = evaluation[key]!;
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>{DIMENSION_LABELS[key]}</span>
              <span className="tabular-nums">{Math.round(score)}</span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barColorClass(score)}`}
                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
