// Offline-Unterstützung: immer zuerst das Netz fragen (damit Änderungen sofort
// ankommen) und nur ohne Verbindung auf die gespeicherte Kopie zurückgreifen.
const CACHE = 'lizzy-study';
const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'fun.js', 'content.json', 'assets/ornament.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
