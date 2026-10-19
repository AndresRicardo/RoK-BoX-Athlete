-- FASE 4: Benchmarks historicos (WODs)
-- Ejecutar en Supabase Studio SQL Editor

create table if not exists public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('for_time', 'amrap', 'emom', 'max')),
  result_value numeric(8,2) not null check (result_value > 0),
  result_unit text not null check (result_unit in ('time_seconds', 'reps', 'rounds_reps')),
  scaling text check (scaling in ('rx', 'scaled', 'masters')) default 'rx',
  performed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  constraint benchmarks_performed_at_not_future check (performed_at <= current_date)
);

create index if not exists benchmarks_user_id_idx on public.benchmarks(user_id);
create index if not exists benchmarks_user_name_idx on public.benchmarks(user_id, name);
create index if not exists benchmarks_user_type_idx on public.benchmarks(user_id, type);

alter table public.benchmarks enable row level security;

drop policy if exists "Users read own benchmarks" on public.benchmarks;
create policy "Users read own benchmarks"
  on public.benchmarks for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own benchmarks" on public.benchmarks;
create policy "Users insert own benchmarks"
  on public.benchmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own benchmarks" on public.benchmarks;
create policy "Users delete own benchmarks"
  on public.benchmarks for delete
  using (auth.uid() = user_id);
