const VERSION = 'v127-site-health-no-auto-reload';
const REV = '20260825-2';
const AUTH_REV = '20260825-5';
const AUTH_CONSUMERS_REV = '20260825-4';
const SITE_HEALTH_REV = '20260825-6';
const LEGACY_BOOT_REV = '20260822-10';
const CACHE_PREFIX = 'arena-bda-';
const CACHE = Object.freeze({
  shell: `${CACHE_PREFIX}shell-${VERSION}`,
  assets: `${CACHE_PREFIX}assets-${VERSION}`,
  images: `${CACHE_PREFIX}images-${VERSION}`
});
const ACTIVE_CACHES = new Set(Object.values(CACHE));

const SUPER_LEAGUE_RULE_SRC = `./super-league-rule.js?v=${REV}`;
const SUPER_LEAGUE_SYNC_SRC = `./arena-super-league-sync-gate.js?v=${REV}`;
const CLEANUP_SRC = `./arena-v3-cleanup.js?v=${REV}`;
const REDESIGN_SRC = `./arena-redesign-v1.js?v=${REV}`;
const DESIGN_POLISH_SRC = `./arena-design-polish-v2.js?v=${REV}`;
const MOBILE_POLISH_SRC = `./arena-mobile-polish.js?v=${REV}`;
const MOBILE_BRACKET_SRC = `./arena-mobile-bracket-v4.js?v=${REV}`;
const PROVISIONAL_KNOCKOUT_SRC = `./arena-provisional-knockout.js?v=${REV}`;
const TEAM_EDITOR_SRC = `./arena-team-editor.js?v=${REV}`;
const TEAM_CLOUD_SYNC_SRC = `./arena-team-cloud-sync.js?v=${REV}`;
const TOURNAMENT_TRIM_SRC = `./arena-tournament-trim.js?v=${REV}`;
const MATCH_DETAILS_SRC = `./arena-match-details.js?v=${REV}`;
const MATCH_MEDIA_SRC = `./arena-match-media.js?v=${REV}`;
const SCORER_PHOTOS_SRC = `./arena-scorer-photos.js?v=${REV}`;
const FLASH_DRAW_ENGINE_SRC = `./flash-cup-draw-engine.js?v=${REV}`;
const FLASH_KNOCKOUT_ENGINE_SRC = `./flash-cup-knockout-engine.js?v=${REV}`;
const FLASH_CUPS_SRC = `./copas-flash.js?v=${REV}`;
const AUTH_SRC = `./firebase-auth.js?v=${AUTH_REV}`;
const AUTH_CONSUMERS_SRC = `./arena-auth-consumers.js?v=${AUTH_CONSUMERS_REV}`;
const SITE_HEALTH_SRC = `./site-health.js?v=${SITE_HEALTH_REV}`;

const SHELL = [
  './',
  './index.html',
  `./preview-v2.html?v=${REV}`,
  './favicon.svg',
  './site.webmanifest',
  './arena-runtime.bundle.js?v=20260814-4',
  `./confrontos-validos.js?v=${REV}`,
  `./super-league-guard.js?v=${REV}`,
  `./arena-bda.js?v=${REV}`,
  `./arena-home-active.js?v=${REV}`,
  `./arena-lazy-features.js?v=${REV}`,
  `./arena-interface.bundle.js?v=${REV}`,
  AUTH_SRC,
  AUTH_CONSUMERS_SRC,
  SITE_HEALTH_SRC,
  CLEANUP_SRC,
  SUPER_LEAGUE_RULE_SRC,
  SUPER_LEAGUE_SYNC_SRC,
  REDESIGN_SRC,
  DESIGN_POLISH_SRC,
  MOBILE_POLISH_SRC,
  MOBILE_BRACKET_SRC,
  PROVISIONAL_KNOCKOUT_SRC,
  TEAM_EDITOR_SRC,
  TEAM_CLOUD_SYNC_SRC,
  TOURNAMENT_TRIM_SRC,
  MATCH_DETAILS_SRC,
  MATCH_MEDIA_SRC,
  SCORER_PHOTOS_SRC,
  FLASH_DRAW_ENGINE_SRC,
  FLASH_KNOCKOUT_ENGINE_SRC,
  FLASH_CUPS_SRC,
  './arena-pro-motion.js?v=20260818-1',
  `./super-league-runtime-fix.js?v=${REV}`,
  './bda-logo.js?v=20260819-1'
];

