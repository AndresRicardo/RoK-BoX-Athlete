-- 0031_membership_reminders_payments.sql
-- D50: aviso push cuando la membresía pasa a "por vencer" y recordatorio por WhatsApp
--      de la mensualidad (por vencer o vencida), igual que el de deudas (D41).
-- D51: medios de pago del box (cuentas, llaves y QR) para el botón "Pagar" del atleta.

-- =====================================================================
-- 1. AVISO PUSH AL PASAR A "POR VENCER" (reemplaza el aviso fijo a 3 días)
-- =====================================================================
-- La app marca "por vencer" cuando faltan menos de 3 días para el fin de la vigencia
-- (membership_status: valid_until < now() + 3 days), es decir, desde 2 días antes. El
-- aviso fijo "vence en 3 días" llegaba cuando la app todavía decía "al día". Ahora el
-- trabajo diario (8:00) avisa una sola vez por vigencia al entrar en "por vencer" y otra
-- el día que vence. Esta tabla evita repetirlos (también si el trabajo corre dos veces).
create table public.membership_expiry_notices (
  member_id   uuid not null references public.members(id) on delete cascade,
  valid_until timestamptz not null,
  kind        text not null check (kind in ('expiring', 'due_today')),
  sent_at     timestamptz not null default now(),
  primary key (member_id, valid_until, kind)
);

alter table public.membership_expiry_notices enable row level security;

-- Solo lectura para el staff (la ficha muestra si ya le llegó el aviso); escribe el trabajo.
create policy "membership_expiry_notices: staff lee"
  on public.membership_expiry_notices for select to authenticated using ((select private.is_staff()));

create or replace function private.job_membership_expiring()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r      record;
  v_kind text;
  v_rows int;
  v_date text;
begin
  for r in
    select m.id as member_id, m.profile_id, ms.valid_until,
           (ms.valid_until at time zone 'America/Bogota')::date
             - (now() at time zone 'America/Bogota')::date as days
    from public.memberships ms
    join public.members m on m.id = ms.member_id
    -- Mismas condiciones que el estado 'expiring_soon' de membership_status.
    where m.profile_id is not null and m.is_active and ms.access_enabled
      and ms.valid_until >= now()
      and ms.valid_until < now() + interval '3 days'
      and not (ms.classes_total is not null and ms.classes_used >= ms.classes_total)
  loop
    v_kind := case when r.days <= 0 then 'due_today' else 'expiring' end;

    insert into public.membership_expiry_notices (member_id, valid_until, kind)
    values (r.member_id, r.valid_until, v_kind)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    continue when v_rows = 0;

    v_date := to_char(r.valid_until at time zone 'America/Bogota', 'DD/MM');
    if v_kind = 'due_today' then
      perform private.notify(array[r.profile_id], 'membership_expiring',
        'Tu membresía vence hoy',
        'Renueva hoy para no perder el acceso. Toca para ver cómo pagar.',
        '/?pay=membership', jsonb_build_object('member_id', r.member_id, 'kind', v_kind));
    else
      perform private.notify(array[r.profile_id], 'membership_expiring',
        'Tu membresía está por vencer',
        'Vence ' || case when r.days = 1 then 'mañana' else 'en ' || r.days || ' días' end
          || ' (' || v_date || '). Renueva a tiempo para no perder el acceso. Toca para ver cómo pagar.',
        '/?pay=membership', jsonb_build_object('member_id', r.member_id, 'kind', v_kind));
    end if;
  end loop;
end;
$$;

revoke all on function private.job_membership_expiring() from public, anon, authenticated;

-- =====================================================================
-- 2. AJUSTES DEL BOX: NUEVAS CLAVES
-- =====================================================================
-- membership_reminder_template: texto base del recordatorio de mensualidad (staff lee).
-- payment_instructions: indicaciones que ve el atleta al pagar (p. ej. enviar comprobante).
-- payment_whatsapp: celular del box que recibe los comprobantes.
alter table public.app_settings drop constraint app_settings_key_check;
alter table public.app_settings add constraint app_settings_key_check check (key in (
  'debt_reminder_template', 'membership_reminder_template', 'payment_instructions', 'payment_whatsapp'
));

-- ¿El usuario actual está vinculado a un miembro del box?
create or replace function private.is_linked_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members m where m.profile_id = (select auth.uid()));
$$;

-- El staff lee todo; un atleta vinculado lee solo los datos de pago.
drop policy "app_settings: staff lee" on public.app_settings;
create policy "app_settings: staff, o datos de pago para atletas vinculados"
  on public.app_settings for select to authenticated
  using (
    (select private.is_staff())
    or (key in ('payment_instructions', 'payment_whatsapp') and (select private.is_linked_member()))
  );

-- =====================================================================
-- 3. RECORDATORIO DE MENSUALIDAD POR WHATSAPP (como debt_reminders, D41)
-- =====================================================================
create table public.membership_reminders (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  channel     text not null default 'whatsapp' check (channel in ('whatsapp')),
  valid_until timestamptz not null,
  sent_by     uuid references auth.users(id) on delete set null,
  sent_at     timestamptz not null default now()
);

alter table public.membership_reminders enable row level security;

create index membership_reminders_member_idx on public.membership_reminders (member_id, sent_at desc);
create index membership_reminders_sent_by_idx on public.membership_reminders (sent_by);

