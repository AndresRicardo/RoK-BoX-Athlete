-- 0029_member_document_to_hik.sql — La cédula que se edita en la app llega a HikCentral (D48).
--
-- Antes la cédula solo viajaba de HikCentral a la app (campo personalizado "Cc", D38). Ahora,
-- cuando un socio o coach cambia la cédula de un miembro que ya está en HCAC (editar datos o
-- aprobar una solicitud de vínculo eligiendo el miembro), se encola el comando
-- `update_person` y el bridge escribe el campo "Cc" de la persona. La API lo acepta aunque la
-- vigencia esté vencida (probado en el HCAC de desarrollo), así que no hace falta abrir el acceso.
--
-- 1. `access_commands.command` admite 'update_person' (payload {"document_id": "..."}).
-- 2. Trigger en `members`: un cambio de cédula hecho por staff encola el comando. Lo que escribe
--    el bridge (cédula leída de HCAC) no se devuelve. HCAC solo acepta números en "Cc".
-- 3. Los barridos que reemplazan la vigencia pendiente (request_hik_sync, void_renewal) no
--    cancelan un cambio de datos pendiente.
-- 4. `complete_access_command` solo registra vigencias confirmadas para 'set_validity'.
-- 5. `review_member_link` acepta `p_member_id`: aprueba asignando la cédula de la solicitud a un
--    miembro existente (p. ej. importado de HCAC sin "Cc"), sin crear un duplicado.
-- 6. El aviso de comando fallido dice qué cambio no llegó.

-- =====================================================================
-- 1. NUEVO COMANDO
-- =====================================================================
alter table public.access_commands drop constraint access_commands_command_check;
alter table public.access_commands add constraint access_commands_command_check
  check (command in ('set_validity', 'update_person'));

-- =====================================================================
-- 2. CAMBIO DE CÉDULA → COMANDO update_person
-- =====================================================================
create or replace function private.enqueue_hik_document_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_cmd_id uuid;
begin
  -- La cédula que escribe el bridge viene de HCAC: ya está allá.
  if private.is_bridge() then
    return null;
  end if;

  if new.document_id !~ '^[0-9]{1,32}$' then
    raise exception 'En HikCentral la cédula solo puede tener números (sin letras, puntos ni guiones)'
      using errcode = '22023';
  end if;

  -- Un cambio aún sin enviar se actualiza en vez de duplicarse.
  select id into v_cmd_id from public.access_commands
  where member_id = new.id and command = 'update_person' and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if v_cmd_id is not null then
    update public.access_commands
    set payload = payload || jsonb_build_object('document_id', new.document_id),
        requested_by = auth.uid(), attempts = 0, last_error = null
    where id = v_cmd_id;
  else
    insert into public.access_commands (member_id, command, payload, requested_by)
    values (new.id, 'update_person', jsonb_build_object('document_id', new.document_id), auth.uid());
  end if;

  return null;
end;
$$;

create trigger members_document_to_hik
  after update of document_id on public.members
  for each row
  when (new.hik_person_id is not null and new.document_id is not null
        and old.document_id is distinct from new.document_id)
  execute function private.enqueue_hik_document_update();

-- =====================================================================
-- 3. UN CAMBIO DE DATOS PENDIENTE NO SE CANCELA AL REEMPLAZAR LA VIGENCIA
-- =====================================================================
-- request_hik_sync y void_renewal cancelan los comandos 'pending' del miembro antes de encolar
-- la vigencia nueva. Eso solo debe aplicar a 'set_validity'.
create or replace function private.keep_pending_person_updates()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.command = 'update_person' and old.status = 'pending' and new.status = 'cancelled' then
    return null; -- se ignora la cancelación de esta fila
  end if;
  return new;
end;
$$;

create trigger access_commands_keep_person_updates
  before update of status on public.access_commands
  for each row execute function private.keep_pending_person_updates();

-- =====================================================================
-- 4. COMPLETAR COMANDO (solo set_validity registra la vigencia confirmada)
-- =====================================================================
create or replace function public.complete_access_command(
  p_command_id uuid,
  p_ok         boolean,
  p_error      text default null
)
returns public.access_commands
language plpgsql security definer set search_path = ''
as $$
declare
  v_cmd public.access_commands;
