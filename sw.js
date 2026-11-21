// Offline cache. Games happen in basements with no signal, so the app must open without a network and must not hang
// on a weak one: the network gets a short head start, then the cached copy is used while the network keeps trying.
const CACHE = 'clocktower-companion-v8';
// Every file the app loads. tests/test_app.py checks this list against index.html, the manifest and the files that are really requested.
const FILES = ['./', 'index.html', 'css/app.css', 'js/icons.js', 'js/extra-characters.js', 'js/data.js', 'js/coach.js', 'js/engine.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const NETWORK_TIMEOUT = 2500;
const SHELL = new URL('index.html', self.registration.scope).href;

// Install fetches every file fresh (not from the browser's HTTP cache) and is all-or-nothing, so a new version is
// either complete or not installed at all, and the old version keeps working until then.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
// Activation drops every older version's cache, so only one version's files are ever served. The saved game lives in localStorage and is never touched here.
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('clocktower-companion-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Only a complete, successful response of the right kind may be stored (never a 404, a 500, a partial reply, or a
// login page that a hotspot answers with instead of a script).
function storable(req, res) {
  if (!res || res.redirected || res.status !== 200 || (res.type !== 'basic' && res.type !== 'default')) return false;
  const type = res.headers.get('content-type') || '';
  return req.mode === 'navigate' || !/^text\/html/i.test(type) || req.destination === 'document';
}
// A hotspot can answer a page request with its own login page, so a page is only kept if it really is this app.
async function isApp(req, res) {
  if (req.mode !== 'navigate') return true;
  try { return (await res.clone().text()).includes('id="town-pane"'); } catch (err) { return false; }
}
async function store(key, res) {
  try { const c = await caches.open(CACHE); await c.put(key, res); } catch (err) { /* a full disk must not break the page */ }
}
async function fromCache(req) {
  try {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // Any page address (including one with a query string) opens the cached app shell.
    return req.mode === 'navigate' ? ((await c.match(SHELL)) || (await c.match(self.registration.scope))) : undefined;
  } catch (err) { return undefined; }
}
// Pages are stored under their address without the query string, so "?x=1" does not fill the cache with copies.
const keyFor = (req) => { if (req.mode !== 'navigate') return req; const u = new URL(req.url); u.search = ''; u.hash = ''; return u.href; };

async function respond(e) {
  const req = e.request;
  let stored = Promise.resolve();
  const net = fetch(req).then(async (res) => {
    const good = storable(req, res) && await isApp(req, res);
    if (good) stored = store(keyFor(req), res.clone());
    return { res, good };
  });
  // Keep the worker alive so the cache is refreshed even after we have already answered from it.
  e.waitUntil(net.then(() => stored, () => {}));
  let timer;
  const late = new Promise(resolve => { timer = setTimeout(() => resolve(null), NETWORK_TIMEOUT); });
  try {
    const hit = await Promise.race([net, late]);
    clearTimeout(timer);
    if (hit) {
      if (hit.good) return hit.res;
      return (await fromCache(req)) || hit.res; // an error page (or a hotspot's login page) never beats a good cached copy
    }
    // Too slow: answer from the cache if there is a copy, otherwise keep waiting for the network.
    return (await fromCache(req)) || (await net).res;
  } catch (err) {
    clearTimeout(timer);
    return (await fromCache(req)) || Response.error();
  }
}
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(respond(e));
});
