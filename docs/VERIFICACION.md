# Verificación antes de producción (F6)

Lista de pruebas que debe pasar la app antes del paso a producción (F7 y F8 en [`PLAN.md`](PLAN.md)).

## Cómo usar esta lista

- **Dónde se prueba:** en el preview de Vercel (rama `develop`, Supabase DEV), con el HikCentral del PC de desarrollo. Con HikCentral solo se usan personas `ZZTEST`.
- **Quiénes prueban:**
  - **S1** y **S2**: los dos socios, cada uno con su cuenta.
  - **C**: una cuenta con rol coach.
  - **A**: una cuenta de atleta vinculada a un miembro `ZZTEST`.
  - **N**: una cuenta nueva sin rol.
- **Equipos:** al menos un Android y un iPhone (iOS 16.4 o superior), con la app instalada en la pantalla de inicio. Además, un computador para HikCentral.
- **Marcas:** `[x]` pasó · `[!]` falló (anotar el ID y qué pasó en la tabla de hallazgos) · `[-]` no aplica.
- **Columna "Auto":** ✅ indica que la prueba ya está cubierta por los tests automáticos (SQL o E2E). Igual se repite en un teléfono real, porque los automáticos no usan Google, WhatsApp, push real ni la puerta.
- **Cuadres de dinero:** se comprueban con una calculadora o una hoja aparte, no con la misma app.

---

## 0. Antes de empezar

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 0.1 | `npm run build` en `develop` | Compila sin errores | ✅ | [ ] |
| 0.2 | Tests SQL (`supabase/tests/management_test.sql`) | 94/94 en verde | ✅ | [ ] |
| 0.3 | Pruebas E2E en Chrome (Gestión, recordatorio por WhatsApp, deudas por persona y cuadre manual) y unitarias (celulares y autocompletar) | Todas en verde. **Ojo:** hoy esos scripts viven fuera del repo; antes de producción hay que traerlos a `tests/` para poder repetirlos | ✅ | [ ] |
| 0.4 | El preview de Vercel abre y muestra la versión del último commit de `develop` | Carga sin pantalla en blanco | | [ ] |
| 0.5 | El bridge corre en modo continuo en el PC de desarrollo | Ajustes → Estado del bridge muestra "Última señal" de hace menos de 5 min | | [ ] |
| 0.6 | Existen las cuentas S1, S2, C, A y N, y un miembro `ZZTEST` en HikCentral con rostro o huella | Listas para usar | | [ ] |

## 1. Inicio de sesión, instalación y roles

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 1.1 | Entrar con Google desde Android y desde iPhone | Entra y queda la sesión iniciada al cerrar y volver a abrir la app | | [ ] |
| 1.2 | Instalar la app en la pantalla de inicio (Android: "Instalar"; iPhone: Compartir → "Agregar a inicio") | Abre a pantalla completa, con ícono y nombre de RöK BoX | | [ ] |
| 1.3 | Cerrar sesión | Vuelve al login; al entrar con otra cuenta no se ven datos de la anterior (campana, líderes, gestión) | | [ ] |
| 1.4 | S1 invita por email a la cuenta N como coach (Ajustes → Roles e invitaciones) | La invitación aparece en la lista | | [ ] |
| 1.5 | N inicia sesión | Ya tiene rol coach y ve la pestaña Gestión, sin que nadie haga nada más | ✅ | [ ] |
| 1.6 | S1 le quita el rol a N | N vuelve a ser atleta y deja de ver Gestión al recargar | | [ ] |
| 1.6b | S1 da el rol de socio a una cuenta que ya usa la app, eligiendo un socio que ya tiene otra cuenta | Avisa a qué cuenta está asociado; al confirmar, la nueva queda como ese socio y la anterior deja de ser socio. Su caja y sus cuadres no cambian. El socio propio sale deshabilitado ("eres tú") | ✅ | [ ] |
| 1.7 | Pestañas del atleta (A) | 5 pestañas, sin Gestión; escribir `/manage` en la dirección lo devuelve al inicio | ✅ | [ ] |
| 1.8 | Pestañas del coach (C) | Ve Gestión con Miembros, Deudas y Pendientes; no ve Caja, Cuadres ni Ajustes | ✅ | [ ] |
| 1.9 | El coach intenta abrir `/manage/cash`, `/manage/settlements` y `/manage/settings` escribiendo la dirección | No le deja entrar | ✅ | [ ] |
| 1.10 | Pestañas del socio (S1) | Ve todas las secciones de Gestión | ✅ | [ ] |
| 1.11 | En un teléfono de 360 px de ancho | Las 6 pestañas se tocan sin error y ningún texto se sale de la pantalla | | [ ] |

