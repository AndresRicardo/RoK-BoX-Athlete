# Plan: RöK BoX Athlete como centro de gestión del box

> **Estado:** 📋 PENDIENTE DE APROBACIÓN. No se inicia desarrollo hasta que [`PROGRESS.md`](PROGRESS.md) diga `Plan: APROBADO`.
> **Insumos:** [`DECISIONES.md`](DECISIONES.md) (D1–D30) y [`AUDITORIA.md`](AUDITORIA.md) (E1–E16).

## 1. Objetivo

Que **una sola app (Athlete, PWA mobile-first)** sirva a dos públicos:

- **Atletas:** todo lo actual (PRs, WODs, comunidad, líderes, logros, perfil), más el estado de su membresía, las clases de su tiquetera, sus deudas y sus pagos.
- **Socios y coaches:** gestión completa del box, con miembros y acceso (sincronizados con HikCentral), deudas, caja de cada socio y cuadres.

La app RöK BoX Spent se retira (D2).

## 2. Arquitectura objetivo

```
 ┌──────────────── Supabase Cloud (fuente de verdad) ────────────────┐
 │ Postgres + RLS · Auth Google · Realtime · Edge Functions · Cron   │
 └───────▲────────────────────────▲──────────────────────▲───────────┘
         │ supabase-js            │ RPC (usuario bridge)  │ Web Push
 ┌───────┴──────────┐   ┌─────────┴───────────┐   ┌───────┴────────┐
 │ Athlete PWA      │   │ rokbox-bridge (PC   │   │ Teléfonos      │
 │ (Vercel)         │   │ del box, servicio   │   │ atletas/socios │
 │ Atleta / Coach / │   │ Windows)            │   └────────────────┘
 │ Socio            │   │ ⇅ ISAPI Bumblebee   │
 └──────────────────┘   └─────────┬───────────┘
                                  │ HTTPS 443 local
                        ┌─────────┴───────────┐
                        │ HikCentral AC 2.4 → │
                        │ terminal facial →   │
                        │ cerradura           │
                        └─────────────────────┘
```

### Repositorios (D25)

| Repo | Contenido | Ramas |
|---|---|---|
| `RoK-BoX-Athlete` (GitHub) | PWA, **todas las migraciones de Supabase** (`supabase/`), Edge Functions, tests SQL y estos documentos | `develop` (trabajo, despliega el preview en Vercel con Supabase DEV) y `main` (producción) |
| `rokbox-bridge` (GitHub, **privado**, nuevo) | Agente Python del PC del box, instalador y tests | `develop` y `main` |
| `rokbox-platform` | Se archiva como histórico; se sube a GitHub privado solo para no perderlo | — |
| `rokbox-spent` | Se archiva al terminar | — |

## 3. Estrategia de base de datos

Las migraciones `0015`–`0020` **nunca se aplicaron en producción** (AUDITORIA §1). Por eso:

1. Se **reemplazan** por un juego nuevo, limpio y consolidado, que conserva el diseño validado y corrige E1–E16.
2. Las migraciones `0001`–`0014` (tablas de atletas con datos reales) **no se tocan**.
3. **En DEV:** un script `supabase/scripts/reset_management_dev.sql` borra solo los objetos de gestión de 0015–0020. Después se repara el historial (`supabase migration repair`) y se aplican las migraciones nuevas. Las tablas 0001–0014 de DEV se conservan.
4. **En producción:** se aplican las migraciones nuevas sobre 0014. No hay datos de gestión que migrar (D17).

### Migraciones nuevas (implementadas en F1, aplicadas en DEV)

