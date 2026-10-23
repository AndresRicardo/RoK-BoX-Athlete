-- 0016_memberships_access.sql
-- Planes, membresías, renovaciones (incl. pendientes de pago desde HikCentral), tiquetera,
-- cola de comandos hacia HikCentral y RPCs del bridge (sincronización bidireccional).
-- Ver docs/PLAN.md §4.1 y §4.2.

-- =====================================================================
-- 0. TIPOS COMUNES
-- =====================================================================
create domain public.payment_method as text
  check (value in ('cash', 'nequi', 'daviplata', 'bre_b', 'transfer', 'card', 'other'));

-- =====================================================================
-- 1. PLANES (D15)
-- =====================================================================
create table public.membership_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  kind            text not null check (kind in ('period', 'class_pack')),
  duration_months int not null default 0 check (duration_months >= 0),
  duration_days   int not null default 0 check (duration_days >= 0),
  class_count     int check (class_count > 0),
  price           numeric(12,2) not null check (price >= 0),
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint membership_plans_duration check (duration_months + duration_days > 0),
  constraint membership_plans_classes check (
    (kind = 'period' and class_count is null) or (kind = 'class_pack' and class_count is not null)
  )
);

alter table public.membership_plans enable row level security;

create trigger membership_plans_updated_at
  before update on public.membership_plans
  for each row execute function public.handle_updated_at();

create policy "plans: autenticados leen"
  on public.membership_plans for select to authenticated using (true);
create policy "plans: socio inserta"
  on public.membership_plans for insert to authenticated with check ((select private.is_partner()));
create policy "plans: socio actualiza"
  on public.membership_plans for update to authenticated
  using ((select private.is_partner())) with check ((select private.is_partner()));

-- =====================================================================
-- 2. MEMBRESÍA ACTUAL DE CADA MIEMBRO
-- =====================================================================
-- valid_* / access_enabled: estado deseado según la app.
-- HikCentral solo controla el acceso por vigencia (D35): bloquear = EndDate en el momento
-- del bloqueo; desbloquear = EndDate de vuelta a valid_until.
-- hik_valid_*: último estado CONFIRMADO en HCAC (lo escribe el bridge); hik_target_until:
-- último EndDate pedido. Sirven para detectar cambios hechos directamente en HCAC y
-- evitar ciclos (PLAN §4.2).
create table public.memberships (
  member_id          uuid primary key references public.members(id) on delete cascade,
  plan_id            uuid references public.membership_plans(id) on delete set null,
  plan_name          text not null default 'Sin plan',
  plan_kind          text check (plan_kind in ('period', 'class_pack')),
  valid_from         timestamptz,
  valid_until        timestamptz,
  access_enabled     boolean not null default true,
  classes_total      int check (classes_total >= 0),
  classes_used       int not null default 0 check (classes_used >= 0),
  hik_valid_from     timestamptz,
  hik_valid_until    timestamptz,
  hik_target_until   timestamptz,
  hik_synced_at      timestamptz,
  last_change_origin text not null default 'app' check (last_change_origin in ('app', 'hikcentral')),
  updated_at         timestamptz not null default now(),
  constraint memberships_classes check (classes_total is null or classes_used <= classes_total)
);

alter table public.memberships enable row level security;

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.handle_updated_at();

create index memberships_valid_until_idx on public.memberships (valid_until);

create policy "memberships: propia, staff o bridge"
  on public.memberships for select to authenticated
  using (
    member_id = (select private.my_member_id())
    or (select private.is_staff())
    or (select private.is_bridge())
  );

-- Escritura solo por RPC.

-- =====================================================================
-- 3. HISTORIAL DE RENOVACIONES (pagadas o pendientes de pago, D5)
-- =====================================================================
create table public.membership_renewals (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.members(id) on delete cascade,
  plan_id             uuid references public.membership_plans(id) on delete set null,
  plan_name           text not null,
  period_start        timestamptz not null,
  period_end          timestamptz not null,
  classes             int check (classes > 0),
  origin              text not null default 'app' check (origin in ('app', 'hikcentral')),
  payment_status      text not null default 'paid' check (payment_status in ('paid', 'pending')),
  list_price          numeric(12,2) check (list_price >= 0),
  discount            numeric(12,2) not null default 0 check (discount >= 0),
  discount_reason     text,
  amount              numeric(12,2) check (amount >= 0),
  payment_method      public.payment_method,
  received_by_partner uuid references public.partners(id) on delete restrict,
  collected_by        uuid references auth.users(id) on delete set null,
  paid_at             timestamptz,
  note                text,
  voided_at           timestamptz,
  voided_by           uuid references auth.users(id) on delete set null,
  void_reason         text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint membership_renewals_period check (period_end > period_start),
  constraint membership_renewals_paid check (
    payment_status = 'pending'
    or (amount is not null and payment_method is not null and paid_at is not null
        and (amount = 0 or received_by_partner is not null))
  )
);

