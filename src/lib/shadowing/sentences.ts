export interface ShadowingSentence {
  id: string;
  text: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
}

/**
 * MVP 階段的跟讀句庫，先寫死在程式碼裡。
 *
 * 之後如果需要：
 *   - 依使用者程度動態出題
 *   - 後台可以自己新增句子而不用重新部署
 * 再把這個檔案抽換成從 Supabase 的資料表讀取（作法跟 scenarios 一樣），
 * 目前這樣做不用多一張表、不用寫 admin 介面，維護成本最低。
 */
export const SHADOWING_SENTENCES: ShadowingSentence[] = [
  {
    id: "s001",
    text: "I would like to order a large coffee, please.",
    difficulty: "beginner",
    category: "cafe",
  },
  {
    id: "s002",
    text: "Could you tell me how to get to the nearest train station?",
    difficulty: "beginner",
    category: "travel",
  },
  {
    id: "s003",
    text: "I'm really looking forward to working with your team.",
    difficulty: "beginner",
    category: "work",
  },
  {
    id: "s004",
    text: "I've been living in this city for about three years now.",
    difficulty: "intermediate",
    category: "daily",
  },
  {
    id: "s005",
    text: "Would it be possible to reschedule our meeting to next Thursday?",
    difficulty: "intermediate",
    category: "work",
  },
  {
    id: "s006",
    text: "I think the biggest challenge is finding a good work-life balance.",
    difficulty: "intermediate",
    category: "daily",
  },
  {
    id: "s007",
    text: "Despite the heavy rain, we decided to go ahead with the trip.",
    difficulty: "advanced",
    category: "travel",
  },
  {
    id: "s008",
    text: "I appreciate your feedback, but I'd like to offer a different perspective.",
    difficulty: "advanced",
    category: "work",
  },
  {
    id: "s009",
    text: "Can you recommend a good restaurant that's not too far from here?",
    difficulty: "beginner",
    category: "travel",
  },
  {
    id: "s010",
    text: "I was wondering if you could help me understand this contract better.",
    difficulty: "intermediate",
    category: "work",
  },
];

export function getRandomSentence(excludeId?: string): ShadowingSentence {
  const pool = excludeId
    ? SHADOWING_SENTENCES.filter((s) => s.id !== excludeId)
    : SHADOWING_SENTENCES;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}