| Archivo | Contenido |
|---|---|
| `0015_roles_partners_members.sql` | Esquema `private` con helpers de rol, `user_roles`, `partners`, **`role_invites`** (invitación por email que se aplica al crear la cuenta), `members` y `member_link_requests`. RPC: `set_user_role`, `claim_role_invites`, `request_member_link`, `review_member_link` (corrección E7) y `upsert_member`. No toca `profiles` ni `athlete_directory`. |
| `0016_memberships_access.sql` | Dominio `payment_method`, `membership_plans`, `memberships` (estado deseado + estado confirmado en HCAC `hik_*`), `membership_renewals` (pagadas o pendientes), `class_usages`, `access_commands`, `bridge_status` y `access_events`. RPC de membresía y del bridge, incluido **`bridge_sync_persons`**. |
| `0017_products_debts.sql` | `products`, `debts`, `debt_items`, `debt_payments` (validación de saldo y socio receptor), recálculo, `create_debt`, `void_debt` y las vistas `debt_summary` y **`membership_status`**. |
| `0018_finance.sql` | `expense_categories`, `expenses`, `incomes`, `partner_transfers` y `settlements`. Ingresos automáticos, `register_sale`, **`calculate_settlement`**, `save_settlement`, `set_settlement_transfer_paid`, `delete_settlement` y la vista `settlement_list`. |
| `0019_audit.sql` | `audit_log` y un trigger genérico en 15 tablas. |
| `0020_notifications.sql` | Extensión de `notifications`, `push_subscriptions`, `notification_preferences`, avisos inmediatos (triggers) y programados (`pg_cron`). El envío push (Edge Function) se hace en F5. |
| `0021_realtime.sql` | Publicación de Realtime. |
| `0022_hardening.sql` | Ajustes de seguridad sobre objetos de 0001–0014 señalados por el asesor de Supabase. |
| `0023_push_dispatch.sql` | Envío push (F5): trigger y cron que llaman a `send-push` por `pg_net` con un secreto de Vault, `claim_push_batch` (solo `service_role`) y `register_push_subscription`. |
| `0024_debt_reminders.sql` | Recordatorio de deuda por WhatsApp (D41): `app_settings` (plantilla del box), `debt_reminders` (registro), `log_debt_reminder` y la vista `debtor_summary`. |
| `supabase/tests/*.sql` | Tests de RLS por rol (atleta, coach, socio, bridge, anónimo), de los RPC y de la fórmula del cuadre. |

### Reglas de seguridad (RLS)

| Recurso | Atleta | Coach | Socio | Bridge |
|---|---|---|---|---|
| Sus propios `members`, `memberships`, renovaciones, `class_usages`, `debts`, ítems y abonos | Leer | — | — | — |
| `members`, `memberships`, `membership_status` (todos) | — | Leer | Leer y editar | Leer y escribir (RPC) |
| Renovar, descontar clases, solicitudes de vínculo | — | ✅ | ✅ | — |
| Bloquear o desbloquear acceso | — | ❌ | ✅ | — |
| Deudas, ítems y abonos | — | Crear, editar y anular (borrado lógico) | Todo | — |
| `products` (catálogo) | Leer | Leer | CRUD | — |
| `expenses`, `incomes`, `partner_transfers` | — | ❌ | Leer todos; editar y borrar **solo los propios** (D22) | — |
| `settlements`, `partners`, `expense_categories`, `membership_plans` (escritura), `user_roles` | — | ❌ | ✅ | — |
| `audit_log` | — | ❌ | Leer | — |

Todos los RPC son `security definer`, con `set search_path = public` y validación de rol al inicio.

## 4. Diseño funcional

### 4.1 Miembros, planes y membresías
- **Planes** configurables por los socios: mensual, trimestral, semestral, anual y tiquetera de N clases con vigencia máxima. Cada plan tiene un precio de lista.
- **Renovar** (socio o coach):
  1. Elegir el plan.
  2. Ver el precio de lista, que se puede ajustar con un descuento y su motivo (precios especiales, D15).
  3. Elegir el medio de pago y el socio que recibe el dinero (D30).
  4. La vigencia empieza en la fecha de fin actual si la membresía sigue vigente, o hoy si ya venció (E4).

  Al confirmar se generan tres cosas:
  - el registro de la renovación;
  - el ingreso del socio, mediante un trigger;
  - el comando `set_validity` hacia HikCentral.
