const scope = self.registration.scope;
const prefix = `leonida-ledger:${scope}:`;
const version = `${prefix}1`;
const page = new URL('index.html', scope).href;
const assets = ['index.html', 'style.css', 'app.js', 'model.js', 'data/trophies.json']
  .map(path => new URL(path, scope).href);
const shell = new Set(assets);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(version);
    await cache.addAll(assets.map(url => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const versions = await caches.keys();
    await Promise.all(versions.filter(key => key.startsWith(prefix) && key !== version).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const isPage = request.mode === 'navigate' && (path === page || path === scope);
  if (!isPage && !shell.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(version);
    const stored = await cache.match(isPage ? page : request);
    return stored ?? fetch(request);
  })());
});