alter table public.membership_renewals enable row level security;

create trigger membership_renewals_updated_at
  before update on public.membership_renewals
  for each row execute function public.handle_updated_at();

create index membership_renewals_member_idx on public.membership_renewals (member_id, period_start desc);
create index membership_renewals_pending_idx on public.membership_renewals (created_at)
  where payment_status = 'pending' and voided_at is null;
create index membership_renewals_partner_idx on public.membership_renewals (received_by_partner);

create policy "renewals: propias o staff"
  on public.membership_renewals for select to authenticated
  using (member_id = (select private.my_member_id()) or (select private.is_staff()));

-- Escritura solo por RPC.

-- =====================================================================
-- 4. CONSUMO MANUAL DE TIQUETERA (D16)
-- =====================================================================
create table public.class_usages (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  used_at     timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  undone_at   timestamptz,
  undone_by   uuid references auth.users(id) on delete set null
);

alter table public.class_usages enable row level security;

create index class_usages_member_idx on public.class_usages (member_id, used_at desc);

create policy "class_usages: propias o staff"
  on public.class_usages for select to authenticated
  using (member_id = (select private.my_member_id()) or (select private.is_staff()));

-- =====================================================================
-- 5. COLA DE COMANDOS HACIA HIKCENTRAL, ESTADO Y EVENTOS DEL BRIDGE
-- =====================================================================
create table public.access_commands (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  command      text not null default 'set_validity' check (command = 'set_validity'),
  payload      jsonb not null default '{}',
  status       text not null default 'pending'
               check (status in ('pending', 'processing', 'done', 'failed', 'cancelled')),
  attempts     int not null default 0,
  last_error   text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

alter table public.access_commands enable row level security;

create index access_commands_queue_idx on public.access_commands (created_at) where status = 'pending';
create index access_commands_member_open_idx on public.access_commands (member_id)
  where status in ('pending', 'processing');

create policy "access_commands: staff o bridge leen"
  on public.access_commands for select to authenticated
  using ((select private.is_staff()) or (select private.is_bridge()));

create table public.bridge_status (
  id            text primary key default 'box-pc',
  agent_version text,
  hik_version   text,
  last_seen_at  timestamptz,
  last_pull_at  timestamptz,
  persons_count int,
  last_error    text
);

alter table public.bridge_status enable row level security;

create policy "bridge_status: staff o bridge leen"
  on public.bridge_status for select to authenticated
  using ((select private.is_staff()) or (select private.is_bridge()));

-- Reservada para asistencia futura (F9).
create table public.access_events (
  id           bigint generated always as identity primary key,
  hik_event_id text unique,
  member_id    uuid references public.members(id) on delete set null,
  occurred_at  timestamptz not null,
  door_name    text,
  result       text,
  verify_mode  text
);

alter table public.access_events enable row level security;

create index access_events_member_idx on public.access_events (member_id, occurred_at desc);

create policy "access_events: staff lee"
  on public.access_events for select to authenticated using ((select private.is_staff()));

-- =====================================================================
-- 6. HELPERS INTERNOS
-- =====================================================================

-- Fin de vigencia: el día (hora Bogotá) base + duración, a las 23:59:59.
create or replace function private.period_end(p_base_date date, p_months int, p_days int)
returns timestamptz
language sql immutable set search_path = ''
as $$
  select ((p_base_date + make_interval(months => p_months, days => p_days))::timestamp
          + time '23:59:59') at time zone 'America/Bogota';
$$;

-- Encola el comando necesario para que HikCentral refleje la membresía (D35).
-- EndDate objetivo = valid_until si el acceso es efectivo; si está bloqueado (manual o
-- tiquetera agotada) = el momento del bloqueo. No duplica comandos si nada cambió.
create or replace function private.request_hik_sync(p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member    public.members;
  v_ms        public.memberships;
  v_effective boolean;
  v_target    timestamptz;
  v_current   timestamptz;
begin
  select * into v_member from public.members where id = p_member_id;
  select * into v_ms from public.memberships where member_id = p_member_id for update;
  if v_ms.member_id is null or v_ms.valid_until is null then
    return;
  end if;

  v_effective := v_ms.access_enabled
                 and (v_ms.classes_total is null or v_ms.classes_used < v_ms.classes_total);
  v_current := coalesce(v_ms.hik_target_until, v_ms.hik_valid_until);

  if v_effective then
    v_target := v_ms.valid_until;
  elsif v_current is not null and v_current <= now() then
    return; -- ya está bloqueado en HCAC
  else
    v_target := least(now(), v_ms.valid_until);
  end if;

  -- La persona aún no existe en HCAC (D36): se registra allá (rostro/huella) y el bridge,
  -- al vincularla por cédula, aplica esta vigencia.
  if v_member.hik_person_id is null then
    return;
  end if;

  if v_target is not distinct from v_current then
    return;
  end if;

  update public.access_commands set status = 'cancelled', finished_at = now()
  where member_id = p_member_id and status = 'pending';
  insert into public.access_commands (member_id, command, payload, requested_by)
  values (p_member_id, 'set_validity', jsonb_build_object(
    'valid_from', least(coalesce(v_ms.valid_from, now()), v_target - interval '1 minute'),
    'valid_until', v_target
  ), auth.uid());

  update public.memberships set hik_target_until = v_target where member_id = p_member_id;
end;
$$;

create or replace function private.assert_receiving_partner(p_partner_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_partner_id is null then
    raise exception 'Debes indicar qué socio recibe el dinero' using errcode = '22023';
  end if;
  if not exists (select 1 from public.partners where id = p_partner_id and is_active) then
    raise exception 'Socio no válido' using errcode = '22023';
  end if;
end;
$$;

-- =====================================================================
-- 7. RPCs DE MEMBRESÍA (app)
-- =====================================================================

-- Renovar (socio o coach). La vigencia continúa desde el fin actual si sigue vigente (E4).
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
    collected_by, paid_at, note, created_by
  ) values (
    p_member_id, v_plan.id, v_plan.name, v_start, v_end, v_plan.class_count, 'app', 'paid',
    v_plan.price, coalesce(p_discount, 0), nullif(trim(p_discount_reason), ''), v_amount,
    p_payment_method, case when v_amount > 0 then p_received_by_partner end,
    auth.uid(), now(), p_note, auth.uid()
  ) returning * into v_renewal;

  perform private.request_hik_sync(p_member_id);
  return v_renewal;
end;
$$;

-- Completar una renovación detectada en HikCentral sin pago registrado (socios, D5).
create or replace function public.complete_pending_renewal(
  p_renewal_id          uuid,
  p_amount              numeric,
  p_payment_method      public.payment_method,
  p_received_by_partner uuid,
  p_plan_id             uuid default null,
  p_note                text default null
)
returns public.membership_renewals
language plpgsql security definer set search_path = ''
as $$
declare
  v_ren  public.membership_renewals;
  v_plan public.membership_plans;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Monto inválido' using errcode = '22023';
  end if;
  if p_amount > 0 then
    perform private.assert_receiving_partner(p_received_by_partner);
  end if;

  select * into v_ren from public.membership_renewals where id = p_renewal_id for update;
  if not found or v_ren.voided_at is not null then
    raise exception 'Renovación no encontrada' using errcode = 'P0002';
  end if;
  if v_ren.payment_status <> 'pending' then
    raise exception 'La renovación ya tiene pago registrado' using errcode = '22023';
  end if;

  if p_plan_id is not null then
    select * into v_plan from public.membership_plans where id = p_plan_id;
    if not found then
      raise exception 'Plan no encontrado' using errcode = 'P0002';
    end if;
    update public.memberships set plan_id = v_plan.id, plan_name = v_plan.name, plan_kind = v_plan.kind
    where member_id = v_ren.member_id and plan_kind is distinct from 'class_pack';
  end if;

  update public.membership_renewals set
    payment_status      = 'paid',
    amount              = p_amount,
    list_price          = coalesce(v_plan.price, list_price),
    plan_id             = coalesce(v_plan.id, plan_id),
    plan_name           = coalesce(v_plan.name, plan_name),
    payment_method      = p_payment_method,
    received_by_partner = case when p_amount > 0 then p_received_by_partner end,
    collected_by        = auth.uid(),
    paid_at             = now(),
    note                = coalesce(p_note, note)
  where id = p_renewal_id
  returning * into v_ren;

  return v_ren;
end;
$$;

-- Anular una renovación registrada por error (socios). No revierte la vigencia:
-- si hace falta, se corrige con set_membership_validity.
create or replace function public.void_renewal(p_renewal_id uuid, p_reason text)
returns public.membership_renewals
language plpgsql security definer set search_path = ''
as $$
declare
  v_ren public.membership_renewals;
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
  return v_ren;
end;
$$;

-- Corregir fechas de vigencia a mano (socios).
create or replace function public.set_membership_validity(
  p_member_id   uuid,
  p_valid_from  timestamptz,
  p_valid_until timestamptz
)
returns public.memberships
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms public.memberships;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios' using errcode = '42501';
  end if;
  if p_valid_until is null or (p_valid_from is not null and p_valid_until <= p_valid_from) then
    raise exception 'Fechas inválidas' using errcode = '22023';
  end if;

  insert into public.memberships (member_id) values (p_member_id) on conflict do nothing;
  update public.memberships
  set valid_from = p_valid_from, valid_until = p_valid_until, last_change_origin = 'app'
  where member_id = p_member_id;

  perform private.request_hik_sync(p_member_id);
  select * into v_ms from public.memberships where member_id = p_member_id;
  return v_ms;
end;
$$;

-- Bloquear / desbloquear el acceso (solo socios, D6).
create or replace function public.set_member_access(p_member_id uuid, p_enabled boolean)
returns public.memberships
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms public.memberships;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios pueden bloquear o desbloquear' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'Miembro no encontrado' using errcode = 'P0002';
  end if;

  insert into public.memberships (member_id) values (p_member_id) on conflict do nothing;
  update public.memberships set access_enabled = p_enabled, last_change_origin = 'app'
  where member_id = p_member_id;

  perform private.request_hik_sync(p_member_id);
  select * into v_ms from public.memberships where member_id = p_member_id;
  return v_ms;
end;
$$;

-- Descontar una clase de la tiquetera (staff). Al llegar a 0 se bloquea en HCAC (P1).
create or replace function public.use_class(p_member_id uuid)
returns public.class_usages
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms    public.memberships;
  v_usage public.class_usages;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select * into v_ms from public.memberships where member_id = p_member_id for update;
  if not found or v_ms.plan_kind is distinct from 'class_pack' then
    raise exception 'El miembro no tiene una tiquetera' using errcode = '22023';
  end if;
  if v_ms.valid_until is null or v_ms.valid_until < now() then
    raise exception 'La tiquetera está vencida' using errcode = '22023';
  end if;
  if v_ms.classes_used >= coalesce(v_ms.classes_total, 0) then
    raise exception 'No quedan clases en la tiquetera' using errcode = '22023';
  end if;

  update public.memberships set classes_used = classes_used + 1 where member_id = p_member_id;
  insert into public.class_usages (member_id, recorded_by)
  values (p_member_id, auth.uid())
  returning * into v_usage;

  perform private.request_hik_sync(p_member_id);
  return v_usage;
end;
$$;

create or replace function public.undo_class_usage(p_usage_id uuid)
returns public.class_usages
language plpgsql security definer set search_path = ''
as $$
declare
  v_usage public.class_usages;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  update public.class_usages set undone_at = now(), undone_by = auth.uid()
  where id = p_usage_id and undone_at is null
  returning * into v_usage;
  if not found then
    raise exception 'Registro no encontrado o ya deshecho' using errcode = 'P0002';
  end if;

  update public.memberships set classes_used = greatest(classes_used - 1, 0)
  where member_id = v_usage.member_id;

  perform private.request_hik_sync(v_usage.member_id);
  return v_usage;
end;
$$;

-- =====================================================================
-- 8. RPCs DEL BRIDGE
-- =====================================================================
create or replace function public.claim_next_access_command()
returns public.access_commands
language plpgsql security definer set search_path = ''
as $$
declare
  v_cmd public.access_commands;
begin
  if not private.is_bridge() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  update public.access_commands
  set status = 'processing', started_at = now(), attempts = attempts + 1
  where id = (
    select id from public.access_commands
    where status = 'pending'
    order by created_at
    for update skip locked
    limit 1
  )
  returning * into v_cmd;

  return v_cmd;
end;
$$;

create or replace function public.complete_access_command(
  p_command_id uuid,
  p_ok         boolean,
  p_error      text default null
)
returns public.access_commands
language plpgsql security definer set search_path = ''
as $$
declare
  v_cmd public.access_commands;
begin
  if not private.is_bridge() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select * into v_cmd from public.access_commands where id = p_command_id for update;
  if not found then
    raise exception 'Comando no encontrado' using errcode = 'P0002';
  end if;
  if v_cmd.status <> 'processing' then
    raise exception 'El comando no está en proceso (%)', v_cmd.status using errcode = '22023';
  end if;

  if not p_ok then
    update public.access_commands
    set status = case when attempts >= 5 then 'failed' else 'pending' end,
        finished_at = case when attempts >= 5 then now() end,
        last_error = p_error
    where id = p_command_id
    returning * into v_cmd;
    return v_cmd;
  end if;

  update public.access_commands
  set status = 'done', finished_at = now(), last_error = null
  where id = p_command_id
  returning * into v_cmd;

  -- Registrar lo que quedó confirmado en HCAC (prevención de ciclos).
  update public.memberships set
    hik_valid_from  = (v_cmd.payload->>'valid_from')::timestamptz,
    hik_valid_until = (v_cmd.payload->>'valid_until')::timestamptz,
    hik_synced_at   = now()
  where member_id = v_cmd.member_id;

  return v_cmd;
end;
$$;

create or replace function public.bridge_heartbeat(
  p_agent_version text default null,
  p_hik_version   text default null,
  p_persons_count int default null,
  p_error         text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_bridge() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  insert into public.bridge_status (id, agent_version, hik_version, persons_count, last_error, last_seen_at)
  values ('box-pc', p_agent_version, p_hik_version, p_persons_count, p_error, now())
  on conflict (id) do update set
    agent_version = coalesce(excluded.agent_version, public.bridge_status.agent_version),
    hik_version   = coalesce(excluded.hik_version, public.bridge_status.hik_version),
    persons_count = coalesce(excluded.persons_count, public.bridge_status.persons_count),
    last_error    = excluded.last_error,
    last_seen_at  = now();
end;
$$;

-- Lectura de HikCentral → app (PLAN §4.2). p_persons: arreglo de objetos
-- {hik_person_id, person_code, full_name, phone, valid_from, valid_until}.
-- p_full_snapshot: el lote contiene TODAS las personas (permite detectar eliminadas).
-- Un cambio de EndDate respecto al último confirmado (hik_valid_until) es un cambio hecho
-- directamente en HCAC: si extiende la vigencia crea una renovación pendiente de pago (D5);
-- si deja la vigencia en el futuro, además desbloquea el acceso (D35).
create or replace function public.bridge_sync_persons(p_persons jsonb, p_full_snapshot boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p           jsonb;
  v_hik_id      text;
  v_code        text;
  v_from        timestamptz;
  v_until       timestamptz;
  v_member      public.members;
  v_ms          public.memberships;
  v_created     int := 0;
  v_adopted     int := 0;
  v_extended    int := 0;
  v_changed     int := 0;
  v_skipped     int := 0;
  v_deactivated int := 0;
  v_seen        text[] := '{}';
begin
  if not private.is_bridge() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_persons) <> 'array' then
    raise exception 'p_persons debe ser un arreglo' using errcode = '22023';
  end if;

  for v_p in select * from jsonb_array_elements(p_persons) loop
    v_hik_id := nullif(v_p->>'hik_person_id', '');
    v_code   := nullif(regexp_replace(coalesce(v_p->>'person_code', ''), '[^0-9A-Za-z-]', '', 'g'), '');
    v_from   := (v_p->>'valid_from')::timestamptz;
    v_until  := (v_p->>'valid_until')::timestamptz;
    if v_hik_id is null then
      continue;
    end if;
    v_seen := v_seen || v_hik_id;

    select * into v_member from public.members where hik_person_id = v_hik_id;
    if not found and v_code is not null then
      update public.members set hik_person_id = v_hik_id
      where document_id = v_code and hik_person_id is null
      returning * into v_member;
    end if;

    -- Persona nueva en HCAC
    if v_member.id is null then
      insert into public.members (document_id, full_name, phone, hik_person_id, source)
      values (
        case when v_code is not null and not exists (select 1 from public.members where document_id = v_code)
             then v_code end,
        coalesce(nullif(trim(v_p->>'full_name'), ''), 'Sin nombre'),
        nullif(trim(v_p->>'phone'), ''),
        v_hik_id, 'hikcentral'
      ) returning * into v_member;
      insert into public.memberships (
        member_id, valid_from, valid_until, hik_valid_from, hik_valid_until, hik_target_until,
        hik_synced_at, last_change_origin
      ) values (
        v_member.id, v_from, v_until, v_from, v_until, v_until, now(), 'hikcentral'
      );
      v_created := v_created + 1;
      continue;
    end if;

    if not v_member.is_active then
      update public.members set is_active = true where id = v_member.id;
    end if;

    -- Cédula registrada después en HCAC (campo "Cc"): completarla si la app no tiene una.
    if v_member.document_id is null and v_code is not null
       and not exists (select 1 from public.members where document_id = v_code) then
      update public.members set document_id = v_code where id = v_member.id;
    end if;

    insert into public.memberships (member_id) values (v_member.id) on conflict do nothing;
    select * into v_ms from public.memberships where member_id = v_member.id for update;

    -- Hay comandos de la app en curso: HCAC aún no refleja el estado deseado.
    if exists (select 1 from public.access_commands
               where member_id = v_member.id and status in ('pending', 'processing')) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Primera vez que se ve esta persona: adoptar el estado de HCAC sin generar pendientes.
    -- Si el miembro se creó o renovó antes en la app, su vigencia manda y se envía a HCAC (D36).
    if v_ms.hik_synced_at is null then
      update public.memberships set
        valid_from       = coalesce(valid_from, v_from),
        valid_until      = coalesce(valid_until, v_until),
        hik_valid_from   = v_from,
        hik_valid_until  = v_until,
        hik_target_until = v_until,
        hik_synced_at    = now()
      where member_id = v_member.id;
      perform private.request_hik_sync(v_member.id);
      v_adopted := v_adopted + 1;
      continue;
    end if;

    -- Cambio de vigencia hecho directamente en HCAC (tolerancia de 60 s).
    if (v_until is null) <> (v_ms.hik_valid_until is null)
       or abs(extract(epoch from (v_until - v_ms.hik_valid_until))) > 60 then
      if v_until is not null
         and v_until > coalesce(v_ms.valid_until, '-infinity'::timestamptz) + interval '60 seconds' then
        insert into public.membership_renewals (
          member_id, plan_id, plan_name, period_start, period_end, origin, payment_status
        ) values (
          v_member.id, v_ms.plan_id, v_ms.plan_name,
          greatest(coalesce(v_ms.valid_until, v_from, now()), coalesce(v_from, '-infinity'::timestamptz)),
          v_until, 'hikcentral', 'pending'
        );
        v_extended := v_extended + 1;
      else
        v_changed := v_changed + 1;
      end if;
      update public.memberships set
        valid_from         = v_from,
        -- Vigencia futura fijada en HCAC = acceso habilitado. Si queda en el pasado y la app
        -- tenía el acceso bloqueado, se conserva la vigencia real de la app.
        valid_until        = case when v_until is null or v_until > now() or access_enabled
                                  then v_until else valid_until end,
        access_enabled     = case when v_until > now() then true else access_enabled end,
        hik_valid_from     = v_from,
        hik_valid_until    = v_until,
        hik_target_until   = v_until,
        last_change_origin = 'hikcentral'
      where member_id = v_member.id;
    end if;

    update public.memberships set hik_synced_at = now() where member_id = v_member.id;
  end loop;

  if p_full_snapshot then
    update public.members set is_active = false
    where hik_person_id is not null and is_active and not (hik_person_id = any(v_seen));
    get diagnostics v_deactivated = row_count;
  end if;

  update public.bridge_status set last_pull_at = now(), persons_count = jsonb_array_length(p_persons)
  where id = 'box-pc';

  return jsonb_build_object(
    'created', v_created, 'adopted', v_adopted, 'extended', v_extended,
    'changed', v_changed, 'skipped', v_skipped, 'deactivated', v_deactivated
  );
end;
$$;

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
    'public.renew_membership(uuid, uuid, public.payment_method, uuid, numeric, text, text)',
    'public.complete_pending_renewal(uuid, numeric, public.payment_method, uuid, uuid, text)',
    'public.void_renewal(uuid, text)',
    'public.set_membership_validity(uuid, timestamptz, timestamptz)',
    'public.set_member_access(uuid, boolean)',
    'public.use_class(uuid)',
    'public.undo_class_usage(uuid)',
    'public.claim_next_access_command()',
    'public.complete_access_command(uuid, boolean, text)',
    'public.bridge_heartbeat(text, text, int, text)',
    'public.bridge_sync_persons(jsonb, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
