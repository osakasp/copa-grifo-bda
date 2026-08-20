(() => {
  'use strict';

  const selectors = '[data-page="community"],[data-go="community"],[data-mobile-go="community"],[data-sheet-go="community"]';
  document.querySelectorAll(selectors).forEach(node => node.remove());
  try { localStorage.removeItem('bda-v2-chat'); } catch {}

  window.ArenaBDACommunity = Object.freeze({
    disabled: true,
    version: 'v3-clean',
    openOwnProfile: () => window.navigate?.('home')
  });
})();
