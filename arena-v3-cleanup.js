(() => {
  'use strict';

  if (window.ArenaBDAV3Cleanup?.version >= 17) return;

  const BUILD = 'v116';
  const REV = '20260822-9';
  const SUPER_LEAGUE_RULE_SRC = `./super-league-rule.js?v=${REV}`;
  const SUPER_LEAGUE_SYNC_SRC = `./arena-super-league-sync-gate.js?v=${REV}`;
  const REDESIGN_SRC = `./arena-redesign-v1.js?v=${REV}`;
  const MOBILE_POLISH_SRC = `./arena-mobile-polish.js?v=${REV}`;
  const MOBILE_BRACKET_SRC = `./arena-mobile-bracket-v4.js?v=${REV}`;
  const PROVISIONAL_KNOCKOUT_SRC = `./arena-provisional-knockout.js?v=${REV}`;
  const TEAM_EDITOR_SRC = `./arena-team-editor.js?v=${REV}`;
  const TEAM_CLOUD_SYNC_SRC = `./arena-team-cloud-sync.js?v=${REV}`;
  const TOURNAMENT_TRIM_SRC = `./arena-tournament-trim.js?v=${REV}`;
  const MATCH_DETAILS_SRC = `./arena-match-details.js?v=${REV}`;
  const MATCH_MEDIA_SRC = `./arena-match-media.js?v=${REV}`;

  const LEGACY_SELECTORS = [
    '[data-page="community"]',
    '[data-go="community"]',
    '[data-mobile-go="community"]',
    '[data-sheet-go="community"]'
  ];

  const LEGACY_SCRIPT_PARTS = [
    'super-league-standings-fix.js',
    'super-league-repechage.js',
    'super-league-rule-v2.js',
    'super-league-rule-v3.js',
    'super-league-schedule-repair.js',
    'arena-mobile-bracket-v3.js',
    'comunidade-social.js'
  ];

  let announced = false;

  function versionOf(value) {
    const parsed = Number(value?.version || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

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

  function removeLegacySuperLeagueArtifacts() {
    [
      'superLeagueSecondPlaceRanking',
      'superLeagueThirdPlaceRanking',
      'superLeagueRepechageStyles',
      'superLeagueRuleV3Styles'
    ].forEach(id => document.getElementById(id)?.remove());
    try { delete window.ArenaBDASuperLeagueRuleV2; } catch {}
    try { delete window.ArenaBDASuperLeagueRuleV3; } catch {}
    try { delete window.ArenaBDASuperLeagueRepechage; } catch {}
    try { delete window.ArenaBDASuperLeagueScheduleRepair; } catch {}
  }

  function ensureScript({ globalName, selector, src, datasetName, label, minVersion = 0 }) {
    const current = window[globalName];
    if (current && (minVersion <= 0 || versionOf(current) >= minVersion)) return;

    const existing = document.querySelector(selector);
    if (existing && !current) return;
    if (existing && current && minVersion > 0 && versionOf(current) < minVersion) existing.remove();

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[datasetName] = 'true';
    script.dataset.arenaBuild = BUILD;
    script.addEventListener('error', () => console.warn(`[Arena BDA] Não foi possível carregar ${label}`), { once:true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  function ensureRedesignModule() {
    ensureScript({ globalName:'ArenaBDARedesign', selector:'script[data-arena-redesign]', src:REDESIGN_SRC, datasetName:'arenaRedesign', label:'o novo design da Arena' });
  }

  function ensureMobilePolishModule() {
    ensureScript({ globalName:'ArenaBDAMobilePolish', selector:'script[data-arena-mobile-polish]', src:MOBILE_POLISH_SRC, datasetName:'arenaMobilePolish', label:'o acabamento mobile da Arena' });
  }

  function ensureSuperLeagueRuleModule() {
    ensureScript({ globalName:'ArenaBDASuperLeagueRule', selector:'script[data-super-league-rule]', src:SUPER_LEAGUE_RULE_SRC, datasetName:'superLeagueRule', label:'a regra atual da Super League', minVersion:2 });
  }

  function ensureSuperLeagueSyncModule() {
    ensureScript({ globalName:'ArenaBDASuperLeagueSyncGate', selector:'script[data-super-league-sync-gate]', src:SUPER_LEAGUE_SYNC_SRC, datasetName:'superLeagueSyncGate', label:'a sincronização entre aparelhos da Super League', minVersion:3 });
  }

  function ensureMobileBracketModule() {
    ensureScript({ globalName:'ArenaBDAMobileBracketV4', selector:'script[data-arena-mobile-bracket-v4]', src:MOBILE_BRACKET_SRC, datasetName:'arenaMobileBracketV4', label:'o chaveamento atual da Super League', minVersion:6 });
  }

  function ensureProvisionalKnockoutModule() {
    ensureScript({ globalName:'ArenaBDAProvisionalKnockout', selector:'script[data-arena-provisional-knockout]', src:PROVISIONAL_KNOCKOUT_SRC, datasetName:'arenaProvisionalKnockout', label:'as vagas confirmadas das eliminatórias', minVersion:2 });
  }

  function ensureTeamEditorModule() {
    ensureScript({ globalName:'ArenaBDATeamEditor', selector:'script[data-arena-team-editor]', src:TEAM_EDITOR_SRC, datasetName:'arenaTeamEditor', label:'o editor administrativo de times' });
  }

  function ensureTeamCloudSyncModule() {
    ensureScript({ globalName:'ArenaBDATeamCloudSync', selector:'script[data-arena-team-cloud-sync]', src:TEAM_CLOUD_SYNC_SRC, datasetName:'arenaTeamCloudSync', label:'a sincronização de renomeações de times' });
  }

  function ensureTournamentTrimModule() {
    ensureScript({ globalName:'ArenaBDATournamentTrim', selector:'script[data-arena-tournament-trim]', src:TOURNAMENT_TRIM_SRC, datasetName:'arenaTournamentTrim', label:'a limpeza dos atalhos da tela de campeonato', minVersion:7 });
  }

  function ensureMatchDetailsModule() {
    ensureScript({ globalName:'ArenaBDAMatchDetails', selector:'script[data-arena-match-details-module]', src:MATCH_DETAILS_SRC, datasetName:'arenaMatchDetailsModule', label:'os detalhes e a artilharia das partidas', minVersion:1 });
  }

  function ensureMatchMediaModule() {
    ensureScript({ globalName:'ArenaBDAMatchMedia', selector:'script[data-arena-match-media-module]', src:MATCH_MEDIA_SRC, datasetName:'arenaMatchMediaModule', label:'os prints das partidas', minVersion:1 });
  }

  function ensureSuperLeagueCloud() {
    const active = document.querySelector('#giManager[data-tid="bda-super-league"]');
    if (!active || typeof window.ArenaBDAEnsureCloud !== 'function') return;
    window.ArenaBDAEnsureCloud('super-league-public-sync').catch(() => {});
    window.ArenaBDASuperLeagueSyncGate?.startSync?.(false)?.catch?.(() => {});
  }

  function neutralizeLegacyAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal || modal.dataset.arenaAuthReady === 'true') return;
    const text = String(modal.textContent || '').toLowerCase();
    if (!text.includes('pin') && !text.includes('demonstração visual') && !text.includes('demonstracao visual')) return;
    modal.dataset.arenaLegacyShell = 'true';
    modal.innerHTML = '<div class="modal"><span class="eyebrow">Gestão da Arena BDA</span><h2>Acesso administrativo</h2><p>O acesso seguro será preparado ao tocar em Entrar.</p></div>';
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
    if (subtitle && /comunidade/i.test(subtitle.textContent || '')) subtitle.textContent = 'Arena competitiva • Campeonatos do Clã';
  }

  function announceBuild() {
    if (announced) return;
    announced = true;
    window.dispatchEvent(new CustomEvent('arena:build-ready', { detail:{ build:BUILD, revision:REV } }));
  }

  function cleanup() {
    document.documentElement.dataset.arenaUi = 'v3';
    document.documentElement.dataset.arenaBuild = BUILD;
    removeLegacyStorage();
    removeLegacyCommunity();
    removeLegacyScripts();
    removeLegacySuperLeagueArtifacts();
    neutralizeLegacyAdminModal();
    scrubLegacyCopy();
    ensureRedesignModule();
    ensureMobilePolishModule();
    ensureSuperLeagueRuleModule();
    ensureSuperLeagueSyncModule();
    ensureMobileBracketModule();
    ensureProvisionalKnockoutModule();
    ensureTeamCloudSyncModule();
    ensureTeamEditorModule();
    ensureTournamentTrimModule();
    ensureMatchDetailsModule();
    ensureMatchMediaModule();
    ensureSuperLeagueCloud();
    announceBuild();
  }

  let frame = 0;
  function scheduleCleanup() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      cleanup();
    });
  }

  ['arena:bundle-loaded','arena:cloud-ready','arena:auth-changed','arena:tournaments-updated','arena:matches-updated','arena:super-league-cloud-synced']
    .forEach(type => window.addEventListener(type, scheduleCleanup));

  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAV3Cleanup = Object.freeze({
    version:17,
    build:BUILD,
    revision:REV,
    cleanup,
    superLeagueRuleSource:SUPER_LEAGUE_RULE_SRC,
    superLeagueSyncSource:SUPER_LEAGUE_SYNC_SRC,
    redesignSource:REDESIGN_SRC,
    mobilePolishSource:MOBILE_POLISH_SRC,
    mobileBracketSource:MOBILE_BRACKET_SRC,
    provisionalKnockoutSource:PROVISIONAL_KNOCKOUT_SRC,
    teamEditorSource:TEAM_EDITOR_SRC,
    teamCloudSyncSource:TEAM_CLOUD_SYNC_SRC,
    tournamentTrimSource:TOURNAMENT_TRIM_SRC,
    matchDetailsSource:MATCH_DETAILS_SRC,
    matchMediaSource:MATCH_MEDIA_SRC,
    legacySelectors:Object.freeze([...LEGACY_SELECTORS])
  });

  cleanup();
})();
