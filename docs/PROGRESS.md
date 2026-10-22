# Progreso: Athlete como centro de gestión

| Campo | Valor |
|---|---|
| **Plan** | 📋 PENDIENTE DE APROBACIÓN ([`PLAN.md`](PLAN.md)) |
| **Fase actual** | — |
| **Próximo paso** | Aprobar el plan, resolver P1–P3 y dar visto bueno para crear los repos en GitHub (F0.1) |

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[-]` descartado

## Pendientes por confirmar (valores por defecto propuestos)

| ID | Pregunta | Propuesta |
|---|---|---|
| P1 | ¿Se bloquea automáticamente en HikCentral una tiquetera que llega a 0 clases? | Sí |
| P2 | Horarios de los avisos push (PLAN §4.6) | Los de la tabla del plan |
| P3 | Fondo de reserva por defecto al hacer un cuadre | 0 (se digita en cada cuadre) |

## F0 — Preparación
- [ ] F0.1 Subir `rokbox-platform` a GitHub privado, crear `rokbox-bridge` (privado) y archivar `rokbox-spent` *(requiere visto bueno)*
- [ ] F0.2 Traer `supabase/` al repo Athlete y vincular la CLI a DEV
- [ ] F0.3 Acceso de la CLI a producción y backup inicial
- [ ] F0.4 Checklist de paridad `main` ↔ `develop` y portar lo faltante (incluido `2995b35`)
- [ ] F0.5 Actualizar AGENTS.md y README, y quitar `scripts/hikcentral-sync`

## F1 — Esquema consolidado en DEV
- [ ] F1.1 Migraciones `0015`–`0022` y script de reset de DEV
- [ ] F1.2 Aplicar en DEV y generar tipos
- [ ] F1.3 Tests SQL (RLS, RPC, cuadre, ingresos automáticos, auditoría)
- [ ] F1.4 Usuarios y seeds de DEV
- [ ] F1.5 `RPC_CONTRACT.md`

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

### 2026-10-22 — Claude Code
- Sesión de preguntas con el usuario (30 decisiones en `DECISIONES.md`).
- Auditoría de `rokbox-platform` (esquema 0015–0020 y bridge) y de la rama `develop` (`AUDITORIA.md`).
- `rokbox-platform` copiado de `D:\` a `C:\Users\Casa\claude\rokbox-platform` porque el disco D: presenta fallas. Ese repo no tiene remoto.
- Redactado `PLAN.md`. Próximo paso: aprobación del usuario.
