-- ============================================================================
-- 0005: usage_logs
-- ============================================================================
-- AI 呼叫的成本追蹤，架構起始就要有，避免雙模型（Gemini/GPT-5.5）的成本失控。
-- 這張表主要由後端（ChatService／API Route，用 service role 或使用者自己的 session）寫入，
-- 使用者可以讀自己的紀錄（例如未來做「本月使用量」的畫面）。

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_turn_id uuid references public.session_turns (id) on delete set null,
  provider text not null check (provider in ('gemini', 'openai')),
  model text,
  estimated_tokens integer,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now()
);

comment on table public.usage_logs is 'AI 呼叫成本追蹤，用於監控雙模型的實際花費';

create index if not exists usage_logs_user_id_idx
  on public.usage_logs (user_id);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.usage_logs enable row level security;

-- 使用者只能讀自己的用量紀錄，不能自己新增／修改／刪除
-- （寫入這張表的邏輯完全在 ChatService／Edge Function 端執行，用 service role key，
--  可以繞過 RLS；一般使用者的 anon/authenticated session 沒有寫入權限，
--  避免使用者自己竄改用量紀錄）。

create policy "usage_logs_select_own"
  on public.usage_logs for select
  using (auth.uid() = user_id);