## 2. Experiencia del atleta (lo que ya existía en producción)

> Lo más importante: **nada de lo que hoy usan los atletas puede perderse ni dañarse.**

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 2.1 | Inicio (Dashboard): PRs, benchmark, líderes y Top Box | Cargan con datos reales, sin valores vacíos | | [ ] |
| 2.2 | Entrenamiento: registrar un PR nuevo y editarlo | Queda guardado y aparece en el historial y en la gráfica | | [ ] |
| 2.3 | Entrenamiento: registrar un WOD o benchmark nuevo | Queda guardado con su scaling | | [ ] |
| 2.4 | Comunidad → Feed: dar me gusta, comentar, borrar el comentario y "cargar más" | Funciona; el comentario borrado desaparece | | [ ] |
| 2.5 | Comunidad → Líderes: Global y Siguiendo, filtros y "ver más" | Muestra valores correctos | | [ ] |
| 2.6 | Comunidad → Atletas: buscar a alguien, abrir su perfil, seguirlo y dejar de seguirlo | El botón cambia y la lista de seguidos se actualiza | | [ ] |
| 2.7 | Logros: abrir una medalla | Muestra el detalle | | [ ] |
| 2.8 | Perfil: editar nombre, peso, altura, categoría y objetivo | Se guarda; el peso se muestra en kg | | [ ] |
| 2.9 | Perfil: escribir la cédula para vincularse con su persona de HikCentral | Queda "pendiente de aprobación"; después de aprobada, la cédula ya no se puede cambiar | ✅ | [ ] |
| 2.10 | Tarjeta de membresía del atleta vinculado | Muestra plan, días o clases restantes y estado de acceso, iguales a lo que dice HikCentral | ✅ | [ ] |
| 2.11 | Deudas del atleta | Ve solo sus deudas, con detalle e historial de abonos | ✅ | [ ] |
| 2.12 | Historial de pagos (Perfil) | Ve sus renovaciones pagadas | ✅ | [ ] |
| 2.13 | Campana de notificaciones: abrir un aviso y "marcar todas como leídas" | Abre la pantalla correcta y el contador queda en 0 | ✅ | [ ] |

## 3. Privacidad y permisos (RLS)

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 3.1 | El atleta A busca datos de otra persona (deudas, membresía, pagos) | Nunca ve datos ajenos | ✅ | [ ] |
| 3.2 | El atleta A no ve finanzas | No hay forma de ver caja, gastos, ingresos ni cuadres | ✅ | [ ] |
| 3.3 | El coach no ve caja, gastos, ingresos ni cuadres | Correcto | ✅ | [ ] |
| 3.4 | El coach no puede bloquear ni corregir fechas | No aparecen los botones Bloquear y Fechas en la ficha | ✅ | [ ] |
| 3.5 | S2 intenta editar o borrar un gasto o ingreso de S1 | No puede: solo ve los suyos como editables | ✅ | [ ] |
| 3.6 | Sin sesión (ventana privada) | Solo se ve el login | ✅ | [ ] |

## 4. Miembros y membresías

