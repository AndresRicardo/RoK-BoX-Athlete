-- seed.sql — SOLO DEV (se ejecuta con `supabase db reset --linked`).
-- Usuarios de prueba con contraseñas aleatorias (no se guardan en git). Para iniciar
-- sesión con alguno, definir la contraseña a mano (ver supabase/README.md).

-- =====================================================================
-- 1. USUARIOS DE PRUEBA
-- =====================================================================
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('22222222-2222-2222-2222-222222222222'::uuid, 'socio2.dev@rokbox.co',  'Socio Dos Dev'),
      ('33333333-3333-3333-3333-333333333333'::uuid, 'coach.dev@rokbox.co',   'Coach Dev'),
      ('44444444-4444-4444-4444-444444444444'::uuid, 'atleta.dev@rokbox.co',  'Atleta Dev'),
      ('66666666-6666-6666-6666-666666666666'::uuid, 'atleta2.dev@rokbox.co', 'Atleta Dos Dev'),
      ('55555555-5555-5555-5555-555555555555'::uuid, 'bridge.dev@rokbox.co',  'Bridge Box PC')
    ) as v(id, email, full_name)
  loop
    delete from auth.users where email = u.email and id <> u.id;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
            '', '', '', '',
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
            now(), now())
    on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password;

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), u.id, u.id::text, 'email',
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            now(), now(), now())
    on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

insert into public.profiles (id, first_name, last_name, display_name, discipline, box_name) values
  ('22222222-2222-2222-2222-222222222222', 'Socio', 'Dos', 'socio2dev', 'rx', 'RöK BoX'),
  ('33333333-3333-3333-3333-333333333333', 'Coach', 'Dev', 'coachdev', 'rx', 'RöK BoX'),
  ('44444444-4444-4444-4444-444444444444', 'Atleta', 'Dev', 'atletadev', 'scaled', 'RöK BoX'),
  ('66666666-6666-6666-6666-666666666666', 'Atleta', 'Dos', 'atleta2dev', 'beginner', 'RöK BoX')
on conflict (id) do nothing;

-- =====================================================================
-- 2. ROLES Y SOCIOS
-- =====================================================================
insert into public.user_roles (user_id, role) values
  ('22222222-2222-2222-2222-222222222222', 'partner'),
  ('33333333-3333-3333-3333-333333333333', 'coach'),
  ('55555555-5555-5555-5555-555555555555', 'bridge')
on conflict do nothing;

insert into public.partners (name, share_percentage, color_hex)
values ('Ricardo', 50, '#FFC815');

insert into public.partners (user_id, name, share_percentage, color_hex)
values ('22222222-2222-2222-2222-222222222222', 'Socio Dos', 50, '#10B981');

-- La cuenta Google del dueño queda como socio "Ricardo" al iniciar sesión en el preview.
insert into public.role_invites (email, roles, partner_id)
select 'ricaldo2431@gmail.com', array['partner'], id from public.partners where name = 'Ricardo';
select private.apply_role_invites(id, email) from auth.users where email = 'ricaldo2431@gmail.com';

-- =====================================================================
-- 3. CATÁLOGOS
-- =====================================================================
insert into public.membership_plans (name, kind, duration_months, duration_days, class_count, price, sort_order) values
  ('Mensual',             'period',     1,  0, null, 150000, 1),
  ('Trimestral',          'period',     3,  0, null, 400000, 2),
  ('Semestral',           'period',     6,  0, null, 750000, 3),
  ('Anual',               'period',    12,  0, null, 1400000, 4),
  ('Tiquetera 10 clases', 'class_pack', 2,  0, 10,   120000, 5),
  ('Clase suelta',        'class_pack', 0,  1, 1,    20000, 6);

insert into public.products (name, category, price, sort_order) values
  ('Bebida hidratante',    'store',      6000, 1),
  ('Proteína (porción)',   'store',      8000, 2),
  ('Barra de proteína',    'store',      7000, 3),
  ('Calleras',             'equipment', 45000, 4),
  ('Cuerda de saltar',     'equipment', 60000, 5),
  ('Rodilleras (par)',     'equipment', 90000, 6),
  ('Camiseta RöK BoX',     'other',     55000, 7);

insert into public.expense_categories (name, icon_emoji, color_hex, sort_order) values
  ('Arriendo',          '🏠', '#6366F1', 1),
  ('Servicios',         '💡', '#F59E0B', 2),
  ('Equipos',           '🏋️', '#10B981', 3),
  ('Mantenimiento',     '🛠️', '#64748B', 4),
  ('Aseo',              '🧽', '#06B6D4', 5),
  ('Mercancía tienda',  '🛒', '#EC4899', 6),
  ('Publicidad',        '📣', '#8B5CF6', 7),
  ('Personal',          '👤', '#EF4444', 8),
  ('Otros',             '💸', '#94A3B8', 9);

-- =====================================================================
-- 4. MIEMBROS DE PRUEBA (ZZTEST, cédulas 999000xxx)
-- =====================================================================
insert into public.members (id, document_id, full_name, phone, profile_id, source) values
  ('a0000000-0000-0000-0000-000000000001', '999000001', 'ZZTEST Atleta Dev',      '3000000001',
   '44444444-4444-4444-4444-444444444444', 'app'),
  ('a0000000-0000-0000-0000-000000000002', '999000002', 'ZZTEST Tiquetera',       '3000000002', null, 'app'),
  ('a0000000-0000-0000-0000-000000000003', '999000003', 'ZZTEST Vencido',         '3000000003', null, 'app');

insert into public.memberships (member_id, plan_id, plan_name, plan_kind, valid_from, valid_until, classes_total, classes_used)
select 'a0000000-0000-0000-0000-000000000001', id, name, kind, now() - interval '20 days',
       private.period_end((now() at time zone 'America/Bogota')::date + 10, 0, 0), null, 0
from public.membership_plans where name = 'Mensual';

insert into public.memberships (member_id, plan_id, plan_name, plan_kind, valid_from, valid_until, classes_total, classes_used)
select 'a0000000-0000-0000-0000-000000000002', id, name, kind, now() - interval '5 days',
       private.period_end((now() at time zone 'America/Bogota')::date + 50, 0, 0), 10, 8
from public.membership_plans where name = 'Tiquetera 10 clases';

insert into public.memberships (member_id, plan_id, plan_name, plan_kind, valid_from, valid_until)
select 'a0000000-0000-0000-0000-000000000003', id, name, kind, now() - interval '40 days',
       private.period_end((now() at time zone 'America/Bogota')::date - 10, 0, 0)
from public.membership_plans where name = 'Mensual';
