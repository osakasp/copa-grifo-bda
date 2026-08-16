(() => {
  'use strict';

  const PRIMARY_PAGES = ['home', 'tournament', 'teams'];
  const SECONDARY_PAGES = ['champions', 'registrations', 'community', 'news', 'history', 'flash', 'season', 'feedback'];
  const MOBILE_PRIMARY_PAGES = ['home', 'tournament', 'teams'];
  const MOBILE_SECONDARY_PAGES = ['champions', 'registrations', 'community', 'news', 'history', 'flash', 'season', 'feedback'];
  const ORDER = [...PRIMARY_PAGES, ...SECONDARY_PAGES];
  const HISTORY_PAGE_KEY = 'arenaNavigationPage';
  const HISTORY_DEPTH_KEY = 'arenaNavigationDepth';
  const META = {
    home: ['01', 'Início', 'Visão geral da arena'],
    tournament: ['02', 'Campeonatos', 'Copas, ligas e confrontos'],
    registrations: ['03', 'Inscrições', 'Vagas e aprovações'],
    champions: ['04', 'Campeões', 'Sala de troféus'],
    teams: ['05', 'Times', 'Clubes cadastrados'],
    community: ['06', 'Comunidade', 'Arquibancada do clã'],
    news: ['07', 'Notícias', 'Comunicados e novidades'],
    history: ['08', 'História', 'Memória oficial do clã'],
    flash: ['09', 'Copas Flash', 'Edições rápidas'],
    season: ['10', 'Temporada', 'Calendário e classificação'],
    feedback: ['11', 'Feedback', 'Ajude a melhorar a Arena']
  };
  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6"/></svg>',
    tournament: '<svg viewBox="0 0 24 24"><path d="M8 4h8v3c0 4-1.8 7-4 7S8 11 8 7V4Z"/><path d="M8 6H5v1c0 3 1.6 5 4.2 5M16 6h3v1c0 3-1.6 5-4.2 5M12 14v4M8 21h8M9 18h6"/></svg>',
    registrations: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8.5 12l2.5 2.5 4.5-5"/></svg>',
    champions: '<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3Z"/></svg>',
    teams: '<svg viewBox="0 0 24 24"><path d="m12 3 8 3v5c0 5.2-3.4 8.6-8 10-4.6-1.4-8-4.8-8-10V6l8-3Z"/><path d="M9 12h6M12 9v6"/></svg>',
    community: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.4-3.6 2.2-5.5 5.5-5.5s5.1 1.9 5.5 5.5M14 15.5c.8-.5 1.8-.7 2.9-.7 2.5 0 3.9 1.6 4.1 4.5"/></svg>',
    news: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    history: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    flash: '<svg viewBox="0 0 24 24"><path d="m13.5 2-8 12H12l-1.5 8 8-12H12l1.5-8Z"/></svg>',
    season: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2"/></svg>',
    feedback: '<svg viewBox="0 0 24 24"><path d="M4 5h16v12H9l-5 4V5Z"/><path d="m9 11 2 2 4-4"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    notifications: '<svg viewBox="0 0 24 24"><path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 8H4c0-2 2.5-2 2.5-8Z"/><path d="M10 20h4"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v6H5V6h6"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const iconUrl = () => $('link[rel~="icon"]')?.href || './favicon.svg';
  const currentPage = () => $('.page.active')?.dataset.page || 'home';
  const navIcon = page => ICONS[page] || ICONS.more;
  window.ArenaBDAIcons = Object.freeze({ get: navIcon });

  let mobileNav;
  let sheet;
  let sheetTrigger;
  let pageBackButton;
  let viewportFrame = 0;

  function normalizePage(page) {
    return ORDER.includes(page) && $(`.page[data-page="${page}"]`) ? page : 'home';
  }

  function historyDepth() {
    const value = Number(window.history.state?.[HISTORY_DEPTH_KEY]);
    return Number.isInteger(value) && value > 0 ? value : 0;
  }

  function routeUrl(page) {
    const url = new URL(window.location.href);
    url.hash = page === 'home' ? '' : page;
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function routeState(page, depth) {
    const currentState = window.history.state;
    return {
      ...(currentState && typeof currentState === 'object' ? currentState : {}),
      [HISTORY_PAGE_KEY]: page,
      [HISTORY_DEPTH_KEY]: depth
    };
  }

  function syncPageBack() {
    if (!pageBackButton) return;
    const visible = historyDepth() > 0 || currentPage() !== 'home';
    pageBackButton.hidden = !visible;
    document.body.classList.toggle('arena-has-page-back', visible);
  }

  function installHistoryNavigation() {
    if (window.navigate?.arenaHistoryEnabled) return;

    const renderPage = typeof window.navigate === 'function'
      ? window.navigate.bind(window)
      : page => {
          $$('.page').forEach(item => item.classList.toggle('active', item.dataset.page === page));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    const requestedPage = normalizePage(window.location.hash.slice(1));

    const navigateWithHistory = (page, options = {}) => {
      const targetPage = normalizePage(page);
      const activePage = currentPage();
      const fromHistory = options?.fromHistory === true;

      if (!fromHistory && targetPage !== activePage) {
        const depth = historyDepth();
        if (options?.replace === true) {
          window.history.replaceState(routeState(targetPage, depth), '', routeUrl(targetPage));
        } else {
          window.history.pushState(routeState(targetPage, depth + 1), '', routeUrl(targetPage));
        }
      }

      renderPage(targetPage);
      closeSheet(false);
      requestAnimationFrame(() => {
        syncActive();
        syncPageBack();
      });
    };

    navigateWithHistory.arenaHistoryEnabled = true;
    window.navigate = navigateWithHistory;

    window.history.replaceState(routeState('home', 0), '', routeUrl('home'));
    renderPage('home');
    if (requestedPage !== 'home') {
      window.history.pushState(routeState(requestedPage, 1), '', routeUrl(requestedPage));
      renderPage(requestedPage);
    }

    window.addEventListener('popstate', event => {
      const statePage = event.state?.[HISTORY_PAGE_KEY];
      const hashPage = window.location.hash.slice(1);
      navigateWithHistory(normalizePage(statePage || hashPage), { fromHistory: true });
    });
  }

  function buildPageBack() {
    const topbar = $('.topbar');
    if (!topbar) return;

    pageBackButton = $('.arena-page-back', topbar);
    if (!pageBackButton) {
      pageBackButton = document.createElement('button');
      pageBackButton.type = 'button';
      pageBackButton.className = 'arena-page-back';
      pageBackButton.setAttribute('aria-label', 'Voltar para a página anterior');
      pageBackButton.innerHTML = '<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m14.5 5-7 7 7 7"/><path d="M8 12h10"/></svg></i><span>Voltar</span>';
      pageBackButton.addEventListener('click', () => {
        if (historyDepth() > 0) window.history.back();
        else window.navigate('home', { replace: true });
      });
      topbar.prepend(pageBackButton);
    }
    syncPageBack();
  }

  function go(page) {
    if (typeof navigate === 'function') navigate(page);
    else {
      $$('.page').forEach(item => item.classList.toggle('active', item.dataset.page === page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    closeSheet(false);
    requestAnimationFrame(syncActive);
  }

  function decorate(button) {
    if (!button) return;
    const meta = META[button.dataset.go];
    if (!meta || button.dataset.arenaDecorated === 'true') return;

    button.dataset.arenaDecorated = 'true';
    button.classList.add('arena-nav-item');
    button.title = `${meta[1]} • ${meta[2]}`;
    button.setAttribute('aria-label', meta[1]);
    button.innerHTML = `<i aria-hidden="true">${navIcon(button.dataset.go)}</i><span class="arena-nav-copy"><b>${meta[1]}</b><small>${meta[2]}</small></span>`;
  }

  function buildSidebar() {
    const nav = $('.bottom-nav');
    if (!nav) return;

    nav.classList.add('arena-side-nav');
    nav.setAttribute('aria-label', 'Navegação principal da Arena BDA');

    let brand = $('.arena-side-brand', nav);
    if (!brand) {
      brand = document.createElement('div');
      brand.className = 'arena-side-brand';
      brand.innerHTML = `<span class="arena-side-logo"><img src="${iconUrl()}" alt="Grifo da Arena BDA"></span><span><b>Arena BDA</b><small>Central do Clã</small></span>`;
      nav.prepend(brand);
    }

    let heading = $('.arena-side-heading', nav);
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'arena-side-heading';
      heading.textContent = 'Navegação';
      brand.after(heading);
    }

    const buttons = new Map($$('.nav-btn[data-go]', nav).map(button => [button.dataset.go, button]));
    ORDER.forEach(page => decorate(buttons.get(page)));

    const orderedButtons = ORDER.map(page => buttons.get(page)).filter(Boolean);
    const currentButtons = $$('.nav-btn[data-go]', nav);
    const isOrdered = orderedButtons.length === currentButtons.length && orderedButtons.every((button, index) => button === currentButtons[index]);
    if (!isOrdered) orderedButtons.forEach(button => nav.append(button));

    orderedButtons.forEach(button => {
      button.classList.toggle('arena-side-secondary', SECONDARY_PAGES.includes(button.dataset.go));
    });

    let more = $('.arena-side-more-toggle', nav);
    if (!more) {
      more = document.createElement('button');
      more.type = 'button';
      more.className = 'nav-btn arena-nav-item arena-side-more-toggle';
      more.innerHTML = `<i aria-hidden="true">${navIcon('more')}</i><span class="arena-nav-copy"><b>Mais</b><small>${SECONDARY_PAGES.length} áreas</small></span>`;
      more.addEventListener('click', () => setSidebarMore(!nav.classList.contains('arena-side-more-open')));
    }
    more.setAttribute('aria-label', 'Mostrar mais áreas');
    const firstSecondary = orderedButtons.find(button => button.classList.contains('arena-side-secondary'));
    if (firstSecondary) firstSecondary.before(more);
    const secondaryGroup = orderedButtons.filter(button => button.classList.contains('arena-side-secondary'));
    secondaryGroup.forEach((button, index) => {
      button.id = `arenaSecondaryNavigation${index + 1}`;
    });
    more.setAttribute('aria-controls', secondaryGroup.map(button => button.id).join(' '));

    if (!$('.arena-side-footer', nav)) {
      const footer = document.createElement('div');
      footer.className = 'arena-side-footer';
      footer.innerHTML = '<div><b>Site oficial</b><small>arenabda.com.br</small></div>';
      nav.append(footer);
    }
  }

  function setSidebarMore(open) {
    const nav = $('.arena-side-nav');
    const more = $('.arena-side-more-toggle', nav || document);
    if (!nav || !more) return;
    nav.classList.toggle('arena-side-more-open', open);
    more.setAttribute('aria-expanded', open ? 'true' : 'false');
    more.setAttribute('aria-label', open ? 'Ocultar áreas adicionais' : 'Mostrar mais áreas');
  }

  function mobileItem(page) {
    const [icon, label] = META[page];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'arena-mobile-item';
    button.dataset.mobileGo = page;
    button.innerHTML = `<i aria-hidden="true">${navIcon(page)}</i><span>${label}</span>`;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => go(page));
    return button;
  }

  function buildMobile() {
    if (!mobileNav) {
      mobileNav = document.createElement('nav');
      mobileNav.className = 'arena-mobile-nav';
      mobileNav.setAttribute('aria-label', 'Navegação móvel');
      MOBILE_PRIMARY_PAGES.forEach(page => mobileNav.append(mobileItem(page)));

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'arena-mobile-item';
      more.dataset.mobileMore = 'true';
      more.innerHTML = `<i aria-hidden="true">${navIcon('more')}</i><span>Mais</span>`;
      more.setAttribute('aria-label', 'Abrir mais opções');
      more.setAttribute('aria-controls', 'arenaMobileNavigationSheet');
      more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-haspopup', 'dialog');
      more.addEventListener('click', openSheet);
      mobileNav.append(more);
      document.body.append(mobileNav);
    }

    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'arena-nav-sheet-backdrop';
      sheet.id = 'arenaMobileNavigationSheet';
      sheet.setAttribute('aria-hidden', 'true');
      sheet.innerHTML = `
        <section class="arena-nav-sheet" role="dialog" aria-modal="true" aria-label="Mais opções">
          <header><div><span class="eyebrow">Arena BDA</span><h2>Mais opções</h2></div><button type="button" class="arena-sheet-close" aria-label="Fechar">×</button></header>
          <div class="arena-sheet-grid"></div>
          <footer><img src="${iconUrl()}" alt="Grifo"><span><b>Clã BDA</b><small>Todos os campeonatos em uma só arena.</small></span></footer>
        </section>`;

      MOBILE_SECONDARY_PAGES.forEach(page => {
        const [icon, label, description] = META[page];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'arena-sheet-item';
        button.dataset.sheetGo = page;
        button.innerHTML = `<i aria-hidden="true">${navIcon(page)}</i><span><b>${label}</b><small>${description}</small></span><em>›</em>`;
        button.addEventListener('click', () => go(page));
        $('.arena-sheet-grid', sheet).append(button);
      });

      $('.arena-sheet-close', sheet).addEventListener('click', closeSheet);
      sheet.addEventListener('click', event => event.target === sheet && closeSheet());
      document.body.append(sheet);
    }
  }

  function openSheet() {
    sheetTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheet?.classList.add('show');
    sheet?.setAttribute('aria-hidden', 'false');
    $('.arena-mobile-item[data-mobile-more]')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('arena-sheet-open');
    $('.arena-sheet-close', sheet)?.focus();
  }

  function closeSheet(restoreFocus = true) {
    const wasOpen = sheet?.classList.contains('show');
    const focusTarget = sheetTrigger;
    sheet?.classList.remove('show');
    sheet?.setAttribute('aria-hidden', 'true');
    $('.arena-mobile-item[data-mobile-more]')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('arena-sheet-open');
    sheetTrigger = null;
    if (restoreFocus && wasOpen && focusTarget?.isConnected) requestAnimationFrame(() => focusTarget.focus());
  }

  function trapSheetFocus(event) {
    if (event.key !== 'Tab' || !sheet?.classList.contains('show')) return;
    const focusable = $$('button:not([hidden]):not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', sheet)
      .filter(element => element.getClientRects().length > 0);
    if (!focusable.length) return event.preventDefault();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function syncActive() {
    const page = currentPage();

    setSidebarMore(SECONDARY_PAGES.includes(page));

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

    $$('.arena-app-tab[data-go]').forEach(button => {
      const active = button.dataset.go === page;
      button.classList.toggle('active', active);
      active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
    });

    const more = $('.arena-mobile-item[data-mobile-more]');
    if (more) {
      const active = MOBILE_SECONDARY_PAGES.includes(page);
      more.classList.toggle('active', active);
      active ? more.setAttribute('aria-current', 'page') : more.removeAttribute('aria-current');
    }

    const sideMore = $('.arena-side-more-toggle');
    if (sideMore) {
      const active = SECONDARY_PAGES.includes(page);
      sideMore.classList.toggle('active', active);
      active ? sideMore.setAttribute('aria-current', 'page') : sideMore.removeAttribute('aria-current');
    }

    syncPageBack();
  }

  function syncMobileViewport() {
    viewportFrame = 0;
    if (!mobileNav) return;
    const viewport = window.visualViewport;
    const coveredHeight = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
    const keyboardOpen = coveredHeight > 140;
    mobileNav.classList.toggle('keyboard-open', keyboardOpen);
    mobileNav.setAttribute('aria-hidden', keyboardOpen ? 'true' : 'false');
  }

  function scheduleViewportSync() {
    if (viewportFrame) return;
    viewportFrame = requestAnimationFrame(syncMobileViewport);
  }

  function init() {
    document.body.classList.add('arena-navigation-ready');
    installHistoryNavigation();
    buildPageBack();
    buildSidebar();
    buildMobile();
    syncActive();
    syncMobileViewport();
  }

  const style = document.createElement('style');
  style.textContent = `
    .arena-side-brand,.arena-side-heading,.arena-side-footer,.arena-mobile-nav,.arena-nav-sheet-backdrop{display:none}
    .arena-skip-link{position:fixed;left:50%;top:8px;z-index:1000;min-height:44px;padding:0 16px;display:flex;align-items:center;border:2px solid var(--gold-soft);border-radius:8px;color:#171107;background:var(--gold-soft);font-size:13px;font-weight:850;text-decoration:none;transform:translate(-50%,-140%)}
    .arena-skip-link:focus{transform:translate(-50%,0)}
    .topbar>.top-actions{margin-left:auto}
    .arena-page-back{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:82px;height:40px;flex:0 0 auto;padding:0 11px;border:1px solid var(--line);border-radius:6px;color:var(--text);background:transparent;font-size:12px;font-weight:750;line-height:1;white-space:nowrap}
    .arena-page-back[hidden]{display:none}
    .arena-page-back:hover{border-color:rgba(242,215,125,.42);background:rgba(255,255,255,.04)}
    .arena-page-back:focus-visible{outline:2px solid var(--gold-soft);outline-offset:2px}
    .arena-page-back i{display:grid;place-items:center;font-style:normal}
    .arena-page-back svg,.arena-nav-item i svg,.arena-mobile-item i svg,.arena-sheet-item i svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

    @media(min-width:981px){
      html{scroll-padding-top:90px}
      body.arena-navigation-ready{display:block;min-height:100vh;padding:0 18px 0 252px;text-align:left}
      body.arena-navigation-ready .app-shell{width:100%;max-width:1320px;margin:0 auto}
      body.arena-navigation-ready .topbar{top:12px;margin:12px 0 0;border:1px solid var(--line);border-radius:19px;background:rgba(5,10,8,.88);box-shadow:0 12px 34px rgba(0,0,0,.28)}
      body.arena-navigation-ready main{padding:20px 4px 36px}
      .bottom-nav.arena-side-nav{position:fixed;left:14px;top:14px;bottom:14px;z-index:45;width:220px;height:auto;min-height:0;transform:none;display:flex;flex-direction:column;gap:6px;padding:13px;border:1px solid rgba(242,215,125,.25);border-radius:25px;background:radial-gradient(circle at 50% 0,rgba(216,178,72,.19),transparent 27%),linear-gradient(180deg,rgba(12,27,19,.98),rgba(4,10,7,.98));box-shadow:0 24px 60px rgba(0,0,0,.52);backdrop-filter:blur(22px);overflow-x:hidden;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(242,215,125,.28) transparent}
      .bottom-nav.arena-side-nav::-webkit-scrollbar{width:5px}.bottom-nav.arena-side-nav::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(242,215,125,.28)}
      .arena-side-brand{display:flex;align-items:center;gap:11px;padding:8px 7px 16px;margin-bottom:2px;border-bottom:1px solid var(--line)}
      .arena-side-logo{overflow:hidden;width:48px;height:48px;flex:0 0 auto;border:1px solid rgba(242,215,125,.55);border-radius:15px;background:#020503;box-shadow:0 9px 24px rgba(216,178,72,.17)}
      .arena-side-logo img{display:block;width:100%;height:100%;object-fit:cover}
      .arena-side-brand b,.arena-side-brand small{display:block}.arena-side-brand b{font:800 21px/1 "Barlow Condensed",sans-serif;letter-spacing:.05em;text-transform:uppercase}.arena-side-brand small{margin-top:5px;color:var(--gold-soft);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
      .arena-side-heading{display:block;padding:8px 10px 3px;color:var(--muted);font-size:11px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}
      .arena-side-nav .nav-btn{position:relative;display:grid;grid-template-columns:40px 1fr;align-items:center;justify-items:stretch;gap:10px;width:100%;min-height:54px;padding:7px 9px;border:1px solid transparent;border-radius:15px;color:var(--muted);background:transparent;text-align:left;transition:transform .16s ease,border-color .16s ease,background .16s ease,color .16s ease}
      .arena-side-nav .arena-side-secondary{display:none}.arena-side-nav.arena-side-more-open .arena-side-secondary{display:grid}
      .arena-side-nav .nav-btn:hover{transform:translateX(3px);color:var(--text);border-color:var(--line);background:rgba(255,255,255,.045)}
      .arena-side-nav .nav-btn i{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04);font-size:19px;line-height:1}
      .arena-nav-copy{display:block;min-width:0}.arena-nav-copy b,.arena-nav-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.arena-nav-copy b{font-size:12px}.arena-nav-copy small{margin-top:4px;color:var(--muted);font-size:11px;font-weight:500}
      .arena-side-nav .nav-btn.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold));box-shadow:0 10px 24px rgba(216,178,72,.18)}.arena-side-nav .nav-btn.active i{border-color:rgba(23,17,7,.14);background:rgba(255,255,255,.28)}.arena-side-nav .nav-btn.active .arena-nav-copy small{color:rgba(23,17,7,.68)}.arena-side-nav .nav-btn.active:after{content:"";position:absolute;right:8px;width:5px;height:5px;border-radius:50%;background:#171107;box-shadow:0 0 0 4px rgba(23,17,7,.11)}
      .arena-side-footer{display:flex;align-items:center;gap:9px;margin-top:auto;padding:11px 9px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.035)}.arena-side-footer>span{color:var(--green);font-size:12px;text-shadow:0 0 12px var(--green)}.arena-side-footer b,.arena-side-footer small{display:block}.arena-side-footer b{font-size:11px;text-transform:uppercase}.arena-side-footer small{margin-top:3px;color:var(--muted);font-size:11px}
    }

    @media(min-width:981px) and (max-height:740px){
      .bottom-nav.arena-side-nav{gap:3px;padding-block:9px}.arena-side-brand{padding-bottom:10px}.arena-side-logo{width:42px;height:42px}.arena-side-nav .nav-btn{min-height:47px;padding-block:4px}.arena-side-nav .nav-btn i{width:35px;height:35px;font-size:17px}.arena-nav-copy small{display:none}.arena-side-footer{padding-block:8px}
    }

    @media(max-width:980px){
      body.arena-navigation-ready{padding-bottom:calc(74px + env(safe-area-inset-bottom))}
      .bottom-nav.arena-side-nav{display:none}
      .arena-page-back{width:40px;min-width:40px;height:40px;padding:0;border-radius:6px}
      .arena-page-back span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
      .arena-mobile-nav{position:fixed;left:8px;right:8px;bottom:max(6px,env(safe-area-inset-bottom));z-index:48;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;height:62px;padding:5px;border:1px solid rgba(242,215,125,.20);border-radius:19px;background:linear-gradient(180deg,rgba(15,31,22,.97),rgba(5,12,8,.985));box-shadow:0 12px 34px rgba(0,0,0,.48);backdrop-filter:blur(14px);transition:opacity .16s ease,transform .16s ease,visibility .16s}
      .arena-mobile-nav.keyboard-open{opacity:0;visibility:hidden;pointer-events:none;transform:translateY(calc(100% + 18px))}
      .arena-mobile-item{display:grid;place-items:center;align-content:center;gap:3px;min-width:0;min-height:50px;padding:3px 2px;border:0;border-radius:13px;color:var(--muted);background:transparent;font-size:11px;font-weight:800;line-height:1}.arena-mobile-item i{display:grid;place-items:center;width:28px;height:26px;border-radius:9px;font-style:normal;font-size:16px;line-height:1}.arena-mobile-item span{overflow:hidden;width:100%;text-overflow:ellipsis;white-space:nowrap}.arena-mobile-item.active{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold));box-shadow:0 6px 14px rgba(216,178,72,.15)}.arena-mobile-item.active i{background:rgba(255,255,255,.22)}
      .arena-nav-sheet-backdrop{position:fixed;inset:0;z-index:70;display:grid;align-items:end;padding:12px 12px max(12px,env(safe-area-inset-bottom));background:rgba(0,0,0,.68);opacity:0;visibility:hidden;backdrop-filter:blur(7px);transition:.2s}.arena-nav-sheet-backdrop.show{opacity:1;visibility:visible}.arena-nav-sheet{overflow-y:auto;width:min(100%,520px);max-height:calc(100dvh - 24px - env(safe-area-inset-bottom));margin:0 auto;padding:18px;border:1px solid rgba(242,215,125,.28);border-radius:24px;background:radial-gradient(circle at 90% 0,rgba(216,178,72,.18),transparent 31%),linear-gradient(155deg,#132a1d,#07100c);box-shadow:0 24px 70px rgba(0,0,0,.65);transform:translateY(18px);transition:.2s}.arena-nav-sheet-backdrop.show .arena-nav-sheet{transform:none}
      .arena-nav-sheet header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--line)}.arena-nav-sheet h2{margin:3px 0 0;font-size:27px;text-transform:uppercase}.arena-sheet-close{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;color:var(--text);background:rgba(255,255,255,.05);font-size:24px}.arena-sheet-grid{display:grid;gap:8px;margin:13px 0}
      .arena-sheet-item{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;width:100%;min-height:62px;padding:8px 11px;border:1px solid var(--line);border-radius:16px;color:var(--text);background:rgba(255,255,255,.035);text-align:left}.arena-sheet-item i{display:grid;place-items:center;width:43px;height:43px;border:1px solid rgba(242,215,125,.25);border-radius:13px;background:rgba(216,178,72,.08);font-style:normal;font-size:21px}.arena-sheet-item b,.arena-sheet-item small{display:block}.arena-sheet-item b{font-size:11px}.arena-sheet-item small{margin-top:4px;color:var(--muted);font-size:11px}.arena-sheet-item em{color:var(--gold-soft);font-size:26px;font-style:normal}
      .arena-nav-sheet footer{display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.arena-nav-sheet footer img{width:40px;height:40px;border:1px solid rgba(242,215,125,.4);border-radius:12px;object-fit:cover}.arena-nav-sheet footer b,.arena-nav-sheet footer small{display:block}.arena-nav-sheet footer b{font-size:11px;text-transform:uppercase}.arena-nav-sheet footer small{margin-top:3px;color:var(--muted);font-size:11px}body.arena-sheet-open{overflow:hidden}
    }

    @media(max-width:390px){.arena-page-back{width:38px;min-width:38px;height:38px}.arena-mobile-nav{left:5px;right:5px;gap:2px;padding-inline:4px}.arena-mobile-item{font-size:11px}.arena-mobile-item i{width:27px;height:25px;font-size:15px}}
    @media(prefers-reduced-transparency:reduce){.arena-mobile-nav,.arena-nav-sheet-backdrop{backdrop-filter:none}}
  `;
  document.head.append(style);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-go], [data-mobile-go], [data-sheet-go]')) setTimeout(syncActive, 20);
  });
  document.addEventListener('keydown', event => {
    trapSheetFocus(event);
    if (event.key !== 'Escape') return;
    closeSheet();
    setSidebarMore(false);
  });
  window.visualViewport?.addEventListener('resize', scheduleViewportSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleViewportSync, { passive: true });
  window.addEventListener('resize', scheduleViewportSync, { passive: true });

  const pageObserver = new MutationObserver(syncActive);
  $$('.page').forEach(page => pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] }));

  init();
})();
