(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let refreshTimer = 0;

  function go(page) {
    if (typeof navigate === 'function') navigate(page);
    else {
      $$('.page').forEach(item => item.classList.toggle('active', item.dataset.page === page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    requestAnimationFrame(syncActive);
  }

  function ensureTopShortcut() {
    const actions = $('.top-actions');
    if (!actions || $('#newsTopShortcut')) return;

    const button = document.createElement('button');
    button.id = 'newsTopShortcut';
    button.type = 'button';
    button.className = 'admin-btn news-top-shortcut';
    button.innerHTML = '<span>📰</span><b>Notícias</b>';
    button.setAttribute('aria-label', 'Abrir Notícias BDA');
    button.addEventListener('click', () => go('news'));
    actions.insertBefore(button, actions.firstChild);
  }

  function ensureDesktopButton() {
    const nav = $('.bottom-nav');
    if (!nav) return;

    let button = nav.querySelector('.nav-btn[data-go="news"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-btn';
      button.dataset.go = 'news';
    }

    if (button.dataset.newsNavFixed !== 'true') {
      button.dataset.newsNavFixed = 'true';
      button.dataset.arenaDecorated = 'true';
      button.classList.add('arena-nav-item', 'news-nav-item');
      button.title = 'Notícias • Comunicados, resultados e novidades';
      button.setAttribute('aria-label', 'Notícias');
      button.innerHTML = '<i>📰</i><span class="arena-nav-copy"><b>Notícias</b><small>Comunicados e novidades</small></span>';
    }

    const more = nav.querySelector('.arena-side-more-toggle');
    const footer = nav.querySelector('.arena-side-footer');
    if (more && more.nextElementSibling !== button) more.after(button);
    else if (!button.isConnected) footer ? nav.insertBefore(button, footer) : nav.append(button);
  }

  function syncActive() {
    const page = $('.page.active')?.dataset.page || 'home';

    $$('.arena-side-nav .nav-btn[data-go]').forEach(button => {
      const active = button.dataset.go === page;
      button.classList.toggle('active', active);
      active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
    });

    $$('.arena-mobile-item[data-mobile-go]').forEach(button => {
      const active = button.dataset.mobileGo === page;
      button.classList.toggle('active', active);
      active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
    });

    const more = $('.arena-mobile-item[data-mobile-more]');
    if (more) {
      const active = ['news', 'history', 'flash', 'season', 'teams', 'community', 'feedback'].includes(page);
      more.classList.toggle('active', active);
      active ? more.setAttribute('aria-current', 'page') : more.removeAttribute('aria-current');
    }

    $('#newsTopShortcut')?.classList.toggle('active', page === 'news');
  }

  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      ensureTopShortcut();
      ensureDesktopButton();
      syncActive();
    }, 0);
  }

  const style = document.createElement('style');
  style.id = 'newsNavigationFixStyles';
  style.textContent = `
    .news-top-shortcut{display:inline-flex;align-items:center;justify-content:center;gap:7px;color:var(--gold-soft);border-color:rgba(216,178,72,.35);background:rgba(216,178,72,.08)}
    .news-top-shortcut b{font-size:10px}.news-top-shortcut.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}
    .news-nav-item i,.news-mobile-item i{position:relative}.news-nav-item i:after,.news-mobile-item i:after{content:"";position:absolute;right:3px;top:3px;width:6px;height:6px;border-radius:50%;background:#4fdf8f;box-shadow:0 0 0 3px rgba(79,223,143,.12)}
    @media(max-width:520px){.news-top-shortcut{width:42px;padding:0}.news-top-shortcut b{display:none}}
  `;
  document.head.append(style);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-go],[data-mobile-go],[data-sheet-go]')) setTimeout(syncActive, 35);
  });

  window.ArenaDOMEvents.subscribe(refresh, { selector: '.bottom-nav,[data-page="news"],[data-go="news"]' });

  window.ArenaBDANewsNavigation = Object.freeze({ refresh, open: () => go('news') });
  refresh();
})();
