# Arquitectura

Visión técnica de RöK BoX Athlete: cómo están conectados los componentes, qué datos fluyen entre ellos y por qué está diseñado así.

## Diagrama de capas

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador del atleta                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PWA (Vite + React 19 + vite-plugin-pwa)            │  │
│  │  • Service Worker + manifest → instalable            │  │
│  │  • Offline shell (UI navegable sin red)              │  │
│  │  • React Router 7 (rutas protegidas/públicas)        │  │
│  │  • Zustand 5 (estado global, 9 stores)              │  │
│  │  • Recharts (gráficas de evolución)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTPS                        │ WebSocket
               │ (REST/PostgREST)             │ (Realtime)
               ▼                              ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│  Vercel (CDN global)     │    │  Supabase (self-hosted)      │
│  • Sirve dist/ estático  │    │  • PostgREST (API REST)      │
│  • SPA rewrite (vercel.  │    │  • Auth (Google OAuth)       │
│    json)                 │    │  • Postgres 15               │
│  • Dominio custom        │    │  • Realtime (WebSocket)      │
└──────────────────────────┘    │  • RLS en todas las tablas   │
                               │  • Triggers security definer │
                               │    (fan-out para feed + notif)│
                               └─────────────────────────────┘
```

## Stack

| Capa | Tecnología | Versión | Por qué |
|---|---|---|---|
| UI | React | 19 | Última estable, Server Components no necesarios (SPA) |
| Build | Vite | 8 | HMR instantáneo, build rápido |
| Routing | React Router | 7 | Lazy loading + Suspense por ruta |
| Estado | Zustand | 5 | Sin boilerplate, sin Context, fácil de testear |
| Charts | Recharts | 3 | Declarativo, sin canvas manual |
| Backend | Supabase | self-hosted | Auth + DB + Realtime en un solo lugar |
| Auth | Google OAuth | — | Único método, sin email/password |
| DB | Postgres | 15 | RLS maduro, triggers robustos |
| PWA | vite-plugin-pwa | 1.3 | SW + manifest generado desde el build |
| Iconos | sharp | 0.35 | Genera los PNGs del manifest a partir de SVG |

## Estructura de `src/`

```
src/
├── components/     Componentes reutilizables (AthleteRow, FeedEventCard,
│                   NotificationsBell, Navigation, etc.)
├── layouts/        MainLayout (header + nav + footer + campana)
├── pages/          Una página por ruta (Dashboard, Profile, Community,
│                   AthleteProfile, Benchmarks, …)
├── routes/         Config del router con lazy loading
├── stores/         10 stores Zustand, uno por dominio
├── data/           Catálogos estáticos: movements, wods, achievements, labels
├── supabase/       Cliente Supabase único
├── utils/          Helpers puros (units, handle, format, time)
├── AppRoot.jsx     Auth init + reset de stores + RouterProvider
└── main.jsx        Entry point
```

**Patrón de stores**: cada store expone `fetch*`, mutaciones, y `reset()`. `AppRoot` resetea todos los stores cuando `userId` se vuelve null (logout). Los stores se importan entre sí directamente (p. ej. `feedStore` lee `followStore`), sin Context.

## Flujo típico de una acción

Ejemplo: el atleta crea un nuevo PR de Back Squat.

```
1. PRNew.jsx
   └─ usePRStore.createPR(userId, prData)
        └─ supabase.from('prs').insert(...).select().single()
2. RLS valida: auth.uid() = user_id ✓
3. Trigger prs_feed_event (security definer)
   └─ INSERT en feed_events con snapshot del payload
4. (Si el atleta tenía `checkAndUnlock` configurado)
   Trigger del lado cliente: achievementStore.checkAndUnlock(...)
5. Realtime emite INSERT sobre feed_events → si alguien tiene la app
   abierta y sigue al atleta, su feedStore.prependFromRealtime() lo añade
