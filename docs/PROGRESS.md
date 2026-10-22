# Progreso: Athlete como centro de gestión

| Campo | Valor |
|---|---|
| **Plan** | ✅ **APROBADO** (2026-10-22) |
| **Fase actual** | F2 — Bridge v3 (falta la prueba de escritura en vivo) · F3 siguiente |
| **Próximo paso** | El usuario crea en el HCAC de desarrollo una persona `ZZTEST Bridge Vivo` con cédula `999000901` (F2.6) y autoriza importar las 48 personas reales a DEV. Mientras tanto: F3. |
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
- [x] F2.1 Spike: `PersonCode` = cédula (48/48 numéricas, sin duplicados) y `EndDate`/`BeginDate` con zona horaria. El nivel de acceso no lista personas y `DisableStatus` está en 0 para todos → bloqueo por vigencia (D35). La creación de personas por API falla en todas las variantes probadas → D36
- [x] F2.2 Lectura paginada completa → `bridge_sync_persons` (sin ciclos, probado en SQL)
- [x] F2.3 Solo `set_validity`; fechas en hora Bogotá; tras un fallo espera al siguiente ciclo
- [x] F2.4 `--import` / `--import --dry-run`. Dry-run en vivo: 48 personas, 0 sin cédula, 0 sin vigencia
- [~] F2.5 `install_service.ps1` heredado (NSSM / tarea programada); revisar en el PC del box (F8)
- [~] F2.6 12 tests unitarios en verde. En vivo: login, lectura completa y reporte de importación OK. **Pendiente:** escritura de vigencia sobre una persona ZZTEST (la del spike anterior, ID 50, ahora tiene datos que parecen reales y no se toca)

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

### 2026-10-22 (4) — Claude Code
- F2 casi completa (repo `rokbox-bridge`, commit `3bd0d13`). Decisiones D35 (bloqueo por vigencia) y D36 (la app no crea personas en HCAC). Esquema y tests ajustados: 59/59 en verde.
- La prueba de creación por API dejó 5 intentos fallidos registrados en el HCAC de desarrollo (sin efectos: ninguna persona creada).
- La contraseña del usuario bridge de DEV se regenera en cada `db reset` (seed). El script local `set_bridge_pw.py` del scratchpad la fija y la guarda solo en `bridge/.env`; habría que llevarlo al repo bridge como herramienta de desarrollo.

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
