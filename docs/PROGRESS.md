# Progreso: Athlete como centro de gestión

| Campo | Valor |
|---|---|
| **Plan** | ✅ **APROBADO** (2026-10-22) |
| **Fase actual** | F8 — Producción (app, base y bridge funcionando) |
| **Próximo paso** | Carga manual D46 (tiqueteras y deudas), aviso a los atletas y primera semana del runbook (§4) |
| **Bloqueos** | Ninguno |

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
- [x] F0.3 Acceso de la CLI a producción: el token anterior solo veía DEV; resuelto el 2026-10-29 con `supabase login` del dueño (misma cuenta, otro proyecto). El backup se hace el día del paso (F8.1).
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
- [x] F2.5 `install_service.ps1` probado en el PC del box (tarea programada, sin NSSM). Corregido el límite de 72 h de las tareas de Windows (`rokbox-bridge` `5141801`)
- [x] F2.6 12 tests unitarios en verde. **En vivo contra el HCAC de desarrollo con la persona ZZTEST (ID 51):**
  - vinculación por el pull;
  - renovación desde la app (vigencia 22/nov → 22/dic 23:59 en HCAC);
  - bloqueo (`EndDate` = momento del bloqueo) y desbloqueo (vigencia restaurada);
  - la lectura siguiente no detecta cambios fantasma.
- [x] F2.7 Nombres descifrados (D37) y cédula leída del campo "Cc" (D38). **Importación real a DEV:** 50 personas (49 creadas y 1 vinculada); 12 activas y 38 vencidas; 21 con cédula y 29 sin "Cc". Un ciclo completo `--once` aplicó el comando pendiente y las lecturas siguientes no detectaron cambios falsos.

## F3 — Experiencia del atleta
- [x] F3.1 Stores de membresía (historial de pagos, consumos de tiquetera, `review_note`) y deudas (`name`, `concept`). Verificado con el usuario atleta real y RLS: ve solo lo suyo, sin finanzas
- [x] F3.2 `MembershipCard` (tiquetera con barra, `no_classes`, aviso "aún no registrado en el huellero"), `DebtCard` (ítems por entregar, medios de pago en español), `PaymentHistory` nuevo en Perfil, cédula bloqueada si ya está vinculada, invitaciones aplicadas al iniciar sesión
- [x] F3.3 Paridad: el tablero de líderes de la v2 leía columnas inexistentes (mostraba valores vacíos) → se portó el de `main` como `LeaderboardPanel` (grupos, Global/Siguiendo, filtros, "ver más"); feed con "cargar más"; `signOut` resetea líderes. `AthleteProfile` ya cargaba la red (alias `fetchNetwork`)

## F4 — Pestaña Gestión
- [x] F4.1 Navegación por rol: 6.ª pestaña "Gestión" solo para socios y coaches (Logros se queda en la barra: cada ítem mide 60 px en 360 px). `StaffRoute` protege las rutas `/manage/*` (Caja, Cuadres y Ajustes solo socios)
- [x] F4.2 Miembros: lista con búsqueda y filtros por estado, ficha (renovar, descontar/deshacer clase, bloquear/desbloquear, corregir fechas, editar datos, deudas, historial y anulación de renovaciones, estado en HikCentral) y alta de miembro
- [x] F4.3 Deudas y ventas: nueva deuda (catálogo o ítem libre, por entregar), abonos, anular, venta de contado
- [x] F4.4 Pendientes: renovaciones de HCAC sin pago (registrar pago o anular), vínculos por aprobar o rechazar, comandos fallidos
- [x] F4.5 Caja: por socio y mes, efectivo esperado (misma fórmula del cuadre), gastos BOX/PERSONAL, ingresos manuales y entregas; solo se editan los propios
- [x] F4.6 Cuadres: calcular, revisar, guardar, marcar transferencias pagadas, eliminar, exportar a PDF (jsPDF) y Excel (write-excel-file). Las librerías se cargan solo al exportar y no entran al precache de la PWA
- [x] F4.7 Ajustes: socios y porcentajes, planes, catálogo, categorías, roles e invitaciones, estado del bridge con sus últimos comandos y auditoría
- [x] F4.8 `StaffPanel` y `staffStore` eliminados; `/staff` redirige a `/manage`

## F5 — Notificaciones push
- [x] F5.1 Suscripción PWA (`public/push-sw.js` importado por el service worker de Workbox), tarjeta "Notificaciones" en Perfil con guía para iPhone (instalar en inicio, iOS 16.4+) y preferencias por tipo. Al abrir la app el dispositivo se re-registra a nombre de la cuenta actual; al cerrar sesión deja de recibir sus avisos
- [x] F5.2 `0023_push_dispatch.sql` (trigger por sentencia + cron de respaldo cada minuto vía `pg_net`, secreto en Vault, `claim_push_batch`, `register_push_subscription`) y Edge Function `send-push` versionada en el repo (la v6 vieja de DEV dependía de un trigger que ya no existía). La cola es `notifications.pushed_at`; no hizo falta una tabla outbox aparte

