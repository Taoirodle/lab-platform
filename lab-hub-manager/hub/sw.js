// L.A.B Hub — service worker (activates on secure origins, e.g. once the
// Cloudflare tunnel gives us HTTPS). Shell is cached for instant open +
// offline resilience; API calls always go to the live server first.
const SHELL = 'lab-hub-shell-v1';
const ASSETS = ['/hub/', '/hub/labloader.js', '/hub/manifest.json', '/hub/icons/icon-192.png', '/hub/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // live data: network first, no caching of API responses
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  // shell: cache first, refresh in the background
  e.respondWith(
    caches.match(e.request).then(hit => {
      const refresh = fetch(e.request).then(res => {
        if (res.ok) caches.open(SHELL).then(c => c.put(e.request, res.clone())).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
