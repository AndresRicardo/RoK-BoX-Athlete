-- management_test.sql — Tests de RLS, RPCs, cuadre, bridge y notificaciones (DEV).
-- Ejecutar:  supabase db query --linked -f supabase/tests/management_test.sql
-- Todo corre en una transacción que se revierte al final: no deja datos.
-- Resultado: una fila por test (ok = true/false). Ver resumen al final.
--
-- Usuarios del seed: socio2 2222…, coach 3333…, atleta 4444… (vinculado a ZZTEST Atleta Dev),
-- atleta2 6666… (sin vincular), bridge 5555…. Se crea un socio de prueba 7777… para "Ricardo".

begin;

create schema zz_tests;
create table zz_tests.results (n serial primary key, name text not null, ok boolean not null, detail text);
grant usage on schema zz_tests to authenticated;
grant all on all tables in schema zz_tests to authenticated;
grant all on all sequences in schema zz_tests to authenticated;

create table zz_tests.ctx (key text primary key, val text);
grant all on zz_tests.ctx to authenticated;

-- Socio de prueba vinculado al socio "Ricardo"
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777',
        'authenticated', 'authenticated', 'ricardo.test@rokbox.co', '', now(), now());
insert into public.user_roles (user_id, role) values ('77777777-7777-7777-7777-777777777777', 'partner');

-- Los socios de DEV se pueden renombrar, cambiar de porcentaje o asociar a otras cuentas desde
-- la app: aquí se dejan como los esperan los tests (dentro de la transacción, que se revierte).
-- Los dos socios más antiguos pasan a ser "Ricardo" (cuenta 7777…) y "Socio Dos" (cuenta socio2).
update public.partners set user_id = null where user_id = '22222222-2222-2222-2222-222222222222';
update public.partners set name = 'zz_tmp_' || id where name in ('Ricardo', 'Socio Dos');
with two as (
  select id, row_number() over (order by created_at, id) as n
  from public.partners order by created_at, id limit 2
)
update public.partners p
set name = case two.n when 1 then 'Ricardo' else 'Socio Dos' end,
    share_percentage = 50, is_active = true,
    user_id = case two.n when 1 then '77777777-7777-7777-7777-777777777777'::uuid
                         else '22222222-2222-2222-2222-222222222222'::uuid end
from two where p.id = two.id;
update public.partners set is_active = false where name not in ('Ricardo', 'Socio Dos');
insert into public.user_roles (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'partner')
on conflict do nothing;

-- Catálogo propio de los tests: el de DEV lo editan los socios.
insert into public.membership_plans (name, kind, duration_months, duration_days, class_count, price)
values ('ZZTEST Mensual', 'period', 1, 0, null, 150000);
insert into public.products (name, category, price) values ('ZZTEST Bebida', 'store', 6000);
insert into public.expense_categories (name) values ('ZZTEST Otros');

insert into zz_tests.ctx values
  ('p_ricardo', (select id::text from public.partners where name = 'Ricardo')),
  ('p_socio2',  (select id::text from public.partners where name = 'Socio Dos')),
  ('n_partners', (select count(*)::text from public.partners)),
  ('plan_mensual', (select id::text from public.membership_plans where name = 'ZZTEST Mensual')),
  ('prod_bebida', (select id::text from public.products where name = 'ZZTEST Bebida')),
  ('cat_otros', (select id::text from public.expense_categories where name = 'ZZTEST Otros'));

-- =====================================================================
-- ATLETA (vinculado)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'atleta ve solo su membresía', count(*) = 1 and bool_and(full_name = 'ZZTEST Atleta Dev'), count(*)::text
  from public.membership_status;
  insert into zz_tests.results (name, ok, detail)
  select 'atleta no ve finanzas',
         (select count(*) from public.expenses) + (select count(*) from public.incomes)
         + (select count(*) from public.settlements) + (select count(*) from public.partners)
         + (select count(*) from public.audit_log) + (select count(*) from public.access_commands) = 0, null;
end $$;

do $$ begin
  perform public.renew_membership('a0000000-0000-0000-0000-000000000001',
    (select val::uuid from zz_tests.ctx where key = 'plan_mensual'), 'cash', null);
  insert into zz_tests.results (name, ok, detail) values ('atleta no puede renovar', false, 'no falló');
exception when insufficient_privilege then
  insert into zz_tests.results (name, ok) values ('atleta no puede renovar', true);
end $$;

do $$ begin
  insert into public.expenses (partner_id, scope, amount, title)
  values ((select val::uuid from zz_tests.ctx where key = 'p_ricardo'), 'BOX', 1000, 'hack');
  insert into zz_tests.results (name, ok, detail) values ('atleta no inserta gastos', false, 'no falló');
exception when insufficient_privilege then
  insert into zz_tests.results (name, ok) values ('atleta no inserta gastos', true);
end $$;

-- Funcionalidad existente de atletas sigue intacta tras 0022 (triggers del feed).
do $$ begin
  insert into public.prs (user_id, movement, type, value_numeric)
  values ('44444444-4444-4444-4444-444444444444', 'Back Squat', 'strength', 100);
  insert into zz_tests.results (name, ok, detail)
  select 'PR del atleta genera evento en el feed', count(*) = 1, count(*)::text
  from public.feed_events where user_id = '44444444-4444-4444-4444-444444444444';
exception when others then
  insert into zz_tests.results (name, ok, detail) values ('PR del atleta genera evento en el feed', false, sqlerrm);
end $$;

do $$ begin
  perform public.request_member_link('999000001');
  insert into zz_tests.results (name, ok, detail) values ('atleta ya vinculado no pide vínculo', false, 'no falló');
exception when others then
  insert into zz_tests.results (name, ok, detail) values ('atleta ya vinculado no pide vínculo', true, sqlerrm);
end $$;

reset role;

-- =====================================================================
-- ATLETA 2 (sin vincular) → solicitud
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_req public.member_link_requests;
begin
  v_req := public.request_member_link('999.000.002');
  insert into zz_tests.ctx values ('req2', v_req.id::text);
  insert into zz_tests.results (name, ok, detail)
  values ('atleta2 solicita vínculo (cédula normalizada)', v_req.document_id = '999000002' and v_req.status = 'pending', v_req.document_id);
  insert into zz_tests.results (name, ok, detail)
  select 'atleta2 aún no ve membresías', count(*) = 0, count(*)::text from public.membership_status;
end $$;

reset role;

-- =====================================================================
-- COACH
-- =====================================================================
-- DEV puede tener miembros reales importados: el coach debe ver todos los que existan.
insert into zz_tests.ctx select 'members_total', count(*)::text from public.members;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_req public.member_link_requests;
begin
  v_req := public.review_member_link((select val::uuid from zz_tests.ctx where key = 'req2'), true);
  insert into zz_tests.results (name, ok, detail)
  values ('coach aprueba vínculo', v_req.status = 'approved' and v_req.member_id = 'a0000000-0000-0000-0000-000000000002', v_req.status);
