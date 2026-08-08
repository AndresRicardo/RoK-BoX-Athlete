-- FASE 16 v3: habilitar la extension pg_net en Supabase Cloud.
--
-- La funcion send_push_for_notification (migraciones 0014 + 0015) llama a
-- net.http_post(...) para dispararle un POST a la Edge Function send-push
-- cuando se inserta una fila en public.notifications.
--
-- En Supabase Cloud, pg_net viene DESHABILITADA por defecto (a diferencia
-- de self-hosted donde suele estar activa). Hay que habilitarla una vez.
-- La extension la mantiene Supabase Cloud, por lo que no requiere setup
-- adicional ni trabajo en deploys futuros.
--
-- Si en algun momento se reaplica la migracion, el "if not exists" la hace
-- idempotente y no rompe nada.

create extension if not exists pg_net with schema extensions;
