// Manejo de Web Push dentro del service worker que genera vite-plugin-pwa
// (se importa con workbox.importScripts en vite.config.js).
// El contenido lo envía la Edge Function send-push: { title, body, icon, badge, tag, data: { url } }.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'RöK BoX', {
      body: data.body || '',
      icon: data.icon || '/pwa-192x192.png',
      badge: data.badge || '/pwa-192x192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: data.data || {},
    }),
  );
});

// Al tocar el aviso: enfoca la app si ya está abierta (y navega al enlace) o la abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((w) => w.url.startsWith(self.location.origin));
    if (client) {
      await client.focus();
      if ('navigate' in client) await client.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});
