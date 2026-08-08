-- FASE 16 v4: corregir la firma de net.http_post en send_push_for_notification.
--
-- La funcion (creada en 0014, ajustada en 0015) llama a net.http_post con
-- argumentos con nombre (url :=, headers :=, body :=) y con body como text.
-- En pg_net 0.20.3 (la version que viene con Supabase Cloud al momento de
-- aplicar 0016_enable_pg_net.sql), la firma es:
--
--   net.http_post(
--     url text,
--     body jsonb DEFAULT '{}'::jsonb,
--     params jsonb DEFAULT '{}'::jsonb,
--     headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
--     timeout_milliseconds integer DEFAULT 5000
--   )
--
-- Por eso el INSERT de un PR/benchmark/etc fallaba con
-- "function net.http_post(url => text, headers => jsonb, body => text) does not exist".
--
-- Esta migracion reemplaza la funcion para usar la firma correcta: argumentos
-- posicionales y body en jsonb (no text).

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_url_secret text;
  v_key_secret text;
  v_payload jsonb;
begin
  select decrypted_secret into v_url_secret
    from vault.decrypted_secrets
    where name = 'supabase_url'
    limit 1;

  select decrypted_secret into v_key_secret
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if v_url_secret is null or v_key_secret is null then
    return NEW;
  end if;

  v_payload := jsonb_build_object('notification_id', NEW.id);

  perform net.http_post(
    v_url_secret || '/functions/v1/send-push',
    v_payload,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key_secret
    )
  );

  return NEW;
end;
$$;

-- El trigger notifications_send_push (creado en 0014) sigue igual:
-- la funcion send_push_for_notification queda reemplazada in-place.
