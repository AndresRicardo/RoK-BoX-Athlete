-- 0032_payment_reports.sql
-- D52: el atleta reporta su pago desde la app (monto, a dónde pagó y comprobante) y el
-- staff lo confirma desde Pendientes con un toque: renueva la mensualidad y/o abona a sus
-- deudas (de la más antigua a la más reciente). Rechazar avisa al atleta con el motivo.

-- =====================================================================
-- 1. TABLA
-- =====================================================================
create table public.payment_reports (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.members(id) on delete cascade,
  profile_id         uuid not null references auth.users(id) on delete cascade,
  amount             numeric(12,2) not null check (amount > 0 and amount <= 20000000),
  covers_membership  boolean not null default false,
  covers_debt        boolean not null default false,
  payment_method     public.payment_method not null check (payment_method <> 'cash'),
  payment_account_id uuid references public.payment_accounts(id) on delete set null,
  account_label      text,
  receipt_path       text not null unique,
  note               text check (note is null or length(note) <= 500),
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_note        text,
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz,
  renewal_id         uuid references public.membership_renewals(id) on delete set null,
  membership_amount  numeric(12,2),
  debt_amount        numeric(12,2),
  created_at         timestamptz not null default now(),
  constraint payment_reports_covers check (covers_membership or covers_debt)
);

alter table public.payment_reports enable row level security;

create index payment_reports_member_idx on public.payment_reports (member_id, created_at desc);
create index payment_reports_profile_idx on public.payment_reports (profile_id, created_at desc);
create index payment_reports_pending_idx on public.payment_reports (created_at) where status = 'pending';
create index payment_reports_account_idx on public.payment_reports (payment_account_id);
create index payment_reports_reviewed_by_idx on public.payment_reports (reviewed_by);
create index payment_reports_renewal_idx on public.payment_reports (renewal_id);

create trigger payment_reports_audit
  after insert or update or delete on public.payment_reports
  for each row execute function private.audit_trigger('id');

-- Lectura: el propio atleta y el staff. Escritura solo por los RPC de abajo.
create policy "payment_reports: propios o staff"
  on public.payment_reports for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()));

-- =====================================================================
-- 2. COMPROBANTES (bucket privado; cada atleta sube a su carpeta <uid>/)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy "payment-receipts: el atleta vinculado sube a su carpeta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_linked_member())
  );
create policy "payment-receipts: los propios o el staff leen"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff()))
  );
-- El atleta solo borra un archivo propio que no quedó en un reporte (subida fallida);
-- los socios pueden limpiar.
create policy "payment-receipts: borrar huérfanos propios o socio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      (select private.is_partner())
      or ((storage.foldername(name))[1] = (select auth.uid())::text
          and not exists (select 1 from public.payment_reports r where r.receipt_path = name))
    )
  );

-- =====================================================================
-- 3. AVISOS: TIPOS NUEVOS
-- =====================================================================
-- payment_reported: a socios y coaches, al reportar. payment_reviewed: al atleta, si se
-- rechaza (al confirmarlo ya le llegan "Membresía renovada" y "Abono registrado").
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'like', 'comment', 'follow',
  'membership_expiring', 'membership_renewed', 'classes_low',
  'debt_charged', 'debt_payment', 'debt_reminder',
  'link_reviewed',
  'renewal_pending', 'link_request', 'bridge_offline', 'access_command_failed', 'weekly_summary',
  'announcement',
  'payment_reported', 'payment_reviewed'
));

-- =====================================================================
-- 4. RPC
-- =====================================================================
-- El atleta reporta un pago. El comprobante ya debe estar subido en su carpeta.
create or replace function public.report_payment(
  p_amount             numeric,
  p_covers_membership  boolean,
  p_covers_debt        boolean,
  p_payment_method     public.payment_method,
  p_payment_account_id uuid,
  p_receipt_path       text,
  p_note               text default null
)
returns public.payment_reports
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_member  public.members;
  v_account public.payment_accounts;
  v_row     public.payment_reports;
  v_what    text;
