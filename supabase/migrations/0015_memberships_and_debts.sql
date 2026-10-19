-- ============================================================
-- FASE 15: Membresías (HikCentral Sync) y Deudas de Tienda (Box POS)
-- Ejecutar en Supabase Studio SQL Editor
-- ============================================================

-- 1) Role y Documento de Identidad en profiles
alter table public.profiles
  add column if not exists role text check (role in ('athlete', 'coach', 'admin')) default 'athlete',
  add column if not exists document_id text;

-- Índice único en document_id para mapeo instantáneo con HikCentral
create unique index if not exists profiles_document_id_idx
  on public.profiles(document_id)
  where document_id is not null and document_id <> '';

-- Función utilitaria de seguridad para chequear si un usuario es staff/admin
create or replace function public.is_staff(check_uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = check_uid and role in ('coach', 'admin')
  );
$$;

-- 2) Recrear athlete_directory para exponer role, document_id y avatar_url
-- NOTA: Las nuevas columnas se agregan al final para preservar el orden original
-- de columnas (1..9) y evitar el error Postgres 42P16 al usar CREATE OR REPLACE VIEW.
create or replace view public.athlete_directory as
select
  p.id,
  p.display_name,
  p.first_name,
  p.last_name,
  concat_ws(' ', p.first_name, p.last_name) as full_name,
  p.box_name,
  p.discipline,
  p.avatar_url,
  p.created_at,
  p.role,
  p.document_id
from public.profiles p;

grant select on public.athlete_directory to authenticated;

-- 3) TABLA DE MEMBRESÍAS (Sincronizada con HikCentral Access Control)
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  document_id text not null,
  plan_name text not null default 'Mensualidad Box',
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  status text not null check (status in ('active', 'expiring_soon', 'overdue', 'inactive')) default 'active',
  access_granted boolean not null default true,
  hikvision_person_id text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_document_id_idx on public.memberships(document_id);
create index if not exists memberships_end_date_idx on public.memberships(end_date);
create index if not exists memberships_status_idx on public.memberships(status);

alter table public.memberships enable row level security;

-- Policies para memberships
drop policy if exists "Athletes read own membership" on public.memberships;
create policy "Athletes read own membership"
  on public.memberships for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and document_id is not null and document_id = memberships.document_id
    )
    or public.is_staff(auth.uid())
  );

drop policy if exists "Staff insert memberships" on public.memberships;
create policy "Staff insert memberships"
  on public.memberships for insert
  with check (public.is_staff(auth.uid()));

drop policy if exists "Staff update memberships" on public.memberships;
create policy "Staff update memberships"
  on public.memberships for update
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "Staff delete memberships" on public.memberships;
create policy "Staff delete memberships"
  on public.memberships for delete
  using (public.is_staff(auth.uid()));

-- Trigger para updated_at en memberships
drop trigger if exists memberships_updated_at on public.memberships;
create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.handle_updated_at();

-- 4) TABLA DE DEUDAS (Implementos, Suplementos, Bebidas, etc.)
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept text not null,
  category text not null check (category in ('supplement', 'equipment', 'membership_balance', 'beverage', 'other')) default 'other',
  amount numeric(12,2) not null check (amount > 0),
  balance numeric(12,2) not null check (balance >= 0),
  status text not null check (status in ('pending', 'partial', 'paid', 'cancelled')) default 'pending',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists debts_status_idx on public.debts(status);
create index if not exists debts_created_at_idx on public.debts(created_at desc);

alter table public.debts enable row level security;

-- Policies para debts
drop policy if exists "Athletes read own debts" on public.debts;
create policy "Athletes read own debts"
  on public.debts for select
  using (
    auth.uid() = user_id
    or public.is_staff(auth.uid())
  );

drop policy if exists "Staff insert debts" on public.debts;
create policy "Staff insert debts"
  on public.debts for insert
  with check (public.is_staff(auth.uid()));

drop policy if exists "Staff update debts" on public.debts;
create policy "Staff update debts"
  on public.debts for update
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "Staff delete debts" on public.debts;
create policy "Staff delete debts"
  on public.debts for delete
  using (public.is_staff(auth.uid()));

-- Trigger para updated_at en debts
drop trigger if exists debts_updated_at on public.debts;
create trigger debts_updated_at
  before update on public.debts
  for each row execute function public.handle_updated_at();

-- 5) TABLA DE ABONOS / PAGOS PRESENCIALES
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'nequi', 'daviplata', 'card', 'transfer')) default 'cash',
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_debt_id_idx on public.debt_payments(debt_id);
create index if not exists debt_payments_user_id_idx on public.debt_payments(user_id);

alter table public.debt_payments enable row level security;

-- Policies para debt_payments
drop policy if exists "Athletes read own payments" on public.debt_payments;
create policy "Athletes read own payments"
  on public.debt_payments for select
  using (
    auth.uid() = user_id
    or public.is_staff(auth.uid())
  );

drop policy if exists "Staff insert debt payments" on public.debt_payments;
create policy "Staff insert debt payments"
  on public.debt_payments for insert
  with check (public.is_staff(auth.uid()));

-- Trigger automático para liquidar y actualizar saldo en debts al registrar un abono
create or replace function public.process_debt_payment()
returns trigger
language plpgsql
security definer
as $$
declare
  v_current_balance numeric(12,2);
  v_new_balance numeric(12,2);
begin
  select balance into v_current_balance
  from public.debts
  where id = new.debt_id;

  if v_current_balance is null then
    raise exception 'Deuda no encontrada';
  end if;

  v_new_balance := greatest(0, v_current_balance - new.amount);

  update public.debts
  set
    balance = v_new_balance,
    status = case
      when v_new_balance <= 0 then 'paid'
      else 'partial'
    end,
    updated_at = now()
  where id = new.debt_id;

  return new;
end;
$$;

drop trigger if exists trigger_process_debt_payment on public.debt_payments;
create trigger trigger_process_debt_payment
  after insert on public.debt_payments
  for each row execute function public.process_debt_payment();

-- 6) Realtime subscriptions para memberships y debts
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memberships'
  ) then
    alter publication supabase_realtime add table public.memberships;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'debts'
  ) then
    alter publication supabase_realtime add table public.debts;
  end if;
end;
$$;
