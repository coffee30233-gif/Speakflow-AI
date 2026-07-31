import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 使用者點擊註冊驗證信裡的連結後，會導到這裡。
 *
 * 注意：這個 route 能正常運作的前提是 Supabase Dashboard 的
 * Auth → Email Templates → Confirm signup 範本裡，
 * 要把 {{ .ConfirmationURL }} 改成
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * ——這是 Supabase Dashboard 上的設定，不是程式碼，需要你手動去改一次。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=" + encodeURIComponent("驗證連結無效或已過期，請重新註冊"));
}
