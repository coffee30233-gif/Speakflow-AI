/**
 * Live API 串流音訊播放器。
 *
 * 跟之前 TTS 用的 pcm-to-wav.ts 不一樣——那個是「等全部音訊生成完，包成一個
 * 完整的 WAV 檔案再播」，適合一次性的教練回覆；這裡是「音訊一小段一小段收到，
 * 就排隊接續播放」，才能做到真正的即時對話感，不用等 AI 講完一整句才聽得到。
 *
 * 用 Web Audio API 的 AudioBufferSourceNode 排程播放時間，而不是每收到一段
 * 就馬上 play()——那樣段落之間會有明顯的空隙／喀嚓聲。這裡維護一個
 * 「下一段該幾秒開始播」的游標，讓每一段音訊緊接著上一段結束的時間點播放，
 * 聽起來才會是連續的語音，不是一段一段斷開的。
 */
export class LiveAudioPlayer {
  private audioContext: AudioContext;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private readonly sampleRate: number;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.audioContext = new AudioContext({ sampleRate });
  }

  private base64ToInt16Array(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Int16Array 需要 byte length 是偶數的 buffer，理論上 PCM16 資料本來就會是偶數，
    // 這裡不特別處理奇數長度的邊界情況（正常情況不會發生）。
    return new Int16Array(bytes.buffer);
  }

  /** 收到一段 base64 編碼的 PCM 音訊，排進播放佇列 */
  async enqueueChunk(base64Pcm: string): Promise<void> {
    if (!base64Pcm) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const int16 = this.base64ToInt16Array(base64Pcm);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      const sample = int16[i]!;
      float32[i] = sample / (sample < 0 ? 0x8000 : 0x7fff);
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, this.sampleRate);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    const startTime = Math.max(this.nextStartTime, now);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
    };
  }

  /**
   * 使用者打斷 AI 說話時呼叫（對應 Live API 訊息裡的 `interrupted: true`）：
   * 把還沒播完的音訊全部停掉，並把播放游標重置到現在這個時間點，
   * 避免使用者打斷之後，AI 舊的回覆還在繼續播、跟新的回覆疊在一起。
   */
  interrupt(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // 有可能這段音訊剛好已經自然播完了，stop() 會丟錯，直接忽略即可。
      }
    });
    this.activeSources = [];
    this.nextStartTime = this.audioContext.currentTime;
  }

  close(): void {
    this.interrupt();
    void this.audioContext.close();
  }
}
