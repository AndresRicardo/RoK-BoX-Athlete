-- 0020_notifications.sql
-- Notificaciones de gestión (D18): extiende public.notifications (0012) para avisos del
-- sistema sin actor, suscripciones Web Push, preferencias, avisos inmediatos (triggers)
-- y avisos programados (pg_cron). El envío push lo hace la Edge Function send-push (F5),
-- que procesa las notificaciones con pushed_at nulo.

-- =====================================================================
-- 1. EXTENSIÓN DE notifications
-- =====================================================================
alter table public.notifications alter column actor_id drop not null;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'like', 'comment', 'follow',
  'membership_expiring', 'membership_renewed', 'classes_low',
  'debt_charged', 'debt_payment', 'debt_reminder',
  'link_reviewed',
  'renewal_pending', 'link_request', 'bridge_offline', 'access_command_failed', 'weekly_summary'
));
alter table public.notifications
  add column if not exists title     text,
  add column if not exists body      text,
  add column if not exists link      text,
  add column if not exists data      jsonb,
  add column if not exists pushed_at timestamptz;

create index if not exists notifications_push_queue_idx
  on public.notifications (created_at) where pushed_at is null;

-- =====================================================================
-- 2. SUSCRIPCIONES PUSH Y PREFERENCIAS
-- =====================================================================
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.push_subscriptions enable row level security;

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create policy "push_subscriptions: propias"
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.notification_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  disabled_types text[] not null default '{}',
  updated_at     timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences: propias"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- =====================================================================
-- 3. HELPERS
-- =====================================================================
create or replace function private.notify(
  p_recipients uuid[],
  p_type       text,
  p_title      text,
  p_body       text,
  p_link       text default null,
  p_data       jsonb default null
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, type, title, body, link, data)
  select r, null, p_type, p_title, p_body, p_link, p_data
  from unnest(p_recipients) as r
  where r is not null
    and not exists (select 1 from public.notification_preferences np
                    where np.user_id = r and p_type = any(np.disabled_types));
$$;

create or replace function private.role_user_ids(p_roles text[])
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct user_id), '{}') from public.user_roles where role = any(p_roles);
$$;

create or replace function private.cop(p_amount numeric)
returns text
language sql immutable set search_path = ''
as $$
  select '$' || replace(to_char(coalesce(p_amount, 0), 'FM999G999G999G990'), ',', '.');
$$;

-- =====================================================================
-- 4. AVISOS INMEDIATOS
-- =====================================================================

-- Atleta: cargo nuevo en su cuenta (al aumentar el total de una deuda).
create or replace function private.notify_debt_charged()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if new.total_amount > old.total_amount and new.voided_at is null then
    select profile_id into v_profile from public.members where id = new.member_id;
    perform private.notify(array[v_profile], 'debt_charged', 'Nuevo cargo en tu cuenta',
      new.concept || ': ' || private.cop(new.total_amount - old.total_amount),
      '/?tab=debts', jsonb_build_object('debt_id', new.id));
  end if;
  return null;
end;
$$;

create trigger debts_notify_charged
  after update of total_amount on public.debts
  for each row execute function private.notify_debt_charged();

-- Atleta: abono registrado.
create or replace function private.notify_debt_payment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile uuid;
  v_balance numeric;
  v_debt_id uuid := new.debt_id;
begin
  select m.profile_id into v_profile
  from public.debts d join public.members m on m.id = d.member_id where d.id = v_debt_id;
  select greatest(d.total_amount - coalesce((select sum(amount) from public.debt_payments p
                                             where p.debt_id = d.id and p.deleted_at is null), 0), 0)
    into v_balance
  from public.debts d where d.id = v_debt_id;
  perform private.notify(array[v_profile], 'debt_payment', 'Abono registrado',
    'Abonaste ' || private.cop(new.amount) || '. Saldo pendiente: ' || private.cop(v_balance),
    '/?tab=debts', jsonb_build_object('debt_id', v_debt_id, 'payment_id', new.id));
  return null;
end;
$$;

create trigger debt_payments_notify
  after insert on public.debt_payments
  for each row execute function private.notify_debt_payment();

