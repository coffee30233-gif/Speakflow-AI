import "server-only";

/**
 * Gemini TTS 回傳的是「裸」PCM 音訊資料（沒有檔頭），
 * 瀏覽器的 <audio> 元素沒辦法直接播放裸 PCM，需要自己包一層標準的 WAV 檔頭
 * （44 bytes，這是 WAV 格式的固定結構，不是我發明的）。
 */

interface PcmFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

const DEFAULT_PCM_FORMAT: PcmFormat = {
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
};

/**
 * Gemini 回傳的 mimeType 格式類似 "audio/L16;codec=pcm;rate=24000"，
 * 這裡嘗試從裡面解析出實際的 sample rate，解析失敗就用官方文件記載的預設值（24kHz）。
 */
export function parsePcmFormat(mimeType: string | undefined): PcmFormat {
  if (!mimeType) return DEFAULT_PCM_FORMAT;
  const rateMatch = /rate=(\d+)/.exec(mimeType);
  return {
    ...DEFAULT_PCM_FORMAT,
    sampleRate: rateMatch ? parseInt(rateMatch[1]!, 10) : DEFAULT_PCM_FORMAT.sampleRate,
  };
}

export function pcmBase64ToWavDataUri(
  pcmBase64: string,
  format: PcmFormat = DEFAULT_PCM_FORMAT,
): string {
  const pcmBuffer = Buffer.from(pcmBase64, "base64");
  const { sampleRate, channels, bitsPerSample } = format;

  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // Subchunk1Size，PCM 固定是 16
  header.writeUInt16LE(1, 20); // AudioFormat = 1 代表 PCM（未壓縮）
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return `data:audio/wav;base64,${wavBuffer.toString("base64")}`;
}
