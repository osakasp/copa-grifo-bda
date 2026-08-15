(() => {
  'use strict';
  if (window.ArenaBDAMediaPerformance) return;

  const CRITICAL_IMAGE = '.brand-mark img,.griffin img,.arena-side-logo img,.hero img,[data-media-priority="high"]';
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const coarsePointer = matchMedia('(hover: none) and (pointer: coarse)');
  let frame = 0;
  let runtimeLite = false;

  function isLiteMode() {
    return Boolean(
      matchMedia('(prefers-reduced-motion: reduce)').matches
      || coarsePointer.matches
      || runtimeLite
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

  function measureFrameBudget() {
    if (document.hidden || isLiteMode()) return;
    let samples = 0;
    let slowFrames = 0;
    let previous = performance.now();

    const sample = now => {
      const elapsed = now - previous;
      previous = now;
      if (elapsed > 25) slowFrames += 1;
      samples += 1;
      if (samples < 36) {
        requestAnimationFrame(sample);
        return;
      }
      if (slowFrames >= 8) {
        runtimeLite = true;
        syncPerformanceMode();
      }
      document.documentElement.dataset.arenaSlowFrames = String(slowFrames);
    };
    requestAnimationFrame(sample);
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
      html.arena-performance-lite .topbar{background:linear-gradient(180deg,#0a1810,#030906)!important}
      html.arena-performance-lite .arena-detail-nav,html.arena-performance-lite #giManager>nav,html.arena-performance-lite .pro-admin-bar{background:#040b07!important}
      html.arena-performance-lite .hero::before,html.arena-performance-lite .app::before,html.arena-performance-lite .app::after{filter:none!important}
      html.arena-performance-lite [data-page="home"] .hero::before,html.arena-performance-lite .arena-home-watermark,html.arena-performance-lite .champion-club-shield,html.arena-performance-lite .champion-club-shield::before{animation:none!important;will-change:auto!important}
      html.arena-performance-lite .app::before,html.arena-performance-lite .app::after{animation:none!important}
      html.arena-performance-lite .arena-button-ripple{display:none!important}
      html.arena-performance-lite .page.active{animation-duration:.18s!important;animation-timing-function:ease-out!important}
      html.arena-performance-lite .arena-notification-button.has-unread>span,html.arena-performance-lite .mc-live-pill.active i{animation:none!important}
      html.arena-performance-lite .arena-card,html.arena-performance-lite .gi-game,html.arena-performance-lite .home-command nav button{transition-duration:.12s!important}
      html.arena-performance-lite .modal-backdrop,html.arena-performance-lite .ame2-backdrop,html.arena-performance-lite .history-gallery-lightbox{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
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
  if (document.readyState === 'complete') setTimeout(measureFrameBudget, 900);
  else window.addEventListener('load', () => setTimeout(measureFrameBudget, 900), { once: true, passive: true });
  document.addEventListener('visibilitychange', syncVisibility, { passive: true });
  connection?.addEventListener?.('change', syncPerformanceMode, { passive: true });
  coarsePointer.addEventListener?.('change', syncPerformanceMode);
  window.ArenaDOMEvents?.subscribe(scheduleImages, { selector: 'img' });

  window.ArenaBDAMediaPerformance = Object.freeze({
    optimizeImages,
    refresh: () => {
      syncPerformanceMode();
      optimizeImages();
    }
  });
})();
