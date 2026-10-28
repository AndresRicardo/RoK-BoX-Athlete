-- 0028_void_renewal_replay.sql — Anular una renovación intermedia la quita de la membresía (D45)
--
-- 0027 solo revertía la membresía si no quedaba una renovación activa posterior. Con dos o
-- más tiqueteras, anular una que no fuera la última dejaba sus clases sumadas en la actual.
-- Ahora void_renewal recalcula la membresía sin las renovaciones anuladas:
--   * parte de la foto (prev_membership) de la primera renovación anulada desde la última
--     activa anterior a la que se anula;
--   * vuelve a aplicar, en orden, las renovaciones activas posteriores con las mismas reglas
--     de renew_membership (continúa desde el fin si sigue vigente, suma las clases restantes
--     de una tiquetera vigente) y las clases descontadas, que cuentan mientras quepan en la
--     tiquetera de ese momento; las que no caben se deshacen.
--   * Las fechas corregidas a mano después de la anulada se pierden (se rehacen con "Fechas").
--     Las filas de las renovaciones posteriores no cambian (su periodo queda como se registró).
--   * Si hay una renovación activa posterior hecha en HikCentral, o falta la foto o la
--     duración, solo se anula el ingreso, como antes.
-- Para poder reaplicar, cada renovación guarda la duración de su plan.

alter table public.membership_renewals
  add column duration_months int check (duration_months >= 0),
  add column duration_days   int check (duration_days >= 0);

update public.membership_renewals r
set duration_months = p.duration_months, duration_days = p.duration_days
from public.membership_plans p
where p.id = r.plan_id and r.origin = 'app';

-- Igual que en 0027, más la duración del plan.
create or replace function public.renew_membership(
  p_member_id           uuid,
  p_plan_id             uuid,
  p_payment_method      public.payment_method,
  p_received_by_partner uuid,
  p_discount            numeric default 0,
  p_discount_reason     text default null,
  p_note                text default null
)
returns public.membership_renewals
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan      public.membership_plans;
  v_ms        public.memberships;
  v_is_valid  boolean;
  v_base      date;
  v_start     timestamptz;
  v_end       timestamptz;
  v_amount    numeric(12,2);
  v_classes   int;
  v_renewal   public.membership_renewals;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members where id = p_member_id and is_active) then
    raise exception 'Miembro no encontrado o inactivo' using errcode = 'P0002';
  end if;

  select * into v_plan from public.membership_plans where id = p_plan_id and is_active;
  if not found then
    raise exception 'Plan no encontrado o inactivo' using errcode = 'P0002';
  end if;

  if coalesce(p_discount, 0) < 0 or coalesce(p_discount, 0) > v_plan.price then
    raise exception 'Descuento inválido' using errcode = '22023';
  end if;
  if coalesce(p_discount, 0) > 0 and nullif(trim(p_discount_reason), '') is null then
    raise exception 'Indica el motivo del descuento' using errcode = '22023';
  end if;
  v_amount := v_plan.price - coalesce(p_discount, 0);
  if v_amount > 0 then
    perform private.assert_receiving_partner(p_received_by_partner);
  end if;

  insert into public.memberships (member_id) values (p_member_id) on conflict do nothing;
  select * into v_ms from public.memberships where member_id = p_member_id for update;

  v_is_valid := v_ms.valid_until is not null and v_ms.valid_until > now();
  if v_is_valid then
    v_base  := (v_ms.valid_until at time zone 'America/Bogota')::date;
    v_start := v_ms.valid_until;
  else
    v_base  := (now() at time zone 'America/Bogota')::date;
    v_start := now();
  end if;
  v_end := private.period_end(v_base, v_plan.duration_months, v_plan.duration_days);

  if v_plan.kind = 'class_pack' then
    -- Clases restantes de una tiquetera vigente se suman al nuevo paquete.
    v_classes := v_plan.class_count
      + case when v_is_valid and v_ms.plan_kind = 'class_pack'
             then greatest(coalesce(v_ms.classes_total, 0) - v_ms.classes_used, 0) else 0 end;
  end if;

  update public.memberships set
    plan_id            = v_plan.id,
    plan_name          = v_plan.name,
    plan_kind          = v_plan.kind,
    valid_from         = case when v_is_valid then coalesce(valid_from, v_start) else v_start end,
    valid_until        = v_end,
    classes_total      = v_classes,
    classes_used       = 0,
    last_change_origin = 'app'
  where member_id = p_member_id;

  insert into public.membership_renewals (
    member_id, plan_id, plan_name, period_start, period_end, classes, origin, payment_status,
    list_price, discount, discount_reason, amount, payment_method, received_by_partner,
    collected_by, paid_at, note, created_by, prev_membership, duration_months, duration_days
  ) values (
    p_member_id, v_plan.id, v_plan.name, v_start, v_end, v_plan.class_count, 'app', 'paid',
    v_plan.price, coalesce(p_discount, 0), nullif(trim(p_discount_reason), ''), v_amount,
    p_payment_method, case when v_amount > 0 then p_received_by_partner end,
    auth.uid(), now(), p_note, auth.uid(), private.membership_snapshot(v_ms),
    v_plan.duration_months, v_plan.duration_days
  ) returning * into v_renewal;

  perform private.request_hik_sync(p_member_id);
  return v_renewal;
end;
$$;