Hacer con un miembro `ZZTEST`.

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 4.1 | Lista de miembros: buscar por nombre y por cédula, y filtrar por estado (activos, por vencer, vencidos, bloqueados) | Los resultados coinciden con el filtro | ✅ | [ ] |
| 4.2 | Crear un miembro nuevo desde la app | Aparece en la lista con "aún no registrado en el huellero" | ✅ | [ ] |
| 4.3 | Editar nombre, teléfono y cédula de un miembro | Se guarda; una cédula repetida da un error claro | | [ ] |
| 4.4 | Renovar un plan **vencido** con precio de lista | La vigencia empieza hoy y termina a las 23:59 del día que corresponde | ✅ | [ ] |
| 4.5 | Renovar un plan **vigente** | La nueva vigencia continúa desde la fecha de fin actual (por ejemplo, 22 oct → 22 nov) | ✅ | [ ] |
| 4.6 | Renovar con descuento y motivo, eligiendo medio de pago y el socio que recibe | El ingreso queda en la caja de ese socio por el valor con descuento | ✅ | [ ] |
| 4.7 | **El coach** renueva y elige a qué socio le entrega el dinero | El ingreso queda en la caja de ese socio, no del coach | ✅ | [ ] |
| 4.8 | Anular una renovación | La vigencia vuelve a la anterior y su ingreso se anula en la caja | ✅ | [ ] |
| 4.9 | Tiquetera: vender una de N clases, descontar una clase y deshacer el descuento | El contador baja y vuelve a subir | ✅ | [ ] |
| 4.10 | Tiquetera: descontar hasta 0 clases | Estado "sin clases" y se bloquea el acceso en HikCentral (P1) | ✅ | [ ] |
| 4.11 | Renovar una tiquetera vigente que aún tiene clases | Las clases restantes se suman a las nuevas | ✅ | [ ] |
| 4.12 | Bloquear el acceso (solo socio) | El estado cambia a "Enviando el cambio al torniquete…" y luego queda bloqueado | ✅ | [ ] |
| 4.13 | Renovar a alguien bloqueado | Sigue bloqueado: renovar no desbloquea (D34) | ✅ | [ ] |
| 4.14 | Desbloquear | La vigencia vuelve al fin real de la membresía | ✅ | [ ] |
| 4.15 | Corregir fechas de vigencia (solo socio) | Se guardan y se envían a HikCentral | | [ ] |
| 4.16 | Planes en Ajustes: crear, cambiar el precio y archivar un plan | El archivado ya no aparece al renovar | | [ ] |

## 5. Sincronización con HikCentral y la puerta

> Solo con personas `ZZTEST` en el HikCentral del PC de desarrollo. En lo posible, **probar la puerta o el terminal facial de verdad**.

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 5.1 | Renovar en la app | En menos de 5 min la fecha de fin cambia en HikCentral | ✅ | [ ] |
| 5.2 | Con la membresía vigente, pasar por el terminal | Abre | | [ ] |
| 5.3 | Bloquear en la app y pasar por el terminal | No abre | | [ ] |
| 5.4 | Desbloquear en la app y pasar por el terminal | Vuelve a abrir | | [ ] |
| 5.5 | Extender la vigencia directamente en HikCentral | En la app aparece en Pendientes → "Renovaciones de HikCentral sin pago" y los socios reciben aviso | ✅ | [ ] |
| 5.6 | Registrar el pago de esa renovación pendiente | Desaparece de Pendientes y el ingreso queda en la caja del socio elegido | ✅ | [ ] |
| 5.7 | Anular una renovación pendiente de HikCentral | Desaparece de Pendientes, sin ingreso | | [ ] |
| 5.8 | Registrar una persona nueva en HikCentral con su cédula en el campo "Cc" | En menos de 5 min aparece como miembro en la app | ✅ | [ ] |
| 5.9 | Si el miembro ya existía en la app con la misma cédula | Se vincula al existente y no se duplica | ✅ | [ ] |
| 5.10 | Eliminar una persona `ZZTEST` en HikCentral | En la app queda "Inactivo (eliminado en HikCentral)", no se borra | ✅ | [ ] |
| 5.11 | Después de un cambio hecho desde la app, esperar dos lecturas del bridge | No aparecen cambios ni pendientes "fantasma" | ✅ | [ ] |
| 5.12 | Apagar el bridge más de 30 min | Los socios reciben "bridge sin señal" y la app lo muestra en Gestión | | [ ] |
| 5.13 | Hacer un cambio con el bridge apagado y luego encenderlo | El cambio queda en cola y se aplica al volver | | [ ] |
| 5.14 | Un comando que falla (por ejemplo, persona borrada en HikCentral) | Aparece en Pendientes → "Cambios que no llegaron a HikCentral" | | [ ] |
| 5.15 | Ajustes → Estado del bridge | Muestra la última señal, la versión, las personas en HikCentral y los últimos comandos | ✅ | [ ] |

