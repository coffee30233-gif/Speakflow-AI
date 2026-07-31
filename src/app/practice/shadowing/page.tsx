import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShadowingPracticeClient } from "@/components/practice/ShadowingPracticeClient";

/**
 * Server Component：先確認登入狀態（跟讀結果現在會寫進資料庫，需要 user_id），
 * 沒登入就導去 /login，並帶上 next 參數，登入成功後可以導回這裡。
 */
export default async function ShadowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/practice/shadowing");
  }

  return <ShadowingPracticeClient />;
}
