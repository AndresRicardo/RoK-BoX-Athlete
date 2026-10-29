-- 04_postcheck.sql — Verificación después del paso (SOLO LECTURA).
-- Uso: supabase db query --linked -f supabase/scripts/prod/04_postcheck.sql
-- "filas" debe ser IGUAL a la de 01_precheck.sql (salvo actividad normal durante el paso).
-- Devuelve una sola fila (la CLI muestra solo el último resultado), sin datos personales.

select jsonb_build_object(
  -- 1. Tablas de atletas (comparar con el precheck).
  'filas', jsonb_build_object(
    'auth.users', (select count(*) from auth.users),
    'profiles', (select count(*) from public.profiles),
    'prs', (select count(*) from public.prs),
    'benchmarks', (select count(*) from public.benchmarks),
    'achievements', (select count(*) from public.achievements),
    'unlocked_movements', (select count(*) from public.unlocked_movements),
    'follows', (select count(*) from public.follows),
    'feed_events', (select count(*) from public.feed_events),
    'feed_likes', (select count(*) from public.feed_likes),
    'feed_comments', (select count(*) from public.feed_comments),
    'notifications', (select count(*) from public.notifications)),
  -- 2. Migraciones: deben estar 0001–0028.
  'migraciones', (select jsonb_build_object('total', count(*), 'ultima', max(version))
                  from supabase_migrations.schema_migrations),
  -- 3. Peso (E17): promedio en kilos (típico 55–100) y marca puesta.
  'peso', (select jsonb_build_object('con_peso', count(weight_kg), 'promedio_kg', round(avg(weight_kg), 1))
           from public.profiles),
  'marca_peso', col_description('public.profiles'::regclass,
    (select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'weight_kg')),
  'box_name', (select jsonb_object_agg(b, n) from (
                 select coalesce(box_name, '(vacío)') as b, count(*) as n
                 from public.profiles group by 1) x),
  -- 4. Gestión: arranca vacía (D17, D46) hasta la importación del bridge.
  'gestion', jsonb_build_object(
    'miembros', (select count(*) from public.members),
    'deudas', (select count(*) from public.debts),
    'movimientos', (select count(*) from public.expenses) + (select count(*) from public.incomes),
    'cuadres', (select count(*) from public.settlements),
    'socios', (select count(*) from public.partners),
    'cuentas_socio', (select count(*) from public.user_roles where role = 'partner'),
    'cuentas_bridge', (select count(*) from public.user_roles where role = 'bridge')),
  -- 5. Trabajos programados y push.
  'cron', (select jsonb_agg(jsonb_build_object('job', jobname, 'activo', active) order by jobname) from cron.job),
  'vault_push', (select jsonb_agg(name order by name) from vault.secrets
                 where name in ('push_dispatch_url', 'push_dispatch_secret')),
  'ultimas_llamadas_push', (select jsonb_agg(status_code) from (
                              select status_code from net._http_response order by created desc limit 5) x)
) as postcheck;
