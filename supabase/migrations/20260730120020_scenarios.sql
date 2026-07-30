-- ============================================================================
-- 0002: scenarios
-- ============================================================================
-- 情境任務內容（點餐、面試等），屬於「公開內容」，所有登入使用者皆可讀取，
-- 但不開放前端使用者新增／修改／刪除 —— 內容由後台／管理端維護
-- （目前階段可直接在 Supabase Studio 手動新增，或用 service role key 寫入）。

create table if not exists public.scenarios (
  id text primary key,
  title text not null,
  description text,
  ai_role_prompt text not null,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now()
);

comment on table public.scenarios is '情境任務內容，公開唯讀，僅供 scenario 練習模式使用';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.scenarios enable row level security;

-- 任何已登入使用者都能讀取情境內容
create policy "scenarios_select_authenticated"
  on public.scenarios for select
  to authenticated
  using (true);

-- 沒有 insert / update / delete policy給一般使用者：
-- 一般使用者（anon / authenticated）皆無法寫入，只有 service role（會繞過 RLS）能維護內容。
