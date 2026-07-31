import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLiveSessionToken } from "@/lib/voice/live-token";

/**
 * POST /api/live/token
 *
 * 前端要開啟 Live API 即時語音連線之前，先呼叫這個端點換一組短命的臨時 Token。
 * 這個端點本身不碰音訊，只負責核發 Token，Token 拿到後前端會直接跟 Gemini
 * 建立 WebSocket 連線，不會再經過我們的後端。
 *
 * 要求登入，避免任何人都能呼叫我們的 GEMINI_API_KEY 額度。
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  try {
    const session = await createLiveSessionToken();
    return NextResponse.json(session);
  } catch (err) {
    console.error("[live/token] failed:", err);
    return NextResponse.json({ error: "無法建立即時語音連線憑證" }, { status: 502 });
  }
}
