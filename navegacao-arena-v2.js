(() => {
  'use strict';

  const PRIMARY_PAGES = ['home', 'tournament', 'registrations', 'champions', 'teams', 'community'];
  const SECONDARY_PAGES = ['news', 'history', 'flash', 'season', 'feedback'];
  const MOBILE_PRIMARY_PAGES = ['home', 'tournament', 'registrations', 'champions'];
  const MOBILE_SECONDARY_PAGES = ['news', 'history', 'flash', 'season', 'teams', 'community', 'feedback'];
  const ORDER = [...PRIMARY_PAGES, ...SECONDARY_PAGES];
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

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const iconUrl = () => $('link[rel~="icon"]')?.href || './favicon.svg';
  const currentPage = () => $('.page.active')?.dataset.page || 'home';

  let mobileNav;
  let sheet;
  let viewportFrame = 0;

  function go(page) {
    if (typeof navigate === 'function') navigate(page);
    else {
      $$('.page').forEach(item => item.classList.toggle('active', item.dataset.page === page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    closeSheet();
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
    button.innerHTML = `<i>${meta[0]}</i><span class="arena-nav-copy"><b>${meta[1]}</b><small>${meta[2]}</small></span>`;
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
      more.innerHTML = '<i>⋯</i><span class="arena-nav-copy"><b>Mais</b><small>5 áreas</small></span>';
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
    button.innerHTML = `<i>${icon}</i><span>${label}</span>`;
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
      more.innerHTML = '<i>☰</i><span>Mais</span>';
      more.setAttribute('aria-label', 'Abrir mais opções');
      more.addEventListener('click', openSheet);
      mobileNav.append(more);
      document.body.append(mobileNav);
    }

    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'arena-nav-sheet-backdrop';
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
        button.innerHTML = `<i>${icon}</i><span><b>${label}</b><small>${description}</small></span><em>›</em>`;
        button.addEventListener('click', () => go(page));
        $('.arena-sheet-grid', sheet).append(button);
      });

      $('.arena-sheet-close', sheet).addEventListener('click', closeSheet);
      sheet.addEventListener('click', event => event.target === sheet && closeSheet());
      document.body.append(sheet);
    }
  }

  function openSheet() {
    sheet?.classList.add('show');
    sheet?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('arena-sheet-open');
    $('.arena-sheet-close', sheet)?.focus();
  }

  function closeSheet() {
    sheet?.classList.remove('show');
    sheet?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('arena-sheet-open');
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
    buildSidebar();
    buildMobile();
    syncActive();
    syncMobileViewport();
  }

  const style = document.createElement('style');
  style.textContent = `
    .arena-side-brand,.arena-side-heading,.arena-side-footer,.arena-mobile-nav,.arena-nav-sheet-backdrop{display:none}

    @media(min-width:981px){
      html{scroll-padding-top:90px}
      body.arena-navigation-ready{display:block!important;min-height:100vh!important;padding:0 18px 0 252px!important;text-align:left!important}
      body.arena-navigation-ready .app-shell{width:100%!important;max-width:1320px!important;margin:0 auto!important}
      body.arena-navigation-ready .topbar{top:12px;margin:12px 0 0;border:1px solid var(--line);border-radius:19px;background:rgba(5,10,8,.88);box-shadow:0 12px 34px rgba(0,0,0,.28)}
      body.arena-navigation-ready main{padding:20px 4px 36px}
      .bottom-nav.arena-side-nav{position:fixed!important;left:14px!important;top:14px!important;bottom:14px!important;z-index:45!important;width:220px!important;height:auto!important;min-height:0!important;transform:none!important;display:flex!important;flex-direction:column!important;gap:6px!important;padding:13px!important;border:1px solid rgba(242,215,125,.25)!important;border-radius:25px!important;background:radial-gradient(circle at 50% 0,rgba(216,178,72,.19),transparent 27%),linear-gradient(180deg,rgba(12,27,19,.98),rgba(4,10,7,.98))!important;box-shadow:0 24px 60px rgba(0,0,0,.52)!important;backdrop-filter:blur(22px)!important;overflow-x:hidden!important;overflow-y:auto!important;scrollbar-width:thin;scrollbar-color:rgba(242,215,125,.28) transparent}
      .bottom-nav.arena-side-nav::-webkit-scrollbar{width:5px}.bottom-nav.arena-side-nav::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(242,215,125,.28)}
      .arena-side-brand{display:flex;align-items:center;gap:11px;padding:8px 7px 16px;margin-bottom:2px;border-bottom:1px solid var(--line)}
      .arena-side-logo{overflow:hidden;width:48px;height:48px;flex:0 0 auto;border:1px solid rgba(242,215,125,.55);border-radius:15px;background:#020503;box-shadow:0 9px 24px rgba(216,178,72,.17)}
      .arena-side-logo img{display:block;width:100%;height:100%;object-fit:cover}
      .arena-side-brand b,.arena-side-brand small{display:block}.arena-side-brand b{font:800 21px/1 "Barlow Condensed",sans-serif;letter-spacing:.05em;text-transform:uppercase}.arena-side-brand small{margin-top:5px;color:var(--gold-soft);font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
      .arena-side-heading{display:block;padding:8px 10px 3px;color:var(--muted);font-size:7px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}
      .arena-side-nav .nav-btn{position:relative;display:grid!important;grid-template-columns:40px 1fr!important;align-items:center!important;justify-items:stretch!important;gap:10px!important;width:100%!important;min-height:54px!important;padding:7px 9px!important;border:1px solid transparent!important;border-radius:15px!important;color:var(--muted)!important;background:transparent!important;text-align:left!important;transition:transform .16s ease,border-color .16s ease,background .16s ease,color .16s ease!important}
      .arena-side-nav .arena-side-secondary{display:none!important}.arena-side-nav.arena-side-more-open .arena-side-secondary{display:grid!important}
      .arena-side-nav .nav-btn:hover{transform:translateX(3px);color:var(--text)!important;border-color:var(--line)!important;background:rgba(255,255,255,.045)!important}
      .arena-side-nav .nav-btn i{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border:1px solid var(--line)!important;border-radius:12px!important;background:rgba(255,255,255,.04)!important;font-size:19px!important;line-height:1!important}
      .arena-nav-copy{display:block!important;min-width:0!important}.arena-nav-copy b,.arena-nav-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.arena-nav-copy b{font-size:10px}.arena-nav-copy small{margin-top:4px;color:var(--muted);font-size:7px;font-weight:500}
      .arena-side-nav .nav-btn.active{color:#171107!important;border-color:var(--gold)!important;background:linear-gradient(135deg,var(--gold-soft),var(--gold))!important;box-shadow:0 10px 24px rgba(216,178,72,.18)!important}.arena-side-nav .nav-btn.active i{border-color:rgba(23,17,7,.14)!important;background:rgba(255,255,255,.28)!important}.arena-side-nav .nav-btn.active .arena-nav-copy small{color:rgba(23,17,7,.68)!important}.arena-side-nav .nav-btn.active:after{content:"";position:absolute;right:8px;width:5px;height:5px;border-radius:50%;background:#171107;box-shadow:0 0 0 4px rgba(23,17,7,.11)}
      .arena-side-footer{display:flex;align-items:center;gap:9px;margin-top:auto;padding:11px 9px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.035)}.arena-side-footer>span{color:var(--green);font-size:10px;text-shadow:0 0 12px var(--green)}.arena-side-footer b,.arena-side-footer small{display:block}.arena-side-footer b{font-size:8px;text-transform:uppercase}.arena-side-footer small{margin-top:3px;color:var(--muted);font-size:7px}
    }

    @media(min-width:981px) and (max-height:740px){
      .bottom-nav.arena-side-nav{gap:3px!important;padding-block:9px!important}.arena-side-brand{padding-bottom:10px}.arena-side-logo{width:42px;height:42px}.arena-side-nav .nav-btn{min-height:47px!important;padding-block:4px!important}.arena-side-nav .nav-btn i{width:35px!important;height:35px!important;font-size:17px!important}.arena-nav-copy small{display:none}.arena-side-footer{padding-block:8px}
    }

    @media(max-width:980px){
      body.arena-navigation-ready{padding-bottom:calc(74px + env(safe-area-inset-bottom))!important}
      .bottom-nav.arena-side-nav{display:none!important}
      .arena-mobile-nav{position:fixed;left:8px;right:8px;bottom:max(6px,env(safe-area-inset-bottom));z-index:48;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;height:62px;padding:5px;border:1px solid rgba(242,215,125,.20);border-radius:19px;background:linear-gradient(180deg,rgba(15,31,22,.97),rgba(5,12,8,.985));box-shadow:0 12px 34px rgba(0,0,0,.48);backdrop-filter:blur(14px);transition:opacity .16s ease,transform .16s ease,visibility .16s}
      .arena-mobile-nav.keyboard-open{opacity:0;visibility:hidden;pointer-events:none;transform:translateY(calc(100% + 18px))}
      .arena-mobile-item{display:grid;place-items:center;align-content:center;gap:3px;min-width:0;min-height:50px;padding:3px 2px;border:0;border-radius:13px;color:var(--muted);background:transparent;font-size:7px;font-weight:800;line-height:1}.arena-mobile-item i{display:grid;place-items:center;width:28px;height:26px;border-radius:9px;font-style:normal;font-size:16px;line-height:1}.arena-mobile-item span{overflow:hidden;width:100%;text-overflow:ellipsis;white-space:nowrap}.arena-mobile-item.active{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold));box-shadow:0 6px 14px rgba(216,178,72,.15)}.arena-mobile-item.active i{background:rgba(255,255,255,.22)}
      .arena-nav-sheet-backdrop{position:fixed;inset:0;z-index:70;display:grid;align-items:end;padding:12px 12px max(12px,env(safe-area-inset-bottom));background:rgba(0,0,0,.68);opacity:0;visibility:hidden;backdrop-filter:blur(7px);transition:.2s}.arena-nav-sheet-backdrop.show{opacity:1;visibility:visible}.arena-nav-sheet{overflow-y:auto;width:min(100%,520px);max-height:calc(100dvh - 24px - env(safe-area-inset-bottom));margin:0 auto;padding:18px;border:1px solid rgba(242,215,125,.28);border-radius:24px;background:radial-gradient(circle at 90% 0,rgba(216,178,72,.18),transparent 31%),linear-gradient(155deg,#132a1d,#07100c);box-shadow:0 24px 70px rgba(0,0,0,.65);transform:translateY(18px);transition:.2s}.arena-nav-sheet-backdrop.show .arena-nav-sheet{transform:none}
      .arena-nav-sheet header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--line)}.arena-nav-sheet h2{margin:3px 0 0;font-size:27px;text-transform:uppercase}.arena-sheet-close{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;color:var(--text);background:rgba(255,255,255,.05);font-size:24px}.arena-sheet-grid{display:grid;gap:8px;margin:13px 0}
      .arena-sheet-item{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;width:100%;min-height:62px;padding:8px 11px;border:1px solid var(--line);border-radius:16px;color:var(--text);background:rgba(255,255,255,.035);text-align:left}.arena-sheet-item i{display:grid;place-items:center;width:43px;height:43px;border:1px solid rgba(242,215,125,.25);border-radius:13px;background:rgba(216,178,72,.08);font-style:normal;font-size:21px}.arena-sheet-item b,.arena-sheet-item small{display:block}.arena-sheet-item b{font-size:11px}.arena-sheet-item small{margin-top:4px;color:var(--muted);font-size:8px}.arena-sheet-item em{color:var(--gold-soft);font-size:26px;font-style:normal}
      .arena-nav-sheet footer{display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.arena-nav-sheet footer img{width:40px;height:40px;border:1px solid rgba(242,215,125,.4);border-radius:12px;object-fit:cover}.arena-nav-sheet footer b,.arena-nav-sheet footer small{display:block}.arena-nav-sheet footer b{font-size:9px;text-transform:uppercase}.arena-nav-sheet footer small{margin-top:3px;color:var(--muted);font-size:8px}body.arena-sheet-open{overflow:hidden}
    }

    @media(max-width:390px){.arena-mobile-nav{left:5px;right:5px;gap:2px;padding-inline:4px}.arena-mobile-item{font-size:6.5px}.arena-mobile-item i{width:27px;height:25px;font-size:15px}}
    @media(prefers-reduced-transparency:reduce){.arena-mobile-nav,.arena-nav-sheet-backdrop{backdrop-filter:none}}
  `;
  document.head.append(style);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-go], [data-mobile-go], [data-sheet-go]')) setTimeout(syncActive, 20);
  });
  document.addEventListener('keydown', event => {
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
