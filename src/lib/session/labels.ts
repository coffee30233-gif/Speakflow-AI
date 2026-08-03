/**
 * 練習模式的中文顯示標籤，UI 跟 lib/coach/memory.ts 共用同一份，
 * 避免兩個地方各寫一份、之後改了模式名稱卻只改到其中一邊。
 */
export const MODE_LABEL: Record<string, string> = {
  shadowing: "跟讀練習",
  freetalk: "自由對話",
  scenario: "情境任務",
  interview: "模擬面試",
  recall: "Mind Map Recall 練習",
  live_chat: "跟教練聊聊",
};