## 6. Deudas, ventas y cobro por WhatsApp

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 6.1 | Crear una deuda con 2 productos del catálogo y 1 ítem libre, marcando uno "por entregar" | El total es la suma correcta y el atleta recibe el aviso | ✅ | [ ] |
| 6.2 | Abono parcial eligiendo medio de pago y socio que recibe | El saldo baja y el ingreso aparece en la caja de ese socio | ✅ | [ ] |
| 6.3 | Abonar más del saldo | No lo permite | ✅ | [ ] |
| 6.4 | Pagar el saldo completo | La deuda pasa a pagada | ✅ | [ ] |
| 6.5 | Anular una deuda con motivo | Desaparece de "Con saldo"; queda en la auditoría | ✅ | [ ] |
| 6.6 | Venta de contado | Crea el ingreso del socio sin crear deuda | ✅ | [ ] |
| 6.7 | Vista "Por persona": alguien con varias deudas | Una sola tarjeta con la suma; al abrirla, cada deuda con "Ver ficha" y "Recordar por WhatsApp" | ✅ | [ ] |
| 6.8 | Vista "Por deuda" y volver a abrir la app | Recuerda la vista elegida | ✅ | [ ] |
| 6.9 | Recordar por WhatsApp desde **Android** con WhatsApp y Business instalados | Pregunta qué app usar; con "Recordar mi elección" ya no vuelve a preguntar; "Cambiar de app" funciona | ✅ | [ ] |
| 6.10 | Recordar por WhatsApp desde **iPhone** | Abre WhatsApp con el número y el mensaje listos | | [ ] |
| 6.11 | El mensaje llega al chat correcto (probar con el celular de uno de los socios) | Nombre, total y detalle correctos; el mensaje editado es el que se envía | ✅ | [ ] |
| 6.12 | Celular guardado sin indicativo (10 dígitos que empiezan por 3) | Abre WhatsApp con el 57 | ✅ | [ ] |
| 6.13 | Celular extranjero: corregirlo eligiendo el país | Se guarda con su indicativo y abre bien | ✅ | [ ] |
| 6.14 | Celular inválido o vacío | Aparece en "Sin celular válido" y no deja abrir WhatsApp hasta corregirlo | ✅ | [ ] |
| 6.15 | Recorrer la lista "Por recordar" con "Siguiente" | Quien ya fue recordado sale de "Por recordar" por 7 días y se ve quién y cuándo | ✅ | [ ] |
| 6.16 | Ajustes → Mensaje de cobro: cambiar la plantilla y luego "Restaurar original" | La vista previa y los mensajes siguientes usan la plantilla | ✅ | [ ] |
| 6.17 | Catálogo en Ajustes: crear, cambiar el precio y desactivar un producto | Ya no aparece al crear deudas; las deudas viejas conservan su precio | | [ ] |

## 7. Caja de cada socio

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 7.1 | S1 registra un gasto BOX y otro PERSONAL, con categoría y medio de pago | Aparecen en su caja del mes | ✅ | [ ] |
| 7.2 | S1 registra un ingreso manual | Aparece en su caja | ✅ | [ ] |
| 7.3 | S1 registra una entrega a S2 | En la caja de S1 resta y en la de S2 suma | ✅ | [ ] |
| 7.4 | Comparar el "efectivo esperado en su poder" con una calculadora | Ingresos − gastos BOX − personales − entregado + recibido | ✅ | [ ] |
| 7.5 | S1 edita y borra su propio gasto | Funciona y queda en la auditoría | ✅ | [ ] |
| 7.6 | S1 mira la caja de S2 | La ve, pero sin poder editar | ✅ | [ ] |
| 7.7 | Los ingresos automáticos (renovaciones y abonos) | No se editan desde la caja, solo desde su origen | ✅ | [ ] |
| 7.8 | Cambiar de mes | Muestra solo los movimientos de ese mes | | [ ] |
| 7.9 | Categorías de gasto en Ajustes: crear y desactivar | La desactivada ya no aparece al registrar gastos | | [ ] |

## 8. Cuadres

