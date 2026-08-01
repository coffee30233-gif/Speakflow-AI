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
- [x] **Gemini 型號升級**：`gemini-2.5-flash` → `gemini-3-flash-preview`（目前 Google 官方標準款，
  音訊輸入＋結構化輸出功能更完整）。改動範圍：`GeminiProvider`、`provider.factory.ts`、
  兩個 hook 的 `DEFAULT_PROVIDER_ID`、新 migration `20260731150000_upgrade_gemini_model.sql`
  （放寬 `preferred_ai_model` / `ai_model_used` 的 check constraint，**刻意保留舊型號字串
  仍在允許清單內**，避免既有歷史資料列因為型號改名而變成不合法狀態）
  ⚠️ **注意**：`gemini-3-flash-preview` 是 preview 型號，Google 可能不預警就調整行為或棄用，
  之後上線前建議再次確認是否有正式版（non-preview）型號可以換過去。
- [x] **Phase A：面試評分維度擴充**（V1 願景文件要求）：
  - `SpeechProcessResult` 新增 `interviewEvaluation`（technicalDepth／starStructure／communication／engineeringThinking）
  - `GeminiProvider` 動態組 responseSchema：只有 `mode === "interview"` 才要求這個欄位，
    技術類面試模式（模式名稱含 "technical"）才會多要求 technicalDepth／engineeringThinking，
    避免非面試模式或非技術面試模式的請求裡出現用不到的欄位說明
  - 新資料表 `interview_evaluations`（衛星表模式，透過 `session_turn_id` 跟 `session_turns` 一對一關聯，
    不污染其他模式共用的 `session_turns` 欄位——這個模式之後 Mind Map Recall 的 `recall_attempts` 也會沿用）
  - 面試結果畫面新增 `InterviewEvaluationBars` 視覺化元件（四個維度的分數條）
  - **`OpenAIProvider` 沒有跟著改**：它目前還是 TODO stub，之後真的實作時要記得補上一樣的邏輯
- [x] **V1 Phase B-1：Story 建立與 AI 拆解**：
  - `AIProvider` 介面新增 `decomposeStory()`，`GeminiProvider` 內部改用 `gemini-3.1-pro-preview`
    （原規格文件寫 `gemini-2.5-pro`，查證後已被 Google 棄用，換成現行替代型號）
  - 新資料表 `stories`（中文原文 + AI 拆解出的 STAR / 關鍵字 / 英文最佳答案）
  - `POST /api/stories`：建立故事並同步呼叫 AI 拆解，一次寫入
  - `/practice/mindmap`：故事庫列表頁；`/practice/mindmap/stories/new`：建立故事表單
  - 首頁導覽更新：拿掉跟讀模式的曝光（保留程式碼），加入 Mind Map Recall 入口，
    對應 V1 願景「只有兩個模式」的定位（這個異動我沒有另外找你確認，如果不同意請告訴我）
  - **已知不精確之處**：`usage_logs` 記的 `model` 欄位是「使用者選的對話層級」，
    不是 `decomposeStory` 內部實際用的 Pro 型號，之後要精算 Pro 呼叫成本需要另外處理
  - **還沒做**：Story 列表頁的編輯/刪除功能
- [x] **V1 Phase B-2：Question 資料表 + Mind Map 規則式生成**：
  - 新資料表 `interview_questions`（company_kb 題目與 custom 題目，company_kb 用 partial unique
    index 去重，第一次被選用時才 materialize，不預先塞資料，避免跟 `companies/*.md` 內容重複維護）
  - 新資料表 `mind_maps`（存 React Flow 的 `{ nodes, edges }` 格式，一個使用者一個問題一份）
  - `src/lib/mindmap/build-mindmap.ts`：規則式把 Story 的 STAR + 關鍵字轉成節點/邊結構，
    **沒有另外呼叫 AI**（STAR 拆解在 B-1 已經做完，這裡純粹是資料格式轉換），已用 Node 腳本驗證過節點/邊數量正確
  - `POST /api/mindmaps`：故事 + 問題 → 生成並存檔
  - `/practice/mindmap/stories/[storyId]/build`：選題目（公司題庫或自訂）→ 生成 →
    先用純清單方式預覽節點結構（**還不是真正的 React Flow 視覺化畫布，那是 B-3 的範圍**）
  - V1 階段公司只有 ASML 一間，選題畫面先簡化成直接抓第一間公司，
    之後 `companies/` 底下有多間公司時，這裡需要改成讓使用者先選公司
  - **還沒做**：Recall Training 互動（Phase C）
