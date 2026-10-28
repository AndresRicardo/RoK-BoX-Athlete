-- 0027_void_renewal_restores.sql — Anular una renovación devuelve la membresía (D44)
--
-- Antes, void_renewal solo anulaba el ingreso (D34-d). Si se anulaba una tiquetera, el
-- paquete seguía en la membresía (barra de clases y "Descontar clase") y "Fechas" no lo
-- puede quitar. Ahora:
--   * renew_membership guarda en la renovación cómo estaba la membresía antes
--     (prev_membership: plan, vigencia y clases).
--   * Al anular, si no queda ninguna renovación activa posterior, la membresía vuelve al
--     estado anterior a las renovaciones anuladas del final (se pueden anular en cualquier
--     orden). Las clases descontadas después se pasan a la tiquetera restaurada hasta donde
--     quepan; las demás se deshacen. El bloqueo manual (access_enabled) no cambia.
--   * Si después hay otra renovación activa, o la renovación no tiene foto (hecha en
--     HikCentral o antes de esta migración), solo se anula el ingreso, como antes.

alter table public.membership_renewals add column prev_membership jsonb;

comment on column public.membership_renewals.prev_membership is
  'Membresía antes de esta renovación (plan, vigencia y clases). La usa void_renewal para revertirla.';

create or replace function private.membership_snapshot(p_ms public.memberships)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'plan_id', p_ms.plan_id, 'plan_name', p_ms.plan_name, 'plan_kind', p_ms.plan_kind,
    'valid_from', p_ms.valid_from, 'valid_until', p_ms.valid_until,
    'classes_total', p_ms.classes_total, 'classes_used', p_ms.classes_used
  );
$$;

-- Igual que en 0016, más la foto de la membresía anterior.
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
    collected_by, paid_at, note, created_by, prev_membership
  ) values (
    p_member_id, v_plan.id, v_plan.name, v_start, v_end, v_plan.class_count, 'app', 'paid',
    v_plan.price, coalesce(p_discount, 0), nullif(trim(p_discount_reason), ''), v_amount,
    p_payment_method, case when v_amount > 0 then p_received_by_partner end,
    auth.uid(), now(), p_note, auth.uid(), private.membership_snapshot(v_ms)
  ) returning * into v_renewal;

  perform private.request_hik_sync(p_member_id);
  return v_renewal;
end;
$$;

-- Anular una renovación (socios). Anula su ingreso y, si es la última activa, devuelve la
-- membresía a como estaba antes (ver encabezado).
create or replace function public.void_renewal(p_renewal_id uuid, p_reason text)
returns public.membership_renewals
language plpgsql security definer set search_path = ''
as $$
declare
  v_ren     public.membership_renewals;
  v_first   public.membership_renewals;
  v_snap    jsonb;
  v_ms      public.memberships;
  v_hik_id  text;
  v_n_used  int;
  v_keep    int := 0;
  v_current timestamptz;
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

  -- Hay una renovación activa posterior: la vigencia actual depende de ella.
  if exists (select 1 from public.membership_renewals
             where member_id = v_ren.member_id and voided_at is null
               and created_at > v_ren.created_at) then
    return v_ren;
  end if;

  -- La primera de las renovaciones anuladas del final (después de la última activa) tiene
  -- la foto de la membresía a restaurar.
  select * into v_first from public.membership_renewals r
  where r.member_id = v_ren.member_id
    and r.created_at > coalesce((select max(a.created_at) from public.membership_renewals a
                                 where a.member_id = v_ren.member_id and a.voided_at is null),
                                '-infinity'::timestamptz)
  order by r.created_at
  limit 1;
  v_snap := v_first.prev_membership;
  if v_snap is null then
    return v_ren;
  end if;

  select * into v_ms from public.memberships where member_id = v_ren.member_id for update;

  -- Clases descontadas después: cuentan en la tiquetera restaurada hasta donde quepan.
  select count(*) into v_n_used from public.class_usages
  where member_id = v_ren.member_id and undone_at is null and used_at >= v_first.created_at;
  if v_snap->>'plan_kind' = 'class_pack' then
    v_keep := least(v_n_used, greatest(coalesce((v_snap->>'classes_total')::int, 0)
                                       - coalesce((v_snap->>'classes_used')::int, 0), 0));
  end if;
  update public.class_usages set undone_at = now(), undone_by = auth.uid()
  where id in (select id from public.class_usages
               where member_id = v_ren.member_id and undone_at is null
                 and used_at >= v_first.created_at
               order by used_at offset v_keep);

  update public.memberships set
    plan_id            = (v_snap->>'plan_id')::uuid,
    plan_name          = coalesce(v_snap->>'plan_name', 'Sin plan'),
    plan_kind          = v_snap->>'plan_kind',
    valid_from         = (v_snap->>'valid_from')::timestamptz,
    valid_until        = (v_snap->>'valid_until')::timestamptz,
    classes_total      = (v_snap->>'classes_total')::int,
    classes_used       = coalesce((v_snap->>'classes_used')::int, 0) + v_keep,
    last_change_origin = 'app'
  where member_id = v_ren.member_id
  returning * into v_ms;

  if v_ms.valid_until is not null then
    perform private.request_hik_sync(v_ren.member_id);
    return v_ren;
  end if;

  -- Sin membresía previa: request_hik_sync no actúa sin vigencia, así que se cierra aquí
  -- el acceso que la renovación anulada dio en HCAC (D35).
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

revoke all on function private.membership_snapshot(public.memberships) from public, anon;
grant execute on function private.membership_snapshot(public.memberships) to authenticated, service_role;
