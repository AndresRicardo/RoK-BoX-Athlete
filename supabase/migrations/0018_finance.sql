-- 0018_finance.sql
-- Caja de cada socio: gastos (BOX / PERSONAL), ingresos (manuales, ventas y automáticos),
-- entregas entre socios y cuadres con la fórmula de Spent (D7–D11, D22, D30).

-- =====================================================================
-- 1. CATEGORÍAS DE GASTO
-- =====================================================================
create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  icon_emoji  text not null default '💸',
  color_hex   text not null default '#64748B' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order  int not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.expense_categories enable row level security;

create trigger expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.handle_updated_at();

create policy "expense_categories: socio lee"
  on public.expense_categories for select to authenticated using ((select private.is_partner()));
create policy "expense_categories: socio inserta"
  on public.expense_categories for insert to authenticated with check ((select private.is_partner()));
create policy "expense_categories: socio actualiza"
  on public.expense_categories for update to authenticated
  using ((select private.is_partner())) with check ((select private.is_partner()));

-- =====================================================================
-- 2. GASTOS
-- =====================================================================
create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete restrict,
  category_id    uuid references public.expense_categories(id) on delete set null,
  scope          text not null check (scope in ('BOX', 'PERSONAL')),
  amount         numeric(12,2) not null check (amount > 0),
  title          text not null check (length(trim(title)) > 0),
  note           text,
  payment_method public.payment_method not null default 'cash',
  spent_at       timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

alter table public.expenses enable row level security;

create index expenses_partner_spent_idx on public.expenses (partner_id, spent_at);
create index expenses_spent_idx on public.expenses (spent_at) where deleted_at is null;
create index expenses_category_idx on public.expenses (category_id);

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.handle_updated_at();

-- Todos los socios ven todo; cada uno escribe solo lo suyo (D22, E1). Borrado lógico.
create policy "expenses: socio lee"
  on public.expenses for select to authenticated using ((select private.is_partner()));
create policy "expenses: socio inserta los propios"
  on public.expenses for insert to authenticated
  with check (partner_id = (select private.current_partner_id()));
create policy "expenses: socio edita los propios"
  on public.expenses for update to authenticated
  using (partner_id = (select private.current_partner_id()))
  with check (partner_id = (select private.current_partner_id()));

-- =====================================================================
-- 3. INGRESOS
-- =====================================================================
create table public.incomes (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  concept        text not null,
  source         text not null default 'manual'
                 check (source in ('manual', 'sale', 'membership', 'debt_payment')),
  source_ref     uuid,
  product_id     uuid references public.products(id) on delete set null,
  quantity       int check (quantity > 0),
  payment_method public.payment_method not null default 'cash',
  note           text,
  received_at    timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint incomes_source_ref check ((source in ('membership', 'debt_payment')) = (source_ref is not null))
);

alter table public.incomes enable row level security;

create unique index incomes_source_ref_uidx on public.incomes (source, source_ref) where source_ref is not null;
create index incomes_partner_received_idx on public.incomes (partner_id, received_at);
create index incomes_received_idx on public.incomes (received_at) where deleted_at is null;
create index incomes_product_idx on public.incomes (product_id);

create trigger incomes_updated_at
  before update on public.incomes
  for each row execute function public.handle_updated_at();

create policy "incomes: socio lee"
  on public.incomes for select to authenticated using ((select private.is_partner()));
-- Los ingresos automáticos se editan desde su origen (renovación o abono), no aquí.
create policy "incomes: socio inserta manuales propios"
  on public.incomes for insert to authenticated
  with check (partner_id = (select private.current_partner_id()) and source in ('manual', 'sale'));
create policy "incomes: socio edita manuales propios"
  on public.incomes for update to authenticated
  using (partner_id = (select private.current_partner_id()) and source in ('manual', 'sale'))
  with check (partner_id = (select private.current_partner_id()) and source in ('manual', 'sale'));

-- =====================================================================
-- 4. ENTREGAS DE DINERO ENTRE SOCIOS (E11)
-- =====================================================================
-- settlement_id no nulo = pago de una transferencia de un cuadre: NO cuenta como
-- movimiento de caja del periodo siguiente.
create table public.partner_transfers (
  id               uuid primary key default gen_random_uuid(),
  from_partner     uuid not null references public.partners(id) on delete restrict,
  to_partner       uuid not null references public.partners(id) on delete restrict,
  amount           numeric(12,2) not null check (amount > 0),
  transferred_at   timestamptz not null default now(),
  note             text,
  settlement_id    uuid,
  settlement_index int,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint partner_transfers_distinct check (from_partner <> to_partner)
);

