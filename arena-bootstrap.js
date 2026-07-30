(() => {
  'use strict';

  const VERSION = '2026.07.29.1';
  const FIREBASE_BASE = 'https://www.gstatic.com/firebasejs/10.12.0/';
  const critical = [
    `${FIREBASE_BASE}firebase-app-compat.js`,
    `${FIREBASE_BASE}firebase-auth-compat.js`,
    `${FIREBASE_BASE}firebase-firestore-compat.js`,
    `${FIREBASE_BASE}firebase-storage-compat.js`,
    './firebase-auth.js?v=20260729-1',
    './media-storage.js?v=20260729-1',
    './arena-bda-v4.js?v=20260729-1',
    './firestore-sync-v4.js?v=20260729-1',
    './admin-panel.js?v=20260726-3',
    './navegacao-arena-v2.js?v=20260729-1',
    './arena-router.js?v=20260729-1',
    './site-health.js?v=20260729-1'
  ];

  const enhancements = [
    './notificacoes-bda.js?v=20260727-1',
    './team-badges.js?v=20260729-1',
    './champion-banners.js?v=20260729-1',
    './bda-logo.js?v=20260729-1',
    './cloud-recovery.js?v=20260729-1',
    './home-campeonato-atual-v2.js?v=20260729-1',
    './ranking-bda.js?v=20260729-1',
    './central-inscricoes-v2.js?v=20260729-1',
    './design-arena-pro.js?v=20260729-1',
    './arena-design-v3.js?v=20260729-1',
    './topbar-mobile-clean.js?v=20260729-1',
    './arena-lazy-features-v2.js?v=20260729-1',
    './arena-security.js?v=20260729-1',
    './arena-observability.js?v=20260729-1'
  ];

  const loaded = new Map();
  const absolute = source => {
    try { return new URL(source, document.baseURI).href; }
    catch { return source; }
  };

  function preload(source) {
    const href = absolute(source);
    if ([...document.querySelectorAll('link[rel="preload"]')].some(link => link.href === href)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = source;
    if (href.startsWith('https://www.gstatic.com/')) link.crossOrigin = 'anonymous';
    document.head.append(link);
  }

  function loadScript(source) {
    const url = absolute(source);
    if (loaded.has(url)) return loaded.get(url);
    const existing = [...document.scripts].find(script => String(script.src || '').split('?')[0] === url.split('?')[0]);
    if (existing?.dataset.arenaLoaded === 'true') return Promise.resolve(existing);

    const promise = new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      script.src = source;
      script.async = false;
      script.dataset.arenaBootstrap = VERSION;
      script.addEventListener('load', () => {
        script.dataset.arenaLoaded = 'true';
        resolve(script);
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Falha ao carregar ${source}`)), { once: true });
      if (!existing) document.head.append(script);
    });

    loaded.set(url, promise);
    return promise;
  }

  async function loadSeries(sources) {
    sources.forEach(preload);
    for (const source of sources) await loadScript(source);
  }

  function idle(callback, timeout = 1800) {
    if ('requestIdleCallback' in window) requestIdleCallback(callback, { timeout });
    else setTimeout(callback, Math.min(timeout, 700));
  }

  async function start() {
    document.documentElement.dataset.arenaBoot = 'critical';
    performance.mark?.('arena-bootstrap-start');
    try {
      await loadSeries(critical);
      document.documentElement.dataset.arenaBoot = 'ready';
      performance.mark?.('arena-critical-ready');
      performance.measure?.('arena-critical-load', 'arena-bootstrap-start', 'arena-critical-ready');
      window.dispatchEvent(new CustomEvent('arena:critical-ready', { detail: { version: VERSION } }));
    } catch (error) {
      document.documentElement.dataset.arenaBoot = 'error';
      console.error('Falha na inicialização crítica da Arena BDA', error);
      const toastFn = typeof window.toast === 'function' ? window.toast : message => console.warn(message);
      toastFn('Algumas funções da Arena não carregaram. Atualize a página.');
      return;
    }

    idle(async () => {
      document.documentElement.dataset.arenaBoot = 'enhancing';
      try {
        await loadSeries(enhancements);
        document.documentElement.dataset.arenaBoot = 'complete';
        performance.mark?.('arena-enhancements-ready');
        performance.measure?.('arena-enhancements-load', 'arena-critical-ready', 'arena-enhancements-ready');
        window.dispatchEvent(new CustomEvent('arena:ready', { detail: { version: VERSION } }));
      } catch (error) {
        document.documentElement.dataset.arenaBoot = 'partial';
        console.error('Um recurso secundário da Arena BDA não carregou', error);
        window.dispatchEvent(new CustomEvent('arena:partial-ready', { detail: { version: VERSION, error: String(error?.message || error) } }));
      }
    });
  }

  start();
})();
