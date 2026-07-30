-- ============================================================================
-- 0001: profiles
-- ============================================================================
-- 延伸 auth.users，存放使用者的應用層資料。
-- id 直接沿用 auth.users.id，一對一關係。

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  learning_goal text check (learning_goal in ('travel', 'interview', 'daily_fluency', 'business')),
  preferred_ai_model text not null default 'gemini-2.5-flash'
    check (preferred_ai_model in ('gemini-2.5-flash', 'gpt-5.5')),
  streak_count integer not null default 0,
  last_practice_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '延伸 auth.users 的應用層使用者資料，id 與 auth.users.id 一對一對應';

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- 使用者在 Supabase Auth 註冊成功後，自動建立對應的 profiles 資料列
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 不開放 insert / delete policy：
-- insert 一律透過 handle_new_user() trigger（security definer）自動建立，
-- delete 交由 auth.users 的 cascade 處理（使用者刪除帳號時一併清除）。