-- Anular una renovación (socios). Anula su ingreso y recalcula la membresía sin ella (ver
-- encabezado).
create or replace function public.void_renewal(p_renewal_id uuid, p_reason text)
returns public.membership_renewals
language plpgsql security definer set search_path = ''
as $$
declare
  v_ren       public.membership_renewals;
  v_first     public.membership_renewals;
  v_ms        public.memberships;
  v_ev        record;
  v_plan_id   uuid;
  v_plan_name text;
  v_kind      text;
  v_from      timestamptz;
  v_until     timestamptz;
  v_total     int;
  v_used      int;
  v_valid     boolean;
  v_base      date;
  v_start     timestamptz;
  v_hik_id    text;
  v_current   timestamptz;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Indica el motivo' using errcode = '22023';
  end if;

  update public.membership_renewals
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_renewal_id and voided_at is null
  returning * into v_ren;
  if not found then
    raise exception 'Renovación no encontrada o ya anulada' using errcode = 'P0002';
  end if;

  -- Punto de partida: la primera renovación (anulada) después de la última activa anterior.
  select * into v_first from public.membership_renewals r
  where r.member_id = v_ren.member_id
    and r.created_at > coalesce((select max(a.created_at) from public.membership_renewals a
                                 where a.member_id = v_ren.member_id and a.voided_at is null
                                   and a.created_at < v_ren.created_at),
                                '-infinity'::timestamptz)
  order by r.created_at
  limit 1;
  if v_first.prev_membership is null then
    return v_ren;
  end if;

  -- Solo se reaplican renovaciones hechas en la app con su duración conocida.
  if exists (select 1 from public.membership_renewals r
             left join public.membership_plans p on p.id = r.plan_id
             where r.member_id = v_ren.member_id and r.voided_at is null
               and r.created_at > v_first.created_at
               and (r.origin <> 'app'
                    or coalesce(r.duration_months, p.duration_months) is null)) then
    return v_ren;
  end if;

  select * into v_ms from public.memberships where member_id = v_ren.member_id for update;

  v_plan_id   := (v_first.prev_membership->>'plan_id')::uuid;
  v_plan_name := coalesce(v_first.prev_membership->>'plan_name', 'Sin plan');
  v_kind      := v_first.prev_membership->>'plan_kind';
  v_from      := (v_first.prev_membership->>'valid_from')::timestamptz;
  v_until     := (v_first.prev_membership->>'valid_until')::timestamptz;
  v_total     := (v_first.prev_membership->>'classes_total')::int;
  v_used      := coalesce((v_first.prev_membership->>'classes_used')::int, 0);

  for v_ev in
    select 'r' as ev, r.created_at as at, r.id, r.plan_id, r.plan_name, r.classes,
           coalesce(r.duration_months, p.duration_months) as months,
           coalesce(r.duration_days, p.duration_days) as days
    from public.membership_renewals r
    left join public.membership_plans p on p.id = r.plan_id
    where r.member_id = v_ren.member_id and r.voided_at is null and r.created_at > v_first.created_at
    union all
    select 'u', u.used_at, u.id, null, null, null, null, null
    from public.class_usages u
    where u.member_id = v_ren.member_id and u.undone_at is null and u.used_at >= v_first.created_at
    order by at, ev
  loop
    if v_ev.ev = 'r' then
      -- Mismas reglas que renew_membership, con la fecha de la renovación.
      v_valid := v_until is not null and v_until > v_ev.at;
      if v_valid then
        v_base  := (v_until at time zone 'America/Bogota')::date;
        v_start := v_until;
      else
        v_base  := (v_ev.at at time zone 'America/Bogota')::date;
        v_start := v_ev.at;
      end if;
      v_total := case when v_ev.classes is not null
                      then v_ev.classes + case when v_valid and v_kind = 'class_pack'
                                               then greatest(coalesce(v_total, 0) - v_used, 0) else 0 end
                 end;
      v_kind      := case when v_ev.classes is not null then 'class_pack' else 'period' end;
      v_plan_id   := v_ev.plan_id;
      v_plan_name := v_ev.plan_name;
      v_from      := case when v_valid then coalesce(v_from, v_start) else v_start end;
      v_until     := private.period_end(v_base, v_ev.months, v_ev.days);
      v_used      := 0;
    elsif v_kind = 'class_pack' and v_used < coalesce(v_total, 0) then
      v_used := v_used + 1;
    else
      update public.class_usages set undone_at = now(), undone_by = auth.uid() where id = v_ev.id;
    end if;
  end loop;

  update public.memberships set
    plan_id            = v_plan_id,
    plan_name          = v_plan_name,
    plan_kind          = v_kind,
    valid_from         = v_from,
    valid_until        = v_until,
    classes_total      = v_total,
    classes_used       = v_used,
    last_change_origin = 'app'
  where member_id = v_ren.member_id
  returning * into v_ms;

  if v_ms.valid_until is not null then
    perform private.request_hik_sync(v_ren.member_id);
    return v_ren;
  end if;

  -- Sin membresía: request_hik_sync no actúa sin vigencia, así que se cierra aquí el acceso
  -- que la renovación anulada dio en HCAC (D35).
  select hik_person_id into v_hik_id from public.members where id = v_ren.member_id;
  v_current := coalesce(v_ms.hik_target_until, v_ms.hik_valid_until);
  if v_hik_id is not null and v_current > now() then
    update public.access_commands set status = 'cancelled', finished_at = now()
    where member_id = v_ren.member_id and status = 'pending';
    insert into public.access_commands (member_id, command, payload, requested_by)
    values (v_ren.member_id, 'set_validity', jsonb_build_object(
      'valid_from', least(coalesce(v_ms.hik_valid_from, now()), now() - interval '1 minute'),
      'valid_until', now()
    ), auth.uid());
    update public.memberships set hik_target_until = now() where member_id = v_ren.member_id;
  end if;

  return v_ren;
end;
$$;
