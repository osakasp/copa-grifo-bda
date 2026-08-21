(() => {
  'use strict';

  if (window.ArenaBDARedesign?.version >= 1) return;

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const STYLE_ID = 'arenaRedesignV1Styles';

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function games(id) {
    const list = matchStore()[id];
    return Array.isArray(list) ? list : [];
  }

  function statusPriority(status) {
    const value = normalize(status);
    if (value === 'em andamento') return 50;
    if (value === 'inscricoes abertas') return 40;
    if (value === 'planejado') return 25;
    if (value === 'finalizado') return 10;
    return 20;
  }

  function activity(tournament, index) {
    const tournamentActivity = Number(tournament?.updatedAt || tournament?.createdAt || 0);
    const matchActivity = games(tournament?.id).reduce((latest, game) => (
      Math.max(latest, Number(game?.updated || game?.created || 0))
    ), 0);
    return Math.max(tournamentActivity, matchActivity, 1000000 - index);
  }

  function currentTournament() {
    return tournaments()
      .map((tournament, index) => ({
        tournament,
        priority: statusPriority(tournament?.status),
        activity: activity(tournament, index)
      }))
      .sort((a, b) => b.priority - a.priority || b.activity - a.activity)[0]?.tournament || null;
  }

  function accentFor(tournament) {
    const token = normalize(`${tournament?.id || ''} ${tournament?.name || ''}`);
    if (token.includes('super league')) return { accent: '#b79cff', rgb: '183,156,255', soft: '#d4c5ff' };
    if (token.includes('grifo')) return { accent: '#d8b248', rgb: '216,178,72', soft: '#f1d97f' };
    if (token.includes('francos')) return { accent: '#72c9e8', rgb: '114,201,232', soft: '#a7e4f7' };
    if (token.includes('liga a')) return { accent: '#d9bd63', rgb: '217,189,99', soft: '#f1dc96' };
    if (token.includes('liga b')) return { accent: '#b5c0c8', rgb: '181,192,200', soft: '#dce3e8' };
    if (token.includes('flash')) return { accent: '#f3a35c', rgb: '243,163,92', soft: '#ffd0a5' };
    return { accent: '#d8b248', rgb: '216,178,72', soft: '#f1d97f' };
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --arena-context-accent:#d8b248;
        --arena-context-rgb:216,178,72;
        --arena-context-soft:#f1d97f;
      }

      body.arena-visual-system{
        --arena-accent:var(--arena-context-accent)!important;
        --arena-accent-rgb:var(--arena-context-rgb)!important;
        --arena-gold:var(--arena-context-accent)!important;
        --arena-gold-soft:var(--arena-context-soft)!important;
      }

      body.arena-visual-system .topbar{
        border:1px solid rgba(255,255,255,.075)!important;
        background:rgba(6,15,10,.96)!important;
      }
      body.arena-visual-system .brand-copy span{color:#8fa096!important}
      body.arena-visual-system .brand-mark{border-color:rgba(var(--arena-context-rgb),.28)!important}
      body.arena-visual-system .primary{
        border-color:rgba(var(--arena-context-rgb),.92)!important;
        background:var(--arena-context-accent)!important;
      }
      body.arena-visual-system :is(.primary,.secondary,.ghost,.danger){border-radius:9px!important}

      /* HOME: competição realmente ativa, sem competição fixa. */
      [data-page="home"] .home-grid{
        grid-template-columns:minmax(0,1.36fr) minmax(280px,.82fr)!important;
        gap:14px!important;
      }
      [data-page="home"] .home-grid>section{
        min-width:0;
        padding:0;
      }
      [data-page="home"] .now-head{
        align-items:flex-end!important;
        gap:14px;
        margin:0 0 10px!important;
      }
      [data-page="home"] .now-head h2{
        margin-top:4px!important;
        font-size:clamp(26px,4vw,34px)!important;
        line-height:.98!important;
        letter-spacing:-.015em!important;
      }
      [data-page="home"] .now-head p{
        margin-top:6px!important;
        color:#91a198!important;
        font-size:10px!important;
      }
      [data-page="home"] .now-head button{
        flex:0 0 auto;
        min-height:38px!important;
        padding:0 12px!important;
        border:1px solid rgba(var(--arena-context-rgb),.28)!important;
        border-radius:9px!important;
        color:var(--arena-context-soft)!important;
        background:rgba(var(--arena-context-rgb),.06)!important;
        font-size:10px!important;
        font-weight:850!important;
      }
      [data-page="home"] .now-feature{
        position:relative;
        overflow:hidden;
        border:1px solid rgba(var(--arena-context-rgb),.26)!important;
        border-radius:18px!important;
        background:
          radial-gradient(circle at 50% -18%,rgba(var(--arena-context-rgb),.18),transparent 44%),
          linear-gradient(150deg,#0b1a11 0%,#050c08 78%)!important;
        box-shadow:none!important;
      }
      [data-page="home"] .now-feature:before{
        content:"";
        position:absolute;
        inset:0 0 auto;
        height:2px;
        background:linear-gradient(90deg,transparent,var(--arena-context-accent),transparent);
        opacity:.78;
        pointer-events:none;
      }
      [data-page="home"] .now-feature>header{
        min-height:48px;
        padding:10px 13px!important;
        background:rgba(255,255,255,.012);
      }
      [data-page="home"] .now-pill{
        border:1px solid rgba(var(--arena-context-rgb),.18);
        color:var(--arena-context-soft)!important;
        background:rgba(var(--arena-context-rgb),.07)!important;
      }
      [data-page="home"] .now-feature>main{
        min-height:174px!important;
        gap:16px!important;
        padding:20px 14px 17px!important;
      }
      [data-page="home"] .now-badge.big{
        width:58px!important;
        height:58px!important;
        border:1px solid rgba(var(--arena-context-rgb),.28)!important;
        background:#09140d!important;
        box-shadow:0 10px 22px rgba(0,0,0,.28)!important;
      }
      [data-page="home"] .now-club strong{
        max-width:180px!important;
        font-size:12px!important;
        line-height:1.2!important;
        white-space:normal!important;
      }
      [data-page="home"] .now-score{
        min-width:96px;
        padding:10px 9px;
        border:1px solid rgba(255,255,255,.07);
        border-radius:12px;
        background:#040a06;
      }
      [data-page="home"] .now-score>b{
        color:#f5f7f5!important;
        font-size:clamp(28px,5vw,40px)!important;
        letter-spacing:-.02em;
      }
      [data-page="home"] .now-score>span{color:#85978c!important}
      [data-page="home"] .now-feature>footer{
        gap:6px!important;
        padding:10px 12px!important;
        background:rgba(255,255,255,.012)!important;
      }
      [data-page="home"] .now-feature>footer>span{
        padding:7px 8px!important;
        border:1px solid rgba(255,255,255,.06);
        border-radius:8px;
        background:rgba(255,255,255,.018);
      }

      [data-page="home"] .now-list{
        overflow:hidden;
        border:1px solid rgba(255,255,255,.075)!important;
        border-radius:16px!important;
        background:#09140d!important;
        box-shadow:none!important;
      }
      [data-page="home"] .now-row{
        min-height:72px!important;
        padding:10px 11px!important;
        border:0!important;
        border-bottom:1px solid rgba(255,255,255,.06)!important;
        border-radius:0!important;
        background:transparent!important;
      }
      [data-page="home"] .now-row:last-child{border-bottom:0!important}
      [data-page="home"] .now-row:hover{background:rgba(var(--arena-context-rgb),.04)!important}
      [data-page="home"] .now-stage{
        color:var(--arena-context-soft)!important;
        background:rgba(var(--arena-context-rgb),.07)!important;
      }
      [data-page="home"] .now-state{border-radius:7px!important}

      /* CAMPEONATOS: mesma estrutura para qualquer competição. */
      .arena-detail .arena-hero{
        min-height:218px!important;
        padding:20px!important;
        border:1px solid rgba(var(--arena-context-rgb),.22)!important;
        border-radius:18px!important;
        background:linear-gradient(145deg,#0d2015,#06100a)!important;
        box-shadow:none!important;
      }
      .arena-detail .arena-hero:after{
        background:linear-gradient(180deg,rgba(3,8,5,.08),rgba(3,8,5,.92))!important;
      }
      .arena-detail .arena-hero-copy h2{
        max-width:760px;
        font-size:clamp(34px,7vw,54px)!important;
        line-height:.9!important;
        letter-spacing:-.025em!important;
      }
      .arena-detail .arena-actions{gap:7px!important}
      .arena-detail .arena-stat{
        padding:11px!important;
        border-radius:11px!important;
        background:#0a1710!important;
      }
      .arena-detail-nav,
      #giManager>nav{
        gap:5px!important;
        overflow-x:auto!important;
        scrollbar-width:none;
        border:1px solid rgba(255,255,255,.07)!important;
        border-radius:11px!important;
        background:#07110b!important;
      }
      .arena-detail-nav::-webkit-scrollbar,#giManager>nav::-webkit-scrollbar{display:none}
      .arena-detail-nav button,#giManager>nav button{
        min-height:38px!important;
        padding:0 11px!important;
        border-radius:8px!important;
        white-space:nowrap!important;
        font-size:10px!important;
      }
      .arena-detail-nav button.active,#giManager>nav button.active{
        color:#14130c!important;
        background:var(--arena-context-accent)!important;
      }

      #giManager .gi-head{
        align-items:flex-start!important;
        gap:10px!important;
      }
      #giManager .gi-game{
        border:1px solid rgba(255,255,255,.075)!important;
        border-radius:13px!important;
        background:#09150d!important;
        box-shadow:none!important;
      }
      #giManager .gi-game:hover{border-color:rgba(var(--arena-context-rgb),.22)!important}
      #giManager .gi-phase>div h3{letter-spacing:-.01em!important}

      #autoStandings .stand-group{
        overflow:hidden;
        border:1px solid rgba(255,255,255,.075)!important;
        border-radius:14px!important;
        background:#09140d!important;
        box-shadow:none!important;
      }
      #autoStandings table{font-variant-numeric:tabular-nums}
      #autoStandings thead{background:#06100a!important}
      #autoStandings th{
        color:#7f9186!important;
        font-size:8px!important;
        letter-spacing:.07em!important;
      }
      #autoStandings tbody tr{border-top:1px solid rgba(255,255,255,.05)!important}
      #autoStandings tbody tr.qualified{background:rgba(var(--arena-context-rgb),.035)!important}
      #autoStandings .stand-points{color:var(--arena-context-soft)!important}

      /* MOBILE: prioridade para conteúdo e navegação simples. */
      @media(max-width:760px){
        body.arena-visual-system main{padding-top:10px!important}
        [data-page="home"] .home-grid{grid-template-columns:1fr!important;gap:20px!important}
        [data-page="home"] .now-head{align-items:flex-start!important}
        [data-page="home"] .now-head button{min-height:36px!important}
        [data-page="home"] .now-feature>main{grid-template-columns:minmax(0,1fr) 86px minmax(0,1fr)!important;gap:8px!important;min-height:160px!important;padding:17px 9px 14px!important}
        [data-page="home"] .now-badge.big{width:48px!important;height:48px!important}
        [data-page="home"] .now-club strong{max-width:118px!important;font-size:10px!important}
        [data-page="home"] .now-score{min-width:82px;padding:8px 6px}
        [data-page="home"] .now-score>b{font-size:28px!important}
        [data-page="home"] .now-feature>footer{overflow-x:auto;justify-content:flex-start!important;scrollbar-width:none}
        [data-page="home"] .now-feature>footer::-webkit-scrollbar{display:none}
        [data-page="home"] .now-feature>footer>span{flex:0 0 auto}
        [data-page="home"] .now-row{grid-template-columns:60px minmax(0,1fr) auto!important}

        .arena-detail .arena-hero{min-height:190px!important;padding:16px!important}
        .arena-detail .arena-hero-copy h2{font-size:36px!important}
        .arena-detail .arena-actions{display:grid!important;grid-template-columns:1fr 1fr!important}
        .arena-detail .arena-actions>*{width:100%!important}
        .arena-detail-nav,#giManager>nav{
          position:sticky;
          top:8px;
          z-index:24;
          padding:5px!important;
        }
        #giManager .gi-head{display:grid!important;grid-template-columns:1fr!important}
        #giManager .gi-head>div:last-child{width:100%;display:flex;overflow-x:auto;gap:6px;padding-bottom:2px;scrollbar-width:none}
        #giManager .gi-head>div:last-child::-webkit-scrollbar{display:none}
        #giManager .gi-head>div:last-child>*{flex:0 0 auto}

        #autoStandings .stand-scroll{overflow-x:auto!important}
        #autoStandings table{min-width:640px!important}
        #autoStandings th,#autoStandings td{padding-inline:7px!important}

        .arena-mobile-nav{
          left:8px!important;
          right:8px!important;
          bottom:8px!important;
          width:auto!important;
          padding:5px!important;
          border:1px solid rgba(255,255,255,.08)!important;
          border-radius:14px!important;
          background:rgba(5,13,8,.96)!important;
          box-shadow:0 14px 34px rgba(0,0,0,.38)!important;
          backdrop-filter:blur(12px)!important;
          -webkit-backdrop-filter:blur(12px)!important;
        }
        .arena-mobile-nav button{
          min-height:48px!important;
          border-radius:10px!important;
          font-size:8px!important;
        }
        .arena-mobile-nav button.active{
          color:var(--arena-context-soft)!important;
          background:rgba(var(--arena-context-rgb),.10)!important;
        }
      }

      @media(max-width:430px){
        [data-page="home"] .now-head{display:grid!important;grid-template-columns:1fr auto!important}
        [data-page="home"] .now-head h2{font-size:27px!important}
        [data-page="home"] .now-head p{grid-column:1/-1}
        [data-page="home"] .now-row{grid-template-columns:52px minmax(0,1fr)!important}
        [data-page="home"] .now-state{display:none!important}
        .arena-detail .arena-actions{grid-template-columns:1fr!important}
      }

      @media(prefers-reduced-motion:reduce){
        [data-page="home"] .now-feature:before{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function syncContext() {
    installStyles();
    const tournament = currentTournament();
    const accent = accentFor(tournament);
    const root = document.documentElement;
    root.style.setProperty('--arena-context-accent', accent.accent);
    root.style.setProperty('--arena-context-rgb', accent.rgb);
    root.style.setProperty('--arena-context-soft', accent.soft);
    if (tournament?.id) root.dataset.arenaCurrentTournament = String(tournament.id);
    else delete root.dataset.arenaCurrentTournament;

    const home = document.querySelector('[data-page="home"]');
    if (home && tournament) {
      home.dataset.currentTournament = String(tournament.id || '');
      const eyebrow = home.querySelector('.now-head .eyebrow');
      if (eyebrow) {
        eyebrow.textContent = normalize(tournament.status) === 'em andamento'
          ? 'Campeonato em andamento'
          : normalize(tournament.status) === 'inscricoes abertas'
            ? 'Próxima competição'
            : 'Destaque da Arena';
      }
    }
  }

  let frame = 0;
  function scheduleSync() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncContext();
    });
  }

  ['arena:matches-updated','arena:tournaments-updated','arena:bundle-loaded','arena:cloud-ready','arena:auth-changed']
    .forEach(type => window.addEventListener(type, scheduleSync));
  window.addEventListener('storage', event => {
    if ([TOURNAMENT_KEY, MATCH_KEY].includes(event.key)) scheduleSync();
  });

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDARedesign = Object.freeze({
    version: 1,
    refresh: syncContext,
    currentTournament: () => currentTournament(),
    accentFor: tournament => ({ ...accentFor(tournament) })
  });

  syncContext();
})();
