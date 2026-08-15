(() => {
  'use strict';
  if (window.ArenaBDAPageLifecycle) return;

  const PAGE_SELECTOR = '.page[data-page]';
  const states = new WeakMap();
  const originalNavigate = typeof window.navigate === 'function'
    ? window.navigate.bind(window)
    : null;
  let syncFrame = 0;

  function pages() {
    return [...document.querySelectorAll(PAGE_SELECTOR)];
  }

  function stateFor(page) {
    let state = states.get(page);
    if (!state) {
      state = { fragment: null };
      states.set(page, state);
    }
    return state;
  }

  function resume(page) {
    if (!page) return false;
    const state = stateFor(page);
    if (!state.fragment) {
      page.removeAttribute('data-arena-suspended');
      return false;
    }

    page.appendChild(state.fragment);
    state.fragment = null;
    page.removeAttribute('data-arena-suspended');
    return true;
  }

  function suspend(page) {
    if (!page || page.classList.contains('active') || !page.childNodes.length) return false;
    const state = stateFor(page);
    const fragment = document.createDocumentFragment();
    while (page.firstChild) fragment.appendChild(page.firstChild);

    // Conteudo novo inserido enquanto a pagina estava suspensa representa a
    // versao mais recente da area e substitui o fragmento anterior.
    state.fragment = fragment;
    page.dataset.arenaSuspended = 'true';
    return true;
  }

  function updateDiagnostics() {
    const allPages = pages();
    const mounted = allPages.filter(page => !page.hasAttribute('data-arena-suspended'));
    document.documentElement.dataset.arenaMountedPages = mounted.map(page => page.dataset.page).join(',');
    document.documentElement.dataset.arenaSuspendedPages = String(allPages.length - mounted.length);
    document.documentElement.dataset.arenaMountedElements = String(document.body.querySelectorAll('*').length);
  }

  function sync(target = null) {
    const allPages = pages();
    const active = target || allPages.find(page => page.classList.contains('active')) || allPages[0];
    if (!active) return;

    resume(active);
    allPages.forEach(page => {
      if (page !== active) suspend(page);
    });
    updateDiagnostics();
  }

  function scheduleSync() {
    if (syncFrame) return;
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      sync();
    });
  }

  function targetFor(pageName) {
    const safeName = String(pageName || 'home').replace(/[^a-z0-9_-]/gi, '');
    return document.querySelector(`${PAGE_SELECTOR}[data-page="${safeName}"]`)
      || document.querySelector(`${PAGE_SELECTOR}[data-page="home"]`);
  }

  function activate(pageName) {
    const target = targetFor(pageName);
    if (!target) return;

    // A area precisa voltar antes da navegacao porque alguns modulos atualizam
    // seu conteudo imediatamente depois de chamar navigate().
    resume(target);

    if (originalNavigate) originalNavigate(target.dataset.page);
    else {
      pages().forEach(page => page.classList.toggle('active', page === target));
      document.querySelectorAll('.nav-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.go === target.dataset.page);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    sync(target);
    window.dispatchEvent(new CustomEvent('arena:page-mounted', {
      detail: { page: target.dataset.page }
    }));
  }

  const main = document.querySelector('main') || document.body;
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => (
      mutation.type === 'childList'
      || (mutation.type === 'attributes' && mutation.target.matches?.(PAGE_SELECTOR))
    ))) scheduleSync();
  });
  observer.observe(main, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  window.navigate = activate;
  window.ArenaBDAPageLifecycle = Object.freeze({
    activate,
    resume: pageName => resume(targetFor(pageName)),
    refresh: scheduleSync,
    stats: () => ({
      elements: document.body.querySelectorAll('*').length,
      mounted: pages().filter(page => !page.hasAttribute('data-arena-suspended')).map(page => page.dataset.page),
      suspended: pages().filter(page => page.hasAttribute('data-arena-suspended')).map(page => page.dataset.page)
    })
  });

  sync();
})();
