-- 0030_announcements.sql
-- Comunicados del box (D49): los socios y coaches publican avisos ("el sábado no hay clase
-- de las 6:00", "recuerden el asado") que llegan como notificación (campana y push) y se ven
-- en Inicio mientras estén vigentes. Incluye envío programado, recordatorio automático antes
-- del evento y conteo de quién lo vio.
--
-- Los avisos usan la cola existente (public.notifications + send-push, 0020/0023) con el tipo
-- nuevo 'announcement'. El cron rokbox-announcements publica los programados y envía los
-- recordatorios.

-- =====================================================================
-- 1. TABLAS
-- =====================================================================
create table public.announcements (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null default 'notice' check (kind in ('notice', 'event', 'schedule')),
  title          text not null check (char_length(title) between 3 and 80),
  body           text not null check (char_length(body) between 1 and 500),
  event_at       timestamptz,
  visible_until  timestamptz not null,
  audience       text not null default 'all' check (audience in ('all', 'active_members')),
  notify         boolean not null default true,
  publish_at     timestamptz not null default now(),
  published_at   timestamptz,
  recipients_count int,
  remind         boolean not null default false,
  remind_at      timestamptz,
  reminded_at    timestamptz,
  author_id      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  deleted_by     uuid references auth.users(id) on delete set null,
  constraint announcements_remind_needs_event check (not remind or event_at is not null)
);

alter table public.announcements enable row level security;

create index announcements_visible_idx on public.announcements (visible_until desc) where deleted_at is null;
create index announcements_due_idx on public.announcements (publish_at) where published_at is null and deleted_at is null;
create index announcements_remind_idx on public.announcements (remind_at)
  where remind and reminded_at is null and deleted_at is null;

-- Quién vio cada comunicado (en Inicio o en la página de comunicados).
create table public.announcement_views (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  seen_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_views enable row level security;

create index announcement_views_user_idx on public.announcement_views (user_id);

-- =====================================================================
-- 2. HELPERS
-- =====================================================================
-- ¿El usuario actual tiene una membresía vigente (al día, por vencer o tiquetera sin clases)?
create or replace function private.has_valid_membership()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    join public.memberships ms on ms.member_id = m.id
    where m.profile_id = (select auth.uid())
      and m.is_active
      and ms.valid_until >= now()
      and coalesce(ms.access_enabled, true)
  );
$$;

-- Destinatarios según la audiencia. Socios y coaches siempre lo reciben; el bridge nunca.
create or replace function private.announcement_recipients(p_audience text, p_exclude uuid default null)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct u.id), '{}')
  from (
    select p.id from public.profiles p
    where p_audience = 'all'
    union
    select m.profile_id from public.members m
    join public.memberships ms on ms.member_id = m.id
    where p_audience = 'active_members' and m.profile_id is not null and m.is_active
      and ms.valid_until >= now() and coalesce(ms.access_enabled, true)
    union
    select r.user_id from public.user_roles r where r.role in ('partner', 'coach')
  ) u
  where u.id is not null
    and u.id is distinct from p_exclude
    and not exists (select 1 from public.user_roles b where b.user_id = u.id and b.role = 'bridge');
$$;

-- Cuándo se envía el recordatorio: la noche anterior (7:00 p. m.) si el evento es antes de
-- las 10:00 a. m.; si no, ese mismo día a las 8:00 a. m. (hora de Bogotá).
create or replace function private.announcement_remind_at(p_event_at timestamptz)
returns timestamptz
language sql immutable set search_path = ''
as $$
  select case
    when p_event_at is null then null
    when (p_event_at at time zone 'America/Bogota')::time < time '10:00'
      then (((p_event_at at time zone 'America/Bogota')::date - 1) + time '19:00') at time zone 'America/Bogota'
    else (((p_event_at at time zone 'America/Bogota')::date) + time '08:00') at time zone 'America/Bogota'
  end;
$$;

-- "sábado 15/11, 6:00 a. m." (sin depender del idioma del servidor).
create or replace function private.format_event_es(p_at timestamptz)
returns text
language sql immutable set search_path = ''
as $$
  select (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])
           [extract(dow from p_at at time zone 'America/Bogota')::int + 1]
         || ' ' || to_char(p_at at time zone 'America/Bogota', 'DD/MM')
         || ', ' || to_char(p_at at time zone 'America/Bogota', 'FMHH12:MI')
         || case when extract(hour from p_at at time zone 'America/Bogota') < 12 then ' a. m.' else ' p. m.' end;
$$;

