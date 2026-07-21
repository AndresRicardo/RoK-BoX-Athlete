-- FASE 11: Social - follows, directorio de atletas y lectura para seguidores
-- Ejecutar en Supabase Studio SQL Editor
--
--   1) Tabla follows (follow directo, sin aprobacion; grafo publico)
--   2) Vista athlete_directory con columnas publicas de profiles
--   3) Policies "followers read" en prs, benchmarks, achievements y
--      unlocked_movements: tus seguidores pueden leer tu actividad

-- ============================================================
-- 1) FOLLOWS
-- ============================================================

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self_follow check (follower_id <> followed_id)
);

create index if not exists follows_followed_id_idx
  on public.follows(followed_id);

alter table public.follows enable row level security;

-- El grafo es publico para usuarios autenticados (contadores, listas,
-- "amigos de amigos"). La actividad NO: eso se controla abajo.
drop policy if exists "Authenticated read follows" on public.follows;
create policy "Authenticated read follows"
  on public.follows for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users insert own follows" on public.follows;
create policy "Users insert own follows"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users delete own follows" on public.follows;
create policy "Users delete own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ============================================================
-- 2) ATHLETE DIRECTORY (busqueda y nombres en el feed)
-- ============================================================
-- La vista corre con permisos del owner y bypasea el RLS de profiles,
-- exponiendo SOLO estas columnas publicas a cualquier autenticado.
-- Peso, fecha de nacimiento, genero, objetivo y email quedan privados.

create or replace view public.athlete_directory as
select
  id,
  display_name,
  first_name,
  last_name,
  concat_ws(' ', first_name, last_name) as full_name,
  box_name,
  discipline,
  created_at
from public.profiles;

grant select on public.athlete_directory to authenticated;

-- ============================================================
-- 3) FOLLOWERS READ en tablas de actividad
-- ============================================================

drop policy if exists "Followers read prs" on public.prs;
create policy "Followers read prs"
  on public.prs for select
  using (exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid() and f.followed_id = prs.user_id
  ));

drop policy if exists "Followers read benchmarks" on public.benchmarks;
create policy "Followers read benchmarks"
  on public.benchmarks for select
  using (exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid() and f.followed_id = benchmarks.user_id
  ));

drop policy if exists "Followers read achievements" on public.achievements;
create policy "Followers read achievements"
  on public.achievements for select
  using (exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid() and f.followed_id = achievements.user_id
  ));

drop policy if exists "Followers read unlocked_movements" on public.unlocked_movements;
create policy "Followers read unlocked_movements"
  on public.unlocked_movements for select
  using (exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid() and f.followed_id = unlocked_movements.user_id
  ));