- **Tiquetera** (D16): botón "Descontar clase" (con opción de deshacer) en la ficha del miembro. Al llegar a 0 clases el estado pasa a `no_classes`. *Por defecto propuesto:* también se encola el **bloqueo automático en HikCentral**; confirmarlo (PROGRESS, pendiente P1).
- **Bloquear o desbloquear** (solo socios): encola `enable`/`disable` hacia HikCentral.
- **Vínculo con la cuenta del atleta** (D20): flujo existente de cédula + aprobación, con la corrección E7.

### 4.2 Sincronización bidireccional con HikCentral (D4, D5)

**De la app a HikCentral (ya funciona):** la cola `access_commands` → el bridge → ISAPI → reaplicación a los dispositivos.

**De HikCentral a la app (nuevo):**
1. Cada `PULL_INTERVAL` (propuesto: 5 minutos) el bridge lee todas las personas de HCAC: código (cédula), nombre, teléfono, inicio y fin de vigencia, y si pertenece al nivel de acceso.
2. El bridge envía el lote a `bridge_sync_persons`. Ese RPC hace lo siguiente:
   - **Persona nueva en HCAC** → crea un `members` con `source = 'hikcentral'` y su `memberships`.
   - **Fin de vigencia distinto de `memberships.hik_valid_until`, sin un comando de la app pendiente o recién aplicado** → es un cambio hecho en HCAC:
     - se actualiza la membresía (`last_change_origin = 'hikcentral'`);
     - si la vigencia se **extendió**, se crea una `membership_renewals` con `origin = 'hikcentral'` y `payment_status = 'pending'`;
     - se notifica a todos los socios (D5).
   - **Cambio en el nivel de acceso** → se actualiza `access_enabled`.
   - **Persona eliminada en HCAC** → se marca `members.is_active = false`. Nunca se borra.
3. **Prevención de ciclos:** cuando el bridge aplica un comando, `complete_access_command` guarda en `hik_valid_until` el valor que quedó en HCAC. Así el siguiente pull no lo detecta como un cambio externo.
4. **Conflictos:** gana el último cambio. Si hay un comando de la app pendiente para esa persona, se ignora la lectura de HCAC hasta que el comando termine.
5. **Completar el pago pendiente:** un socio abre "Pendientes", ingresa el monto, el medio de pago y quién recibió el dinero. Se ejecuta `complete_pending_renewal` y se genera el ingreso.

**Riesgo a validar en un spike (F2.1):** confirmar qué campos expone la API Bumblebee para distinguir "bloqueado" de "vencido", y si existe una fecha de última modificación.

### 4.3 Deudas y tienda (D12, D13, D14)
- Catálogo de productos con precio. Una deuda se compone de ítems del catálogo o libres, con cantidad y precio editable.
- Abonos parciales, con el medio de pago y el socio que recibe el dinero. Cada abono genera automáticamente un ingreso para ese socio.
- Se pueden anular deudas (con motivo) y editar ítems. Todo queda auditado.
- **Venta de contado:** "Registrar venta" crea un ingreso `sale` con el producto y la cantidad, sin crear deuda.
- La deuda no bloquea el acceso.

### 4.4 Caja de cada socio (D10, D11, D22)
- **Gastos:** título, monto, categoría, **tipo `BOX` o `PERSONAL`**, medio de pago, fecha y nota.
- **Ingresos manuales**, ventas de contado y los ingresos automáticos (renovaciones y abonos). Los automáticos se editan desde su origen, no directamente.
- **Entregas entre socios** (`partner_transfers`), por ejemplo "le entregué $200.000 a mi socio".
- Cada socio ve "**Mi caja**": ingresos, gastos y saldo esperado en su poder en un rango de fechas. También puede ver la caja del otro socio, pero no editarla.

