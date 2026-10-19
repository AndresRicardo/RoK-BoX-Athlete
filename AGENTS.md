# RöK BoX Athlete v2 — Agent Guidelines

## Workflow

- All work happens on the `develop` branch. Commit and push **only to `develop`**.
- `main` is updated **only when the user explicitly asks** (merge, release, etc.).
- Never push directly to `main`, never merge to `main` without explicit instruction.

## Architecture

- **Mobile First**: All layouts, touch targets, and typography are engineered for smartphones (max-width `448px` centered on desktop preview).
- **Navigation**: 5 bottom tabs:
  - `/` (Dashboard / Membresía / Deudas)
  - `/training` (PRs / WODs / Histórico / Skills)
  - `/community` (Feed / Líderes / Buscar)
  - `/achievements` (Logros y Medallas)
  - `/profile` (Perfil / Cédula HikCentral / Detalle de Pagos / Modo Staff)
  - `/staff` (POS para coaches y administradores)
- **HikCentral Integration**:
  - `memberships` table in Supabase.
  - Linked via `profiles.document_id`.
  - Windows background agent in `scripts/hikcentral-sync/sync_agent.py`.
- **Database Migrations**:
  - `supabase/migrations/0001` through `0014`: Original athlete schema preserved.
  - `supabase/migrations/0015_memberships_and_debts.sql`: Membresías HikCentral, deudas de tienda, abonos, RLS y triggers.
