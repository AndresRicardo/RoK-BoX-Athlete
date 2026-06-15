# RöK BoX Athlete

PWA for CrossFit athletes. Track PRs, benchmarks, achievements, and progress.

## Tech Stack
React + Vite | React Router | Zustand | Supabase | vite-plugin-pwa

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Env Variables (required)
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Color Palette
- Primary: `#FFC815` (gold/yellow)
- Background: `#000000`
- Surface: `#292929`
- Muted: `#585858`
- Text: `#FFFFFF`

## Project Structure
```
src/
├── components/     # ProtectedRoute, PublicRoute
├── layouts/        # MainLayout (header + footer)
├── pages/          # Login, Register, Dashboard
├── routes/         # React Router config
├── stores/         # Zustand stores (authStore exists)
├── supabase/       # Client configuration
```

## Supabase RLS Pattern
All tables use `auth.uid() = user_id` or `auth.uid() = id` policies. Users only access their own data.

## Current Phase
FASE 1 complete (auth). Next: FASE 2 - Athlete Profile (profiles table CRUD).

## Routes
- `/login` - Public
- `/register` - Public
- `/dashboard` - Protected (requires auth)
- `/*` - Redirects to /dashboard