> **Esta es la prueba más importante de dinero.** Hacer un mes completo con movimientos inventados y calcular el resultado a mano en una hoja antes de mirar la app.

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 8.1 | Ajustes → Socios: dejar los porcentajes en un total distinto de 100 % e intentar un cuadre | Ajustes lo marca en rojo y el cuadre no se puede calcular; con 100 % sí | ✅ | [ ] |
| 8.2 | Cuadre con datos de la app, con fondo de reserva | Utilidad, parte de cada socio y transferencias **iguales a la hoja hecha a mano** | ✅ | [ ] |
| 8.3 | Escribir el efectivo que tiene cada socio | Muestra faltante o sobrante; el reparto **no cambia** (usa el esperado, D32) | ✅ | [ ] |
| 8.4 | Guardar el cuadre y marcar la transferencia como pagada | Queda marcada | ✅ | [ ] |
| 8.5 | Editar un movimiento del periodo después de guardar | El cuadre avisa "movimientos modificados después del cuadre" y no se recalcula solo | ✅ | [ ] |
| 8.6 | Nuevo cuadre después de uno guardado | Propone empezar el día siguiente al cierre del anterior | ✅ | [ ] |
| 8.7 | Cuadre **manual**: escribir todos los datos a mano | Mismo resultado que la hoja hecha a mano; lleva la marca "Manual" | ✅ | [ ] |
| 8.8 | Cuadre manual → "Copiar de la app" | Llena los campos con lo registrado en el periodo | ✅ | [ ] |
| 8.9 | Cuadre manual → "Autocompletar" con un dato vacío | Lo calcula y lo marca "calculado"; con 2 vacíos avisa cuáles faltan | ✅ | [ ] |
| 8.10 | Cuadre manual con entregas que no cuadran (S1 entregó 100, S2 recibió 80) | Avisa antes de guardar | ✅ | [ ] |
| 8.11 | Exportar a PDF desde Android y desde iPhone | Se descarga o comparte y se lee bien | ✅ | [ ] |
| 8.12 | Exportar a Excel y abrirlo en el teléfono y en el computador | Las hojas Cuadre y Movimientos con los valores correctos (el manual solo trae Cuadre) | ✅ | [ ] |
| 8.13 | Eliminar un cuadre | Desaparece del historial; los movimientos no se tocan | ✅ | [ ] |

## 9. Notificaciones push

> En iPhone solo funcionan con la app **instalada** en la pantalla de inicio (iOS 16.4 o superior).

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 9.1 | Perfil → Notificaciones → activar, en Android y en iPhone | El teléfono pide permiso y queda activado | | [ ] |
| 9.2 | Cargarle una deuda al atleta A | A recibe el push con el monto; al tocarlo abre la app en su deuda | ✅ | [ ] |
| 9.3 | Registrar un abono | A recibe el push del abono | | [ ] |
| 9.4 | Atleta pide vínculo de cédula | Socios y coach reciben el push | | [ ] |
| 9.5 | Renovación hecha en HikCentral (5.5) | Los socios reciben el push | | [ ] |
| 9.6 | Membresía que vence en 3 días (esperar a las 8:00) | El atleta recibe el aviso | | [ ] |
| 9.7 | Tiquetera con 2 clases o menos | El atleta recibe el aviso al descontar | | [ ] |
| 9.8 | Lunes: resumen semanal (7:00) y recordatorio de saldo (9:00) | Llegan a quien corresponde | | [ ] |
| 9.9 | Apagar un tipo de aviso en Perfil | Ese tipo deja de llegar | | [ ] |
| 9.10 | Cerrar sesión en un teléfono | Ese teléfono deja de recibir los avisos de esa cuenta | ✅ | [ ] |
| 9.11 | Me gusta, comentario y nuevo seguidor | Llegan por push (D40) | | [ ] |

## 10. Pendientes y auditoría

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 10.1 | Aprobar y rechazar una solicitud de vínculo (socio y coach) | La aprobada vincula al atleta con su miembro; la rechazada le muestra el motivo | ✅ | [ ] |
| 10.2 | Inicio de Gestión | Las tarjetas (por vencer, pendientes, estado del bridge) cuadran con cada sección | | [ ] |
| 10.3 | Ajustes → Auditoría | Quedaron registrados quién y cuándo de las pruebas anteriores (renovar, anular, gastos, cuadres, roles, plantilla) | ✅ | [ ] |

