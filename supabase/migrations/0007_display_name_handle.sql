-- FASE 11.0: display_name como @handle unico y obligatorio (estilo Instagram)
-- Ejecutar en Supabase Studio SQL Editor
--
-- Formato del handle: 3-20 caracteres, minusculas, numeros, punto y guion bajo.
-- Este script:
--   1) Normaliza los display_name existentes (lowercase + charset valido)
--   2) Rellena los NULL/vacios con un handle generado desde first_name
--   3) Resuelve duplicados con sufijo numerico (ana, ana2, ana3...)
--   4) Aniade CHECK de formato, indice UNIQUE y NOT NULL

do $$
declare
  r record;
  base text;
  candidate text;
  suffix int;
begin
  for r in select id, first_name, display_name from public.profiles loop
    -- normalizar lo que ya existe (lowercase primero, luego filtrar charset)
    base := regexp_replace(
      lower(coalesce(r.display_name, '')),
      '[^a-z0-9._]', '', 'g'
    );

    -- si no sirve, generar desde first_name (transliterando acentos)
    if base is null or length(base) < 3 then
      base := regexp_replace(
        lower(translate(
          coalesce(nullif(r.first_name, ''), 'atleta'),
          'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU'
        )),
        '[^a-z0-9]', '', 'g'
      );
      if length(base) < 3 then
        base := rpad(base, 3, 'x');
      end if;
    end if;

    base := left(base, 20);

    -- resolver duplicados con sufijo numerico
    candidate := base;
    suffix := 2;
    while exists (
      select 1 from public.profiles p
      where p.display_name = candidate and p.id <> r.id
    ) loop
      candidate := left(base, 20 - length(suffix::text)) || suffix::text;
      suffix := suffix + 1;
    end loop;

    if candidate is distinct from r.display_name then
      update public.profiles set display_name = candidate where id = r.id;
    end if;
  end loop;
end $$;

-- Formato obligatorio
alter table public.profiles
  drop constraint if exists profiles_display_name_format;
alter table public.profiles
  add constraint profiles_display_name_format
  check (display_name ~ '^[a-z0-9._]{3,20}$');

-- Unicidad (el CHECK ya garantiza lowercase)
create unique index if not exists profiles_display_name_unique
  on public.profiles (display_name);

-- Obligatorio
alter table public.profiles
  alter column display_name set not null;
