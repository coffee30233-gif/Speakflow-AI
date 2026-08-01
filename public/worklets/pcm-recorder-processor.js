/**
 * PCM Recorder Worklet
 *
 * 這支檔案跑在瀏覽器的 Audio Worklet 執行緒（不是主執行緒），
 * 負責即時把麥克風的原始音訊（Float32，範圍 -1.0 ~ 1.0）
 * 轉成 Gemini Live API 要求的格式：16-bit PCM、little-endian。
 *
 * 用 AudioWorklet 而不是舊的 ScriptProcessorNode，是因為 ScriptProcessorNode
 * 已經被瀏覽器標記為棄用（deprecated），而且跑在主執行緒上容易造成音訊卡頓。
 *
 * 每收滿一批樣本就透過 port.postMessage 傳回主執行緒，主執行緒再負責
 * base64 編碼、透過 WebSocket 送給 Gemini。
 */
class PcmRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // 單聲道，只取第一個聲道
    if (!channelData || channelData.length === 0) return true;

    // Float32 (-1.0 ~ 1.0) 轉 Int16 PCM
    const pcm16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("pcm-recorder-processor", PcmRecorderProcessor);
