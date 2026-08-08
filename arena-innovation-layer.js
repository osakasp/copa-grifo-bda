(() => {
  'use strict';

  const VERSION = '2026.08-minimal';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const PAGES = Object.freeze({
    home: { icon: '01', label: 'Início', description: 'Visão geral da Arena', color: '#e3c45f', rgb: '227,196,95' },
    news: { icon: '02', label: 'Notícias', description: 'Comunicados oficiais', color: '#8eb8cc', rgb: '142,184,204' },
    history: { icon: '03', label: 'História', description: 'Memória do Clã BDA', color: '#c69c6b', rgb: '198,156,107' },
    tournament: { icon: '04', label: 'Campeonatos', description: 'Copas, ligas e confrontos', color: '#e3c45f', rgb: '227,196,95' },
    flash: { icon: '05', label: 'Copas Flash', description: 'Edições rápidas', color: '#a998c2', rgb: '169,152,194' },
    season: { icon: '06', label: 'Temporada', description: 'Calendário e classificação', color: '#8aaec7', rgb: '138,174,199' },
    registrations: { icon: '07', label: 'Inscrições', description: 'Vagas e aprovações', color: '#83b99b', rgb: '131,185,155' },
    champions: { icon: '08', label: 'Campeões', description: 'Títulos da Arena BDA', color: '#e3c45f', rgb: '227,196,95' },
    teams: { icon: '09', label: 'Times', description: 'Clubes cadastrados', color: '#7fb5aa', rgb: '127,181,170' },
    community: { icon: '10', label: 'Comunidade', description: 'Arquibancada do clã', color: '#a69abf', rgb: '166,154,191' },
    feedback: { icon: '11', label: 'Feedback', description: 'Ajude a melhorar a Arena', color: '#85b5bf', rgb: '133,181,191' }
  });

  document.documentElement.dataset.arenaInnovation = VERSION;
  document.body.classList.add('arena-innovation-2026', 'arena-minimal-2026');

  const style = document.createElement('style');
  style.id = 'arenaInnovationStyles';
  style.textContent = `
    body.arena-minimal-2026{
      --innovation-accent:#e3c45f;
      --innovation-accent-rgb:227,196,95;
      --bg:#050a07;
      --bg-soft:#07100b;
      --surface:#0b1710;
      --surface-2:#0f1d15;
      --surface-3:#13241a;
      --line:rgba(226,236,229,.10);
      --line-strong:rgba(var(--innovation-accent-rgb),.28);
      --shadow:none;
      --shadow-soft:none;
      --radius:16px;
      --radius-small:11px;
      background:#050a07!important;
    }

    body.arena-design-pro.arena-minimal-2026:before,
    body.arena-design-pro.arena-minimal-2026:after{display:none!important}
    body.arena-minimal-2026>.app-shell{position:relative;z-index:1}
    body.arena-minimal-2026 .page.active{animation:none!important}

    body.arena-minimal-2026 .topbar{
      min-height:68px!important;
      border-color:var(--line)!important;
      border-radius:14px!important;
      background:#09140d!important;
      box-shadow:none!important;
      backdrop-filter:none!important;
    }
    body.arena-minimal-2026 .topbar:after{display:none!important}
    body.arena-minimal-2026 .brand-mark{
      border-color:rgba(var(--innovation-accent-rgb),.25)!important;
      border-radius:11px!important;
      background:#07100b!important;
      box-shadow:none!important;
    }
    body.arena-minimal-2026 .brand-copy strong{font-size:21px!important;letter-spacing:.045em!important}
    body.arena-minimal-2026 .arena-top-status{
      min-height:36px;
      border-radius:10px;
      background:transparent;
    }
    body.arena-minimal-2026 .arena-top-status i{box-shadow:none}
    body.arena-minimal-2026 .icon-btn,
    body.arena-minimal-2026 .admin-btn{
      border-color:var(--line)!important;
      border-radius:10px!important;
      background:#0d1a12!important;
      box-shadow:none!important;
    }
    body.arena-minimal-2026 .icon-btn:hover,
    body.arena-minimal-2026 .admin-btn:hover{border-color:var(--line-strong)!important;transform:none!important}
    body.arena-minimal-2026 .admin-btn.active{background:var(--innovation-accent)!important}

    body.arena-minimal-2026 main{padding-top:16px!important}
    body.arena-minimal-2026 :is(.hero,.arena-hero,.rank-hero,.history-hero,.league-generator-head){
      border-color:var(--line)!important;
      border-radius:18px!important;
      box-shadow:none!important;
    }
    body.arena-minimal-2026 .hero{
      min-height:286px!important;
      padding:clamp(22px,4vw,32px)!important;
      background:linear-gradient(115deg,#10261a 0,#08110c 64%)!important;
    }
    body.arena-minimal-2026 .hero:before{opacity:.10!important;filter:grayscale(.35) contrast(1.05)!important}
    body.arena-minimal-2026 .hero:after{display:none!important}
    body.arena-minimal-2026 .hero h1{
      max-width:760px;
      margin-top:8px!important;
      font-size:clamp(40px,7vw,62px)!important;
      letter-spacing:-.02em!important;
    }
    body.arena-minimal-2026 .hero p{font-size:11px!important;line-height:1.6!important}
    body.arena-minimal-2026 .eyebrow{gap:7px;color:var(--innovation-accent)!important;letter-spacing:.13em!important}
    body.arena-minimal-2026 .eyebrow:before{width:14px;height:1px;background:var(--innovation-accent)}

    body.arena-minimal-2026 :is(.primary,.secondary,.ghost,.danger){
      min-height:41px!important;
      border-radius:10px!important;
      box-shadow:none!important;
      transition:border-color .15s ease,background .15s ease,color .15s ease!important;
    }
    body.arena-minimal-2026 .primary{background:var(--innovation-accent)!important}
    body.arena-minimal-2026 .secondary{background:#102018!important}
    body.arena-minimal-2026 .ghost{background:transparent!important}
    body.arena-minimal-2026 .danger{background:rgba(255,114,128,.08)!important}
    body.arena-minimal-2026 :is(.primary,.secondary,.ghost,.danger):hover{transform:none!important;filter:none!important}

    body.arena-minimal-2026 .section-head{
      margin-top:26px!important;
      margin-bottom:12px!important;
      padding-left:0!important;
    }
    body.arena-minimal-2026 .section-head:before{display:none!important}
    body.arena-minimal-2026 .section-head h2{font-size:clamp(22px,4vw,28px)!important;letter-spacing:0!important}
    body.arena-minimal-2026 .arena-section-accent:after{
      content:"";
      display:block;
      width:28px;
      height:1px;
      margin-top:8px;
      background:var(--innovation-accent);
    }

    body.arena-minimal-2026 :where(.card,.arena-card,.champion-card,.team-card,.stat,.arena-stat,.gi-game,.rank-podium-card,.rank-hall article,.rank-rules article,.league-groups-preview article,.history-values article,.history-timeline article,.history-gallery-card,.registration-card,.registration-admin-card,.auto-standing-card,.champion-ranking-row,.champion-ranking-podium-card){
      border-color:var(--line)!important;
      border-radius:13px!important;
      background:#0b1710!important;
      box-shadow:none!important;
      transition:border-color .15s ease!important;
    }
    body.arena-minimal-2026 :where(.card,.arena-card,.champion-card,.team-card,.stat,.arena-stat,.gi-game,.rank-podium-card,.league-groups-preview article,.history-values article,.history-gallery-card):hover{
      border-color:rgba(var(--innovation-accent-rgb),.24)!important;
      box-shadow:none!important;
      transform:none!important;
    }
    body.arena-minimal-2026 .stat{min-height:82px;border-radius:12px!important}
    body.arena-minimal-2026 .stat:after{display:none!important}
    body.arena-minimal-2026 :is(.live-card,.match-list,.rank-table-wrap){border-radius:13px!important}
    body.arena-minimal-2026 :is(.arena-cover,.champion-banner-frame,.history-gallery-media){background:#050a07!important}

    body.arena-minimal-2026 #arenaScrollProgress{height:1px;background:transparent}
    body.arena-minimal-2026 #arenaScrollProgress i{background:var(--innovation-accent)!important;box-shadow:none!important}
    body.arena-minimal-2026 #arenaBackToTop{
      width:40px;
      height:40px;
      border-color:var(--line)!important;
      border-radius:10px;
      color:var(--innovation-accent);
      background:#0b1710;
      box-shadow:none;
    }
    body.arena-minimal-2026 #arenaBackToTop:hover{transform:none}

    #arenaCommandTrigger{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      min-height:36px;
      padding:0 10px;
      border:1px solid var(--line);
      border-radius:10px;
      color:#d4ded7;
      background:transparent;
      font-size:8px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.06em;
      white-space:nowrap;
    }
    #arenaCommandTrigger i{color:var(--innovation-accent);font-size:13px;font-style:normal}
    #arenaCommandTrigger kbd{padding:2px 4px;border:1px solid var(--line);border-radius:4px;color:#8fa096;background:transparent;font:700 7px/1 Inter,sans-serif}
    #arenaCommandTrigger:hover{border-color:var(--line-strong)}

    .arena-command-backdrop{
      position:fixed;
      inset:0;
      z-index:190;
      display:grid;
      place-items:start center;
      padding:clamp(72px,12vh,120px) 14px 20px;
      background:rgba(0,0,0,.72);
      opacity:0;
      visibility:hidden;
      transition:opacity .14s ease,visibility .14s ease;
    }
    .arena-command-backdrop.show{opacity:1;visibility:visible}
    .arena-command-panel{
      width:min(100%,600px);
      max-height:min(680px,calc(100dvh - 110px));
      overflow:hidden;
      border:1px solid rgba(226,236,229,.14);
      border-radius:14px;
      background:#09140d;
      box-shadow:0 24px 70px rgba(0,0,0,.48);
    }
    .arena-command-head{display:flex;align-items:center;gap:9px;padding:10px;border-bottom:1px solid var(--line)}
    .arena-command-search{position:relative;flex:1}
    .arena-command-search i{position:absolute;left:12px;top:50%;z-index:2;transform:translateY(-50%);color:var(--innovation-accent);font-style:normal}
    .arena-command-search input{
      min-height:44px!important;
      padding:0 12px 0 36px!important;
      border-color:var(--line)!important;
      border-radius:9px!important;
      background:#06100a!important;
      font-size:11px!important;
      text-transform:none!important;
      letter-spacing:0!important;
    }
    .arena-command-close{width:42px;height:42px;border:1px solid var(--line);border-radius:9px;color:#d7e0da;background:transparent;font-size:20px}
    .arena-command-caption{display:flex;justify-content:space-between;gap:12px;padding:11px 13px 6px;color:#82938a;font-size:7px;font-weight:800;letter-spacing:.10em;text-transform:uppercase}
    .arena-command-caption span:last-child{color:var(--innovation-accent)}
    .arena-command-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;max-height:min(500px,calc(100dvh - 230px));overflow:auto;padding:7px 10px 11px}
    .arena-command-item{
      display:grid;
      grid-template-columns:34px minmax(0,1fr) auto;
      align-items:center;
      gap:9px;
      min-height:56px;
      padding:8px 9px;
      border:1px solid transparent;
      border-radius:9px;
      color:#edf2ee;
      background:transparent;
      text-align:left;
    }
    .arena-command-item:hover,.arena-command-item:focus-visible{border-color:var(--line);background:#0e1d14}
    .arena-command-item>i{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:8px;color:var(--innovation-accent);font:800 7px/1 Inter,sans-serif;font-style:normal}
    .arena-command-item b,.arena-command-item small{display:block}
    .arena-command-item b{font-size:10px}
    .arena-command-item small{margin-top:3px;color:#82938a;font-size:7px}
    .arena-command-item em{color:#75877d;font-size:17px;font-style:normal}
    .arena-command-empty{grid-column:1/-1;padding:28px;color:#82938a;text-align:center;font-size:10px}
    body.arena-command-open{overflow:hidden}

    @media(max-width:1180px){#arenaCommandTrigger span{display:none}}
    @media(max-width:720px){
      #arenaCommandTrigger{display:none!important}
      .arena-command-backdrop{align-items:end;padding:10px 10px max(10px,env(safe-area-inset-bottom))}
      .arena-command-panel{max-height:calc(100dvh - 20px);border-radius:13px}
      .arena-command-results{grid-template-columns:1fr;max-height:calc(100dvh - 168px)}
      .arena-command-caption span:first-child{display:none}
      body.arena-minimal-2026 .hero{min-height:260px!important;border-radius:15px!important}
    }
    @media(prefers-reduced-motion:reduce){.arena-command-backdrop{transition:none}}
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

  function renderCommandResults(container, query = '') {
    const normalize = value => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalized = normalize(query.trim());
    const entries = Object.entries(PAGES).filter(([, meta]) => !normalized || normalize(`${meta.label} ${meta.description}`).includes(normalized));
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
    trigger.innerHTML = '<i aria-hidden="true">⌕</i><span>Buscar</span><kbd>Ctrl K</kbd>';
    topActions?.prepend(trigger);

    const backdrop = document.createElement('div');
    backdrop.id = 'arenaCommandPalette';
    backdrop.className = 'arena-command-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `
      <section class="arena-command-panel" role="dialog" aria-modal="true" aria-labelledby="arenaCommandTitle">
        <header class="arena-command-head">
          <div class="arena-command-search"><i aria-hidden="true">⌕</i><input id="arenaCommandInput" type="search" autocomplete="off" placeholder="Buscar área" aria-label="Buscar área da Arena BDA"></div>
          <button class="arena-command-close" type="button" aria-label="Fechar">×</button>
        </header>
        <div class="arena-command-caption"><span id="arenaCommandTitle">Navegação</span><span>11 áreas</span></div>
        <div class="arena-command-results"></div>
      </section>`;
    document.body.append(backdrop);

    const input = $('#arenaCommandInput', backdrop);
    const results = $('.arena-command-results', backdrop);
    let previousFocus = null;

    const open = () => {
      previousFocus = document.activeElement;
      renderCommandResults(results);
      input.value = '';
      backdrop.classList.add('show');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('arena-command-open');
      setTimeout(() => input.focus(), 30);
    };
    const close = () => {
      backdrop.classList.remove('show');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('arena-command-open');
      previousFocus?.focus?.();
    };

    trigger.addEventListener('click', open);
    $('.arena-command-close', backdrop).addEventListener('click', close);
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
    const grid = $('.arena-sheet-grid');
    if (!grid || $('.arena-command-sheet', grid)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'arena-sheet-item arena-command-sheet';
    button.innerHTML = '<i aria-hidden="true">⌕</i><span><b>Buscar</b><small>Acessar qualquer área</small></span><em>›</em>';
    button.addEventListener('click', () => {
      $('.arena-nav-sheet-backdrop')?.classList.remove('show');
      document.body.classList.remove('arena-sheet-open');
      window.ArenaBDAQuickAccess?.open();
    });
    grid.prepend(button);
  }

  function enhanceSectionHeads(root = document) {
    $$('.section-head h2', root).forEach(heading => heading.classList.add('arena-section-accent'));
  }

  function syncPage() {
    const page = currentPage();
    const meta = PAGES[page] || PAGES.home;
    document.body.dataset.innovationPage = page;
    document.body.style.setProperty('--innovation-accent', meta.color);
    document.body.style.setProperty('--innovation-accent-rgb', meta.rgb);
    enhanceSectionHeads($(`.page[data-page="${page}"]`) || document);
  }

  function refresh() {
    installCommandPalette();
    installMobileCommandShortcut();
    enhanceSectionHeads();
    syncPage();
  }

  const pageObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'attributes' && mutation.target.classList.contains('page'))) syncPage();
    installMobileCommandShortcut();
  });
  pageObserver.observe($('.app-shell') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-go],[data-mobile-go],[data-sheet-go]')) setTimeout(syncPage, 30);
  });

  [0, 320, 900].forEach(delay => setTimeout(refresh, delay));
})();
