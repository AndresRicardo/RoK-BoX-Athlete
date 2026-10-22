-- 0021_realtime.sql
-- Tablas que la app escucha en tiempo real. Realtime respeta RLS.

do $$
declare
  t text;
begin
  foreach t in array array[
    'members', 'memberships', 'membership_renewals', 'class_usages', 'member_link_requests',
    'debts', 'debt_items', 'debt_payments',
    'expenses', 'incomes', 'partner_transfers', 'settlements',
    'access_commands', 'bridge_status'
  ] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
