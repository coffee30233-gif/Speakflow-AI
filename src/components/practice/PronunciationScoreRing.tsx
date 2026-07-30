interface PronunciationScoreRingProps {
  score: number; // 0-100
}

/**
 * 圓環評分視覺化。顏色依分數區間變化：
 *   >= 80：綠色（很好）
 *   60-79：琥珀色（尚可，有進步空間）
 *   < 60：紅色（需要多練習）
 */
export function PronunciationScoreRing({ score }: PronunciationScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const colorClass = clamped >= 80 ? "text-green-500" : clamped >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="text-muted stroke-current"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`stroke-current transition-all duration-700 ease-out ${colorClass}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums">{Math.round(clamped)}</span>
        <span className="text-muted-foreground text-[10px]">發音分數</span>
      </div>
    </div>
  );
}
