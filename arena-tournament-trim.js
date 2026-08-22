(() => {
  'use strict';

  if (window.ArenaBDATournamentTrim?.version >= 2) return;

  const LABELS = new Set([
    'previa do proximo jogo',
    'central ao vivo',
    'regulamento'
  ]);

  const FIXED_SELECTORS = [
    '#superLeagueGroupsOverview'
  ];

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

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
      if (text === label) {
        best = current;
      } else if (best) {
        break;
      }
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

  function trim() {
    const page = document.querySelector('[data-page="tournament"]');
    if (!page) return 0;

    ensureStyles();
    let removed = trimFixed(page);
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

  ['arena:bundle-loaded','arena:tournaments-updated','arena:matches-updated','arena:auth-changed']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDATournamentTrim = Object.freeze({
    version: 2,
    trim,
    labels: Object.freeze([...LABELS]),
    fixedSelectors: Object.freeze([...FIXED_SELECTORS])
  });

  trim();
})();
