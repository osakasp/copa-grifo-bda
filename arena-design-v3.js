(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.documentElement.dataset.arenaDesign = 'v3';
  document.body.classList.add('arena-design-v3');

  function improveBrand() {
    const strong = $('.brand-copy strong');
    const subtitle = $('.brand-copy span');
    if (strong) strong.textContent = 'Arena BDA';
    if (subtitle) subtitle.textContent = 'Competições oficiais do Clã';
  }

  function improveNavigation() {
    $$('.bottom-nav .nav-btn').forEach(button => {
      if (!button.title) button.title = button.textContent.trim();
      button.setAttribute('aria-label', button.textContent.trim());
    });
  }

  function improveAccessibility(root = document) {
    $$('img:not([decoding])', root).forEach(image => { image.decoding = 'async'; });
    $$('button:not([type])', root).forEach(button => { button.type = 'button'; });
    $$('input,select,textarea', root).forEach(field => {
      if (!field.autocomplete && field.type !== 'password') field.autocomplete = 'off';
    });
  }

  function markSections(root = document) {
    $$('.page', root).forEach(page => page.classList.add('arena-page-v3'));
    $$('.card,.form-card,.admin-panel,.live-card,.arena-card,.team-card,.champion-card', root)
      .forEach(card => card.classList.add('arena-surface-v3'));
  }

  function refresh(root = document) {
    improveBrand();
    improveNavigation();
    improveAccessibility(root);
    markSections(root);
  }

  const style = document.createElement('style');
  style.id = 'arenaDesignV3Styles';
  style.textContent = `
    :root{
      --arena-bg-0:#020503;
      --arena-bg-1:#06100a;
      --arena-bg-2:#0a1810;
      --arena-panel:rgba(10,24,16,.88);
      --arena-panel-strong:rgba(15,34,23,.96);
      --arena-panel-soft:rgba(255,255,255,.035);
      --arena-border:rgba(221,241,227,.11);
      --arena-border-strong:rgba(245,220,134,.32);
      --arena-text:#f6faf7;
      --arena-muted:#a7b8ad;
      --arena-gold:#d6aa39;
      --arena-gold-soft:#f6df91;
      --arena-green:#5be19a;
      --arena-danger:#ff7987;
      --arena-radius-xl:28px;
      --arena-radius-lg:21px;
      --arena-radius-md:15px;
      --arena-shadow-xl:0 32px 90px rgba(0,0,0,.44);
      --arena-shadow-lg:0 18px 46px rgba(0,0,0,.28);
      --arena-ease:cubic-bezier(.2,.8,.2,1);
    }

    html{background:var(--arena-bg-0)}
    body.arena-design-v3{
      min-height:100dvh;
      color:var(--arena-text);
      background:
        radial-gradient(circle at 82% -5%,rgba(246,223,145,.14),transparent 30%),
        radial-gradient(circle at 10% 28%,rgba(91,225,154,.07),transparent 25%),
        linear-gradient(180deg,var(--arena-bg-2),var(--arena-bg-0) 58%)!important;
    }
    body.arena-design-v3:before{
      opacity:.21!important;
      background-size:54px 54px!important;
    }

    .app-shell{
      width:min(100%,1280px)!important;
      max-width:1280px!important;
      padding-inline:clamp(10px,2vw,22px);
    }

    .topbar{
      top:10px!important;
      z-index:120!important;
      width:100%;
      min-height:70px!important;
      margin:10px auto 0!important;
      padding:10px 12px!important;
      border:1px solid var(--arena-border)!important;
      border-radius:22px!important;
      background:linear-gradient(180deg,rgba(10,24,16,.94),rgba(4,10,7,.90))!important;
      box-shadow:0 18px 50px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.035)!important;
      backdrop-filter:blur(20px) saturate(1.12)!important;
    }
    .topbar:after{left:26px!important;right:26px!important;opacity:.34!important}
    .brand{gap:12px!important}
    .brand-mark{
      width:49px!important;height:49px!important;border-radius:16px!important;
      box-shadow:0 10px 24px rgba(0,0,0,.34),0 0 0 1px rgba(246,223,145,.08)!important;
    }
    .brand-copy strong{font-size:24px!important;letter-spacing:.055em!important}
    .brand-copy span{margin-top:4px!important;color:#aebdb3!important;font-size:8px!important;letter-spacing:.13em!important}
    .arena-top-status{min-height:36px!important;background:rgba(255,255,255,.027)!important}
    .top-actions{gap:6px!important}
    .top-actions button{min-height:40px!important}

    main{
      width:100%;
      padding:24px 4px 10px!important;
    }
    .arena-page-v3{min-height:55vh}
    .page.active{animation:arenaV3Page .28s var(--arena-ease)}
    @keyframes arenaV3Page{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

    .hero,.arena-hero,.rank-hero,.history-hero,.league-generator-head{
      overflow:hidden!important;
      border:1px solid var(--arena-border-strong)!important;
      border-radius:var(--arena-radius-xl)!important;
      box-shadow:var(--arena-shadow-xl),inset 0 1px 0 rgba(255,255,255,.045)!important;
    }
    .hero{
      min-height:310px!important;
      padding:clamp(22px,4vw,38px)!important;
      background:
        linear-gradient(180deg,transparent 0 22%,rgba(2,7,4,.92) 88%),
        radial-gradient(circle at 82% 17%,rgba(246,223,145,.35),transparent 20%),
        linear-gradient(135deg,#173c27,#07120b 68%)!important;
    }
    .hero h1{max-width:850px;font-size:clamp(43px,7.2vw,74px)!important;line-height:.9!important;text-wrap:balance}
    .hero p{max-width:650px!important;color:#ced9d1!important;font-size:13px!important;line-height:1.65!important}
    .hero-actions{gap:8px!important;margin-top:20px!important}

    .section-head{
      align-items:center!important;
      margin:30px 3px 13px!important;
      padding-left:14px;
      border-left:3px solid var(--arena-gold-soft);
    }
    .section-head h2{font-size:clamp(25px,4vw,32px)!important;line-height:1!important;letter-spacing:.015em!important}
    .section-head p{margin-top:5px!important;font-size:11px!important;line-height:1.45!important}
    .section-head>button{min-height:38px!important;padding:0 11px!important;border:1px solid var(--arena-border)!important;border-radius:11px!important;background:rgba(255,255,255,.03)!important}

    .arena-surface-v3,.card,.form-card,.admin-panel{
      border-color:var(--arena-border)!important;
      background:linear-gradient(155deg,rgba(17,37,25,.91),rgba(7,17,11,.94))!important;
      box-shadow:var(--arena-shadow-lg),inset 0 1px 0 rgba(255,255,255,.025)!important;
    }
    .card{border-radius:var(--arena-radius-lg)!important}
    .quick-stats{gap:12px!important;margin:16px 0!important}
    .stat{
      min-height:91px;
      display:grid;
      align-content:center;
      padding:17px 15px!important;
      border-color:var(--arena-border)!important;
      border-radius:18px!important;
      background:linear-gradient(145deg,rgba(20,44,29,.88),rgba(7,17,11,.94))!important;
      box-shadow:0 14px 34px rgba(0,0,0,.19)!important;
    }
    .stat b{font-size:31px!important}.stat span{font-size:8px!important}

    .primary,.secondary,.ghost,.danger,.admin-btn,.icon-btn{
      min-height:42px!important;
      border-radius:12px!important;
      transition:transform .16s var(--arena-ease),border-color .16s ease,background .16s ease,box-shadow .16s ease!important;
    }
    .primary{color:#171107!important;background:linear-gradient(135deg,#fff0b4,var(--arena-gold-soft) 44%,var(--arena-gold))!important}
    .secondary{color:var(--arena-text)!important;background:rgba(255,255,255,.055)!important;border-color:var(--arena-border)!important}
    .ghost{color:var(--arena-gold-soft)!important;background:rgba(246,223,145,.025)!important;border-color:rgba(246,223,145,.24)!important}
    .danger{color:#ffc0c6!important;background:rgba(255,121,135,.09)!important;border-color:rgba(255,121,135,.23)!important}
    button:hover{filter:brightness(1.05)}
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{
      outline:3px solid rgba(246,223,145,.24)!important;
      outline-offset:2px!important;
    }

    input,select,textarea{
      min-height:45px;
      border:1px solid var(--arena-border)!important;
      border-radius:12px!important;
      color:var(--arena-text)!important;
      background:rgba(2,7,4,.66)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
    }
    textarea{min-height:105px}
    label{color:#aebdb3!important;font-size:9px!important}
    .form-card{padding:18px!important;border-radius:22px!important}
    .form-grid{gap:13px!important}

    .team-grid,.champion-grid,.arena-grid{gap:14px!important}
    .team-card,.champion-card,.arena-card{transition:transform .18s var(--arena-ease),border-color .18s ease,box-shadow .18s ease}
    .team-card:hover,.champion-card:hover,.arena-card:hover{transform:translateY(-3px);border-color:rgba(246,223,145,.25)!important;box-shadow:0 22px 52px rgba(0,0,0,.30)!important}
    .team-card{padding:16px!important}
    .team-card h3{font-size:20px!important}
    .team-meta{padding-top:12px!important}
    .team-mini-badge{width:48px!important;height:48px!important}

    .bottom-nav{
      left:50%!important;
      bottom:12px!important;
      width:min(calc(100% - 20px),760px)!important;
      min-height:70px!important;
      gap:5px;
      padding:7px!important;
      border:1px solid rgba(221,241,227,.13)!important;
      border-radius:22px!important;
      background:rgba(7,17,11,.92)!important;
      box-shadow:0 22px 60px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.035)!important;
      backdrop-filter:blur(20px) saturate(1.16)!important;
    }
    .nav-btn{
      position:relative;
      min-height:54px;
      border-radius:15px!important;
      color:#92a49a!important;
      transition:background .16s ease,color .16s ease,transform .16s var(--arena-ease)!important;
    }
    .nav-btn i{font-size:20px!important}
    .nav-btn.active{
      color:#171107!important;
      background:linear-gradient(135deg,#fff0b4,var(--arena-gold-soft),var(--arena-gold))!important;
      box-shadow:0 9px 22px rgba(214,170,57,.22)!important;
    }
    .nav-btn:active{transform:scale(.97)}

    .modal-backdrop{
      padding:16px!important;
      background:rgba(0,0,0,.80)!important;
      backdrop-filter:blur(10px)!important;
    }
    .modal{
      width:min(100%,560px)!important;
      max-height:calc(100dvh - 32px)!important;
      padding:21px!important;
      border:1px solid var(--arena-border-strong)!important;
      border-radius:25px!important;
      background:linear-gradient(160deg,#153322,#07110b)!important;
      box-shadow:0 36px 100px rgba(0,0,0,.68)!important;
    }

    .match-list{gap:11px!important}
    .match-row{padding:14px!important;border-radius:15px;background:rgba(255,255,255,.022)}
    .fixture{border-radius:15px!important;background:rgba(2,7,4,.56)!important}

    [data-page="community"] .message{border-radius:8px 18px 18px 18px!important;background:linear-gradient(145deg,rgba(18,39,26,.92),rgba(7,17,11,.95))!important}
    [data-page="community"] .message.mine{border-radius:18px 8px 18px 18px!important;background:rgba(246,223,145,.10)!important}
    .chat-compose{border-radius:18px!important;background:rgba(7,17,11,.88)!important;backdrop-filter:blur(12px)}

    @media(min-width:920px){
      main{padding-bottom:96px!important}
      .bottom-nav{grid-template-columns:repeat(5,minmax(100px,1fr))!important}
      .nav-btn{grid-template-columns:auto 1fr;place-items:center start;justify-content:center;gap:8px;padding:0 13px!important;font-size:10px!important}
      .nav-btn i{font-size:18px!important}
    }

    @media(max-width:760px){
      .app-shell{padding-inline:8px}
      .topbar{top:5px!important;margin-top:5px!important;border-radius:18px!important}
      .arena-top-status{display:none!important}
      main{padding-top:18px!important}
      .hero{min-height:285px!important;border-radius:24px!important}
      .quick-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      .stat{min-height:82px;padding:13px 9px!important}.stat b{font-size:27px!important}
      .team-grid,.champion-grid,.arena-grid{grid-template-columns:1fr!important}
      .section-head{align-items:flex-start!important}
      .bottom-nav{bottom:7px!important;width:calc(100% - 14px)!important;min-height:67px!important;border-radius:20px!important}
    }

    @media(max-width:480px){
      body{padding-bottom:calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)!important}
      .brand-copy span{display:none!important}
      .brand-mark{width:44px!important;height:44px!important}
      .brand-copy strong{font-size:21px!important}
      .top-actions .icon-btn{width:39px!important}
      .hero{min-height:265px!important;padding:20px!important}
      .hero h1{font-size:clamp(39px,13vw,58px)!important}
      .hero-actions>*{flex:1 1 140px}
      .section-head{margin-top:25px!important;padding-left:11px}
      .section-head h2{font-size:26px!important}
      .quick-stats{grid-template-columns:1fr 1fr!important}
      .quick-stats .stat:last-child:nth-child(odd){grid-column:1/-1}
      .nav-btn{font-size:8px!important}.nav-btn i{font-size:19px!important}
      .modal-backdrop{place-items:end center!important;padding:8px!important}
      .modal{max-height:calc(100dvh - 16px)!important;padding:17px!important;border-radius:22px 22px 14px 14px!important}
    }

    @media(prefers-reduced-motion:reduce){
      *,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
    }
  `;
  document.head.append(style);

  refresh();

  const root = $('.app-shell') || document.body;
  const observer = new MutationObserver(mutations => {
    const added = mutations.flatMap(mutation => [...mutation.addedNodes]).filter(node => node.nodeType === 1);
    if (!added.length) return;
    requestAnimationFrame(() => added.forEach(node => refresh(node)));
  });
  observer.observe(root, { childList: true, subtree: true });

  window.ArenaBDADesignV3 = Object.freeze({ refresh });
})();
