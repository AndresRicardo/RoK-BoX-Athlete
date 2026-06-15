# RöK BoX Athlete

PWA para atletas de CrossFit. Perfil deportivo digital: PRs, benchmarks, logros y progreso.

## Stack

- **React 19** + **Vite 8** — SPA con HMR
- **React Router 7** — routing client-side
- **Zustand 5** — estado global (auth)
- **Supabase** (self-hosted) — backend, auth con Google OAuth
- **vite-plugin-pwa** — service worker, manifest, instalable

## Características

- Auth con Google OAuth (sin email/password)
- Sesión persistente
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

## Estructura

```
src/
├── components/   # ProtectedRoute, PublicRoute
├── layouts/      # MainLayout (header + footer + content)
├── pages/        # Login, Dashboard
├── routes/       # React Router config
├── stores/       # authStore (Zustand)
├── supabase/     # cliente Supabase
├── AppRoot.jsx   # inicializa auth + RouterProvider
└── main.jsx      # entry point
```

## Paleta

- Primary: `#FFC815`
- Background: `#000000`
- Surface: `#292929`
- Muted: `#585858`
- Text: `#FFFFFF`