end $$;

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'coach ve todos los miembros', count(*) = (select val::int from zz_tests.ctx where key = 'members_total'),
         count(*)::text from public.membership_status;
  insert into zz_tests.results (name, ok, detail)
  select 'coach no ve gastos ni cuadres', (select count(*) from public.expenses) + (select count(*) from public.settlements) = 0, null;
  insert into zz_tests.results (name, ok, detail)
  select 'coach ve socios (para elegir quién recibe)',
         count(*) filter (where is_active) = 2 and count(*) = (select val::int from zz_tests.ctx where key = 'n_partners'),
         count(*)::text from public.partners;
end $$;

-- Renovar un vencido: vigencia nueva desde hoy, ingreso para el socio elegido.
do $$
declare
  v_r public.membership_renewals;
  v_expected timestamptz := private.period_end((now() at time zone 'America/Bogota')::date, 1, 0);
begin
  v_r := public.renew_membership('a0000000-0000-0000-0000-000000000003',
    (select val::uuid from zz_tests.ctx where key = 'plan_mensual'), 'nequi',
    (select val::uuid from zz_tests.ctx where key = 'p_socio2'));
  insert into zz_tests.ctx values ('renewal3', v_r.id::text);
  insert into zz_tests.results (name, ok, detail)
  values ('coach renueva vencido desde hoy', v_r.period_end = v_expected and v_r.amount = 150000,
          v_r.period_end::text || ' / ' || v_expected::text);
end $$;

-- Renovar un vigente: continúa desde el fin actual (E4).
do $$
declare
  v_prev timestamptz;
  v_r public.membership_renewals;
begin
  select valid_until into v_prev from public.memberships where member_id = 'a0000000-0000-0000-0000-000000000001';
  v_r := public.renew_membership('a0000000-0000-0000-0000-000000000001',
    (select val::uuid from zz_tests.ctx where key = 'plan_mensual'), 'cash',
    (select val::uuid from zz_tests.ctx where key = 'p_ricardo'), 20000, 'Precio pareja');
  insert into zz_tests.results (name, ok, detail)
  values ('renovar vigente continúa desde el fin actual y aplica descuento',
          v_r.period_start = v_prev
          and v_r.period_end = private.period_end((v_prev at time zone 'America/Bogota')::date, 1, 0)
          and v_r.amount = 130000,
          v_r.period_start::text || ' → ' || v_r.period_end::text);
end $$;

do $$ begin
  perform public.renew_membership('a0000000-0000-0000-0000-000000000003',
    (select val::uuid from zz_tests.ctx where key = 'plan_mensual'), 'cash', null);
  insert into zz_tests.results (name, ok, detail) values ('renovar sin socio receptor falla', false, 'no falló');
exception when others then
  insert into zz_tests.results (name, ok, detail) values ('renovar sin socio receptor falla', sqlstate = '22023', sqlerrm);
end $$;

do $$ begin
  perform public.set_member_access('a0000000-0000-0000-0000-000000000003', false);
  insert into zz_tests.results (name, ok, detail) values ('coach no puede bloquear', false, 'no falló');
exception when insufficient_privilege then
  insert into zz_tests.results (name, ok) values ('coach no puede bloquear', true);
end $$;

-- Tiquetera: 8/10 → 10/10 → bloqueo solicitado (P1) → no permite más.
do $$
declare v_s public.membership_status;
begin
  perform public.use_class('a0000000-0000-0000-0000-000000000002');
  perform public.use_class('a0000000-0000-0000-0000-000000000002');
  select * into v_s from public.membership_status where member_id = 'a0000000-0000-0000-0000-000000000002';
  insert into zz_tests.results (name, ok, detail)
  values ('tiquetera llega a 0 → estado no_classes', v_s.status = 'no_classes' and v_s.classes_left = 0, v_s.status);
  insert into zz_tests.results (name, ok, detail)
  select 'sin persona en HCAC no se encolan comandos (D36)', count(*) = 0, count(*)::text
  from public.access_commands where member_id = 'a0000000-0000-0000-0000-000000000002';
  begin
    perform public.use_class('a0000000-0000-0000-0000-000000000002');
    insert into zz_tests.results (name, ok, detail) values ('tiquetera sin clases no descuenta', false, 'no falló');
  exception when others then
    insert into zz_tests.results (name, ok, detail) values ('tiquetera sin clases no descuenta', true, sqlerrm);
  end;
end $$;

-- Anular renovaciones devuelve la membresía a como estaba (D44). Lo hace un socio.
reset role;
insert into public.membership_plans (name, kind, duration_months, duration_days, class_count, price)
values ('ZZTEST Tiquetera', 'class_pack', 3, 0, 10, 100000);
insert into zz_tests.ctx values
  ('plan_tiquetera', (select id::text from public.membership_plans where name = 'ZZTEST Tiquetera'));
insert into public.members (id, full_name) values
  ('b0000000-0000-0000-0000-0000000000b1', 'ZZTEST Anular 1'),
  ('b0000000-0000-0000-0000-0000000000b2', 'ZZTEST Anular 2');
insert into public.members (id, full_name, hik_person_id) values
  ('b0000000-0000-0000-0000-0000000000b3', 'ZZTEST Anular 3', 'zztest-hik-b3');

select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
set local role authenticated;

