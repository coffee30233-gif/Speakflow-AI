-- ============================================================================
-- 0010: stories（Mind Map Recall B-1）
-- ============================================================================
-- 使用者用中文寫下的個人故事，AI 拆解成 STAR + 關鍵字 + 英文最佳答案。
-- 這張表目前是獨立的（不 FK 到任何 Mind Map / Question），
-- 因為 B-1 階段先讓使用者能建立故事庫，Question ↔ Story ↔ Mind Map
-- 的關聯要等 B-2/B-4 才會加上（新增 interview_questions / mind_maps 時）。

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  content_zh text not null,
  content_en text,
  star_situation text,
  star_task text,
  star_action text,
  star_result text,
  keywords text[],
  best_answer_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stories is
  '使用者的個人故事（中文原始素材），AI 拆解出 STAR／關鍵字／英文最佳答案，供 Mind Map 使用';

create index if not exists stories_user_id_idx on public.stories (user_id);
create index if not exists stories_user_id_created_at_idx on public.stories (user_id, created_at desc);

-- updated_at 自動更新，沿用 0001 建立的共用 trigger function
drop trigger if exists set_stories_updated_at on public.stories;
create trigger set_stories_updated_at
  before update on public.stories
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stories enable row level security;

create policy "stories_select_own"
  on public.stories for select
  using (auth.uid() = user_id);

create policy "stories_insert_own"
  on public.stories for insert
  with check (auth.uid() = user_id);

create policy "stories_update_own"
  on public.stories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "stories_delete_own"
  on public.stories for delete
  using (auth.uid() = user_id);
