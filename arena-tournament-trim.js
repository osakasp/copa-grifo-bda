(() => {
  'use strict';

  if (window.ArenaBDATournamentTrim?.version >= 1) return;

  const LABELS = new Set([
    'previa do proximo jogo',
    'central ao vivo',
    'regulamento'
  ]);

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

  function trim() {
    const page = document.querySelector('[data-page="tournament"]');
    if (!page) return 0;

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
    return targets.size;
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
    version: 1,
    trim,
    labels: Object.freeze([...LABELS])
  });

  trim();
})();
