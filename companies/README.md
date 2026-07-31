# companies/ — 公司面試知識庫

這個資料夾放的是**資料**，不是程式碼。新增一間公司，理論上完全不需要碰 `src/` 底下任何檔案。

## 新增一間公司的步驟

1. 在這裡建立一個新資料夾，用公司英文小寫當資料夾名稱，例如 `nvidia/`、`google/`
2. 在裡面放一個檔名固定叫 `knowledge-base.md` 的檔案（**檔名一定要是這個，不能沿用原本的檔名**，
   系統是用固定路徑 `companies/<公司id>/knowledge-base.md` 去找檔案的）
3. 內容照著 `asml/knowledge-base.md` 的標題格式寫，至少要包含以下這幾個標題（大小寫需完全一致）：
   - `# Company Information`（內文需包含 `**Company:** 公司名稱` 和 `**Industry:** 產業別`）
   - `# Supported Positions`（條列式，`- 職位名稱`）
   - `# Supported Interview Modes`（條列式，`- 面試模式名稱`，例如 `- Technical Interview`）
   - `# Company Culture`
   - `# Evaluation Criteria`
   - `# Speaking Rules`
   - 如果有技術面試需求：`# Technical Knowledge`（可以用 `##` 子標題細分類別，例如 ASML 的
     `## Optics` / `## Measurement` / `## Manufacturing`）
   - 如果有行為面試需求：`# Behavioral Interview Topics`、`# STAR Method`
4. 重新部署（因為 `next.config.ts` 有設定把 `companies/**/*` 打包進 serverless function，
   新增檔案後需要重新部署，Vercel 才會抓到新內容）

完成以上步驟後：
- `listAllCompanies()` 會自動列出新公司
- Prompt Builder 會自動用新公司的知識庫組出對應的面試 prompt
- **不需要修改 `src/lib/interview/` 底下任何一個檔案**

## 目前支援的公司

- `asml/`（已完成，來源：你提供的 `ASML_INTERVIEW_KNOWLEDGE_BASE.md`）

## 解析邏輯是怎麼運作的（給你了解實作原理）

`src/lib/interview/knowledge-base-parser.ts` 是一個通用的 Markdown 段落解析器，
完全不知道「ASML」是什麼，只認得標題階層（`#` / `##`）。它會把整份文件切成一段一段，
之後 `src/lib/interview/prompt-builder.ts` 依「使用者選的 Interview Mode」決定要抽哪幾段
塞進最終送給 Gemini/OpenAI 的 prompt（例如 Technical Interview 會多帶入 `Technical Knowledge`
那一段，Behavioral Interview 會多帶入 `Behavioral Interview Topics` + `STAR Method`）。

這個「哪個面試模式要帶哪些段落」的對應規則，是知識庫文件格式的共同慣例，
不是針對 ASML 寫死的內容 —— 只要新公司的 `.md` 遵守一樣的標題慣例，這裡完全不用改。
