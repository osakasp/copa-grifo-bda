(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function valueOf(element) {
    if (!element) return '–';
    const value = 'value' in element ? element.value : element.textContent;
    const text = String(value ?? '').trim();
    return text === '' ? '–' : text;
  }

  function syncGame(game) {
    if (!game) return;

    const scores = $$('.gip-scoreboard > .gi-score-input, .gip-scoreboard > .gi-score', game)
      .slice(0, 2)
      .map(valueOf);
    const teams = $$('.gi-team', game).slice(0, 2);

    if (scores.length !== 2 || teams.length !== 2) return;

    teams.forEach((team, index) => {
      let bridge = $('.arena-photo-score-bridge', team);
      if (!bridge) {
        bridge = document.createElement('span');
        bridge.className = 'gi-score arena-photo-score-bridge';
        bridge.setAttribute('aria-hidden', 'true');
        team.append(bridge);
      }
      bridge.textContent = scores[index];
    });
  }

  function syncFromTarget(target) {
    syncGame(target?.closest?.('.gi-game'));
  }

  document.addEventListener('pointerdown', event => {
    const button = event.target instanceof Element
      ? event.target.closest('[data-old-match-photo],.pro-game-photo')
      : null;
    if (button) syncFromTarget(button);
  }, true);

  document.addEventListener('click', event => {
    const button = event.target instanceof Element
      ? event.target.closest('[data-old-match-photo],.pro-game-photo')
      : null;
    if (button) syncFromTarget(button);
  }, true);

  document.addEventListener('input', event => {
    if (event.target instanceof Element && event.target.closest('.gip-scoreboard')) {
      syncFromTarget(event.target);
    }
  }, true);

  const observer = new MutationObserver(() => {
    $$('#giManager .gi-game').forEach(syncGame);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const style = document.createElement('style');
  style.textContent = '.arena-photo-score-bridge{display:none!important}';
  document.head.append(style);

  $$('#giManager .gi-game').forEach(syncGame);
})();