- [x] **V1 Phase B-3：React Flow 畫布 UI**：
  - 換上正確的套件名稱 `@xyflow/react`（v12），舊的 `reactflow` 套件已經停在 v11 不再維護
  - `MindMapNodeView`：自訂節點元件，依 root／star／keywords／keyword 四種節點類型給不同樣式
  - `MindMapCanvas`：畫布 + 基本編輯——點選節點可在下方面板編輯文字、可新增關鍵字節點、
    可刪除關鍵字節點（**STAR 骨架跟問題節點不開放刪除**，避免誤刪破壞結構），有「儲存」按鈕
  - `PATCH /api/mindmaps/[id]`：儲存編輯後的節點/邊資料
  - `/practice/mindmap/view/[mindMapId]`：檢視/編輯頁；故事庫首頁新增「我的 Mind Map」清單區塊
  - 手機/桌面的分工是「引導使用者在較大螢幕操作比較舒服」，不是程式碼強制限制——
    React Flow 本身支援觸控手勢，手機上一樣能用，只是操作精細度會差一點
  - **還沒做**：Recall Training（依 Level 1/2/3 漸進隱藏節點、五秒計時提示）——這是 Phase C
- [x] **V1 Phase C：Recall Training**：
  - `PracticeMode` 新增 `"recall"`；`recallContext` / `recallEvaluation` 新型別
  - **提示機制完全不呼叫 AI**：五秒計時 + 漸進顯示節點是純前端邏輯（`useRecallPractice` +
    `computeVisibleNodeIds`），只有使用者真的開口回答後才打一次 AI API
  - 新資料表 `recall_attempts`（衛星表模式，同 `interview_evaluations`），
    `learning_sessions.mode` 再擴充加入 `"recall"`
  - **順便修正了一個之前欠著的債**：`interview` 跟 `recall` 這兩個重推理模式，
    `GeminiProvider` 現在真的會切去 `gemini-3.1-pro-preview`（之前只有 `decomposeStory`
    有做，`processSpeech` 的 interview 模式其實一直都還在用 Flash，跟規格文件的建議不一致，
    這次一併修正）
  - `/practice/mindmap/view/[mindMapId]/recall`：選層級 → 看提示漸進展開 → 開口回答 →
    AI 評「回憶完整度」跟「自然度」（不是評文法對錯，是評有沒有想起關鍵內容）
  - **還沒做**：Progress 統計視覺化（時間/完整度趨勢）、Coach Notes（跨 session 記憶）——這是 Phase D 的範圍
