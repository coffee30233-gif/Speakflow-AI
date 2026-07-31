"use client";

interface AudioReplyPlayerProps {
  audioUrl?: string;
}

/**
 * 播放 AI 教練的語音回覆。
 * 刻意不用 autoplay——iOS Safari 對自動播放音訊管得很嚴，
 * 而且這裡的播放時機是非同步 fetch 完成後才觸發，不保證被瀏覽器視為
 * 「使用者手勢的延續」，autoplay 很容易被靜音擋掉，不如直接給一個播放按鈕更可靠。
 */
export function AudioReplyPlayer({ audioUrl }: AudioReplyPlayerProps) {
  if (!audioUrl) return null;

  return (
    <audio controls src={audioUrl} className="mt-2 h-9 w-full" preload="none">
      您的瀏覽器不支援音訊播放。
    </audio>
  );
}
