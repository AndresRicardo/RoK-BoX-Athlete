# RöK BoX Athlete

PWA para atletas de CrossFit. Perfil deportivo digital: PRs, benchmarks, logros, progreso y comunidad — sigue a otros atletas y mira su actividad en tu feed.

## Stack

- **React 19** + **Vite 8** — SPA con HMR
- **React Router 7** — routing client-side
- **Zustand 5** — estado global
- **Supabase** (self-hosted) — backend, auth con Google OAuth
- **vite-plugin-pwa** — service worker, manifest, instalable

## Características

- Auth con Google OAuth (sin email/password)
- Sesión persistente
- PRs, benchmarks (WODs), logros y skills con gráficas de evolución
- @handle único por atleta (estilo Instagram)
- Comunidad: buscar atletas (por nombre o @handle), sugerencias de tu box, seguir/dejar de seguir
- Feed de actividad de tus seguidos (PRs, benchmarks, logros, skills)
- Perfil público de atleta con contadores de seguidores
- Responsive mobile-first
- PWA instalable (Android + iOS)
- Offline shell (UI navegable sin red)

## Comandos

```bash
npm install     # instalar dependencias
npm run dev     # servidor de desarrollo (http://localhost:5173)
npm run build   # build de producción → dist/
npm run preview # servir el build (http://localhost:4173)
npm run lint    # ESLint
npm run icons   # regenerar iconos PWA
```

## Variables de entorno

Crear `.env` en la raíz con:

```env
VITE_SUPABASE_URL=https://supabase.tu-dominio.com
VITE_SUPABASE_ANON_KEY=eyJ...
```

> Nunca commitear `.env`. Está en `.gitignore`.

## Base de datos

Las migraciones SQL están en `supabase/migrations/` (ejecutar en orden en el SQL Editor de Supabase Studio). Incluyen perfiles, PRs, benchmarks, logros, skills, follows, directorio público de atletas y feed de actividad.

## Estructura

```
src/
├── components/   # ProtectedRoute, PublicRoute, Navigation, PageLoader,
│                 # AchievementModal, AthleteRow, FollowListModal
├── layouts/      # MainLayout (Navigation + content)
├── pages/        # Login, Dashboard, Profile, ProfileEdit, PRs, PRNew,
│                 # Benchmarks, BenchmarkNew, BenchmarkResult, Achievements,
│                 # Skills, History, Community, AthleteProfile
├── routes/       # React Router config
├── stores/       # Zustand stores (auth, profile, pr, benchmark,
│                 # achievement, movement, follow, feed)
├── data/         # Catálogos estáticos (movimientos, wods, logros, labels)
├── supabase/     # cliente Supabase
├── utils/        # units (kg/lb), handle (@usuario), format, time
├── AppRoot.jsx   # inicializa auth + RouterProvider
└── main.jsx      # entry point
```

## Paleta

- Primary: `#FFC815`
- Background: `#000000`
- Surface: `#292929`
- Muted: `#585858`
- Text: `#FFFFFF`