- [x] **V1 Phase D-1：TTS 語音合成**：
  - 語音合成真正接上 `gemini-3.1-flash-tts-preview`（實作位置在 D-2 重構後搬到了
    `src/lib/voice/providers/gemini-voice.provider.ts`，見下方）
  - Gemini TTS 回傳的是**裸 PCM 音訊**（沒有檔頭，瀏覽器無法直接播放），
    新增 `src/lib/audio/pcm-to-wav.ts` 手動包 WAV 檔頭（已用 Node 腳本驗證過檔頭格式正確）
  - **架構決策**：`processSpeech()` 現在會自動幫 `aiReplyText` 合成語音，
    附加在 `SpeechProcessResult.aiReplyAudioUrl`——**所有模式**（跟讀/面試/Recall）都會有語音回覆，
    不是只有特定模式才有
  - `session_turns.ai_reply_audio_url`（Phase A 就建好、一直沒用到的欄位）現在真的有東西寫進去了
  - 三個練習頁面都加了 `AudioReplyPlayer`（手動播放按鈕，**刻意不用 autoplay**——
    iOS Safari 對自動播放音訊管得嚴，非同步 fetch 完成後才觸發的播放不保證不被擋掉）
  - ⚠️ **老實說的取捨**：現在是直接回傳 base64 data URI，**沒有存進 Supabase Storage**
    （雖然 `session-audio` bucket 早就建好了）。data URI 直接塞進 `session_turns` 的 text 欄位，
    每輪對話都會讓這張表變胖（一段幾秒的語音 base64 編碼後可能好幾十 KB）。
    這是為了先讓功能動起來的簡化，之後如果資料庫大小變成問題，
    要改成上傳到 Storage、存簽名 URL，不難但這次沒做
  - ⚠️ **延遲/成本會變高**：現在每一輪對話等於多打一次 AI API（結構化評分 + 語音合成，
    循序執行不是平行的），使用者會感覺回饋變慢一點，這是純語音功能的必然代價
- [x] **V1 Phase D-2：獨立 VoiceProvider 架構**：
  - 新增 `src/lib/voice/`（`types.ts` / `voice.factory.ts` / `providers/gemini-voice.provider.ts`），
    跟 `src/lib/ai/` 的 Provider Pattern 是平行、獨立的抽象層
  - **`AIProvider` 介面拿掉了 `textToSpeech()` 方法**——語音合成不再是「文字生成模型」的職責，
    `GeminiProvider` 跟 `OpenAIProvider` 都不再需要實作語音相關的東西
  - `ChatService.processSpeech()` 改成同時呼叫 `AIProvider`（評分/推理）跟 `VoiceProvider`
    （語音合成）兩條獨立路徑，語音合成失敗一樣不會擋住文字回饋
  - 教練聲音固定用同一個聲音（`Kore`），**不管使用者選哪個 AIProvider 都一樣**——
    這是這次重構真正要解決的問題：之前語音是掛在 `GeminiProvider` 底下，
    邏輯上代表「換了文字生成模型、教練聲音也會跟著換」，現在完全脫鉤
  - 語音合成的 usage_logs 現在會**獨立記一筆**（跟評分呼叫分開），成本追蹤更精準
  - `ChatService.textToSpeech(text)` 簽名也跟著簡化，不再需要傳 `providerId`
    （語音合成本來就跟使用者選的 AIProvider 無關）
- [x] **V1 Phase D-3：Coach Memory**：
  - `src/lib/coach/memory.ts`：`buildCoachMemoryContext(userId, supabase)`，
    **規則式查資料庫組字串，不呼叫 AI**（查最近 3 次 `learning_sessions` + 對應
    `session_turns` 的平均發音分數，組成「3 天前：模擬面試，平均發音分數 78 分」這種摘要）
  - `SpeechProcessInput` 新增 `coachMemory` 欄位；`ChatService.processSpeech()`
    在呼叫 Provider **之前**先查好教練記憶塞進去——維持既有架構邊界：
    Provider 完全不碰 Supabase，資料庫存取都在 ChatService／API Route 這一層
  - `buildSpeechPrompt()` 統一在最前面加上教練記憶摘要，**所有模式共用**
- [x] **V1 Phase D-4：開場小聊天**：
  - `AIProvider` 新增 `generateGreeting(coachMemory)`，`GeminiProvider` 用 Flash 型號實作
    （開場問候是輕量任務，不需要 Pro 層級，跟決定「哪些任務要用 Pro」的既有原則一致）
  - `POST /api/coach/greeting`：查教練記憶 → AI 生成問候語 → 合成語音，一次回傳
  - 新元件 `CoachGreeting`：面試跟 Recall 練習頁面現在都會先顯示教練的開場問候
    （文字＋語音），使用者按「準備好了」才進入正式練習
  - **容錯設計**：開場問候語 API 失敗時，畫面會顯示保底的靜態問候語＋繼續按鈕，
    不會卡住使用者——開場問候是體驗加分項，不應該變成練習的擋路石
  - **還沒做**：Live API 即時語音（`gemini-3.1-flash-live-preview`）——這是完全不同的
    WebSocket 架構，工程量遠大於以上幾項，之前就說過要等 D-1~D-4 穩定後再單獨排
