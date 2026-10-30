# Runbook: paso a producción

> F7.2 y F8 del plan. Decisiones de arranque: D17 y **D46** (todo empieza desde cero, deudas y
> tiqueteras se cargan a mano y cada atleta pide su vinculación).
> Producción es sagrada (AGENTS.md §4): nada de esto se corre sin orden explícita del dueño.

## 0. Qué pasa con los datos reales

- Las migraciones `0015`–`0028` **solo agregan** objetos (tablas, funciones, vistas, trabajos
  programados). No borran ni reescriben perfiles, PRs, benchmarks, logros, seguidores, feed ni
  notificaciones. `0020` amplía `notifications` y `0022` ajusta permisos de objetos de `0001`–`0014`.
- Hay dos correcciones de datos (`02_data_fixes.sql`): el peso pasa de libras a kilos (E17) y las
  variantes del nombre del box quedan como "RöK BoX" (E18).
- La gestión arranca vacía: sin miembros (llegan con la importación del bridge), sin dinero, sin
  deudas ni cuadres.
- El seed (`supabase/seed.sql`) **no** se aplica: `db push` no lo corre.

## 1. Requisitos (antes del día)

| # | Qué | Quién | Cómo se verifica |
|---|---|---|---|
| R1 | La CLI ve el proyecto de producción (`mlnyugtczbugyykvaxim`, misma cuenta que DEV) | Dueño: `supabase login` en una terminal propia (no funciona dentro del agente) | `supabase projects list` muestra los dos proyectos. **Hecho el 2026-10-29** |
| R2 | Docker Desktop abierto (lo usa `supabase db dump`) | Dueño | `docker info` sin errores |
| R3 | Variables de **Production** en Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (de producción) y `VITE_VAPID_PUBLIC_KEY` | Dueño (Vercel → Settings → Environment Variables) | Desde este cambio, un build sin las dos primeras falla en vez de apuntar a DEV |
| R4 | Claves VAPID de producción: par nuevo (`npx web-push generate-vapid-keys`; la privada de DEV no se puede leer) | Dueño + agente | La pública coincide con `VITE_VAPID_PUBLIC_KEY`. **Hecho el 2026-10-29**: la privada está en el gestor de contraseñas del dueño |
| R5 | Datos de los socios: nombre, porcentaje (suman 100) y correo Google de cada uno | Dueño | — |
| R6 | Usuario bridge de producción `bridge@rokbox.co` (la contraseña **no** va a git ni al chat; solo al `.env` del PC del box) | Agente (Admin API, contraseña al azar) | **Creado el 2026-10-29**, sin rol hasta el paso 8 |
| R7 | Acceso al PC del box (Windows 10), con Python, el repo `rokbox-bridge` y las credenciales de HCAC | Dueño | — |
| R8 | Auth de producción: en Supabase → Authentication → URL Configuration, el dominio de producción en Site URL y Redirect URLs (ya debería estar, porque `main` usa Google) | Dueño | Iniciar sesión en producción después del paso |
| R9 | Ventana acordada de baja actividad (unos 60 min) y aviso a los atletas | Socios | — |

## 2. Prechequeo (sin cambios; puede ser el día anterior)

```bash
supabase link --project-ref <REF_PRODUCCION>
supabase db query --linked -f supabase/scripts/prod/01_precheck.sql   # guardar el resultado
supabase migration list --linked
supabase link --project-ref qsqrnfgcozvznkbdyozs                       # volver a DEV
```

Resultado del 2026-10-29: producción **no tiene historial** (`0001`–`0014` se aplicaron a mano) y su
esquema coincide con `0001`–`0014` (comparado objeto por objeto con DEV). Peso en libras (promedio
171,4; ninguno menor a 90). Variantes de `box_name`: "Rok Box", "Rok box", "Rol box", "RÖK BOX",
"Rök BoX" y vacíos.

Confirmar:
- `migraciones` = `0001`…`0014` exactas, o `"sin historial"` (ver paso 5a). Si faltan o tienen otros nombres, se corrige el historial
  con `supabase migration repair --status applied <versión>` (solo marca, no ejecuta) **antes** de
  `db push`; si no, la CLI intentaría volver a aplicarlas.
- `peso.promedio` en libras (típico 120–220) y `menores_de_90` cercano a 0. Si parece estar en
  kilos, **no** se corre E17 (el script igual se niega si el promedio es menor a 90).
- `box_name`: revisar las variantes; la regla de E18 une todo lo que contenga "rokbox", "rocbox",
  "rockbox" o "rolbox" sin tildes ni espacios, y los vacíos.

## 3. El día del paso

Orden pensado para que la app vieja y la nueva convivan el menor tiempo posible.

