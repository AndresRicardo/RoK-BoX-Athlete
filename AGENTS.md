# AGENTS.md — RöK BoX Athlete

Guía obligatoria para cualquier agente de IA o persona que trabaje en este repo.

## 1. Al iniciar una sesión, leer en este orden
1. Este archivo.
2. [`docs/PROGRESS.md`](docs/PROGRESS.md): fase actual, qué sigue y bitácora.
3. [`docs/PLAN.md`](docs/PLAN.md): la sección de la fase en curso.
4. [`docs/DECISIONES.md`](docs/DECISIONES.md): decisiones del dueño del proyecto (no se re-discuten sin que él lo pida).
5. [`docs/AUDITORIA.md`](docs/AUDITORIA.md): estado de partida y problemas conocidos.

## 2. Qué es este repo
- PWA **mobile-first** (máximo 448 px centrado en escritorio) para **atletas** (PRs, WODs, comunidad, líderes, logros, membresía y deudas) y para la **gestión del box** (socios y coaches).
- Stack: React 19, Vite 6, Tailwind v4, Zustand, Supabase (Auth Google, Postgres con RLS, Realtime, Edge Functions) y despliegue en Vercel.
- `supabase/` contiene **todas** las migraciones, seeds y tests SQL del proyecto.
- El agente de HikCentral vive en otro repo: **`rokbox-bridge`**.
- Spent (Android) y `rokbox-platform` están retirados o archivados.

## 3. Ramas y entornos

| Rama | Despliegue | Supabase |
|---|---|---|
| `develop` | Preview en Vercel | DEV `qsqrnfgcozvznkbdyozs` (los datos se pueden borrar) |
| `main` | **Producción** | Producción (datos reales de atletas) |

- Todo el trabajo se hace en `develop`, con commits pequeños en formato Conventional Commits.
- `main` solo se toca por **instrucción explícita** del usuario.

## 4. Reglas de oro
1. **Producción es sagrada.** Nada de migraciones, `DELETE`/`UPDATE` masivos ni cambios de esquema en producción sin orden explícita **y** un backup del mismo día.
2. **Las migraciones `0001`–`0014` ya están aplicadas en producción:** nunca se editan. Toda migración aplicada en producción es inmutable.
3. **Secretos fuera de git:** la `service_role`, las contraseñas, las credenciales de HikCentral y los `.env`. Las claves publicables o anon de Supabase sí pueden ir en el cliente.
4. **Seguridad por defecto:**
   - Toda tabla nueva lleva `enable row level security` y políticas explícitas.
   - Toda función `security definer` lleva `set search_path = public` y valida el rol al inicio.
   - Las reglas de RLS se prueban en `supabase/tests/`.
5. **HikCentral:** las pruebas se hacen solo contra el HCAC del PC de desarrollo, con personas `ZZTEST`. Nunca se escribe en su base PostgreSQL interna.
6. **Verificar antes de declarar algo "hecho":** build, tests SQL y prueba manual en el preview.

## 5. Convenciones

| Tema | Convención |
|---|---|
| Idioma | UI y documentación en **español**; identificadores en **inglés** (`snake_case` en SQL, `camelCase` en JS). |
| Dinero | `numeric(12,2)` en el servidor, en pesos colombianos (COP). Nunca `float`. |
| Fechas | `timestamptz`. Zona de negocio: `America/Bogota`. |
| Borrados | Lógicos (`deleted_at`) en las tablas de dinero y acceso, y siempre auditados. |
| Estado derivado | Lo que depende del tiempo (vencido, por vencer) se calcula en vistas y no se guarda. |
| Totales | Se recalculan sumando (triggers), nunca restando sobre un saldo. |

## 6. Entorno Windows de desarrollo
- La CLI `supabase` está vinculada a DEV. `supabase db query --linked` ejecuta SQL y `supabase db push` aplica migraciones.
- HikCentral Access Control 2.4 está instalado localmente para pruebas.

## 7. Cierre de sesión (handoff)
1. Actualizar los checkboxes y la **bitácora** de `docs/PROGRESS.md`.
2. Si hubo una decisión nueva, agregarla al final de `docs/DECISIONES.md`.
3. Si cambió el diseño, actualizar `docs/PLAN.md`.
4. Hacer commit en `develop`.