- [x] **V1 Phase D-5（進行中）：Live API 即時語音——第一步，臨時 Token 核發**：
  - `src/lib/voice/live-token.ts`：`createLiveSessionToken()`，用 `GEMINI_API_KEY`
    換一組短命（1 分鐘內要開始連線）的臨時 Token，前端只拿得到這組 Token
  - `POST /api/live/token`：核發端點，要求登入
  - `/debug/live-token`：實測頁面，先確認 Token 核發本身能不能成功
  - ⚠️ **已知問題，需要你實測確認**：如果 `GEMINI_API_KEY` 是新格式（`AQ.` 開頭），
    `authTokens.create()` 目前查到會回傳 `INVALID_ARGUMENT` 錯誤，只有舊格式
    （`AIzaSy...` 開頭）的 Key 目前正常。麻煩你先跑一次 `/debug/live-token`，
    如果失敗且錯誤訊息符合這個描述，需要換一把舊格式的 Key 或等 Google 修這個 bug
  - **範圍界定，還沒做的部分（工程量最大的還在後面）**：
    - ~~前端跟 Gemini 建立實際的 WebSocket 連線~~ ✅ 見下方第二步
    - ~~麥克風連續串流擷取~~ ✅ 見下方第二步
    - 即時播放 Gemini 串流回來的音訊——**還沒做**
    - 處理使用者打斷 AI 說話的情境——**還沒做**
    - 整合進面試／Recall 練習流程（要決定：Live API 是取代現有的錄音流程，
      還是並存的另一個「即時聊天」入口——這是還沒討論的架構問題，不是純工程問題）
- [x] **V1 Phase D-5（進行中）：Live API 即時語音——第二步，前端連線＋麥克風串流**：
  - `public/worklets/pcm-recorder-processor.js`：AudioWorklet，即時把麥克風原始音訊
    （Float32）轉成 Gemini 要求的格式（16-bit PCM、16kHz、little-endian）
  - `src/hooks/useLiveSession.ts`：核心邏輯——拿臨時 Token → 用 `@google/genai` SDK
    直接在瀏覽器呼叫 `ai.live.connect()` → 建立麥克風串流 → 透過
    `session.sendRealtimeInput()` 持續送出音訊
  - `/debug/live-session`：實測頁面，顯示連線狀態跟收到的訊息 log
  - ✅ **2026-08-01 真機實測成功**：`@google/genai` SDK 在瀏覽器打包、執行都正常，
    不用改成手刻 WebSocket 的備案了。實測收到 `inputTranscription: "My name is Shanling Ye."`——
    證實麥克風擷取→PCM 轉換→WebSocket 送出這條管線的音訊格式、取樣率全部正確，
    Gemini 也有正常用串流語音回應（`modelTurn` 帶 24kHz PCM 音訊資料），
    連 `interrupted`／`turnComplete`／`sessionResumptionUpdate` 這些協定層級的訊號都正常收到
  - **這一步刻意還沒做的部分**：播放 Gemini 回傳的語音（目前只會在訊息 log 顯示收到的
    原始訊息內容，還沒接到 Web Audio API 播出來）、處理使用者打斷、整合進實際練習流程——
    照原計畫留到下一步
