-- 0024_debt_reminders.sql
-- Recordatorio de deuda por WhatsApp (D41). El socio o coach abre WhatsApp en su
-- teléfono con el mensaje listo; la app registra quién lo recordó y cuándo, para que
-- nadie le repita el mensaje a la misma persona. La plantilla del mensaje es del box.

-- =====================================================================
-- 1. AJUSTES DEL BOX (clave → texto)
-- =====================================================================
create table public.app_settings (
  key        text primary key check (key in ('debt_reminder_template')),
  value      text not null check (length(trim(value)) between 1 and 2000),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.handle_updated_at();

create trigger app_settings_audit
  after insert or update or delete on public.app_settings
  for each row execute function private.audit_trigger('key');

create policy "app_settings: staff lee"
  on public.app_settings for select to authenticated using ((select private.is_staff()));
create policy "app_settings: socio inserta"
  on public.app_settings for insert to authenticated with check ((select private.is_partner()));
create policy "app_settings: socio actualiza"
  on public.app_settings for update to authenticated
  using ((select private.is_partner())) with check ((select private.is_partner()));
create policy "app_settings: socio borra"
  on public.app_settings for delete to authenticated using ((select private.is_partner()));

-- =====================================================================
-- 2. REGISTRO DE RECORDATORIOS
-- =====================================================================
create table public.debt_reminders (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  channel   text not null default 'whatsapp' check (channel in ('whatsapp')),
  balance   numeric(12,2) not null check (balance > 0),
  sent_by   uuid references auth.users(id) on delete set null,
  sent_at   timestamptz not null default now()
);

alter table public.debt_reminders enable row level security;

create index debt_reminders_member_idx on public.debt_reminders (member_id, sent_at desc);
create index debt_reminders_sent_by_idx on public.debt_reminders (sent_by);

-- Solo lectura para el staff; se escribe por log_debt_reminder.
create policy "debt_reminders: staff lee"
  on public.debt_reminders for select to authenticated using ((select private.is_staff()));

-- Registra que se envió un recordatorio. El saldo se calcula aquí, no lo manda el cliente.
create or replace function public.log_debt_reminder(p_member_id uuid)
returns public.debt_reminders
language plpgsql security definer set search_path = ''
as $$
declare
  v_balance numeric(12,2);
  v_row     public.debt_reminders;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select coalesce(sum(d.balance), 0) into v_balance
  from public.debts d
  where d.member_id = p_member_id and d.voided_at is null;

  if v_balance <= 0 then
    raise exception 'Ese miembro no tiene saldo pendiente' using errcode = '22023';
  end if;

  insert into public.debt_reminders (member_id, balance, sent_by)
  values (p_member_id, v_balance, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.log_debt_reminder(uuid) from public, anon;
grant execute on function public.log_debt_reminder(uuid) to authenticated;

-- =====================================================================
-- 3. VISTA: SALDO POR MIEMBRO
-- =====================================================================
-- Una fila por miembro con saldo pendiente, con su último recordatorio.
create view public.debtor_summary with (security_invoker = true) as
select
  m.id as member_id,
  m.full_name,
  m.phone,
  m.profile_id,
  m.is_active,
  sum(d.balance) as balance,
  count(*) as open_debts,
  min(d.created_at) as oldest_debt_at,
  lr.sent_at as last_reminder_at,
  lr.sent_by as last_reminder_by,
  (select count(*) from public.debt_reminders r where r.member_id = m.id) as reminders_count
from public.members m
join public.debts d on d.member_id = m.id and d.voided_at is null and d.balance > 0
left join lateral (
  select r.sent_at, r.sent_by
  from public.debt_reminders r
  where r.member_id = m.id
  order by r.sent_at desc
  limit 1
) lr on true
group by m.id, lr.sent_at, lr.sent_by;

grant select on public.debtor_summary to authenticated;