| Paso | Comando o acción | Verificación |
|---|---|---|
| 1. Congelar `develop` | Último commit probado en el preview | Tests SQL en DEV en verde |
| 2. Vincular producción | `supabase link --project-ref <REF_PRODUCCION>` | `supabase projects list` → `linked` en producción |
| 3. **Backup del día** (obligatorio) | `supabase db dump --linked -f <carpeta_backup>/schema.sql`<br>`supabase db dump --linked --data-only -f <carpeta_backup>/data.sql`<br>`supabase db dump --linked --role-only -f <carpeta_backup>/roles.sql` | Los tres archivos existen y no están vacíos. La carpeta va **fuera del repo** (tiene datos personales) y se copia a la nube. Si el plan tiene backups diarios o PITR, anotar la hora |
| 4. Prechequeo | `supabase db query --linked -f supabase/scripts/prod/01_precheck.sql` | Igual al del paso 2 de arriba |
| 5a. Historial | Solo si el prechequeo dice `"sin historial"`: `supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 --linked` (solo marca, no ejecuta SQL de las migraciones) | `supabase migration list --linked` muestra `0001`–`0014` en local y remoto |
| 5. Migraciones | `supabase db push --linked` (solo `0015`–`0028`; revisar la lista antes de confirmar) | Termina sin errores |
| 6. Correcciones de datos | `supabase db query --linked -f supabase/scripts/prod/02_data_fixes.sql` | `promedio_kg` típico 55–100; `box_name` solo "RöK BoX" (o variantes revisadas) |
| 7. Publicar la app | Merge de `develop` a `main` y push → Vercel despliega producción | El despliegue de Production termina en verde |
| 8. Socios | Copiar `03_bootstrap.template.sql` al scratchpad, llenar los `<<...>>` (el bridge se crea antes en Authentication → Add user) y correr la copia | `socios` lista a los dos con su porcentaje |
| 9. Entrar como socio | Cada socio inicia sesión con Google en producción | Ve la pestaña Gestión |
| 10. Configurar desde la app | Gestión → Ajustes: planes, catálogo, categorías, coach (Roles e invitaciones) y mensaje de WhatsApp | — |
| 11. Push | `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...`<br>`supabase functions deploy send-push --no-verify-jwt --use-api`<br>`node supabase/scripts/configure-push.mjs` | Un socio activa las notificaciones en Perfil y recibe un aviso de prueba |
| 12. Poschequeo | `supabase db query --linked -f supabase/scripts/prod/04_postcheck.sql` | `filas` igual al prechequeo; `migraciones.ultima` = `0028`; 5 trabajos en `cron`; los 2 secretos en `vault_push` |
| 13. Volver a DEV | `supabase link --project-ref qsqrnfgcozvznkbdyozs` | `supabase projects list` → `linked` en DEV |

### Bridge en el PC del box

1. Clonar `rokbox-bridge`, crear el venv e instalar dependencias.
2. `bridge/.env` con la URL y la clave anon de **producción**, el usuario y la contraseña del
   bridge y las credenciales de HCAC del box.
3. `python bridge_agent.py --import --dry-run`: revisar cuántas personas, cuántas sin cédula y
   cuántas sin vigencia.
4. `python bridge_agent.py --import`: importación real.
5. `python bridge_agent.py --once`: un ciclo completo sin cambios fantasma.
6. Instalar el servicio (`install_service.ps1`) y confirmar en Gestión → Ajustes → Bridge que
   llega el latido.

### Después de importar (D46)

- Las tiqueteras vigentes se crean a mano (Renovar con el plan de tiquetera y, si hace falta,
  descontar las clases ya usadas).
- Las deudas abiertas se cargan a mano (Deudas → Nueva deuda).
- La caja y los cuadres empiezan en cero el día del paso.
- Se avisa a los atletas que vinculen su cédula desde Perfil; los socios o el coach aprueban en
  Gestión → Pendientes.

## 4. Primera semana

- Revisar a diario Gestión → Pendientes y el estado del bridge.
- `04_postcheck.sql` cada día los primeros días (push y cron).
- Spent se retira cuando los socios confirmen que no hace falta (F8.4).

## 5. Reversa

Las migraciones solo agregan objetos, así que la reversa normal **no toca la base**:

1. Vercel → Deployments → el último despliegue de Production anterior → **Promote to Production**.
2. Detener el servicio del bridge en el PC del box. HikCentral sigue controlando la puerta solo.
3. Si ya se corrió E17, devolver el peso a libras para la app vieja (una sola vez):
   `update public.profiles set weight_kg = round(weight_kg * 2.20462, 2) where weight_kg is not null;`
   y `comment on column public.profiles.weight_kg is null;`
4. Restaurar el backup del paso 3 **solo** si hay datos de atletas dañados: se pierde todo lo
   escrito después del backup.