- [x] **V1 Phase D-5（進行中）：Live API 即時語音——第三步，即時播放＋打斷處理**：
  - `src/lib/audio/live-audio-player.ts`：`LiveAudioPlayer` class，用 Web Audio API
    的 `AudioBufferSourceNode` 排程播放時間，讓一段一段收到的 PCM 音訊接續播放，
    不會有段落間的空隙／喀嚓聲——這跟之前 TTS 用的「等全部生成完再包成 WAV 播」是
    完全不同的做法，這裡是真正的串流播放
  - `interrupt()`：對應 Live API 的 `interrupted: true` 訊號，把還在播放的音訊全部停掉、
    播放游標歸零，避免使用者打斷後新舊回覆的語音疊在一起
  - `useLiveSession.ts` 更新：`onmessage` 現在會解析 `modelTurn.parts[].inlineData`
    餵進播放器、解析 `interrupted` 觸發打斷、順便把 `inputTranscription` /
    `outputTranscription` 也印進訊息 log 方便除錯
  - 連線意外斷線時（`onclose`，不一定是使用者手動按「結束連線」）也會清掉麥克風跟播放器資源，
    避免麥克風被一直佔用
  - ✅ **2026-08-01 真機實測成功**：完整雙向即時語音對話跑通——連線、麥克風串流、
    AI 語音回應、串流播放、打斷處理全部正常運作，使用者可以直接對著手機說話，
    聽到 AI 即時用語音回應
  - **還沒做**：整合進實際練習流程——目前只有 `/debug/live-session` 這個獨立測試頁面，
    還沒決定 Live API 是要取代跟讀/面試/Recall 現有的錄音流程，還是並存的另一個入口，
    這是下一步要先討論的架構問題
- [x] **實驗功能：教練模式（自然糾正文法）**：
  - `/debug/live-session` 加了「教練模式」開關，開啟後會帶一段 system instruction，
    讓 AI 在對話中順口自然糾正文法/用字（不打斷對話節奏，不是逐句判定對錯）
  - **重要的能力邊界，跟你確認過**：Live API 的糾正**只會是講出來的語音**，
    沒辦法像 `processSpeech()` 一樣同時吐出結構化 JSON（`pronunciationScore`／
    `grammarFeedback` 那種可以存檔、算分數的資料）——這是原生語音模型的本質限制，
    不是這次沒做完，這也是為什麼 Live API 目前傾向定位成「並存的自然對話入口」，
    不是取代現有評分流程的候選
  - 順手修正一個小 bug：`onClick={connect}` 這種寫法會把 React 的滑鼠事件物件當成
    `connect()` 的參數傳進去，已經改成 `onClick={() => connect({ coachMode })}`
- [x] **緊急修復（2026-07-31）：Pro 型號撞到 429 配額限制**：
  - 實測面試模式時發現 `gemini-3.1-pro-preview` 回傳 `429`（配額/速率限制），
    preview 型號的免費額度通常非常嚴格
  - **暫時處理**：`gemini.provider.ts` 的 `PRO_MODEL_ID` 常數改指向 `MODEL_ID`（Flash），
    只改一行，面試／Recall／Story 拆解（B-1）三個原本用 Pro 的地方**一起**改回 Flash——
    這三個地方都共用同一個常數，會撞到同一個配額問題，不是只有面試模式受影響
  - **待辦**：去 Google AI Studio 確認 `gemini-3.1-pro-preview` 實際的配額限制／
    是否需要升級付費方案，確認後把 `PRO_MODEL_ID` 改回 `"gemini-3.1-pro-preview"` 即可復原，
    不用動任何呼叫端程式碼
  - 沒做的部分：自動重試邏輯（429 時自動等待重試）——這次只選了「先改回 Flash」，
    沒有一併加重試機制，之後如果想要可以再加
- [x] **緊急修復（2026-07-31）：CoachGreeting 卡在「教練準備中」出不去**：
  - 實測發現：`/api/coach/greeting` 請求卡住／很慢時，畫面會永遠停在 loading，
    繼續按鈕維持 disabled，使用者被卡住進不了練習
  - 根因是我當初的容錯設計只處理了「API 明確回錯誤」，**沒處理「請求根本沒回應」**
  - **修復**：`CoachGreeting.tsx` 加上 `AbortController` + 8 秒逾時，逾時就主動中斷請求、
    降級成保底靜態問候語，繼續按鈕會正常啟用
  - ⚠️ **懷疑但還沒證實的根因**：`gemini-3.1-flash-tts-preview`（語音合成）也是 preview 型號，
    很可能跟 `gemini-3.1-pro-preview` 一樣免費層額度是 0——如果之後看到 log 裡
    `/api/coach/greeting` 的語音合成那段報 429，就是同一類問題，處理方式一樣
    （先讓 TTS 呼叫失敗時降級成文字，不要整個卡住，`ChatService.getGreeting` 目前
    已經有 try/catch 包住語音合成那段，理論上不會真的卡住，但這次仍然卡了，
    需要看實際 log 才能確認真正原因）
