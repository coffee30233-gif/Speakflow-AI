import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

/**
 * PWA / Service Worker 設定，使用 Serwist（next-pwa 的正式繼任者，原作者維護）。
 *
 * next-pwa 已經沒有在維護，且沒有官方 TypeScript 型別，會在 build 時噴型別錯誤。
 * Serwist 原生支援 TypeScript，不需要額外的 ambient module 宣告檔。
 */
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 開發模式關閉，避免 service worker 快取干擾開發體驗
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * companies/ 底下的知識庫 .md 檔案是用 fs.readFileSync 在 runtime 動態讀取的
   * （不是用 import 靜態引入），Next.js 的檔案追蹤機制預設可能不會把這種
   * 「動態讀取的檔案」打包進 Vercel 的 serverless function，導致本機測試正常、
   * 上線後讀不到檔案。這裡明確告訴 Next.js 一定要包進去。
   */
  outputFileTracingIncludes: {
    "/api/speech-process": ["./companies/**/*"],
  },
};

export default withSerwist(nextConfig);
