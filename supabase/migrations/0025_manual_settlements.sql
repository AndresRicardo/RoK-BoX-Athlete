-- 0025_manual_settlements.sql
-- Cuadre manual (D42): los socios escriben a mano los totales de cada uno (ingresos,
-- gastos, entregas y efectivo) en vez de tomarlos de los movimientos de la app. El
-- reparto usa exactamente la misma fórmula que el cuadre calculado (D7–D8, D32).

alter table public.settlements add column is_manual boolean not null default false;

-- =====================================================================
-- 1. VALIDACIONES COMUNES
-- =====================================================================
create or replace function private.assert_settlement_params(p_start date, p_end date, p_reserve numeric)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pct_total numeric;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Periodo inválido' using errcode = '22023';
  end if;
  if coalesce(p_reserve, 0) < 0 then
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
end;
$$;

-- =====================================================================
-- 2. REPARTO A PARTIR DE LOS TOTALES DE CADA SOCIO
-- =====================================================================
-- p_rows: [{partner_id, name, percentage, income_collected, box_expenses_paid,
--           personal_expenses, transfers_given, transfers_received, declared_cash?}]
-- Es el cálculo que antes vivía dentro de calculate_settlement, sin cambios.
create or replace function private.settlement_result(p_start date, p_end date, p_reserve numeric, p_rows jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_reserve     numeric(12,2) := coalesce(p_reserve, 0);
  v_partners    jsonb;
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
begin
  -- Efectivo esperado por socio.
  select coalesce(jsonb_agg(
           x || jsonb_build_object(
             'expected_cash', (x->>'income_collected')::numeric - (x->>'box_expenses_paid')::numeric
                              - (x->>'personal_expenses')::numeric - (x->>'transfers_given')::numeric
                              + (x->>'transfers_received')::numeric
           ) order by ord), '[]')
    into v_partners
  from jsonb_array_elements(p_rows) with ordinality as t(x, ord);

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
      where (x->>'cash_difference') is not null and (x->>'cash_difference')::numeric <> 0),
    -- Lo entregado entre socios debería ser igual a lo recibido.
    'transfers_mismatch', (select coalesce(sum((x->>'transfers_given')::numeric), 0)
                                  <> coalesce(sum((x->>'transfers_received')::numeric), 0)
                           from jsonb_array_elements(v_partners) x)
  );
end;
$$;

-- =====================================================================
-- 3. CUADRE CON LOS MOVIMIENTOS DE LA APP (misma firma y resultado que en 0018)
-- =====================================================================
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
  v_from timestamptz := p_start::timestamp at time zone 'America/Bogota';
  v_to   timestamptz := (p_end + 1)::timestamp at time zone 'America/Bogota';
  v_rows jsonb;
begin
  perform private.assert_settlement_params(p_start, p_end, p_reserve_fund);

  select coalesce(jsonb_agg(jsonb_build_object(
           'partner_id', r.id,
           'name', r.name,
           'percentage', r.pct,
           'income_collected', r.income,
           'box_expenses_paid', r.box_exp,
           'personal_expenses', r.personal_exp,
           'transfers_given', r.given,
           'transfers_received', r.received,
           'declared_cash', (coalesce(p_declared_cash, '{}')->>(r.id::text))::numeric
         ) order by r.created_at, r.name), '[]')
    into v_rows
  from (
    select
      p.id, p.name, p.created_at, p.share_percentage as pct,
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
  ) r;

  return private.settlement_result(p_start, p_end, p_reserve_fund, v_rows)
         || jsonb_build_object('is_manual', false);
end;
$$;