-- Renovaciones: atleta (renovada) y socios (pendiente de pago desde HikCentral).
create or replace function private.notify_renewal()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.members;
begin
  select * into v_member from public.members where id = new.member_id;

  if new.payment_status = 'pending' and new.voided_at is null
     and (tg_op = 'INSERT') then
    perform private.notify(private.role_user_ids(array['partner']), 'renewal_pending',
      'Renovación sin pago registrado',
      v_member.full_name || ' fue renovado en HikCentral hasta '
        || to_char(new.period_end at time zone 'America/Bogota', 'DD/MM/YYYY') || '. Registra el pago.',
      '/gestion/pendientes', jsonb_build_object('renewal_id', new.id, 'member_id', new.member_id));
  end if;

  if new.voided_at is null and (tg_op = 'INSERT' or old.period_end is distinct from new.period_end
                                 or (old.payment_status = 'pending' and new.payment_status = 'paid')) then
    perform private.notify(array[v_member.profile_id], 'membership_renewed', 'Membresía renovada',
      'Tu plan ' || new.plan_name || ' está vigente hasta '
        || to_char(new.period_end at time zone 'America/Bogota', 'DD/MM/YYYY') || '.',
      '/', jsonb_build_object('renewal_id', new.id));
  end if;
  return null;
end;
$$;

create trigger membership_renewals_notify
  after insert or update on public.membership_renewals
  for each row execute function private.notify_renewal();

-- Atleta: quedan pocas clases en la tiquetera.
create or replace function private.notify_classes_low()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_left    int;
  v_profile uuid;
begin
  if new.classes_total is not null and new.classes_used > old.classes_used then
    v_left := new.classes_total - new.classes_used;
    if v_left <= 2 then
      select profile_id into v_profile from public.members where id = new.member_id;
      perform private.notify(array[v_profile], 'classes_low',
        case when v_left = 0 then 'Se acabaron tus clases' else 'Te quedan pocas clases' end,
        case when v_left = 0 then 'Usaste todas las clases de tu tiquetera. Renueva para seguir entrenando.'
             else 'Te quedan ' || v_left || ' clase(s) en tu tiquetera.' end,
        '/', jsonb_build_object('member_id', new.member_id, 'classes_left', v_left));
    end if;
  end if;
  return null;
end;
$$;

create trigger memberships_notify_classes
  after update of classes_used on public.memberships
  for each row execute function private.notify_classes_low();

