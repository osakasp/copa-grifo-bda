(() => {
  'use strict';

  if (window.ArenaBDATournamentTrim?.version >= 7) return;

  const REV = '20260822-6';
  const DESIGN_POLISH_SRC = `./arena-design-polish-v2.js?v=${REV}`;
  const MATCH_DETAILS_SRC = `./arena-match-details.js?v=${REV}`;
  const MATCH_MEDIA_SRC = `./arena-match-media.js?v=${REV}`;
  const LABELS = new Set([
    'previa do proximo jogo',
    'central ao vivo',
    'regulamento'
  ]);

  const MATCH_ACTION_LABELS = new Set([
    'previa',
    'ver previa',
    'previa do jogo',
    'ao vivo',
    'ver ao vivo'
  ]);

  const MATCH_CARD_SELECTOR = [
    '.gi-game',
    '.gip-card',
    '.match-card',
    '.game-card',
    '.partida-card',
    '.card-jogo',
    '.arena-v4-bracket-card',
    '.arena-provisional-card',
    '[data-card]',
    '[data-match-card]'
  ].join(',');

  const FIXED_SELECTORS = ['#superLeagueGroupsOverview'];

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  function ensureModule({ globalName, selector, src, datasetName, label, minVersion = 0 }) {
    const current = window[globalName];
    const version = Number(current?.version || 0);
    if (current && (minVersion <= 0 || version >= minVersion)) return;
    const existing = document.querySelector(selector);
    if (existing && !current) return;
    if (existing && current && minVersion > 0 && version < minVersion) existing.remove();
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[datasetName] = 'true';
    script.addEventListener('error', () => console.warn(`[Arena BDA] Não foi possível carregar ${label}`), { once:true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  function ensureDesignPolish() {
    ensureModule({ globalName:'ArenaBDADesignPolishV2', selector:'script[data-arena-design-polish-v2]', src:DESIGN_POLISH_SRC, datasetName:'arenaDesignPolishV2', label:'o acabamento visual v2', minVersion:2 });
  }

  function ensureMatchDetails() {
    ensureModule({ globalName:'ArenaBDAMatchDetails', selector:'script[data-arena-match-details-module]', src:MATCH_DETAILS_SRC, datasetName:'arenaMatchDetailsModule', label:'detalhes de partida e artilharia', minVersion:1 });
  }

  function ensureMatchMedia() {
    ensureModule({ globalName:'ArenaBDAMatchMedia', selector:'script[data-arena-match-media-module]', src:MATCH_MEDIA_SRC, datasetName:'arenaMatchMediaModule', label:'o print das partidas', minVersion:1 });
  }

  function matchingLabel(value) {
    const text = normalize(value);
    return LABELS.has(text) ? text : '';
  }

  function removableContainer(start, page, label) {
    let current = start;
    let best = null;
    let depth = 0;
    while (current && current !== page && depth < 6) {
      const text = normalize(current.textContent);
      if (text === label) best = current;
      else if (best) break;
      current = current.parentElement;
      depth += 1;
    }
    if (!best) return null;
    if (best.matches('summary')) return best.closest('details') || best;
    if (best.matches('button,a,[role="button"],details')) return best;
    const interactive = best.closest('button,a,summary,[role="button"],details');
    if (interactive && page.contains(interactive) && normalize(interactive.textContent) === label) {
      return interactive.matches('summary') ? interactive.closest('details') || interactive : interactive;
    }
    return best;
  }

  function ensureStyles() {
    if (document.getElementById('arenaTournamentTrimStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaTournamentTrimStyles';
    style.textContent = '#superLeagueGroupsOverview{display:none!important}';
    document.head.appendChild(style);
  }

  function trimFixed(page) {
    let count = 0;
    FIXED_SELECTORS.forEach(selector => {
      page.querySelectorAll(selector).forEach(node => {
        node.remove();
        count += 1;
      });
    });
    return count;
  }

  function trimMatchActions(page) {
    let removed = 0;
    page.querySelectorAll(MATCH_CARD_SELECTOR).forEach(card => {
      card.querySelectorAll('button,a,[role="button"]').forEach(control => {
        const label = normalize(control.textContent);
        if (!MATCH_ACTION_LABELS.has(label)) return;
        control.remove();
        removed += 1;
      });
    });
    return removed;
  }

  function trim() {
    ensureDesignPolish();
    const page = document.querySelector('[data-page="tournament"]');
    if (!page) return 0;
    ensureMatchDetails();
    ensureMatchMedia();
    ensureStyles();

    let removed = trimFixed(page);
    removed += trimMatchActions(page);
    const targets = new Set();
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const label = matchingLabel(textNode.nodeValue);
      if (!label || !(textNode.parentElement instanceof Element)) continue;
      const target = removableContainer(textNode.parentElement, page, label);
      if (target) targets.add(target);
    }

    targets.forEach(target => target.remove());
    removed += targets.size;
    return removed;
  }

  let frame = 0;
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      trim();
    });
  }

  ['arena:bundle-loaded','arena:tournaments-updated','arena:matches-updated','arena:auth-changed','arena:build-ready']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDATournamentTrim = Object.freeze({
    version:7,
    revision:REV,
    trim,
    trimMatchActions,
    designPolishSource:DESIGN_POLISH_SRC,
    matchDetailsSource:MATCH_DETAILS_SRC,
    matchMediaSource:MATCH_MEDIA_SRC,
    labels:Object.freeze([...LABELS]),
    matchActionLabels:Object.freeze([...MATCH_ACTION_LABELS]),
    fixedSelectors:Object.freeze([...FIXED_SELECTORS])
  });

  trim();
})();
