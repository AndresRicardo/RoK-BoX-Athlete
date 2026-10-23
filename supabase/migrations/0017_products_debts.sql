-- 0017_products_debts.sql
-- Catálogo de productos (D13), deudas de atletas con ítems y abonos (D12, D14),
-- y la vista membership_status (necesita los saldos de deuda).

-- =====================================================================
-- 1. CATÁLOGO
-- =====================================================================
create table public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  category   text not null default 'store' check (category in ('store', 'equipment', 'other')),
  price      numeric(12,2) not null check (price >= 0),
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

create policy "products: autenticados leen"
  on public.products for select to authenticated using (true);
create policy "products: socio inserta"
  on public.products for insert to authenticated with check ((select private.is_partner()));
create policy "products: socio actualiza"
  on public.products for update to authenticated
  using ((select private.is_partner())) with check ((select private.is_partner()));

-- =====================================================================
-- 2. DEUDAS
-- =====================================================================
create table public.debts (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete restrict,
  concept      text not null,
  total_amount numeric(12,2) not null default 0,
  paid_amount  numeric(12,2) not null default 0,
  balance      numeric(12,2) generated always as (greatest(total_amount - paid_amount, 0)) stored,
  voided_at    timestamptz,
  voided_by    uuid references auth.users(id) on delete set null,
  void_reason  text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.debts enable row level security;

create index debts_member_idx on public.debts (member_id, created_at desc);
create index debts_open_idx on public.debts (member_id) where voided_at is null;

create trigger debts_updated_at
  before update on public.debts
  for each row execute function public.handle_updated_at();

create policy "debts: propias o staff"
  on public.debts for select to authenticated
  using (member_id = (select private.my_member_id()) or (select private.is_staff()));

create policy "debts: staff actualiza"
  on public.debts for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Inserción por RPC create_debt (cabecera + ítems atómicos).

create table public.debt_items (
  id              uuid primary key default gen_random_uuid(),
  debt_id         uuid not null references public.debts(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  quantity        int not null default 1 check (quantity > 0),
  unit_price      numeric(12,2) not null check (unit_price >= 0),
  subtotal        numeric(12,2) generated always as (quantity * unit_price) stored,
  delivery_status text not null default 'delivered' check (delivery_status in ('delivered', 'pending', 'returned')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

alter table public.debt_items enable row level security;

create index debt_items_debt_idx on public.debt_items (debt_id);
create index debt_items_product_idx on public.debt_items (product_id);

create trigger debt_items_updated_at
  before update on public.debt_items
  for each row execute function public.handle_updated_at();

create policy "debt_items: propias o staff"
  on public.debt_items for select to authenticated
  using (
    (select private.is_staff())
    or exists (select 1 from public.debts d
               where d.id = debt_items.debt_id and d.member_id = (select private.my_member_id()))
  );
create policy "debt_items: staff inserta"
  on public.debt_items for insert to authenticated with check ((select private.is_staff()));
create policy "debt_items: staff actualiza"
  on public.debt_items for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
-- Sin DELETE: el borrado es lógico (deleted_at) y queda auditado (E13).

create table public.debt_payments (
  id                  uuid primary key default gen_random_uuid(),
  debt_id             uuid not null references public.debts(id) on delete cascade,
  amount              numeric(12,2) not null check (amount > 0),
  payment_method      public.payment_method not null,
  received_by_partner uuid not null references public.partners(id) on delete restrict,
  collected_by        uuid references auth.users(id) on delete set null default auth.uid(),
  note                text,
  paid_at             timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

alter table public.debt_payments enable row level security;

create index debt_payments_debt_idx on public.debt_payments (debt_id);
create index debt_payments_partner_idx on public.debt_payments (received_by_partner);

create trigger debt_payments_updated_at
  before update on public.debt_payments
  for each row execute function public.handle_updated_at();

create policy "debt_payments: propias o staff"
  on public.debt_payments for select to authenticated
  using (
    (select private.is_staff())
    or exists (select 1 from public.debts d
               where d.id = debt_payments.debt_id and d.member_id = (select private.my_member_id()))
  );
create policy "debt_payments: staff inserta"
  on public.debt_payments for insert to authenticated with check ((select private.is_staff()));
create policy "debt_payments: staff actualiza"
  on public.debt_payments for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- =====================================================================
-- 3. TRIGGERS: validación y recálculo de totales
-- =====================================================================
create or replace function private.validate_debt_payment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_debt    public.debts;
  v_paid    numeric(12,2);
begin
  select * into v_debt from public.debts where id = new.debt_id for update;
  if v_debt.voided_at is not null then
    raise exception 'La deuda está anulada' using errcode = '22023';
  end if;
  if new.deleted_at is null then
    perform private.assert_receiving_partner(new.received_by_partner);
    select coalesce(sum(amount), 0) into v_paid
    from public.debt_payments
    where debt_id = new.debt_id and deleted_at is null and id <> new.id;
    if v_paid + new.amount > v_debt.total_amount then
      raise exception 'El abono supera el saldo pendiente (%)', v_debt.total_amount - v_paid
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger debt_payments_validate
  before insert or update on public.debt_payments
  for each row execute function private.validate_debt_payment();

create or replace function private.recalculate_debt_totals()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_debt_id uuid := coalesce(new.debt_id, old.debt_id);
begin
  update public.debts set
    total_amount = coalesce((select sum(subtotal) from public.debt_items
                             where debt_id = v_debt_id and deleted_at is null), 0),
    paid_amount  = coalesce((select sum(amount) from public.debt_payments
                             where debt_id = v_debt_id and deleted_at is null), 0)
  where id = v_debt_id;
  return null;
end;
$$;

create trigger debt_items_recalculate
  after insert or update or delete on public.debt_items
  for each row execute function private.recalculate_debt_totals();

create trigger debt_payments_recalculate
  after insert or update or delete on public.debt_payments
  for each row execute function private.recalculate_debt_totals();

-- =====================================================================
-- 4. RPCs
-- =====================================================================
-- p_items: [{product_id?, name?, quantity, unit_price?, delivery_status?, note?}]
-- Si viene product_id sin nombre/precio, se toman del catálogo.
create or replace function public.create_debt(p_member_id uuid, p_concept text, p_items jsonb)
returns public.debts
language plpgsql security definer set search_path = ''
as $$
declare
  v_debt public.debts;
  v_item jsonb;
  v_prod public.products;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'Miembro no encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La deuda debe tener al menos un ítem' using errcode = '22023';
  end if;

  insert into public.debts (member_id, concept, created_by)
  values (p_member_id, coalesce(nullif(trim(p_concept), ''), 'Consumo'), auth.uid())
  returning id into v_debt.id;

  -- Un solo aviso al atleta por la deuda completa, no uno por ítem (ver 0020).
  perform set_config('rokbox.suppress_debt_notify', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_prod := null;
    if nullif(v_item->>'product_id', '') is not null then
      select * into v_prod from public.products where id = (v_item->>'product_id')::uuid;
      if not found then
        raise exception 'Producto no encontrado' using errcode = 'P0002';
      end if;
    end if;
    insert into public.debt_items (debt_id, product_id, name, quantity, unit_price, delivery_status, note)
    values (
      v_debt.id,
      v_prod.id,
      coalesce(nullif(trim(v_item->>'name'), ''), v_prod.name),
      coalesce((v_item->>'quantity')::int, 1),
      coalesce((v_item->>'unit_price')::numeric, v_prod.price),
      coalesce(v_item->>'delivery_status', 'delivered'),
      v_item->>'note'
    );
  end loop;

  perform set_config('rokbox.suppress_debt_notify', 'off', true);
  select * into v_debt from public.debts where id = v_debt.id;
  perform private.notify_debt_created(v_debt.id);
  return v_debt;
end;
$$;

create or replace function public.void_debt(p_debt_id uuid, p_reason text)
returns public.debts
language plpgsql security definer set search_path = ''
as $$
declare
  v_debt public.debts;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Indica el motivo' using errcode = '22023';
  end if;
  if exists (select 1 from public.debt_payments where debt_id = p_debt_id and deleted_at is null) then
    raise exception 'La deuda tiene abonos: elimínalos antes de anularla' using errcode = '22023';
  end if;

  update public.debts set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_debt_id and voided_at is null
  returning * into v_debt;
  if not found then
    raise exception 'Deuda no encontrada o ya anulada' using errcode = 'P0002';
  end if;
  return v_debt;
end;
$$;

revoke all on function public.create_debt(uuid, text, jsonb) from public, anon;
revoke all on function public.void_debt(uuid, text) from public, anon;
grant execute on function public.create_debt(uuid, text, jsonb) to authenticated;
grant execute on function public.void_debt(uuid, text) to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- =====================================================================
-- 5. VISTAS
-- =====================================================================
create view public.debt_summary with (security_invoker = true) as
select
  d.*,
  m.full_name as member_name,
  case
    when d.voided_at is not null              then 'voided'
    when d.total_amount > 0 and d.balance = 0 then 'paid'
    when d.paid_amount > 0                    then 'partial'
    else 'pending'
  end as status
from public.debts d
join public.members m on m.id = d.member_id;

create view public.membership_status with (security_invoker = true) as
select
  m.id as member_id,
  m.full_name,
  m.document_id,
  m.phone,
  m.email,
  m.profile_id,
  m.hik_person_id,
  m.is_active,
  m.source,
  ms.plan_id,
  coalesce(ms.plan_name, 'Sin plan') as plan_name,
  ms.plan_kind,
  ms.valid_from,
  ms.valid_until,
  coalesce(ms.access_enabled, true) as access_enabled,
  ms.classes_total,
  coalesce(ms.classes_used, 0) as classes_used,
  case when ms.classes_total is not null then greatest(ms.classes_total - ms.classes_used, 0) end as classes_left,
  ms.hik_synced_at,
  ms.last_change_origin,
  case
    when ms.valid_until is null                                         then 'no_membership'
    when not ms.access_enabled                                          then 'disabled'
    when ms.valid_until < now()                                         then 'overdue'
    when ms.classes_total is not null and ms.classes_used >= ms.classes_total then 'no_classes'
    when ms.valid_until < now() + interval '3 days'                     then 'expiring_soon'
    else 'active'
  end as status,
  case when ms.valid_until is not null
       then ((ms.valid_until at time zone 'America/Bogota')::date
             - (now() at time zone 'America/Bogota')::date)
  end as days_left,
  coalesce((select sum(d.balance) from public.debts d
            where d.member_id = m.id and d.voided_at is null), 0) as debt_balance,
  exists (select 1 from public.membership_renewals r
          where r.member_id = m.id and r.payment_status = 'pending' and r.voided_at is null) as has_pending_payment,
  exists (select 1 from public.access_commands c
          where c.member_id = m.id and c.status in ('pending', 'processing')) as hik_sync_pending
from public.members m
left join public.memberships ms on ms.member_id = m.id;

grant select on public.debt_summary to authenticated;
grant select on public.membership_status to authenticated;
