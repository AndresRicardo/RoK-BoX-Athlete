// Service Worker custom para RöK BoX Athlete
// Generado con la strategy `injectManifest` de vite-plugin-pwa.
// workbox-precaching inyecta el manifest en build time via self.__WB_MANIFEST.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { createHandlerBoundToURL } from 'workbox-precaching';

self.skipWaiting();
clientsClaim().catch(() => {});

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

async function clientsClaim() {
  if (self.registration && self.registration.active) {
    try {
      await self.clients.claim();
    } catch {
      // ignore
    }
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'RöK BoX Athlete', body: event.data.text() };
  }

  const title = payload.title || 'RöK BoX Athlete';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || 'rokbox-notif',
    renotify: payload.renotify !== false,
    data: payload.data || {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    (async () => {
      // Si la app esta abierta con foco, no mostrar la notificacion nativa
      // (el atleta ya la ve in-app via Realtime).
      try {
        const clientList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const focused = clientList.some((c) => c.focused && c.visibilityState === 'visible');
        if (focused) return;
      } catch {
        // ignore
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/community';
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.pathname === targetUrl) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // La subscripcion rota. Avisamos a la pagina para que la reinserte.
  event.waitUntil(
    (async () => {
      try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({ type: 'pushsubscriptionchange' });
        }
      } catch {
        // ignore
      }
    })(),
  );
});
