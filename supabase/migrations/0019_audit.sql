-- 0019_audit.sql
-- Historial de cambios (quién, cuándo, valor anterior y nuevo) de las tablas de dinero,
-- membresías y roles (D22, E2). Solo los socios lo pueden leer.

create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  text not null,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor      uuid,
  changed_at timestamptz not null default now(),
  old_data   jsonb,
  new_data   jsonb
);

alter table public.audit_log enable row level security;

create index audit_log_record_idx on public.audit_log (table_name, record_id, changed_at desc);
create index audit_log_changed_idx on public.audit_log (changed_at desc);
create index audit_log_actor_idx on public.audit_log (actor);

create policy "audit_log: socio lee"
  on public.audit_log for select to authenticated using ((select private.is_partner()));

-- Escritura solo por el trigger.

create or replace function private.audit_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  text;
begin
  -- updated_at y hik_synced_at cambian en cada escritura o lectura del bridge: no aportan.
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - array['updated_at', 'hik_synced_at'];
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - array['updated_at', 'hik_synced_at'];
  end if;

  -- Ignorar actualizaciones que no cambian nada relevante.
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  v_id := coalesce(v_new, v_old) ->> coalesce(tg_argv[0], 'id');

  insert into public.audit_log (table_name, record_id, action, actor, old_data, new_data)
  values (tg_table_name, v_id, tg_op, auth.uid(), v_old, v_new);
  return null;
end;
$$;

revoke all on function private.audit_trigger() from public, anon;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('partners', 'id'),
      ('memberships', 'member_id'),
      ('membership_renewals', 'id'),
      ('class_usages', 'id'),
      ('membership_plans', 'id'),
      ('members', 'id'),
      ('products', 'id'),
      ('debts', 'id'),
      ('debt_items', 'id'),
      ('debt_payments', 'id'),
      ('expenses', 'id'),
      ('incomes', 'id'),
      ('partner_transfers', 'id'),
      ('settlements', 'id'),
      ('user_roles', 'user_id')
    ) as v(tbl, key_col)
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit_trigger(%L)',
      t.tbl || '_audit', t.tbl, t.key_col);
  end loop;
end $$;
