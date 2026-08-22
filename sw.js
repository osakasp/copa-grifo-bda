const VERSION = 'v110-remove-super-league-groups-overview';
const CACHE_PREFIX = 'arena-bda-';
const CACHE = Object.freeze({
  shell: `${CACHE_PREFIX}shell-${VERSION}`,
  assets: `${CACHE_PREFIX}assets-${VERSION}`,
  images: `${CACHE_PREFIX}images-${VERSION}`
});
const ACTIVE_CACHES = new Set(Object.values(CACHE));
const SUPER_LEAGUE_RULE_SRC = './super-league-rule-v3.js?v=20260822-1';
const CLEANUP_SRC = './arena-v3-cleanup.js?v=20260822-2';
const REDESIGN_SRC = './arena-redesign-v1.js?v=20260821-1';
const MOBILE_POLISH_SRC = './arena-mobile-polish.js?v=20260821-1';
const MOBILE_BRACKET_SRC = './arena-mobile-bracket-v4.js?v=20260822-1';
const TEAM_EDITOR_SRC = './arena-team-editor.js?v=20260821-1';
const TEAM_CLOUD_SYNC_SRC = './arena-team-cloud-sync.js?v=20260821-1';
const TOURNAMENT_TRIM_SRC = './arena-tournament-trim.js?v=20260822-2';
const SHELL = [
  './',
  './index.html',
  './preview-v2.html?v=20260819-5',
  './favicon.svg',
  './site.webmanifest',
  CLEANUP_SRC,
  SUPER_LEAGUE_RULE_SRC,
  REDESIGN_SRC,
  MOBILE_POLISH_SRC,
  MOBILE_BRACKET_SRC,
  TEAM_EDITOR_SRC,
  TEAM_CLOUD_SYNC_SRC,
  TOURNAMENT_TRIM_SRC,
  './arena-pro-motion.js?v=20260818-1',
  './super-league-runtime-fix.js?v=20260819-3',
  './super-league-schedule-repair.js?v=20260819-3',
  './bda-logo.js?v=20260819-1',
  './arena-home-active.js?v=20260820-1'
];

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    self.skipWaiting(),
    caches.open(CACHE.shell).then(cache => cache.addAll(SHELL)).catch(() => {})
  ]));
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

function cleanupResponse(response) {
  if (!response?.ok) return Promise.resolve(response);
  return response.clone().text().then(html => {
    if (html.includes('arena-v3-cleanup.js')) return response;
    const script = `<script src="${CLEANUP_SRC}"></script>`;
    const next = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : `${html}${script}`;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.set('cache-control', 'no-store');
    return new Response(next, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  });
}

async function previewV3(request) {
  const cache = await caches.open(CACHE.shell);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (canCache(request, response)) cache.put(request, response.clone()).catch(() => {});
    return await cleanupResponse(response);
  } catch {
    const cached = await cache.match(request) || await cache.match('./preview-v2.html?v=20260819-5');
    return cached ? cleanupResponse(cached) : Response.error();
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
  if (!sameOrigin) return;

  if (url.pathname.endsWith('/preview-v2.html') || url.pathname.endsWith('preview-v2.html')) {
    return event.respondWith(previewV3(request));
  }

  const isDocument = request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html');
  const isCriticalArenaScript = request.destination === 'script'
    && /\/(firebase-auth|firestore-sync|classificacao-automatica|arena-v3-cleanup|arena-redesign-v1|arena-mobile-polish|arena-mobile-bracket-v4|arena-team-editor|arena-team-cloud-sync|arena-tournament-trim|super-league-rule-v3|super-league-guard|super-league-runtime-fix|super-league-schedule-repair|bda-logo|arena-home-active)\.js$/.test(url.pathname);

  if (isDocument || isCriticalArenaScript) return event.respondWith(networkFirst(request));
  if (request.destination === 'image') return event.respondWith(imageCacheFirst(request));
  if (['script', 'style', 'font', 'manifest'].includes(request.destination)) event.respondWith(staleWhileRevalidate(request));
});
