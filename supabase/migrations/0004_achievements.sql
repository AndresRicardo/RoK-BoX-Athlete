-- FASE 5: Logros / Achievements
-- Ejecutar en Supabase Studio SQL Editor

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_id)
);

create index if not exists achievements_user_id_idx on public.achievements(user_id);

alter table public.achievements enable row level security;

drop policy if exists "Users read own achievements" on public.achievements;
create policy "Users read own achievements"
  on public.achievements for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own achievements" on public.achievements;
create policy "Users insert own achievements"
  on public.achievements for insert
  with check (auth.uid() = user_id);
