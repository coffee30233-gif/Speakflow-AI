import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIProvider } from "@/lib/ai/provider.factory";
import { getVoiceProvider } from "@/lib/voice/voice.factory";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCoachMemoryContext } from "@/lib/coach/memory";
import type {
  SpeechProcessInput,
  SpeechProcessResult,
  StoryDecomposition,
  ConversationAnalysis,
} from "@/lib/ai/types";

/**
 * ChatService — UI／API Route 唯一應該呼叫的入口。
 *
 * 架構規則（重要）：
 *   UI  ─────▶  API Route (route.ts)  ─────▶  ChatService  ─────▶  AIProvider（文字/評分）
 *                                                          └─────▶  VoiceProvider（語音合成）
 *
 * AIProvider 跟 VoiceProvider 是兩條平行、互相獨立的抽象層：
 * 換 AIProvider（Gemini/GPT-5.5）只影響「怎麼評分、怎麼推理」，
 * VoiceProvider 永遠是同一個，教練的聲音不會因為換了文字生成模型而變了一個人。
 *
 * UI 元件與 API Route 都「不應該」直接 import GeminiProvider、OpenAIProvider
 * 或任何 VoiceProvider 實作，一律透過 ChatService。這樣未來如果要加上：
 *   - 使用量計費 / usage_logs 紀錄
 *   - 重試邏輯 / fallback（例如 Gemini 失敗自動改打 OpenAI）
 *   - 回應快取
 * 都只需要修改這一個檔案，UI 完全不受影響。
 *
 * 效能設計（2026-08-01 加入）：資料庫寫入（session_turns / evaluations / usage_logs）
 * 全部搬進 Next.js 15 的 after() 背景任務——使用者不需要等這些寫入完成才看到 AI 回饋，
 * 只要「AI 評分 + 語音合成」這兩個真正影響回應內容的呼叫完成就能拿到結果。
 * after() 會讓 serverless function 在回應送出後繼續存活，把背景工作做完，
 * 跟單純不 await（fire-and-forget）不一樣——不 await 的 promise 在 serverless
 * 環境下很可能還沒跑完，function 就被平台砍掉了。
 */

export interface ProcessSpeechMeta {
  userId: string;
  sessionId: string;
  /** 這是這場 session 裡的第幾輪（從 0 開始），用來對應 session_turns.turn_index */
  turnIndex: number;
}

export class ChatService {
  /**
   * 處理一輪語音互動。回傳的時機只等「AI 評分 + 語音合成」完成，
   * 資料庫寫入交給 after() 在背景做完，不阻塞回應。
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

    // 教練記憶是規則式組出來的字串（查資料庫，不呼叫 AI），
    // 塞進 input 讓 prompt-builder 統一處理，Provider 本身完全不碰 Supabase。
    // 這個查詢很快（索引查詢），沒有搬進 after()——它會影響 prompt 內容，必須在呼叫 AI 之前完成。
    const coachMemory = await buildCoachMemoryContext(meta.userId, supabase);
    const textResult = await provider.processSpeech({ ...input, coachMemory });

    // 合成 AI 回覆的語音。這裡故意不透過 provider（AIProvider 已經不再負責語音），
    // 而是呼叫獨立的 VoiceProvider——不管使用者選的是 Gemini 還是之後的 GPT-5.5，
    // 教練的聲音永遠是同一個。用 try/catch 包起來、不讓合成失敗擋住整個回應，
    // 使用者至少要能看到文字回饋，語音是錦上添花，不是必要條件。
    let aiReplyAudioUrl: string | undefined;
    const voiceProvider = getVoiceProvider();
    try {
      aiReplyAudioUrl = await voiceProvider.synthesizeSpeech(textResult.aiReplyText);
    } catch (err) {
      console.warn("[ChatService] TTS synthesis failed, falling back to text-only:", err);
    }

    const result: SpeechProcessResult = { ...textResult, aiReplyAudioUrl };

    // ---- 以下全部搬進 after()，使用者不用等這些寫完 ----
    after(async () => {
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
          ai_reply_audio_url: result.aiReplyAudioUrl ?? null,
        })
        .select("id")
        .single();

      if (turnError) {
        // 寫入失敗不影響使用者——回應早就送出去了，這裡失敗頂多是「這輪沒有歷史紀錄」。
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

      // 寫入 recall_attempts：Recall Training 專屬的評分維度，衛星表模式，
      // mind_map_id / level / hintLevelUsed / recallTimeSeconds 都來自 input.recallContext，
      // completeness / confidence 來自 AI 的回覆，兩邊湊起來才是完整的一筆紀錄。
      if (result.recallEvaluation && input.recallContext && turnRow?.id) {
        const { error: recallError } = await supabase.from("recall_attempts").insert({
          session_turn_id: turnRow.id,
          mind_map_id: input.recallContext.mindMapId,
          level: input.recallContext.level,
          recall_time_seconds: input.recallContext.recallTimeSeconds,
          completeness_score: result.recallEvaluation.completeness,
          confidence_score: result.recallEvaluation.confidence,
          hint_level_used: input.recallContext.hintLevelUsed,
        });
        if (recallError) {
          console.error("[ChatService] failed to write recall_attempts:", recallError);
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

        // 語音合成是獨立的一次 API 呼叫，成本也要單獨記一筆，不能因為跟評分呼叫綁在同一輪
        // 對話裡就漏記——usage_logs 的目的就是不能有成本黑洞。
        if (aiReplyAudioUrl) {
          const { error: voiceUsageError } = await admin.from("usage_logs").insert({
            user_id: meta.userId,
            session_turn_id: turnRow?.id ?? null,
            provider: "gemini",
            model: voiceProvider.id,
          });
          if (voiceUsageError) {
            console.error("[ChatService] failed to write usage_logs (voice):", voiceUsageError);
          }
        }
      } catch (err) {
        // SUPABASE_SERVICE_ROLE_KEY 沒設定時 createAdminClient() 會 throw，
        // 這種情況下不應該讓整個功能掛掉，只記錄錯誤即可（usage_logs 純粹是內部監控用途）。
        console.error("[ChatService] admin client unavailable, skipping usage_logs:", err);
      }
    });

    return result;
  }

  /**
   * 產生開場問候語（含語音），給 Voice Coach 的開場小聊天用。
   * 這裡用一個獨立的 admin client 查詢，因為這個方法目前設計成
   * 「登入即可呼叫」，沒有綁定特定 session，用 admin client 讀自己的歷史紀錄
   * 反而比要求呼叫端傳一個使用者 session client 更單純。
   */
  async getGreeting(
    providerId: string,
    userId: string,
    supabase: SupabaseClient,
  ): Promise<{ text: string; audioUrl?: string }> {
    const provider = getAIProvider(providerId);
    const coachMemory = await buildCoachMemoryContext(userId, supabase);
    const text = await provider.generateGreeting(coachMemory);

    let audioUrl: string | undefined;
    try {
      const voiceProvider = getVoiceProvider();
      audioUrl = await voiceProvider.synthesizeSpeech(text);

      after(async () => {
        try {
          const admin = createAdminClient();
          await admin.from("usage_logs").insert({
            user_id: userId,
            session_turn_id: null,
            provider: "gemini",
            model: provider.id,
          });
        } catch (err) {
          console.error("[ChatService] failed to log greeting usage:", err);
        }
      });
    } catch (err) {
      console.warn("[ChatService] greeting voice synthesis failed:", err);
    }

    return { text, audioUrl };
  }

