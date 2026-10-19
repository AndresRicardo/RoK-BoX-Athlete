-- FASE 15: añadir feed_events a la publication de Realtime
--
-- Sin este paso, las inserciones/eliminaciones en feed_events no llegan al
-- cliente por WebSocket, y el feed solo se actualiza al recargar o al
-- cambiar de tab. La RLS de feed_events ya está definida en 0009 y se
-- aplica tambien a Realtime, por lo que cada cliente solo recibe las filas
-- de los atletas a los que sigue (mas las suyas propias).
--
-- El alter publication no es idempotente, asi que comprobamos primero si
-- la tabla ya esta en la publication (re-ejecucion segura tras un redeploy).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feed_events'
  ) then
    alter publication supabase_realtime add table public.feed_events;
  end if;
end $$;

-- Verificacion:
--   select schemaname, tablename
--   from pg_publication_tables
--   where pubname = 'supabase_realtime'
--   order by tablename;
-- Debe incluir 'public | feed_events' ademas de 'public | notifications'.