### 4.5 Cuadre (D7, D8, D9)
Se porta exactamente la lógica de Spent (`rokbox-platform/docs/00-contexto.md`).

Para cada socio `i` en el periodo `[inicio, fin]`:

```
incomeCollected_i  = Σ ingresos recibidos por i
boxExpensesPaid_i  = Σ gastos BOX pagados por i
personalExpenses_i = Σ gastos PERSONAL de i
expectedCash_i     = incomeCollected_i − boxExpensesPaid_i − personalExpenses_i
                     − entregas hechas por i + entregas recibidas por i
declaredCash_i     = valor DIGITADO por el socio (opcional)
difference_i       = declaredCash_i − expectedCash_i          ← alerta de faltante o sobrante (D8, D32)

totalIncome  = Σ incomeCollected
boxExpenses  = Σ boxExpensesPaid
netProfit    = totalIncome − boxExpenses − reserveFund
grossShare_i = netProfit × percentage_i / 100
netBalance_i = grossShare_i − (personalExpenses_i + expectedCash_i)   ← usa el ESPERADO (D32)
```

- Si `netBalance > 0`, el socio recibe; si es negativo, paga. Las transferencias se emparejan de forma greedy y el sobrante va al fondo de reserva. La suma de porcentajes debe dar 100 %.
- Al guardar, se almacena una **foto inmutable**: porcentajes, totales, valores por socio y transferencias. Los movimientos siguen editables (D9). Si alguno cambia después, el cuadre **muestra un aviso de "movimientos modificados después del cuadre"**, pero no se recalcula solo.
- Cada transferencia del cuadre se puede marcar como **pagada**.
- **Exportar a PDF** (resumen del cuadre) y **a Excel** (movimientos del periodo y cuadre) desde el navegador, sin servidor (D21).
- *Verificación:* tests SQL que reproducen casos calculados con `SettlementCalculator.kt` de Spent.

### 4.6 Notificaciones push (D18)
- Web Push con VAPID desde la PWA. En iPhone requiere iOS 16.4 o superior y **tener la app instalada** en la pantalla de inicio. Esto se explica en la propia app.
- Edge Function `send-push` alimentada por `notification_outbox`, más los trabajos de `pg_cron` (horarios propuestos; pendiente P2):

| Destino | Evento | Momento |
|---|---|---|
| Atleta | Membresía por vencer | Diario 8:00. Avisa 3 días antes y el día que vence. |
| Atleta | Quedan ≤ 2 clases en la tiquetera | Al descontar la clase |
| Atleta | Deuda cargada o abono registrado | Inmediato (trigger) |
| Atleta | Recordatorio de saldo pendiente | Semanal, lunes 9:00 |
| Socios | Renovación hecha en HCAC sin pago registrado | Inmediato |
| Socios y coaches | Solicitud de vínculo por aprobar | Inmediato |
| Socios | Bridge sin señal por más de 30 minutos | Revisión cada 10 minutos |
| Socios | Resumen semanal: ingresos, gastos y membresías que vencen | Lunes 7:00 |

- Además del push, cada aviso queda en la campana de notificaciones existente.
- Cada usuario puede desactivar tipos de aviso desde su perfil.

### 4.7 Interfaz (D19, D29)
- Se mantiene la estética de la v2 (paleta RöK BoX y modo oscuro) y la navegación inferior mobile-first.
- **Pestaña "Gestión"**, visible solo para socios y coaches. Reemplaza al `StaffPanel` actual y tiene un inicio con tarjetas: miembros por vencer, pendientes y estado del bridge.

  | Sección | Contenido | Quién |
  |---|---|---|
  | **Miembros** | Lista con búsqueda y filtros por estado. La ficha muestra membresía, renovar, descontar clase, bloquear, deudas, historial y vínculo. | Socio y coach (bloquear solo socio) |
  | **Deudas** | Lista de saldos, nueva deuda, abonos y anular. Incluye "Registrar venta". | Socio y coach |
  | **Pendientes** | Renovaciones de HCAC sin pago y vínculos por aprobar. | Socio (los vínculos también el coach) |
  | **Caja** | Mi caja, caja del otro socio, gastos, ingresos y entregas entre socios. | Solo socio |
  | **Cuadres** | Nuevo cuadre (fechas, reserva y efectivo declarado), historial, marcar transferencias pagadas y exportar. | Solo socio |
  | **Ajustes** | Socios y porcentajes, planes y precios, catálogo, categorías de gasto, roles de usuarios, estado del bridge y auditoría. | Solo socio |