create policy "membership_reminders: staff lee"
  on public.membership_reminders for select to authenticated using ((select private.is_staff()));

-- Registra que se envió. La vigencia la toma la base: solo vale para una membresía por
-- vencer o vencida (menos de 3 días para el fin, o ya terminada).
create or replace function public.log_membership_reminder(p_member_id uuid)
returns public.membership_reminders
language plpgsql security definer set search_path = ''
as $$
declare
  v_until timestamptz;
  v_row   public.membership_reminders;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select ms.valid_until into v_until from public.memberships ms where ms.member_id = p_member_id;

  if v_until is null or v_until >= now() + interval '3 days' then
    raise exception 'La membresía de ese miembro no está por vencer ni vencida' using errcode = '22023';
  end if;

  insert into public.membership_reminders (member_id, valid_until, sent_by)
  values (p_member_id, v_until, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.log_membership_reminder(uuid) from public, anon;
grant execute on function public.log_membership_reminder(uuid) to authenticated;

-- Una fila por miembro con membresía por vencer o vencida, con su último recordatorio
-- y si ya se le recordó (o le llegó el push) para la vigencia actual.
create view public.membership_reminder_summary with (security_invoker = true) as
select
  s.member_id,
  s.full_name,
  s.phone,
  s.profile_id,
  s.is_active,
  s.plan_name,
  s.plan_kind,
  s.valid_until,
  s.days_left,
  s.status,
  s.access_enabled,
  s.debt_balance,
  lr.sent_at as last_reminder_at,
  lr.sent_by as last_reminder_by,
  (lr.valid_until = s.valid_until) as reminded_this_period,
  (select max(n.sent_at) from public.membership_expiry_notices n
   where n.member_id = s.member_id and n.valid_until = s.valid_until) as push_sent_at
from public.membership_status s
left join lateral (
  select r.sent_at, r.sent_by, r.valid_until
  from public.membership_reminders r
  where r.member_id = s.member_id
  order by r.sent_at desc
  limit 1
) lr on true
where s.valid_until is not null
  and s.valid_until < now() + interval '3 days';

grant select on public.membership_reminder_summary to authenticated;

-- =====================================================================
-- 4. MEDIOS DE PAGO DEL BOX (D51)
-- =====================================================================
-- Cuentas, llaves Bre-B o celulares Nequi/Daviplata a los que el atleta puede pagar,
-- con su QR opcional. Los editan los socios; los ven el staff y los atletas vinculados.
create table public.payment_accounts (
  id              uuid primary key default gen_random_uuid(),
  label           text not null check (length(trim(label)) between 1 and 60),
  account_number  text check (account_number is null or length(account_number) <= 60),
  holder_name     text check (holder_name is null or length(holder_name) <= 100),
  holder_document text check (holder_document is null or length(holder_document) <= 30),
  notes           text check (notes is null or length(notes) <= 300),
  qr_path         text check (qr_path is null or length(qr_path) <= 200),
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payment_accounts_has_data check (account_number is not null or qr_path is not null)
);

alter table public.payment_accounts enable row level security;

create trigger payment_accounts_updated_at
  before update on public.payment_accounts
  for each row execute function public.handle_updated_at();

create trigger payment_accounts_audit
  after insert or update or delete on public.payment_accounts
  for each row execute function private.audit_trigger('id');

create policy "payment_accounts: staff, o activas para atletas vinculados"
  on public.payment_accounts for select to authenticated
  using ((select private.is_staff()) or (is_active and (select private.is_linked_member())));
create policy "payment_accounts: socio inserta"
  on public.payment_accounts for insert to authenticated with check ((select private.is_partner()));
create policy "payment_accounts: socio actualiza"
  on public.payment_accounts for update to authenticated
  using ((select private.is_partner())) with check ((select private.is_partner()));
create policy "payment_accounts: socio borra"
  on public.payment_accounts for delete to authenticated using ((select private.is_partner()));

-- QR en Storage, bucket privado: se ven con URL firmada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "payment-qr: staff o atletas vinculados leen"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-qr' and ((select private.is_staff()) or (select private.is_linked_member())));
create policy "payment-qr: socio sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-qr' and (select private.is_partner()));
create policy "payment-qr: socio actualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'payment-qr' and (select private.is_partner()))
  with check (bucket_id = 'payment-qr' and (select private.is_partner()));
create policy "payment-qr: socio borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-qr' and (select private.is_partner()));

-- =====================================================================
-- 5. EL RECORDATORIO SEMANAL DE SALDO ABRE "PAGAR"
-- =====================================================================
-- Mismo trabajo de 0020 (lunes 9:00); solo cambian el texto y el enlace.
create or replace function private.job_debt_reminders()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select m.profile_id, sum(d.balance) as balance
    from public.debts d join public.members m on m.id = d.member_id
    where d.voided_at is null and d.balance > 0 and m.profile_id is not null
    group by m.profile_id
  loop
    perform private.notify(array[r.profile_id], 'debt_reminder', 'Tienes un saldo pendiente',
      'Debes ' || private.cop(r.balance) || ' en el box. Toca para ver cómo pagar.', '/?pay=debt', null);
  end loop;
end;
$$;
