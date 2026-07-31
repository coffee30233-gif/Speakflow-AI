import { z } from "zod";

/**
 * 對應 SpeechProcessResult 的 Zod schema。
 * 所有 Provider 從 LLM 拿到 JSON 字串後，都必須經過這個 schema 驗證，
 * 才能回傳給 ChatService。這樣即使模型偶爾吐出不完全符合預期的 JSON，
 * 我們也能在 Provider 內部就攔截錯誤，而不是讓壞資料流到 UI。
 */
export const grammarFeedbackItemSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  reason: z.string(),
});

/** 對應 InterviewEvaluation，只有 interview 模式會用到 */
export const interviewEvaluationSchema = z.object({
  technicalDepth: z.number().min(0).max(100).optional(),
  starStructure: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
  engineeringThinking: z.number().min(0).max(100).optional(),
});

export const speechProcessResultSchema = z.object({
  transcript: z.string(),
  pronunciationScore: z.number().min(0).max(100).optional(),
  grammarFeedback: z.array(grammarFeedbackItemSchema).optional(),
  aiReplyText: z.string(),
  interviewEvaluation: interviewEvaluationSchema.optional(),
  recallEvaluation: z
    .object({
      completeness: z.number().min(0).max(100),
      confidence: z.number().min(0).max(100),
    })
    .optional(),
});

/** 對應 StoryDecomposition */
export const storyDecompositionSchema = z.object({
  contentEn: z.string(),
  starSituation: z.string(),
  starTask: z.string(),
  starAction: z.string(),
  starResult: z.string(),
  keywords: z.array(z.string()).min(1),
  bestAnswerEn: z.string(),
});