alter table public.partner_transfers enable row level security;

create index partner_transfers_from_idx on public.partner_transfers (from_partner, transferred_at);
create index partner_transfers_to_idx on public.partner_transfers (to_partner, transferred_at);
create index partner_transfers_settlement_idx on public.partner_transfers (settlement_id);

create trigger partner_transfers_updated_at
  before update on public.partner_transfers
  for each row execute function public.handle_updated_at();

create policy "partner_transfers: socio lee"
  on public.partner_transfers for select to authenticated using ((select private.is_partner()));
create policy "partner_transfers: quien entrega inserta"
  on public.partner_transfers for insert to authenticated
  with check (from_partner = (select private.current_partner_id()) and settlement_id is null);
create policy "partner_transfers: quien entrega edita"
  on public.partner_transfers for update to authenticated
  using (from_partner = (select private.current_partner_id()) and settlement_id is null)
  with check (from_partner = (select private.current_partner_id()) and settlement_id is null);

-- =====================================================================
-- 5. CUADRES (foto inmutable, D9)
-- =====================================================================
create table public.settlements (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  period_start      date not null,
  period_end        date not null,
  reserve_fund      numeric(12,2) not null default 0 check (reserve_fund >= 0),
  total_income      numeric(12,2) not null,
  box_expenses      numeric(12,2) not null,
  net_profit        numeric(12,2) not null,
  partners_snapshot jsonb not null,
  transfers         jsonb not null,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint settlements_period check (period_end >= period_start)
);

alter table public.settlements enable row level security;

create index settlements_period_idx on public.settlements (period_start desc);

create trigger settlements_updated_at
  before update on public.settlements
  for each row execute function public.handle_updated_at();

create policy "settlements: socio lee"
  on public.settlements for select to authenticated using ((select private.is_partner()));
-- Escritura solo por RPC (save_settlement, set_settlement_transfer_paid, delete_settlement).

alter table public.partner_transfers
  add constraint partner_transfers_settlement_fk
  foreign key (settlement_id) references public.settlements(id) on delete cascade;

-- =====================================================================
-- 6. INGRESOS AUTOMÁTICOS (abonos y renovaciones pagadas, D30)
-- =====================================================================
create or replace function private.sync_debt_payment_income()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    update public.incomes set deleted_at = now()
    where source = 'debt_payment' and source_ref = old.id;
    return old;
  end if;

  select m.full_name into v_name
  from public.debts d join public.members m on m.id = d.member_id
  where d.id = new.debt_id;

  insert into public.incomes (partner_id, amount, concept, source, source_ref, payment_method,
                              note, received_at, created_by, deleted_at)
  values (new.received_by_partner, new.amount, 'Abono a deuda: ' || coalesce(v_name, 'atleta'),
          'debt_payment', new.id, new.payment_method, new.note, new.paid_at, new.collected_by,
          new.deleted_at)
  on conflict (source, source_ref) where source_ref is not null do update set
    partner_id     = excluded.partner_id,
    amount         = excluded.amount,
    concept        = excluded.concept,
    payment_method = excluded.payment_method,
    note           = excluded.note,
    received_at    = excluded.received_at,
    deleted_at     = excluded.deleted_at;
  return new;
end;
$$;

create trigger debt_payments_income
  after insert or update or delete on public.debt_payments
  for each row execute function private.sync_debt_payment_income();

create or replace function private.sync_renewal_income()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    update public.incomes set deleted_at = now()
    where source = 'membership' and source_ref = old.id;
    return old;
  end if;

  if new.payment_status = 'paid' and new.voided_at is null
     and coalesce(new.amount, 0) > 0 and new.received_by_partner is not null then
    select full_name into v_name from public.members where id = new.member_id;
    insert into public.incomes (partner_id, amount, concept, source, source_ref, payment_method,
                                note, received_at, created_by)
    values (new.received_by_partner, new.amount,
            'Membresía ' || new.plan_name || ': ' || coalesce(v_name, 'atleta'),
            'membership', new.id, new.payment_method,
            'Vigencia hasta ' || to_char(new.period_end at time zone 'America/Bogota', 'YYYY-MM-DD'),
            new.paid_at, new.collected_by)
    on conflict (source, source_ref) where source_ref is not null do update set
      partner_id     = excluded.partner_id,
      amount         = excluded.amount,
      concept        = excluded.concept,
      payment_method = excluded.payment_method,
      note           = excluded.note,
      received_at    = excluded.received_at,
      deleted_at     = null;
  else
    update public.incomes set deleted_at = now()
    where source = 'membership' and source_ref = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger membership_renewals_income
  after insert or update or delete on public.membership_renewals
  for each row execute function private.sync_renewal_income();

