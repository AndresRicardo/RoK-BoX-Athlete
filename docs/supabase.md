# Supabase

Cómo está configurado el backend de RöK BoX Athlete: Auth, base de datos, migraciones, Realtime y operaciones habituales.

## Tabla de contenidos

- [Requisitos](#requisitos)
- [Crear el proyecto](#crear-el-proyecto)
- [Google OAuth](#google-oauth)
- [Variables de entorno del cliente](#variables-de-entorno-del-cliente)
- [Migraciones](#migraciones)
- [Realtime: añadir tablas a `supabase_realtime`](#realtime)
- [Backfills opcionales](#backfills-opcionales)
- [Operaciones habituales](#operaciones-habituales)
- [Troubleshooting](#troubleshooting)

## Requisitos

- Docker (instancia self-hosted) o proyecto en [supabase.com](https://supabase.com).
- Acceso de administrador al SQL Editor.
- Una OAuth app de Google (ver [Google OAuth](#google-oauth)).

## Crear el proyecto

### Self-hosted (recomendado)

Sigue la [documentación oficial de Supabase self-hosted](https://supabase.com/docs/guides/self-hosting). Lo mínimo:

```bash
# Clona el repo oficial de supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edita .env: SITE_URL, API_EXTERNAL_URL, JWT_SECRET, etc.
docker compose up -d
```

Una vez arriba, accede al Studio en `http://<tu-host>:3000`. Crea un usuario admin la primera vez.

### Hosted (supabase.com)

Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard). Anota:
- Project URL → `VITE_SUPABASE_URL`
- anon public key → `VITE_SUPABASE_ANON_KEY`

## Google OAuth

Auth es **solo Google**, no email/password. Esto simplifica la vida: el atleta entra con un click.

### 1. Crear OAuth client en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com/).
2. Crea un proyecto (o usa uno existente).
3. **APIs & Services → OAuth consent screen**:
   - User type: External.
   - Scopes: `openid`, `profile`, `email` (los mínimos para `picture` y `name`).
   - Test users: añade las direcciones de Google que vayas a usar durante el desarrollo.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:5173` (dev)
     - `https://<tu-dominio-de-produccion>` (prod)
   - Authorized redirect URIs:
     - `http://localhost:5173/` (dev)
     - `https://<tu-dominio-de-produccion>/` (prod)
5. Anota **Client ID** y **Client Secret**.

### 2. Configurar en Supabase

**Self-hosted** (`docker/.env`):
```env
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_SECRET=<client-secret>
```

**Hosted**: Authentication → Providers → Google → enable + pegar client id/secret.

### 3. Configurar Site URL y Redirect URLs

Authentication → URL Configuration:

- **Site URL**: tu dominio de prod (ej. `https://app.rokbox.app`).
- **Additional redirect URLs**:
  - `http://localhost:5173`
  - `https://<tu-dominio>`
  - `http://localhost:5173/`

El flujo OAuth redirige a `<site_url>` (o a la redirect URL configurada). Para la PWA en iOS esto es importante: si Site URL no coincide con donde sirves la app, el callback falla.

## Variables de entorno del cliente

Crea `.env` en la raíz del proyecto frontend:

```env
VITE_SUPABASE_URL=https://supabase.tu-dominio.com
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> La **anon key** no es un secreto. Está diseñada para ser pública en el cliente. La seguridad la da RLS en la DB.

> **Nunca** commitear `.env`. Está en `.gitignore`. Ver `.env.example` para referencia.

## Migraciones

12 migraciones SQL en `supabase/migrations/`. Ejecutarlas **en orden** en el SQL Editor del Studio.

| # | Archivo | Qué hace |
|---|---|---|
| 0001 | `0001_profiles.sql` | Tabla `profiles` (1:1 con `auth.users`) + RLS |
| 0002 | `0002_prs.sql` | PRs + RLS |
| 0003 | `0003_benchmarks.sql` | Benchmarks (WODs) + RLS |
| 0004 | `0004_achievements.sql` | Logros + RLS |
| 0005 | `0005_unlocked_movements.sql` | Skills (movimientos desbloqueados) + RLS |
| 0006 | `0006_fix_prs_benchmarks_update_rls.sql` | Añade las policies UPDATE que faltaban |
| 0007 | `0007_display_name_handle.sql` | `display_name` se vuelve @handle único y obligatorio (con backfill de filas existentes) |
| 0008 | `0008_follows.sql` | Tabla `follows`, vista `athlete_directory`, policies *followers read* en las 4 tablas de actividad |
| 0009 | `0009_feed_events.sql` | Tabla `feed_events` + triggers INSERT/DELETE en las 4 tablas |
| 0010 | `0010_feed_engagement.sql` | `feed_likes` y `feed_comments` + RLS |
| 0011 | `0011_profile_avatars.sql` | Columna `avatar_url` en `profiles` + vista actualizada + policy UPDATE defensiva |
| 0012 | `0012_notifications.sql` | Tabla `notifications` + triggers sobre `feed_likes`, `feed_comments`, `follows` |

### Cómo ejecutarlas

**Manual** (lo más simple):

1. Abre Studio → SQL Editor.
2. Abre cada archivo en orden.
3. Pega el contenido y **Run**.
4. Verifica que no haya errores antes de pasar al siguiente.

**CLI** (cuando crezca el proyecto):

```bash
# Instala supabase CLI (https://supabase.com/docs/guides/cli)
supabase login
supabase link --project-ref <ref>
supabase db push   # aplica las migraciones pendientes
```

## Realtime

Para que Supabase Realtime emita eventos de una tabla, esta debe estar en la publication `supabase_realtime`. Por defecto la publication está vacía en proyectos self-hosted nuevos; en hosted viene con todas las tablas añadidas.

```sql
-- Ver qué tablas están en la publication
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;

-- Añadir la tabla de notificaciones (FASE 14)
alter publication supabase_realtime add table public.notifications;

-- Más adelante, cuando se añada realtime al feed (FASE 15):
alter publication supabase_realtime add table public.feed_events;
```

Si la tabla ya estaba añadida, `alter publication ... add table` lanza un error *"relation is already member of publication"* — es inofensivo.

## Backfills opcionales

### Avatares de usuarios que tenían perfil antes de FASE 13

La migración 0011 añade la columna `avatar_url` pero no la rellena para perfiles existentes. `profileStore.syncAvatar` (en `AppRoot.jsx`) lo arregla automáticamente en el próximo login de cada usuario, pero si quieres hacerlo de una vez:

```sql
update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture'
)
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') is not null;
```

## Operaciones habituales

### Inspeccionar la base de datos

```sql
-- Listar tablas
select tablename from pg_tables where schemaname = 'public' order by tablename;

-- Ver policies de una tabla
select polname, polcmd, polqual, polwithcheck
from pg_policy
where polrelid = 'public.profiles'::regclass;

-- Ver triggers
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where not tgisinternal
  and tgrelid::regclass::text like 'public.%'
order by tgrelid::regclass::text, tgname;
```

### Verificar que RLS está activo

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

`rowsecurity = true` es obligatorio en todas las tablas.

### Forzar recarga del schema de PostgREST

Si PostgREST cachea una definición antigua de una vista o tabla (por ejemplo tras un `drop view + create view`), ejecuta:

```sql
notify pgrst, 'reload schema';
```

## Troubleshooting

### "column not found" justo después de cambiar una vista

PostgREST cachea el schema. `notify pgrst, 'reload schema';` o espera unos segundos.

### "permission denied for table ..."

Las policies RLS no conceden acceso. Comprueba que `auth.uid() = user_id` (o el predicado que corresponda). Para `notifications`, solo el `recipient_id` puede SELECT.

### Triggers no se ejecutan

```sql
-- Ver que existen
select tgname, tgrelid::regclass, tgenabled
from pg_trigger where not tgisinternal and tgname like '%feed%';
```

`tgenabled` debe ser `O` (origen) o `A` (always). Si es `D` (disabled), reactiva con:

```sql
alter table public.prs enable always trigger prs_feed_event;
```

### "Failed to run sql query: 42P16: cannot change name of view column"

`CREATE OR REPLACE VIEW` no permite insertar columnas en medio de una vista existente. Solución: `DROP VIEW IF EXISTS` + `CREATE VIEW` (re-aplicar también el `GRANT`).

### Realtime no llega al cliente

1. ¿La tabla está en `supabase_realtime`? (ver arriba)
2. ¿La policy de SELECT permite al usuario leer esa fila? (RLS se aplica también a Realtime)
3. Mira la consola del navegador en busca de errores de WebSocket.

### OAuth redirect mismatch

El Site URL en Supabase y la redirect URI en Google Cloud Console deben coincidir **exactamente** (incluyendo el `/` final). Si no, Google muestra `redirect_uri_mismatch`.
