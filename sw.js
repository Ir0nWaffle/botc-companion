// Offline cache: network first, falling back to the cache (games happen in basements with no signal).
const CACHE = 'clocktower-companion-v1';
const FILES = ['./', 'index.html', 'css/app.css', 'js/icons.js', 'js/extra-characters.js', 'js/data.js', 'js/engine.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
