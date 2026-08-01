(() => {
  'use strict';
  if (window.ArenaBDAMediaPerformance) return;

  const CRITICAL_IMAGE = '.brand-mark img,.griffin img,.arena-side-logo img,.hero img,[data-media-priority="high"]';
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let frame = 0;

  function isLiteMode() {
    return Boolean(
      matchMedia('(prefers-reduced-motion: reduce)').matches
      || connection?.saveData
      || (navigator.deviceMemory && navigator.deviceMemory <= 4)
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    );
  }

  function syncPerformanceMode() {
    const lite = isLiteMode();
    document.documentElement.dataset.arenaPerformance = lite ? 'lite' : 'full';
    document.documentElement.classList.toggle('arena-performance-lite', lite);
    return lite;
  }

  function preserveImageRatio(image) {
    if (image.hasAttribute('width') || image.hasAttribute('height')) return;
    const apply = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      image.setAttribute('width', image.naturalWidth);
      image.setAttribute('height', image.naturalHeight);
    };
    if (image.complete) apply();
    else image.addEventListener('load', apply, { once: true, passive: true });
  }

  function optimizeImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.arenaMediaReady) return;
    const critical = image.matches(CRITICAL_IMAGE);
    image.decoding = 'async';
    image.loading = critical ? 'eager' : 'lazy';
    image.fetchPriority = critical ? 'high' : 'low';
    image.draggable = false;
    image.dataset.arenaMediaReady = 'true';
    preserveImageRatio(image);
  }

  function optimizeImages(root = document) {
    if (root instanceof HTMLImageElement) optimizeImage(root);
    root.querySelectorAll?.('img').forEach(optimizeImage);
  }

  function scheduleImages() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      optimizeImages();
    });
  }

  function installStyles() {
    if (document.getElementById('arenaMediaPerformanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaMediaPerformanceStyles';
    style.textContent = `
      img[data-arena-media-ready]{content-visibility:auto}
      .gi-phase,.stand-group,.rank-lower>section,.history-gallery-section,.club-profile-section{content-visibility:auto;contain-intrinsic-size:auto 560px}
      html.arena-page-hidden *{animation-play-state:paused!important}
      html.arena-performance-lite{scroll-behavior:auto!important}
      html.arena-performance-lite .topbar,html.arena-performance-lite .arena-side-nav,html.arena-performance-lite .arena-mobile-nav,html.arena-performance-lite .arena-detail-nav,html.arena-performance-lite #giManager>nav,html.arena-performance-lite .pro-admin-bar{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      html.arena-performance-lite .hero::before,html.arena-performance-lite .app::before,html.arena-performance-lite .app::after{filter:none!important;animation:none!important}
      @media (hover:none),(pointer:coarse){[class*="card"]:hover,button:hover,a:hover{transform:none!important}}
      @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;transition-delay:0s!important}}
    `;
    document.head.append(style);
  }

  function syncVisibility() {
    document.documentElement.classList.toggle('arena-page-hidden', document.hidden);
  }

  installStyles();
  syncPerformanceMode();
  syncVisibility();
  optimizeImages();
  document.addEventListener('visibilitychange', syncVisibility, { passive: true });
  connection?.addEventListener?.('change', syncPerformanceMode, { passive: true });
  window.ArenaDOMEvents?.subscribe(scheduleImages, { selector: 'img' });

  window.ArenaBDAMediaPerformance = Object.freeze({
    optimizeImages,
    refresh: () => {
      syncPerformanceMode();
      optimizeImages();
    }
  });
})();
