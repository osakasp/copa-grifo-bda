(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.documentElement.dataset.arenaDesign = 'pro-2026';
  document.body.classList.add('arena-design-pro');

  function currentPage() {
    return $('.page.active')?.dataset.page || 'home';
  }

  function syncPageTheme() {
    document.body.dataset.currentPage = currentPage();
  }

  function installTopStatus() {
    const topbar = $('.topbar');
    const actions = $('.top-actions', topbar);
    if (!topbar || !actions || $('.arena-top-status', topbar)) return;

    const status = document.createElement('div');
    status.className = 'arena-top-status';
    status.innerHTML = '<i></i><span>Clã BDA online</span>';
    actions.prepend(status);
  }

  function installProgress() {
    if ($('#arenaScrollProgress')) return;
    const progress = document.createElement('div');
    progress.id = 'arenaScrollProgress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<i></i>';
    document.body.append(progress);

    const update = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const percent = Math.min(100, Math.max(0, scrollY / total * 100));
      progress.style.setProperty('--arena-progress', `${percent}%`);
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update, { passive: true });
    update();
  }

  function installBackToTop() {
    if ($('#arenaBackToTop')) return;
    const button = document.createElement('button');
    button.id = 'arenaBackToTop';
    button.type = 'button';
    button.setAttribute('aria-label', 'Voltar ao topo');
    button.innerHTML = '<span>↑</span>';
    button.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.append(button);

    const update = () => button.classList.toggle('show', scrollY > 520);
    addEventListener('scroll', update, { passive: true });
    update();
  }

  function installRipple() {
    document.addEventListener('pointerdown', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || button.closest('.history-gallery-media')) return;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.45;
      const ripple = document.createElement('span');
      ripple.className = 'arena-button-ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  function enhanceImages() {
    $$('img').forEach(image => {
      if (!image.hasAttribute('decoding')) image.decoding = 'async';
      if (!image.closest('.hero,.topbar,.arena-side-brand,.history-hero,.rank-hero') && !image.hasAttribute('loading')) {
        image.loading = 'lazy';
      }
    });
  }

  function enhanceStructure() {
    installTopStatus();
    enhanceImages();
    syncPageTheme();
  }

  const style = document.createElement('style');
  style.textContent = `
    :root{
      --bg:#030805;
      --bg-soft:#07110b;
      --surface:rgba(11,25,17,.92);
      --surface-2:rgba(17,38,25,.90);
      --surface-3:rgba(25,51,35,.74);
      --line:rgba(219,241,226,.115);
      --line-strong:rgba(242,215,125,.38);
      --text:#f7faf6;
      --muted:#a6b8ad;
      --gold:#d3a93a;
      --gold-soft:#f5dc86;
      --green:#58e59a;
      --red:#ff7280;
      --blue:#77bdff;
      --shadow:0 24px 70px rgba(0,0,0,.40);
      --shadow-soft:0 14px 38px rgba(0,0,0,.24);
      --radius:22px;
      --radius-small:15px;
    }

    *{scrollbar-width:thin;scrollbar-color:rgba(242,215,125,.30) rgba(255,255,255,.02)}
    *::-webkit-scrollbar{width:8px;height:8px}
    *::-webkit-scrollbar-track{background:rgba(255,255,255,.02)}
    *::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:999px;background:rgba(242,215,125,.28);background-clip:padding-box}
    *::-webkit-scrollbar-thumb:hover{background:rgba(242,215,125,.46);background-clip:padding-box}

    body.arena-design-pro{
      position:relative;
      isolation:isolate;
      color:var(--text);
      background:
        radial-gradient(circle at 78% -8%,rgba(242,215,125,.18),transparent 29%),
        radial-gradient(circle at 8% 34%,rgba(88,229,154,.08),transparent 27%),
        radial-gradient(circle at 92% 78%,rgba(109,182,255,.05),transparent 23%),
        linear-gradient(180deg,#08130d 0,#030805 47%,#020503 100%)!important;
    }
    body.arena-design-pro:before{
      content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:.34;
      background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
      background-size:42px 42px;
      mask-image:linear-gradient(to bottom,black,transparent 78%);
    }
    body.arena-design-pro:after{
      content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
      background:linear-gradient(115deg,transparent 0 48%,rgba(242,215,125,.025) 49%,transparent 50% 100%);
      background-size:260px 260px;
    }

    ::selection{color:#171107;background:var(--gold-soft)}
    a{color:var(--gold-soft)}
    button{position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent}
    button:disabled{cursor:not-allowed;opacity:.48;filter:saturate(.5)}
    .arena-button-ripple{position:absolute;z-index:0;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.23);transform:scale(0);animation:arenaRipple .55s ease-out}
    button>*{position:relative;z-index:1}
    @keyframes arenaRipple{to{transform:scale(1);opacity:0}}

    #arenaScrollProgress{position:fixed;left:0;right:0;top:0;z-index:140;height:3px;pointer-events:none;background:rgba(255,255,255,.025)}
    #arenaScrollProgress i{display:block;width:var(--arena-progress,0%);height:100%;background:linear-gradient(90deg,var(--green),var(--gold-soft),var(--gold));box-shadow:0 0 16px rgba(242,215,125,.58);transition:width .08s linear}
    #arenaBackToTop{position:fixed;right:18px;bottom:22px;z-index:47;display:grid;place-items:center;width:44px;height:44px;border:1px solid rgba(242,215,125,.42);border-radius:15px;color:#171107;background:linear-gradient(145deg,var(--gold-soft),var(--gold));box-shadow:0 12px 28px rgba(0,0,0,.36);opacity:0;visibility:hidden;transform:translateY(12px) scale(.92);transition:.2s}
    #arenaBackToTop.show{opacity:1;visibility:visible;transform:none}
    #arenaBackToTop:hover{transform:translateY(-3px)}
    #arenaBackToTop span{font-size:21px;font-weight:900}

    .app-shell{position:relative}
    .topbar{
      min-height:74px!important;padding:11px 14px!important;border:1px solid rgba(219,241,226,.105)!important;
      background:linear-gradient(180deg,rgba(9,22,14,.92),rgba(4,10,7,.84))!important;
      box-shadow:0 18px 46px rgba(0,0,0,.24)!important;backdrop-filter:blur(22px) saturate(1.25)!important;
    }
    .topbar:after{content:"";position:absolute;left:18px;right:18px;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-soft),transparent);opacity:.24}
    .brand-mark{overflow:hidden;border:1px solid rgba(242,215,125,.48)!important;background:linear-gradient(145deg,#152b1d,#030806)!important;box-shadow:0 10px 27px rgba(0,0,0,.34),inset 0 0 18px rgba(242,215,125,.10)!important;transform:none!important}
    .brand-mark img{width:100%;height:100%;object-fit:cover}
    .brand-copy strong{font-size:23px!important;letter-spacing:.075em!important}
    .brand-copy span{color:#b8c6bd!important;font-size:8px!important;font-weight:700!important}
    .top-actions{gap:7px!important}
    .arena-top-status{display:flex;align-items:center;gap:7px;min-height:38px;padding:0 11px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.035);font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
    .arena-top-status i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(88,229,154,.10),0 0 13px rgba(88,229,154,.55)}
    .icon-btn,.admin-btn{border-color:rgba(219,241,226,.13)!important;background:linear-gradient(145deg,rgba(24,48,33,.84),rgba(7,16,11,.90))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 22px rgba(0,0,0,.16)}
    .icon-btn:hover,.admin-btn:hover{border-color:rgba(242,215,125,.42)!important;transform:translateY(-1px)}
    .admin-btn.active{color:#171107!important;background:linear-gradient(135deg,var(--gold-soft),var(--gold))!important}

    main{position:relative;padding-top:20px!important}
    .page.active{animation:arenaPageIn .34s cubic-bezier(.2,.8,.2,1)}
    @keyframes arenaPageIn{from{opacity:0;transform:translateY(12px) scale(.995)}to{opacity:1;transform:none}}

    .hero,.arena-hero,.rank-hero,.history-hero,.league-generator-head{
      border-color:rgba(242,215,125,.34)!important;
      box-shadow:0 28px 80px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.05)!important;
    }
    .hero{min-height:330px!important;padding:clamp(22px,4vw,34px)!important;border-radius:31px!important;background:linear-gradient(180deg,transparent 0 22%,rgba(3,8,5,.92) 84%),radial-gradient(circle at 78% 19%,rgba(245,220,134,.42),transparent 20%),linear-gradient(135deg,#1c4b30,#08140d 66%)!important}
    .hero:before{opacity:.18!important;filter:grayscale(.2) contrast(1.2) drop-shadow(0 20px 28px rgba(0,0,0,.4))!important}
    .hero:after{background:linear-gradient(110deg,transparent 0 55%,rgba(255,255,255,.028) 56%,transparent 57%),repeating-linear-gradient(115deg,transparent 0 46px,rgba(255,255,255,.014) 46px 48px)!important}
    .hero h1{max-width:800px;margin-top:10px!important;font-size:clamp(45px,8vw,76px)!important;letter-spacing:-.025em!important;text-wrap:balance}
    .hero p{font-size:12px!important;line-height:1.68!important}
    .eyebrow{display:inline-flex;align-items:center;gap:7px;color:var(--gold-soft)!important;font-size:9px!important;font-weight:900!important;letter-spacing:.18em!important}
    .eyebrow:before{content:"";width:18px;height:2px;border-radius:999px;background:linear-gradient(90deg,var(--gold-soft),transparent)}

    .primary,.secondary,.ghost,.danger{
      min-height:43px!important;border-radius:13px!important;padding-inline:15px!important;font-size:10px!important;letter-spacing:.025em!important;
      transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease!important;
    }
    .primary{background:linear-gradient(135deg,#f9e8a7 0,var(--gold-soft) 33%,var(--gold) 100%)!important;box-shadow:0 12px 27px rgba(211,169,58,.20),inset 0 1px 0 rgba(255,255,255,.48)!important}
    .secondary{border-color:rgba(219,241,226,.14)!important;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.035))!important}
    .ghost{border-color:rgba(242,215,125,.32)!important;background:rgba(242,215,125,.025)!important}
    .danger{background:linear-gradient(145deg,rgba(255,114,128,.15),rgba(255,114,128,.07))!important}
    .primary:hover,.secondary:hover,.ghost:hover,.danger:hover{transform:translateY(-2px);filter:brightness(1.06)}
    .primary:active,.secondary:active,.ghost:active,.danger:active{transform:translateY(0) scale(.985)}

    .section-head{position:relative;margin-top:30px!important;margin-bottom:13px!important;padding-left:13px}
    .section-head:before{content:"";position:absolute;left:0;top:1px;bottom:1px;width:3px;border-radius:999px;background:linear-gradient(var(--gold-soft),var(--gold));box-shadow:0 0 13px rgba(242,215,125,.28)}
    .section-head h2{font-size:clamp(24px,4vw,31px)!important;line-height:.95!important;letter-spacing:.025em!important}
    .section-head p{margin-top:6px!important;font-size:9px!important;line-height:1.45!important}
    .section-head>button{min-height:35px;padding:0 10px;border:1px solid var(--line)!important;border-radius:11px!important;background:rgba(255,255,255,.035)!important;font-size:9px!important}

    :where(.card,.arena-card,.champion-card,.team-card,.stat,.arena-stat,.gi-game,.rank-podium-card,.rank-hall article,.rank-rules article,.league-groups-preview article,.history-values article,.history-timeline article,.history-gallery-card,.registration-card,.registration-admin-card,.auto-standing-card){
      border-color:rgba(219,241,226,.105)!important;
      background:linear-gradient(152deg,rgba(24,49,33,.82),rgba(8,19,13,.94))!important;
      box-shadow:0 14px 38px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.025)!important;
      transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease!important;
    }
    :where(.card,.arena-card,.champion-card,.team-card,.stat,.arena-stat,.gi-game,.rank-podium-card,.league-groups-preview article,.history-values article,.history-gallery-card):hover{
      border-color:rgba(242,215,125,.26)!important;box-shadow:0 20px 52px rgba(0,0,0,.29),inset 0 1px 0 rgba(255,255,255,.04)!important;
    }
    @media(hover:hover) and (pointer:fine){
      :where(.arena-card,.champion-card,.team-card,.stat,.arena-stat,.gi-game,.rank-podium-card,.league-groups-preview article,.history-values article,.history-gallery-card):hover{transform:translateY(-4px)}
    }

    .quick-stats{gap:9px!important;margin:16px 0!important}
    .stat{position:relative;overflow:hidden;min-height:91px;padding:16px!important;border-radius:18px!important}
    .stat:after{content:"";position:absolute;right:-18px;bottom:-27px;width:65px;height:65px;border:1px solid rgba(242,215,125,.09);border-radius:50%}
    .stat b{font-size:31px!important;text-shadow:0 6px 20px rgba(242,215,125,.13)}
    .stat span{font-size:8px!important}

    .live-card,.match-list,.rank-table-wrap{overflow:hidden;border-radius:21px!important}
    .live-top{background:linear-gradient(90deg,rgba(255,114,128,.06),transparent)!important}
    .versus{min-height:155px!important;padding:23px 16px!important}
    .club-badge,.team-mini-badge,.rank-badge,.gi-badge{box-shadow:0 10px 24px rgba(0,0,0,.31),inset 0 1px 0 rgba(255,255,255,.34)!important}
    .match-row{min-height:66px!important;padding:13px 14px!important;transition:background .16s ease}
    .match-row:hover{background:rgba(255,255,255,.025)}

    .arena-cover,.champion-banner-frame,.history-gallery-media{background:#020503!important}
    .arena-cover img,.champion-banner-image,.history-gallery-media img{filter:saturate(1.04) contrast(1.02)}
    .arena-body h3,.champion-card h3,.team-card h3,.history-gallery-copy h3{text-wrap:balance}
    .arena-meta span,.arena-club{border-color:rgba(219,241,226,.10)!important;background:rgba(255,255,255,.035)!important}

    input,select,textarea{
      min-height:45px;border-color:rgba(219,241,226,.13)!important;border-radius:13px!important;
      color:var(--text)!important;background:linear-gradient(145deg,rgba(2,7,4,.72),rgba(9,21,14,.78))!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease!important;
    }
    textarea{line-height:1.55!important}
    input:hover,select:hover,textarea:hover{border-color:rgba(242,215,125,.26)!important}
    input:focus,select:focus,textarea:focus{border-color:var(--gold-soft)!important;outline:none!important;box-shadow:0 0 0 3px rgba(242,215,125,.10),inset 0 1px 0 rgba(255,255,255,.025)!important}
    label{color:#aec0b5!important;font-size:8px!important;font-weight:800!important;letter-spacing:.095em!important}
    option{color:var(--text);background:#0b1a11}

    .modal-backdrop{background:rgba(0,0,0,.76)!important;backdrop-filter:blur(11px)!important}
    .modal{border-color:rgba(242,215,125,.34)!important;background:radial-gradient(circle at 100% 0,rgba(242,215,125,.12),transparent 30%),linear-gradient(150deg,#142d1e,#06100a)!important;box-shadow:0 34px 100px rgba(0,0,0,.66)!important}
    .modal h2{font-size:31px!important;text-transform:uppercase}
    .toast{border:1px solid rgba(242,215,125,.32)!important;border-radius:14px!important;background:linear-gradient(145deg,#173c27,#07100c)!important;box-shadow:0 18px 45px rgba(0,0,0,.48)!important}
    .empty,.rank-empty,.gi-empty,.history-empty,.history-gallery-empty,.league-empty{border-color:rgba(242,215,125,.22)!important;background:linear-gradient(145deg,rgba(242,215,125,.035),rgba(255,255,255,.018))!important}

    .admin-panel{border-color:rgba(242,215,125,.35)!important;border-radius:20px!important;background:radial-gradient(circle at 90% 0,rgba(242,215,125,.12),transparent 32%),linear-gradient(145deg,rgba(33,66,45,.78),rgba(8,20,13,.88))!important;box-shadow:var(--shadow-soft)!important}
    .admin-tools{gap:7px!important}

    table{font-variant-numeric:tabular-nums}
    .rank-table-wrap{box-shadow:var(--shadow-soft)!important}
    .rank-table thead th{background:rgba(4,11,7,.96)!important;backdrop-filter:blur(12px)}
    .rank-table tbody tr{transition:background .14s ease}
    .rank-table tbody tr:nth-child(even){background:rgba(255,255,255,.012)}
    .rank-table tbody tr:hover{background:rgba(242,215,125,.045)!important}

    #giManager>nav,.rank-toolbar,.arena-toolbar,.history-gallery-toolbar{
      border-color:rgba(219,241,226,.105)!important;background:rgba(4,11,7,.78)!important;box-shadow:0 12px 30px rgba(0,0,0,.20)!important;backdrop-filter:blur(17px)!important;
    }
    #giManager>nav button,.rank-toolbar nav button,.arena-filter,.history-gallery-filters button{transition:background .16s ease,color .16s ease,transform .16s ease!important}
    #giManager>nav button:hover,.rank-toolbar nav button:hover,.arena-filter:hover,.history-gallery-filters button:hover{transform:translateY(-1px);color:var(--text)!important}

    .history-story p,.history-timeline-copy p,.history-gallery-copy p,.arena-hero-copy p,.rank-hero p{color:#c8d5cd!important}
    .history-quote{box-shadow:0 20px 54px rgba(0,0,0,.30)!important}
    .history-gallery-lightbox{background:rgba(0,0,0,.89)!important;backdrop-filter:blur(15px)!important}

    .bottom-nav.arena-side-nav{border-color:rgba(242,215,125,.28)!important;background:radial-gradient(circle at 50% 0,rgba(242,215,125,.15),transparent 25%),linear-gradient(180deg,rgba(12,29,19,.98),rgba(3,9,6,.985))!important;box-shadow:0 30px 80px rgba(0,0,0,.53)!important}
    .arena-side-nav .nav-btn{transition:transform .16s ease,border-color .16s ease,background .16s ease!important}
    .arena-side-nav .nav-btn:not(.active):hover{background:rgba(255,255,255,.045)!important;border-color:rgba(242,215,125,.18)!important}
    .arena-mobile-nav{border-color:rgba(242,215,125,.29)!important;background:linear-gradient(180deg,rgba(15,35,23,.97),rgba(4,11,7,.985))!important;box-shadow:0 22px 58px rgba(0,0,0,.60)!important}

    @media(min-width:981px){
      body.arena-design-pro .topbar{margin-top:14px!important;border-radius:21px!important}
      body.arena-design-pro main{padding-inline:8px!important;padding-bottom:48px!important}
      #arenaBackToTop{right:24px;bottom:24px}
    }

    @media(max-width:980px){
      #arenaBackToTop{right:14px;bottom:94px;width:40px;height:40px;border-radius:13px}
      .topbar{margin:8px 8px 0;border-radius:18px!important;min-height:67px!important;padding:9px 10px!important}
      main{padding:14px 12px 22px!important}
      .hero{min-height:350px!important;border-radius:25px!important}
      .arena-top-status{display:none}
      .brand-copy strong{font-size:20px!important}
      .brand-copy span{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .quick-stats{grid-template-columns:repeat(3,1fr)!important}
      .stat{min-height:79px;padding:13px 10px!important}
      .stat b{font-size:26px!important}
      .section-head{align-items:start!important}
    }

    @media(max-width:620px){
      .hero{min-height:390px!important;padding:21px!important}
      .hero h1{font-size:clamp(40px,15vw,62px)!important}
      .hero-actions{display:grid!important;grid-template-columns:1fr 1fr!important}
      .hero-actions button{width:100%}
      .quick-stats{gap:7px!important}
      .stat{border-radius:15px!important}
      .section-head{display:grid!important}
      .section-head>button{justify-self:start}
      .versus{gap:7px!important;padding-inline:8px!important}
      .club-badge{width:50px!important;height:50px!important}
      .scorebox b{font-size:21px!important}
      .form-actions{display:grid!important;grid-template-columns:1fr 1fr!important}
      .modal{padding:17px!important;border-radius:22px!important}
    }

    @media(max-width:390px){
      .hero-actions{grid-template-columns:1fr!important}
      .quick-stats{grid-template-columns:repeat(2,1fr)!important}
      .top-actions{gap:5px!important}.icon-btn{width:38px!important}.admin-btn{padding-inline:9px!important;font-size:9px!important}
      .brand-mark{width:42px!important;height:42px!important}
    }

    @media(prefers-reduced-motion:reduce){
      *,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
    }
  `;
  document.head.append(style);

  installProgress();
  installBackToTop();
  installRipple();
  enhanceStructure();

  window.ArenaDOMEvents.subscribe(() => requestAnimationFrame(enhanceStructure), { selector: 'body,.app-view,.bottom-nav,.arena-card' });
})();