create or replace function private.announcement_emoji(p_kind text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_kind when 'schedule' then '🗓️' when 'event' then '🎉' else '📢' end;
$$;

-- Publica (envía) un comunicado: avisos en la campana y push a los destinatarios.
create or replace function private.publish_announcement(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a          public.announcements;
  v_recipients uuid[];
begin
  select * into v_a from public.announcements
  where id = p_id and published_at is null and deleted_at is null
  for update;
  if not found then
    return;
  end if;

  v_recipients := private.announcement_recipients(v_a.audience, v_a.author_id);
  if v_a.notify then
    perform private.notify(
      v_recipients, 'announcement',
      private.announcement_emoji(v_a.kind) || ' ' || v_a.title,
      v_a.body,
      '/announcements?id=' || v_a.id,
      jsonb_build_object('announcement_id', v_a.id)
    );
  end if;

  update public.announcements set
    published_at     = now(),
    recipients_count = cardinality(v_recipients),
    -- Un recordatorio que ya pasó no se envía.
    remind           = remind and remind_at > now()
  where id = p_id;
end;
$$;

-- Envía el recordatorio de un evento.
create or replace function private.send_announcement_reminder(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a   public.announcements;
  v_day text;
begin
  select * into v_a from public.announcements
  where id = p_id and remind and reminded_at is null and published_at is not null
    and deleted_at is null and event_at > now()
  for update;
  if not found then
    return;
  end if;

  v_day := case
    when (v_a.event_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date then 'Hoy'
    when (v_a.event_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date + 1 then 'Mañana'
    else 'Pronto'
  end;

  perform private.notify(
    private.announcement_recipients(v_a.audience, null), 'announcement',
    '⏰ ' || v_day || ': ' || v_a.title,
    initcap(left(private.format_event_es(v_a.event_at), 1)) || substr(private.format_event_es(v_a.event_at), 2)
      || ' · ' || v_a.body,
    '/announcements?id=' || v_a.id,
    jsonb_build_object('announcement_id', v_a.id, 'reminder', true)
  );

  update public.announcements set reminded_at = now() where id = p_id;
end;
$$;

-- =====================================================================
-- 3. RLS
-- =====================================================================
-- Staff ve todos (programados, vencidos y borrados, para el historial). Los demás ven los
-- publicados y vigentes de su audiencia.
create policy "announcements: staff o vigentes"
  on public.announcements for select to authenticated
  using (
    (select private.is_staff())
    or (deleted_at is null and published_at is not null and visible_until > now()
        and (audience = 'all' or (select private.has_valid_membership())))
  );

-- Escritura solo por RPC.

create policy "announcement_views: propias o staff"
  on public.announcement_views for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- Escritura solo por RPC (mark_announcements_seen).

-- =====================================================================
-- 4. RPC
-- =====================================================================
-- Crea (p_id nulo) o edita un comunicado. Si la hora de envío ya llegó, se publica en el acto.
-- Editar uno ya enviado corrige el texto en la app y en la campana, pero no reenvía el push.
create or replace function public.save_announcement(
  p_id            uuid,
  p_kind          text,
  p_title         text,
  p_body          text,
  p_event_at      timestamptz default null,
  p_visible_until timestamptz default null,
  p_audience      text default 'all',
  p_publish_at    timestamptz default null,
  p_notify        boolean default true,
  p_remind        boolean default false
)
returns public.announcements
language plpgsql security definer set search_path = ''
as $$
declare
  v_old     public.announcements;
  v_row     public.announcements;
  v_title   text := btrim(coalesce(p_title, ''));
  v_body    text := btrim(coalesce(p_body, ''));
  v_publish timestamptz;
  v_until   timestamptz;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if char_length(v_title) < 3 or char_length(v_title) > 80 then
    raise exception 'El título debe tener entre 3 y 80 caracteres' using errcode = '22023';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'El mensaje debe tener entre 1 y 500 caracteres' using errcode = '22023';
  end if;
  if coalesce(p_kind, '') not in ('notice', 'event', 'schedule') then
    raise exception 'Tipo de comunicado inválido' using errcode = '22023';
  end if;
  if coalesce(p_audience, '') not in ('all', 'active_members') then
    raise exception 'Audiencia inválida' using errcode = '22023';
  end if;
  if coalesce(p_remind, false) and p_event_at is null then
    raise exception 'El recordatorio necesita la fecha del evento' using errcode = '22023';
  end if;

  if p_id is not null then
    select * into v_old from public.announcements where id = p_id and deleted_at is null for update;
    if not found then
      raise exception 'El comunicado no existe' using errcode = 'P0002';
    end if;
  end if;

  -- Hora de envío: la que ya tenía si ya se envió; si no, la pedida o ahora.
  v_publish := case
    when v_old.published_at is not null then v_old.publish_at
    else greatest(coalesce(p_publish_at, now()), now())
  end;
  -- Visible hasta: la pedida; si no, el fin del día del evento; si no, 7 días después del envío.
  v_until := coalesce(
    p_visible_until,
    case when p_event_at is not null
         then (((p_event_at at time zone 'America/Bogota')::date + 1)::timestamp) at time zone 'America/Bogota'
    end,
    v_publish + interval '7 days'
  );
  if v_until <= v_publish then
    raise exception 'La fecha "visible hasta" debe ser posterior al envío' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.announcements (
      kind, title, body, event_at, visible_until, audience, notify, publish_at, remind, remind_at, author_id
    ) values (
      p_kind, v_title, v_body, p_event_at, v_until, p_audience, coalesce(p_notify, true), v_publish,
      coalesce(p_remind, false), private.announcement_remind_at(p_event_at), auth.uid()
    ) returning * into v_row;
  else
    update public.announcements set
      kind          = p_kind,
      title         = v_title,
      body          = v_body,
      event_at      = p_event_at,
      visible_until = v_until,
      audience      = p_audience,
      notify        = case when published_at is null then coalesce(p_notify, true) else notify end,
      publish_at    = v_publish,
      remind        = coalesce(p_remind, false)
                      and (reminded_at is not null or published_at is null
                           or private.announcement_remind_at(p_event_at) > now()),
      remind_at     = private.announcement_remind_at(p_event_at),
      -- Si cambió la fecha del evento, el recordatorio se puede volver a enviar.
      reminded_at   = case when event_at is distinct from p_event_at then null else reminded_at end,
      updated_at    = now()
    where id = p_id
    returning * into v_row;

    -- Corregir el texto en la campana de quienes ya lo recibieron.
    if v_row.published_at is not null then
      update public.notifications set
        title = private.announcement_emoji(v_row.kind) || ' ' || v_row.title,
        body  = v_row.body
      where type = 'announcement'
        and data->>'announcement_id' = v_row.id::text
        and coalesce((data->>'reminder')::boolean, false) = false;
    end if;
  end if;

  if v_row.published_at is null and v_row.publish_at <= now() then
    perform private.publish_announcement(v_row.id);
    select * into v_row from public.announcements where id = v_row.id;
  end if;
  return v_row;
end;
$$;

-- Borrado lógico: deja de verse y sale de la campana de todos.
create or replace function public.delete_announcement(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  update public.announcements set deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
  where id = p_id and deleted_at is null;
  if not found then
    raise exception 'El comunicado no existe' using errcode = 'P0002';
  end if;
  delete from public.notifications
  where type = 'announcement' and data->>'announcement_id' = p_id::text;
end;
$$;

-- Marca como vistos los comunicados que el usuario tiene en pantalla (solo los que puede ver).
create or replace function public.mark_announcements_seen(p_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  insert into public.announcement_views (announcement_id, user_id)
  select a.id, auth.uid()
  from public.announcements a
  where a.id = any(coalesce(p_ids, '{}'))
    and a.deleted_at is null and a.published_at is not null and a.visible_until > now()
    and (a.audience = 'all' or private.has_valid_membership() or private.is_staff())
  on conflict do nothing;
end;
$$;

-- Lista para Gestión, con autor y cuántos lo vieron.
create view public.announcement_list with (security_invoker = true) as
select
  a.*,
  nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') as author_name,
  (select count(*) from public.announcement_views v where v.announcement_id = a.id)::int as seen_count,
  case
    when a.deleted_at is not null   then 'deleted'
    when a.published_at is null     then 'scheduled'
    when a.visible_until > now()    then 'active'
    else 'expired'
  end as status
from public.announcements a
left join public.profiles p on p.id = a.author_id;

grant select on public.announcement_list to authenticated;

-- =====================================================================
-- 5. AVISOS: TIPO NUEVO Y TRABAJO PROGRAMADO
-- =====================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'like', 'comment', 'follow',
  'membership_expiring', 'membership_renewed', 'classes_low',
  'debt_charged', 'debt_payment', 'debt_reminder',
  'link_reviewed',
  'renewal_pending', 'link_request', 'bridge_offline', 'access_command_failed', 'weekly_summary',
  'announcement'
));

create index if not exists notifications_announcement_idx
  on public.notifications ((data->>'announcement_id')) where type = 'announcement';

create or replace function private.job_announcements()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.announcements
    where published_at is null and deleted_at is null and publish_at <= now()
    order by publish_at
  loop
    perform private.publish_announcement(v_id);
  end loop;

  for v_id in
    select id from public.announcements
    where remind and reminded_at is null and deleted_at is null and published_at is not null
      and remind_at <= now() and event_at > now()
    order by remind_at
  loop
    perform private.send_announcement_reminder(v_id);
  end loop;
end;
$$;

-- Historial de cambios (0019).
create trigger announcements_audit
  after insert or update or delete on public.announcements
  for each row execute function private.audit_trigger('id');

-- =====================================================================
-- 6. PERMISOS
-- =====================================================================
-- private.has_valid_membership() conserva el permiso por defecto: la usa la RLS de announcements.
revoke all on function private.announcement_recipients(text, uuid) from public, anon, authenticated;
revoke all on function private.publish_announcement(uuid) from public, anon, authenticated;
revoke all on function private.send_announcement_reminder(uuid) from public, anon, authenticated;
revoke all on function private.job_announcements() from public, anon, authenticated;

revoke all on function public.save_announcement(uuid, text, text, text, timestamptz, timestamptz, text, timestamptz, boolean, boolean) from public, anon;
grant execute on function public.save_announcement(uuid, text, text, text, timestamptz, timestamptz, text, timestamptz, boolean, boolean) to authenticated;
revoke all on function public.delete_announcement(uuid) from public, anon;
grant execute on function public.delete_announcement(uuid) to authenticated;
revoke all on function public.mark_announcements_seen(uuid[]) from public, anon;
grant execute on function public.mark_announcements_seen(uuid[]) to authenticated;

select cron.schedule('rokbox-announcements', '* * * * *', 'select private.job_announcements()');
