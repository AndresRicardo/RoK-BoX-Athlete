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