- [x] **已解除的風險（2026-08-01）：iOS Safari 錄音格式 `audio/mp4`**：
  - Phase A 就標記過的未知數，這次真機實測確認：**`audio/mp4` Gemini 可以正常處理**，
    有拿到正常的逐字稿／評分回傳，雖然它沒有寫在 Gemini 官方支援清單裡
  - `KNOWN_SUPPORTED_MIME_TYPES` 已加入 `audio/mp4`，之後不會再跳出誤導性的警告 log
- [x] **效能優化（2026-08-01）：資料庫寫入搬進背景執行**：
  - 你回報「跑得有點慢」，查出主因：每一輪對話原本要循序等完「AI 評分 → TTS 合成 →
    寫 session_turns → 寫 evaluations/recall_attempts → 寫兩筆 usage_logs」全部完成，
    才把結果回傳給使用者——資料庫寫入其實使用者根本不需要等
  - 用 Next.js 15.1 的 `after()` API（`next/server`）把所有資料庫寫入搬進背景任務，
    使用者現在只需要等「AI 評分 + 語音合成」這兩個真正影響回應內容的呼叫完成
  - `after()` 不是單純不 await（fire-and-forget）——不 await 的 promise 在 serverless
    環境下很可能還沒跑完，function 就被平台砍掉了；`after()` 會讓 function 在回應
    送出後繼續存活，把背景工作做完，這是專門為這種情境設計的 API
  - `getGreeting()` 跟 `decomposeStory()` 的 usage_logs 寫入也一併搬進 `after()`
  - **沒有變的部分**：AI 評分呼叫 + TTS 合成呼叫還是循序執行、還是會阻塞回應——
    這兩個是真的需要等待的（TTS 需要先知道 AI 回覆文字才能合成語音），這次優化沒有
    處理到這塊，如果之後還是覺得慢，需要的是更大的架構改動（例如串流回應），不是這種
    「把不必要的等待拿掉」的優化能解決的
- [ ] **Groq Provider（暫緩）**：查證後發現 Groq 的聊天模型目前不支援原生音訊輸入
  （跟 Gemini/GPT 不一樣，需要內部另外呼叫 Whisper 轉文字再丟給 LLM，會是兩次 API 呼叫、
  行為模式跟其他 Provider 不一致）。已決定**先不接**，等 Groq 官方支援原生音訊輸入再做。
  屆時的設定：預設模型改為 Groq、文字模型用 `openai/gpt-oss-120b`
  （Groq 目前的官方推薦預設，需要屆時重新確認是否仍是最新推薦）。
