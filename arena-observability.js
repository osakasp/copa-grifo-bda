(() => {
  'use strict';

  const KEY = 'arena-observability-v1';
  const MAX_ERRORS = 20;
  const state = {
    version: document.documentElement.dataset.arenaVersion || '2026.07.29',
    startedAt: Date.now(),
    navigation: {},
    webVitals: {},
    longTasks: 0,
    errors: []
  };

  function safeRead() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    } catch {}
  }
  function recordError(type, value) {
    const text = String(value?.message || value || 'erro desconhecido').slice(0, 300);
    if (/ResizeObserver loop|AbortError/i.test(text)) return;
    state.errors.push({ type, text, at: Date.now(), view: new URL(location.href).searchParams.get('view') || 'home' });
    state.errors = state.errors.slice(-MAX_ERRORS);
    persist();
  }
  function collectNavigation() {
    const entry = performance.getEntriesByType?.('navigation')?.[0];
    if (!entry) return;
    state.navigation = {
      dns: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
      connect: Math.round(entry.connectEnd - entry.connectStart),
      response: Math.round(entry.responseEnd - entry.requestStart),
      domInteractive: Math.round(entry.domInteractive),
      domComplete: Math.round(entry.domComplete),
      transferSize: Number(entry.transferSize || 0)
    };
    persist();
  }
  function observeVitals() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const lcp = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) state.webVitals.lcp = Math.round(last.startTime);
        persist();
      });
      lcp.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      const shifts = new PerformanceObserver(list => {
        const value = list.getEntries().filter(entry => !entry.hadRecentInput).reduce((total, entry) => total + entry.value, 0);
        state.webVitals.cls = Number(((state.webVitals.cls || 0) + value).toFixed(4));
        persist();
      });
      shifts.observe({ type: 'layout-shift', buffered: true });
    } catch {}
    try {
      const longTasks = new PerformanceObserver(list => {
        state.longTasks += list.getEntries().length;
        persist();
      });
      longTasks.observe({ type: 'longtask', buffered: true });
    } catch {}
  }
  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar ${source}`));
      document.head.append(script);
    });
  }
  async function enableFirebasePerformance() {
    try {
      if (!window.firebase?.apps?.length) return;
      if (!firebase.performance) await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-performance-compat.js');
      firebase.performance();
      document.documentElement.dataset.arenaPerformance = 'active';
    } catch (error) {
      document.documentElement.dataset.arenaPerformance = 'local-only';
      console.warn('Firebase Performance não foi ativado', error);
    }
  }
  function summary() {
    return Object.freeze({ ...safeRead(), current: JSON.parse(JSON.stringify(state)) });
  }

  window.addEventListener('error', event => recordError('error', event.error || event.message));
  window.addEventListener('unhandledrejection', event => recordError('promise', event.reason));
  window.addEventListener('load', collectNavigation, { once: true });
  window.addEventListener('pagehide', persist);
  window.addEventListener('arena:ready', () => {
    const measure = performance.getEntriesByName?.('arena-enhancements-load')?.[0];
    if (measure) state.webVitals.enhancements = Math.round(measure.duration);
    persist();
  });

  observeVitals();
  setTimeout(collectNavigation, 0);
  setTimeout(enableFirebasePerformance, 2500);

  window.ArenaBDAObservability = Object.freeze({
    summary,
    report: (message, detail = '') => recordError('manual', `${message}${detail ? `: ${detail}` : ''}`),
    clear: () => localStorage.removeItem(KEY)
  });
})();
