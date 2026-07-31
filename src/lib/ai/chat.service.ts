import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIProvider } from "@/lib/ai/provider.factory";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SpeechProcessInput, SpeechProcessResult } from "@/lib/ai/types";

/**
 * ChatService — UI／API Route 唯一應該呼叫的入口。
 *
 * 架構規則（重要）：
 *   UI  ─────▶  API Route (route.ts)  ─────▶  ChatService  ─────▶  AIProvider
 *
 * UI 元件與 API Route 都「不應該」直接 import GeminiProvider 或 OpenAIProvider，
 * 一律透過 ChatService。這樣未來如果要加上：
 *   - 使用量計費 / usage_logs 紀錄
 *   - 重試邏輯 / fallback（例如 Gemini 失敗自動改打 OpenAI）
 *   - 回應快取
 * 都只需要修改這一個檔案，UI 完全不受影響。
 */

export interface ProcessSpeechMeta {
  userId: string;
  sessionId: string;
  /** 這是這場 session 裡的第幾輪（從 0 開始），用來對應 session_turns.turn_index */
  turnIndex: number;
}

export class ChatService {
  /**
   * 處理一輪語音互動，並把結果寫進資料庫。
   *
   * @param providerId 使用者當前選擇的模型，例如 "gemini-3-flash-preview" 或 "gpt-5.5"
   * @param supabase 這次請求「綁定使用者 session」的 Supabase client（來自 lib/supabase/server.ts），
   *   用這個 client 寫 session_turns，才能讓 RLS 的 insert policy 正常生效。
   *   不能傳 admin client 進來，那樣就繞過 RLS 了，等於自己放棄了資料庫層的保護。
   */
  async processSpeech(
    providerId: string,
    input: SpeechProcessInput,
    meta: ProcessSpeechMeta,
    supabase: SupabaseClient,
  ): Promise<SpeechProcessResult> {
    const provider = getAIProvider(providerId);
    const result = await provider.processSpeech(input);

    // 寫入 session_turns：用使用者自己的 session client，
    // RLS policy 會檢查這個 session_id 底下的 learning_sessions.user_id 是不是這個使用者。
    const { data: turnRow, error: turnError } = await supabase
      .from("session_turns")
      .insert({
        session_id: meta.sessionId,
        turn_index: meta.turnIndex,
        transcript: result.transcript,
        pronunciation_score: result.pronunciationScore ?? null,
        grammar_feedback: result.grammarFeedback ?? [],
        ai_reply_text: result.aiReplyText,
      })
      .select("id")
      .single();

    if (turnError) {
      // 寫入失敗不應該讓整個回應失敗——使用者已經拿到 AI 的回饋了，
      // 存檔失敗頂多是「這輪沒有歷史紀錄」，不應該讓使用者連結果都看不到。
      // 這裡選擇記錄錯誤但繼續回傳結果，而不是 throw。
      console.error("[ChatService] failed to write session_turns:", turnError);
    }

    // 寫入 interview_evaluations：面試模式專屬的評分維度，衛星表模式，
    // 用使用者自己的 session client（RLS 一樣透過 session_turns → learning_sessions 判斷擁有權）。
    if (result.interviewEvaluation && turnRow?.id) {
      const { error: evalError } = await supabase.from("interview_evaluations").insert({
        session_turn_id: turnRow.id,
        technical_depth: result.interviewEvaluation.technicalDepth ?? null,
        star_structure: result.interviewEvaluation.starStructure,
        communication: result.interviewEvaluation.communication,
        engineering_thinking: result.interviewEvaluation.engineeringThinking ?? null,
      });
      if (evalError) {
        console.error("[ChatService] failed to write interview_evaluations:", evalError);
      }
    }

    // 寫入 usage_logs：這張表刻意不開放一般使用者 insert（避免竄改用量），
    // 所以這裡固定用 admin client（service role），不是傳進來的使用者 client。
    try {
      const admin = createAdminClient();
      const { error: usageError } = await admin.from("usage_logs").insert({
        user_id: meta.userId,
        session_turn_id: turnRow?.id ?? null,
        provider: provider.id.startsWith("gemini") ? "gemini" : "openai",
        model: provider.id,
      });
      if (usageError) {
        console.error("[ChatService] failed to write usage_logs:", usageError);
      }
    } catch (err) {
      // SUPABASE_SERVICE_ROLE_KEY 沒設定時 createAdminClient() 會 throw，
      // 這種情況下不應該讓整個功能掛掉，只記錄錯誤即可（usage_logs 純粹是內部監控用途）。
      console.error("[ChatService] admin client unavailable, skipping usage_logs:", err);
    }

    return result;
  }

  async textToSpeech(providerId: string, text: string): Promise<string> {
    const provider = getAIProvider(providerId);
    return provider.textToSpeech(text);
  }
}

/** 單例，供 API Route 直接 import 使用 */
export const chatService = new ChatService();
