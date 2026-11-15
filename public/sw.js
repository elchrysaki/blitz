// Blitz service worker: makes repeat visits open instantly.
// - App shell (page, script, styles): newest from the network, the saved copy if slow or offline.
// - Quiz pictures: their URLs carry a version, so a cached copy is always right.
// - Everything else under /api (live games, scores, saving): always straight to the network.
const SHELL = 'blitz-shell-v4';
const PICS = 'blitz-pics-v1';
const SHELL_FILES = ['/', '/app.js', '/styles.css'];
const FONTS = ['/fonts/dm-sans.woff2', '/fonts/bricolage-grotesque.woff2', '/textures/denim.webp'];  // never change
const MAX_PICS = 150;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([...SHELL_FILES, ...FONTS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== PICS) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isPic = (url) => /^\/api\/quizzes\/[^/]+\/image\/\d+$/.test(url.pathname) && url.searchParams.has('v');

// Page, script and styles: ask the network first so every visit gets the newest version
// (a quick "not changed" check most of the time); fall back to the saved copy if the
// network is slow (over 2.5s) or offline.
async function fromShell(req, key) {
  const cache = await caches.open(SHELL);
  const fresh = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 2500));
  try {
    const res = await Promise.race([fresh, slow.then(() => null)]);
    if (res) return res;
  } catch { /* offline: use the saved copy */ }
  fresh.catch(() => {});
  return (await cache.match(key)) || fresh;
}

async function fromPics(req) {
  const cache = await caches.open(PICS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - MAX_PICS; i++) await cache.delete(keys[i]);
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (isPic(url)) return e.respondWith(fromPics(req));
  if (url.pathname.startsWith('/api/')) return;            // live data: never cached
  if (req.mode === 'navigate') return e.respondWith(fromShell(req, '/'));   // every app route is index.html
  if (FONTS.includes(url.pathname)) return e.respondWith(caches.match(url.pathname).then((hit) => hit || fetch(req)));  // fonts never change
  if (url.pathname === '/app.js' || url.pathname === '/styles.css') return e.respondWith(fromShell(req, url.pathname));
});
