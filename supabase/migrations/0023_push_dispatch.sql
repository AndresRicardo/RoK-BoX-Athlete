-- 0023_push_dispatch.sql
-- Envío de notificaciones push (F5, D18). public.notifications es la cola: toda fila con
-- pushed_at nulo está pendiente de enviarse como push.
--
-- Flujo:
--   1. Un INSERT en notifications (trigger por sentencia) llama por pg_net a la Edge
--      Function send-push. Un cron cada minuto repite la llamada si quedó algo pendiente.
--   2. send-push reclama un lote con claim_push_batch() (marca pushed_at) y envía el push
--      a las suscripciones de cada destinatario.
--
-- Configuración (fuera de git; ver supabase/README.md): dos secretos en Vault,
-- push_dispatch_url y push_dispatch_secret, y el mismo secreto en la función
-- (PUSH_DISPATCH_SECRET). Sin esa configuración el disparo no hace nada, así que la
-- migración es segura en cualquier entorno.

create extension if not exists pg_net with schema extensions;

-- =====================================================================
-- 1. DISPARO HACIA LA EDGE FUNCTION
-- =====================================================================
create or replace function private.dispatch_push()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

create or replace function private.notifications_dispatch_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.dispatch_push();
  return null;
end;
$$;

-- Por sentencia: un aviso a varios destinatarios (p. ej. a todos los socios) es una sola llamada.
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each statement execute function private.notifications_dispatch_push();

-- Respaldo: si una llamada se perdió (función caída, timeout), se reintenta cada minuto.
create or replace function private.job_push_retry()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.notifications
             where pushed_at is null and created_at > now() - interval '1 day') then
    perform private.dispatch_push();
  end if;
end;
$$;

-- =====================================================================
-- 2. LOTE PARA LA EDGE FUNCTION (solo service_role)
-- =====================================================================
-- Marca como enviadas las pendientes (máximo p_limit) y devuelve las que hay que enviar.
-- Las de más de un día se descartan sin enviar. Los tipos que el destinatario desactivó
-- se marcan pero no se devuelven (los avisos sociales de 0012 no pasan por private.notify).
create or replace function public.claim_push_batch(p_limit int default 100)
returns table (
  id            uuid,
  recipient_id  uuid,
  type          text,
  title         text,
  body          text,
  link          text,
  actor_id      uuid,
  actor_handle  text,
  event_type    text,
  event_payload jsonb,
  comment_body  text
)
language sql security definer set search_path = ''
as $$
  update public.notifications set pushed_at = now()
  where pushed_at is null and created_at < now() - interval '1 day';

  with batch as (
    select n.id from public.notifications n
    where n.pushed_at is null
    order by n.created_at
    limit greatest(coalesce(p_limit, 100), 1)
    for update skip locked
  ), claimed as (
    update public.notifications n set pushed_at = now()
    from batch where n.id = batch.id
    returning n.*
  )
  select c.id, c.recipient_id, c.type, c.title, c.body, c.link, c.actor_id, p.display_name,
         c.event_type, c.event_payload, c.comment_body
  from claimed c
  left join public.profiles p on p.id = c.actor_id
  where not exists (select 1 from public.notification_preferences np
                    where np.user_id = c.recipient_id and c.type = any(np.disabled_types))
  order by c.created_at;
$$;

revoke all on function public.claim_push_batch(int) from public, anon, authenticated;
grant execute on function public.claim_push_batch(int) to service_role;

-- =====================================================================
-- 3. REGISTRO DE SUSCRIPCIONES
-- =====================================================================
-- Un mismo teléfono puede cambiar de cuenta: el endpoint pasa al usuario actual
-- (la RLS de push_subscriptions no deja tocar la fila de otro usuario).
create or replace function public.register_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns public.push_subscriptions
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.push_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Suscripción inválida' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_used_at)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), now())
  on conflict (endpoint) do update set
    user_id      = excluded.user_id,
    p256dh       = excluded.p256dh,
    auth         = excluded.auth,
    user_agent   = excluded.user_agent,
    last_used_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

revoke all on function private.dispatch_push() from public, anon, authenticated;
revoke all on function private.notifications_dispatch_push() from public, anon, authenticated;
revoke all on function private.job_push_retry() from public, anon, authenticated;

select cron.schedule('rokbox-push-retry', '* * * * *', 'select private.job_push_retry()');
