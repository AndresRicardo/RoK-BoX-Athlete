-- 02_data_fixes.sql — Correcciones de datos de atletas al pasar a producción (E17 y E18).
-- Uso: supabase db query --linked -f supabase/scripts/prod/02_data_fixes.sql
-- Correrlo JUSTO ANTES de publicar la app nueva: la app vieja (main) guarda el peso en libras.
-- Es seguro correrlo dos veces: la conversión de peso deja una marca en la columna y no se repite.

begin;

-- E17: profiles.weight_kg pasa de libras a kilos (la app nueva lo trata como kilos).
do $$
declare
  v_mark text := col_description('public.profiles'::regclass,
    (select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'weight_kg'));
  v_n int;
begin
  if v_mark like 'kg (E17%' then
    raise notice 'E17 ya aplicado (%), no se convierte de nuevo', v_mark;
    return;
  end if;
  -- Protección: un promedio menor a 90 parece estar ya en kilos (revisar el precheck).
  if (select avg(weight_kg) from public.profiles) < 90 then
    raise exception 'E17: el peso promedio es menor a 90; parece que ya está en kilos. No se convierte.';
  end if;
  update public.profiles set weight_kg = round(weight_kg / 2.20462, 2) where weight_kg is not null;
  get diagnostics v_n = row_count;
  execute format('comment on column public.profiles.weight_kg is %L',
                 'kg (E17: convertido desde libras el ' || to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD') || ')');
  raise notice 'E17: % pesos convertidos a kilos', v_n;
end $$;

-- E18: todas las variantes del nombre del box (y los vacíos) quedan como "RöK BoX".
update public.profiles set box_name = 'RöK BoX'
where box_name is distinct from 'RöK BoX'
  and (box_name is null or trim(box_name) = ''
       or regexp_replace(lower(translate(box_name, 'öÖóÓòÒôÔ', 'oooooooo')), '[^a-z0-9]', '', 'g')
          ~ 'ro(k|c|ck|l)box');

commit;

-- Resultado (después del commit, porque la CLI muestra solo el último resultado).
select jsonb_build_object(
  'peso', (select jsonb_build_object('con_peso', count(weight_kg), 'min', min(weight_kg),
                                     'max', max(weight_kg), 'promedio_kg', round(avg(weight_kg), 1))
           from public.profiles),
  'box_name', (select jsonb_object_agg(b, n) from (
                 select coalesce(box_name, '(vacío)') as b, count(*) as n
                 from public.profiles group by 1) x)
) as resultado;
