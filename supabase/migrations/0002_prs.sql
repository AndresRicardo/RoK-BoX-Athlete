-- FASE 3: PRs (Personal Records)
-- Ejecutar en Supabase Studio SQL Editor

create table if not exists public.prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement text not null,
  type text not null check (type in ('strength', 'benchmark', 'reps')),
  value_numeric numeric(8,2) not null check (value_numeric > 0),
  achieved_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  constraint prs_achieved_at_not_future check (achieved_at <= current_date)
);

create index if not exists prs_user_id_idx on public.prs(user_id);
create index if not exists prs_user_movement_idx on public.prs(user_id, movement);
create index if not exists prs_user_type_idx on public.prs(user_id, type);

alter table public.prs enable row level security;

drop policy if exists "Users read own prs" on public.prs;
create policy "Users read own prs"
  on public.prs for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own prs" on public.prs;
create policy "Users insert own prs"
  on public.prs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own prs" on public.prs;
create policy "Users delete own prs"
  on public.prs for delete
  using (auth.uid() = user_id);
