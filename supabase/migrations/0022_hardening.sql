-- 0022_hardening.sql
-- Ajustes de seguridad sobre objetos de 0001–0014 (ya en producción) señalados por el
-- asesor de Supabase. No cambia comportamiento:
-- - Las funciones de trigger no deben poder invocarse por RPC.
-- - Los tableros de líderes son solo para usuarios autenticados.
-- - handle_updated_at con search_path fijo.
-- athlete_directory (security definer) se deja así a propósito: es el directorio público
-- de atletas y solo expone campos no sensibles de profiles.

alter function public.handle_updated_at() set search_path = '';

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.handle_achievement_feed_event()',
    'public.handle_benchmark_feed_event()',
    'public.handle_comment_notification()',
    'public.handle_follow_notification()',
    'public.handle_like_notification()',
    'public.handle_pr_feed_event()',
    'public.handle_skill_feed_event()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

revoke all on function public.get_pr_leaderboard(text, text, text, integer) from anon;
revoke all on function public.get_benchmark_leaderboard(text, text, text, text, text, integer) from anon;
