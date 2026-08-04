import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompanyMeta } from "@/lib/interview/company-registry";
import { getOpeningQuestion } from "@/lib/interview/opening-question";
import { createClient } from "@/lib/supabase/server";
import { InterviewSessionClient } from "@/components/practice/InterviewSessionClient";
import type { DifficultyLevel } from "@/lib/interview/types";

interface InterviewSessionPageProps {
  searchParams: Promise<{
    company?: string;
    position?: string;
    mode?: string;
    difficulty?: string;
  }>;
}

const VALID_DIFFICULTIES: DifficultyLevel[] = ["easy", "medium", "hard"];

export default async function InterviewSessionPage({ searchParams }: InterviewSessionPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/interview");
  }

  const params = await searchParams;
  const companyId = params.company ?? "";
  const position = params.position ?? "";
  const interviewMode = params.mode ?? "";
  const difficulty = VALID_DIFFICULTIES.includes(params.difficulty as DifficultyLevel)
    ? (params.difficulty as DifficultyLevel)
    : "medium";

  if (!companyId || !position || !interviewMode) {
    return (
      <ErrorScreen message="缺少必要的面試設定（公司／職位／面試模式），請從設定頁重新開始。" />
    );
  }

  let companyMeta;
  try {
    companyMeta = getCompanyMeta(companyId);
  } catch {
    return <ErrorScreen message={`找不到公司「${companyId}」的知識庫資料。`} />;
  }

  if (!companyMeta.supportedPositions.includes(position)) {
    return (
      <ErrorScreen
        message={`「${companyMeta.displayName}」不支援職位「${position}」，請從設定頁重新選擇。`}
      />
    );
  }
  if (!companyMeta.supportedInterviewModes.includes(interviewMode)) {
    return (
      <ErrorScreen
        message={`「${companyMeta.displayName}」不支援面試模式「${interviewMode}」，請從設定頁重新選擇。`}
      />
    );
  }

  const openingQuestion = getOpeningQuestion(companyId);

  return (
    <InterviewSessionClient
      companyDisplayName={companyMeta.displayName}
      position={position}
      interviewMode={interviewMode}
      initialQuestion={openingQuestion}
      context={{ companyId, position, interviewMode, difficulty }}
    />
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-destructive text-sm">{message}</p>
      <Link
        href="/practice/interview"
        className="bg-primary text-primary-foreground rounded-lg px-6 py-3 text-sm font-medium"
      >
        回到設定頁
      </Link>
    </main>
  );
}
