-- FASE 16 v6: policy de UPDATE en push_subscriptions para que el upsert
-- del cliente funcione cuando la fila ya existe.
--
-- La 0014 creaba policies de SELECT, INSERT y DELETE, pero ninguna de
-- UPDATE. Cuando el cliente hace upsert y la fila ya existe, Supabase
-- intenta UPDATE, RLS lo evalua y como no hay policy que lo permita,
-- rechaza con "new row violates row-level security policy (USING
-- expression) for table push_subscriptions".
--
-- Esta migracion agrega una policy de UPDATE restringida a filas propias.
-- El cliente ya no envia user_id en el payload (lo rellena el trigger
-- 0018 en INSERT, y en UPDATE no lo manda), asi que user_id no cambia.

drop policy if exists "Users update own push subscriptions" on public.push_subscriptions;
create policy "Users update own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
