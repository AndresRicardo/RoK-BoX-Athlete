# Vercel

Despliegue del frontend en Vercel.

## Importar el proyecto

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New → Project**.
3. Selecciona el repo `RoK-BoX-Athlete` (o el fork correspondiente).
4. Configuración:
   - **Framework Preset**: Vite (lo autodetecta)
   - **Root Directory**: `./` (raíz del repo)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
5. Variables de entorno (ver abajo).
6. **Deploy**.

## Variables de entorno

En Project Settings → Environment Variables, añade (para Production, Preview y Development si quieres):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://supabase.tu-dominio.com` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |

> Estos valores se inyectan en el build de Vite y se embeben en el bundle. La `anon` key no es un secreto (es pública por diseño), pero `VITE_SUPABASE_URL` puede revelar tu infra.

## Por qué `vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

React Router 7 hace el routing en el cliente. Si el usuario recarga en `/community` o `/athletes/<id>`, Vercel serviría un 404 porque no existe el archivo. El rewrite redirige todas las rutas no-aset a `index.html`, que carga la SPA y el router se encarga.

## Preview deployments

Por cada PR abierto, Vercel crea un deploy en una URL del tipo `rok-box-athlete-git-feat-xyz.vercel.app`. Las variables de entorno marcadas como **Preview** se inyectan en esos builds. Útil para probar antes de mergear.

**Importante**: añade la URL de preview a los **Additional Redirect URLs** de Supabase (Authentication → URL Configuration) para que el OAuth de Google funcione en el preview.

## Dominio custom

Ver `docs/dominios.md`.

## Verificación post-deploy

1. Abre la URL de producción.
2. La landing debe ser `/community` (feed).
3. Click en cualquier item del menú: navega correctamente.
4. Login con Google: pide cuenta, redirige al feed, sesión persiste al recargar.
5. Crea un PR: aparece en la lista de PRs y genera un evento en el feed.
6. Instala como PWA desde el navegador del móvil: el icono y el splash deben verse bien.

## Builds fallando

- **"Cannot find module"** después de merge: asegúrate de que `npm install` corrió y que `package-lock.json` está commiteado.
- **Build timeout**: Vercel free tiene 10 min de límite. El proyecto es ligero, no debería pasar.
- **404 en rutas profundas sin recargar**: verifica que `vercel.json` está en la raíz y commiteado.

## Logs y analytics

- Vercel → tu proyecto → **Logs**: runtime logs (errores del SW, etc.).
- **Analytics**: opcional, de pago, pero útil para ver tráfico en producción.
- Para errores del cliente en producción, considera añadir Sentry (no está implementado).
