// Trillion — service worker minimal (§26 : offline en lecture).
// Cache la coquille de l'app ; les appels /api restent toujours en réseau (données fraîches).
const CACHE = 'trillion-v1';
const SHELL = ['/', '/index.html', '/app.css', '/app.js', '/manifest.webmanifest',
  '/assets/trillion-portrait.webp', '/assets/icon-192.png', '/assets/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Les données passent toujours par le réseau — jamais de cockpit périmé.
  if (url.pathname.startsWith('/api/')) return;
  // Coquille : réseau d'abord, cache en secours (offline).
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  );
});
