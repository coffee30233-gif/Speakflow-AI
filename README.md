# SpeakFlow AI

AI 英文口說教練 PWA。Mobile First，主要透過 iOS Safari「加入主畫面」使用。

## 技術棧
Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres/Auth/Storage) · Serwist (PWA) · Vercel

## 本機啟動步驟

```bash
npm install
cp .env.local.example .env.local
# 填入 Supabase 專案設定值與 GEMINI_API_KEY / OPENAI_API_KEY
npm run dev
```

> 本專案骨架是在無網路環境下手動建立的，尚未執行過 `npm install`，
> 第一次安裝時若版本落差造成型別錯誤，屬正常情況，需要時可調整 package.json 版本號。

## AI Provider Pattern 架構

```
UI (React 元件)
   │  呼叫 fetch("/api/speech-process")
   ▼
API Route  src/app/api/speech-process/route.ts
   │  只呼叫 chatService，不 import 任何 Provider
   ▼
ChatService  src/lib/ai/chat.service.ts
   │  透過 provider.factory 取得對應 Provider
   ▼
AIProvider 介面  src/lib/ai/types.ts
   ├─ GeminiProvider   src/lib/ai/providers/gemini.provider.ts
   └─ OpenAIProvider   src/lib/ai/providers/openai.provider.ts
```

**新增第三個模型（例如 Claude）時，只需要**：
1. 在 `src/lib/ai/providers/claude.provider.ts` 建立 `ClaudeProvider implements AIProvider`
2. 在 `src/lib/ai/provider.factory.ts` 的 `providerRegistry` 多加一行
3. 完全不需要修改 `ChatService`、API route，或任何 UI 元件

## 目前進度

- [x] 專案骨架、設定檔（ESLint / Prettier / Tailwind / PWA）
- [x] PWA / Service Worker：改用 **Serwist**（`next-pwa` 已無人維護，換成原作者維護的正式繼任者，原生支援 TypeScript）
- [x] AI Provider Pattern 架構（型別 + Factory + ChatService + API Route）
- [x] `GeminiProvider.processSpeech`（真實 API 呼叫，@google/genai 2.13.0 + inlineData + `responseMimeType`/`responseSchema`，已用 Zod 做運行時驗證）
- [x] 前端錄音功能 `useAudioRecorder`（iOS Safari 格式偵測）+ `/debug/recorder` 實測頁
- [ ] `GeminiProvider.textToSpeech`（TODO，下一步驟）
- [ ] `OpenAIProvider` 的實際 API 串接（目前為 TODO stub）
- [x] Supabase Client 設定（browser / server / middleware / admin，四種 client 都已建立）
- [x] Supabase Database Schema、RLS Policy、Storage Bucket（見 `supabase/README.md`）
- [ ] 實際在 Supabase 專案執行 migration（需要你有 Supabase 專案並填好 `.env.local`）
- [ ] Supabase Auth 登入流程（UI + 串接）
- [x] 跟讀模式（Shadowing）正式 UI（`/practice/shadowing`）——**目前不會存進資料庫**，重整頁面歷史就消失，等 ChatService 接上 DB 寫入後才會補上
- [ ] 把 ChatService 接上 `learning_sessions` / `session_turns` / `usage_logs` 寫入

## PWA 實作細節（Serwist）

- Service Worker 原始碼：`src/app/sw.ts`，build 時會編譯輸出成 `public/sw.js`（已加入 `.gitignore`，不需要 commit）。
- `next.config.ts` 用 `withSerwistInit` 包住 Next.js 設定，開發模式（`next dev`）會自動關閉 Service Worker，只有 production build 才會啟用——這代表**本機用 `npm run dev` 測試不到 PWA 行為**，要測 PWA／離線快取，需要 `npm run build && npm run start`。
- Web App Manifest 走 Next.js 原生的 `src/app/manifest.ts`（App Router 內建功能，跟 next-pwa／Serwist 無關，不受這次異動影響）。

## 在 iPhone 上實測錄音功能（重要）

`getUserMedia`（麥克風權限）在瀏覽器中**必須是 HTTPS 或 localhost** 才能運作，用 IP 位址（如 `http://192.168.x.x:3000`）在 iPhone 上打開會直接失敗，這點容易踩雷。

建議測試方式（擇一）：
1. **部署到 Vercel**（最簡單）：`vercel` 部署後在 iPhone Safari 開啟 preview URL 測試，網址是 HTTPS。
2. **本機 + ngrok / cloudflared**：`npx ngrok http 3000`，用產生的 HTTPS 網址在 iPhone 開啟。

測試步驟：
1. 在 iPhone Safari 開啟 `/debug/recorder`
2. 確認「偵測到的錄音格式」是否為 `audio/mp4` 或類似格式（不會是 `audio/webm`）
3. 錄一段英文，按「送到 Gemini 測試」
4. 若失敗，把錯誤訊息回報回來，會依實際錯誤調整 `GeminiProvider` 裡的 mimeType 處理邏輯

`/debug/recorder` 是開發階段的除錯頁面，正式上線前需要移除或加上存取限制。
- [ ] Firestore Security Rules
- [ ] 跟讀模式（Shadowing）UI
- [ ] shadcn/ui 元件安裝（`npx shadcn@latest add button card ...`）
- [ ] PWA icons（見 `public/icons/README.md`）

依照開發規範，以上每一項會分別實作、逐一確認後再進行下一步。
