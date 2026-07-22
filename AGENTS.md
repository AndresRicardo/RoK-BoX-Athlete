# RöK BoX Athlete

PWA for CrossFit athletes. Track PRs, benchmarks, achievements, skills, and progress — with a social layer: follow athletes and see their activity in a feed.

## Tech Stack
React 19 + Vite 8 | React Router 7 | Zustand 5 | Supabase (Google OAuth only) | vite-plugin-pwa | recharts | sharp (PWA icons)

## Commands
```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build → dist/
npm run lint     # ESLint check
npm run preview  # Preview production build (http://localhost:4173)
npm run icons    # Regenerate PWA icons (scripts/generate-pwa-icons.mjs)
```

## Env Variables (required)
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Supabase is self-hosted. Auth is Google OAuth only (no email/password). Never commit `.env`.

## Color Palette
- Primary: `#FFC815` (gold/yellow)
- Background: `#000000`
- Surface: `#292929`
- Muted: `#585858`
- Text: `#FFFFFF`

## Project Structure
```
src/
├── components/     # ProtectedRoute, PublicRoute, Navigation (bottom nav + sidebar), PageLoader,
│                   # AchievementModal, AthleteRow, FollowListModal
├── layouts/        # MainLayout (Navigation + content)
├── pages/          # Login, Dashboard, Profile, ProfileEdit, PRs, PRNew, Benchmarks, BenchmarkNew,
│                   # BenchmarkResult, Achievements, Skills, History, Community, AthleteProfile
│                   # (each with its own .css)
├── routes/         # React Router config (lazy loading + Suspense for non-critical pages)
├── stores/         # Zustand: authStore, profileStore, prStore, benchmarkStore, achievementStore,
│                   # movementStore, followStore, feedStore
├── data/           # Static catalogs: movements.js, wods.js, achievements.js, labels.js
├── supabase/       # Client configuration
├── utils/          # units.js (kg/lb), handle.js (@handle rules), format.js (PR/benchmark
│                   # formatters), time.js (timeAgo)
├── AppRoot.jsx     # Initializes auth, resets stores on logout, mounts RouterProvider + AchievementModal
└── main.jsx        # Entry point
```

## Routes
- `/login` - Public (Google OAuth)
- `/dashboard` - Protected
- `/profile`, `/profile/edit` - Protected
- `/prs`, `/prs/new`, `/prs/:id/edit` - Protected
- `/benchmarks`, `/benchmarks/new`, `/benchmarks/new/:wodName`, `/benchmarks/:id/edit` - Protected
- `/achievements`, `/skills`, `/history` - Protected
- `/community` - Protected (tabs: Feed / Buscar / Siguiendo / Seguidores)
- `/athletes/:id` - Protected (public athlete profile; own id redirects to /profile)
- `/*` - Redirects to /community (landing = feed)

Navigation order: Comunidad, Inicio, PRs, Skills, WODs, Histórico, Logros, Perfil (bottom nav on mobile, sidebar on desktop). `/athletes/:id` marks Comunidad as active.

## Database (supabase/migrations/)
- `0001_profiles` - Athlete profile (1:1 with auth.users, `id` PK)
- `0002_prs` - Personal records (`user_id`, movement, type: strength/benchmark/reps, value)
- `0003_benchmarks` - WOD results (`user_id`, name, type: for_time/amrap/emom/max, result)
- `0004_achievements` - Unlocked achievements (`user_id`, achievement_id, unique pair)
- `0005_unlocked_movements` - Skills (`user_id`, movement, category, unique pair)
- `0006_fix_prs_benchmarks_update_rls` - Adds missing UPDATE policies for prs/benchmarks
- `0007_display_name_handle` - `display_name` becomes unique + required @handle (CHECK `^[a-z0-9._]{3,20}$`, unique index, NOT NULL, backfill for existing rows)
- `0008_follows` - `follows` table (PK follower+followed, no self-follow), `athlete_directory` view (public profile columns), "followers read" policies on the 4 activity tables
- `0009_feed_events` - `feed_events` table + INSERT/DELETE triggers on the 4 activity tables (fan-out on write)

## Supabase RLS Pattern
All tables use `auth.uid() = user_id` (or `auth.uid() = id` for profiles) policies. Users only access their own data. UPDATE policies need both `USING` and `WITH CHECK` (see 0006).

Social exceptions (0008/0009):
- `follows`: SELECT open to any authenticated user (public graph); INSERT/DELETE only as `follower_id = auth.uid()`.
- Activity tables (prs, benchmarks, achievements, unlocked_movements): followers can SELECT via `EXISTS` on follows.
- `feed_events`: SELECT own events + events from followed users; **no INSERT policy for clients** — only triggers (security definer) write.
- `athlete_directory` view bypasses profiles RLS exposing only public columns (id, display_name, names, full_name, box_name, discipline, created_at). Email, weight, birth_date, gender stay private.

## Social Model
- **@handle**: `display_name` is the unique, required, lowercase handle (`utils/handle.js` mirrors the DB CHECK). Search matches `full_name` or `display_name` via the directory view.
- **Follow**: direct, no approval. Following someone grants read access to their activity and puts their events in your feed.
- **Feed**: `feed_events` rows created by DB triggers on INSERT (and cleaned on DELETE of the source row). UPDATEs don't generate events (snapshot). Payloads are jsonb display-ready snapshots.

## Store Pattern
- Each store exposes `fetch*`, mutation methods, and `reset()`.
- `AppRoot.jsx` resets all stores when `userId` becomes null (logout).
- PRs and benchmarks stores fetch without cache (always fresh) so edits are reflected immediately.
- Achievements are re-validated after PR/Benchmark create **and** edit (FASE 10).
- `followStore`: my network (following/followers ids), search, suggestions (same box), explore, public graph lists.
- `feedStore`: paginated feed (PAGE_SIZE 20, `range` load-more), hydrates events with directory profiles.

## Conventions
- UI language: Spanish. Docs/commits: Spanish messages.
- Weights are stored in lb and displayed in kg (see `src/utils/units.js`); PR values are entered/shown in lb (`src/utils/format.js`).
- Each page/component defines its own button styles in its .css (no global .btn-primary).
- PWA: `registerType: 'autoUpdate'`, offline shell, manifest in `vite.config.js`.
- Deploy: Vercel with SPA rewrites (`vercel.json`).

## Current Phase
FASES 1-12 complete: Auth, Profile, PRs, Benchmarks, Achievements (+ modal), Skills, Navigation, History (evolution charts), Edit PRs/Benchmarks, Achievement re-validation on edit, Social (follows, @handle, search, public profiles) and Activity Feed.

Next ideas (FASE 13+): likes/reactions, comments, notifications, realtime feed, avatar sync from Google to profiles, feed events on PR/benchmark edits.
