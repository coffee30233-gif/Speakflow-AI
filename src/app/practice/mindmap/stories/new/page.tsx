import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewStoryForm } from "@/components/practice/NewStoryForm";

export default async function NewStoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/mindmap/stories/new");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/practice/mindmap" className="text-muted-foreground text-sm">
          ← 返回
        </Link>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">寫一篇新故事</h1>
      </div>

      <NewStoryForm />
    </main>
  );
}
