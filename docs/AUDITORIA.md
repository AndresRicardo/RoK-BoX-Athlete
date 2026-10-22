# Auditoría del estado actual (2026-10-22)

Revisión hecha contra las decisiones de [`DECISIONES.md`](DECISIONES.md). Se revisaron cuatro fuentes:

- Las migraciones `0015`–`0020` de `rokbox-platform`, aplicadas solo en DEV.
- El código del bridge de `rokbox-platform/bridge`.
- La rama `develop` de Athlete.
- Los tipos generados del proyecto DEV `qsqrnfgcozvznkbdyozs`.

## 1. Repositorios y entornos

| Hallazgo | Impacto |
|---|---|
| `rokbox-platform` **no tiene remoto**. Solo existe en `D:\` (disco con fallas) y en la copia `C:\Users\Casa\claude\rokbox-platform`. | Riesgo de perder el bridge, las migraciones 0016–0020 y la documentación. Es la **primera tarea** de F0. |
| `rokbox-platform/bridge/.env` contiene credenciales reales (HCAC y usuario bridge). | No debe subirse a git. Hay que verificar `.gitignore` al crear `rokbox-bridge`. |
| Las migraciones `0016`–`0020` están en `rokbox-platform`; el repo Athlete solo tiene hasta `0015`. | Se unifican en Athlete (D25). |
| `0015`–`0020` **nunca se aplicaron en producción**. | Se pueden reescribir y consolidar sin riesgo. En DEV hay que reaplicarlas (ver PLAN §3). |
| La CLI de Supabase de este PC solo lista el proyecto DEV. | Hay que conseguir acceso al proyecto de producción antes de F8. |
| `main` tiene un commit que no está en `develop`: `2995b35 feat(leaderboard)`. `develop` reescribió la interfaz: pasó de páginas con CSS propio a Tailwind con 5 pestañas. | Hay que verificar que no se haya perdido ninguna función (F0.4). |

## 2. Esquema de base de datos (DEV)

### Se conserva (con ajustes menores)
- `user_roles` y los helpers `has_role`, `is_partner`, `is_staff` e `is_bridge`.
- `members` y `member_link_requests`, con las RPC `request_member_link` y `review_member_link`.
- `access_commands`, `bridge_status`, `claim_next_access_command`, `complete_access_command` y `bridge_heartbeat`.
- `debts`, `debt_items` y `debt_payments`, con el trigger de recálculo y la vista `debt_summary`.
- `partners`, `expense_categories`, `expenses`, `incomes` y `settlements`.
- Los triggers que generan ingresos automáticos a partir de abonos y renovaciones.

### Problemas encontrados

| # | Problema | Corrección propuesta |
|---|---|---|
| E1 | Las políticas `expenses`/`incomes` "partner all" permiten que **cualquier socio edite los movimientos de otro**. | Edición y borrado solo para el dueño (`partners.user_id = auth.uid()`), más un historial de auditoría (D22). |
| E2 | No hay **historial de auditoría** genérico. Solo existe `debt_events`, y nadie lo escribe automáticamente. | Tabla `audit_log` con un trigger genérico en las tablas de dinero y acceso. |
| E3 | No hay **catálogo de planes** (`plan_name` es texto libre). No existen la tiquetera, los precios especiales ni la duración por plan. | Nuevas tablas `membership_plans` y `class_usages`; columnas de clases y de precio/descuento en las renovaciones (D15, D16). |
| E4 | `renew_membership` empieza el periodo en `now()` aunque la membresía siga vigente, y el atleta pierde días. | Si la membresía sigue vigente, el periodo nuevo empieza en `valid_until`. Las fechas se calculan desde el plan. |
| E5 | `membership_renewals` no admite el estado **pendiente de pago** ni el origen HikCentral, y su `amount` es obligatorio. | Columnas `origin` (`app`/`hikcentral`) y `payment_status` (`paid`/`pending`), y monto nulo mientras esté pendiente (D5). |
| E6 | Si un **coach** registra una renovación o un abono sin `partner_id`, **no se crea el ingreso** y el dinero desaparece del cuadre. | `received_by_partner` obligatorio en abonos y renovaciones pagadas; el coach elige el socio (D30). |
| E7 | `review_member_link` falla con un error poco claro si el miembro ya está vinculado a otro perfil (`profile_id unique`). Además crea miembros nuevos sin `hik_person_id`. | Validar el vínculo previo con un mensaje claro y avisar cuando no exista la persona en HCAC. |
| E8 | Hay columnas y vistas **de compatibilidad con Spent**: `partners.full_name/percentage/role`, `expenses.date/expense_type`, `incomes.date/source_id` y la vista `categories`. | Eliminarlas (D2). |
| E9 | `debts.reminders_*` y la acción `whatsapp_reminder` venían del flujo de WhatsApp de Spent. | Eliminarlas; las reemplazan las notificaciones push (D18). |
| E10 | No hay ventas de contado: `incomes.source` no incluye `sale`. | Agregar `sale`, con producto y cantidad opcionales (D13). |
| E11 | No hay forma de registrar **entregas de dinero entre socios** ni de marcar como pagadas las transferencias de un cuadre. | Tabla `partner_transfers`; el efectivo esperado las considera (D8). |
| E12 | El cuadre se calculaba **en el teléfono** (Spent). En Athlete no existe ese cálculo. | Función SQL `calculate_settlement(...)` con tests que reproduzcan `SettlementCalculator.kt` (D7). |
| E13 | Las RLS de `debt_items` y `debt_payments` ("staff all") dejan al coach borrar físicamente. | El coach solo inserta y hace borrado lógico, y queda auditado. |
| E14 | No hay infraestructura de **notificaciones push**: `push_subscriptions` existe en DEV sin migración en el repo, y no hay Edge Function ni cron. | Migración, Edge Function `send-push` y trabajos `pg_cron` (D18). |
| E15 | `equipment_catalog` solo modela implementos. | Renombrarlo a `products`, con categoría `store`/`equipment`/`other` (D12, D13). |
| E16 | `set_member_access` no valida que el miembro tenga `memberships`. Si no la tiene, encola un comando sin efecto en la app. | Upsert de la membresía y validación. |

## 3. Bridge Agent (`rokbox-platform/bridge`)

| Estado | Detalle |
|---|---|
| ✅ Funciona | Login RSA en HCAC 2.4 (`/ISAPI/Bumblebee/`), procesamiento de comandos `upsert_person`, `set_validity`, `enable` y `disable`, reaplicación a dispositivos y heartbeat. Hay 5 tests unitarios. |
| ❌ Falta | El **pull no sincroniza**: `run_pull_snapshot` lee las personas y solo las cuenta. No crea `members`, no detecta cambios de vigencia hechos en HCAC y no genera renovaciones pendientes (D4, D5). |
| ❌ Falta | Una regla de resolución de conflictos y de prevención de ciclos (que un cambio hecho por la app no vuelva como un "cambio en HCAC"). |
| ❌ Falta | La importación inicial de las ~48 personas reales del box. |
| ⚠️ Revisar | `disable` usa `remove_access_level` mientras la membresía usa la vigencia. Hay que confirmar cómo distinguir en HCAC "bloqueado" de "vencido" al leer. |

## 4. App Athlete (`develop`)

| Estado | Detalle |
|---|---|
| ✅ Ya existe | Roles desde `user_roles`, `MembershipCard` y `DebtCard` en tiempo real, la solicitud de vínculo de cédula y un `StaffPanel` (búsqueda, deudas, abonos, renovación y aprobación de vínculos). |
| ❌ Falta | Pestaña "Gestión", caja (gastos e ingresos), cuadres, exportes, configuración (socios, planes, catálogo, categorías y roles), tiquetera, pendientes de HCAC, estado del bridge y notificaciones push. |
| ⚠️ Revisar | Paridad de funciones con `main` (ver §1). |
