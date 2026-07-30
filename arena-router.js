(() => {
  'use strict';

  const VALID_PAGES = new Set(['home', 'tournament', 'champions', 'teams', 'community', 'registrations', 'news', 'history']);
  let applyingRoute = false;
  let lastTournament = '';

  function currentUrl() { return new URL(location.href); }
  function pageFromUrl(url = currentUrl()) {
    const legacyNews = url.searchParams.has('news');
    const view = legacyNews ? 'news' : url.searchParams.get('view') || 'home';
    return VALID_PAGES.has(view) ? view : 'home';
  }
  function routeState() {
    const url = currentUrl();
    return { page: pageFromUrl(url), tournament: url.searchParams.get('campeonato') || '' };
  }
  function writeRoute(page, options = {}) {
    if (!VALID_PAGES.has(page)) return;
    const url = currentUrl();
    url.searchParams.delete('news');
    if (page === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', page);
    if (page !== 'tournament' || !options.tournament) url.searchParams.delete('campeonato');
    if (page === 'tournament' && options.tournament) url.searchParams.set('campeonato', options.tournament);
    const state = { page, tournament: options.tournament || '' };
    if (options.replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }
  function updateMetadata(page, tournament = '') {
    const base = 'Arena BDA';
    const labels = {
      home: 'Campeonatos do Clã',
      tournament: 'Campeonatos',
      champions: 'Sala de Troféus',
      teams: 'Clubes',
      community: 'Comunidade',
      registrations: 'Inscrições',
      news: 'Notícias',
      history: 'História do Clã'
    };
    let title = `${base} | ${labels[page] || labels.home}`;
    if (page === 'tournament' && tournament) {
      const item = window.ArenaBDATournaments?.list?.().find(entry => entry.id === tournament);
      if (item?.name) title = `${item.name} | ${base}`;
    }
    document.title = title;
  }
  async function applyRoute(options = {}) {
    const { page, tournament } = routeState();
    applyingRoute = true;
    try {
      if (window.ArenaBDALazyFeatures && ['teams', 'news', 'history', 'tournament'].includes(page)) {
        await window.ArenaBDALazyFeatures.loadPage(page).catch(() => {
          if (typeof navigate === 'function') navigate(page);
        });
      } else if (typeof navigate === 'function') {
        navigate(page);
      }
      if (page === 'tournament' && tournament) {
        lastTournament = tournament;
        window.ArenaBDATournaments?.select?.(tournament, { navigate: false, scroll: options.scroll === true });
      }
      updateMetadata(page, tournament);
    } finally {
      applyingRoute = false;
    }
  }

  if (typeof window.navigate === 'function') {
    const originalNavigate = window.navigate;
    window.navigate = function routedNavigate(page) {
      originalNavigate(page);
      if (!applyingRoute && VALID_PAGES.has(page)) {
        const tournament = page === 'tournament' ? (lastTournament || window.ArenaBDATournaments?.selected?.() || '') : '';
        writeRoute(page, { tournament });
        updateMetadata(page, tournament);
      }
    };
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-go],[data-mobile-go],[data-sheet-go]');
    const page = trigger?.dataset.go || trigger?.dataset.mobileGo || trigger?.dataset.sheetGo;
    if (!page || !VALID_PAGES.has(page)) return;
    if (!applyingRoute) {
      const tournament = page === 'tournament' ? (lastTournament || window.ArenaBDATournaments?.selected?.() || '') : '';
      writeRoute(page, { tournament });
      updateMetadata(page, tournament);
    }
  }, true);

  window.addEventListener('arena:tournament-selected', event => {
    const id = event.detail?.id || '';
    if (!id) return;
    lastTournament = id;
    if (!applyingRoute) writeRoute('tournament', { tournament: id, replace: pageFromUrl() === 'tournament' });
    updateMetadata('tournament', id);
  });
  window.addEventListener('popstate', () => applyRoute({ scroll: false }));
  window.addEventListener('arena:ready', () => applyRoute({ scroll: false }), { once: true });

  const initial = routeState();
  history.replaceState(initial, '', location.href);
  applyRoute({ scroll: false });

  window.ArenaBDARouter = Object.freeze({
    state: routeState,
    open: (page, options = {}) => {
      writeRoute(page, options);
      return applyRoute({ scroll: options.scroll });
    }
  });
})();
