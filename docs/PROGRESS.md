# Progreso: Athlete como centro de gestión

| Campo | Valor |
|---|---|
| **Plan** | ✅ **APROBADO** (2026-10-22) |
| **Fase actual** | F2 — Bridge v3 |
| **Próximo paso** | F2.1: spike de lectura de personas en Bumblebee (HCAC del PC de desarrollo) |
| **Bloqueos** | Acceso de la CLI al proyecto de producción (necesario recién en F7) |

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[-]` descartado

## Pendientes P1–P3 (aceptados con el valor propuesto el 2026-10-22)

| ID | Pregunta | Propuesta |
|---|---|---|
| P1 | ¿Se bloquea automáticamente en HikCentral una tiquetera que llega a 0 clases? | Sí |
| P2 | Horarios de los avisos push (PLAN §4.6) | Los de la tabla del plan |
| P3 | Fondo de reserva por defecto al hacer un cuadre | 0 (se digita en cada cuadre) |

## F0 — Preparación
- [x] F0.1 `rokbox-platform` subido a GitHub privado y **archivado**. `rokbox-bridge` creado (privado, con historial, sin credenciales por defecto, 5/5 tests). `rokbox-spent` se archiva en F8.4, porque sigue en uso hasta producción.
- [x] F0.2 `supabase/config.toml` en Athlete y CLI vinculada a DEV (`db query --linked` y `migration list` funcionan)
- [~] F0.3 Acceso de la CLI a producción y backup inicial. **Bloqueado:** `supabase orgs list` sale vacío; el token de este PC no ve el proyecto de producción. El usuario debe hacer `supabase login` con una cuenta o token con acceso a la organización. Se necesita recién en F7.
- [x] F0.4 Paridad `main` ↔ `develop`: todos los stores y acciones existen en la v2 y los líderes ya están en Comunidad. `main` se incorporó en `develop` con estrategia *ours* (`d31835f`). Huecos de UI, a corregir en F3.3:
  - El feed no tiene "cargar más" (`feedStore.loadMore` sin uso).
  - Los líderes no tienen "cargar más" (`loadMorePr` / `loadMoreBenchmarks`).
  - `AthleteProfile` no llama `fetchMyNetwork`, así que el estado de "seguir" puede quedar desactualizado.
  - `signOut` no resetea `notificationStore` ni `leaderboardStore`.
- [x] F0.5 AGENTS.md reescrito, README actualizado y `scripts/hikcentral-sync` eliminado

## F1 — Esquema consolidado en DEV
- [x] F1.1 Migraciones `0015`–`0022`. DEV se recrea completo con `supabase db reset --linked` (D31), sin script aparte.
- [x] F1.2 Aplicado en DEV; tipos en `supabase/types/database.types.ts`
- [x] F1.3 `supabase/tests/management_test.sql`: **54/54 en verde**. Cubre RLS por rol, RPC, cuadre con un escenario calculado a mano, bridge sin ciclos, invitaciones, triggers del feed y trabajos programados. Asesor de seguridad revisado; ajustes en `0022_hardening.sql`.
- [x] F1.4 `supabase/seed.sql`: usuarios de prueba con contraseña aleatoria (la del bridge vieja quedó invalidada), invitación de la cuenta Google del dueño, planes, catálogo, categorías y miembros ZZTEST
- [x] F1.5 `docs/RPC_CONTRACT.md` y `supabase/README.md`

## F2 — Bridge v3
- [ ] F2.1 Spike de lectura en Bumblebee
- [ ] F2.2 Pull → `bridge_sync_persons` (ciclos y conflictos)
- [ ] F2.3 Comandos adaptados y `hik_valid_until`
- [ ] F2.4 Importación inicial con dry-run
- [ ] F2.5 Servicio de Windows e instalador
- [ ] F2.6 Tests y prueba en vivo (ZZTEST)

## F3 — Experiencia del atleta
- [ ] F3.1 Stores de membresía, tiquetera y deudas
- [ ] F3.2 Tarjetas, historial de pagos y vínculo
- [ ] F3.3 Huecos de paridad con `main` (ver F0.4)

## F4 — Pestaña Gestión
- [ ] F4.1 Navegación por rol
- [ ] F4.2 Miembros
- [ ] F4.3 Deudas y ventas
- [ ] F4.4 Pendientes
- [ ] F4.5 Caja
- [ ] F4.6 Cuadres y exportes
- [ ] F4.7 Ajustes
- [ ] F4.8 Eliminar StaffPanel legado

## F5 — Notificaciones push
- [ ] F5.1 Suscripción PWA y preferencias
- [ ] F5.2 Edge Function, outbox y cron

## F6 — Verificación integral en DEV
- [ ] F6.1 Checklist E2E (`VERIFICACION.md`)
- [ ] F6.2 Semana de uso real de los socios en el preview

## F7 — Ensayo del paso a producción
- [ ] F7.1 Restaurar el backup de producción en un entorno temporal y aplicar las migraciones
- [ ] F7.2 Runbook y plan de reversa

## F8 — Producción ⏸ (requiere orden explícita)
- [ ] F8.1 Backup, migraciones, usuarios y configuración
- [ ] F8.2 Merge a `main` y despliegue
- [ ] F8.3 Bridge en el PC del box (importación + modo continuo)
- [ ] F8.4 Retiro de Spent y archivo de repos

---

## Bitácora

### 2026-10-22 (3) — Claude Code
- F1 completa:
  - Se reemplazaron las migraciones 0015 viejas y las 0016–0020 de `rokbox-platform` por `0015`–`0022` consolidadas, que corrigen E1–E16.
  - DEV se reseteó por completo (D31). **Se borraron también las cuentas Google de DEV**: al volver a entrar, la del dueño queda como socio por invitación (D33).
- Decisiones de implementación: D32 (el cuadre usa el efectivo esperado), D33 (invitaciones) y D34 (reglas de membresía).
- La app (`develop`) **aún usa el esquema viejo** (`staffStore`, `membershipStore`, `debtStore`): el preview de Vercel mostrará errores en membresía, deudas y staff hasta F3–F4. Las funciones de atleta (PRs, feed, líderes) no cambian.

### 2026-10-22 (2) — Claude Code
- Plan aprobado; P1–P3 aceptados con lo propuesto. D31: DEV se puede borrar y reestructurar por completo.
- F0 completa, salvo el acceso a producción (F0.3, que no bloquea hasta F7).
- El historial de los repos privados `rokbox-platform` y `rokbox-bridge` contiene la contraseña del usuario bridge de DEV. Quedará invalidada al recrear los usuarios de DEV en F1.4, con una contraseña nueva que no se guarda en git.

### 2026-10-22 — Claude Code
- Sesión de preguntas con el usuario (30 decisiones en `DECISIONES.md`).
- Auditoría de `rokbox-platform` (esquema 0015–0020 y bridge) y de la rama `develop` (`AUDITORIA.md`).
- `rokbox-platform` copiado de `D:\` a `C:\Users\Casa\claude\rokbox-platform` porque el disco D: presenta fallas. Ese repo no tiene remoto.
- Redactado `PLAN.md`. Próximo paso: aprobación del usuario.
