// Blitz service worker: makes repeat visits open instantly.
// - App shell (page, script, styles): served from cache at once, refreshed in the background.
// - Quiz pictures: their URLs carry a version, so a cached copy is always right.
// - Everything else under /api (live games, scores, saving): always straight to the network.
const SHELL = 'blitz-shell-v1';
const PICS = 'blitz-pics-v1';
const SHELL_FILES = ['/', '/app.js', '/styles.css'];
const MAX_PICS = 150;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== PICS) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isPic = (url) => /^\/api\/quizzes\/[^/]+\/image\/\d+$/.test(url.pathname) && url.searchParams.has('v');

async function fromShell(req, key) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(key);
  const fresh = fetch(req).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  if (hit) { fresh.catch(() => {}); return hit; }
  return fresh;
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
  if (url.pathname === '/app.js' || url.pathname === '/styles.css') return e.respondWith(fromShell(req, url.pathname));
});
