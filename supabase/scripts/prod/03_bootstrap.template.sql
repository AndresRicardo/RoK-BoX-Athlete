-- 03_bootstrap.template.sql — Primeros socios en producción (D33).
-- En producción nadie es socio todavía: este script crea los socios y sus invitaciones.
-- Cada socio queda con su rol al iniciar sesión con Google en la app (si la cuenta ya existe,
-- se aplica en el siguiente inicio de sesión). Lo demás (planes, catálogo, categorías, coach,
-- mensaje de WhatsApp) se configura desde la app en Gestión → Ajustes.
--
-- NO editar este archivo con datos reales: copiarlo al scratchpad, reemplazar los <<...>> y
-- correr la copia:  supabase db query --linked -f <copia>.sql
-- Los porcentajes deben sumar 100.

begin;

insert into public.partners (name, share_percentage, color_hex) values
  ('<<NOMBRE_SOCIO_1>>', <<PORCENTAJE_1>>, '#FFC815'),
  ('<<NOMBRE_SOCIO_2>>', <<PORCENTAJE_2>>, '#10B981');

insert into public.role_invites (email, roles, partner_id)
select lower(trim(v.email)), array['partner'], p.id
from (values ('<<EMAIL_GOOGLE_SOCIO_1>>', '<<NOMBRE_SOCIO_1>>'),
             ('<<EMAIL_GOOGLE_SOCIO_2>>', '<<NOMBRE_SOCIO_2>>')) as v(email, name)
join public.partners p on p.name = v.name;

-- Si la cuenta ya existe en producción, se aplica de una vez.
select u.email, private.apply_role_invites(u.id, u.email) as roles_aplicados
from auth.users u join public.role_invites i on i.email = lower(u.email);

-- Usuario del bridge: crearlo antes en el dashboard (Authentication → Add user, con email y
-- contraseña; la contraseña va SOLO en bridge/.env del PC del box) y darle el rol aquí.
insert into public.user_roles (user_id, role)
select id, 'bridge' from auth.users where email = '<<EMAIL_USUARIO_BRIDGE>>'
on conflict do nothing;

commit;

-- Resultado (después del commit, porque la CLI muestra solo el último resultado).
select jsonb_build_object(
  'socios', (select jsonb_agg(jsonb_build_object('socio', p.name, 'porcentaje', p.share_percentage,
                                                 'invitacion', i.email, 'aplicada', i.claimed_at is not null))
             from public.partners p left join public.role_invites i on i.partner_id = p.id),
  'cuentas_bridge', (select count(*) from public.user_roles where role = 'bridge')
) as resultado;