  /**
   * 分析一段 Live API 即時對話的完整逐字稿，抓出改進點，寫進 session_turns
   * （用 turn_index 0，代表整段對話當作一輪紀錄，跟其他模式「一輪語音互動一筆」
   * 的資料結構不完全一樣，但欄位格式共用，之後串歷史紀錄可以一起顯示）。
   */
  async analyzeLiveConversation(
    providerId: string,
    transcript: string,
    meta: { userId: string; sessionId: string },
    supabase: SupabaseClient,
  ): Promise<ConversationAnalysis> {
    const provider = getAIProvider(providerId);
    const analysis = await provider.analyzeConversation(transcript);

    after(async () => {
      const { data: turnRow, error: turnError } = await supabase
        .from("session_turns")
        .insert({
          session_id: meta.sessionId,
          turn_index: 0,
          transcript,
          grammar_feedback: analysis.improvementPoints,
          ai_reply_text: analysis.summary,
        })
        .select("id")
        .single();

      if (turnError) {
        console.error("[ChatService] failed to write session_turns (live_chat):", turnError);
      }

      try {
        const admin = createAdminClient();
        const { error: usageError } = await admin.from("usage_logs").insert({
          user_id: meta.userId,
          session_turn_id: turnRow?.id ?? null,
          provider: provider.id.startsWith("gemini") ? "gemini" : "openai",
          model: provider.id,
        });
        if (usageError) {
          console.error("[ChatService] failed to write usage_logs (live_chat):", usageError);
        }
      } catch (err) {
        console.error("[ChatService] admin client unavailable, skipping usage_logs:", err);
      }
    });

    return analysis;
  }

  async textToSpeech(text: string): Promise<string> {
    const voiceProvider = getVoiceProvider();
    return voiceProvider.synthesizeSpeech(text);
  }

  /**
   * 把中文故事拆解成 STAR + 關鍵字 + 英文最佳答案。
   * 這裡不寫 session_turns（那張表是給「一輪語音互動」用的，Story 拆解不是語音互動），
   * 但一樣要記 usage_logs，因為這也是一次真金白銀的 AI API 呼叫，成本追蹤不能有漏網之魚。
   */
  async decomposeStory(
    providerId: string,
    storyTextZh: string,
    userId: string,
  ): Promise<StoryDecomposition> {
    const provider = getAIProvider(providerId);
    const result = await provider.decomposeStory(storyTextZh);

    after(async () => {
      try {
        const admin = createAdminClient();
        // 注意：這裡的 model 欄位記的是 provider.id（使用者選擇的「對話用」模型層級），
        // 不是 decomposeStory 內部實際用的型號（GeminiProvider 內部固定用 Pro 層級）。
        // 這是已知的不精確之處，如果之後要精算「Pro 呼叫」的實際成本，
        // 需要讓 Provider 的方法回傳實際用的 model 字串，這裡先不做這個工程。
        const { error: usageError } = await admin.from("usage_logs").insert({
          user_id: userId,
          session_turn_id: null,
          provider: provider.id.startsWith("gemini") ? "gemini" : "openai",
          model: provider.id,
        });
        if (usageError) {
          console.error("[ChatService] failed to write usage_logs (decomposeStory):", usageError);
        }
      } catch (err) {
        console.error("[ChatService] admin client unavailable, skipping usage_logs:", err);
      }
    });

    return result;
  }
}

/** 單例，供 API Route 直接 import 使用 */
export const chatService = new ChatService();
