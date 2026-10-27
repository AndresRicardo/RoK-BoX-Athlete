# Progreso: Athlete como centro de gestión

| Campo | Valor |
|---|---|
| **Plan** | ✅ **APROBADO** (2026-10-22) |
| **Fase actual** | F6 — Verificación integral en DEV |
| **Próximo paso** | F6.1: checklist completo de pruebas de toda la app (`docs/VERIFICACION.md`) |
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
- [ ] F6.1 Checklist E2E (`VERIFICACION.md`)
- [x] Extra (pedido del dueño): recordatorio de deuda por WhatsApp (D41, `0024_debt_reminders.sql`). Deudas → "Recordar por WhatsApp" (lista "Por recordar" / "Todos" / "Sin celular" con "Siguiente" para recorrer la lista), botón "Recordar" en la ficha del miembro y Ajustes → "Mensaje de cobro por WhatsApp"
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

### 2026-10-27 — Claude Code
- Recordatorio de deuda por WhatsApp (D41): enlace `wa.me` con el mensaje listo y editable, registro de quién recordó y cuándo, celular editable desde la misma hoja y plantilla del box en Ajustes.
- Tests SQL: 78/78 (10 nuevos). Los tests ya no dependen de los nombres ni porcentajes de los socios ni del catálogo de DEV, que los socios empezaron a editar ("Socio Dos" → "Gabriel", productos reales): crean su propio plan, producto y categoría `ZZTEST` dentro de la transacción.
- E2E del recordatorio 20/20 (socio y coach, sin errores de red ni de consola): WhatsApp se abre con el número `57…` y el texto editado, el recordatorio queda registrado y la plantilla se guarda y se restaura.
- En Android se elige entre WhatsApp y WhatsApp Business, con opción de recordar la elección en el teléfono y "Cambiar de app". E2E ampliado: 30/30.
- Celulares sin indicativo: los colombianos de 10 dígitos ya funcionaban; ahora al corregir un número se elige el país y se guarda con su indicativo (venezolanos, ecuatorianos, etc.). Se corrigió que `+57` con 9 dígitos pasaba como válido. La lista distingue "Sin celular" de "Revisar celular". E2E: 34/34; 33 pruebas unitarias de normalización.
- Deudas agrupadas por persona: en Deudas, "Por persona" (por defecto) muestra una tarjeta por miembro con la suma de sus deudas del filtro, sus conceptos y, al desplegarla, cada deuda con "Ver ficha" y "Recordar por WhatsApp"; "Por deuda" conserva la lista anterior. La vista elegida se recuerda en el teléfono. E2E 15/15.
- Cuadre manual (D42, `0025_manual_settlements.sql`): selector "Datos de la app" / "Manual" en Nuevo cuadre, campos por socio, "Copiar de la app", aviso de entregas descuadradas y marca "Manual" en la lista, el detalle, el PDF y el Excel. El cálculo del cuadre se extrajo a `private.settlement_result` sin cambiar su resultado. Tests SQL 86/86 (8 nuevos, incluida la igualdad manual = calculado con los mismos datos). E2E 16/16.
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
