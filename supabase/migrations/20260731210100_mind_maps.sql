-- ============================================================================
-- 0012: mind_maps（Mind Map Recall B-2）
-- ============================================================================
-- 一個使用者、一個問題，一份 Mind Map（React Flow 節點/邊格式）。
-- 從 story 的 STAR 拆解規則式產生，不是另外呼叫 AI 生成。

create table if not exists public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.interview_questions (id) on delete cascade,
  story_id uuid references public.stories (id) on delete set null,
  react_flow_data jsonb not null,      -- { nodes: [...], edges: [...] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, question_id)
);

comment on table public.mind_maps is
  'React Flow 格式的心智圖資料，從 stories 的 STAR 拆解規則式產生';

create index if not exists mind_maps_user_id_idx on public.mind_maps (user_id);

drop trigger if exists set_mind_maps_updated_at on public.mind_maps;
create trigger set_mind_maps_updated_at
  before update on public.mind_maps
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.mind_maps enable row level security;

create policy "mind_maps_select_own"
  on public.mind_maps for select
  using (auth.uid() = user_id);

create policy "mind_maps_insert_own"
  on public.mind_maps for insert
  with check (auth.uid() = user_id);

create policy "mind_maps_update_own"
  on public.mind_maps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "mind_maps_delete_own"
  on public.mind_maps for delete
  using (auth.uid() = user_id);
