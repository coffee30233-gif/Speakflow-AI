import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

// 這段是把 `injectionPoint`（precache manifest 會被注入的位置）的型別告訴 TypeScript。
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * ⚠️ 2026-08-02 緊急修復：原本用 @serwist/next 的 defaultCache，
 * 結果實測發現打開首頁「/」會顯示成跟讀模式「/practice/shadowing」的內容——
 * 用瀏覽器 DevTools 的 Network 分頁確認過，每個請求（包含最上層的 document 本身）
 * 都是從 Service Worker 快取回應，不是網路問題，也不是瀏覽器快取問題
 * （全新無痕視窗、清過站台資料還是重現）。
 *
 * 懷疑根因：defaultCache 對 Next.js App Router 的 RSC（React Server Component）
 * payload 做快取，但 RSC 回應非常依賴特定的 request header 才能正確區分
 *「這是哪個路徑的內容」，Service Worker 這層的快取比對邏輯沒處理好這些細節，
 * 導致 A 頁面的快取內容被誤植給 B 頁面的請求。
 *
 * 這裡先用最保守的做法處理：完全不快取「頁面導覽」（navigation）請求，
 * 一律直接打網路——犧牲一點離線瀏覽能力，換取「絕對不會顯示錯頁面」的正確性。
 * 靜態資源（JS/CSS，來自 __SW_MANIFEST 的 precache）維持照常快取，不受影響。
 *
 * 之後如果想要更完整的離線支援，需要另外針對 Next.js RSC 的快取策略
 * 重新設計（不能直接照搬 defaultCache），這裡先不做。
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
});

serwist.addEventListeners();