begin
  select * into v_member from public.members where profile_id = v_uid and is_active limit 1;
  if v_uid is null or v_member.id is null then
    raise exception 'Tu cuenta no está vinculada a un miembro del box' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 20000000 then
    raise exception 'Escribe el valor que pagaste' using errcode = '22023';
  end if;
  if not coalesce(p_covers_membership, false) and not coalesce(p_covers_debt, false) then
    raise exception 'Indica qué pagaste: la mensualidad, tu saldo o ambos' using errcode = '22023';
  end if;
  if coalesce(p_covers_debt, false) and not exists (
    select 1 from public.debts d where d.member_id = v_member.id and d.voided_at is null and d.balance > 0
  ) then
    raise exception 'No tienes saldo pendiente' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method = 'cash' then
    raise exception 'El efectivo se paga directamente en el box' using errcode = '22023';
  end if;

  if p_payment_account_id is not null then
    select * into v_account from public.payment_accounts where id = p_payment_account_id and is_active;
    if not found then
      raise exception 'Ese medio de pago ya no está disponible' using errcode = '22023';
    end if;
  end if;

  if p_receipt_path is null or p_receipt_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]+$')
     or not exists (select 1 from storage.objects o
                    where o.bucket_id = 'payment-receipts' and o.name = p_receipt_path) then
    raise exception 'Adjunta el comprobante del pago' using errcode = '22023';
  end if;

  if exists (select 1 from public.payment_reports r where r.receipt_path = p_receipt_path) then
    raise exception 'Ese comprobante ya fue reportado' using errcode = '22023';
  end if;

  if (select count(*) from public.payment_reports r
      where r.member_id = v_member.id and r.status = 'pending') >= 3 then
    raise exception 'Ya tienes 3 pagos en revisión. Espera a que el box los confirme.' using errcode = '22023';
  end if;

  insert into public.payment_reports (
    member_id, profile_id, amount, covers_membership, covers_debt, payment_method,
    payment_account_id, account_label, receipt_path, note
  ) values (
    v_member.id, v_uid, p_amount, coalesce(p_covers_membership, false), coalesce(p_covers_debt, false),
    p_payment_method, v_account.id, v_account.label, p_receipt_path, nullif(trim(p_note), '')
  ) returning * into v_row;

  v_what := case
    when v_row.covers_membership and v_row.covers_debt then 'mensualidad y saldo'
    when v_row.covers_membership then 'mensualidad'
    else 'saldo pendiente' end;
  perform private.notify(private.role_user_ids(array['partner', 'coach']), 'payment_reported',
    'Pago reportado por confirmar',
    v_member.full_name || ' reportó ' || private.cop(v_row.amount) || ' (' || v_what || ')'
      || coalesce(' a ' || v_row.account_label, '') || '.',
    '/manage/pending', jsonb_build_object('report_id', v_row.id, 'member_id', v_member.id));

  return v_row;
end;
$$;

-- El atleta cancela un reporte suyo que sigue pendiente (se equivocó).
create or replace function public.cancel_payment_report(p_report_id uuid)
returns public.payment_reports
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.payment_reports;
begin
  update public.payment_reports
  set status = 'cancelled', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_report_id and profile_id = auth.uid() and status = 'pending'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Ese pago ya no está en revisión' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