async function precacheFresh() {
  const cache = await caches.open(CACHE.shell);
  await Promise.allSettled(SHELL.map(async url => {
    const request = new Request(url, { cache:'reload' });
    const response = await fetch(request, { cache:'no-store' });
    if (canCache(request, response)) await cache.put(request, response.clone());
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await self.skipWaiting();
    await precacheFresh().catch(() => {});
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => !ACTIVE_CACHES.has(key) && (/^arena-bda-/.test(key) || /^copa-grifo-/.test(key)))
      .map(key => caches.delete(key)));

    await self.clients.claim();
    const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    await Promise.all(clients.map(async client => {
      try {
        client.postMessage({ type:'ARENA_BUILD_ACTIVATED', version:VERSION, revision:REV, reloadRequired:false, documentMode:'single' });
      } catch {}
    }));
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_ARENA_BUILD') {
    event.source?.postMessage?.({ type:'ARENA_BUILD', version:VERSION, revision:REV, reloadRequired:false, documentMode:'single' });
  }
  if (event.data?.type === 'PURGE_OLD_ARENA_CACHES') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
      .filter(key => !ACTIVE_CACHES.has(key) && (/^arena-bda-/.test(key) || /^copa-grifo-/.test(key)))
      .map(key => caches.delete(key)))));
  }
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
    const response = await fetch(request, { cache:'no-store' });
    if (canCache(request, response)) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match(request))
      || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined)
      || Response.error();
  }
}

function forceCurrentCleanup(html) {
  const stripped = html.replace(/<script[^>]+src=["'][^"']*arena-v3-cleanup\.js[^"']*["'][^>]*>\s*<\/script>/gi, '');
  const script = `<script src="${CLEANUP_SRC}" data-arena-forced-cleanup="${VERSION}"></script>`;
  return /<\/body>/i.test(stripped) ? stripped.replace(/<\/body>/i, `${script}</body>`) : `${stripped}${script}`;
}

function normalizeIndexHtml(html) {
  return String(html || '')
    .replace(new RegExp(LEGACY_BOOT_REV, 'g'), REV)
    .replace(/\.\/firebase-auth\.js\?v=[^'"`\s]+/g, AUTH_SRC)
    .replace(/\.\/arena-auth-consumers\.js\?v=[^'"`\s]+/g, AUTH_CONSUMERS_SRC)
    .replace(/\.\/site-health\.js\?v=[^'"`\s]+/g, SITE_HEALTH_SRC)
    .replace(/\s*\.then\(\s*registration\s*=>\s*registration\.update\(\)\s*\)/g, '');
}

function rewrittenHtmlResponse(response, transform) {
  if (!response?.ok) return Promise.resolve(response);
  return response.clone().text().then(html => {
    const next = transform(html);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate');
    headers.set('x-arena-build', VERSION);
    headers.set('x-arena-revision', REV);
    headers.set('x-arena-document-mode', 'single');
    return new Response(next, {
      status:response.status,
      statusText:response.statusText,
      headers
    });
  });
}

function cleanupResponse(response) {
  return rewrittenHtmlResponse(response, forceCurrentCleanup);
}

async function indexCurrent(request) {
  const cache = await caches.open(CACHE.shell);
  try {
    const response = await fetch(request, { cache:'no-store' });
    if (canCache(request, response)) cache.put(request, response.clone()).catch(() => {});
    return await rewrittenHtmlResponse(response, normalizeIndexHtml);
  } catch {
    const cached = await cache.match(request) || await cache.match('./index.html');
    return cached ? rewrittenHtmlResponse(cached, normalizeIndexHtml) : Response.error();
  }
}

async function previewCurrent(request) {
  const cache = await caches.open(CACHE.shell);
  try {
    const response = await fetch(request, { cache:'no-store' });
    if (canCache(request, response)) cache.put(request, response.clone()).catch(() => {});
    return await cleanupResponse(response);
  } catch {
    const cached = await cache.match(request) || await cache.match(`./preview-v2.html?v=${REV}`);
    return cached ? cleanupResponse(cached) : Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE.assets);
  const cached = await cache.match(request);
  const network = fetch(request, { cache:'no-cache' })
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
    const response = await fetch(request, { cache:'no-cache' });
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
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/preview-v2.html') || url.pathname.endsWith('preview-v2.html')) {
    return event.respondWith(previewCurrent(request));
  }

  const isRootDocument = request.mode === 'navigate'
    && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('index.html'));
  if (isRootDocument) return event.respondWith(indexCurrent(request));

  const isDocument = request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html');
  const isCriticalArenaScript = request.destination === 'script'
    && /\/(firebase-auth|firestore-sync|arena-auth-consumers|site-health|classificacao-automatica|arena-v3-cleanup|arena-super-league-sync-gate|arena-redesign-v1|arena-design-polish-v2|arena-mobile-polish|arena-mobile-bracket-v4|arena-provisional-knockout|arena-team-editor|arena-team-cloud-sync|arena-tournament-trim|arena-match-details|arena-match-media|arena-scorer-photos|flash-cup-draw-engine|flash-cup-knockout-engine|copas-flash|super-league-rule|super-league-guard|super-league-runtime-fix|bda-logo|arena-home-active|arena-bda|arena-lazy-features|arena-interface\.bundle|arena-runtime\.bundle|confrontos-validos)\.js$/.test(url.pathname);

  if (isDocument || isCriticalArenaScript) return event.respondWith(networkFirst(request));
  if (request.destination === 'image') return event.respondWith(imageCacheFirst(request));
  if (['script','style','font','manifest'].includes(request.destination)) event.respondWith(staleWhileRevalidate(request));
});
