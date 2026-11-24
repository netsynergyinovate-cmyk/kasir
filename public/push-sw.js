// Penangan push untuk service worker PWA (di-import lewat workbox.importScripts di vite.config.js).
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'KAsir', {
    body: data.body || '',
    icon: '/hero.png',
    badge: '/hero.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }));
});

// Ketuk notifikasi: buka (atau fokuskan) aplikasi di halaman tujuan.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const client = list.find((item) => 'focus' in item);
    if (client) return client.navigate(url).then((page) => (page || client).focus());
    return self.clients.openWindow(url);
  }));
});
