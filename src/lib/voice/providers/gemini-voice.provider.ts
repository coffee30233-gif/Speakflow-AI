import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { VoiceProvider } from "@/lib/voice/types";
import { parsePcmFormat, pcmBase64ToWavDataUri } from "@/lib/audio/pcm-to-wav";

/**
 * TTS 用固定的一個型號跟固定的一個聲音，讓「SpeakFlow 教練」的聲音身份保持一致——
 * 不管使用者選 Gemini 還是之後接了 OpenAI 當文字生成的模型，教練聽起來都應該是同一個人。
 * 聲音選擇（Kore）目前先用官方範例常見的預設聲音，之後想換聲音只要改這個常數。
 */
const TTS_MODEL_ID = "gemini-3.1-flash-tts-preview";
const TTS_VOICE_NAME = "Kore";

export class GeminiVoiceProvider implements VoiceProvider {
  readonly id = "gemini-tts";
  readonly displayName = "SpeakFlow Coach Voice（Gemini TTS）";

  private readonly client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async synthesizeSpeech(text: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: TTS_MODEL_ID,
      contents: [{ text }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: TTS_VOICE_NAME },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const inlineData = part?.inlineData;

    if (!inlineData?.data) {
      throw new Error("GeminiVoiceProvider: model returned no audio data");
    }

    // Gemini TTS 回傳的是裸 PCM（沒有 WAV 檔頭），瀏覽器沒辦法直接播放，
    // 這裡包成標準 WAV 格式再回傳成 data URI，前端 <audio> 元素可以直接用。
    const pcmFormat = parsePcmFormat(inlineData.mimeType);
    return pcmBase64ToWavDataUri(inlineData.data, pcmFormat);
  }
}
