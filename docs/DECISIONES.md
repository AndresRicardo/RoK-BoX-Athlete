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
