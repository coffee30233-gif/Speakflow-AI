"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyMeta, DifficultyLevel } from "@/lib/interview/types";

interface InterviewSetupFormProps {
  companies: CompanyMeta[];
}

const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string }[] = [
  { value: "easy", label: "簡單" },
  { value: "medium", label: "中等" },
  { value: "hard", label: "困難" },
];

export function InterviewSetupForm({ companies }: InterviewSetupFormProps) {
  const router = useRouter();

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId) ?? companies[0]!,
    [companies, companyId],
  );

  const [position, setPosition] = useState(selectedCompany.supportedPositions[0] ?? "");
  const [interviewMode, setInterviewMode] = useState(
    selectedCompany.supportedInterviewModes[0] ?? "",
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");

  function handleCompanyChange(newCompanyId: string) {
    setCompanyId(newCompanyId);
    const company = companies.find((c) => c.id === newCompanyId);
    setPosition(company?.supportedPositions[0] ?? "");
    setInterviewMode(company?.supportedInterviewModes[0] ?? "");
  }

  function handleStart() {
    const params = new URLSearchParams({
      company: companyId,
      position,
      mode: interviewMode,
      difficulty,
    });
    router.push(`/practice/interview/session?${params.toString()}`);
  }

  const canStart = companyId && position && interviewMode;

  return (
    <div className="flex flex-col gap-5">
      <Field label="公司">
        <select
          value={companyId}
          onChange={(e) => handleCompanyChange(e.target.value)}
          className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
              {c.industry ? `（${c.industry}）` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="職位">
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        >
          {selectedCompany.supportedPositions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="面試模式">
        <select
          value={interviewMode}
          onChange={(e) => setInterviewMode(e.target.value)}
          className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
        >
          {selectedCompany.supportedInterviewModes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>

      <Field label="難度">
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDifficulty(opt.value)}
              className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                difficulty === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <button
        onClick={handleStart}
        disabled={!canStart}
        className="bg-primary text-primary-foreground mt-3 rounded-lg py-3.5 text-sm font-medium disabled:opacity-50"
      >
        開始模擬面試
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium tracking-wide uppercase text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