-- Staff confirma: renueva con el plan (valor cobrado ≤ precio de lista; la diferencia
-- queda como descuento) y/o abona a las deudas abiertas, de la más antigua a la más
-- reciente. Los avisos al atleta salen de los triggers de renovación y abono.
create or replace function public.approve_payment_report(
  p_report_id           uuid,
  p_received_by_partner uuid,
  p_payment_method      public.payment_method,
  p_plan_id             uuid default null,
  p_membership_amount   numeric default null,
  p_debt_amount         numeric default 0,
  p_note                text default null
)
returns public.payment_reports
language plpgsql security definer set search_path = ''
as $$
declare
  v_rep       public.payment_reports;
  v_plan      public.membership_plans;
  v_value     numeric(12,2);
  v_renewal   public.membership_renewals;
  v_left      numeric(12,2) := coalesce(p_debt_amount, 0);
  v_balance   numeric(12,2);
  v_debt      record;
  v_pay       numeric(12,2);
  v_note      text := coalesce(nullif(trim(p_note), ''), 'Pago reportado en la app');
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  select * into v_rep from public.payment_reports where id = p_report_id for update;
  if not found then
    raise exception 'Reporte no encontrado' using errcode = 'P0002';
  end if;
  if v_rep.status <> 'pending' then
    raise exception 'Ese pago ya fue revisado' using errcode = '22023';
  end if;
  if p_plan_id is null and v_left <= 0 then
    raise exception 'Elige un plan para renovar o un valor para abonar' using errcode = '22023';
  end if;
  if v_left < 0 then
    raise exception 'Abono inválido' using errcode = '22023';
  end if;

  if p_plan_id is not null then
    select * into v_plan from public.membership_plans where id = p_plan_id and is_active;
    if not found then
      raise exception 'Plan no encontrado o inactivo' using errcode = 'P0002';
    end if;
    v_value := coalesce(p_membership_amount, v_plan.price);
    if v_value < 0 or v_value > v_plan.price then
      raise exception 'El valor de la mensualidad debe estar entre 0 y el precio del plan (%)',
        private.cop(v_plan.price) using errcode = '22023';
    end if;
    v_renewal := public.renew_membership(
      v_rep.member_id, v_plan.id, p_payment_method, p_received_by_partner,
      v_plan.price - v_value,
      case when v_value < v_plan.price then 'Valor pagado según el comprobante reportado' end,
      v_note);
  end if;

  if v_left > 0 then
    select coalesce(sum(d.balance), 0) into v_balance
    from public.debts d where d.member_id = v_rep.member_id and d.voided_at is null and d.balance > 0;
    if v_left > v_balance then
      raise exception 'El abono supera el saldo pendiente (%)', private.cop(v_balance) using errcode = '22023';
    end if;
    for v_debt in
      select d.id, d.balance from public.debts d
      where d.member_id = v_rep.member_id and d.voided_at is null and d.balance > 0
      order by d.created_at, d.id
    loop
      exit when v_left <= 0;
      v_pay := least(v_left, v_debt.balance);
      insert into public.debt_payments (debt_id, amount, payment_method, received_by_partner, note)
      values (v_debt.id, v_pay, p_payment_method, p_received_by_partner, v_note);
      v_left := v_left - v_pay;
    end loop;
  end if;

  update public.payment_reports set
    status            = 'approved',
    reviewed_by       = auth.uid(),
    reviewed_at       = now(),
    review_note       = nullif(trim(p_note), ''),
    renewal_id        = v_renewal.id,
    membership_amount = case when p_plan_id is not null then v_value end,
    debt_amount       = nullif(coalesce(p_debt_amount, 0), 0)
  where id = p_report_id
  returning * into v_rep;

  return v_rep;
end;
$$;

-- Staff rechaza (no llegó el dinero, comprobante ilegible...). El atleta recibe el motivo.
create or replace function public.reject_payment_report(p_report_id uuid, p_reason text)
returns public.payment_reports
language plpgsql security definer set search_path = ''
as $$
declare
  v_rep public.payment_reports;
begin
  if not private.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Escribe el motivo para el atleta' using errcode = '22023';
  end if;

  update public.payment_reports set
    status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = trim(p_reason)
  where id = p_report_id and status = 'pending'
  returning * into v_rep;
  if v_rep.id is null then
    raise exception 'Ese pago ya fue revisado' using errcode = '22023';
  end if;

  perform private.notify(array[v_rep.profile_id], 'payment_reviewed',
    'No pudimos confirmar tu pago',
    'Tu pago de ' || private.cop(v_rep.amount) || ': ' || v_rep.review_note,
    '/?pay=report', jsonb_build_object('report_id', v_rep.id));
  return v_rep;
end;
$$;

revoke all on function public.report_payment(numeric, boolean, boolean, public.payment_method, uuid, text, text) from public, anon;
grant execute on function public.report_payment(numeric, boolean, boolean, public.payment_method, uuid, text, text) to authenticated;
revoke all on function public.cancel_payment_report(uuid) from public, anon;
grant execute on function public.cancel_payment_report(uuid) to authenticated;
revoke all on function public.approve_payment_report(uuid, uuid, public.payment_method, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.approve_payment_report(uuid, uuid, public.payment_method, uuid, numeric, numeric, text) to authenticated;
revoke all on function public.reject_payment_report(uuid, text) from public, anon;
grant execute on function public.reject_payment_report(uuid, text) to authenticated;

-- Realtime: el atleta ve el cambio de estado sin recargar.
alter publication supabase_realtime add table public.payment_reports;
