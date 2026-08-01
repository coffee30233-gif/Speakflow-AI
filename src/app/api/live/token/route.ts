import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLiveSessionToken } from "@/lib/voice/live-token";
import { buildCoachMemoryContext } from "@/lib/coach/memory";

/**
 * POST /api/live/token
 *
 * 前端要開啟 Live API 即時語音連線之前，先呼叫這個端點換一組短命的臨時 Token。
 * 這個端點本身不碰音訊，只負責核發 Token，Token 拿到後前端會直接跟 Gemini
 * 建立 WebSocket 連線，不會再經過我們的後端。
 *
 * 順便把教練記憶摘要一起回傳——讓 Live API 的 system instruction 也能自然提到
 * 過去的練習紀錄，跟其他模式（面試/Recall）用的是同一套 buildCoachMemoryContext()，
 * 不需要為 Live API 另外寫一套記憶邏輯。
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
    const coachMemory = await buildCoachMemoryContext(user.id, supabase);
    return NextResponse.json({ ...session, coachMemory });
  } catch (err) {
    console.error("[live/token] failed:", err);
    return NextResponse.json({ error: "無法建立即時語音連線憑證" }, { status: 502 });
  }
}