## 11. Uso real y condiciones difíciles

| ID | Prueba | Esperado | Auto | ✔ |
|---|---|---|---|---|
| 11.1 | Semana de uso real (F6.2): los dos socios registran en la app todo lo que pase en el box, en paralelo con su forma actual | Al final de la semana, el cuadre de la app coincide con el de Spent o la libreta | | [ ] |
| 11.2 | Los dos socios editan a la vez (por ejemplo, los dos abonan a la misma deuda) | No se duplica ni se pierde nada | | [ ] |
| 11.3 | Usar la app con datos móviles lentos | Muestra "cargando" y no se queda en blanco | | [ ] |
| 11.4 | Sin internet: abrir la app y tratar de guardar algo | Muestra un error claro y no pierde lo escrito sin avisar | | [ ] |
| 11.5 | Tocar dos veces seguidas "Guardar" o "Renovar" | No crea registros duplicados | | [ ] |
| 11.6 | Publicar una versión nueva en el preview con la app instalada abierta | Al reabrirla toma la versión nueva | | [ ] |
| 11.7 | Modo claro y oscuro del teléfono, letra grande del sistema | Todo se lee y ningún botón queda tapado | | [ ] |

---

## 12. Ensayo del paso a producción (F7)

Se hace sobre una **copia** de producción, no sobre producción.

| ID | Prueba | Esperado | ✔ |
|---|---|---|---|
| 12.1 | Restaurar el backup de producción en un entorno temporal y aplicar las migraciones 0015–0025 | Se aplican sin errores | [ ] |
| 12.2 | Tests SQL contra el ensayo | Todos en verde | [ ] |
| 12.3 | Contar perfiles, PRs, benchmarks, publicaciones, comentarios y seguidores antes y después | Los mismos números | [ ] |
| 12.4 | Peso de los perfiles convertido de libras a kg (E17) | Un atleta conocido muestra su peso real en kg | [ ] |
| 12.5 | Box unificado como "RöK BoX" (E18) | Sin variantes del nombre | [ ] |
| 12.6 | Un build de la app apuntando al ensayo: entrar con cuentas reales y revisar la sección 2 | Los atletas ven exactamente lo mismo que hoy | [ ] |
| 12.7 | Push configurado en el ensayo (VAPID, `send-push`, secreto) | Llega un push de prueba | [ ] |
| 12.8 | Runbook y plan de reversa escritos y leídos por los dos socios | Ambos saben qué hacer si algo falla | [ ] |
| 12.9 | Probar la reversa: volver `main` a la versión anterior en Vercel | La app vieja funciona contra la base | [ ] |

## 13. El día del paso a producción (F8)

Pruebas rápidas justo después de publicar.

| ID | Prueba | Esperado | ✔ |
|---|---|---|---|
| 13.1 | Backup del día tomado y descargado **antes** de tocar nada | Archivo guardado fuera del PC | [ ] |
| 13.2 | Los dos socios entran y tienen rol de socio | Ven Gestión completa | [ ] |
| 13.3 | Un atleta real entra | Ve sus PRs, feed y perfil como antes | [ ] |
| 13.4 | Configuración cargada: socios y %, planes y precios, catálogo, categorías | Todo correcto | [ ] |
| 13.5 | Bridge en el PC del box: `--import --dry-run`, revisar el reporte, importar y dejarlo en modo continuo como servicio | Las personas de HikCentral aparecen en Miembros; "Última señal" al día | [ ] |
| 13.6 | Reiniciar el PC del box | El bridge vuelve a arrancar solo | [ ] |
| 13.7 | Una renovación real de punta a punta (app → HikCentral → puerta) | Abre la puerta | [ ] |
| 13.8 | Una deuda y un abono reales | Llegan la notificación y el ingreso a la caja | [ ] |
| 13.9 | Activar el push en los teléfonos de los socios | Llega un aviso de prueba | [ ] |
| 13.10 | Primera semana: revisar a diario Pendientes, el estado del bridge y los comandos fallidos | Sin sorpresas | [ ] |

---

## Hallazgos

| ID de la prueba | Fecha | Quién | Qué pasó | Estado |
|---|---|---|---|---|
| | | | | |