- [x] Supabase Client 設定（browser / server / middleware / admin，四種 client 都已建立）
- [x] Supabase Database Schema、RLS Policy、Storage Bucket（見 `supabase/README.md`）
- [ ] 實際在 Supabase 專案執行 migration（需要你有 Supabase 專案並填好 `.env.local`）
- [ ] Supabase Auth 登入流程（UI + 串接）
- [x] **Supabase Auth 登入流程**：
  - `/login`：登入／註冊頁面（Email + 密碼），用 Server Actions（`src/app/login/actions.ts`）
  - `/auth/confirm`：Email 驗證連結的 Route Handler
  - 首頁會顯示登入狀態（`已登入：xxx@example.com`）與登入／登出入口
  - **`/practice/*` 目前沒有強制要求登入**——這是刻意的，等 ChatService 接上資料庫寫入時，
    才需要真的擋未登入使用者（不然 session 沒有 user_id 可以寫）
  - ⚠️ **需要你在 Supabase Dashboard 手動做兩件事，程式碼沒辦法幫你設定**：
    1. Auth → Email Templates → *Confirm signup*：把 `{{ .ConfirmationURL }}` 改成
       `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
    2. Auth → URL Configuration：把 *Site URL* 設成你的正式網域（Vercel 網址），
       並在 *Redirect URLs* 加入該網域，不然驗證信裡的連結會連到錯的地方（例如 localhost）

## 關於 Next.js 16 的一個提醒（目前不影響你，但之後升級要注意）

Next.js 16 把 `middleware.ts` 這個檔案慣例改名成 `proxy.ts`（函式也從 `middleware` 改叫 `proxy`）。
這個專案的 `package.json` 鎖定 `next: "^15.1.0"`（不會自動跳大版本），所以現有的
`src/middleware.ts` 目前完全正常。只是提醒你：**之後如果要升級到 Next.js 16**，
需要把 `middleware.ts` 重新命名成 `proxy.ts`、函式名稱也要改，
Next.js 官方有提供自動轉換工具：`npx @next/codemod@canary middleware-to-proxy .`
- [x] 跟讀模式（Shadowing）正式 UI（`/practice/shadowing`）——**目前不會存進資料庫**，重整頁面歷史就消失，等 ChatService 接上 DB 寫入後才會補上
- [ ] 把 ChatService 接上 `learning_sessions` / `session_turns` / `usage_logs` 寫入
- [x] **ChatService 接上資料庫寫入**：
  - `POST /api/sessions`：建立一場練習（跟讀／面試共用），回傳 `sessionId`
  - `PATCH /api/sessions/[id]`：結束練習
  - `ChatService.processSpeech` 現在會實際寫入 `session_turns`（用使用者自己 session 綁定的
    client，靠 RLS 把關）跟 `usage_logs`（用 admin client，因為這張表不開放一般使用者寫入）
  - **連帶影響**：`/api/speech-process`、`/practice/shadowing`、`/practice/interview*`
    現在都要求登入，沒登入會被導去 `/login`（並在登入成功後導回原本要去的頁面）
  - `session_turns` 寫入失敗不會讓使用者拿不到 AI 回饋（只記 log，不擋回應）；
    `usage_logs` 同理，因為那兩張表的資料遺失不影響當下的使用體驗，只影響「之後看不看得到歷史紀錄」
  - **還沒做**：`/history` 歷史紀錄頁面（資料現在已經有在存了，但還沒有 UI 可以看）
- [x] **面試教練模式架構**（第四種練習模式，與跟讀/自由對話/情境並存）：
  - `companies/`：公司知識庫內容（純資料，目前只有 `asml/`），新增公司步驟見 `companies/README.md`
  - `src/lib/interview/`：知識庫解析器、公司註冊表（fs 動態掃描）、面試 Prompt Builder
  - `src/lib/ai/types.ts` 的 `PracticeMode` 新增 `"interview"`，`SpeechProcessInput` 新增 `interviewContext`
  - `GeminiProvider` / `OpenAIProvider` **完全沒有修改**——它們只呼叫 `buildSpeechPrompt()`，
    面試模式的邏輯全部在 `lib/interview` 這一層，Provider Pattern 的邊界保持乾淨
  - `next.config.ts` 加了 `outputFileTracingIncludes`，確保 Vercel 會把 `companies/` 打包進 serverless function
  - **還沒做**：面試模式的 UI 畫面（公司/職位/難度選擇）、履歷上傳功能
- [x] **面試教練模式 UI**：
  - `/practice/interview`：設定頁（Server Component，直接讀 `listAllCompanies()`）
  - `/practice/interview/session`：模擬面試互動頁，第一題從知識庫的
    `Behavioral Interview Topics` 直接挑（不額外打一次 AI API），
    之後每一輪都是「使用者回答 → AI 評分＋給下一題」的循環
  - 一樣**不會存進資料庫**，跟跟讀模式目前的限制相同

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
