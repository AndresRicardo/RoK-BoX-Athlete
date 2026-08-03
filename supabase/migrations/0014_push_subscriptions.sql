-- FASE 16: Web Push (subscripciones + trigger de envio)
-- Ejecutar en Supabase Studio SQL Editor
--
--   1) Tabla push_subscriptions: una fila por (user_id, endpoint).
--      El cliente guarda aqui su PushSubscription (endpoint + keys).
--   2) RLS: solo el dueno ve/borra sus filas. INSERT solo a si mismo.
--      No hay UPDATE (si la subscripcion rota, el cliente borra y reinserta).
--   3) Trigger sobre INSERT de feed_events: notifica a todos los
--      seguidores del atleta (fan-out via INSERT ... SELECT).
--      Cada insercion en notifications dispara la Edge Function
--      send-push (via pg_net) que envia el push a las subscripciones
--      del destinatario.
--
-- Notas:
--   - El trigger sobre notifications es generico: sirve para los 4
--     tipos existentes (like, comment, follow) y para el nuevo new_post
--     que crea este trigger de feed_events.
--   - pg_net viene con Supabase self-hosted. Si no esta habilitado,
--     ver docs/supabase.md.
--   - La Edge Function send-push vive en supabase/functions/send-push/
--     y se despliega con `supabase functions deploy send-push`.

-- ============================================================
-- 1) PUSH_SUBSCRIPTIONS
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own push subscriptions" on public.push_subscriptions;
create policy "Users insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 2) NOTIFICATIONS: ampliar el CHECK para incluir 'new_post'
-- ============================================================

-- El CHECK original de 0012_notifications solo permite
-- ('like', 'comment', 'follow'). Anadimos 'new_post' para los
-- eventos del feed de un atleta seguido.
do $$
begin
  alter table public.notifications
    drop constraint if exists notifications_type_check;
  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('like', 'comment', 'follow', 'new_post'));
end $$;

-- ============================================================
-- 3) TRIGGERS
-- ============================================================

-- 3.1) Fan-out de "nueva publicacion" a los seguidores
create or replace function public.handle_new_post_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Inserta una notification por cada seguidor (excepto self-follow,
  -- que ya esta bloqueado por la CHECK de follows).
  insert into public.notifications
    (recipient_id, actor_id, type, event_type, event_payload, event_id)
  select
    f.follower_id,
    NEW.user_id,
    'new_post',
    NEW.event_type,
    NEW.payload,
    NEW.id
  from public.follows f
  where f.followed_id = NEW.user_id
    and f.follower_id <> NEW.user_id;

  return NEW;
end;
$$;

drop trigger if exists feed_events_new_post on public.feed_events;
create trigger feed_events_new_post
  after insert on public.feed_events
  for each row execute function public.handle_new_post_notification();

-- 3.2) Disparar la Edge Function send-push al insertar notifications.
--      Usa pg_net (incluido en Supabase) para hacer POST async. Si pg_net
--      no esta disponible, la insercion sigue funcionando (solo no hay push).
do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pg_net'
  ) then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_service_key text;
  v_payload jsonb;
begin
  -- URL base de Supabase: usamos la env var del cluster (configurada en
  -- el docker-compose). Si no esta disponible, abortamos silenciosamente
  -- para no romper el INSERT de notifications.
  v_url := current_setting('app.settings.supabase_url', true)
           || '/functions/v1/send-push';
  v_service_key := current_setting('app.settings.service_role_key', true);

  if v_url is null or v_service_key is null or v_url = '/functions/v1/send-push' then
    return NEW;
  end if;

  v_payload := jsonb_build_object('notification_id', NEW.id);

  -- Async POST; no bloquea la insercion.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := v_payload::text
  );

  return NEW;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.send_push_for_notification();

-- Configuracion: las settings 'app.settings.*' se setean una vez con:
--   alter database postgres set app.settings.supabase_url = 'https://<host>';
--   alter database postgres set app.settings.service_role_key = '<service-role-key>';
-- (hecho fuera de la migracion porque la service role key no debe
-- quedar en el repo; ver docs/supabase.md)
