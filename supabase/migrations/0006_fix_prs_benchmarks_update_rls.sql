-- FASE 9.1: Fix RLS policies para UPDATE en prs y benchmarks
-- Bug: las policies 0002/0003 no incluyan UPDATE, asi que RLS rechazaba
-- silenciosamente cualquier update -> 0 filas -> .single() fallaba con
-- "Cannot coerce the result to a single JSON object".
-- Aniadimos policy FOR UPDATE con USING + WITH CHECK para que el user
-- solo pueda actualizar filas propias y solo pueda asignar el user_id
-- a su propio uid en el row resultante.

alter table public.prs enable row level security;

drop policy if exists "Users update own prs" on public.prs;
create policy "Users update own prs"
  on public.prs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.benchmarks enable row level security;

drop policy if exists "Users update own benchmarks" on public.benchmarks;
create policy "Users update own benchmarks"
  on public.benchmarks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