6. Return: fila nueva en prs + posiblemente logro desbloqueado (modal)
```

**Por qué `triggers security definer` en lugar de hacerlo desde el cliente**: garantiza que NINGÚN cliente (incluyendo uno comprometido) puede saltarse el fan-out. Anti-falsificación por diseño.

## Modelo social y permisos

| Acción | Quién puede | Quién ve el resultado |
|---|---|---|
| Crear PR / benchmark / logro / skill | Solo el dueño | El dueño siempre. Seguidores: en feed (FASE 12). |
| Leer perfil de otro atleta | Todos los autenticados (vía `athlete_directory`) | Columnas públicas: handle, nombre, box, disciplina, avatar |
| Leer PRs/benchmarks/logros/skills de otro | El dueño o sus seguidores | Seguidores: sí. No-seguidores: nada. |
| Leer grafo de follows | Todos los autenticados | Counts + listas en `/athletes/:id` |
| Crear follow | Cualquier autenticado (directo, sin aprobación) | — |
| Dar like | Sobre eventos que el usuario puede ver (propios o de seguidos) | Notificación al dueño del evento (FASE 14) |
| Comentar | Igual que like | Notificación + persiste en el feed |
| Crear notificación | Nadie (solo triggers) | El destinatario |

**Razón del modelo "followers-only activity"**: le da valor tangible al follow. Si la actividad de todos fuera pública para todos, no habría incentivo social. Coherente con el modelo de comunidades cerradas tipo Strava.

## Realtime

Supabase Realtime envía eventos de Postgres por WebSocket. En este proyecto lo usamos en:

| Tabla | Suscrito por | Eventos | Filtro | Para qué |
|---|---|---|---|---|
| `feed_events` | feedStore (FASE 15, plan futuro) | INSERT | (futuro) user_id en seguidos | Feed en vivo |
| `notifications` | notificationStore (FASE 14) | INSERT, UPDATE | `recipient_id=eq.${userId}` | Campana 🔔 |

**Pre-requisito DB** (revisar en `docs/supabase.md`): la tabla tiene que estar en la publication `supabase_realtime`:

```sql
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.feed_events;  -- cuando se añada
```

## PWA

- `vite-plugin-pwa` con `registerType: 'autoUpdate'` → el SW se actualiza sin intervención del usuario.
- Manifest en `vite.config.js` con iconos 192x192, 512x512 y maskable.
- Offline shell: la app carga la UI incluso sin red (las llamadas a Supabase fallarán, pero la navegación interna funciona).
- Instalable en Android e iOS (con "Añadir a pantalla de inicio").

## Decisiones de diseño notables

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| `@handle` único y obligatorio (FASE A) | Identidad tipo Instagram; búsqueda estable | Nombre + apellidos (conflictos, sin display_name) |
| Follow directo sin aprobación | Comunidad pequeña, fricción mínima | Solicitudes de follow (más tablas, más UI) |
| Followers-only activity | Incentiva el follow | Actividad pública para todos |
| Fan-out con `feed_events` + triggers | Una sola query para el feed, paginación limpia, anti-falsificación | Merge en cliente de 4 tablas (más complejo, sin realtime) |
| Vista `athlete_directory` con SECURITY DEFINER | Exponer solo columnas públicas sin tocar RLS de `profiles` | Política de SELECT amplia (expone peso, fecha nac.) |
| Realtime con filtros por user | Reduce payload al cliente | Sin filtro (más ancho de banda) |
| Pesos en lb para PRs, en kg para peso corporal | Convención histórica de la app; UI en kg convierte desde lb | Convertir todo a kg en la DB (rompe datos existentes) |
| `user_metadata` en el auth store | Sin él, ni el sidebar ni el sync de avatares funcionaban | Confiar en `session.user` directo (más acoplamiento) |
| `display_name` con transliteración de acentos | Backfill automático funciona sin intervención | Que el usuario lo cambie manualmente |