## F6 — Verificación integral en DEV
- [~] F6.1 Checklist escrito en [`VERIFICACION.md`](VERIFICACION.md) (13 secciones, ~140 pruebas, con lo ya cubierto por tests automáticos marcado); falta ejecutarlo en teléfonos reales y traer al repo los scripts E2E y unitarios
- [x] Extra (pedido del dueño): recordatorio de deuda por WhatsApp (D41, `0024_debt_reminders.sql`). Deudas → "Recordar por WhatsApp" (lista "Por recordar" / "Todos" / "Sin celular" con "Siguiente" para recorrer la lista), botón "Recordar" en la ficha del miembro y Ajustes → "Mensaje de cobro por WhatsApp"
- [ ] F6.2 Semana de uso real de los socios en el preview

## F7 — Ensayo del paso a producción
- [-] F7.1 Restaurar el backup de producción en un entorno temporal y aplicar las migraciones. Descartado por el dueño el 2026-10-29; en su lugar, prechequeo de producción y comparación de su esquema con DEV
- [x] F7.2 Runbook y plan de reversa: [`RUNBOOK_PRODUCCION.md`](RUNBOOK_PRODUCCION.md) y scripts `supabase/scripts/prod/01`–`04` (probados en DEV sin guardar cambios)

## F8 — Producción ⏸ (requiere orden explícita)
- [x] F8.1 Backup, migraciones, usuarios y configuración (2026-10-29)
- [x] F8.2 Merge a `main` y despliegue (`ebda5b2`, 2026-10-29)
- [x] F8.3 Bridge en el PC del box (importación + modo continuo, 2026-10-30)
- [ ] F8.4 Retiro de Spent y archivo de repos

---

## Bitácora

### 2026-10-30 — Claude Code (bridge en producción)
- `rokbox-bridge` `main` = `develop` (v3, `8ff807b`). Instalado en `C:okbox-bridge` del PC del box con su `.env` de producción.
- Dry-run: 145 personas, 0 coincidencias, 123 sin "Cc", 0 sin vigencia. Importación real: 145 creadas. `--once` sin cambios ni comandos.
- Producción: 145 miembros, todos con `hik_person_id`, 22 con cédula; 37 al día, 10 por vencer, 98 vencidos. Latido v3.0.0 desde la tarea programada `RokboxBridgeAgent` (SYSTEM, al iniciar).
- La tarea se creó con el límite de 72 h por defecto de Windows: se quitó a mano (`ExecutionTimeLimit = PT0S`) y el instalador quedó corregido en `develop` del bridge.
- Con 123 miembros sin cédula: antes de aprobar una vinculación que diga "No hay un miembro con la cédula…", escribir la cédula en el miembro importado (Editar datos); si no, se crea un duplicado sin HCAC.

### 2026-10-29 — Claude Code (paso a producción, por orden del dueño)
- Backup del día (schema, data con auth y roles) fuera del repo. Prechequeo igual al de la tarde.
- `migration repair` de `0001`–`0014` y `db push` de `0015`–`0028` sin errores (sin seed).
- E17: 22 pesos convertidos a kilos (53–110, promedio 77,8). E18: los 23 perfiles con "RöK BoX".
- `main` = `develop` (`ebda5b2`) → Vercel publica producción.
- Socios Andres Ricardo Muñoz y Martín Gabriel Torres (50/50) con invitación ya aplicada; rol bridge a `bridge@rokbox.co`.
- Push: secretos VAPID, `send-push` desplegada y `configure-push.mjs`.
- Poschequeo: filas de atletas iguales al prechequeo, 28 migraciones (última `0028`), 5 trabajos de cron, 2 secretos en Vault. Gestión vacía (sin miembros hasta importar con el bridge).
- Varios comandos de escritura en producción los corrió el dueño con `!` porque el clasificador de permisos los bloqueó.

