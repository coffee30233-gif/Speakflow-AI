/**
 * Voice Provider Pattern — 跟 AIProvider 是平行、獨立的抽象層。
 *
 * 為什麼要獨立出來（不是塞進 AIProvider）：
 * 「教練的聲音身份」應該跟「文字生成用哪個模型」脫鉤——使用者切換 Gemini／GPT-5.5
 * 只是換了「大腦」在想什麼、怎麼評分，「聲音」應該永遠是同一個，
 * 使用者才會覺得是同一個教練，不是每次講話都換了一個人。
 *
 * 新增語音供應商（例如之後想換 ElevenLabs）時，只需要：
 *  1. 實作 VoiceProvider 介面
 *  2. 在 voice.factory.ts 換掉回傳的實例
 * 完全不需要修改 ChatService 或任何 AIProvider 實作。
 */
export interface VoiceProvider {
  readonly id: string;
  readonly displayName: string;

  /**
   * 把文字合成語音，回傳可播放的音檔（data URI 或音檔 URL）。
   */
  synthesizeSpeech(text: string): Promise<string>;
}
