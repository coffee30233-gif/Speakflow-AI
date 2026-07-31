import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Live API（gemini-3.1-flash-live-preview）走的是 WebSocket 長連線，
 * 官方建議的正式做法是「前端直接連線 Gemini」，不要讓我們的 Next.js 後端
 * 當中繼站轉發即時音訊（那樣會多一段延遲，而且 serverless function
 * 本來就不適合長連線）。
 *
 * 但前端不能直接拿真正的 GEMINI_API_KEY（會外洩），所以要先在後端
 * 用真正的 API Key 換一組「短命的臨時 Token」，前端只拿得到這組 Token，
 * 過期時間到就失效，外洩的風險遠比真正的 API Key 低很多。
 *
 * ⚠️ 已知問題：如果 GEMINI_API_KEY 是新格式（"AQ." 開頭），
 * authTokens.create() 目前會回傳 INVALID_ARGUMENT 錯誤；
 * 只有舊格式（"AIzaSy..." 開頭）的 Key 目前能正常運作。
 * 如果這裡報錯，第一件事先檢查 Key 格式是不是新格式的。
 */

const LIVE_MODEL_ID = "models/gemini-3.1-flash-live-preview";

export interface LiveSessionToken {
  token: string;
  model: string;
}

export async function createLiveSessionToken(): Promise<LiveSessionToken> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  // 核發臨時 Token 這個功能目前只在 v1alpha 版本的 API 才有，
  // 跟我們其他 Gemini 呼叫用的預設版本不一樣，所以這裡另外開一個 client 實例。
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });

  const token = await ai.authTokens.create({
    config: {
      uses: 1, // 這個 Token 只能拿來開啟一次連線，用過就作廢
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(), // 1 分鐘內要開始連線
      liveConnectConstraints: {
        model: LIVE_MODEL_ID,
        config: {
          responseModalities: [Modality.AUDIO],
        },
      },
    },
  });

  if (!token.name) {
    throw new Error("createLiveSessionToken: Gemini did not return a token");
  }

  return { token: token.name, model: LIVE_MODEL_ID };
}