### 2026-10-29 — Claude Code (preparación)
- Decisión D46 (arranque desde cero; deudas y tiqueteras a mano; cada atleta pide su vínculo).
- Runbook del paso a producción y scripts `supabase/scripts/prod/`: prechequeo y poschequeo (solo lectura, una fila sin datos personales, porque la CLI muestra solo el último resultado), correcciones E17/E18 (la de peso no se repite y se niega si el promedio ya parece estar en kilos; E18 usa `translate` porque `unaccent` no está instalada) y plantilla de alta de socios y bridge. Probados en DEV con `rollback`: DEV quedó igual.
- `src/supabase/client.js`: un build sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ahora falla en vez de usar DEV en silencio (en `main` ya era así); `vite dev` sigue usando DEV.
- Prechequeo de producción (solo lectura): **no tiene historial de migraciones** (`0001`–`0014` se aplicaron a mano) → paso 5a del runbook con `migration repair` antes de `db push`. Su esquema coincide objeto por objeto con `0001`–`0014` (comparado con DEV). Peso en libras (promedio 171,4; ninguno menor a 90). La variante "Rol box" no entraba en E18 → regla ampliada y probada. `01_precheck.sql` ya no falla sin historial.
- VAPID de producción generada (la pública ya está en Vercel; la privada, en el gestor del dueño). Usuario `bridge@rokbox.co` creado en producción con contraseña al azar, guardada fuera de git; sin rol hasta el paso 8. Script de socios llenado fuera de git.
- F7.1 descartado por el dueño.

### 2026-10-28 — Claude Code
- Bug: al anular una tiquetera en Gestión → Miembros seguían la barra de clases y "Descontar clase", porque `void_renewal` solo anulaba el ingreso (D34-d). Arreglo D44, `0027_void_renewal_restores.sql`: la renovación guarda la membresía anterior y anularla la restaura. Tests SQL 99/99 (5 nuevos; sin la migración fallan 4), aplicada en DEV. El miembro de DEV con sus 3 renovaciones anuladas antes de `0027` (sin foto) se dejó "Sin plan" a mano, con sus 2 clases deshechas; sigue bloqueado y su vigencia en HCAC ya había terminado.
- Bug: con varias tiqueteras, anular una sin anularlas todas no restaba sus clases (0027 solo revertía si no quedaba una renovación activa posterior). Arreglo D45, `0028_void_renewal_replay.sql`: anular recalcula la membresía sin la renovación, reaplicando las posteriores y las clases. Tests SQL 102/102 (3 nuevos; sin la migración fallan los 3), aplicada en DEV, con tipos regenerados (sin cambios) y las 21 renovaciones de la app con su duración completada.

### 2026-10-27 — Claude Code
- Recordatorio de deuda por WhatsApp (D41): enlace `wa.me` con el mensaje listo y editable, registro de quién recordó y cuándo, celular editable desde la misma hoja y plantilla del box en Ajustes.
- Tests SQL: 78/78 (10 nuevos). Los tests ya no dependen de los nombres ni porcentajes de los socios ni del catálogo de DEV, que los socios empezaron a editar ("Socio Dos" → "Gabriel", productos reales): crean su propio plan, producto y categoría `ZZTEST` dentro de la transacción.
- E2E del recordatorio 20/20 (socio y coach, sin errores de red ni de consola): WhatsApp se abre con el número `57…` y el texto editado, el recordatorio queda registrado y la plantilla se guarda y se restaura.
- En Android se elige entre WhatsApp y WhatsApp Business, con opción de recordar la elección en el teléfono y "Cambiar de app". E2E ampliado: 30/30.
- Celulares sin indicativo: los colombianos de 10 dígitos ya funcionaban; ahora al corregir un número se elige el país y se guarda con su indicativo (venezolanos, ecuatorianos, etc.). Se corrigió que `+57` con 9 dígitos pasaba como válido. La lista distingue "Sin celular" de "Revisar celular". E2E: 34/34; 33 pruebas unitarias de normalización.
- Deudas agrupadas por persona: en Deudas, "Por persona" (por defecto) muestra una tarjeta por miembro con la suma de sus deudas del filtro, sus conceptos y, al desplegarla, cada deuda con "Ver ficha" y "Recordar por WhatsApp"; "Por deuda" conserva la lista anterior. La vista elegida se recuerda en el teléfono. E2E 15/15.
- Cuadre manual (D42, `0025_manual_settlements.sql`): selector "Datos de la app" / "Manual" en Nuevo cuadre, campos por socio, "Copiar de la app", aviso de entregas descuadradas y marca "Manual" en la lista, el detalle, el PDF y el Excel. El cálculo del cuadre se extrajo a `private.settlement_result` sin cambiar su resultado. Tests SQL 86/86 (8 nuevos, incluida la igualdad manual = calculado con los mismos datos). E2E 16/16.
- Cuadre manual → "Autocompletar" por socio: despeja el dato que falte (p. ej. los ingresos a partir de gastos BOX, personales y efectivo), lo marca como "calculado" y avisa si faltan datos o si el resultado sería negativo (`src/utils/settlementManual.js`, 10 pruebas unitarias). E2E del cuadre manual: 25/25.
- Checklist de verificación antes de producción en `docs/VERIFICACION.md` (F6.1, falta ejecutarlo).
- Arreglo: "Dar rol → Socio" no ofrecía opciones cuando todos los socios ya tenían cuenta (en DEV, Gabriel estaba asociado a la cuenta de prueba). Ahora lista todos los socios activos, avisa si el elegido ya tiene cuenta y la reemplaza (D43, `0026_partner_accounts.sql`). Tests SQL 94/94 (8 nuevos; los socios de prueba ya no dependen de qué cuenta tenga cada socio en DEV). E2E 16/16 con un socio temporal ZZTEST.
- Socios en DEV (configurados por el dueño): Gabriel (cuenta real de Gabriel), Ricardo, "Socio de prueba" (cuenta de prueba `socio2.dev`, la que usan los E2E) y "Socio de prueba 2" (sin cuenta); 33/33/33/1 %. Los tests SQL y el E2E del cuadre manual ya no suponen dos socios al 50 %: SQL 94/94; E2E Gestión, recordatorios 34/34, deudas 15/15, cuadre manual 24/24 y cuentas de socio 16/16.
- El bridge corre en modo continuo en el PC de desarrollo (venv creado en `rokbox-bridge/.venv`).

