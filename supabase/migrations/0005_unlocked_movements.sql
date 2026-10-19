-- FASE 6: Skills (movimientos desbloqueados)
-- Ejecutar en Supabase Studio SQL Editor

create table if not exists public.unlocked_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement text not null,
  category text not null check (category in ('strength', 'olympic', 'gymnastic', 'monostructural', 'accessory')),
  unlocked_at timestamptz not null default now(),
  unique(user_id, movement)
);

create index if not exists unlocked_movements_user_id_idx on public.unlocked_movements(user_id);
create index if not exists unlocked_movements_user_category_idx on public.unlocked_movements(user_id, category);

alter table public.unlocked_movements enable row level security;

drop policy if exists "Users read own unlocked_movements" on public.unlocked_movements;
create policy "Users read own unlocked_movements"
  on public.unlocked_movements for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own unlocked_movements" on public.unlocked_movements;
create policy "Users insert own unlocked_movements"
  on public.unlocked_movements for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own unlocked_movements" on public.unlocked_movements;
create policy "Users delete own unlocked_movements"
  on public.unlocked_movements for delete
  using (auth.uid() = user_id);
