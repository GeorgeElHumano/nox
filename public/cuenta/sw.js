// NOX · avisos del panel de administración. Solo recibe notificaciones push y abre el panel al tocarlas: no guarda nada en caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'NOX', {
    body: d.body || '', tag: d.tag, icon: '/img/nox-icon-192.png', badge: '/img/nox-icon-192.png',
    data: { url: d.url || '/cuenta/#admin' }, timestamp: Date.now(),
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/cuenta/#admin', self.location.origin).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) if (c.url.includes('/cuenta/')) { try { await c.focus(); c.postMessage({ nav: url }); return; } catch {} }
    await self.clients.openWindow(url);
  })());
});