### 2026-10-23 (3) — Claude Code
- F5 completa. **Push probado de punta a punta en Chrome:** el atleta activó las notificaciones en Perfil (suscripción FCM real), un socio le cargó una deuda y el service worker mostró "Nuevo cargo en tu cuenta · Prueba push: $1.000". Al cerrar sesión la suscripción se borró.
- Tests SQL: 68/68 (8 nuevos de push). Se hicieron independientes de los datos de DEV 4 tests que asumían una base vacía (miembros importados de HCAC y datos del E2E).
- E2E de Gestión repetido sin regresiones.
- Las claves VAPID ya estaban en los secretos de DEV y coinciden con la pública del README. Producción necesitará los mismos pasos (PLAN F7.4).

### 2026-10-23 (2) — Claude Code
- F4 completa. **E2E con Chrome headless** contra DEV, con las cuentas de prueba (contraseñas temporales que se invalidan al terminar y sesión inyectada, sin Google): 23/23 pasos en verde y sin errores de red ni de consola. Cubre socio (todas las secciones, renovar, deuda, abono, bloquear/desbloquear, venta, caja, cuadre con pago y exportes PDF/Excel descargados), coach (no ve Caja/Cuadres/Ajustes ni Bloquear) y atleta (sin pestaña Gestión y `/manage` redirige).
- Hallazgos corregidos en el camino:
  - La campana no mostraba los avisos del sistema (cargos, abonos, renovaciones, vínculos): ahora muestra título y cuerpo y abre su enlace. Las notificaciones sin autor rompían la consulta de `athlete_directory` (`id=in.(null)`).
  - Los enlaces de los avisos (`/gestion/...`) redirigen a las rutas nuevas.
  - Si fallaba la carga de permisos, Gestión se quedaba en "Cargando": ahora ofrece reintentar.
  - El nuevo cuadre proponía empezar mañana si el último cerró hoy.
- Datos de prueba en DEV: renovaciones, deudas, ventas, movimientos de caja y cuadres hechos por el E2E (se pueden borrar con `db reset`).

### 2026-10-23 — Claude Code
- Arreglos tras la primera prueba del usuario en el preview:
  - Comunidad → Atletas salía vacía: `fetchSuggestions` recibía el id del usuario como nombre del box. Ahora muestra los del mismo box o los recientes.
  - El formulario de Perfil de la v2 no tenía nombre, apellidos, box, nacimiento, género, altura, experiencia ni objetivo (sí estaban en `main`). Se agregaron; un usuario sin perfil ve el formulario abierto y el box viene con "RöK BoX". `upsertProfile` ya no pierde los roles al crear el perfil.
  - Hallazgo E17: en producción `weight_kg` guarda libras. Queda como paso del ensayo F7.
- La variable de Vercel del preview funciona (el usuario inició sesión en DEV); es la clave anon en formato anterior.

### 2026-10-22 (5) — Claude Code
- F3 completa. Hallazgos:
  - La clave publicable de DEV en `client.js` y el README estaba obsoleta ("Invalid API key"); se actualizó. **Si Vercel tiene la clave vieja configurada como variable de entorno, el preview no conecta**: hay que actualizar `VITE_SUPABASE_ANON_KEY` allá.
  - `create_debt` enviaba un aviso por ítem; ahora envía uno solo con el total (test 60/60).
- DEV re-importado: 49 personas de HCAC más datos de prueba de "ZZTEST Atleta Dev" (renovación, deuda con 2 ítems, abono).
- No se hizo verificación visual en el navegador: el inicio de sesión es con Google. Queda para el usuario en el preview.

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