- Con 6 pestañas en la barra inferior, cada ítem sigue teniendo como mínimo 44 px de ancho táctil en 360 px. Si no cabe bien, Logros pasa a Perfil (se decide en F4 con un prototipo).
- **Atleta:** el Dashboard y el Perfil muestran la membresía (plan, días o clases restantes y estado de acceso), las deudas con su detalle e historial de abonos, y el historial de pagos de mensualidad.

## 5. Fases

> Todo se desarrolla en `develop` y se verifica en DEV. **Una sola salida a producción** al final (D26).

### F0 — Preparación
1. **Salvaguardar el código:** subir `rokbox-platform` a un GitHub privado (archivo), crear el repo privado `rokbox-bridge` copiando `bridge/` (sin `.env`, sin logs y verificando `.gitignore`) y archivar `rokbox-spent`. *Requiere el visto bueno explícito del usuario, porque crea repos en GitHub.*
2. Traer `supabase/` (config, seeds y tests) al repo Athlete y vincular la CLI a DEV.
3. Conseguir acceso de la CLI al proyecto de producción y tomar un **backup inicial** (`pg_dump` de esquema y datos).
4. **Paridad con `main`:** comparar las funciones de `main` (PRs, benchmarks, histórico, skills, líderes, edición de perfil, logros y comunidad) contra la v2. Portar el commit `2995b35` u otra pieza faltante.
5. Actualizar `AGENTS.md` y el README de Athlete: quitar las referencias a Spent y a `scripts/hikcentral-sync`, y eliminar ese script legado.

### F1 — Esquema consolidado en DEV
1. Escribir las migraciones `0015`–`0022` de §3 y el script de reset de DEV.
2. Aplicar en DEV y regenerar `src/types/database.types.ts`.
3. Escribir los tests SQL: RLS por rol, RPC, cuadre contra casos de Spent, triggers de ingresos y auditoría.
4. Crear usuarios y seeds de DEV: 2 socios, 1 coach, 2 atletas, 1 bridge, planes, catálogo y categorías.
5. Documentar el contrato de RPC en `docs/RPC_CONTRACT.md`.

### F2 — Bridge v3 (`rokbox-bridge`)
1. **Spike:** campos de persona y nivel de acceso en Bumblebee (§4.2, riesgo).
2. Pull real: el lote de personas va a `bridge_sync_persons`, con prevención de ciclos y regla de conflictos.
3. Adaptar los comandos al nuevo esquema y guardar `hik_valid_until` al completar.
4. **Importación inicial** de las personas de HCAC (modo `--import`, con *dry-run* que muestra el reporte antes de escribir).
5. Instalación como servicio de Windows (NSSM), reinicio automático, logs rotativos y `.env` fuera de git.
6. Tests unitarios y prueba en vivo contra el HCAC del PC de desarrollo, usando solo personas `ZZTEST`.

### F3 — App: experiencia del atleta
1. Adaptar `membershipStore` y `debtStore` a las vistas nuevas (incluida la tiquetera).
2. Tarjetas de membresía y deudas, historial de pagos y vínculo de cédula (corrección E7).

