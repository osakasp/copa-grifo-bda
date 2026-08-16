(() => {
  'use strict';

  const VERSION = '2026.08.16-copa-facil-interface';
  const STYLE_ID = 'arenaCopaFacilInterfaceStyles';
  const THEME_COLOR = '#176b3d';

  document.documentElement.dataset.arenaInterface = VERSION;
  document.documentElement.dataset.theme = 'light';
  document.documentElement.style.colorScheme = 'light';
  document.body.classList.add('arena-copa-facil');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR);

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.arena-visual-system.arena-copa-facil{
      --cf-green:#197847;
      --cf-green-dark:#0f5f35;
      --cf-green-soft:#e5f2e9;
      --cf-gold:#c49322;
      --cf-bg:#edf2ee;
      --cf-surface:#ffffff;
      --cf-surface-alt:#f6f8f6;
      --cf-border:#d8e1da;
      --cf-border-strong:#bccbc0;
      --cf-text:#1b2720;
      --cf-muted:#68766d;
      --arena-accent:var(--cf-green)!important;
      --arena-accent-rgb:25,120,71!important;
      --bg:var(--cf-bg)!important;
      --bg-soft:#e7ede8!important;
      --surface:var(--cf-surface)!important;
      --surface-2:var(--cf-surface-alt)!important;
      --surface-3:#edf3ef!important;
      --line:var(--cf-border)!important;
      --line-strong:var(--cf-border-strong)!important;
      --text:var(--cf-text)!important;
      --muted:var(--cf-muted)!important;
      --gold:var(--cf-green)!important;
      --gold-soft:var(--cf-green)!important;
      --green:#16844a!important;
      --red:#c8444f!important;
      color:var(--cf-text);
      background:var(--cf-bg);
    }

    body.arena-copa-facil>.app-shell{background:var(--cf-bg)}
    body.arena-copa-facil main{color:var(--cf-text)}
    body.arena-copa-facil .page{color:var(--cf-text)}
    body.arena-copa-facil .section-head h2,
    body.arena-copa-facil :is(.card,.arena-card,.team-card,.champion-card,.registration-card) h3{color:var(--cf-text)}
    body.arena-copa-facil :is(.section-head p,.arena-body p,.team-card small,.champion-card p){color:var(--cf-muted)}

    body.arena-copa-facil .topbar{
      border:0;
      border-radius:0;
      color:#fff;
      background:var(--cf-green-dark);
      box-shadow:0 2px 8px rgba(19,73,44,.18);
    }
    body.arena-copa-facil .brand-mark{
      border-color:rgba(255,255,255,.32);
      color:var(--cf-green-dark);
      background:#fff;
    }
    body.arena-copa-facil .brand-copy strong{color:#fff}
    body.arena-copa-facil .brand-copy span{color:rgba(255,255,255,.74)}
    body.arena-copa-facil .topbar :is(.icon-btn,.admin-btn,#cloudPanelBtn,#arenaCommandTrigger,.arena-notification-button){
      color:#fff;
      border-color:rgba(255,255,255,.28);
      background:rgba(255,255,255,.10);
    }
    body.arena-copa-facil .topbar :is(.icon-btn,.admin-btn,#cloudPanelBtn,#arenaCommandTrigger,.arena-notification-button):hover{
      border-color:rgba(255,255,255,.55);
      background:rgba(255,255,255,.16);
    }
    body.arena-copa-facil .topbar .admin-btn.active{
      color:var(--cf-green-dark);
      border-color:#fff;
      background:#fff;
    }

    @media(min-width:980px){
      body.arena-copa-facil .bottom-nav.arena-side-nav{
        border-color:var(--cf-border);
        background:#fff;
        box-shadow:0 5px 18px rgba(30,61,41,.08);
      }
      body.arena-copa-facil .arena-side-brand{border-color:var(--cf-border)}
      body.arena-copa-facil .arena-side-heading{color:#809087}
      body.arena-copa-facil .arena-side-footer{border-color:var(--cf-border);color:var(--cf-muted)}
      body.arena-copa-facil .arena-side-nav .nav-btn{color:#5f6f65}
      body.arena-copa-facil .arena-side-nav .nav-btn:hover{color:var(--cf-green);background:var(--cf-green-soft)}
      body.arena-copa-facil .arena-side-nav .nav-btn i{color:#6e7e74;background:#f2f6f3}
      body.arena-copa-facil .arena-side-nav .nav-btn.active{
        color:var(--cf-green-dark);
        border-color:#c7d9cd;
        border-left-color:var(--cf-green);
        background:var(--cf-green-soft);
      }
      body.arena-copa-facil .arena-side-nav .nav-btn.active i{color:#fff;background:var(--cf-green)}
      body.arena-copa-facil .arena-side-nav .nav-btn.active .arena-nav-copy small{color:#5c7465}
    }

    body.arena-copa-facil [data-page="home"] .hero,
    body.arena-copa-facil .arena-page-hero,
    body.arena-copa-facil #arenaDetail .arena-hero{
      border-color:#0f6137;
      color:#fff;
      background:linear-gradient(135deg,#197847,#0f5f35 72%);
      box-shadow:none;
    }
    body.arena-copa-facil [data-page="home"] .hero h1,
    body.arena-copa-facil .arena-page-hero h1,
    body.arena-copa-facil #arenaDetail .arena-hero h2{color:#fff}
    body.arena-copa-facil [data-page="home"] .hero p,
    body.arena-copa-facil .arena-page-hero p,
    body.arena-copa-facil #arenaDetail .arena-hero p{color:rgba(255,255,255,.82)}
    body.arena-copa-facil :is([data-page="home"] .hero,.arena-page-hero,#arenaDetail .arena-hero) .eyebrow{color:#f3d272}
    body.arena-copa-facil .arena-home-watermark{opacity:.14;filter:brightness(0) invert(1)}

    body.arena-copa-facil :is(.primary,.secondary,.ghost,.danger){border-radius:6px}
    body.arena-copa-facil .primary{color:#fff;border-color:var(--cf-green);background:var(--cf-green)}
    body.arena-copa-facil .primary:hover{border-color:var(--cf-green-dark);background:var(--cf-green-dark)}
    body.arena-copa-facil .secondary{color:var(--cf-green-dark);border-color:#a9c7b4;background:#fff}
    body.arena-copa-facil .ghost{color:var(--cf-green);border-color:#bfd1c4;background:transparent}
    body.arena-copa-facil .danger{color:#bd3542;border-color:#e4b8bd;background:#fff}
    body.arena-copa-facil :is(a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])):focus-visible{
      outline-color:var(--cf-green);
    }

    body.arena-copa-facil :where(.card,.form-card,.admin-panel,.arena-card,.champion-card,.team-card,.stat,.arena-stat,.rank-podium-card,.rank-hall article,.rank-rules article,.league-groups-preview article,.history-values article,.history-timeline article,.history-gallery-card,.registration-card,.registration-admin-card,.auto-standing-card,.champion-ranking-row,.champion-ranking-podium-card){
      border-color:var(--cf-border);
      border-radius:8px;
      color:var(--cf-text);
      background:#fff;
      box-shadow:none;
    }
    body.arena-copa-facil :where(.card,.arena-card,.champion-card,.team-card,.stat,.arena-stat):hover{
      border-color:#afc9b7;
      background:#fff;
    }
    body.arena-copa-facil :is(.arena-cover,.champion-banner-frame,.history-gallery-media){background:#e9efeb}
    body.arena-copa-facil :is(.arena-status,.match-status,.live-pill,.now-pill){
      color:var(--cf-green-dark);
      border-color:#b8d6c2;
      background:var(--cf-green-soft);
    }
    body.arena-copa-facil :is(.match-teams b,.match-stage,.scorebox b,.edition){color:var(--cf-green)}
    body.arena-copa-facil .match-row+.match-row{border-color:var(--cf-border)}
    body.arena-copa-facil .live-top{border-color:var(--cf-border);background:#f6f8f6}
    body.arena-copa-facil .live-top time{color:var(--cf-muted)}

    body.arena-copa-facil .arena-app-tabs{
      border-color:var(--cf-border);
      background:#fff;
      box-shadow:none;
    }
    body.arena-copa-facil .arena-app-tab{color:#68776e;background:#fff}
    body.arena-copa-facil .arena-app-tab:hover{color:var(--cf-green);background:#f5f8f6}
    body.arena-copa-facil .arena-app-tab.active{color:var(--cf-green-dark);background:#fff}
    body.arena-copa-facil .arena-app-tab.active:after{background:var(--cf-green)}
    body.arena-copa-facil #arenaStats{grid-template-columns:repeat(3,minmax(0,1fr));border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil #arenaStats .stat{border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil #arenaStats .stat b{color:var(--cf-green)}
    body.arena-copa-facil #arenaStats .stat span{color:var(--cf-muted)}

    body.arena-copa-facil .arena-home-card{
      border-color:var(--cf-border);
      border-left-color:var(--cf-green);
      background:#fff;
    }
    body.arena-copa-facil .arena-home-card button{
      color:var(--cf-green-dark);
      border-color:#b9d0c0;
      background:#f5f8f6;
    }
    body.arena-copa-facil .home-command{
      border-color:var(--cf-border);
      background:#fff;
    }
    body.arena-copa-facil :is(.home-command,.arena-app-tabs){display:none!important}
    body.arena-copa-facil .home-command nav button{
      color:var(--cf-text);
      border-color:var(--cf-border);
      background:#fff;
    }
    body.arena-copa-facil .home-command nav button:hover{border-color:#9fc2aa;background:var(--cf-green-soft)}
    body.arena-copa-facil .home-command nav>button>i{color:var(--cf-green);border-color:var(--cf-border)}
    body.arena-copa-facil .home-command nav button small{color:var(--cf-muted)}
    body.arena-copa-facil :is(.now-feature,.now-list){border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .now-feature>header{background:var(--cf-green-soft)}
    body.arena-copa-facil .now-state{color:var(--cf-green-dark);background:var(--cf-green-soft)}

    body.arena-copa-facil .arena-catalog-head .arena-toolbar,
    body.arena-copa-facil .arena-detail-nav{border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .arena-filter{color:#647269;background:transparent}
    body.arena-copa-facil .arena-filter.active{color:#fff;background:var(--cf-green)}
    body.arena-copa-facil .arena-detail-nav>span{color:var(--cf-text)}
    body.arena-copa-facil .arena-detail-nav button{color:var(--cf-muted)}
    body.arena-copa-facil .arena-detail-nav button:hover{color:var(--cf-green-dark);background:var(--cf-green-soft)}
    body.arena-copa-facil .arena-card{border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .arena-card .arena-cover,
    body.arena-copa-facil .arena-card .arena-body>p,
    body.arena-copa-facil .arena-card .arena-capacity{display:none}
    body.arena-copa-facil .arena-card .arena-body{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:14px}
    body.arena-copa-facil .arena-card .arena-body h3{grid-column:1;margin:0}
    body.arena-copa-facil .arena-card .arena-meta{grid-column:1;gap:12px;margin:0}
    body.arena-copa-facil .arena-card .arena-open{grid-column:2;grid-row:1/3;align-self:stretch}
    body.arena-copa-facil .arena-card .arena-body{color:var(--cf-text);background:#fff}
    body.arena-copa-facil .arena-card .arena-open{color:var(--cf-green-dark);border-color:var(--cf-border);background:transparent}
    body.arena-copa-facil .arena-stat{border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .arena-stat b{color:var(--cf-green-dark)}
    body.arena-copa-facil .arena-club{color:var(--cf-text);border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .arena-club-section-compact:not(.is-expanded) .arena-club:nth-child(n+7){display:none}
    body.arena-copa-facil .copa-club-toggle,
    body.arena-copa-facil .copa-team-register{
      min-height:44px;
      padding:0 14px;
      color:var(--cf-green-dark);
      border:1px solid #b9d0c0;
      border-radius:6px;
      background:#fff;
      font-weight:800;
    }
    html:not(.arena-admin-authenticated) body.arena-copa-facil [data-page="teams"]>.form-card{display:none!important}
    html.arena-admin-authenticated body.arena-copa-facil .copa-team-register{display:none}
    html:not(.arena-admin-authenticated) body.arena-copa-facil [data-page="home"] .hero-actions button:nth-child(n+2){display:none}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-detail-nav nav{display:none}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-stat:nth-child(2){display:none}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-hero{min-height:0!important;padding:18px!important}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-hero>img,
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-hero-symbol,
    html:not(.arena-admin-authenticated) body.arena-copa-facil #arenaDetail .arena-hero-copy>p{display:none}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #giManager{margin-top:0}
    html:not(.arena-admin-authenticated) body.arena-copa-facil #giManager :is(.gi-head,.gi-metrics,.gi-progress){display:none}

    body.arena-copa-facil :is(input,select,textarea){
      color:var(--cf-text);
      border-color:var(--cf-border-strong);
      background:#fff;
    }
    body.arena-copa-facil :is(input,select,textarea)::placeholder{color:#8b9890}
    body.arena-copa-facil :is(.modal,.arena-notification-panel,.arena-notification-editor,.arena-nav-sheet,.arena-command-panel){
      color:var(--cf-text);
      border-color:var(--cf-border);
      background:#fff;
      box-shadow:0 16px 46px rgba(29,58,39,.16);
    }
    body.arena-copa-facil .arena-command-head{border-color:var(--cf-border)}
    body.arena-copa-facil .arena-command-search input{color:var(--cf-text);border-color:var(--cf-border);background:#f7f9f7}
    body.arena-copa-facil .arena-command-item{color:var(--cf-text)}
    body.arena-copa-facil .arena-command-item:hover{border-color:#b9d0c0;background:var(--cf-green-soft)}
    body.arena-copa-facil .arena-command-item>i{color:var(--cf-green);border-color:var(--cf-border)}
    body.arena-copa-facil .arena-command-item small,
    body.arena-copa-facil .arena-command-caption{color:var(--cf-muted)}

    body.arena-copa-facil #giManager{color:var(--cf-text)}
    body.arena-copa-facil #giManager .gi-head{
      border-color:var(--cf-green-dark)!important;
      border-radius:8px!important;
      color:#fff!important;
      background:linear-gradient(135deg,var(--cf-green),var(--cf-green-dark))!important;
      box-shadow:none!important;
    }
    body.arena-copa-facil #giManager .gi-head:after{color:rgba(255,255,255,.08)}
    body.arena-copa-facil #giManager .gi-head :is(h2,p){color:#fff!important}
    body.arena-copa-facil #giManager .gi-head>div:last-child span{color:rgba(255,255,255,.84);border-color:rgba(255,255,255,.28)}
    body.arena-copa-facil #giManager .gi-metrics>div{
      border-color:var(--cf-border)!important;
      border-radius:7px!important;
      color:var(--cf-text)!important;
      background:#fff!important;
    }
    body.arena-copa-facil #giManager .gi-metrics b{color:var(--cf-green)!important}
    body.arena-copa-facil #giManager>nav{
      border-color:var(--cf-border)!important;
      border-radius:7px!important;
      background:#fff!important;
      box-shadow:none!important;
      backdrop-filter:none!important;
    }
    body.arena-copa-facil #giManager>nav button{color:var(--cf-muted)!important;background:transparent!important}
    body.arena-copa-facil #giManager>nav button.active{color:var(--cf-green-dark)!important;background:var(--cf-green-soft)!important}
    body.arena-copa-facil #giManager .gi-phase{
      border-color:var(--cf-border)!important;
      border-radius:8px!important;
      background:transparent!important;
    }
    body.arena-copa-facil #giManager .gi-phase>div{border-color:var(--cf-border)!important}
    body.arena-copa-facil #giManager .gi-phase h3{color:var(--cf-green-dark)!important}
    body.arena-copa-facil #giManager .gip-card,
    body.arena-copa-facil #giManager .gi-game{
      border-color:var(--cf-border)!important;
      border-radius:8px!important;
      color:var(--cf-text)!important;
      background:#fff!important;
      box-shadow:none!important;
    }
    body.arena-copa-facil #giManager .gip-card:before{background:var(--cf-green)!important;opacity:1}
    body.arena-copa-facil #giManager .gip-card-head{border-color:var(--cf-border)!important;background:#f6f8f6!important}
    body.arena-copa-facil #giManager .gip-status{color:var(--cf-green-dark)!important;border-color:#b8d6c2!important;background:var(--cf-green-soft)!important}
    body.arena-copa-facil #giManager .gip-meta,
    body.arena-copa-facil #giManager .gip-save-state{color:var(--cf-muted)!important;background:transparent!important}
    body.arena-copa-facil #giManager .gip-team{
      color:var(--cf-text)!important;
      border-color:#e0e7e2!important;
      background:#fff!important;
    }
    body.arena-copa-facil #giManager .gip-team.winner{color:var(--cf-green-dark)!important;border-color:#b4d1be!important;background:var(--cf-green-soft)!important}
    body.arena-copa-facil #giManager .gip-scoreboard{
      border-color:#adc8b5!important;
      border-radius:7px!important;
      background:#f4f8f5!important;
      box-shadow:none!important;
    }
    body.arena-copa-facil #giManager .gip-scoreboard .gi-score{color:var(--cf-green-dark)!important}
    body.arena-copa-facil #giManager .gip-scoreboard .gi-score-input{
      color:var(--cf-green-dark)!important;
      border-color:#adc8b5!important;
      background:#fff!important;
    }
    body.arena-copa-facil #giManager .gip-aggregate,
    body.arena-copa-facil #giManager .gip-note{color:var(--cf-muted)!important;border-color:var(--cf-border)!important;background:#f7f9f7!important}
    body.arena-copa-facil #giManager .gip-actions{border-color:var(--cf-border)!important;background:#fff!important}
    body.arena-copa-facil #giManager .gip-actions button{
      color:var(--cf-green-dark)!important;
      border-color:#b9d0c0!important;
      background:#f7f9f7!important;
    }
    body.arena-copa-facil #giManager .gip-actions button:hover{border-color:var(--cf-green)!important;background:var(--cf-green-soft)!important}
    body.arena-copa-facil #giManager .gi-bracket-progress>span,
    body.arena-copa-facil #giManager .gi-bracket article,
    body.arena-copa-facil #giManager .gi-config section{color:var(--cf-text);border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil #giManager .gi-bracket section>h3{color:var(--cf-green-dark)}
    body.arena-copa-facil #giManager .gi-bracket article>div.winner{color:var(--cf-green-dark);background:var(--cf-green-soft)}
    body.arena-copa-facil #giManager .gi-editor{color:var(--cf-text)!important;border-color:var(--cf-border)!important;background:#f7f9f7!important}
    body.arena-copa-facil #giManager .gi-editor :is(input,select,textarea){color:var(--cf-text)!important;border-color:var(--cf-border-strong)!important;background:#fff!important}
    body.arena-copa-facil .pro-admin-bar{color:#fff;border-color:var(--cf-green-dark);background:var(--cf-green-dark);box-shadow:none;backdrop-filter:none}
    body.arena-copa-facil .pro-admin-bar span{color:#f3d272}
    body.arena-copa-facil .pro-admin-bar b{color:#fff}

    body.arena-copa-facil .stand-highlights article,
    body.arena-copa-facil .stand-group{color:var(--cf-text);border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .stand-group>header{border-color:var(--cf-green-dark);background:var(--cf-green-dark)}
    body.arena-copa-facil .stand-group>header :is(h3,span){color:#fff}
    body.arena-copa-facil .stand-group th{color:#fff;border-color:#2b8355;background:var(--cf-green)}
    body.arena-copa-facil .stand-group td{color:var(--cf-text);border-color:var(--cf-border);background:#fff}
    body.arena-copa-facil .stand-group tbody tr:hover td{background:#f4f8f5}
    body.arena-copa-facil .stand-pos{color:#fff;background:var(--cf-green)}
    body.arena-copa-facil .stand-points{color:var(--cf-green-dark)!important}

    body.arena-copa-facil .aqs-dialog,
    body.arena-copa-facil .asmgr-sheet{
      color:var(--cf-text);
      border-color:var(--cf-border);
      border-radius:10px;
      background:#fff;
      box-shadow:0 20px 60px rgba(24,54,34,.22);
    }
    body.arena-copa-facil .aqs-head,
    body.arena-copa-facil .asmgr-sheet>header{margin:-18px -18px 0;padding:12px 14px;color:#fff;background:var(--cf-green-dark)}
    body.arena-copa-facil .aqs-head>span,
    body.arena-copa-facil .asmgr-sheet>header span{color:#f3d272}
    body.arena-copa-facil .aqs-head button,
    body.arena-copa-facil .asmgr-sheet>header button{color:#fff;border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.10)}
    body.arena-copa-facil .aqs-dialog h2,
    body.arena-copa-facil .asmgr-sheet h2,
    body.arena-copa-facil .asmgr-sheet h3{color:var(--cf-text)}
    body.arena-copa-facil .aqs-dialog>p,
    body.arena-copa-facil .asmgr-card p{color:var(--cf-muted)}
    body.arena-copa-facil .aqs-score input{color:var(--cf-green-dark);border-color:#adc8b5;background:#f7f9f7}
    body.arena-copa-facil .asmgr-card{border-color:var(--cf-border);background:#f7f9f7}
    body.arena-copa-facil .asmgr-card.recommended{border-color:#afd0ba;background:var(--cf-green-soft)}
    body.arena-copa-facil .asmgr-options button{color:var(--cf-green-dark);border-color:#b9d0c0;background:#fff}
    body.arena-copa-facil .asmgr-link{color:var(--cf-green)}

    body.arena-copa-facil .toast{color:#fff;background:var(--cf-green-dark);box-shadow:0 8px 24px rgba(25,88,49,.22)}
    body.arena-copa-facil #arenaBackToTop{color:#fff;border-color:var(--cf-green);background:var(--cf-green)}

    @media(max-width:720px){
      body.arena-copa-facil button{min-height:44px}
      body.arena-copa-facil :is(input:not([type="hidden"]),select,textarea){min-height:44px}
      body.arena-copa-facil :is(.topbar button,.arena-sheet-close,.club-profile-close){min-width:44px}
      body.arena-copa-facil .now-rotation button{min-height:7px}
      body.arena-copa-facil .topbar{background:var(--cf-green-dark);box-shadow:0 3px 10px rgba(20,67,39,.18)}
      body.arena-copa-facil .topbar :is(#arenaNotificationsBtn,#shareBtn,#cloudPanelBtn,#adminBtn,#memberLogoutBtn){color:#fff;background:rgba(255,255,255,.10)}
      body.arena-copa-facil .arena-page-back{color:#fff;border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.10)}
      body.arena-copa-facil .arena-mobile-nav{
        border-color:var(--cf-border);
        background:#fff;
        box-shadow:0 -4px 16px rgba(34,61,43,.11);
      }
      body.arena-copa-facil .arena-mobile-item{color:#748279;background:transparent}
      body.arena-copa-facil .arena-mobile-item.active{color:var(--cf-green-dark);background:transparent}
      body.arena-copa-facil .arena-mobile-item.active:before{background:var(--cf-green)}
      body.arena-copa-facil #arenaStats{background:var(--cf-border)}
      body.arena-copa-facil #arenaStats .stat{background:#fff}
      body.arena-copa-facil .arena-nav-sheet{background:#fff}
      body.arena-copa-facil .arena-sheet-item{color:var(--cf-text);background:#fff}
      body.arena-copa-facil .arena-sheet-item i{color:var(--cf-green);background:var(--cf-green-soft)}
      body.arena-copa-facil #giManager .gip-match-body{grid-template-columns:minmax(0,1fr) 91px minmax(0,1fr)}
    }

    @media(max-width:900px){
      body.arena-copa-facil #arenaStats{grid-template-columns:repeat(3,minmax(0,1fr))}
      body.arena-copa-facil .arena-card .arena-body{grid-template-columns:minmax(0,1fr)}
      body.arena-copa-facil .arena-card .arena-open{grid-column:1;grid-row:auto;min-height:44px}
    }

    @media(prefers-color-scheme:dark){
      body.arena-visual-system.arena-copa-facil{color-scheme:light}
    }
  `;

  function keepLast() {
    if (style.parentNode === document.head && style === document.head.lastElementChild) return;
    document.head.append(style);
  }

  function simplifyTournamentClubs() {
    const section = document.querySelector('#tournamentClubs');
    if (!section) return;
    const clubs = [...section.querySelectorAll('.arena-club')];
    let toggle = section.querySelector('[data-copa-toggle-clubs]');

    if (clubs.length <= 6) {
      section.classList.remove('arena-club-section-compact', 'is-expanded');
      toggle?.remove();
      return;
    }

    section.classList.add('arena-club-section-compact');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'copa-club-toggle';
      toggle.dataset.copaToggleClubs = 'true';
      section.querySelector('.section-head')?.append(toggle);
    }

    const expanded = section.classList.contains('is-expanded');
    toggle.textContent = expanded ? 'Mostrar menos' : `Ver os ${clubs.length} clubes`;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function ensureTeamShortcut() {
    const page = document.querySelector('[data-page="teams"]');
    const heading = page?.querySelector(':scope > .section-head');
    if (!page || !heading || heading.querySelector('.copa-team-register')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copa-team-register';
    button.dataset.go = 'registrations';
    button.textContent = 'Inscrever clube';
    heading.append(button);
  }

  function simplifyTournamentDetail() {
    const detail = document.querySelector('#arenaDetail');
    const stats = detail?.querySelector('.arena-stats');
    const competition = detail?.querySelector('#tournamentCompetition');
    if (stats && competition && stats.nextElementSibling !== competition) stats.after(competition);
  }

  let simplifyFrame = 0;
  function scheduleSimplify() {
    if (simplifyFrame) return;
    simplifyFrame = requestAnimationFrame(() => {
      simplifyFrame = 0;
      simplifyTournamentClubs();
      ensureTeamShortcut();
      simplifyTournamentDetail();
      keepLast();
    });
  }

  keepLast();
  scheduleSimplify();
  document.addEventListener('click', event => {
    const toggle = event.target instanceof Element ? event.target.closest('[data-copa-toggle-clubs]') : null;
    if (!toggle) return;
    const section = toggle.closest('#tournamentClubs');
    section?.classList.toggle('is-expanded');
    simplifyTournamentClubs();
    simplifyTournamentDetail();
  });
  document.addEventListener('arena:bundle-loaded', scheduleSimplify);
  window.addEventListener('arena:enhancements-ready', scheduleSimplify);
  window.addEventListener('arena:permissions-updated', scheduleSimplify);
  window.ArenaDOMEvents?.subscribe?.(scheduleSimplify, { selector: '#arenaDetail,#giManager,.gi-game,.stand-group,.arena-card,#tournamentClubs,[data-page="teams"]' });
})();