begin
  if not private.is_bridge() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select * into v_cmd from public.access_commands where id = p_command_id for update;
  if not found then
    raise exception 'Comando no encontrado' using errcode = 'P0002';
  end if;
  if v_cmd.status <> 'processing' then
    raise exception 'El comando no está en proceso (%)', v_cmd.status using errcode = '22023';
  end if;

  if not p_ok then
    update public.access_commands
    set status = case when attempts >= 5 then 'failed' else 'pending' end,
        finished_at = case when attempts >= 5 then now() end,
        last_error = p_error
    where id = p_command_id
    returning * into v_cmd;
    return v_cmd;
  end if;

  update public.access_commands
  set status = 'done', finished_at = now(), last_error = null
  where id = p_command_id
  returning * into v_cmd;

  -- Registrar lo que quedó confirmado en HCAC (prevención de ciclos).
  if v_cmd.command = 'set_validity' then
    update public.memberships set
      hik_valid_from  = (v_cmd.payload->>'valid_from')::timestamptz,
      hik_valid_until = (v_cmd.payload->>'valid_until')::timestamptz,
      hik_synced_at   = now()
    where member_id = v_cmd.member_id;
  end if;

  return v_cmd;
end;
$$;

-- =====================================================================
-- 5. APROBAR UN VÍNCULO ELIGIENDO EL MIEMBRO
-- =====================================================================
drop function public.review_member_link(uuid, boolean, text);

create function public.review_member_link(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null,
  p_member_id  uuid default null
)
returns public.member_link_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_req    public.member_link_requests;
  v_member public.members;
  v_other  public.members;
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

  if p_member_id is not null then
    -- El socio eligió el miembro (p. ej. importado de HCAC sin cédula): se le asigna la de la
    -- solicitud y el trigger members_document_to_hik la envía a HikCentral.
    select * into v_member from public.members where id = p_member_id for update;
    if not found then
      raise exception 'Miembro no encontrado' using errcode = 'P0002';
    end if;
    if v_member.profile_id is not null then
      raise exception '% ya está vinculado a otra cuenta', v_member.full_name using errcode = '22023';
    end if;
    if v_member.document_id is not null and v_member.document_id <> v_req.document_id then
      raise exception '% ya tiene la cédula %', v_member.full_name, v_member.document_id using errcode = '22023';
    end if;
    select * into v_other from public.members
    where document_id = v_req.document_id and id <> p_member_id;
    if found then
      raise exception 'La cédula % ya es de %', v_req.document_id, v_other.full_name using errcode = '22023';
    end if;

    update public.members set document_id = v_req.document_id, profile_id = v_req.profile_id
    where id = v_member.id
    returning * into v_member;
  else
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
  end if;

  update public.member_link_requests
  set status = 'approved', member_id = v_member.id, reviewed_by = auth.uid(),
      reviewed_at = now(), review_note = p_note
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

revoke all on function public.review_member_link(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.review_member_link(uuid, boolean, text, uuid) to authenticated;

-- =====================================================================
-- 6. AVISO DE COMANDO FALLIDO CON EL TIPO DE CAMBIO
-- =====================================================================
create or replace function private.notify_access_command_failed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_what text;
begin
  if new.status = 'failed' and old.status <> 'failed' then
    select full_name into v_name from public.members where id = new.member_id;
    v_what := case new.command
                when 'set_validity' then 'la vigencia'
                when 'update_person' then 'la cédula'
                else new.command
              end;
    perform private.notify(private.role_user_ids(array['partner']), 'access_command_failed',
      'No se pudo actualizar HikCentral',
      'No llegó ' || v_what || ' de ' || coalesce(v_name, 'un miembro') || ': '
        || coalesce(new.last_error, 'error desconocido'),
      '/gestion/ajustes', jsonb_build_object('command_id', new.id, 'member_id', new.member_id));
  end if;
  return null;
end;
$$;

revoke all on function private.enqueue_hik_document_update() from public, anon;
revoke all on function private.keep_pending_person_updates() from public, anon;
