# Despliegue

Flujo de release, pre-deploy checklist y operaciones post-despliegue.

## Branching

- **`main`**: producción. Cada commit aquí es lo que ven los usuarios finales.
- **`develop`**: integración. Las features nuevas se mergean aquí antes de pasar a `main`.
- **`feat/*`, `fix/*`**: ramas de feature/bug. Se mergean a `develop` con PR.

```
feat/xyz ──► develop ──► main
                    ▲
                    └── se mergea a main cuando está listo para release
```

## Flujo de release (paso a paso)

### 1. Trabajas en una rama

```bash
git switch develop
git pull origin develop
git switch -c feat/nueva-cosa
# ...trabajo...
git add . && git commit -m "feat: nueva cosa"
git push -u origin feat/nueva-cosa
# Abrir PR a develop
```

### 2. PR a develop

Vercel crea automáticamente un **preview deploy** en la URL del PR. Verifica que funciona ahí antes de mergear.

### 3. Merge a develop

Squash merge o merge commit, según prefieras. El proyecto usa merge commits en algunos casos y squash en otros; sé consistente.

### 4. Release a producción

```bash
git switch main
git pull origin main
git merge --ff-only develop   # fast-forward si develop no se ha desviado
git push origin main
```

> **Importante**: solo haz fast-forward si no hay commits en `main` que no estén en `develop`. Si los hay, hay que resolver primero (merge de `main` en `develop` local, arreglar conflictos, push de `develop`, y entonces sí mergear a `main`).

Vercel detecta el push a `main` y despliega a producción.

## Pre-deploy checklist (desarrollador, antes de mergear a `main`)

Para cada feature que llegue a `main`, asegúrate de que se ha documentado en el PR:

- [ ] **Migraciones nuevas**: ¿se ha añadido un archivo `supabase/migrations/00xx_*.sql`? Documentar el número y el propósito.
- [ ] **Realtime**: ¿la nueva tabla necesita estar en la publication `supabase_realtime`? Documentar el `alter publication ... add table ...`.
- [ ] **Variables de entorno**: ¿se usan nuevas env vars? Documentarlas (no añadir secretos a `.env.example`, solo los nombres).
- [ ] **Dominios / OAuth**: ¿se han añadido redirect URIs? Documentar.
- [ ] **Breaking changes**: ¿cambia el modelo de datos, RLS, o la API? Mencionar en la descripción del PR.
- [ ] **AGENTS.md**: si cambió la estructura, rutas, stores, migraciones, convenciones, actualizarlo.
- [ ] **Linter + build**: `npm run lint` y `npm run build` en local sin warnings.

## Post-deploy verifications (operador, después del push a `main`)

Tan pronto como Vercel termine el deploy:

1. **Migraciones**: si hay migraciones nuevas, ejecutarlas en el **Supabase de producción** (NO en dev) en orden.
   - SQL Editor → abrir el archivo → Run.
   - Si hay nueva tabla para realtime, añadirla a la publication: `alter publication supabase_realtime add table public.nueva_tabla;`
   - Si cambió una vista (drop+create), `notify pgrst, 'reload schema';` para que PostgREST recargue.
2. **Abrir la app** en el navegador de producción.
3. **Login con Google**: la sesión entra, redirige al feed.
4. **Crear un PR de prueba** (o un evento de prueba) y verificar que aparece en el feed.
5. **Dar like / comentar**: verificar que se registra y dispara realtime.
6. **Realtime campana**: si hay un segundo usuario logueado, hacer que reciba una notificación — el badge debe actualizarse en vivo.
7. **PWA**: en un móvil, "Añadir a pantalla de inicio" — el icono y el splash deben verse bien.

## Rollback

### Frontend

Vercel mantiene historial de deploys. En Project → Deployments, selecciona el anterior y **Promote to Production**. Reversión inmediata.

### Migraciones

No hay framework de migraciones (no usamos Prisma ni similar). Las migraciones son SQL idempotente — pero **no hay migraciones inversas**.

Si una migración rompe algo en producción:

1. **Apaga la app** en Vercel (Settings → General → "Disable Deployment").
2. **Escribe una migración inversa** en `supabase/migrations/` que deshaga los cambios. Documenta claramente con `-- ROLLBACK` al inicio.
3. Ejecuta esa migración inversa en prod.
4. Arregla el problema en una rama, testea, vuelve a desplegar.

> **Consejo**: para evitar esto, prueba las migraciones en el Supabase de dev primero. Y nunca borres columnas en la misma migración que las crea — sepáralas en migraciones distintas.

### Realtime

Si una suscripción realtime causa problemas, quita la tabla de la publication:

```sql
alter publication supabase_realtime drop table public.nueva_tabla;
```

El cliente seguirá funcionando, solo perderá updates en vivo.

## Historial de releases

Mantén un changelog en `CHANGELOG.md` (no existe aún, recomendado crearlo) o en las descripciones de los PRs/releases de GitHub.

Formato sugerido (Keep a Changelog):

```markdown
# Changelog

## [1.3.0] - 2026-XX-XX
### Added
- Notificaciones en tiempo real (FASE 14)
- Likes y comentarios en el feed (FASE 13)
- Sincronización de avatares de Google (FASE 13)

### Fixed
- Desfase de un día en fechas (FASE dates)
```

## Monitoreo (opcional, recomendado para producción real)

- **Vercel Analytics**: tráfico, Core Web Vitals.
- **Sentry** (no integrado): captura errores del cliente y del SW.
- **Supabase Logs**: en Studio → Logs, ver queries lentas, errores de RLS, etc.
- **Uptime**: UptimeRobot o similar pingueando `https://app.rokbox.app` y `https://supabase.rokbox.app/rest/v1/`.
