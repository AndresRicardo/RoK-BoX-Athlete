-- FASE 16 v2: trigger que usa Supabase Vault en vez de app.settings.*
--
-- La 0014 (push_subscriptions.sql) crea send_push_for_notification leyendo
-- de current_setting('app.settings.supabase_url', true) y
-- current_setting('app.settings.supabase_service_role_key', true). Eso
-- funciona en Supabase self-hosted (el rol postgres es superuser y puede
-- hacer ALTER DATABASE SET), pero NO funciona en Supabase Cloud: el rol
-- del Dashboard no es superuser y `app.settings.*` viene NULL.
--
-- Esta migracion reemplaza la funcion para que lea de vault.decrypted_secrets.
-- Vault esta disponible en Supabase Cloud y se puede escribir desde el
-- SQL Editor del Dashboard (vault.create_secret) sin necesidad de CLI.
--
-- Pre-requisito (ejecutar desde el SQL Editor del Dashboard, UNA vez):
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co',
--     'supabase_url',
--     'URL base del proyecto para la Edge Function send-push'
--   );
--   select vault.create_secret(
--     '<service-role-key>',
--     'service_role_key',
--     'Service role key para la Edge Function send-push'
--   );
--
-- Verificacion posterior:
--   select name from vault.secrets
--   where name in ('supabase_url', 'service_role_key');
--   -- Esperado: 2 filas con los nombres (los valores no se muestran).
--
-- Si la funcion no encuentra los secretos en Vault, aborta silenciosamente:
-- el INSERT en notifications sigue funcionando (la campana in-app muestra
-- todo) pero no se dispara el push. Asi no se rompe nada si te olvidaste
-- de crear los secretos.

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault
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
    url := v_url_secret || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key_secret
    ),
    body := v_payload::text
  );

  return NEW;
end;
$$;

-- El trigger notifications_send_push (creado en 0014) sigue igual:
-- la funcion send_push_for_notification queda reemplazada in-place,
-- el trigger sigue disparandola.
