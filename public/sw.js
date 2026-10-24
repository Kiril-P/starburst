// STARBURST service worker: offline play after the first visit. Hand-written (no plugin) and deliberately small.
// - The cache is versioned by the registration URL (sw.js?v=<package version>, see src/pwa.js): a new release installs a
//   new worker, which deletes the previous release's cache on activate.
// - Pages (navigations) are network-first so a deploy is picked up as soon as the player is online; everything else is
//   cache-first, which is safe because Vite gives built JS/CSS/fonts content-hashed names and images never change within a
//   version. There are no audio files to cache: music and sfx are synthesised in the browser (docs/AUDIO.md).
// - On the first visit the page loaded its assets before this worker existed, so src/pwa.js posts the list of resources
//   it already fetched ({ type: 'cache', urls }) and we add them here.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `starburst-${VERSION}`;
const CORE = ['./', './manifest.webmanifest', './favicon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('starburst-') && k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

const sameOrigin = (url) => new URL(url).origin === self.location.origin;
// only whole 200 responses: a 206 (range request) or an error page must never be served as the asset later
const cacheable = (res) => res && res.status === 200 && res.type === 'basic';

async function put(req, res) {
    if (!cacheable(res)) return;
    const c = await caches.open(CACHE);
    await c.put(req, res);
}

self.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'cache' || !Array.isArray(d.urls)) return;
    e.waitUntil((async () => {
        const c = await caches.open(CACHE);
        for (const url of d.urls) {
            if (!sameOrigin(url) || (await c.match(url))) continue;
            try { await put(url, await fetch(url)); } catch (err) { /* offline right now: the fetch handler will retry */ }
        }
    })());
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || !sameOrigin(req.url) || req.headers.has('range')) return;
    if (req.mode === 'navigate') {
        e.respondWith(fetch(req)
            .then((res) => { const copy = res.clone(); put('./', copy); return res; })
            .catch(async () => (await caches.match('./')) || Response.error()));
        return;
    }
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { put(req, res.clone()); return res; })));
});
