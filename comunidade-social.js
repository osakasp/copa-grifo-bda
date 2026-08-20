(() => {
  'use strict';

  const selectors = '[data-page="community"],[data-go="community"],[data-mobile-go="community"],[data-sheet-go="community"]';
  const wasActive = Boolean(document.querySelector('[data-page="community"].active'));
  document.querySelectorAll(selectors).forEach(node => node.remove());
  try { localStorage.removeItem('bda-v2-chat'); } catch {}

  if (wasActive) requestAnimationFrame(() => window.navigate?.('home'));

  window.ArenaBDACommunity = Object.freeze({
    disabled: true,
    version: 'v3-clean',
    openOwnProfile: () => window.navigate?.('home')
  });
})();
