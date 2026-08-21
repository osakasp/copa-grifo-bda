(() => {
  'use strict';

  if (window.ArenaBDAV3Cleanup?.version >= 3) return;

  const REPECHAGE_SRC = './super-league-repechage.js?v=20260821-1';
  const REDESIGN_SRC = './arena-redesign-v1.js?v=20260821-1';
  const LEGACY_SELECTORS = [
    '[data-page="community"]',
    '[data-go="community"]',
    '[data-mobile-go="community"]',
    '[data-sheet-go="community"]'
  ];

  const LEGACY_SCRIPT_PARTS = [
    'super-league-standings-fix.js',
    'comunidade-social.js'
  ];

  function removeLegacyStorage() {
    try { localStorage.removeItem('bda-v2-chat'); } catch {}
    try { sessionStorage.removeItem('arena-community-last-route'); } catch {}
  }

  function removeLegacyScripts() {
    document.querySelectorAll('script[src]').forEach(script => {
      const src = String(script.getAttribute('src') || '');
      if (LEGACY_SCRIPT_PARTS.some(part => src.includes(part))) script.remove();
    });
  }

  function ensureScript({ globalName, selector, src, datasetName, label }) {
    if (window[globalName] || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset[datasetName] = 'true';
    script.addEventListener('error', () => console.warn(`[Arena BDA] Não foi possível carregar ${label}`), { once:true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  function ensureRepechageModule() {
    ensureScript({
      globalName: 'ArenaBDASuperLeagueRepechage',
      selector: 'script[data-super-league-repechage]',
      src: REPECHAGE_SRC,
      datasetName: 'superLeagueRepechage',
      label: 'a repescagem da Super League'
    });
  }

  function ensureRedesignModule() {
    ensureScript({
      globalName: 'ArenaBDARedesign',
      selector: 'script[data-arena-redesign]',
      src: REDESIGN_SRC,
      datasetName: 'arenaRedesign',
      label: 'o novo design da Arena'
    });
  }

  function neutralizeLegacyAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal || modal.dataset.arenaAuthReady === 'true') return;
    const text = String(modal.textContent || '').toLowerCase();
    if (!text.includes('pin') && !text.includes('demonstração visual') && !text.includes('demonstracao visual')) return;
    modal.dataset.arenaLegacyShell = 'true';
    modal.innerHTML = `
      <div class="modal">
        <span class="eyebrow">Gestão da Arena BDA</span>
        <h2>Acesso administrativo</h2>
        <p>O acesso seguro será preparado ao tocar em Entrar.</p>
      </div>`;
    modal.classList.remove('show');
  }

  function removeLegacyCommunity() {
    document.querySelectorAll(LEGACY_SELECTORS.join(',')).forEach(node => node.remove());
    document.querySelectorAll('.bottom-nav,.arena-mobile-nav').forEach(nav => {
      const visible = [...nav.querySelectorAll('button')].filter(button => button.isConnected && !button.hidden);
      if (visible.length) nav.style.gridTemplateColumns = `repeat(${visible.length},minmax(0,1fr))`;
    });
  }

  function scrubLegacyCopy() {
    const subtitle = document.querySelector('.brand-copy span');
    if (subtitle && /comunidade/i.test(subtitle.textContent || '')) {
      subtitle.textContent = 'Arena competitiva • Campeonatos do Clã';
    }
  }

  function cleanup() {
    document.documentElement.dataset.arenaUi = 'v3';
    removeLegacyStorage();
    removeLegacyCommunity();
    removeLegacyScripts();
    neutralizeLegacyAdminModal();
    scrubLegacyCopy();
    ensureRepechageModule();
    ensureRedesignModule();
  }

  let frame = 0;
  function scheduleCleanup() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      cleanup();
    });
  }

  ['arena:bundle-loaded','arena:cloud-ready','arena:auth-changed','arena:tournaments-updated']
    .forEach(type => window.addEventListener(type, scheduleCleanup));

  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAV3Cleanup = Object.freeze({
    version: 3,
    cleanup,
    repechageSource: REPECHAGE_SRC,
    redesignSource: REDESIGN_SRC,
    legacySelectors: Object.freeze([...LEGACY_SELECTORS])
  });

  cleanup();
})();
