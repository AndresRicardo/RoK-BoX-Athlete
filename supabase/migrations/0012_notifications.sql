-- FASE 14: Notificaciones
-- Ejecutar en Supabase Studio SQL Editor
--
--   1) Tabla notifications: desnormalizada (snapshot del evento y del
--      comentario) para que el panel no tenga que joinear al renderizar.
--   2) Triggers security definer sobre feed_likes, feed_comments y follows
--      generan/eliminan notificaciones.
--   3) RLS: SELECT solo propias. Sin INSERT/UPDATE/DELETE para clientes:
--      solo escriben los triggers.
--
-- Tipos: 'like' (reaccionan a tu evento), 'comment' (comentan en tu evento),
-- 'follow' (te siguen). Se salta self-notifications (recipient = actor).

-- ============================================================
-- 1) NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'follow')),
  event_type text,
  event_payload jsonb,
  comment_body text,
  event_id uuid references public.feed_events(id) on delete cascade,
  comment_id uuid references public.feed_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_no_self check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- Solo puedes ver tus propias notificaciones
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

-- Marcar como leidas (batch o individual) por el destinatario
drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- (Sin policy de INSERT/DELETE para clientes: solo triggers)

-- ============================================================
-- 2) TRIGGERS
-- ============================================================

-- Notificacion de LIKE
create or replace function public.handle_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_event_type text;
  v_event_payload jsonb;
begin
  if (TG_OP = 'INSERT') then
    -- dueño del evento (recipient); saltar self-like
    select e.user_id, e.event_type, e.payload
      into v_recipient, v_event_type, v_event_payload
      from public.feed_events e
      where e.id = NEW.event_id;

    if v_recipient is null or v_recipient = NEW.user_id then
      return NEW;
    end if;

    insert into public.notifications
      (recipient_id, actor_id, type, event_type, event_payload, event_id)
    values
      (v_recipient, NEW.user_id, 'like', v_event_type, v_event_payload, NEW.event_id);

    return NEW;
  else
    -- un like que desaparece elimina su notificacion
    delete from public.notifications
    where type = 'like'
      and event_id = OLD.event_id
      and actor_id = OLD.user_id;
    return OLD;
  end if;
end;
$$;

drop trigger if exists feed_likes_notification on public.feed_likes;
create trigger feed_likes_notification
  after insert or delete on public.feed_likes
  for each row execute function public.handle_like_notification();

-- Notificacion de COMMENT
create or replace function public.handle_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_event_type text;
  v_event_payload jsonb;
begin
  select e.user_id, e.event_type, e.payload
    into v_recipient, v_event_type, v_event_payload
    from public.feed_events e
    where e.id = NEW.event_id;

  -- saltar self-comment
  if v_recipient is null or v_recipient = NEW.user_id then
    return NEW;
  end if;

  insert into public.notifications
    (recipient_id, actor_id, type, event_type, event_payload, comment_body, event_id, comment_id)
  values
    (v_recipient, NEW.user_id, 'comment', v_event_type, v_event_payload, NEW.body, NEW.event_id, NEW.id);

  return NEW;
end;
$$;

drop trigger if exists feed_comments_notification on public.feed_comments;
create trigger feed_comments_notification
  after insert on public.feed_comments
  for each row execute function public.handle_comment_notification();

-- Notificacion de FOLLOW
create or replace function public.handle_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- el CHECK de la tabla ya evita self-follow, pero lo dejamos defensivo
  if NEW.follower_id = NEW.followed_id then
    return NEW;
  end if;

  insert into public.notifications
    (recipient_id, actor_id, type)
  values
    (NEW.followed_id, NEW.follower_id, 'follow');

  return NEW;
end;
$$;

drop trigger if exists follows_notification on public.follows;
create trigger follows_notification
  after insert on public.follows
  for each row execute function public.handle_follow_notification();
