# Dominios

Cómo configurar dominios custom para el frontend (Vercel) y el backend (Supabase).

## Estructura recomendada

Asumiendo que posees `rokbox.app` (sustituye por tu dominio real):

| Subdominio | Apunta a | Para qué |
|---|---|---|
| `app.rokbox.app` | Vercel | Frontend (PWA) |
| `supabase.rokbox.app` | Tu instancia de Supabase | API REST + Auth + Realtime |
| `studio.supabase.rokbox.app` | Tu instancia de Supabase | Panel de administración (Studio) |

Si prefieres dominios separados:

- `rokbox.app` para marketing/landing estática.
- `app.rokbox.app` para la PWA.
- `api.rokbox.app` para Supabase.

## Frontend: `app.rokbox.app` → Vercel

1. Compra el dominio (Cloudflare Registrar, Namecheap, Google Domains…).
2. En Vercel: Project → Settings → **Domains** → Add.
3. Escribe `app.rokbox.app`. Vercel te dirá qué DNS records añadir.
4. En tu proveedor de DNS, crea los registros que Vercel indica:
   - Si usas apex: un record `A` apuntando a `76.76.21.21`.
   - Si usas subdominio: un record `CNAME` apuntando a `cname.vercel-dns.com`.
5. Espera a que se propague (puede tardar hasta 48h, normalmente minutos).
6. Vercel aprovisiona HTTPS automáticamente (Let's Encrypt).
7. **Importante**: una vez propagado, actualiza la variable de entorno `VITE_SUPABASE_URL` en Vercel (si la cambiaste) y redeploya.

## Backend: `supabase.rokbox.app` → tu instancia self-hosted

1. En tu proveedor de DNS, crea un record `A` (o `CNAME` si tu infra lo soporta) apuntando a la IP pública de tu servidor Supabase.
2. En tu servidor, configura el reverse proxy (Caddy, Nginx, Traefik) para servir el puerto 8000 (PostgREST) y 3000 (Studio) bajo `supabase.rokbox.app` y `studio.supabase.rokbox.app` respectivamente.
3. Asegúrate de que los certificados Let's Encrypt se renuevan automáticamente.
4. Actualiza en `docker/.env`:
   - `SITE_URL=https://app.rokbox.app`
   - `API_EXTERNAL_URL=https://supabase.rokbox.app`
   - `SUPABASE_PUBLIC_URL=https://supabase.rokbox.app`
5. Actualiza la variable `VITE_SUPABASE_URL` del frontend a `https://supabase.rokbox.app`.
6. Actualiza en Authentication → URL Configuration: Site URL = `https://app.rokbox.app`, redirect URLs = `https://app.rokbox.app/`.
7. Actualiza en Google Cloud Console: Authorized JavaScript origins y Authorized redirect URIs con el nuevo dominio.

## Verificación

```bash
# Frontend
curl -I https://app.rokbox.app
# HTTP/2 200, server: Vercel

# Backend
curl https://supabase.rokbox.app/rest/v1/
# { "swagger": "2.0", "info": { "title": "PostgREST", ... } }
```

## HTTPS

- Vercel: automático.
- Self-hosted Supabase: usa [Caddy](https://caddyserver.com) (lo más simple) o Nginx con certbot. Caddy con un Caddyfile de 2 líneas ya lo deja andando:

  ```caddyfile
  supabase.rokbox.app {
    reverse_proxy localhost:8000
  }
  studio.supabase.rokbox.app {
    reverse_proxy localhost:3000
  }
  ```

## Cambiar de dominio después de estar en producción

Es delicado porque hay varios sitios donde el dominio está hardcodeado:

1. **Google Cloud Console**: cambiar Authorized origins + redirect URIs.
2. **Supabase**: cambiar Site URL y Additional redirect URLs.
3. **Frontend**: cambiar `VITE_SUPABASE_URL` y redeploy.
4. **iOS PWA**: los usuarios que ya instalaron la PWA tendrán que reinstalarla (el manifest está cacheado).
5. **Avatares de Google**: las URLs de las fotos de Google en `profiles.avatar_url` siguen funcionando (son URLs absolutas de googleusercontent.com).

Hazlo en una ventana de mantenimiento si tienes usuarios activos.
