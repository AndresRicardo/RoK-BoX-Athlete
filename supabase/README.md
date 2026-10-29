# Supabase — RöK BoX

| Ruta | Contenido |
|---|---|
| `migrations/0001`–`0014` | Esquema de atletas, **ya aplicado en producción**. No se edita. |
| `migrations/0015`–`0026` | Gestión: roles, socios, miembros, membresías, bridge, deudas, finanzas, auditoría, notificaciones, realtime, endurecimiento, envío push, recordatorios de deuda por WhatsApp, cuadre manual y cuenta de cada socio. |
| `functions/send-push` | Edge Function que envía los avisos como Web Push (F5). |
| `scripts/configure-push.mjs` | Configura el secreto entre la base y `send-push` (Vault + secreto de la función). |
| `scripts/prod/` | Paso a producción: prechequeo, correcciones de datos (E17/E18), alta de socios y poschequeo. Se usan según [`docs/RUNBOOK_PRODUCCION.md`](../docs/RUNBOOK_PRODUCCION.md). |
| `seed.sql` | Datos de prueba **solo para DEV** (usuarios `*.dev@rokbox.co`, planes, catálogo, categorías y miembros `ZZTEST`). |
| `tests/management_test.sql` | Tests de RLS, RPC, cuadre, bridge, invitaciones y trabajos programados. Corren en una transacción que se revierte al final. |
| `types/database.types.ts` | Tipos generados (referencia). |

El contrato de datos está en [`docs/RPC_CONTRACT.md`](../docs/RPC_CONTRACT.md).

## Comandos (CLI vinculada a DEV)

```bash
supabase db reset --linked                                  # DEV desde cero: migraciones + seed (borra todo)
node supabase/scripts/configure-push.mjs                    # tras un reset: vuelve a conectar la base con send-push
supabase db query --linked -f supabase/tests/management_test.sql   # tests (resumen en la última fila)
supabase gen types typescript --linked > supabase/types/database.types.ts
supabase db advisors --linked --type security
```

## Notificaciones push

`public.notifications` es la cola: al insertar un aviso, la base llama por `pg_net` a `send-push`, que lo envía a los teléfonos suscritos (`push_subscriptions`). Un cron cada minuto reintenta lo pendiente. Sin configuración, la base no llama a nada.

Configuración de un proyecto (DEV ya la tiene):

```bash
# 1. Claves VAPID (una vez por proyecto; la pública también va en VITE_VAPID_PUBLIC_KEY).
#    Se pueden reutilizar las de DEV. Nunca en git.
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
# 2. Función (sin verificación de JWT: se autentica con el secreto compartido)
supabase functions deploy send-push --no-verify-jwt --use-api
# 3. Secreto compartido en Vault y en la función (no se imprime). Repetir tras cada db reset.
node supabase/scripts/configure-push.mjs
```

Para revisar las llamadas: `select status_code, content from net._http_response order by created desc limit 5;`

## Usuarios de DEV

| Usuario | Rol |
|---|---|
| `socio2.dev@rokbox.co` | Socio ("Socio Dos", 50 %) |
| `coach.dev@rokbox.co` | Coach |
| `atleta.dev@rokbox.co` | Atleta, vinculado a "ZZTEST Atleta Dev" |
| `atleta2.dev@rokbox.co` | Atleta sin vincular |
| `bridge.dev@rokbox.co` | Bridge |
| `ricaldo2431@gmail.com` (Google) | Socio "Ricardo" (50 %), por invitación al iniciar sesión |

- Las contraseñas de los usuarios de prueba son **aleatorias** y no se guardan.
- Para iniciar sesión con uno, asígnale una contraseña desde el dashboard de Supabase (Authentication → Users) o con SQL. **Nunca** la guardes en git.
- Los tests no necesitan contraseñas: simulan la sesión con `request.jwt.claims`.

## Producción
- Solo con orden explícita y un backup del día (ver [`AGENTS.md`](../AGENTS.md)).
- Las migraciones `0015`+ se aplican con `supabase db push` contra el proyecto de producción. **Nunca** `db reset`.
- El seed **no** se aplica en producción. Los socios, planes, catálogo y categorías reales se cargan según [`docs/RUNBOOK_PRODUCCION.md`](../docs/RUNBOOK_PRODUCCION.md).
