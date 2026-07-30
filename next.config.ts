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
};

export default withSerwist(nextConfig);