-- =====================================================================
-- 7. VENTA DE CONTADO (socio o coach, D13 + D30)
-- =====================================================================
create or replace function public.register_sale(
  p_product_id          uuid,
  p_quantity            int,
  p_payment_method      public.payment_method,
  p_received_by_partner uuid,
  p_unit_price          numeric default null,
  p_note                text default null
)
returns public.incomes
language plpgsql security definer set search_path = ''
as $$
declare
  v_prod   public.products;
  v_income public.incomes;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  perform private.assert_receiving_partner(p_received_by_partner);
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Cantidad inválida' using errcode = '22023';
  end if;

  select * into v_prod from public.products where id = p_product_id;
  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;

  insert into public.incomes (partner_id, amount, concept, source, product_id, quantity,
                              payment_method, note)
  values (p_received_by_partner, p_quantity * coalesce(p_unit_price, v_prod.price),
          'Venta: ' || v_prod.name || case when p_quantity > 1 then ' x' || p_quantity else '' end,
          'sale', v_prod.id, p_quantity, p_payment_method, p_note)
  returning * into v_income;
  return v_income;
end;
$$;

-- =====================================================================
-- 8. CÁLCULO DEL CUADRE (port de SettlementCalculator.kt, D7–D8)
-- =====================================================================
-- Periodo en fechas de Bogotá, ambos extremos incluidos.
-- p_declared_cash: {"<partner_id>": monto} con el efectivo que cada socio dice tener.
-- La fórmula usa el efectivo ESPERADO (equivale a la validación de Spent: ingresos =
-- gastos BOX + personales + efectivo); la diferencia con lo declarado se reporta como alerta.
create or replace function public.calculate_settlement(
  p_start         date,
  p_end           date,
  p_reserve_fund  numeric default 0,
  p_declared_cash jsonb default '{}'
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from        timestamptz := p_start::timestamp at time zone 'America/Bogota';
  v_to          timestamptz := (p_end + 1)::timestamp at time zone 'America/Bogota';
  v_reserve     numeric(12,2) := coalesce(p_reserve_fund, 0);
  v_partners    jsonb := '[]';
  v_pct_total   numeric;
  v_total_inc   numeric(12,2);
  v_total_box   numeric(12,2);
  v_net_profit  numeric(12,2);
  v_transfers   jsonb := '[]';
  v_debtors     jsonb;
  v_creditors   jsonb;
  d int := 0;
  c int := 0;
  v_d_amt numeric;
  v_c_amt numeric;
  v_pay   numeric;
  r record;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Periodo inválido' using errcode = '22023';
  end if;
  if v_reserve < 0 then
    raise exception 'El fondo de reserva no puede ser negativo' using errcode = '22023';
  end if;

  select sum(share_percentage) into v_pct_total from public.partners where is_active;
  if v_pct_total is null then
    raise exception 'No hay socios activos' using errcode = '22023';
  end if;
  if abs(v_pct_total - 100) > 0.05 then
    raise exception 'La suma de porcentajes de participación es % %% (debe ser 100 %%)', v_pct_total
      using errcode = '22023';
  end if;

  -- Totales por socio
  for r in
    select
      p.id, p.name, p.share_percentage as pct,
      coalesce((select sum(amount) from public.incomes i
                where i.partner_id = p.id and i.deleted_at is null
                  and i.received_at >= v_from and i.received_at < v_to), 0) as income,
      coalesce((select sum(amount) from public.expenses e
                where e.partner_id = p.id and e.deleted_at is null and e.scope = 'BOX'
                  and e.spent_at >= v_from and e.spent_at < v_to), 0) as box_exp,
      coalesce((select sum(amount) from public.expenses e
                where e.partner_id = p.id and e.deleted_at is null and e.scope = 'PERSONAL'
                  and e.spent_at >= v_from and e.spent_at < v_to), 0) as personal_exp,
      coalesce((select sum(amount) from public.partner_transfers t
                where t.from_partner = p.id and t.deleted_at is null and t.settlement_id is null
                  and t.transferred_at >= v_from and t.transferred_at < v_to), 0) as given,
      coalesce((select sum(amount) from public.partner_transfers t
                where t.to_partner = p.id and t.deleted_at is null and t.settlement_id is null
                  and t.transferred_at >= v_from and t.transferred_at < v_to), 0) as received
    from public.partners p
    where p.is_active
    order by p.created_at, p.name
  loop
    v_partners := v_partners || jsonb_build_object(
      'partner_id', r.id,
      'name', r.name,
      'percentage', r.pct,
      'income_collected', r.income,
      'box_expenses_paid', r.box_exp,
      'personal_expenses', r.personal_exp,
      'transfers_given', r.given,
      'transfers_received', r.received,
      'expected_cash', r.income - r.box_exp - r.personal_exp - r.given + r.received,
      'declared_cash', (p_declared_cash->>(r.id::text))::numeric
    );
  end loop;

  select coalesce(sum((x->>'income_collected')::numeric), 0),
         coalesce(sum((x->>'box_expenses_paid')::numeric), 0)
    into v_total_inc, v_total_box
  from jsonb_array_elements(v_partners) x;

  v_net_profit := v_total_inc - v_total_box - v_reserve;

  -- Participación y saldo por socio (truncado a peso, como en Spent)
  select jsonb_agg(
           x || jsonb_build_object(
             'cash_difference', case when x->>'declared_cash' is not null
                                     then (x->>'declared_cash')::numeric - (x->>'expected_cash')::numeric end,
             'gross_share', trunc(v_net_profit * (x->>'percentage')::numeric / 100),
             'reserve_contribution', trunc(v_reserve * (x->>'percentage')::numeric / 100),
             'net_balance', trunc(v_net_profit * (x->>'percentage')::numeric / 100)
                            - ((x->>'personal_expenses')::numeric + (x->>'expected_cash')::numeric)
           ) order by ord)
    into v_partners
  from jsonb_array_elements(v_partners) with ordinality as t(x, ord);

  -- Transferencias greedy: deudores pagan a acreedores en orden; el sobrante va al fondo.
  select coalesce(jsonb_agg(jsonb_build_object('id', x->>'partner_id', 'name', x->>'name',
                                               'amount', abs((x->>'net_balance')::numeric)) order by ord), '[]')
    into v_debtors
  from jsonb_array_elements(v_partners) with ordinality as t(x, ord)
  where (x->>'net_balance')::numeric < 0;

  select coalesce(jsonb_agg(jsonb_build_object('id', x->>'partner_id', 'name', x->>'name',
                                               'amount', (x->>'net_balance')::numeric) order by ord), '[]')
    into v_creditors
  from jsonb_array_elements(v_partners) with ordinality as t(x, ord)
  where (x->>'net_balance')::numeric > 0;

  if jsonb_array_length(v_debtors) > 0 then
    v_d_amt := (v_debtors->0->>'amount')::numeric;
  end if;
  if jsonb_array_length(v_creditors) > 0 then
    v_c_amt := (v_creditors->0->>'amount')::numeric;
  end if;

  while d < jsonb_array_length(v_debtors) and c < jsonb_array_length(v_creditors) loop
    v_pay := least(v_d_amt, v_c_amt);
    if v_pay > 0 then
      v_transfers := v_transfers || jsonb_build_object(
        'from_partner_id', v_debtors->d->>'id', 'from_name', v_debtors->d->>'name',
        'to_partner_id', v_creditors->c->>'id', 'to_name', v_creditors->c->>'name',
        'to_reserve', false, 'amount', v_pay, 'paid_at', null);
    end if;
    v_d_amt := v_d_amt - v_pay;
    v_c_amt := v_c_amt - v_pay;
    if v_d_amt <= 0 then
      d := d + 1;
      if d < jsonb_array_length(v_debtors) then v_d_amt := (v_debtors->d->>'amount')::numeric; end if;
    end if;
    if v_c_amt <= 0 then
      c := c + 1;
      if c < jsonb_array_length(v_creditors) then v_c_amt := (v_creditors->c->>'amount')::numeric; end if;
    end if;
  end loop;

  while d < jsonb_array_length(v_debtors) loop
    if v_d_amt > 0 then
      v_transfers := v_transfers || jsonb_build_object(
        'from_partner_id', v_debtors->d->>'id', 'from_name', v_debtors->d->>'name',
        'to_partner_id', null, 'to_name', 'Fondo de reserva (caja del box)',
        'to_reserve', true, 'amount', v_d_amt, 'paid_at', null);
    end if;
    d := d + 1;
    if d < jsonb_array_length(v_debtors) then v_d_amt := (v_debtors->d->>'amount')::numeric; end if;
  end loop;

  return jsonb_build_object(
    'period_start', p_start,
    'period_end', p_end,
    'total_income', v_total_inc,
    'box_expenses', v_total_box,
    'reserve_fund', v_reserve,
    'net_profit', v_net_profit,
    'partners', v_partners,
    'transfers', v_transfers,
    'has_cash_differences', exists (
      select 1 from jsonb_array_elements(v_partners) x
      where (x->>'cash_difference') is not null and (x->>'cash_difference')::numeric <> 0)
  );
end;
$$;

create or replace function public.save_settlement(
  p_title         text,
  p_start         date,
  p_end           date,
  p_reserve_fund  numeric default 0,
  p_declared_cash jsonb default '{}',
  p_notes         text default null
)
returns public.settlements
language plpgsql security definer set search_path = ''
as $$
declare
  v_calc jsonb;
  v_row  public.settlements;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;

  v_calc := public.calculate_settlement(p_start, p_end, p_reserve_fund, p_declared_cash);

  insert into public.settlements (title, period_start, period_end, reserve_fund, total_income,
                                  box_expenses, net_profit, partners_snapshot, transfers, notes, created_by)
  values (coalesce(nullif(trim(p_title), ''),
                   'Cuadre ' || to_char(p_start, 'YYYY-MM-DD') || ' a ' || to_char(p_end, 'YYYY-MM-DD')),
          p_start, p_end, (v_calc->>'reserve_fund')::numeric, (v_calc->>'total_income')::numeric,
          (v_calc->>'box_expenses')::numeric, (v_calc->>'net_profit')::numeric,
          v_calc->'partners', v_calc->'transfers', p_notes, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- Marcar (o desmarcar) como pagada una transferencia del cuadre. Entre socios queda
-- registrada como partner_transfers con settlement_id (no afecta cuadres futuros).
create or replace function public.set_settlement_transfer_paid(p_settlement_id uuid, p_index int, p_paid boolean)
returns public.settlements
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.settlements;
  v_t   jsonb;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;

  select * into v_row from public.settlements where id = p_settlement_id and deleted_at is null for update;
  if not found then
    raise exception 'Cuadre no encontrado' using errcode = 'P0002';
  end if;
  v_t := v_row.transfers->p_index;
  if v_t is null then
    raise exception 'Transferencia no encontrada' using errcode = 'P0002';
  end if;

  update public.settlements
  set transfers = jsonb_set(transfers, array[p_index::text],
                            v_t || jsonb_build_object('paid_at', case when p_paid then now() end,
                                                      'paid_by', case when p_paid then auth.uid() end))
  where id = p_settlement_id
  returning * into v_row;

  if not coalesce((v_t->>'to_reserve')::boolean, false) then
    if p_paid then
      insert into public.partner_transfers (from_partner, to_partner, amount, note, settlement_id, settlement_index)
      values ((v_t->>'from_partner_id')::uuid, (v_t->>'to_partner_id')::uuid, (v_t->>'amount')::numeric,
              'Pago de cuadre: ' || v_row.title, p_settlement_id, p_index);
    else
      update public.partner_transfers set deleted_at = now()
      where settlement_id = p_settlement_id and settlement_index = p_index and deleted_at is null;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.delete_settlement(p_settlement_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;
  update public.settlements set deleted_at = now() where id = p_settlement_id and deleted_at is null;
  update public.partner_transfers set deleted_at = now()
  where settlement_id = p_settlement_id and deleted_at is null;
end;
$$;

-- Cuadres con indicador de movimientos modificados después de guardarlos (D9).
create view public.settlement_list with (security_invoker = true) as
select
  s.*,
  (
    exists (select 1 from public.incomes i
            where i.updated_at > s.created_at
              and i.received_at >= s.period_start::timestamp at time zone 'America/Bogota'
              and i.received_at < (s.period_end + 1)::timestamp at time zone 'America/Bogota')
    or exists (select 1 from public.expenses e
               where e.updated_at > s.created_at
                 and e.spent_at >= s.period_start::timestamp at time zone 'America/Bogota'
                 and e.spent_at < (s.period_end + 1)::timestamp at time zone 'America/Bogota')
    or exists (select 1 from public.partner_transfers t
               where t.settlement_id is null and t.updated_at > s.created_at
                 and t.transferred_at >= s.period_start::timestamp at time zone 'America/Bogota'
                 and t.transferred_at < (s.period_end + 1)::timestamp at time zone 'America/Bogota')
  ) as modified_after
from public.settlements s
where s.deleted_at is null;

grant select on public.settlement_list to authenticated;

-- =====================================================================
-- 9. PERMISOS DE EJECUCIÓN
-- =====================================================================
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.register_sale(uuid, int, public.payment_method, uuid, numeric, text)',
    'public.calculate_settlement(date, date, numeric, jsonb)',
    'public.save_settlement(text, date, date, numeric, jsonb, text)',
    'public.set_settlement_transfer_paid(uuid, int, boolean)',
    'public.delete_settlement(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
