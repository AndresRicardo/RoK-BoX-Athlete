-- 0015_roles_partners_members.sql
-- Roles de gestión (socio, coach, bridge), socios con porcentaje de participación,
-- miembros del box (identidad compartida con HikCentral) y vinculación cuenta ↔ miembro.
-- No modifica ninguna tabla de 0001–0014.

-- =====================================================================
-- 0. ESQUEMA PRIVADO PARA HELPERS (no expuesto por la API)
-- =====================================================================
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- =====================================================================
-- 1. ROLES
-- =====================================================================
create table public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('partner', 'coach', 'bridge')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function private.has_role(p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = any(p_roles)
  );
$$;

create or replace function private.is_partner() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_role(array['partner']); $$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_role(array['partner', 'coach']); $$;

create or replace function private.is_bridge() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_role(array['bridge']); $$;

create policy "user_roles: propios o socio"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_partner()));

-- Escritura solo por RPC (set_user_role).

-- =====================================================================
-- 2. SOCIOS
-- =====================================================================
create table public.partners (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users(id) on delete set null,
  name             text not null,
  share_percentage numeric(5,2) not null check (share_percentage between 0 and 100),
  color_hex        text not null default '#FFC815' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.partners enable row level security;

create trigger partners_updated_at
  before update on public.partners
  for each row execute function public.handle_updated_at();

-- Staff necesita leer socios para elegir quién recibe el dinero (D30).
create policy "partners: staff lee"
  on public.partners for select to authenticated
  using ((select private.is_staff()));

create policy "partners: socio inserta"
  on public.partners for insert to authenticated
  with check ((select private.is_partner()));

create policy "partners: socio actualiza"
  on public.partners for update to authenticated
  using ((select private.is_partner()))
  with check ((select private.is_partner()));

create or replace function private.current_partner_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.partners
  where user_id = (select auth.uid()) and is_active
  limit 1;
$$;

-- =====================================================================
-- 2b. INVITACIONES POR CORREO
-- =====================================================================
-- Un socio invita un email con roles (y opcionalmente lo asocia a un socio). Al crearse
-- la cuenta (o al llamar claim_role_invites) se asignan los roles automáticamente.
create table public.role_invites (
  email      text primary key check (email = lower(trim(email)) and email like '%@%'),
  roles      text[] not null check (cardinality(roles) > 0 and roles <@ array['partner', 'coach']),
  partner_id uuid references public.partners(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);

alter table public.role_invites enable row level security;

create policy "role_invites: socio lee"
  on public.role_invites for select to authenticated using ((select private.is_partner()));
create policy "role_invites: socio inserta"
  on public.role_invites for insert to authenticated with check ((select private.is_partner()));
create policy "role_invites: socio actualiza"
  on public.role_invites for update to authenticated
  using ((select private.is_partner())) with check ((select private.is_partner()));
create policy "role_invites: socio borra"
  on public.role_invites for delete to authenticated using ((select private.is_partner()));

create or replace function private.apply_role_invites(p_user_id uuid, p_email text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.role_invites;
begin
  select * into v_inv from public.role_invites
  where email = lower(trim(p_email)) and claimed_at is null
  for update;
  if not found then
    return 0;
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  select p_user_id, r, v_inv.invited_by from unnest(v_inv.roles) as r
  on conflict do nothing;

  if v_inv.partner_id is not null then
    update public.partners set user_id = p_user_id
    where id = v_inv.partner_id and user_id is null;
  end if;

  update public.role_invites set claimed_by = p_user_id, claimed_at = now()
  where email = v_inv.email;
  return cardinality(v_inv.roles);
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is not null then
    perform private.apply_role_invites(new.id, new.email);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_apply_invites
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Para cuentas que ya existían antes de la invitación (la app lo llama al iniciar sesión).
create or replace function public.claim_role_invites()
returns int
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return 0;
  end if;
  return private.apply_role_invites(auth.uid(), (select email from auth.users where id = auth.uid()));
end;
$$;

-- =====================================================================
-- 3. MIEMBROS (personas del box; existan o no en la app)
-- =====================================================================
create table public.members (
  id            uuid primary key default gen_random_uuid(),
  document_id   text unique check (document_id is null or document_id ~ '^[0-9A-Za-z-]{5,20}$'),
  full_name     text not null check (length(trim(full_name)) > 0),
  phone         text,
  email         text,
  profile_id    uuid unique references public.profiles(id) on delete set null,
  hik_person_id text unique,
  is_active     boolean not null default true,
  source        text not null default 'app' check (source in ('app', 'hikcentral')),
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.members enable row level security;

create index members_full_name_idx on public.members (lower(full_name));

create trigger members_updated_at
  before update on public.members
  for each row execute function public.handle_updated_at();

create policy "members: propio, staff o bridge"
  on public.members for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.is_staff())
    or (select private.is_bridge())
  );

-- Escritura solo por RPC (upsert_member, review_member_link, bridge_sync_persons).

-- Miembro vinculado al usuario actual (para RLS de tablas hijas)
create or replace function private.my_member_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.members where profile_id = (select auth.uid()) limit 1;
$$;

-- =====================================================================
-- 4. SOLICITUDES DE VÍNCULO CUENTA ↔ MIEMBRO (D20)
-- =====================================================================
create table public.member_link_requests (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  document_id text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  member_id   uuid references public.members(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);

alter table public.member_link_requests enable row level security;

create unique index member_link_requests_one_pending
  on public.member_link_requests (profile_id)
  where status = 'pending';

create index member_link_requests_status_idx
  on public.member_link_requests (status, created_at);

create policy "link_requests: propias o staff"
  on public.member_link_requests for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()));

-- Escritura solo por RPC.

-- =====================================================================
-- 5. RPCs
-- =====================================================================

-- Asignar o quitar un rol (solo socios). No permite quitarse el último socio.
create or replace function public.set_user_role(p_user_id uuid, p_role text, p_grant boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios pueden gestionar roles' using errcode = '42501';
  end if;
  if p_role not in ('partner', 'coach', 'bridge') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    if p_role = 'partner'
       and (select count(*) from public.user_roles where role = 'partner') <= 1 then
      raise exception 'Debe quedar al menos un socio' using errcode = '22023';
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
end;
$$;

-- El atleta solicita vincular su cuenta con su cédula.
create or replace function public.request_member_link(p_document text)
returns public.member_link_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_doc text := regexp_replace(coalesce(p_document, ''), '[^0-9A-Za-z-]', '', 'g');
  v_req public.member_link_requests;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado' using errcode = '42501';
  end if;
  if length(v_doc) < 5 then
    raise exception 'Cédula inválida' using errcode = '22023';
  end if;
  if exists (select 1 from public.members where profile_id = v_uid) then
    raise exception 'Tu cuenta ya está vinculada a un miembro del box' using errcode = '22023';
  end if;

  update public.member_link_requests
  set status = 'cancelled', reviewed_at = now()
  where profile_id = v_uid and status = 'pending';

  insert into public.member_link_requests (profile_id, document_id, member_id)
  values (v_uid, v_doc, (select id from public.members where document_id = v_doc))
  returning * into v_req;

  return v_req;
end;
$$;

-- Socio/coach aprueba o rechaza la solicitud (corrige E7).
create or replace function public.review_member_link(p_request_id uuid, p_approve boolean, p_note text default null)
returns public.member_link_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.member_link_requests;
  v_member public.members;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select * into v_req from public.member_link_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'La solicitud ya fue procesada (%)', v_req.status using errcode = '22023';
  end if;

  if not p_approve then
    update public.member_link_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
    where id = p_request_id
    returning * into v_req;
    return v_req;
  end if;

  if exists (select 1 from public.members where profile_id = v_req.profile_id) then
    raise exception 'Esa cuenta ya está vinculada a otro miembro' using errcode = '22023';
  end if;

  select * into v_member from public.members where document_id = v_req.document_id for update;

  if found then
    if v_member.profile_id is not null then
      raise exception 'La cédula % ya está vinculada a otra cuenta', v_req.document_id using errcode = '22023';
    end if;
    update public.members set profile_id = v_req.profile_id
    where id = v_member.id
    returning * into v_member;
  else
    -- La persona aún no existe en HikCentral: se crea en la app.
    insert into public.members (document_id, full_name, profile_id, source, created_by)
    select v_req.document_id, concat_ws(' ', p.first_name, p.last_name), v_req.profile_id, 'app', auth.uid()
    from public.profiles p where p.id = v_req.profile_id
    returning * into v_member;
  end if;

  update public.member_link_requests
  set status = 'approved', member_id = v_member.id, reviewed_by = auth.uid(),
      reviewed_at = now(), review_note = p_note
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

-- Crear o editar un miembro (staff).
create or replace function public.upsert_member(
  p_id uuid default null,
  p_full_name text default null,
  p_document_id text default null,
  p_phone text default null,
  p_email text default null,
  p_notes text default null
)
returns public.members
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.members;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  if p_id is null then
    if nullif(trim(p_full_name), '') is null then
      raise exception 'El nombre es obligatorio' using errcode = '22023';
    end if;
    insert into public.members (full_name, document_id, phone, email, notes, source, created_by)
    values (trim(p_full_name), nullif(trim(p_document_id), ''), nullif(trim(p_phone), ''),
            nullif(trim(p_email), ''), p_notes, 'app', auth.uid())
    returning * into v_member;
  else
    update public.members set
      full_name   = coalesce(nullif(trim(p_full_name), ''), full_name),
      document_id = coalesce(nullif(trim(p_document_id), ''), document_id),
      phone       = coalesce(nullif(trim(p_phone), ''), phone),
      email       = coalesce(nullif(trim(p_email), ''), email),
      notes       = coalesce(p_notes, notes)
    where id = p_id
    returning * into v_member;
    if not found then
      raise exception 'Miembro no encontrado' using errcode = 'P0002';
    end if;
  end if;

  return v_member;
end;
$$;

-- =====================================================================
-- 6. PERMISOS DE EJECUCIÓN
-- =====================================================================
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.claim_role_invites() from public, anon;
grant execute on function public.claim_role_invites() to authenticated;
revoke all on function public.set_user_role(uuid, text, boolean) from public, anon;
revoke all on function public.request_member_link(text) from public, anon;
revoke all on function public.review_member_link(uuid, boolean, text) from public, anon;
revoke all on function public.upsert_member(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.set_user_role(uuid, text, boolean) to authenticated;
grant execute on function public.request_member_link(text) to authenticated;
grant execute on function public.review_member_link(uuid, boolean, text) to authenticated;
grant execute on function public.upsert_member(uuid, text, text, text, text, text) to authenticated;
