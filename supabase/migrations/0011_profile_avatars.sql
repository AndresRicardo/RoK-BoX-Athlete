-- FASE 13: Avatares - foto de Google sincronizada a profiles
-- Ejecutar en Supabase Studio SQL Editor
--
--   1) Columna avatar_url en profiles (la app la sincroniza desde
--      user_metadata de Google al iniciar sesion / guardar el perfil)
--   2) Policy UPDATE defensiva sobre profiles
--   3) athlete_directory expone avatar_url (foto publica de perfil)

alter table public.profiles
  add column if not exists avatar_url text;

-- Defensivo: garantiza que cada usuario pueda actualizar su propio perfil
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- DROP + CREATE (no CREATE OR REPLACE): Postgres no permite insertar
-- columnas en medio de una vista existente (error 42P16). La vista no
-- tiene dependencias en otros objetos; el grant se re-ejecuta tras el drop.
drop view if exists public.athlete_directory;

create view public.athlete_directory as
select
  id,
  display_name,
  first_name,
  last_name,
  concat_ws(' ', first_name, last_name) as full_name,
  box_name,
  discipline,
  avatar_url,
  created_at
from public.profiles;

grant select on public.athlete_directory to authenticated;
