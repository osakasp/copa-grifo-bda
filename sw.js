const CACHE = 'arena-bda-shell-v40-progressive';
const SHELL = [
  './',
  './index.html',
  './favicon.svg',
  './site.webmanifest',
  './arena-bootstrap.js',
  './firebase-auth.js',
  './media-storage.js',
  './arena-bda-v4.js',
  './firestore-sync-v4.js',
  './admin-panel.js',
  './navegacao-arena-v2.js',
  './arena-router.js',
  './site-health.js'
];
const TRUSTED_EXTERNAL_ORIGINS = new Set([
  'https://www.gstatic.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(error => console.warn('Falha ao preparar o cache inicial da Arena', error))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE && (/^arena-bda-/.test(key) || /^copa-grifo-/.test(key)))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_ARENA_CACHE') {
    event.waitUntil(caches.delete(CACHE).then(() => caches.open(CACHE).then(cache => cache.addAll(SHELL))));
  }
});

function withTimeout(request, timeout = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(request);
    if (response?.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: request.mode === 'navigate' }))
      || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined)
      || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  return cached || await network || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const trustedExternal = TRUSTED_EXTERNAL_ORIGINS.has(url.origin);
  const isDocument = request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html');

  if (isDocument && sameOrigin) {
    event.respondWith(networkFirst(request));
    return;
  }

  if ((sameOrigin || trustedExternal) && ['script', 'style', 'image', 'manifest'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (trustedExternal && request.destination === 'font') {
    event.respondWith(cacheFirst(request));
  }
});
