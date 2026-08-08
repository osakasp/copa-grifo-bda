(() => {
  'use strict';

  const VERSION = '2026.08';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  const PAGES = Object.freeze({
    home: { icon: '⌂', label: 'Início', description: 'Visão geral da Arena', color: '#f4d778', rgb: '244,215,120' },
    news: { icon: '📰', label: 'Notícias', description: 'Comunicados oficiais', color: '#7dccff', rgb: '125,204,255' },
    history: { icon: '📜', label: 'História', description: 'Memória do Clã BDA', color: '#efb36d', rgb: '239,179,109' },
    tournament: { icon: '🏆', label: 'Campeonatos', description: 'Copas, ligas e confrontos', color: '#f4d778', rgb: '244,215,120' },
    flash: { icon: '⚡', label: 'Copas Flash', description: 'Edições rápidas', color: '#c898ff', rgb: '200,152,255' },
    season: { icon: '🗓️', label: 'Temporada', description: 'Calendário e classificação', color: '#75bfff', rgb: '117,191,255' },
    registrations: { icon: '✍️', label: 'Inscrições', description: 'Vagas e aprovações', color: '#68e6a4', rgb: '104,230,164' },
    ranking: { icon: '📊', label: 'Ranking', description: 'Classificação geral', color: '#ffc96f', rgb: '255,201,111' },
    champions: { icon: '★', label: 'Campeões', description: 'Sala de Troféus', color: '#ffe08a', rgb: '255,224,138' },
    teams: { icon: '🛡', label: 'Times', description: 'Clubes cadastrados', color: '#72dfcf', rgb: '114,223,207' },
    community: { icon: '💬', label: 'Comunidade', description: 'Arquibancada do clã', color: '#ba9cff', rgb: '186,156,255' },
    feedback: { icon: '◆', label: 'Feedback', description: 'Ajude a melhorar a Arena', color: '#76d9ed', rgb: '118,217,237' }
  });

  const CARD_SELECTOR = [
    '.card', '.arena-card', '.champion-card', '.team-card', '.stat', '.arena-stat',
    '.champion-ranking-row', '.champion-ranking-podium-card', '.history-gallery-card',
    '.registration-card', '.auto-standing-card', '.gi-game', '.league-groups-preview article'
  ].join(',');

  const REVEAL_SELECTOR = [
    '.hero', '.home-command', '.home-tournaments', '.home-grid', '.arena-page-hero',
    '.champion-ranking', '.arena-card', '.champion-card', '.team-card',
    '.history-gallery-card', '.registration-card', '.rank-hero', '.history-hero'
  ].join(',');

  document.documentElement.dataset.arenaInnovation = VERSION;
  document.body.classList.add('arena-innovation-2026');
  if (navigator.connection?.saveData || document.documentElement.classList.contains('arena-performance-lite')) {
    document.body.classList.add('arena-innovation-lite');
  }

  const style = document.createElement('style');
  style.id = 'arenaInnovationStyles';
  style.textContent = `
    body.arena-innovation-2026{
      --innovation-accent:#f4d778;
      --innovation-accent-rgb:244,215,120;
      --innovation-pointer-x:72%;
      --innovation-pointer-y:12%;
      --innovation-glow-opacity:.18;
    }

    .arena-ambient-field{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;opacity:.82;contain:strict}
    .arena-ambient-field:before{content:"";position:absolute;inset:-20%;background:radial-gradient(circle at var(--innovation-pointer-x) var(--innovation-pointer-y),rgba(var(--innovation-accent-rgb),.13),transparent 24%);transition:background .35s ease}
    .arena-ambient-orb{position:absolute;border-radius:50%;filter:blur(3px);opacity:.55;will-change:transform}
    .arena-ambient-orb.one{right:-12vw;top:8vh;width:34vw;min-width:320px;aspect-ratio:1;border:1px solid rgba(var(--innovation-accent-rgb),.12);background:radial-gradient(circle,rgba(var(--innovation-accent-rgb),.08),transparent 68%);animation:arenaAmbientOne 18s ease-in-out infinite alternate}
    .arena-ambient-orb.two{left:9vw;bottom:-24vh;width:28vw;min-width:280px;aspect-ratio:1;border:1px solid rgba(88,229,154,.08);background:radial-gradient(circle,rgba(88,229,154,.055),transparent 70%);animation:arenaAmbientTwo 22s ease-in-out infinite alternate}
    .arena-ambient-grid{position:absolute;inset:0;opacity:.24;background-image:linear-gradient(rgba(var(--innovation-accent-rgb),.025) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--innovation-accent-rgb),.025) 1px,transparent 1px);background-size:72px 72px;mask-image:radial-gradient(circle at 75% 12%,black,transparent 68%)}
    @keyframes arenaAmbientOne{to{transform:translate3d(-7vw,8vh,0) scale(1.08)}}
    @keyframes arenaAmbientTwo{to{transform:translate3d(5vw,-6vh,0) scale(.92)}}
    body.arena-innovation-2026>.app-shell{position:relative;z-index:1}

    .arena-live-ribbon{position:relative;z-index:3;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;min-height:54px;margin:10px 1px 0;padding:8px 10px 8px 14px;border:1px solid rgba(var(--innovation-accent-rgb),.16);border-radius:16px;background:linear-gradient(90deg,rgba(var(--innovation-accent-rgb),.07),rgba(5,14,9,.74) 36%,rgba(255,255,255,.018));box-shadow:0 13px 34px rgba(0,0,0,.18);backdrop-filter:blur(16px)}
    .arena-live-ribbon>strong{display:flex;align-items:center;gap:9px;color:var(--innovation-accent);font-size:8px;letter-spacing:.15em;text-transform:uppercase;white-space:nowrap}
    .arena-live-ribbon>strong i{width:8px;height:8px;border-radius:50%;background:#61e9a1;box-shadow:0 0 0 5px rgba(97,233,161,.09),0 0 16px rgba(97,233,161,.48);animation:arenaSignalPulse 1.9s ease-in-out infinite}
    .arena-ribbon-track{display:flex;align-items:center;justify-content:center;gap:12px;min-width:0;overflow:hidden;color:#b7c8bd;font-size:8px;font-weight:800;letter-spacing:.075em;text-transform:uppercase;white-space:nowrap}
    .arena-ribbon-track i{width:3px;height:3px;flex:0 0 auto;border-radius:50%;background:rgba(var(--innovation-accent-rgb),.78);box-shadow:0 0 10px rgba(var(--innovation-accent-rgb),.45)}
    .arena-live-ribbon button{min-height:36px;padding:0 12px;border:1px solid rgba(var(--innovation-accent-rgb),.20);border-radius:10px;color:var(--innovation-accent);background:rgba(var(--innovation-accent-rgb),.055);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
    .arena-live-ribbon button:hover{border-color:rgba(var(--innovation-accent-rgb),.42);background:rgba(var(--innovation-accent-rgb),.10)}
    @keyframes arenaSignalPulse{50%{opacity:.46;transform:scale(.82)}}

    .arena-spotlight-card{--arena-card-x:50%;--arena-card-y:20%;position:relative!important;isolation:isolate}
    .arena-spotlight-card>.arena-card-glow{position:absolute!important;inset:0!important;z-index:0!important;border-radius:inherit!important;pointer-events:none!important;opacity:0;background:radial-gradient(300px circle at var(--arena-card-x) var(--arena-card-y),rgba(var(--innovation-accent-rgb),.115),transparent 58%);transition:opacity .2s ease!important}
    .arena-spotlight-card:hover>.arena-card-glow{opacity:1}
    .arena-spotlight-card>*:not(.arena-card-glow){position:relative;z-index:1}
    .arena-spotlight-card:after{transition:opacity .2s ease,transform .2s ease!important}

    .arena-hero-v4{--arena-hero-x:70%;--arena-hero-y:18%;perspective:1100px}
    .arena-hero-v4>.arena-hero-aura{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(420px circle at var(--arena-hero-x) var(--arena-hero-y),rgba(var(--innovation-accent-rgb),.15),transparent 64%);mix-blend-mode:screen;opacity:.72;transition:opacity .22s ease}
    .arena-hero-v4 .arena-hero-console{transform:perspective(900px) rotateX(var(--arena-tilt-y,0deg)) rotateY(var(--arena-tilt-x,0deg)) translate3d(0,0,0);transform-style:preserve-3d;transition:transform .18s ease-out,border-color .2s ease,box-shadow .2s ease}
    .arena-hero-v4.arena-hero-engaged .arena-hero-console{border-color:rgba(var(--innovation-accent-rgb),.24);box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 24px 64px rgba(0,0,0,.28),0 0 42px rgba(var(--innovation-accent-rgb),.055)}

    .arena-section-accent{position:relative}
    .arena-section-accent:after{content:"";position:absolute;left:0;bottom:-7px;width:clamp(42px,8vw,92px);height:2px;border-radius:999px;background:linear-gradient(90deg,var(--innovation-accent),transparent);box-shadow:0 0 13px rgba(var(--innovation-accent-rgb),.28)}
    #arenaScrollProgress i{background:linear-gradient(90deg,#5ce49b,var(--innovation-accent),var(--gold-soft))!important}
    .page.active .eyebrow{color:var(--innovation-accent)!important}
    .page.active :is(.primary,.nav-btn.active){--innovation-button-accent:var(--innovation-accent)}

    #arenaCommandTrigger{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 10px;border:1px solid rgba(var(--innovation-accent-rgb),.20);border-radius:12px;color:#d9e4dd;background:linear-gradient(145deg,rgba(var(--innovation-accent-rgb),.075),rgba(255,255,255,.025));font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}
    #arenaCommandTrigger i{color:var(--innovation-accent);font-size:14px;font-style:normal}
    #arenaCommandTrigger kbd{padding:3px 5px;border:1px solid rgba(255,255,255,.10);border-radius:6px;color:#aebfb4;background:rgba(0,0,0,.18);font:700 7px/1 Inter,sans-serif}
    #arenaCommandTrigger:hover{border-color:rgba(var(--innovation-accent-rgb),.42);transform:translateY(-1px)}

    .arena-command-backdrop{position:fixed;inset:0;z-index:190;display:grid;place-items:start center;padding:clamp(72px,12vh,130px) 14px 20px;background:rgba(0,0,0,.74);opacity:0;visibility:hidden;backdrop-filter:blur(18px) saturate(.8);transition:opacity .18s ease,visibility .18s ease}
    .arena-command-backdrop.show{opacity:1;visibility:visible}
    .arena-command-panel{width:min(100%,660px);max-height:min(720px,calc(100dvh - 110px));overflow:hidden;border:1px solid rgba(var(--innovation-accent-rgb),.28);border-radius:24px;background:radial-gradient(circle at 86% 0,rgba(var(--innovation-accent-rgb),.12),transparent 28%),linear-gradient(150deg,#10251a,#040b07 72%);box-shadow:0 36px 120px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.045);transform:translateY(-12px) scale(.985);transition:transform .2s cubic-bezier(.2,.8,.2,1)}
    .arena-command-backdrop.show .arena-command-panel{transform:none}
    .arena-command-head{display:flex;align-items:center;gap:10px;padding:13px;border-bottom:1px solid rgba(255,255,255,.08)}
    .arena-command-search{position:relative;flex:1}
    .arena-command-search i{position:absolute;left:13px;top:50%;z-index:2;transform:translateY(-50%);color:var(--innovation-accent);font-style:normal}
    .arena-command-search input{min-height:48px!important;padding:0 14px 0 40px!important;border-color:rgba(var(--innovation-accent-rgb),.20)!important;background:rgba(0,0,0,.23)!important;font-size:12px!important;text-transform:none!important;letter-spacing:0!important}
    .arena-command-close{width:46px;height:46px;border:1px solid rgba(255,255,255,.09);border-radius:13px;color:#d9e5dc;background:rgba(255,255,255,.035);font-size:21px}
    .arena-command-caption{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 15px 7px;color:#8fa195;font-size:7px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
    .arena-command-caption span:last-child{color:var(--innovation-accent)}
    .arena-command-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:min(520px,calc(100dvh - 245px));overflow:auto;padding:7px 12px 14px}
    .arena-command-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:64px;padding:9px 10px;border:1px solid rgba(255,255,255,.075);border-radius:15px;color:#eef4ef;background:rgba(255,255,255,.025);text-align:left;transition:transform .15s ease,border-color .15s ease,background .15s ease}
    .arena-command-item:hover,.arena-command-item:focus-visible{border-color:rgba(var(--innovation-accent-rgb),.30);background:rgba(var(--innovation-accent-rgb),.065);transform:translateY(-1px)}
    .arena-command-item>i{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(var(--innovation-accent-rgb),.17);border-radius:12px;background:rgba(var(--innovation-accent-rgb),.06);font-size:19px;font-style:normal}
    .arena-command-item b,.arena-command-item small{display:block}.arena-command-item b{font-size:10px}.arena-command-item small{margin-top:4px;color:#8fa195;font-size:7px}.arena-command-item em{color:var(--innovation-accent);font-size:20px;font-style:normal}
    .arena-command-empty{grid-column:1/-1;padding:34px;color:#93a499;text-align:center;font-size:10px}
    body.arena-command-open{overflow:hidden}

    .arena-reveal{transition:opacity .46s ease,transform .46s cubic-bezier(.2,.75,.2,1),filter .46s ease;transition-delay:var(--arena-reveal-delay,0ms)}
    .arena-motion-ready .arena-reveal:not(.is-visible){opacity:0;filter:saturate(.72);transform:translateY(18px) scale(.992)}
    .arena-reveal.is-visible{opacity:1;filter:none;transform:none}

    @media(max-width:1180px){#arenaCommandTrigger span{display:none}}
    @media(max-width:720px){
      #arenaCommandTrigger{display:none!important}
      .arena-live-ribbon{grid-template-columns:auto minmax(0,1fr);gap:10px;min-height:49px;margin-top:8px;padding:7px 10px;border-radius:14px}
      .arena-live-ribbon button{display:none}
      .arena-ribbon-track{justify-content:flex-start;overflow-x:auto;scrollbar-width:none}
      .arena-ribbon-track::-webkit-scrollbar{display:none}
      .arena-command-backdrop{align-items:end;padding:10px 10px max(10px,env(safe-area-inset-bottom))}
      .arena-command-panel{max-height:calc(100dvh - 20px);border-radius:22px}
      .arena-command-results{grid-template-columns:1fr;max-height:calc(100dvh - 180px)}
      .arena-command-caption span:first-child{display:none}
    }
    @media(max-width:420px){
      .arena-live-ribbon>strong{font-size:7px}.arena-ribbon-track{gap:9px;font-size:7px}
      .arena-command-panel{border-radius:19px}.arena-command-head{padding:10px}.arena-command-results{padding-inline:10px}
    }
    @media(prefers-reduced-motion:reduce){
      .arena-ambient-orb,.arena-live-ribbon>strong i{animation:none!important}
      .arena-reveal,.arena-motion-ready .arena-reveal:not(.is-visible){opacity:1!important;filter:none!important;transform:none!important;transition:none!important}
      .arena-hero-v4 .arena-hero-console{transform:none!important;transition:none!important}
    }
    body.arena-innovation-lite .arena-ambient-field{display:none}
    body.arena-innovation-lite .arena-spotlight-card>.arena-card-glow{display:none}
    body.arena-innovation-lite .arena-hero-v4 .arena-hero-console{transform:none!important}
  `;
  document.head.append(style);

  function go(page) {
    if (!PAGES[page]) return;
    if (typeof navigate === 'function') navigate(page);
    else {
      const target = $(`[data-go="${page}"]`) || $(`[data-mobile-go="${page}"]`) || $(`[data-sheet-go="${page}"]`);
      if (target) target.click();
      else $$('.page').forEach(section => section.classList.toggle('active', section.dataset.page === page));
    }
    syncPage();
  }

  function currentPage() {
    return $('.page.active')?.dataset.page || 'home';
  }

  function installAmbientField() {
    if ($('#arenaAmbientField')) return;
    const field = document.createElement('div');
    field.id = 'arenaAmbientField';
    field.className = 'arena-ambient-field';
    field.setAttribute('aria-hidden', 'true');
    field.innerHTML = '<i class="arena-ambient-orb one"></i><i class="arena-ambient-orb two"></i><i class="arena-ambient-grid"></i>';
    document.body.prepend(field);
  }

  function installLiveRibbon() {
    const home = $('[data-page="home"]');
    const hero = $('.hero', home);
    if (!home || !hero || $('#arenaLiveRibbon', home)) return;
    const ribbon = document.createElement('section');
    ribbon.id = 'arenaLiveRibbon';
    ribbon.className = 'arena-live-ribbon';
    ribbon.setAttribute('aria-label', 'Status da Arena BDA');
    ribbon.innerHTML = `
      <strong><i aria-hidden="true"></i><span data-arena-signal>Arena online</span></strong>
      <div class="arena-ribbon-track" aria-label="Recursos conectados">
        <span>Campeonatos</span><i></i><span>Ranking atualizado</span><i></i><span>Comunidade BDA</span><i></i><span>Temporada 2026</span>
      </div>
      <button type="button">Explorar arena →</button>`;
    ribbon.querySelector('button').addEventListener('click', () => go('tournament'));
    hero.after(ribbon);

    const cloudStatus = $('.cloud-status');
    const signal = $('[data-arena-signal]', ribbon);
    const syncSignal = () => {
      const text = cloudStatus?.textContent?.trim();
      signal.textContent = /sincronizado/i.test(text || '') ? 'Dados sincronizados' : 'Arena online';
    };
    syncSignal();
    if (cloudStatus) new MutationObserver(syncSignal).observe(cloudStatus, { childList: true, subtree: true });
  }

  function renderCommandResults(container, query = '') {
    const normalized = query.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const entries = Object.entries(PAGES).filter(([, meta]) => {
      const haystack = `${meta.label} ${meta.description}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return !normalized || haystack.includes(normalized);
    });
    container.innerHTML = entries.length ? entries.map(([page, meta]) => `
      <button class="arena-command-item" type="button" data-command-page="${page}">
        <i aria-hidden="true">${meta.icon}</i>
        <span><b>${meta.label}</b><small>${meta.description}</small></span>
        <em aria-hidden="true">›</em>
      </button>`).join('') : '<div class="arena-command-empty">Nenhuma área encontrada.</div>';
  }

  function installCommandPalette() {
    if ($('#arenaCommandPalette')) return;
    const topActions = $('.top-actions');
    const trigger = document.createElement('button');
    trigger.id = 'arenaCommandTrigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Abrir acesso rápido');
    trigger.innerHTML = '<i aria-hidden="true">⌕</i><span>Acesso rápido</span><kbd>Ctrl K</kbd>';
    if (topActions) topActions.prepend(trigger);

    const backdrop = document.createElement('div');
    backdrop.id = 'arenaCommandPalette';
    backdrop.className = 'arena-command-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `
      <section class="arena-command-panel" role="dialog" aria-modal="true" aria-labelledby="arenaCommandTitle">
        <header class="arena-command-head">
          <div class="arena-command-search"><i aria-hidden="true">⌕</i><input id="arenaCommandInput" type="search" autocomplete="off" placeholder="Buscar área da Arena BDA" aria-label="Buscar área da Arena BDA"></div>
          <button class="arena-command-close" type="button" aria-label="Fechar">×</button>
        </header>
        <div class="arena-command-caption"><span id="arenaCommandTitle">Navegação inteligente</span><span>12 áreas disponíveis</span></div>
        <div class="arena-command-results"></div>
      </section>`;
    document.body.append(backdrop);

    const input = $('#arenaCommandInput', backdrop);
    const results = $('.arena-command-results', backdrop);
    const closeButton = $('.arena-command-close', backdrop);
    let previousFocus = null;

    const open = () => {
      previousFocus = document.activeElement;
      renderCommandResults(results);
      input.value = '';
      backdrop.classList.add('show');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('arena-command-open');
      setTimeout(() => input.focus(), 40);
    };
    const close = () => {
      backdrop.classList.remove('show');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('arena-command-open');
      previousFocus?.focus?.();
    };

    trigger.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    input.addEventListener('input', () => renderCommandResults(results, input.value));
    results.addEventListener('click', event => {
      const button = event.target.closest('[data-command-page]');
      if (!button) return;
      go(button.dataset.commandPage);
      close();
    });
    backdrop.addEventListener('click', event => event.target === backdrop && close());
    document.addEventListener('keydown', event => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k';
      if (shortcut) {
        event.preventDefault();
        backdrop.classList.contains('show') ? close() : open();
      } else if (event.key === 'Escape' && backdrop.classList.contains('show')) close();
    });

    window.ArenaBDAQuickAccess = Object.freeze({ open, close });
  }

  function installMobileCommandShortcut() {
    const grid = $('.arena-nav-sheet-grid');
    if (!grid || $('.arena-command-sheet', grid)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'arena-sheet-item arena-command-sheet';
    button.innerHTML = '<i aria-hidden="true">⌕</i><span><b>Acesso rápido</b><small>Buscar qualquer área da Arena</small></span><em>›</em>';
    button.addEventListener('click', () => {
      $('.arena-nav-sheet-backdrop')?.classList.remove('show');
      document.body.classList.remove('arena-sheet-open');
      window.ArenaBDAQuickAccess?.open();
    });
    grid.prepend(button);
  }

  function enhanceCard(card, index = 0) {
    if (!(card instanceof HTMLElement) || card.classList.contains('arena-spotlight-card')) return;
    card.classList.add('arena-spotlight-card');
    card.style.setProperty('--arena-reveal-delay', `${Math.min(index % 5, 4) * 35}ms`);
    const glow = document.createElement('span');
    glow.className = 'arena-card-glow';
    glow.setAttribute('aria-hidden', 'true');
    card.prepend(glow);
  }

  function enhanceHero(hero) {
    if (!(hero instanceof HTMLElement) || hero.dataset.innovationHero === 'true') return;
    hero.dataset.innovationHero = 'true';
    const aura = document.createElement('span');
    aura.className = 'arena-hero-aura';
    aura.setAttribute('aria-hidden', 'true');
    hero.prepend(aura);
    hero.addEventListener('pointerleave', () => {
      hero.classList.remove('arena-hero-engaged');
      hero.style.setProperty('--arena-tilt-x', '0deg');
      hero.style.setProperty('--arena-tilt-y', '0deg');
    });
  }

  let revealObserver = null;
  function ensureRevealObserver() {
    if (revealObserver || reducedMotion.matches || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });
  }

  function enhanceReveal(element, index = 0) {
    if (!(element instanceof HTMLElement) || element.classList.contains('arena-reveal')) return;
    element.classList.add('arena-reveal');
    element.style.setProperty('--arena-reveal-delay', `${Math.min(index % 6, 5) * 38}ms`);
    const rect = element.getBoundingClientRect();
    if (reducedMotion.matches || rect.top < innerHeight * .94) element.classList.add('is-visible');
    else revealObserver?.observe(element);
  }

  function enhanceSectionHeads(root = document) {
    $$('.section-head h2', root).forEach(heading => heading.classList.add('arena-section-accent'));
  }

  function scan(root = document) {
    ensureRevealObserver();
    const cards = [
      ...(root.matches?.(CARD_SELECTOR) ? [root] : []),
      ...$$(CARD_SELECTOR, root)
    ];
    cards.forEach(enhanceCard);
    const revealItems = [
      ...(root.matches?.(REVEAL_SELECTOR) ? [root] : []),
      ...$$(REVEAL_SELECTOR, root)
    ];
    revealItems.forEach(enhanceReveal);
    $$('.arena-hero-v4', root).forEach(enhanceHero);
    enhanceSectionHeads(root);
  }

  function syncPage() {
    const page = currentPage();
    const meta = PAGES[page] || PAGES.home;
    document.body.dataset.innovationPage = page;
    document.body.style.setProperty('--innovation-accent', meta.color);
    document.body.style.setProperty('--innovation-accent-rgb', meta.rgb);
    const activePage = $(`.page[data-page="${page}"]`);
    if (activePage) requestAnimationFrame(() => scan(activePage));
  }

  let pointerFrame = 0;
  let pointerEvent = null;
  function handlePointer() {
    pointerFrame = 0;
    if (!pointerEvent || !finePointer.matches || reducedMotion.matches || document.body.classList.contains('arena-innovation-lite')) return;
    const event = pointerEvent;
    document.body.style.setProperty('--innovation-pointer-x', `${event.clientX}px`);
    document.body.style.setProperty('--innovation-pointer-y', `${event.clientY}px`);

    const card = event.target.closest?.('.arena-spotlight-card');
    if (card) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--arena-card-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--arena-card-y', `${event.clientY - rect.top}px`);
    }

    const hero = event.target.closest?.('.arena-hero-v4');
    if (hero) {
      const rect = hero.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      hero.classList.add('arena-hero-engaged');
      hero.style.setProperty('--arena-hero-x', `${x * 100}%`);
      hero.style.setProperty('--arena-hero-y', `${y * 100}%`);
      hero.style.setProperty('--arena-tilt-x', `${(x - .5) * 3.2}deg`);
      hero.style.setProperty('--arena-tilt-y', `${(.5 - y) * 2.4}deg`);
    }
  }

  document.addEventListener('pointermove', event => {
    pointerEvent = event;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(handlePointer);
  }, { passive: true });

  function refresh(root = document) {
    installAmbientField();
    installLiveRibbon();
    installCommandPalette();
    installMobileCommandShortcut();
    scan(root);
    syncPage();
    requestAnimationFrame(() => document.body.classList.add('arena-motion-ready'));
  }

  const pageObserver = new MutationObserver(mutations => {
    const pageChanged = mutations.some(mutation => mutation.type === 'attributes' && mutation.target.classList.contains('page'));
    const added = mutations.flatMap(mutation => [...mutation.addedNodes]).filter(node => node.nodeType === 1);
    if (pageChanged) syncPage();
    if (added.length) requestAnimationFrame(() => added.forEach(node => scan(node)));
    installMobileCommandShortcut();
  });
  pageObserver.observe($('.app-shell') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  reducedMotion.addEventListener?.('change', () => location.reload());
  document.addEventListener('click', event => {
    if (event.target.closest('[data-go],[data-mobile-go],[data-sheet-go]')) setTimeout(syncPage, 30);
  });

  [0, 280, 850, 1600].forEach(delay => setTimeout(() => refresh(), delay));
})();