-- Primeras renovaciones: b1 sin plan → mensual (R1); b2 tiquetera (R1) con 3 clases.
do $$
declare v_r public.membership_renewals;
begin
  v_r := public.renew_membership('b0000000-0000-0000-0000-0000000000b1',
    (select val::uuid from zz_tests.ctx where key = 'plan_mensual'), 'cash',
    (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  insert into zz_tests.ctx values ('b1_r1', v_r.id::text);
  v_r := public.renew_membership('b0000000-0000-0000-0000-0000000000b2',
    (select val::uuid from zz_tests.ctx where key = 'plan_tiquetera'), 'cash',
    (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  insert into zz_tests.ctx values ('b2_r1', v_r.id::text);
  perform public.use_class('b0000000-0000-0000-0000-0000000000b2');
  perform public.use_class('b0000000-0000-0000-0000-0000000000b2');
  perform public.use_class('b0000000-0000-0000-0000-0000000000b2');
end $$;

-- En la transacción now() no avanza: las primeras renovaciones y clases pasan a hace 2 horas.
reset role;
update public.membership_renewals set created_at = created_at - interval '2 hours'
where member_id in ('b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000b2');
update public.class_usages set used_at = used_at - interval '2 hours'
where member_id = 'b0000000-0000-0000-0000-0000000000b2';
set local role authenticated;

-- Segundas renovaciones: tiquetera para los dos (b2 suma sus 7 clases restantes) y 2 clases.
do $$
declare v_r public.membership_renewals;
begin
  v_r := public.renew_membership('b0000000-0000-0000-0000-0000000000b1',
    (select val::uuid from zz_tests.ctx where key = 'plan_tiquetera'), 'cash',
    (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  insert into zz_tests.ctx values ('b1_r2', v_r.id::text);
  v_r := public.renew_membership('b0000000-0000-0000-0000-0000000000b2',
    (select val::uuid from zz_tests.ctx where key = 'plan_tiquetera'), 'cash',
    (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  insert into zz_tests.ctx values ('b2_r2', v_r.id::text);
  perform public.use_class('b0000000-0000-0000-0000-0000000000b1');
  perform public.use_class('b0000000-0000-0000-0000-0000000000b1');
  perform public.use_class('b0000000-0000-0000-0000-0000000000b2');
  perform public.use_class('b0000000-0000-0000-0000-0000000000b2');
end $$;

-- b1: anular R1 no cambia nada (R2 sigue activa); anular R2 lo deja sin plan, como estaba
-- antes de R1, y deshace las clases.
do $$
declare v_ms public.memberships;
begin
  perform public.void_renewal((select val::uuid from zz_tests.ctx where key = 'b1_r1'), 'Prueba');
  select * into v_ms from public.memberships where member_id = 'b0000000-0000-0000-0000-0000000000b1';
  insert into zz_tests.results (name, ok, detail)
  values ('anular con una renovación activa posterior no cambia la membresía',
          v_ms.plan_kind = 'class_pack' and v_ms.classes_total = 10 and v_ms.classes_used = 2
          and v_ms.valid_until = (select period_end from public.membership_renewals
                                  where id = (select val::uuid from zz_tests.ctx where key = 'b1_r2')),
          v_ms.plan_kind || ' ' || v_ms.classes_used || '/' || v_ms.classes_total);

  perform public.void_renewal((select val::uuid from zz_tests.ctx where key = 'b1_r2'), 'Prueba');
  select * into v_ms from public.memberships where member_id = 'b0000000-0000-0000-0000-0000000000b1';
  insert into zz_tests.results (name, ok, detail)
  values ('anular la última tiquetera deja la membresía como antes de las renovaciones anuladas',
          v_ms.plan_kind is null and v_ms.plan_name = 'Sin plan' and v_ms.valid_until is null
          and v_ms.classes_total is null and v_ms.classes_used = 0,
          coalesce(v_ms.plan_kind, 'null') || ' / ' || coalesce(v_ms.valid_until::text, 'null'));
  insert into zz_tests.results (name, ok, detail)
  select 'anular la tiquetera deshace sus clases', count(*) = 0, count(*)::text
  from public.class_usages where member_id = 'b0000000-0000-0000-0000-0000000000b1' and undone_at is null;
end $$;

-- b2: anular la recarga (R2) vuelve a R1 y las 2 clases nuevas cuentan en ella: 5 de 10.
do $$
declare v_ms public.memberships;
begin
  perform public.void_renewal((select val::uuid from zz_tests.ctx where key = 'b2_r2'), 'Prueba');
  select * into v_ms from public.memberships where member_id = 'b0000000-0000-0000-0000-0000000000b2';
  insert into zz_tests.results (name, ok, detail)
  values ('anular una recarga de tiquetera vuelve a la anterior con las clases usadas después',
          v_ms.plan_kind = 'class_pack' and v_ms.classes_total = 10 and v_ms.classes_used = 5
          and v_ms.valid_until = (select period_end from public.membership_renewals
                                  where id = (select val::uuid from zz_tests.ctx where key = 'b2_r1'))
          and (select count(*) from public.class_usages
               where member_id = v_ms.member_id and undone_at is null) = 5,
          v_ms.classes_used || '/' || v_ms.classes_total);
end $$;

-- Persona en HCAC sin membresía previa: anular su única renovación cierra el acceso en HCAC.
do $$
declare
  v_r public.membership_renewals;
begin
  v_r := public.renew_membership('b0000000-0000-0000-0000-0000000000b3',
    (select val::uuid from zz_tests.ctx where key = 'plan_mensual'), 'cash',
    (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  perform public.void_renewal(v_r.id, 'Prueba');
  insert into zz_tests.results (name, ok, detail)
  select 'anular sin membresía previa cierra el acceso en HCAC',
         count(*) = 1 and bool_and((payload->>'valid_until')::timestamptz <= now()),
         count(*)::text
  from public.access_commands
  where member_id = 'b0000000-0000-0000-0000-0000000000b3' and status = 'pending';
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

-- Deudas, abonos y venta.
do $$
declare
  v_d public.debts;
  v_s public.debt_summary;
begin
  v_d := public.create_debt('a0000000-0000-0000-0000-000000000001', 'Tienda',
    jsonb_build_array(
      jsonb_build_object('product_id', (select val from zz_tests.ctx where key = 'prod_bebida'), 'quantity', 2),
      jsonb_build_object('name', 'Cinta', 'quantity', 1, 'unit_price', 8000)));
  insert into zz_tests.ctx values ('debt1', v_d.id::text);
  insert into zz_tests.results (name, ok, detail)
  values ('crear deuda con ítems de catálogo y libres', v_d.total_amount = 20000, v_d.total_amount::text);

  begin
    insert into public.debt_payments (debt_id, amount, payment_method, received_by_partner)
    values (v_d.id, 25000, 'cash', (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
    insert into zz_tests.results (name, ok, detail) values ('abono mayor al saldo falla', false, 'no falló');
  exception when others then
    insert into zz_tests.results (name, ok, detail) values ('abono mayor al saldo falla', true, sqlerrm);
  end;

  insert into public.debt_payments (debt_id, amount, payment_method, received_by_partner)
  values (v_d.id, 5000, 'nequi', (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  select * into v_s from public.debt_summary where id = v_d.id;
  insert into zz_tests.results (name, ok, detail)
  values ('abono parcial actualiza saldo', v_s.balance = 15000 and v_s.status = 'partial', v_s.balance::text);

  perform public.register_sale((select val::uuid from zz_tests.ctx where key = 'prod_bebida'), 3, 'cash',
                               (select val::uuid from zz_tests.ctx where key = 'p_socio2'));
end $$;

do $$ begin
  delete from public.debt_items where debt_id = (select val::uuid from zz_tests.ctx where key = 'debt1');
  insert into zz_tests.results (name, ok, detail)
  select 'coach no borra ítems físicamente', count(*) = 2, count(*)::text
  from public.debt_items where debt_id = (select val::uuid from zz_tests.ctx where key = 'debt1');
end $$;

reset role;

-- Verificaciones como administrador
do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'renovación pagada genera ingreso del socio elegido', count(*) = 1, count(*)::text
  from public.incomes
  where source = 'membership' and source_ref = (select val::uuid from zz_tests.ctx where key = 'renewal3')
    and partner_id = (select val::uuid from zz_tests.ctx where key = 'p_socio2') and amount = 150000;
  insert into zz_tests.results (name, ok, detail)
  select 'abono genera ingreso', count(*) = 1, count(*)::text
  from public.incomes where source = 'debt_payment' and amount = 5000 and created_at >= now();
  insert into zz_tests.results (name, ok, detail)
  select 'venta de contado genera ingreso', count(*) = 1 and min(amount) = 18000, min(amount)::text
  from public.incomes where source = 'sale' and created_at >= now();
  insert into zz_tests.results (name, ok, detail)
  select 'renovar sin persona en HCAC no encola comandos (D36)', count(*) = 0, count(*)::text
  from public.access_commands where member_id = 'a0000000-0000-0000-0000-000000000003';
  insert into zz_tests.results (name, ok, detail)
  select 'atleta recibe avisos de cargo, abono y renovación', count(distinct type) = 3, string_agg(distinct type, ',')
  from public.notifications
  where recipient_id = '44444444-4444-4444-4444-444444444444'
    and type in ('debt_charged', 'debt_payment', 'membership_renewed');
  insert into zz_tests.results (name, ok, detail)
  select 'crear deuda con varios ítems envía un solo aviso de cargo', count(*) = 1, count(*)::text
  from public.notifications
  where recipient_id = '44444444-4444-4444-4444-444444444444' and type = 'debt_charged' and created_at >= now();
  insert into zz_tests.results (name, ok, detail)
  select 'auditoría registra cambios', count(*) > 0, count(*)::text
  from public.audit_log where table_name in ('membership_renewals', 'debt_payments', 'memberships');
end $$;

-- =====================================================================
-- SOCIO (Socio Dos)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_n int;
begin
  insert into public.expenses (partner_id, category_id, scope, amount, title)
  values ((select val::uuid from zz_tests.ctx where key = 'p_socio2'),
          (select val::uuid from zz_tests.ctx where key = 'cat_otros'), 'BOX', 30000, 'Escoba');
  insert into zz_tests.results (name, ok) values ('socio registra su gasto', true);

  begin
    insert into public.expenses (partner_id, scope, amount, title)
    values ((select val::uuid from zz_tests.ctx where key = 'p_ricardo'), 'BOX', 30000, 'a nombre de otro');
    insert into zz_tests.results (name, ok, detail) values ('socio no registra gastos de otro', false, 'no falló');
  exception when insufficient_privilege then
    insert into zz_tests.results (name, ok) values ('socio no registra gastos de otro', true);
  end;

  update public.incomes set amount = 1 where partner_id = (select val::uuid from zz_tests.ctx where key = 'p_ricardo');
  get diagnostics v_n = row_count;
  insert into zz_tests.results (name, ok, detail) values ('socio no edita ingresos de otro', v_n = 0, v_n::text);

  insert into zz_tests.results (name, ok, detail)
  select 'socio ve todos los ingresos', count(*) >= 3, count(*)::text from public.incomes;

  begin
    perform public.set_user_role('33333333-3333-3333-3333-333333333333', 'partner', false);
    insert into zz_tests.results (name, ok) values ('socio gestiona roles', true);
  exception when others then
    insert into zz_tests.results (name, ok, detail) values ('socio gestiona roles', false, sqlerrm);
  end;
end $$;

reset role;

-- =====================================================================
-- CUADRE (escenario calculado a mano, periodo 2026-01-01 … 2026-01-07)
-- =====================================================================
-- Ricardo: ingresos 1.000.000, gastos box 200.000, personales 50.000, entrega 100.000 a Socio Dos.
-- Socio Dos: ingresos 400.000, gastos box 100.000. Reserva 100.000.
-- Utilidad = 1.400.000 − 300.000 − 100.000 = 1.000.000 → 500.000 c/u.
-- Ricardo: esperado 650.000 → saldo −200.000.  Socio Dos: esperado 400.000 → saldo +100.000.
-- Transferencias: Ricardo → Socio Dos 100.000; Ricardo → reserva 100.000.
insert into public.incomes (partner_id, amount, concept, received_at)
select (select val::uuid from zz_tests.ctx where key = 'p_ricardo'), 1000000, 'Test', '2026-01-03 10:00-05'::timestamptz
union all
select (select val::uuid from zz_tests.ctx where key = 'p_socio2'), 400000, 'Test', '2026-01-07 23:30-05'::timestamptz;
insert into public.incomes (partner_id, amount, concept, received_at)
select (select val::uuid from zz_tests.ctx where key = 'p_socio2'), 999999, 'Fuera del periodo', '2026-01-08 00:00:01-05'::timestamptz;
insert into public.expenses (partner_id, scope, amount, title, spent_at) values
  ((select val::uuid from zz_tests.ctx where key = 'p_ricardo'), 'BOX', 200000, 'Test', '2026-01-02 12:00-05'),
  ((select val::uuid from zz_tests.ctx where key = 'p_ricardo'), 'PERSONAL', 50000, 'Test', '2026-01-02 12:00-05'),
  ((select val::uuid from zz_tests.ctx where key = 'p_socio2'), 'BOX', 100000, 'Test', '2026-01-01 00:00-05');
insert into public.partner_transfers (from_partner, to_partner, amount, transferred_at)
values ((select val::uuid from zz_tests.ctx where key = 'p_ricardo'),
        (select val::uuid from zz_tests.ctx where key = 'p_socio2'), 100000, '2026-01-05 18:00-05');

select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_c   jsonb;
  v_ric jsonb;
  v_s2  jsonb;
  v_set public.settlements;
  v_c2  jsonb;
begin
  v_c := public.calculate_settlement('2026-01-01', '2026-01-07', 100000,
           jsonb_build_object((select val from zz_tests.ctx where key = 'p_ricardo'), 600000));
  select x into v_ric from jsonb_array_elements(v_c->'partners') x where x->>'name' = 'Ricardo';
  select x into v_s2 from jsonb_array_elements(v_c->'partners') x where x->>'name' = 'Socio Dos';

  insert into zz_tests.results (name, ok, detail)
  values ('cuadre: totales', (v_c->>'total_income')::numeric = 1400000 and (v_c->>'box_expenses')::numeric = 300000
                             and (v_c->>'net_profit')::numeric = 1000000, v_c->>'net_profit');
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre: efectivo esperado', (v_ric->>'expected_cash')::numeric = 650000 and (v_s2->>'expected_cash')::numeric = 400000,
          (v_ric->>'expected_cash') || ' / ' || (v_s2->>'expected_cash'));
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre: saldos', (v_ric->>'net_balance')::numeric = -200000 and (v_s2->>'net_balance')::numeric = 100000,
          (v_ric->>'net_balance') || ' / ' || (v_s2->>'net_balance'));
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre: diferencia de efectivo declarado', (v_ric->>'cash_difference')::numeric = -50000
                                                      and (v_c->>'has_cash_differences')::boolean, v_ric->>'cash_difference');
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre: transferencias',
          jsonb_array_length(v_c->'transfers') = 2
          and (v_c->'transfers'->0->>'amount')::numeric = 100000 and v_c->'transfers'->0->>'to_name' = 'Socio Dos'
          and (v_c->'transfers'->1->>'amount')::numeric = 100000 and (v_c->'transfers'->1->>'to_reserve')::boolean,
          (v_c->'transfers')::text);

  v_set := public.save_settlement(null, '2026-01-01', '2026-01-07', 100000, '{}');
  perform public.set_settlement_transfer_paid(v_set.id, 0, true);
  v_c2 := public.calculate_settlement('2026-01-01', '2026-01-07', 100000, '{}');
  insert into zz_tests.results (name, ok, detail)
  values ('pagar transferencia del cuadre no altera el cuadre', v_c2->'transfers' = v_c->'transfers', null);
  insert into zz_tests.results (name, ok, detail)
  select 'cuadre recién guardado no está modificado', not modified_after, null
  from public.settlement_list where id = v_set.id;
  insert into zz_tests.ctx values ('settlement', v_set.id::text);
end $$;

-- Cuadre manual (0025): con los mismos totales escritos a mano da exactamente el mismo resultado.
do $$
declare
  v_ric  text := (select val from zz_tests.ctx where key = 'p_ricardo');
  v_s2   text := (select val from zz_tests.ctx where key = 'p_socio2');
  v_auto jsonb;
  v_man  jsonb;
  v_set  public.settlements;
begin
  v_auto := public.calculate_settlement('2026-01-01', '2026-01-07', 100000, jsonb_build_object(v_ric, 600000));
  v_man := public.calculate_manual_settlement('2026-01-01', '2026-01-07', 100000, jsonb_build_object(
    v_ric, jsonb_build_object('income_collected', 1000000, 'box_expenses_paid', 200000, 'personal_expenses', 50000,
                              'transfers_given', 100000, 'transfers_received', 0, 'declared_cash', 600000),
    v_s2, jsonb_build_object('income_collected', 400000, 'box_expenses_paid', 100000, 'transfers_received', 100000)));
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre manual: mismo resultado que el calculado con los mismos datos',
          (v_man - 'is_manual') = (v_auto - 'is_manual') and (v_man->>'is_manual')::boolean
          and not (v_auto->>'is_manual')::boolean,
          (v_man->'transfers')::text);

  v_man := public.calculate_manual_settlement('2025-12-01', '2025-12-31', 0, jsonb_build_object(
    v_ric, jsonb_build_object('income_collected', 300000, 'transfers_given', 50000)));
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre manual: socio sin datos cuenta en 0 y avisa entregas descuadradas',
          jsonb_array_length(v_man->'partners') = 2 and (v_man->>'total_income')::numeric = 300000
          and (v_man->>'transfers_mismatch')::boolean,
          v_man->>'total_income');

  begin
    perform public.calculate_manual_settlement('2025-12-01', '2025-12-31', 0,
      jsonb_build_object(gen_random_uuid()::text, jsonb_build_object('income_collected', 1)));
    insert into zz_tests.results (name, ok, detail) values ('cuadre manual: rechaza socio desconocido', false, 'no falló');
  exception when sqlstate '22023' then
    insert into zz_tests.results (name, ok) values ('cuadre manual: rechaza socio desconocido', true);
  end;
  begin
    perform public.calculate_manual_settlement('2025-12-01', '2025-12-31', 0,
      jsonb_build_object(v_ric, jsonb_build_object('income_collected', -5)));
    insert into zz_tests.results (name, ok, detail) values ('cuadre manual: rechaza montos negativos', false, 'no falló');
  exception when sqlstate '22023' then
    insert into zz_tests.results (name, ok) values ('cuadre manual: rechaza montos negativos', true);
  end;
  begin
    perform public.calculate_manual_settlement('2025-12-01', '2025-12-31', 0,
      jsonb_build_object(v_ric, jsonb_build_object('income_collected', '1000')));
    insert into zz_tests.results (name, ok, detail) values ('cuadre manual: rechaza texto en un monto', false, 'no falló');
  exception when sqlstate '22023' then
    insert into zz_tests.results (name, ok) values ('cuadre manual: rechaza texto en un monto', true);
  end;

  v_set := public.save_manual_settlement(null, '2026-01-01', '2026-01-07', 100000, jsonb_build_object(
    v_ric, jsonb_build_object('income_collected', 1000000, 'box_expenses_paid', 200000, 'personal_expenses', 50000,
                              'transfers_given', 100000),
    v_s2, jsonb_build_object('income_collected', 400000, 'box_expenses_paid', 100000, 'transfers_received', 100000)),
    'Nota manual');
  insert into zz_tests.results (name, ok, detail)
  values ('cuadre manual: se guarda marcado como manual',
          v_set.is_manual and v_set.title like 'Cuadre manual 2026-01-01%' and v_set.net_profit = 1000000
          and jsonb_array_length(v_set.transfers) = 2,
          v_set.title);
  insert into zz_tests.ctx values ('settlement_manual', v_set.id::text);
end $$;

reset role;

-- Un coach no puede hacer cuadres manuales.
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.calculate_manual_settlement('2025-12-01', '2025-12-31', 0, '{}');
  insert into zz_tests.results (name, ok, detail) values ('cuadre manual: solo socios', false, 'no falló');
exception when insufficient_privilege then
  insert into zz_tests.results (name, ok) values ('cuadre manual: solo socios', true);
end $$;
reset role;

-- En una sola transacción now() no avanza: se simula que el cuadre se guardó antes.
update public.settlements set created_at = now() - interval '1 minute'
where id = (select val::uuid from zz_tests.ctx where key = 'settlement');
update public.incomes set amount = 1000001
where concept = 'Test' and amount = 1000000;

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'cuadre marca movimientos modificados después', modified_after, null
  from public.settlement_list where id = (select val::uuid from zz_tests.ctx where key = 'settlement');
end $$;

update public.settlements set created_at = now() - interval '2 minutes'
where id = (select val::uuid from zz_tests.ctx where key = 'settlement_manual');
do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'cuadre manual: no se marca por movimientos de la app', not modified_after, null
  from public.settlement_list where id = (select val::uuid from zz_tests.ctx where key = 'settlement_manual');
end $$;

-- =====================================================================
-- BRIDGE
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cmd  public.access_commands;
  v_res  jsonb;
  v_ms   public.memberships;
  v_until timestamptz;
begin
  -- Las personas aparecen en HCAC (registradas allá) con vigencias viejas: se vinculan por
  -- cédula y la app empuja su vigencia (renovación) y el bloqueo de la tiquetera agotada.
  v_res := public.bridge_sync_persons(jsonb_build_array(
    jsonb_build_object('hik_person_id', 'HIK-003', 'person_code', '999000003', 'full_name', 'ZZTEST Vencido',
                       'valid_from', now() - interval '40 days', 'valid_until', now() - interval '10 days'),
    jsonb_build_object('hik_person_id', 'HIK-002', 'person_code', '999000002', 'full_name', 'ZZTEST Tiquetera',
                       'valid_from', now() - interval '5 days', 'valid_until', now() + interval '50 days')), false);
  insert into zz_tests.results (name, ok, detail)
  values ('personas de HCAC se vinculan por cédula', (v_res->>'adopted')::int = 2, v_res::text);
  insert into zz_tests.results (name, ok, detail)
  select 'al vincular: renovación de la app y bloqueo de tiquetera se envían a HCAC',
         count(*) filter (where member_id = 'a0000000-0000-0000-0000-000000000003' and (payload->>'valid_until')::timestamptz > now()) = 1
         and count(*) filter (where member_id = 'a0000000-0000-0000-0000-000000000002' and (payload->>'valid_until')::timestamptz <= now()) = 1,
         count(*)::text
  from public.access_commands where status = 'pending';

  -- Procesar todos los comandos pendientes como si HCAC los aplicara.
  loop
    v_cmd := public.claim_next_access_command();
    exit when v_cmd.id is null;
    perform public.complete_access_command(v_cmd.id, true);
  end loop;

  select * into v_ms from public.memberships where member_id = 'a0000000-0000-0000-0000-000000000003';
  insert into zz_tests.results (name, ok, detail)
  values ('comando completado registra estado confirmado en HCAC', v_ms.hik_valid_until = v_ms.valid_until,
          coalesce(v_ms.hik_valid_until::text, 'null'));

  -- Lectura sin cambios: no genera nada.
  v_res := public.bridge_sync_persons(jsonb_build_array(
    jsonb_build_object('hik_person_id', 'HIK-003', 'person_code', '999000003', 'full_name', 'ZZTEST Vencido',
                       'valid_from', v_ms.hik_valid_from, 'valid_until', v_ms.hik_valid_until, 'access_enabled', true)), false);
  insert into zz_tests.results (name, ok, detail)
  values ('lectura sin cambios no genera pendientes (sin ciclos)',
          (v_res->>'extended')::int = 0 and (v_res->>'changed')::int = 0, v_res::text);

  -- Extensión hecha en HCAC → renovación pendiente de pago.
  v_until := v_ms.hik_valid_until + interval '30 days';
  v_res := public.bridge_sync_persons(jsonb_build_array(
    jsonb_build_object('hik_person_id', 'HIK-003', 'person_code', '999000003', 'full_name', 'ZZTEST Vencido',
                       'valid_from', v_ms.hik_valid_from, 'valid_until', v_until, 'access_enabled', true),
    jsonb_build_object('hik_person_id', 'HIK-900', 'person_code', '999000900', 'full_name', 'ZZTEST Nuevo HCAC',
                       'valid_from', now(), 'valid_until', now() + interval '10 days', 'access_enabled', true)), false);
  insert into zz_tests.results (name, ok, detail)
  values ('extensión en HCAC → pendiente; persona nueva → miembro',
          (v_res->>'extended')::int = 1 and (v_res->>'created')::int = 1, v_res::text);

end $$;

reset role;

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'tras extensión en HCAC: pendiente de pago, origen hikcentral',
         status = 'active' and has_pending_payment and last_change_origin = 'hikcentral', status
  from public.membership_status where member_id = 'a0000000-0000-0000-0000-000000000003';
  insert into zz_tests.results (name, ok, detail)
  select 'socios avisados de renovación pendiente',
         count(*) = (select count(*) from public.user_roles where role = 'partner'), count(*)::text
  from public.notifications where type = 'renewal_pending' and created_at >= now();
  insert into zz_tests.results (name, ok, detail)
  select 'miembro creado desde HCAC', source = 'hikcentral', source from public.members where hik_person_id = 'HIK-900';
end $$;

-- Socio bloquea desde la app → el bridge pone EndDate = ahora (D35).
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.set_member_access('a0000000-0000-0000-0000-000000000003', false);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_cmd public.access_commands;
  v_ms  public.memberships;
  v_res jsonb;
begin
  v_cmd := public.claim_next_access_command();
  insert into zz_tests.results (name, ok, detail)
  values ('bloquear encola set_validity con EndDate = ahora',
          v_cmd.command = 'set_validity' and (v_cmd.payload->>'valid_until')::timestamptz <= now(), v_cmd.payload::text);
  perform public.complete_access_command(v_cmd.id, true);

  -- Lectura con el bloqueo ya aplicado: sin cambios.
  select * into v_ms from public.memberships where member_id = 'a0000000-0000-0000-0000-000000000003';
  v_res := public.bridge_sync_persons(jsonb_build_array(
    jsonb_build_object('hik_person_id', 'HIK-003', 'person_code', '999000003',
                       'valid_from', v_ms.hik_valid_from, 'valid_until', v_ms.hik_valid_until)), false);
  insert into zz_tests.results (name, ok, detail)
  values ('bloqueo aplicado no se detecta como cambio externo',
          (v_res->>'changed')::int = 0 and (v_res->>'extended')::int = 0, v_res::text);

  -- Alguien restaura la vigencia directamente en HCAC → desbloqueo.
  v_res := public.bridge_sync_persons(jsonb_build_array(
    jsonb_build_object('hik_person_id', 'HIK-003', 'person_code', '999000003',
                       'valid_from', v_ms.hik_valid_from, 'valid_until', v_ms.valid_until)), false);
  insert into zz_tests.results (name, ok, detail)
  values ('restaurar vigencia en HCAC cuenta como cambio (sin renovación nueva)',
          (v_res->>'changed')::int = 1 and (v_res->>'extended')::int = 0, v_res::text);
end $$;

reset role;

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'desbloqueo hecho en HCAC se refleja en la app', status <> 'disabled' and access_enabled, status
  from public.membership_status where member_id = 'a0000000-0000-0000-0000-000000000003';
end $$;

-- Socio completa el pago pendiente.
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_r public.membership_renewals;
begin
  select * into v_r from public.membership_renewals where payment_status = 'pending' limit 1;
  v_r := public.complete_pending_renewal(v_r.id, 150000, 'cash',
           (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
  insert into zz_tests.results (name, ok, detail)
  select 'completar pago pendiente genera ingreso', count(*) = 1, count(*)::text
  from public.incomes where source = 'membership' and source_ref = v_r.id and amount = 150000;
end $$;

reset role;

-- No-bridge no puede sincronizar.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.bridge_sync_persons('[]'::jsonb, true);
  insert into zz_tests.results (name, ok, detail) values ('solo el bridge sincroniza', false, 'no falló');
exception when insufficient_privilege then
  insert into zz_tests.results (name, ok) values ('solo el bridge sincroniza', true);
end $$;
reset role;

-- =====================================================================
-- INVITACIONES POR CORREO
-- =====================================================================
insert into public.role_invites (email, roles) values ('nuevo.coach@rokbox.co', array['coach']);
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888',
        'authenticated', 'authenticated', 'Nuevo.Coach@rokbox.co', '', now(), now());

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'invitación asigna rol al crear la cuenta', count(*) = 1, count(*)::text
  from public.user_roles where user_id = '88888888-8888-8888-8888-888888888888' and role = 'coach';
  insert into zz_tests.results (name, ok, detail)
  select 'invitación del dueño (seed) pendiente o aplicada', count(*) = 1, count(*)::text
  from public.role_invites where email = 'ricaldo2431@gmail.com';
end $$;

-- =====================================================================
-- TRABAJOS PROGRAMADOS
-- =====================================================================
do $$ begin
  perform private.job_membership_expiring();
  perform private.job_debt_reminders();
  perform private.job_weekly_summary();
  perform private.job_bridge_watchdog();
  insert into zz_tests.results (name, ok) values ('trabajos programados se ejecutan', true);
exception when others then
  insert into zz_tests.results (name, ok, detail) values ('trabajos programados se ejecutan', false, sqlerrm);
end $$;

-- =====================================================================
-- PUSH (0023)
-- =====================================================================
-- Atleta registra un dispositivo; luego atleta2 inicia sesión en el mismo teléfono.
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.register_push_subscription('https://push.example/zz-device', 'p256dh-key', 'auth-key', 'test');
  insert into zz_tests.results (name, ok, detail)
  select 'push: el atleta registra su dispositivo', count(*) = 1, count(*)::text
  from public.push_subscriptions where endpoint = 'https://push.example/zz-device';
  begin
    perform public.register_push_subscription('http://inseguro', 'a', 'b', null);
    insert into zz_tests.results (name, ok) values ('push: rechaza endpoint no https', false);
  exception when others then
    insert into zz_tests.results (name, ok, detail) values ('push: rechaza endpoint no https', sqlstate = '22023', sqlstate);
  end;
  begin
    perform public.claim_push_batch(10);
    insert into zz_tests.results (name, ok) values ('push: un usuario no puede reclamar el lote', false);
  exception when insufficient_privilege then
    insert into zz_tests.results (name, ok) values ('push: un usuario no puede reclamar el lote', true);
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.register_push_subscription('https://push.example/zz-device', 'p256dh-2', 'auth-2', 'test');
  insert into zz_tests.results (name, ok, detail)
  select 'push: el dispositivo pasa a la cuenta que inició sesión', count(*) = 1, count(*)::text
  from public.push_subscriptions where endpoint = 'https://push.example/zz-device';
end $$;
reset role;

do $$
declare
  v_ids uuid[];
begin
  insert into zz_tests.results (name, ok, detail)
  select 'push: la suscripción quedó a nombre de atleta2', user_id = '66666666-6666-6666-6666-666666666666', user_id::text
  from public.push_subscriptions where endpoint = 'https://push.example/zz-device';

  -- Lote: atleta2 desactivó "like": ese aviso se marca como enviado pero no se devuelve.
  update public.notifications set pushed_at = now() where pushed_at is null;
  insert into public.notification_preferences (user_id, disabled_types)
  values ('66666666-6666-6666-6666-666666666666', array['like'])
  on conflict (user_id) do update set disabled_types = excluded.disabled_types;
  insert into public.notifications (recipient_id, actor_id, type, title, body)
  values ('66666666-6666-6666-6666-666666666666', null, 'debt_reminder', 'A', 'a'),
         ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', 'like', null, null),
         ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'like', null, null);
  insert into public.notifications (recipient_id, actor_id, type, title, body, created_at)
  values ('66666666-6666-6666-6666-666666666666', null, 'debt_reminder', 'Viejo', 'v', now() - interval '2 days');

  select array_agg(id) into v_ids from public.claim_push_batch(50);
  insert into zz_tests.results (name, ok, detail)
  select 'push: el lote devuelve solo lo enviable', coalesce(array_length(v_ids, 1), 0) = 2,
         coalesce(array_length(v_ids, 1), 0)::text;
  insert into zz_tests.results (name, ok, detail)
  select 'push: todo queda marcado (incluye desactivado y viejo)', count(*) = 0, count(*)::text
  from public.notifications where pushed_at is null;
  insert into zz_tests.results (name, ok, detail)
  select 'push: un segundo lote sale vacío', count(*) = 0, count(*)::text from public.claim_push_batch(50);
end $$;

-- =====================================================================
-- RECORDATORIOS DE DEUDA POR WHATSAPP (0024)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_rem public.debt_reminders;
  v_member uuid;
begin
  perform public.create_debt('a0000000-0000-0000-0000-000000000001', 'Recordatorio test',
    '[{"name":"Ítem recordatorio","quantity":1,"unit_price":5000}]'::jsonb);
  v_rem := public.log_debt_reminder('a0000000-0000-0000-0000-000000000001');
  insert into zz_tests.results (name, ok, detail)
  select 'recordatorio: el coach lo registra con el saldo real',
         v_rem.balance = (select sum(balance) from public.debts
                          where member_id = 'a0000000-0000-0000-0000-000000000001' and voided_at is null)
         and v_rem.sent_by = '33333333-3333-3333-3333-333333333333',
         v_rem.balance::text;
  insert into zz_tests.results (name, ok, detail)
  select 'recordatorio: la vista muestra el último y quién lo envió',
         last_reminder_by = '33333333-3333-3333-3333-333333333333' and last_reminder_at = v_rem.sent_at
         and balance = v_rem.balance,
         last_reminder_at::text
  from public.debtor_summary where member_id = 'a0000000-0000-0000-0000-000000000001';

  v_member := (public.upsert_member(null, 'ZZTEST Sin Deuda', null, null, null, null)).id;
  begin
    perform public.log_debt_reminder(v_member);
    insert into zz_tests.results (name, ok, detail) values ('recordatorio: sin saldo no se registra', false, 'no falló');
  exception when sqlstate '22023' then
    insert into zz_tests.results (name, ok) values ('recordatorio: sin saldo no se registra', true);
  end;

  begin
    insert into public.debt_reminders (member_id, balance, sent_by)
    values ('a0000000-0000-0000-0000-000000000001', 1, '33333333-3333-3333-3333-333333333333');
    insert into zz_tests.results (name, ok, detail) values ('recordatorio: no se inserta directo en la tabla', false, 'no falló');
  exception when insufficient_privilege then
    insert into zz_tests.results (name, ok) values ('recordatorio: no se inserta directo en la tabla', true);
  end;

  begin
    insert into public.app_settings (key, value) values ('debt_reminder_template', 'hack');
    insert into zz_tests.results (name, ok, detail) values ('plantilla: el coach no la edita', false, 'no falló');
  exception when insufficient_privilege then
    insert into zz_tests.results (name, ok) values ('plantilla: el coach no la edita', true);
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  insert into public.app_settings (key, value) values ('debt_reminder_template', 'Hola {nombre}, debes {total}')
  on conflict (key) do update set value = excluded.value;
  insert into zz_tests.results (name, ok, detail)
  select 'plantilla: el socio la guarda y queda auditada',
         (select count(*) from public.app_settings where key = 'debt_reminder_template') = 1
         and exists (select 1 from public.audit_log where table_name = 'app_settings'
                     and record_id = 'debt_reminder_template' and changed_at >= now()),
         null;
  begin
    insert into public.app_settings (key, value) values ('otra_clave', 'x');
    insert into zz_tests.results (name, ok, detail) values ('plantilla: solo claves conocidas', false, 'no falló');
  exception when check_violation then
    insert into zz_tests.results (name, ok) values ('plantilla: solo claves conocidas', true);
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'plantilla: el coach la lee', count(*) = 1, count(*)::text
  from public.app_settings where key = 'debt_reminder_template';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'recordatorio: el atleta no ve recordatorios ni la plantilla',
         (select count(*) from public.debt_reminders) + (select count(*) from public.app_settings) = 0, null;
  begin
    perform public.log_debt_reminder('a0000000-0000-0000-0000-000000000001');
    insert into zz_tests.results (name, ok, detail) values ('recordatorio: el atleta no puede registrar', false, 'no falló');
  exception when insufficient_privilege then
    insert into zz_tests.results (name, ok) values ('recordatorio: el atleta no puede registrar', true);
  end;
end $$;
reset role;

-- =====================================================================
-- ASOCIAR LA CUENTA DE UN SOCIO (0026)
-- =====================================================================
-- Al final: cambia las cuentas de los socios y le quita el rol a socio2.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999',
        'authenticated', 'authenticated', 'ricardo.real@rokbox.co', '', now(), now());

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.assign_partner_account((select val::uuid from zz_tests.ctx where key = 'p_ricardo'),
                                        '99999999-9999-9999-9999-999999999999');
  insert into zz_tests.results (name, ok, detail) values ('cuenta de socio: el coach no puede asociar', false, 'no falló');
exception when insufficient_privilege then
  insert into zz_tests.results (name, ok) values ('cuenta de socio: el coach no puede asociar', true);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  -- El socio Ricardo ya tiene cuenta (7777…): pasa a la cuenta nueva.
  perform public.assign_partner_account((select val::uuid from zz_tests.ctx where key = 'p_ricardo'),
                                        '99999999-9999-9999-9999-999999999999');
  insert into zz_tests.results (name, ok) values ('cuenta de socio: se puede asociar un socio que ya tenía cuenta', true);

  begin
    perform public.assign_partner_account((select val::uuid from zz_tests.ctx where key = 'p_socio2'),
                                          '88888888-8888-8888-8888-888888888888');
    insert into zz_tests.results (name, ok, detail) values ('cuenta de socio: no pasa su propio socio a otra cuenta', false, 'no falló');
  exception when invalid_parameter_value then
    insert into zz_tests.results (name, ok, detail) values ('cuenta de socio: no pasa su propio socio a otra cuenta', sqlerrm like '%propio socio%', sqlerrm);
  end;
end $$;
reset role;

do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'cuenta de socio: la cuenta nueva queda como socio',
         p.user_id = '99999999-9999-9999-9999-999999999999'
         and exists (select 1 from public.user_roles where user_id = p.user_id and role = 'partner'),
         p.user_id::text
  from public.partners p where p.id = (select val::uuid from zz_tests.ctx where key = 'p_ricardo');
  insert into zz_tests.results (name, ok, detail)
  select 'cuenta de socio: la cuenta anterior deja de ser socio', count(*) = 0, count(*)::text
  from public.user_roles where user_id = '77777777-7777-7777-7777-777777777777' and role = 'partner';
end $$;

-- Una cuenta no puede ser de dos socios.
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.assign_partner_account((select val::uuid from zz_tests.ctx where key = 'p_socio2'),
                                        '99999999-9999-9999-9999-999999999999');
  insert into zz_tests.results (name, ok, detail) values ('cuenta de socio: una cuenta no es de dos socios', false, 'no falló');
exception when invalid_parameter_value then
  insert into zz_tests.results (name, ok, detail) values ('cuenta de socio: una cuenta no es de dos socios', sqlerrm like '%ya es del socio Ricardo%', sqlerrm);
end $$;

-- Quitar el rol de socio libera su socio.
do $$ begin
  perform public.set_user_role('99999999-9999-9999-9999-999999999999', 'partner', true);
  perform public.set_user_role('22222222-2222-2222-2222-222222222222', 'partner', false);
end $$;
reset role;
do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'cuenta de socio: quitar el rol libera el socio', user_id is null, user_id::text
  from public.partners where id = (select val::uuid from zz_tests.ctx where key = 'p_socio2');
end $$;

-- Una invitación con socio también reemplaza la cuenta anterior.
insert into public.role_invites (email, roles, partner_id)
values ('socio.nuevo@rokbox.co', array['partner'], (select val::uuid from zz_tests.ctx where key = 'p_ricardo'));
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'authenticated', 'authenticated', 'socio.nuevo@rokbox.co', '', now(), now());
do $$ begin
  insert into zz_tests.results (name, ok, detail)
  select 'cuenta de socio: la invitación reemplaza la cuenta anterior',
         p.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
         and not exists (select 1 from public.user_roles
                         where user_id = '99999999-9999-9999-9999-999999999999' and role = 'partner'),
         p.user_id::text
  from public.partners p where p.id = (select val::uuid from zz_tests.ctx where key = 'p_ricardo');
end $$;

-- =====================================================================
-- RESULTADO
-- =====================================================================
select n, ok, name, detail from zz_tests.results
union all
select 999, bool_and(ok), 'RESUMEN: ' || count(*) filter (where ok) || '/' || count(*) || ' ok', null
from zz_tests.results
order by 1;

rollback;
