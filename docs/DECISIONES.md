# Decisiones del proyecto "RöK BoX Athlete como centro de gestión"

> Respuestas del dueño del proyecto (sesión de planificación del 2026-10-22).
> Cualquier cambio de diseño posterior se agrega al final como una nueva decisión, sin borrar las anteriores.

## Alcance y arquitectura

| ID | Tema | Decisión |
|---|---|---|
| D1 | Trabajo previo | El plan, el esquema y el bridge de `rokbox-platform` (fases F0–F5 de ese repo) los hizo el dueño del proyecto. Son la base de este plan. |
| D2 | App Android **RöK BoX Spent** | **Se retira.** Toda su funcionalidad (miembros, renovaciones, bloqueo de acceso, deudas, gastos, ingresos y cuadres) se reconstruye dentro de Athlete. |
| D3 | Esquema y bridge existentes | **Se reutilizan y se ajustan.** No se rediseña desde cero. |
| D25 | Repositorios | El bridge pasa a su propio repo privado **`rokbox-bridge`**. Las migraciones de Supabase viven en el repo **Athlete**, que ahora es el único cliente. `rokbox-platform` queda archivado como documentación histórica. |
| D29 | Base de la interfaz | Se construye sobre la **v2 de `develop`** (Tailwind, pestañas inferiores). Hay que verificar que no se perdió ninguna función respecto a `main`. |

## Membresías y HikCentral

| ID | Tema | Decisión |
|---|---|---|
| D4 | Dónde se renueva y bloquea | **En ambos lugares** (app y HikCentral), con sincronización bidireccional. |
| D5 | Renovación hecha directamente en HikCentral | El bridge la detecta y crea una **renovación "pendiente por registrar pago"**. Los socios reciben aviso y uno de ellos completa el monto, el medio de pago y quién recibió el dinero. |
| D14 | Deuda y acceso | La deuda es **solo informativa**: no bloquea la entrada. El bloqueo es manual y solo lo hace un socio. |
| D15 | Planes | Mensual, trimestral, semestral, anual, **tiquetera o clases sueltas** y **precios especiales** (descuentos, convenios). |
| D16 | Tiquetera | Las clases se descuentan **manualmente** desde la app. No se usa el conteo automático por huellero. |
| D20 | Vínculo atleta ↔ persona de HikCentral | El atleta escribe su cédula y **un socio o coach aprueba** la solicitud (ya implementado). |

## Roles

| ID | Tema | Decisión |
|---|---|---|
| D6 | Roles | **Socio**, **Coach** y **Atleta**. Todos conservan las funciones actuales de la app. El coach puede ver miembros, renovar, descontar clases, gestionar deudas y abonos y aprobar vínculos. No ve gastos, ingresos globales, cuadres ni configuración, y no puede bloquear el acceso. |
| D30 | Dinero cobrado por un coach | El coach elige **a qué socio le entrega** el dinero y queda como ingreso de ese socio. El coach nunca acumula saldo en el sistema. |
| D22 | Edición de movimientos entre socios | Cada socio edita o borra **solo sus propios** gastos e ingresos. Todos ven todo y cada cambio queda en un **historial de auditoría**. |

## Finanzas

| ID | Tema | Decisión |
|---|---|---|
| D7 | Fórmula del cuadre | **La misma de Spent** (`SettlementCalculator.kt`), incluido el fondo de reserva. Ver la fórmula en `PLAN.md §4.5`. |
| D8 | Efectivo en mano | La app **calcula lo esperado**, el socio **digita lo real** y se muestra la **diferencia** (faltante o sobrante). El cuadre usa el valor digitado. |
| D9 | Cuadre guardado | Es una **foto inmutable** del cálculo. Los movimientos del periodo **siguen editables** y el cuadre no se recalcula solo. |
| D10 | Turnos | **No se modelan.** Cada movimiento queda a nombre del socio que recibió o pagó el dinero. |
| D11 | Transferencias de atletas | Llegan a la **cuenta personal de un socio** y cuentan como dinero del box en su poder. No hay cuenta del box. |
| D12 | Qué genera deudas | Productos de tienda, implementos y otros cargos (clases sueltas, eventos, etc.). Las **mensualidades no se fían**. |
| D13 | Tienda | **Catálogo de precios** sin control de stock. El inventario queda para el futuro. |
| D17 | Datos históricos | **No se importa nada.** Las finanzas y las deudas arrancan limpias en producción. |
| D21 | Extras de caja | **Exportar a PDF y Excel** (cuadres y movimientos). Las fotos de recibos, los presupuestos y los gastos recurrentes quedan fuera del alcance. |

