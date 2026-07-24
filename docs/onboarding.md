# Onboarding

Guía completa para poner RöK BoX Athlete en marcha desde cero: setup local, deploy a producción y troubleshooting.

## Tabla de contenidos

1. [Requisitos previos](#1-requisitos-previos)
2. [Clonar e instalar](#2-clonar-e-instalar)
3. [Levantar el backend (Supabase)](#3-levantar-el-backend-supabase)
4. [Configurar Google OAuth](#4-configurar-google-oauth)
5. [Ejecutar las migraciones](#5-ejecutar-las-migraciones)
6. [Habilitar Realtime](#6-habilitar-realtime)
7. [Configurar variables de entorno del frontend](#7-configurar-variables-de-entorno-del-frontend)
8. [Arrancar la app en local](#8-arrancar-la-app-en-local)
9. [Build de producción y deploy](#9-build-de-producción-y-deploy)
10. [Dominios custom](#10-dominios-custom)
11. [Estructura de branches y contribución](#11-estructura-de-branches-y-contribución)
12. [Comandos útiles](#12-comandos-útiles)
13. [Troubleshooting](#13-troubleshooting)
14. [Cómo añadir una nueva migración](#14-cómo-añadir-una-nueva-migración)
15. [Próximos pasos](#15-próximos-pasos)

---

## 1. Requisitos previos

- **Node.js 20+** y **npm** (o pnpm/yarn). Verifica con `node -v`.
- **Git**.
- Una **instancia de Supabase**: self-hosted con Docker, o cuenta en [supabase.com](https://supabase.com). Ver `docs/supabase.md` para detalle.
- Una **cuenta de Google Cloud** con un proyecto para crear OAuth credentials.
- (Opcional) Una **cuenta en Vercel** para deploy.
- (Opcional) Un **dominio propio** si no quieres usar los subdominios gratuitos de Vercel/Supabase.

## 2. Clonar e instalar

```bash
git clone https://github.com/AndresRicardo/RoK-BoX-Athlete.git
cd RoK-BoX-Athlete
npm install
```

Si solo vas a contribuir a `develop`:

```bash
git clone https://github.com/AndresRicardo/RoK-BoX-Athlete.git
cd RoK-BoX-Athlete
git switch develop
npm install
```

## 3. Levantar el backend (Supabase)

### Opción A — Self-hosted (recomendado para RöK BoX)

```bash
# En una máquina con Docker
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env

# Edita .env (ver docs/supabase.md para detalle):
#   SITE_URL=http://localhost:3000
#   API_EXTERNAL_URL=http://localhost:8000
#   POSTGRES_PASSWORD=<una-password-segura>
#   JWT_SECRET=<openssl rand -base64 32>
#   ANON_KEY=<se-genera-con-el-helper>
#   SERVICE_ROLE_KEY=<se-genera-con-el-helper>

docker compose up -d
```

Una vez arriba:
- **Studio (panel admin)**: `http://localhost:3000` — crea tu usuario admin.
- **API REST**: `http://localhost:8000`
- **Realtime WebSocket**: `ws://localhost:4000`

> Para producción, monta esto en un servidor accesible públicamente con HTTPS. Ver `docs/dominios.md`.

### Opción B — Supabase hosted

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Anota:
   - **Project URL** → será tu `VITE_SUPABASE_URL`.
   - **anon public key** (Project Settings → API) → será tu `VITE_SUPABASE_ANON_KEY`.

## 4. Configurar Google OAuth

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/).
2. Crea un proyecto nuevo o usa uno existente.
3. **APIs & Services → OAuth consent screen**:
   - User type: External.
   - Scopes: `openid`, `profile`, `email`.
   - Test users: añade tu correo de prueba.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:5173`
     - `https://<tu-dominio-de-produccion>`
   - Authorized redirect URIs:
     - `http://localhost:5173/`
     - `https://<tu-dominio-de-produccion>/`
5. Copia **Client ID** y **Client Secret**.

Pégalos en Supabase:

- **Self-hosted**: `docker/.env` → `GOOGLE_CLIENT_ID` y `GOOGLE_SECRET`. Reinicia con `docker compose restart auth`.
- **Hosted**: Authentication → Providers → Google → enable + pegar.

Authentication → URL Configuration:
- **Site URL**: `http://localhost:5173` (luego cámbialo al dominio de prod).
- **Additional redirect URLs**: `http://localhost:5173/`, `http://localhost:5173`.

## 5. Ejecutar las migraciones

Abre **Supabase Studio → SQL Editor** y ejecuta cada archivo de `supabase/migrations/` **en orden**:

```
0001_profiles.sql
0002_prs.sql
0003_benchmarks.sql
0004_achievements.sql
0005_unlocked_movements.sql
0006_fix_prs_benchmarks_update_rls.sql
0007_display_name_handle.sql
0008_follows.sql
0009_feed_events.sql
0010_feed_engagement.sql
0011_profile_avatars.sql
0012_notifications.sql
```

Abre cada uno, pega el contenido, **Run**, y verifica que no haya errores antes del siguiente.

> Las migraciones son idempotentes (usan `if not exists`, `drop if exists`, etc.), así que es seguro re-ejecutarlas si algo falló a mitad de camino.

## 6. Habilitar Realtime

```sql
-- En SQL Editor
alter publication supabase_realtime add table public.notifications;
```

Verifica con:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

Debe aparecer `public | notifications`.

## 7. Configurar variables de entorno del frontend

En la raíz del proyecto, crea `.env`:

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Para `VITE_SUPABASE_ANON_KEY`:
- **Self-hosted**: el valor `ANON_KEY` que generaste en `docker/.env`.
- **Hosted**: Project Settings → API → `anon` `public`.

> `.env` está en `.gitignore`, no se commitea nunca.

## 8. Arrancar la app en local

```bash
npm run dev
```

Abre `http://localhost:5173`. Deberías ver la landing en `/community` (si ya sigues atletas) o el empty state de feed.

### Probar el flujo completo

1. Click en **"Iniciar sesión con Google"** (en el sidebar, esquina superior).
2. Elige tu cuenta de Google de prueba.
3. Autoriza los scopes `openid`, `profile`, `email`.
4. Vuelves a la app, ya logueado.
5. Ve a **Perfil → Editar perfil**. Crea tu @handle (único, 3-20 chars, minúsculas, números, `.` o `_`).
6. Crea un PR de prueba en la sección **PRs**.
7. Crea un benchmark de prueba en **WODs**.
8. Crea una skill en **Skills**.
9. Ve a **Comunidad → Buscar** y busca atletas de prueba con los que probar (necesitas otra cuenta).
10. En `/athletes/<id>` prueba seguir a alguien.
11. El feed debería empezar a llenarse.

## 9. Build de producción y deploy

### Build local (para verificar antes de subir)

```bash
npm run build
npm run preview   # http://localhost:4173
```

### Deploy a Vercel

Ver `docs/vercel.md` en detalle. Resumen:

1. Vercel → New Project → importa el repo.
2. Framework: Vite (autodetectado).
3. Variables de entorno en Project Settings:
   - `VITE_SUPABASE_URL=https://supabase.tu-dominio.com` (o el subdominio que uses)
   - `VITE_SUPABASE_ANON_KEY=...`
4. Deploy.
5. (Opcional) Configura dominio custom (ver `docs/dominios.md`).

> El `vercel.json` en la raíz configura el SPA rewrite. No lo borres, o las rutas como `/community` o `/athletes/<id>` devolverán 404 al recargar.

## 10. Dominios custom

Ver `docs/dominios.md` para el detalle completo de configuración de DNS, HTTPS y el checklist al cambiar de dominio.

## 11. Estructura de branches y contribución

```
main       → producción
develop    → integración (aquí se mergean las features)
feat/*     → features nuevas
fix/*      → bugfixes
```

Flujo:

1. Crea una rama desde `develop`: `git switch -c feat/mi-cosa develop`.
2. Trabaja, commitea con conventional commits: `feat(scope): descripción`, `fix(scope): descripción`.
3. Push y abre PR a `develop`.
4. Vercel crea un preview deploy automático. Verifica que funciona.
5. Squash merge o merge commit. Borrar la rama.
6. Cuando `develop` esté listo para release, merge a `main` (ver `docs/despliegue.md`).

## 12. Comandos útiles

```bash
npm run dev         # Dev server (http://localhost:5173)
npm run build       # Build de producción a dist/
npm run preview     # Sirve el build (http://localhost:4173)
npm run lint        # ESLint
npm run icons       # Regenera los iconos PWA (si cambias el isotipo)
```

## 13. Troubleshooting

### Error: "Missing Supabase environment variables"

Falta `.env` o las variables están vacías. Verifica `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

### Error: "Failed to run sql query: 42P16: cannot change name of view column"

`CREATE OR REPLACE VIEW` no permite insertar columnas en medio. Solución: `DROP VIEW IF EXISTS` + `CREATE VIEW` + `GRANT` (ver la nota en `docs/supabase.md`).

### "redirect_uri_mismatch" en Google

La URL de redirección de OAuth no coincide exactamente. Revisa:
- Authorized redirect URIs en Google Cloud Console.
- Site URL y Additional redirect URLs en Supabase.
- Que la URL de tu app (sin trailing slash) coincida con las de Google.

### Avatares no aparecen

1. ¿Está `public.notifications` (o la tabla de feed) en la publication `supabase_realtime`?
2. ¿La vista `athlete_directory` tiene la columna `avatar_url`? (debería, tras 0011)
3. ¿Tienes una fila en `profiles`? (usuarios sin perfil creado no aparecen en el directorio)
4. ¿El navegador bloquea imágenes de `lh3.googleusercontent.com`?

Ver `docs/supabase.md` para el backfill opcional de avatares.

### Realtime no se actualiza en vivo

1. La tabla está en `supabase_realtime`? Ver `docs/supabase.md`.
2. RLS permite al usuario leer esa fila? Las policies aplican también a Realtime.
3. Mira la consola del navegador en busca de errores de WebSocket.

### "Cannot coerce the result to a single JSON object" al guardar

La query de UPDATE devuelve 0 filas. Casi siempre: falta policy UPDATE en RLS. Verifica con:

```sql
select polname, polcmd from pg_policy where polrelid = 'public.prs'::regclass;
```

Debe haber policy para `INSERT`, `SELECT`, `UPDATE` y `DELETE`.

### "401 Unauthorized" en llamadas a la API

El `anon` key es incorrecto, o la sesión JWT expiró. Logout + login.

### Build de Vercel falla con "Cannot find module"

`npm install` no se ejecutó o `package-lock.json` está desincronizado. Borra `node_modules` y `package-lock.json` y vuelve a `npm install`. Asegúrate de que `package-lock.json` está commiteado.

## 14. Cómo añadir una nueva migración

1. Crea `supabase/migrations/00XX_descripcion.sql` con el siguiente número correlativo. Usa snake_case en el nombre, en minúsculas.
2. Estructura del archivo:

   ```sql
   -- FASE XX: descripción corta
   -- Ejecutar en Supabase Studio SQL Editor
   --
   --   1) Lo que hace paso 1
   --   2) Lo que hace paso 2

   -- Comentarios SQL inline
   alter table ... ;
   ```

3. Usa `create ... if not exists`, `drop policy if exists`, etc. para idempotencia.
4. Para vistas, **no uses `CREATE OR REPLACE VIEW`** si modificas columnas. Usa `DROP VIEW IF EXISTS` + `CREATE VIEW` + `GRANT`.
5. Si la migración añade una tabla que necesita Realtime, **documéntalo** en un comentario al final:

   ```sql
   -- RECORDATORIO: tras ejecutar, añadir a la publication:
   -- alter publication supabase_realtime add table public.nueva_tabla;
   ```

6. Actualiza `AGENTS.md` (sección "Database") con el nuevo archivo.

## 15. Próximos pasos

- **Lee la arquitectura** en `docs/arquitectura.md` para entender cómo encajan las piezas.
- **Configura tu dominio** en `docs/dominios.md` si no vas a usar los subdominios gratuitos.
- **Configura monitoring** (Vercel Analytics + Sentry opcional).
- **Crea el changelog** (`CHANGELOG.md`).
- **Lee el plan de fases** en `AGENTS.md` para saber qué viene después.
