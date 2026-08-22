(() => {
  'use strict';

  if (window.ArenaBDAV3Cleanup?.version >= 9) return;

  const SUPER_LEAGUE_RULE_SRC = './super-league-rule-v2.js?v=20260821-1';
  const REPECHAGE_SRC = './super-league-repechage.js?v=20260821-1';
  const REDESIGN_SRC = './arena-redesign-v1.js?v=20260821-1';
  const MOBILE_POLISH_SRC = './arena-mobile-polish.js?v=20260821-1';
  const MOBILE_BRACKET_SRC = './arena-mobile-bracket-v3.js?v=20260821-1';
  const TEAM_EDITOR_SRC = './arena-team-editor.js?v=20260821-1';
  const TEAM_CLOUD_SYNC_SRC = './arena-team-cloud-sync.js?v=20260821-1';
  const TOURNAMENT_TRIM_SRC = './arena-tournament-trim.js?v=20260821-1';
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

  function ensureSuperLeagueRuleModule() {
    ensureScript({
      globalName: 'ArenaBDASuperLeagueRuleV2',
      selector: 'script[data-super-league-rule-v2]',
      src: SUPER_LEAGUE_RULE_SRC,
      datasetName: 'superLeagueRuleV2',
      label: 'a regra atual da Super League'
    });
  }

  function ensureRepechageModule() {
    if (window.ArenaBDASuperLeagueRuleV2?.version >= 2 || document.querySelector('script[data-super-league-rule-v2]')) return;
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

  function ensureMobilePolishModule() {
    ensureScript({
      globalName: 'ArenaBDAMobilePolish',
      selector: 'script[data-arena-mobile-polish]',
      src: MOBILE_POLISH_SRC,
      datasetName: 'arenaMobilePolish',
      label: 'o acabamento mobile da Arena'
    });
  }

  function ensureMobileBracketModule() {
    ensureScript({
      globalName: 'ArenaBDAMobileBracketV3',
      selector: 'script[data-arena-mobile-bracket-v3]',
      src: MOBILE_BRACKET_SRC,
      datasetName: 'arenaMobileBracketV3',
      label: 'o chaveamento mobile da Arena'
    });
  }

  function ensureTeamEditorModule() {
    ensureScript({
      globalName: 'ArenaBDATeamEditor',
      selector: 'script[data-arena-team-editor]',
      src: TEAM_EDITOR_SRC,
      datasetName: 'arenaTeamEditor',
      label: 'o editor administrativo de times'
    });
  }

  function ensureTeamCloudSyncModule() {
    ensureScript({
      globalName: 'ArenaBDATeamCloudSync',
      selector: 'script[data-arena-team-cloud-sync]',
      src: TEAM_CLOUD_SYNC_SRC,
      datasetName: 'arenaTeamCloudSync',
      label: 'a sincronização de renomeações de times'
    });
  }

  function ensureTournamentTrimModule() {
    ensureScript({
      globalName: 'ArenaBDATournamentTrim',
      selector: 'script[data-arena-tournament-trim]',
      src: TOURNAMENT_TRIM_SRC,
      datasetName: 'arenaTournamentTrim',
      label: 'a limpeza dos atalhos da tela de campeonato'
    });
  }

  function ensureSuperLeagueCloud() {
    const active = document.querySelector('#giManager[data-tid="bda-super-league"]');
    if (!active || typeof window.ArenaBDAEnsureCloud !== 'function') return;
    window.ArenaBDAEnsureCloud('super-league-public-sync').catch(() => {});
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
    ensureSuperLeagueRuleModule();
    ensureRepechageModule();
    ensureSuperLeagueCloud();
    ensureRedesignModule();
    ensureMobilePolishModule();
    ensureMobileBracketModule();
    ensureTeamCloudSyncModule();
    ensureTeamEditorModule();
    ensureTournamentTrimModule();
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
    version: 9,
    cleanup,
    superLeagueRuleSource: SUPER_LEAGUE_RULE_SRC,
    repechageSource: REPECHAGE_SRC,
    redesignSource: REDESIGN_SRC,
    mobilePolishSource: MOBILE_POLISH_SRC,
    mobileBracketSource: MOBILE_BRACKET_SRC,
    teamEditorSource: TEAM_EDITOR_SRC,
    teamCloudSyncSource: TEAM_CLOUD_SYNC_SRC,
    tournamentTrimSource: TOURNAMENT_TRIM_SRC,
    legacySelectors: Object.freeze([...LEGACY_SELECTORS])
  });

  cleanup();
})();
