-- FASE 16 v5: trigger que setea user_id desde auth.uid() en push_subscriptions.
--
-- La RLS de la tabla 0014 exige auth.uid() = user_id. Si el cliente
-- enviaba el user_id en el payload y por algun motivo no coincidia
-- exactamente con el del JWT (timing entre login y store, formato,
-- cache, etc.), el INSERT fallaba con
-- "new row violates row-level security policy (USING expression)".
--
-- Este trigger before-insert garantiza que user_id SIEMPRE se rellena
-- con auth.uid() del JWT, asi coincida por construccion con la RLS.
-- El cliente deja de mandar user_id en el payload.

create or replace function public.push_subscriptions_set_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.user_id is null then
    raise exception 'No authenticated user (auth.uid() is null)';
  end if;
  return new;
end;
$$;

drop trigger if exists push_subscriptions_set_user_trigger on public.push_subscriptions;
create trigger push_subscriptions_set_user_trigger
  before insert on public.push_subscriptions
  for each row execute function public.push_subscriptions_set_user();
