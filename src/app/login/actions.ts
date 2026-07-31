"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 登入。照 Supabase 官方文件建議的做法：在 Server Action 裡直接呼叫
 * supabase.auth.signInWithPassword()，成功後 revalidate 整個 layout
 * （因為 Header／首頁需要重新讀取登入狀態）再導頁。
 *
 * 錯誤處理用 query string 帶回 /login 頁面顯示，避免另外引入
 * client-side 狀態管理只為了顯示一個錯誤訊息。
 */
export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next") as string | null;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  // 只接受站內相對路徑（以 "/" 開頭），避免被拿來做開放式轉址（open redirect）
  redirect(next && next.startsWith("/") ? next : "/");
}

/**
 * 註冊。display_name 會透過 options.data 存進 auth.users.raw_user_meta_data，
 * 對應 Supabase migration 裡 handle_new_user() trigger 會讀取的欄位，
 * 註冊成功後 profiles 資料列會自動建立，不需要額外呼叫任何 API。
 *
 * 預設 Supabase 專案會開啟 Email 驗證，所以這裡不會直接登入，
 * 而是導去 /login 顯示「請收信驗證」的訊息。
 */
export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=check-email");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
