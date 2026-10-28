-- 0026_partner_accounts.sql — Asociar la cuenta de un socio (D43)
--
-- Antes, "Dar rol → Socio" solo ofrecía socios sin cuenta: si los dos ya tenían una
-- (por ejemplo, la cuenta de prueba de DEV), no había forma de pasar el socio a la
-- cuenta real. Ahora:
--   * assign_partner_account asocia un socio a una cuenta. Si el socio ya tenía otra
--     cuenta, esa deja de ser socio. Los movimientos están a nombre del socio
--     (partner_id), así que caja y cuadres no cambian.
--   * Quitar el rol de socio libera su socio (partners.user_id = null).
--   * Las invitaciones con socio también reemplazan la cuenta anterior.

-- Asocia el socio a la cuenta: da el rol y quita el rol de socio a la cuenta anterior.
-- No lanza errores de negocio (lo usa el trigger de alta de cuentas): devuelve el motivo.
create or replace function private.link_partner_account(p_partner_id uuid, p_user_id uuid, p_granted_by uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev uuid;
begin
  select user_id into v_prev from public.partners where id = p_partner_id and is_active for update;
  if not found then
    return 'partner_not_found';
  end if;
  if exists (select 1 from public.partners where user_id = p_user_id and id <> p_partner_id) then
    return 'user_has_other_partner';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, 'partner', p_granted_by)
  on conflict do nothing;

  if v_prev is distinct from p_user_id then
    update public.partners set user_id = p_user_id where id = p_partner_id;
    if v_prev is not null then
      delete from public.user_roles where user_id = v_prev and role = 'partner';
    end if;
  end if;
  return 'ok';
end;
$$;

-- No valida el rol de quien llama: solo la usan assign_partner_account y apply_role_invites.
revoke all on function private.link_partner_account(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.assign_partner_account(p_partner_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev uuid;
  v_other text;
  v_result text;
begin
  if not private.is_partner() then
    raise exception 'Permiso denegado: solo socios pueden gestionar roles' using errcode = '42501';
  end if;

  select user_id into v_prev from public.partners where id = p_partner_id;
  if v_prev = auth.uid() and p_user_id is distinct from auth.uid() then
    raise exception 'No puedes pasar tu propio socio a otra cuenta: pídeselo a tu socio' using errcode = '22023';
  end if;

  v_result := private.link_partner_account(p_partner_id, p_user_id, auth.uid());
  if v_result = 'partner_not_found' then
    raise exception 'El socio no existe o está inactivo' using errcode = '22023';
  elsif v_result = 'user_has_other_partner' then
    select name into v_other from public.partners where user_id = p_user_id;
    raise exception 'Esa cuenta ya es del socio %', v_other using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.assign_partner_account(uuid, uuid) from public, anon;
grant execute on function public.assign_partner_account(uuid, uuid) to authenticated;

-- Quitar el rol de socio también libera su socio, para poder asociarlo a otra cuenta.
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
    if p_role = 'partner' then
      update public.partners set user_id = null where user_id = p_user_id;
    end if;
  end if;
end;
$$;

-- Invitaciones: el socio elegido pasa a la cuenta nueva aunque ya tuviera otra.
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
    perform private.link_partner_account(v_inv.partner_id, p_user_id, v_inv.invited_by);
  end if;

  update public.role_invites set claimed_by = p_user_id, claimed_at = now()
  where email = v_inv.email;
  return cardinality(v_inv.roles);
end;
$$;
