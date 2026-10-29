-- 01_precheck.sql — Foto de producción antes del paso (SOLO LECTURA).
-- Uso: supabase db query --linked -f supabase/scripts/prod/01_precheck.sql
-- Guardar el resultado: se compara con 04_postcheck.sql para confirmar que no se perdió nada.
-- Devuelve una sola fila (la CLI muestra solo el último resultado), sin datos personales.

select jsonb_build_object(
  -- 1. Tablas de atletas (0001–0014).
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
  -- 2. Historial de migraciones: deben estar 0001–0014 y nada más.
  'migraciones', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  -- 3. Peso (E17): en producción se guarda en libras (valores típicos 100–300).
  'peso', (select jsonb_build_object(
             'con_peso', count(weight_kg), 'min', min(weight_kg), 'max', max(weight_kg),
             'promedio', round(avg(weight_kg), 1),
             'menores_de_90', count(*) filter (where weight_kg < 90))
           from public.profiles),
  'marca_peso', col_description('public.profiles'::regclass,
    (select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'weight_kg')),
  -- 4. Nombre del box (E18): variantes y cuántos perfiles tiene cada una.
  'box_name', (select jsonb_object_agg(b, n) from (
                 select coalesce(box_name, '(vacío)') as b, count(*) as n
                 from public.profiles group by 1) x),
  -- 5. Extensiones (0020 instala pg_cron y 0023 pg_net).
  'extensiones', (select jsonb_agg(extname order by extname) from pg_extension)
) as precheck;