-- =====================================================================
-- 4. CUADRE MANUAL
-- =====================================================================
-- p_partners: {"<partner_id>": {"income_collected": n, "box_expenses_paid": n,
--   "personal_expenses": n, "transfers_given": n, "transfers_received": n,
--   "declared_cash": n | null}}. Lo que falte cuenta como 0 (declared_cash: sin declarar).
-- Entran todos los socios activos, con su porcentaje actual.
create or replace function public.calculate_manual_settlement(
  p_start        date,
  p_end          date,
  p_reserve_fund numeric default 0,
  p_partners     jsonb default '{}'
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_input jsonb := coalesce(p_partners, '{}');
  v_rows  jsonb;
  v_key   text;
  v_field text;
  v_val   jsonb;
  v_num   numeric;
begin
  perform private.assert_settlement_params(p_start, p_end, p_reserve_fund);

  if jsonb_typeof(v_input) <> 'object' then
    raise exception 'Datos de socios inválidos' using errcode = '22023';
  end if;

  -- Validar: solo socios activos, montos numéricos no negativos y con máximo 2 decimales.
  for v_key in select jsonb_object_keys(v_input) loop
    if not exists (select 1 from public.partners p where p.id::text = v_key and p.is_active) then
      raise exception 'Socio desconocido o inactivo en el cuadre manual' using errcode = '22023';
    end if;
    if jsonb_typeof(v_input->v_key) <> 'object' then
      raise exception 'Datos de socios inválidos' using errcode = '22023';
    end if;
    for v_field, v_val in select key, value from jsonb_each(v_input->v_key) loop
      if v_field not in ('income_collected', 'box_expenses_paid', 'personal_expenses',
                         'transfers_given', 'transfers_received', 'declared_cash') then
        raise exception 'Campo desconocido en el cuadre manual: %', v_field using errcode = '22023';
      end if;
      continue when jsonb_typeof(v_val) = 'null';
      if jsonb_typeof(v_val) <> 'number' then
        raise exception 'El valor de % debe ser un número', v_field using errcode = '22023';
      end if;
      v_num := (v_val #>> '{}')::numeric;
      if v_num < 0 or v_num <> round(v_num, 2) or v_num >= 10000000000 then
        raise exception 'Monto inválido en %: %', v_field, v_num using errcode = '22023';
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'partner_id', p.id,
           'name', p.name,
           'percentage', p.share_percentage,
           'income_collected', coalesce((v_input->(p.id::text)->>'income_collected')::numeric, 0),
           'box_expenses_paid', coalesce((v_input->(p.id::text)->>'box_expenses_paid')::numeric, 0),
           'personal_expenses', coalesce((v_input->(p.id::text)->>'personal_expenses')::numeric, 0),
           'transfers_given', coalesce((v_input->(p.id::text)->>'transfers_given')::numeric, 0),
           'transfers_received', coalesce((v_input->(p.id::text)->>'transfers_received')::numeric, 0),
           'declared_cash', (v_input->(p.id::text)->>'declared_cash')::numeric
         ) order by p.created_at, p.name), '[]')
    into v_rows
  from public.partners p
  where p.is_active;

  return private.settlement_result(p_start, p_end, p_reserve_fund, v_rows)
         || jsonb_build_object('is_manual', true);
end;
$$;

create or replace function public.save_manual_settlement(
  p_title        text,
  p_start        date,
  p_end          date,
  p_reserve_fund numeric default 0,
  p_partners     jsonb default '{}',
  p_notes        text default null
)
returns public.settlements
language plpgsql security definer set search_path = ''
as $$
declare
  v_calc jsonb;
  v_row  public.settlements;
begin
  v_calc := public.calculate_manual_settlement(p_start, p_end, p_reserve_fund, p_partners);

  insert into public.settlements (title, period_start, period_end, reserve_fund, total_income,
                                  box_expenses, net_profit, partners_snapshot, transfers, notes,
                                  created_by, is_manual)
  values (coalesce(nullif(trim(p_title), ''),
                   'Cuadre manual ' || to_char(p_start, 'YYYY-MM-DD') || ' a ' || to_char(p_end, 'YYYY-MM-DD')),
          p_start, p_end, (v_calc->>'reserve_fund')::numeric, (v_calc->>'total_income')::numeric,
          (v_calc->>'box_expenses')::numeric, (v_calc->>'net_profit')::numeric,
          v_calc->'partners', v_calc->'transfers', p_notes, auth.uid(), true)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function private.assert_settlement_params(date, date, numeric) from public, anon;
revoke all on function private.settlement_result(date, date, numeric, jsonb) from public, anon;
grant execute on function private.assert_settlement_params(date, date, numeric) to authenticated;
grant execute on function private.settlement_result(date, date, numeric, jsonb) to authenticated;
revoke all on function public.calculate_manual_settlement(date, date, numeric, jsonb) from public, anon;
revoke all on function public.save_manual_settlement(text, date, date, numeric, jsonb, text) from public, anon;
grant execute on function public.calculate_manual_settlement(date, date, numeric, jsonb) to authenticated;
grant execute on function public.save_manual_settlement(text, date, date, numeric, jsonb, text) to authenticated;

-- =====================================================================
-- 5. LISTA DE CUADRES: un cuadre manual no depende de los movimientos de la app
-- =====================================================================
drop view public.settlement_list;

create view public.settlement_list with (security_invoker = true) as
select
  s.*,
  (
    not s.is_manual and (
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
    )
  ) as modified_after
from public.settlements s
where s.deleted_at is null;

grant select on public.settlement_list to authenticated;
