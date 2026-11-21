// A versioned, same-origin shell makes the guide available after the server stops.
const SHELL_CACHE = 'leonida-ledger-static-rewrite-3';
const shellPaths = ['index.html', 'app.js', 'model.js', 'style.css', 'data/trophies.json', './'];
const shellUrls = shellPaths.map(path => new URL(path, self.registration.scope).href);

async function installShell() {
  const store = await caches.open(SHELL_CACHE);
  await store.addAll(shellUrls);
  await self.skipWaiting();
}

async function takeControl() {
  const obsolete = (await caches.keys()).filter(name => name.startsWith('leonida-ledger-static-') && name !== SHELL_CACHE);
  await Promise.all(obsolete.map(name => caches.delete(name)));
  await self.clients.claim();
}

async function serveShell(request) {
  const store = await caches.open(SHELL_CACHE);
  const hit = await store.match(request);
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (error) {
    if (request.mode === 'navigate') return await store.match(new URL('index.html', self.registration.scope).href);
    throw error;
  }
}

self.addEventListener('install', event => event.waitUntil(installShell()));
self.addEventListener('activate', event => event.waitUntil(takeControl()));
self.addEventListener('fetch', event => {
  const address = new URL(event.request.url);
  if (event.request.method === 'GET' && address.origin === self.location.origin && address.href.startsWith(self.registration.scope)) {
    event.respondWith(serveShell(event.request));
  }
});