-- Solicitudes de vínculo: staff (nueva) y atleta (respuesta).
create or replace function private.notify_link_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify(private.role_user_ids(array['partner', 'coach']), 'link_request',
      'Solicitud de vínculo', 'Un atleta pidió vincular la cédula ' || new.document_id || '.',
      '/gestion/pendientes', jsonb_build_object('request_id', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform private.notify(array[new.profile_id], 'link_reviewed',
      case when new.status = 'approved' then 'Cuenta vinculada' else 'Vínculo rechazado' end,
      case when new.status = 'approved' then 'Ya puedes ver tu membresía y tus pagos en la app.'
           else 'Tu solicitud de vínculo fue rechazada. ' || coalesce(new.review_note, '') end,
      '/profile', jsonb_build_object('request_id', new.id));
  end if;
  return null;
end;
$$;

create trigger member_link_requests_notify
  after insert or update on public.member_link_requests
  for each row execute function private.notify_link_request();

-- Socios: comando hacia HikCentral fallido definitivamente.
create or replace function private.notify_access_command_failed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if new.status = 'failed' and old.status <> 'failed' then
    select full_name into v_name from public.members where id = new.member_id;
    perform private.notify(private.role_user_ids(array['partner']), 'access_command_failed',
      'No se pudo actualizar HikCentral',
      'Falló "' || new.command || '" para ' || coalesce(v_name, 'un miembro') || ': '
        || coalesce(new.last_error, 'error desconocido'),
      '/gestion/ajustes', jsonb_build_object('command_id', new.id, 'member_id', new.member_id));
  end if;
  return null;
end;
$$;

create trigger access_commands_notify_failed
  after update of status on public.access_commands
  for each row execute function private.notify_access_command_failed();

-- =====================================================================
-- 5. AVISOS PROGRAMADOS (P2: horarios del plan, hora Bogotá = UTC-5)
-- =====================================================================

-- Diario 8:00: membresías que vencen en 3 días o hoy.
create or replace function private.job_membership_expiring()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  for r in
    select m.profile_id, ms.member_id, ms.valid_until,
           (ms.valid_until at time zone 'America/Bogota')::date - v_today as days
    from public.memberships ms
    join public.members m on m.id = ms.member_id
    where m.profile_id is not null and m.is_active and ms.access_enabled
      and (ms.valid_until at time zone 'America/Bogota')::date - v_today in (0, 3)
  loop
    perform private.notify(array[r.profile_id], 'membership_expiring',
      case when r.days = 0 then 'Tu membresía vence hoy' else 'Tu membresía vence en 3 días' end,
      'Vigente hasta ' || to_char(r.valid_until at time zone 'America/Bogota', 'DD/MM/YYYY')
        || '. Renueva para no perder el acceso.',
      '/', jsonb_build_object('member_id', r.member_id));
  end loop;
end;
$$;

-- Lunes 9:00: recordatorio de saldo pendiente.
create or replace function private.job_debt_reminders()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select m.profile_id, sum(d.balance) as balance
    from public.debts d join public.members m on m.id = d.member_id
    where d.voided_at is null and d.balance > 0 and m.profile_id is not null
    group by m.profile_id
  loop
    perform private.notify(array[r.profile_id], 'debt_reminder', 'Tienes un saldo pendiente',
      'Debes ' || private.cop(r.balance) || ' en el box.', '/?tab=debts', null);
  end loop;
end;
$$;

-- Lunes 7:00: resumen semanal para socios (semana anterior lunes–domingo).
create or replace function private.job_weekly_summary()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_today    date := (now() at time zone 'America/Bogota')::date;
  v_start    date := v_today - 7;
  v_from     timestamptz := (v_today - 7)::timestamp at time zone 'America/Bogota';
  v_to       timestamptz := v_today::timestamp at time zone 'America/Bogota';
  v_income   numeric;
  v_box      numeric;
  v_personal numeric;
  v_expiring int;
  v_pending  int;
begin
  select coalesce(sum(amount), 0) into v_income from public.incomes
  where deleted_at is null and received_at >= v_from and received_at < v_to;
  select coalesce(sum(amount) filter (where scope = 'BOX'), 0),
         coalesce(sum(amount) filter (where scope = 'PERSONAL'), 0)
    into v_box, v_personal
  from public.expenses where deleted_at is null and spent_at >= v_from and spent_at < v_to;
  select count(*) into v_expiring from public.memberships ms
  join public.members m on m.id = ms.member_id
  where m.is_active and (ms.valid_until at time zone 'America/Bogota')::date between v_today and v_today + 6;
  select count(*) into v_pending from public.membership_renewals
  where payment_status = 'pending' and voided_at is null;

  perform private.notify(private.role_user_ids(array['partner']), 'weekly_summary',
    'Resumen semanal',
    'Semana del ' || to_char(v_start, 'DD/MM') || ': ingresos ' || private.cop(v_income)
      || ', gastos box ' || private.cop(v_box) || ', personales ' || private.cop(v_personal)
      || '. Vencen esta semana: ' || v_expiring
      || case when v_pending > 0 then '. Pagos pendientes por registrar: ' || v_pending else '' end || '.',
    '/gestion', jsonb_build_object('income', v_income, 'box_expenses', v_box,
                                   'personal_expenses', v_personal, 'expiring', v_expiring,
                                   'pending_renewals', v_pending));
end;
$$;

-- Cada 10 min: bridge sin señal por más de 30 min (máximo un aviso cada 6 h).
create or replace function private.job_bridge_watchdog()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_last timestamptz;
begin
  select last_seen_at into v_last from public.bridge_status where id = 'box-pc';
  if v_last is null or v_last > now() - interval '30 minutes' then
    return;
  end if;
  if exists (select 1 from public.notifications
             where type = 'bridge_offline' and created_at > now() - interval '6 hours') then
    return;
  end if;
  perform private.notify(private.role_user_ids(array['partner']), 'bridge_offline',
    'El PC del box no responde',
    'El bridge de HikCentral no da señal desde '
      || to_char(v_last at time zone 'America/Bogota', 'DD/MM HH24:MI')
      || '. Los cambios de acceso quedarán en cola hasta que vuelva.',
    '/gestion/ajustes', null);
end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- =====================================================================
-- 6. PROGRAMACIÓN (pg_cron, horas en UTC)
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('rokbox-membership-expiring', '0 13 * * *', 'select private.job_membership_expiring()');
select cron.schedule('rokbox-debt-reminders',      '0 14 * * 1', 'select private.job_debt_reminders()');
select cron.schedule('rokbox-weekly-summary',      '0 12 * * 1', 'select private.job_weekly_summary()');
select cron.schedule('rokbox-bridge-watchdog',     '*/10 * * * *', 'select private.job_bridge_watchdog()');
