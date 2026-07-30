import type { GrammarFeedbackItem } from "@/lib/ai/types";

interface GrammarFeedbackListProps {
  items: GrammarFeedbackItem[];
}

export function GrammarFeedbackList({ items }: GrammarFeedbackListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm">
        <p className="font-medium text-green-600">文法完全正確 🎉</p>
        <p className="text-muted-foreground mt-0.5">這句話的文法跟用字都很自然。</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="bg-card border-border rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-destructive line-through decoration-2">{item.original}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-green-600">{item.suggestion}</span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{item.reason}</p>
        </div>
      ))}
    </div>
  );
}