## Interfaz y notificaciones

| ID | Tema | Decisión |
|---|---|---|
| D18 | Notificaciones push | **Atleta:** membresía por vencer y pocas clases en la tiquetera; deuda cargada, abono registrado y recordatorio de saldo. **Socios:** pendientes (renovaciones hechas en HikCentral sin pago, vínculos por aprobar, bridge caído) y **resumen semanal**. |
| D19 | Navegación | Pestaña adicional **"Gestión"** en la barra inferior, visible solo para socios y coaches. |

## Entorno y entregas

| ID | Tema | Decisión |
|---|---|---|
| D23 | PC actual | Es el **PC de desarrollo**, con una copia de HCAC 2.4 para pruebas. El PC del box es otro. |
| D24 | Supabase de producción | Es otro proyecto **dentro de la misma organización**. La CLI de este PC hoy no lo lista y hay que resolver el acceso antes del paso a producción. |
| D26 | Salida a producción | **Todo junto**, en un único paso a producción. |
| D27 | Dónde vive el plan | En el repo Athlete (`docs/`). |
| D28 | Fecha objetivo | Sin fecha fija. |

## Decisiones posteriores

| ID | Fecha | Decisión |
|---|---|---|
| D31 | 2026-10-22 | **Plan aprobado.** P1 (bloqueo automático de la tiquetera en 0), P2 (horarios de push del plan) y P3 (reserva por defecto 0) se aceptan como se propusieron. **DEV se puede borrar y reestructurar por completo** para tener un entorno limpio. Las migraciones `0001`–`0014` se conservan como archivos porque producción ya las tiene aplicadas, pero DEV se recrea desde cero (`db reset --linked`). |
| D32 | 2026-10-22 | **El cuadre usa el efectivo ESPERADO, no el declarado** (precisa D8). Si se usara el declarado, el faltante de un socio lo absorbería el otro: por ejemplo, si A declara 50 cuando debería tener 100, B deja de recibir 50. Usar el esperado equivale a la validación de Spent (ingresos = gastos BOX + personales + efectivo). El declarado solo genera la alerta de diferencia; el socio la resuelve registrando el gasto o ingreso que falte. |
| D33 | 2026-10-22 | **Invitaciones por correo** (`role_invites`): un socio invita un email con un rol (y opcionalmente un socio), y al crear la cuenta o iniciar sesión se aplica sola. Así entran los socios y coaches reales en producción sin SQL manual. |
| D34 | 2026-10-22 | Reglas de membresía implementadas: (a) renovar **no desbloquea** un acceso bloqueado manualmente; (b) las clases restantes de una tiquetera vigente **se suman** al renovarla; (c) la vigencia termina a las 23:59:59 (hora Bogotá) del día que corresponda; renovar un plan vigente continúa desde su fin (22 de octubre → 22 de noviembre); (d) anular una renovación anula su ingreso pero **no** cambia la vigencia (se corrige con `set_membership_validity`); (e) no se puede anular una deuda con abonos activos. |
| D35 | 2026-10-22 | **El acceso en HikCentral se controla solo con la vigencia (`EndDate`).** El spike F2.1 mostró que el nivel de acceso "CrossFitters" no lista personas individuales y que `DisableStatus` está en 0 para todos. Por eso: bloquear (manual o tiquetera en 0) = `EndDate` en el momento del bloqueo; desbloquear = `EndDate` de vuelta al fin real de la membresía. Si alguien deja en HCAC una vigencia futura, la app lo toma como desbloqueo, y si además la extiende, como renovación pendiente de pago. En HCAC un bloqueado se ve como "vencido". |
| D36 | 2026-10-22 | **La app no crea personas en HikCentral.** La API Bumblebee rechazó todas las variantes de creación probadas (ErrorCode 253, 3053 y 2), y además una persona nueva igual tiene que enrolar su rostro o huella en HikCentral. Flujo: la persona se registra en HCAC con su cédula como `PersonCode`; el bridge la detecta y la vincula. Si el miembro ya existía en la app (creado o renovado antes), al vincularse se envía su vigencia a HCAC. En la app, un miembro sin `hik_person_id` aparece como "pendiente de registrar en HikCentral". |
| D37 | 2026-10-22 | HCAC entrega por la API los **nombres y teléfonos cifrados**. Con autorización del dueño, el bridge los descifra igual que el cliente web oficial de HCAC: la llave es el SHA-256 iterado de (contraseña + Challenge del login), y el cifrado es AES-CBC/PKCS7 con IV fijo. La llave cambia en cada sesión y no se guarda. |
| D38 | 2026-10-22 | **La cédula vive en el campo personalizado "Cc" de HCAC**, no en `PersonCode` (que HCAC genera solo). El bridge la lee del detalle de cada persona. Si "Cc" se llena después en HCAC, el bridge completa la cédula del miembro siempre que no choque con otra. 29 de las 50 personas actuales no tienen "Cc": se pueden completar en HCAC o desde la app. |
| D39 | 2026-10-23 | **Navegación de Gestión:** socios y coaches ven una 6.ª pestaña "Gestión"; Logros se queda en la barra (en 360 px cada ítem mide 60 px, por encima del mínimo táctil de 44 px). El coach ve Miembros, Deudas y Pendientes (solo vínculos) y no ve Bloquear, Fechas, Caja, Cuadres ni Ajustes. |
| D40 | 2026-10-23 | **Push:** se envían por push todos los avisos de la campana, incluidos los sociales (me gusta, comentarios, seguidores), y cada usuario apaga los que no quiera desde Perfil. Apagar un aviso del sistema lo quita también de la campana; en los sociales solo se apaga el push. La cola es `notifications.pushed_at` (sin tabla outbox aparte) y los avisos de más de un día no se envían. |
| D41 | 2026-10-27 | **Recordatorio de deuda por WhatsApp con enlace `wa.me`**, no con la API de WhatsApp Business: quien cobra (socio o coach) abre WhatsApp en su teléfono con un mensaje amable ya escrito (primer nombre, saldo total y una línea por deuda) y decide si lo envía. No requiere cuenta de Meta, plantillas aprobadas ni costo por mensaje. La app registra quién lo recordó y cuándo (`debt_reminders`), y la lista "Por recordar" excluye a quien ya recibió uno en los últimos 7 días. El texto base es del box (`app_settings`), lo editan los socios en Ajustes y se puede ajustar antes de cada envío. Celulares colombianos de 10 dígitos reciben el indicativo 57 (también se aceptan `57…`, `+57…` y `0057…` si el celular queda completo). Un número de otro país guardado sin indicativo no se adivina: al corregirlo se elige el país (Colombia por defecto), se quita el 0 nacional y se guarda como `+<indicativo> <número>`; los colombianos se siguen guardando en 10 dígitos. **En Android** se pregunta si enviar con WhatsApp o WhatsApp Business (enlace `intent://` con el paquete `com.whatsapp` o `com.whatsapp.w4b`, con `wa.me` de respaldo si la app no está instalada) y la elección se puede recordar en ese teléfono (`localStorage`); en iPhone y en el computador no hay forma confiable de elegir la app, así que se usa `wa.me`. |
| D42 | 2026-10-27 | **Cuadre manual:** al hacer un cuadre se puede elegir "Manual" y escribir a mano, por socio, los ingresos recibidos, gastos BOX, gastos personales, lo entregado y lo recibido de otros socios y el efectivo que tiene (opcional), más el periodo y la reserva. Sirve para periodos anteriores a la app o llevados en otro lado. El reparto usa la misma fórmula que el cuadre calculado (`private.settlement_result`, compartida) con los socios activos y sus porcentajes actuales; lo vacío cuenta como 0. Se guarda con `is_manual`, no se marca por movimientos modificados después y su Excel trae solo la hoja del cuadre. "Copiar de la app" llena los campos con lo registrado en el periodo como punto de partida. Si lo entregado entre socios no es igual a lo recibido, se avisa antes de guardar. **Autocompletar** (por socio): con efectivo = ingresos − gastos BOX − gastos personales − entregado + recibido se despeja el único dato vacío entre ingresos, gastos BOX, gastos personales y efectivo que tiene (entregado y recibido vacíos = 0; un 0 escrito cuenta como dato). Si faltan dos o más, avisa cuáles; si el resultado sería negativo, avisa y no llena nada. |
| D43 | 2026-10-27 | **Cuenta de cada socio:** "Dar rol → Socio" y las invitaciones ofrecen todos los socios activos, también los que ya tienen cuenta. Si el elegido ya tenía otra, la app avisa a quién; al confirmar, la cuenta nueva queda como ese socio y **la anterior pierde el rol de socio** (conserva sus otros roles). Los movimientos, la caja y los cuadres están a nombre del socio, no de la cuenta, así que no cambian. Nadie puede pasar su propio socio a otra cuenta (evita quedarse sin acceso): se lo pide al otro socio. Quitar el rol de socio deja su socio libre. Motivo: en DEV los dos socios estaban asociados (uno a la cuenta de prueba) y la lista salía vacía. |
| D44 | 2026-10-28 | **Anular una renovación revierte la membresía** (reemplaza D34-d). Motivo: al anular una tiquetera seguían la barra de clases y "Descontar clase", y "Fechas" no puede quitar el paquete. Cada renovación guarda cómo estaba la membresía antes (`prev_membership`). Si al anular no queda ninguna renovación activa posterior, la membresía vuelve al estado anterior a las renovaciones anuladas del final, así que se pueden anular en cualquier orden. Las clases descontadas después cuentan en la tiquetera restaurada hasta donde quepan y las demás se deshacen. El bloqueo manual no cambia y HikCentral recibe la vigencia restaurada; si no había membresía, se cierra el acceso. Si hay una renovación activa posterior, o la anulada no tiene foto (hecha en HikCentral o antes de `0027`), solo se anula el ingreso, como antes. |
| D45 | 2026-10-28 | **Anular una renovación intermedia la quita de la membresía** (amplía D44). Motivo: con dos o más tiqueteras, anular una que no fuera la última dejaba sus clases sumadas. Ahora se recalcula la membresía sin la anulada: se parte del estado anterior a ella y se vuelven a aplicar, en orden, las renovaciones activas posteriores (con las reglas de renovar: continúa desde el fin si sigue vigente y suma las clases restantes) y las clases descontadas, que cuentan mientras quepan en la tiquetera de ese momento. Aplica también a los planes por periodo: anular un mes intermedio acorta la vigencia. Las fechas corregidas a mano después de la anulada se pierden y se rehacen con "Fechas"; el periodo registrado en las renovaciones posteriores no cambia. Cada renovación guarda la duración de su plan (`0028`). Si hay una renovación activa posterior hecha en HikCentral, solo se anula el ingreso. |
| D46 | 2026-10-29 | **Arranque en producción desde cero** (precisa D17). No se importa nada de Spent: (1) las deudas abiertas se ingresan a mano en la app; (2) las tiqueteras vigentes también se crean a mano; (3) la caja, los movimientos y los cuadres empiezan en cero el día del paso; (4) cada atleta pide su vinculación con su cédula y un socio o coach la aprueba (D20), sin vinculación sugerida. Los miembros y sus vigencias llegan de HikCentral con la importación del bridge. Pasos en `docs/RUNBOOK_PRODUCCION.md`. |
