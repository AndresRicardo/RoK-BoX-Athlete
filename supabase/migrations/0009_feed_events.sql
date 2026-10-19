-- FASE 12: Feed de actividad (fan-out on write con triggers)
-- Ejecutar en Supabase Studio SQL Editor
--
--   1) Tabla feed_events: eventos desnormalizados listos para render
--   2) RLS: lees tus eventos y los de quienes sigues
--   3) Triggers INSERT/DELETE en prs, benchmarks, achievements y
--      unlocked_movements que mantienen el feed sincronizado
--
-- Notas:
--   - No hay policy INSERT para clientes: solo escriben los triggers
--     (funciones security definer, bypasean RLS). Nadie puede falsificar
--     eventos desde la app.
--   - Los UPDATE no generan eventos: el feed muestra el snapshot original.

-- ============================================================
-- 1) FEED_EVENTS
-- ============================================================

create table if not exists public.feed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null
    check (event_type in ('pr', 'benchmark', 'achievement', 'skill')),
  ref_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feed_events_user_created_idx
  on public.feed_events(user_id, created_at desc);

alter table public.feed_events enable row level security;

drop policy if exists "Read own and followed feed events" on public.feed_events;
create policy "Read own and followed feed events"
  on public.feed_events for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.followed_id = feed_events.user_id
    )
  );

-- ============================================================
-- 2) TRIGGERS
-- ============================================================

-- PRs
create or replace function public.handle_pr_feed_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.feed_events (user_id, event_type, ref_id, payload)
    values (NEW.user_id, 'pr', NEW.id, jsonb_build_object(
      'movement', NEW.movement,
      'type', NEW.type,
      'value_numeric', NEW.value_numeric
    ));
    return NEW;
  else
    delete from public.feed_events
    where event_type = 'pr' and ref_id = OLD.id;
    return OLD;
  end if;
end;
$$;

drop trigger if exists prs_feed_event on public.prs;
create trigger prs_feed_event
  after insert or delete on public.prs
  for each row execute function public.handle_pr_feed_event();

-- Benchmarks
create or replace function public.handle_benchmark_feed_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.feed_events (user_id, event_type, ref_id, payload)
    values (NEW.user_id, 'benchmark', NEW.id, jsonb_build_object(
      'name', NEW.name,
      'type', NEW.type,
      'result_value', NEW.result_value,
      'result_unit', NEW.result_unit,
      'scaling', NEW.scaling
    ));
    return NEW;
  else
    delete from public.feed_events
    where event_type = 'benchmark' and ref_id = OLD.id;
    return OLD;
  end if;
end;
$$;

drop trigger if exists benchmarks_feed_event on public.benchmarks;
create trigger benchmarks_feed_event
  after insert or delete on public.benchmarks
  for each row execute function public.handle_benchmark_feed_event();

-- Achievements
create or replace function public.handle_achievement_feed_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.feed_events (user_id, event_type, ref_id, payload)
    values (NEW.user_id, 'achievement', NEW.id, jsonb_build_object(
      'achievement_id', NEW.achievement_id
    ));
    return NEW;
  else
    delete from public.feed_events
    where event_type = 'achievement' and ref_id = OLD.id;
    return OLD;
  end if;
end;
$$;

drop trigger if exists achievements_feed_event on public.achievements;
create trigger achievements_feed_event
  after insert or delete on public.achievements
  for each row execute function public.handle_achievement_feed_event();

-- Skills (unlocked_movements)
create or replace function public.handle_skill_feed_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.feed_events (user_id, event_type, ref_id, payload)
    values (NEW.user_id, 'skill', NEW.id, jsonb_build_object(
      'movement', NEW.movement,
      'category', NEW.category
    ));
    return NEW;
  else
    delete from public.feed_events
    where event_type = 'skill' and ref_id = OLD.id;
    return OLD;
  end if;
end;
$$;

drop trigger if exists unlocked_movements_feed_event on public.unlocked_movements;
create trigger unlocked_movements_feed_event
  after insert or delete on public.unlocked_movements
  for each row execute function public.handle_skill_feed_event();