### F4 — App: pestaña Gestión
1. Navegación por rol y prototipo de la barra con 6 pestañas.
2. Miembros: lista, ficha, renovar, tiquetera y bloquear.
3. Deudas y ventas.
4. Pendientes.
5. Caja: gastos, ingresos y entregas.
6. Cuadres: cálculo, guardado, pagos y exportación a PDF y Excel.
7. Ajustes: socios, planes, catálogo, categorías, roles, estado del bridge y auditoría.
8. Eliminar `StaffPanel` y `staffStore` legados.

### F5 — Notificaciones push
1. Suscripción en la PWA (service worker y permisos), guía de instalación en iPhone y preferencias.
2. Edge Function `send-push`, `notification_outbox` y trabajos `pg_cron`.

### F6 — Verificación integral en DEV
Checklist E2E en `docs/VERIFICACION.md`. Cubre como mínimo:
- renovar en la app y ver el cambio en HCAC;
- renovar en HCAC y que aparezca como pendiente en la app;
- bloquear y desbloquear;
- tiquetera;
- deudas, abonos y ventas, y su efecto en la caja;
- gastos BOX y PERSONAL;
- entregas entre socios;
- cuadre (comparado con un cálculo manual);
- exportes;
- notificaciones push;
- RLS (un atleta no ve finanzas ni datos ajenos; un coach no ve la caja);
- auditoría;
- paridad con `main`.

Al final, **el usuario y su socio** prueban en el preview de Vercel durante al menos una semana de uso simulado.

### F7 — Ensayo del paso a producción
1. Restaurar el backup de producción en un proyecto o branch de Supabase temporal y aplicar las migraciones nuevas.
2. Convertir `profiles.weight_kg` de libras a kilos (E17) y unificar `profiles.box_name` a "RöK BoX" (E18).
3. Correr los tests SQL y apuntar un build de la app a ese ensayo para validar que los datos de atletas sigan intactos.
4. Configurar el push en el ensayo: secretos VAPID, `send-push` y `configure-push.mjs` (ver `supabase/README.md`).
5. Escribir el **runbook** paso a paso y el **plan de reversa**: backup + revert de `main` en Vercel + bridge detenido. HikCentral sigue funcionando solo.

### F8 — Producción (requiere orden explícita)
1. Backup del día.
2. Migraciones en producción.
3. Usuarios: roles de socios, coach (si aplica) y usuario bridge.
4. Configuración: socios y porcentajes, planes, catálogo y categorías.
5. Merge de `develop` a `main` y despliegue en Vercel.
6. Instalar el bridge en el **PC del box**: primero `--import` en dry-run, luego la importación real y después el modo continuo.
7. Avisar a los atletas que vinculen su cédula.
8. Monitoreo reforzado la primera semana.
9. Retirar Spent de los teléfonos y archivar los repos.

### F9 — Futuro (fuera de alcance)
- Asistencia y conteo automático de clases desde `access_events`.
- Inventario con stock.
- Fotos de recibos.
- Gastos recurrentes y presupuestos.
- Pagos en línea.
- Recordatorios por WhatsApp.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| La API Bumblebee (no documentada públicamente) no expone lo necesario para leer cambios | Spike en F2.1. Plan B: leer la base PostgreSQL interna de HCAC **en solo lectura** (escribir sigue prohibido). |
| Una sola salida a producción (D26) concentra el riesgo | Ensayo completo en F7, runbook, plan de reversa y semana de prueba en DEV. |
| Ciclos o conflictos en la sincronización bidireccional | `hik_valid_until`, bloqueo por comando pendiente, auditoría y tests con escenarios de carrera. |
| Pérdida de funciones de `main` en la v2 | Checklist de paridad (F0.4 y F6). |
| Disco D: con fallas | Todo queda en GitHub (F0.1). |
| El PC del box se apaga o pierde internet | El acceso sigue funcionando en HCAC. Los comandos quedan en cola, la app muestra "bridge sin señal" y los socios reciben un aviso. |
| Push en iPhone | Requiere la PWA instalada; la campana interna de notificaciones sigue funcionando sin ella. |
