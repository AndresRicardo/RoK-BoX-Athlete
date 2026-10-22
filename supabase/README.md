# Supabase — RöK BoX

| Ruta | Contenido |
|---|---|
| `migrations/0001`–`0014` | Esquema de atletas, **ya aplicado en producción**. No se edita. |
| `migrations/0015`–`0022` | Gestión: roles, socios, miembros, membresías, bridge, deudas, finanzas, auditoría, notificaciones, realtime y endurecimiento. |
| `seed.sql` | Datos de prueba **solo para DEV** (usuarios `*.dev@rokbox.co`, planes, catálogo, categorías y miembros `ZZTEST`). |
| `tests/management_test.sql` | Tests de RLS, RPC, cuadre, bridge, invitaciones y trabajos programados. Corren en una transacción que se revierte al final. |
| `types/database.types.ts` | Tipos generados (referencia). |

El contrato de datos está en [`docs/RPC_CONTRACT.md`](../docs/RPC_CONTRACT.md).

## Comandos (CLI vinculada a DEV)

```bash
supabase db reset --linked                                  # DEV desde cero: migraciones + seed (borra todo)
supabase db query --linked -f supabase/tests/management_test.sql   # tests (resumen en la última fila)
supabase gen types typescript --linked > supabase/types/database.types.ts
supabase db advisors --linked --type security
```

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
- El seed **no** se aplica en producción. Los socios, planes, catálogo y categorías reales se cargan según el runbook de F7.
