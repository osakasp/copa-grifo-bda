(() => {
  'use strict';

  const VERSION = '2026.08-professional-ui';
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
  document.body.classList.add('arena-innovation-2026', 'arena-minimal-2026', 'arena-human-ui', 'arena-professional-ui');

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

    /* Interface editorial: menos ornamentos e uma hierarquia de ação previsível. */
    body.arena-human-ui button{
      font-family:Inter,Arial,sans-serif;
      letter-spacing:0!important;
      text-transform:none;
    }
    body.arena-human-ui .arena-button-ripple{display:none!important}
    body.arena-human-ui :is(.primary,.secondary,.ghost,.danger){
      min-height:40px!important;
      padding:0 14px!important;
      border-radius:6px!important;
      box-shadow:none!important;
      font-size:10px!important;
      font-weight:750!important;
    }
    body.arena-human-ui .primary{
      color:#15130c!important;
      border:1px solid #e4ca70!important;
      background:#d7b856!important;
    }
    body.arena-human-ui .secondary{
      color:#e1e8e3!important;
      border:1px solid #2a3b31!important;
      background:#101c15!important;
    }
    body.arena-human-ui .ghost{
      color:#d7e0da!important;
      border:1px solid #26372e!important;
      background:transparent!important;
    }
    body.arena-human-ui .danger{
      color:#ff9ba5!important;
      border:1px solid rgba(255,114,128,.35)!important;
      background:transparent!important;
    }
    body.arena-human-ui :is(.primary,.secondary,.ghost,.danger):hover{
      transform:none!important;
      filter:none!important;
      border-color:var(--innovation-accent)!important;
    }
    body.arena-human-ui button:focus-visible{
      outline:2px solid var(--innovation-accent)!important;
      outline-offset:2px;
    }
    body.arena-human-ui :is(.icon-btn,.admin-btn,#arenaCommandTrigger,.arena-command-close,.arena-sheet-close){
      border-radius:6px!important;
      box-shadow:none!important;
      background:#0c1811!important;
    }
    body.arena-human-ui .admin-btn.active{
      color:var(--innovation-accent)!important;
      border-color:var(--innovation-accent)!important;
      background:#101c15!important;
    }
    body.arena-human-ui [data-page="home"] .hero-actions button{
      min-height:44px!important;
      padding:0 17px!important;
      border-radius:6px!important;
    }
    body.arena-human-ui .home-command{
      gap:13px;
      padding:18px 0;
      border:0;
      border-top:1px solid var(--line);
      border-bottom:1px solid var(--line);
      border-radius:0;
      background:transparent;
      box-shadow:none;
    }
    body.arena-human-ui .home-command h2{
      font-size:clamp(22px,3vw,30px);
      letter-spacing:0;
      text-transform:none;
    }
    body.arena-human-ui .home-online{
      padding:0;
      border:0;
      border-radius:0;
      background:transparent;
    }
    body.arena-human-ui .home-online i{box-shadow:none}
    body.arena-human-ui .home-command nav{gap:7px}
    body.arena-human-ui .home-command nav button{
      grid-template-columns:30px minmax(0,1fr) auto;
      gap:10px;
      min-height:64px;
      padding:10px 11px;
      border:1px solid #223329;
      border-radius:5px;
      color:#e6ece8;
      background:#09130d;
      transition:border-color .14s ease,background .14s ease;
    }
    body.arena-human-ui .home-command nav button:hover{
      transform:none;
      border-color:rgba(var(--innovation-accent-rgb),.46);
      background:#0d1b13;
    }
    body.arena-human-ui .home-command nav>button>i{
      width:30px;
      height:30px;
      border:0;
      border-right:1px solid #2a3b31;
      border-radius:0;
      color:var(--innovation-accent);
      background:transparent;
      font:800 8px/1 Inter,Arial,sans-serif;
      font-variant-numeric:tabular-nums;
    }
    body.arena-human-ui .home-command nav button b{font-size:10px;font-weight:750}
    body.arena-human-ui .home-command nav button small{margin-top:3px;font-size:7px;font-weight:500}
    body.arena-human-ui .home-command nav button em{color:#718178;font-size:17px}
    body.arena-human-ui :is(.arena-home-card button,.arena-open){
      justify-content:space-between;
      min-height:38px!important;
      margin-top:13px;
      padding:9px 0!important;
      border:0!important;
      border-top:1px solid var(--line)!important;
      border-radius:0!important;
      color:#d9e2dc!important;
      background:transparent!important;
      text-align:left;
    }
    body.arena-human-ui .section-head>button{
      min-height:34px;
      border-radius:5px!important;
      background:transparent!important;
    }
    body.arena-human-ui .arena-side-nav .nav-btn{
      grid-template-columns:34px 1fr!important;
      min-height:49px!important;
      padding:6px 8px!important;
      border-radius:6px!important;
      transition:border-color .14s ease,background .14s ease,color .14s ease!important;
    }
    body.arena-human-ui .arena-side-nav .nav-btn:hover{
      transform:none!important;
      background:#0d1a12!important;
    }
    body.arena-human-ui .arena-side-nav .nav-btn i{
      width:32px!important;
      height:32px!important;
      border:0!important;
      border-radius:4px!important;
      color:#85968c!important;
      background:#09140d!important;
      font:800 8px/1 Inter,Arial,sans-serif!important;
      font-variant-numeric:tabular-nums;
    }
    body.arena-human-ui .arena-side-nav .nav-btn.active{
      color:#edf2ee!important;
      border-color:#26382e!important;
      border-left:2px solid var(--innovation-accent)!important;
      background:#101e16!important;
      box-shadow:none!important;
    }
    body.arena-human-ui .arena-side-nav .nav-btn.active i{
      color:var(--innovation-accent)!important;
      background:#0a150e!important;
    }
    body.arena-human-ui .arena-side-nav .nav-btn.active .arena-nav-copy small{color:#82938a!important}
    body.arena-human-ui .arena-side-nav .nav-btn.active:after{display:none!important}
    body.arena-human-ui .arena-mobile-item{
      border-radius:5px;
      font-weight:700;
    }
    body.arena-human-ui .arena-mobile-item i{
      border-radius:3px;
      font:800 8px/1 Inter,Arial,sans-serif;
    }
    body.arena-human-ui .arena-mobile-item.active{
      color:#edf2ee;
      border-top:2px solid var(--innovation-accent);
      background:#101e16;
      box-shadow:none;
    }
    body.arena-human-ui .arena-mobile-item.active i{color:var(--innovation-accent);background:transparent}
    body.arena-human-ui .arena-sheet-item{
      border-radius:6px;
      background:#0b1710;
    }
    body.arena-human-ui .arena-sheet-item i{
      border-radius:4px;
      font:800 8px/1 Inter,Arial,sans-serif;
    }

    /* Portal esportivo: informação acima de ornamento. */
    body.arena-professional-ui{
      --bg:#060a07;
      --bg-soft:#080e0a;
      --surface:#0b1410;
      --surface-2:#0e1913;
      --surface-3:#111f17;
      --line:rgba(222,232,225,.11);
      --line-strong:rgba(227,196,95,.32);
      background:#060a07!important;
      color:#edf2ee;
    }
    body.arena-professional-ui .topbar{
      min-height:64px!important;
      border:1px solid var(--line)!important;
      border-radius:9px!important;
      background:#0a120d!important;
      box-shadow:none!important;
      backdrop-filter:none!important;
    }
    body.arena-professional-ui .brand-copy strong{font-size:20px!important;letter-spacing:.015em!important}
    body.arena-professional-ui .brand-copy span{font-size:7px!important;letter-spacing:.08em!important;text-transform:uppercase}
    body.arena-professional-ui .brand-mark{border-radius:7px!important;box-shadow:none!important}
    body.arena-professional-ui .arena-top-status{display:none!important}
    body.arena-professional-ui .cloud-status{
      min-height:32px!important;
      padding:0 9px!important;
      border-radius:4px!important;
      background:transparent!important;
      font-size:8px!important;
      letter-spacing:.04em!important;
      text-transform:none!important;
    }
    body.arena-professional-ui :is(.icon-btn,.admin-btn,#cloudPanelBtn){border-radius:5px!important;background:#0b1610!important}
    body.arena-professional-ui .arena-clean-panel-icon,
    body.arena-professional-ui .arena-clean-admin-icon{
      display:grid;
      place-items:center;
      min-width:20px;
      height:20px;
      border-right:1px solid #2a3b31;
      padding-right:5px;
      font:800 7px/1 Inter,Arial,sans-serif;
      letter-spacing:.04em;
    }
    body.arena-professional-ui .arena-notification-button>span{font-size:0!important;animation:none!important}
    body.arena-professional-ui .arena-notification-button>span:after{
      content:"AV";
      font:800 7px/1 Inter,Arial,sans-serif;
      letter-spacing:.04em;
    }

    @media(min-width:980px){
      body.arena-professional-ui .bottom-nav.arena-side-nav{
        width:214px!important;
        padding:12px!important;
        border:1px solid var(--line)!important;
        border-radius:10px!important;
        background:#08110c!important;
        box-shadow:none!important;
        backdrop-filter:none!important;
      }
      body.arena-professional-ui .arena-side-brand{padding:4px 4px 14px!important;border-bottom:1px solid var(--line)!important}
      body.arena-professional-ui .arena-side-logo{border-radius:7px!important;box-shadow:none!important}
      body.arena-professional-ui .arena-side-heading{padding:10px 5px 2px!important;color:#788980!important;font-size:7px!important;letter-spacing:.12em!important}
      body.arena-professional-ui .arena-side-footer{
        display:block!important;
        padding:10px 7px!important;
        border:0!important;
        border-top:1px solid var(--line)!important;
        border-radius:0!important;
        background:transparent!important;
      }
    }

    body.arena-professional-ui [data-page="home"] .hero{
      min-height:330px!important;
      padding:clamp(25px,4.2vw,48px)!important;
      border:1px solid rgba(227,196,95,.20)!important;
      border-radius:10px!important;
      background:#0a1810!important;
      box-shadow:none!important;
    }
    body.arena-professional-ui [data-page="home"] .hero:after{display:none!important}
    body.arena-professional-ui [data-page="home"] .hero:before{opacity:.12!important;filter:grayscale(.2) contrast(1.04)!important}
    body.arena-professional-ui [data-page="home"] .hero-content{
      width:min(100%,690px)!important;
      min-height:0!important;
      padding:0!important;
    }
    body.arena-professional-ui [data-page="home"] .hero h1{
      max-width:650px!important;
      margin:10px 0 12px!important;
      font-size:clamp(42px,6vw,64px)!important;
      line-height:.92!important;
      letter-spacing:-.015em!important;
      text-transform:uppercase;
    }
    body.arena-professional-ui [data-page="home"] .hero p{
      max-width:585px!important;
      color:#bac7bf!important;
      font-size:12px!important;
      line-height:1.62!important;
    }
    body.arena-professional-ui [data-page="home"] .hero-actions{margin-top:21px!important}
    body.arena-professional-ui .arena-hero-layout{display:block!important;padding:0!important}
    body.arena-professional-ui .arena-hero-console{display:none!important}

    body.arena-professional-ui .eyebrow{
      display:inline-flex!important;
      min-height:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      color:#cdb45e!important;
      background:transparent!important;
      font-size:8px!important;
      line-height:1.2!important;
      letter-spacing:.12em!important;
      text-transform:uppercase!important;
    }
    body.arena-professional-ui .eyebrow:before{display:none!important}
    body.arena-professional-ui .section-head{
      margin:28px 0 12px!important;
      padding:0!important;
      border-left:0!important;
    }
    body.arena-professional-ui .section-head h2{
      margin-top:4px!important;
      font-size:clamp(23px,3vw,29px)!important;
      line-height:1.05!important;
      letter-spacing:0!important;
      text-transform:none!important;
    }
    body.arena-professional-ui .section-head p{color:#84958b!important;font-size:10px!important}
    body.arena-professional-ui .arena-section-accent:after{display:none!important}

    body.arena-professional-ui #arenaStats{
      display:grid!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:0!important;
      margin:10px 0 30px!important;
      overflow:hidden;
      border:1px solid var(--line)!important;
      border-radius:8px!important;
      background:#09130d!important;
    }
    body.arena-professional-ui #arenaStats .stat{
      min-height:72px!important;
      padding:13px 15px!important;
      border:0!important;
      border-right:1px solid var(--line)!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    body.arena-professional-ui #arenaStats .stat:last-child{border-right:0!important}
    body.arena-professional-ui #arenaStats .stat b{color:#e3c45f!important;font-size:25px!important;font-variant-numeric:tabular-nums}
    body.arena-professional-ui #arenaStats .stat span{margin-top:6px!important;color:#84958b!important;font-size:7px!important;letter-spacing:.07em!important}

    body.arena-professional-ui .home-command{margin:0!important;padding:17px 0 20px!important}
    body.arena-professional-ui .home-command>header{display:block!important}
    body.arena-professional-ui .home-command h2{margin:4px 0 0!important;font-size:25px!important}
    body.arena-professional-ui .home-online{display:none!important}
    body.arena-professional-ui .home-command nav button{background:#09120d!important}
    body.arena-professional-ui .home-command nav button b{font-weight:700!important}
    body.arena-professional-ui .arena-home-scroll{gap:8px!important}
    body.arena-professional-ui .arena-home-card{
      min-height:158px!important;
      padding:15px!important;
      border-radius:7px!important;
      background:#0a1510!important;
      box-shadow:none!important;
    }
    body.arena-professional-ui .arena-home-card:before{display:none!important;content:none!important}
    body.arena-professional-ui .arena-home-card h3{margin:9px 0 6px!important;font-size:24px!important;letter-spacing:0!important}

    body.arena-professional-ui :where(.card,.form-card,.admin-panel,.arena-card,.champion-card,.team-card,.arena-stat,.gi-game,.rank-podium-card,.rank-hall article,.rank-rules article,.league-groups-preview article,.history-values article,.history-timeline article,.history-gallery-card,.registration-card,.registration-admin-card,.auto-standing-card,.champion-ranking-row,.champion-ranking-podium-card){
      border-color:var(--line)!important;
      border-radius:8px!important;
      background:#0b1510!important;
      box-shadow:none!important;
    }
    body.arena-professional-ui :where(.card,.arena-card,.champion-card,.team-card,.arena-stat,.gi-game):hover{transform:none!important;box-shadow:none!important}
    body.arena-professional-ui :is(.arena-symbol,.arena-hero-symbol){display:none!important}
    body.arena-professional-ui .champion-card:after{display:none!important}
    body.arena-professional-ui :is(.arena-status,.arena-filter,.match-status,.live-pill){
      border-radius:4px!important;
      box-shadow:none!important;
      text-shadow:none!important;
    }
    body.arena-professional-ui .arena-filter.active{background:#d7b856!important}
    body.arena-professional-ui :is(input,select,textarea){border-radius:6px!important;background:#07100b!important;box-shadow:none!important}
    body.arena-professional-ui :is(.modal,.arena-notification-panel,.arena-notification-editor,.arena-nav-sheet){border-radius:10px!important;background:#0b1510!important;box-shadow:none!important;backdrop-filter:none!important}
    body.arena-professional-ui .admin-panel{background:#0b1510!important}
    body.arena-professional-ui .admin-panel h3{text-transform:none!important;letter-spacing:0!important}
    body.arena-professional-ui #arenaBackToTop{border-radius:5px!important}
    body.arena-professional-ui .arena-page-back{
      min-width:80px!important;
      height:40px!important;
      padding:0 12px!important;
      border:1px solid #2a3a31!important;
      border-radius:6px!important;
      color:#dce5df!important;
      background:#0a1610!important;
      box-shadow:none!important;
      font-size:10px!important;
      font-weight:700!important;
    }
    body.arena-professional-ui .arena-page-back:hover{border-color:#5b5130!important;background:#0d1b13!important}

    @media(max-width:720px){
      body.arena-professional-ui{padding-bottom:calc(68px + env(safe-area-inset-bottom))!important}
      body.arena-professional-ui .topbar.arena-topbar-clean{
        top:0!important;
        min-height:57px!important;
        margin:0 0 12px!important;
        padding:8px 12px!important;
        gap:6px!important;
        border-width:0 0 1px!important;
        border-color:#223128!important;
        border-radius:0!important;
        background:rgba(7,16,11,.98)!important;
        box-shadow:0 8px 24px rgba(0,0,0,.18)!important;
        backdrop-filter:none!important;
      }
      body.arena-professional-ui.arena-has-page-back .topbar.arena-topbar-clean .brand{display:none!important}
      body.arena-professional-ui .topbar.arena-topbar-clean .brand,
      body.arena-professional-ui .topbar.arena-topbar-clean .brand-mark{width:40px!important;min-width:40px!important;height:40px!important;border-radius:7px!important}
      body.arena-professional-ui .topbar.arena-topbar-clean .top-actions{gap:4px!important}
      body.arena-professional-ui .arena-page-back{
        width:auto!important;
        min-width:76px!important;
        height:40px!important;
        padding:0 11px!important;
        gap:7px!important;
        border-radius:6px!important;
      }
      body.arena-professional-ui .arena-page-back span{position:static!important;width:auto!important;height:auto!important;overflow:visible!important;clip-path:none!important;white-space:nowrap!important}
      body.arena-professional-ui .arena-page-back svg{width:17px!important;height:17px!important}
      body.arena-professional-ui .topbar.arena-topbar-clean :is(#arenaNotificationsBtn,#adminBtn){width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;border-radius:6px!important;background:#0a1610!important}
      body.arena-professional-ui .topbar.arena-topbar-clean #cloudPanelBtn{min-width:68px!important;height:40px!important;min-height:40px!important;padding-inline:8px!important;border-radius:6px!important;background:#0a1610!important}
      body.arena-professional-ui [data-page="home"] .hero{min-height:310px!important;padding:27px 20px!important;border-radius:8px!important}
      body.arena-professional-ui [data-page="home"] .hero h1{font-size:clamp(42px,13vw,58px)!important}
      body.arena-professional-ui #arenaStats{grid-template-columns:repeat(5,minmax(88px,1fr))!important;overflow-x:auto}
      body.arena-professional-ui #arenaStats .stat{min-height:67px!important;padding:12px!important}
      body.arena-professional-ui .arena-mobile-nav{
        left:0!important;
        right:0!important;
        bottom:0!important;
        width:100%!important;
        height:calc(64px + env(safe-area-inset-bottom))!important;
        padding:4px 8px env(safe-area-inset-bottom)!important;
        gap:2px!important;
        border-width:1px 0 0!important;
        border-color:#223128!important;
        border-radius:0!important;
        background:rgba(6,14,10,.985)!important;
        box-shadow:0 -8px 24px rgba(0,0,0,.24)!important;
        backdrop-filter:none!important;
      }
      body.arena-professional-ui .arena-mobile-item{
        position:relative!important;
        min-height:56px!important;
        gap:3px!important;
        border-radius:5px!important;
        color:#7f9187!important;
        background:transparent!important;
        box-shadow:none!important;
        font-size:8px!important;
        font-weight:650!important;
      }
      body.arena-professional-ui .arena-mobile-item i{width:24px!important;height:24px!important;color:inherit!important;background:transparent!important}
      body.arena-professional-ui .arena-mobile-item i svg{width:19px!important;height:19px!important;stroke-width:1.75!important}
      body.arena-professional-ui .arena-mobile-item.active{color:#e3c45f!important;background:transparent!important}
      body.arena-professional-ui .arena-mobile-item.active:before{content:"";position:absolute;left:24%;right:24%;top:-4px;height:2px;border-radius:0 0 2px 2px;background:#d7b856}
      body.arena-professional-ui .arena-nav-sheet{padding:16px 14px max(14px,env(safe-area-inset-bottom))!important;border-radius:12px 12px 0 0!important;background:#08130d!important;box-shadow:0 -18px 48px rgba(0,0,0,.42)!important}
      body.arena-professional-ui .arena-nav-sheet h2{font-size:24px!important;letter-spacing:0!important;text-transform:none!important}
      body.arena-professional-ui .arena-sheet-item{grid-template-columns:38px 1fr auto!important;min-height:58px!important;padding:8px 10px!important;border-radius:6px!important;background:transparent!important}
      body.arena-professional-ui .arena-sheet-item i{width:36px!important;height:36px!important;border-radius:6px!important;background:#0b1911!important}
      body.arena-professional-ui .arena-sheet-item i svg{width:18px!important;height:18px!important}
      body.arena-professional-ui .arena-home-scroll{grid-auto-columns:82%!important}
    }

    @media(max-width:360px){
      body.arena-professional-ui .topbar.arena-topbar-clean{padding-inline:8px!important}
      body.arena-professional-ui .arena-page-back{min-width:70px!important;padding-inline:8px!important}
      body.arena-professional-ui .topbar.arena-topbar-clean #cloudPanelBtn{min-width:60px!important;padding-inline:5px!important}
    }

    @media(max-width:900px){body.arena-human-ui .home-command nav{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){body.arena-human-ui .home-command nav{grid-template-columns:1fr}}

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
