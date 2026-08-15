const VERSION = 'v55-progressive-tournament-modules';
const CACHE_PREFIX = 'arena-bda-';
const CACHE = Object.freeze({
  shell: `${CACHE_PREFIX}shell-${VERSION}`,
  assets: `${CACHE_PREFIX}assets-${VERSION}`,
  images: `${CACHE_PREFIX}images-${VERSION}`
});
const ACTIVE_CACHES = new Set(Object.values(CACHE));
const SHELL = ['./', './index.html', './preview-v2.html', './favicon.svg', './site.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE.shell).then(cache => cache.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => !ACTIVE_CACHES.has(key) && (/^arena-bda-/.test(key) || /^copa-grifo-/.test(key)))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function canCache(request, response) {
  return request.url.startsWith(self.location.origin) && response?.ok && response.type !== 'opaque';
}

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximumEntries)).map(key => cache.delete(key)));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE.shell);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (canCache(request, response)) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE.assets);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (canCache(request, response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  return cached || await network || Response.error();
}

async function imageCacheFirst(request) {
  const cache = await caches.open(CACHE.images);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (canCache(request, response)) {
      await cache.put(request, response.clone());
      trimCache(CACHE.images, 80).catch(() => {});
    }
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
  const isDocument = request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html');

  if (isDocument) return event.respondWith(networkFirst(request));
  if (!sameOrigin) return;
  if (request.destination === 'image') return event.respondWith(imageCacheFirst(request));
  if (['script', 'style', 'font', 'manifest'].includes(request.destination)) event.respondWith(staleWhileRevalidate(request));
});
