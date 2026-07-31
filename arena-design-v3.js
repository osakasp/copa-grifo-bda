(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.documentElement.dataset.arenaDesign = 'v4';
  document.body.classList.add('arena-design-v3', 'arena-design-v4');

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

  function enhanceHome() {
    const home = $('[data-page="home"]');
    const hero = $('.hero', home);
    const content = $('.hero-content', hero);
    if (!home || !hero || !content) return;

    hero.classList.add('arena-hero-v4');
    $('.eyebrow', content).textContent = 'Arena BDA • Central oficial';
    $('h1', content).textContent = 'Todos os campeonatos. Uma só arena.';
    $('p', content).textContent = 'Organize competições, acompanhe resultados e fortaleça a história do Clã BDA em uma plataforma feita para o futebol mobile.';

    const primary = $('.hero-actions .primary', content);
    const secondary = $('.hero-actions .secondary', content);
    if (primary && !primary.querySelector('span')) {
      primary.innerHTML = '<span>Explorar campeonatos</span><i aria-hidden="true">→</i>';
    }
    if (secondary && !secondary.querySelector('span')) {
      secondary.innerHTML = '<span>Conhecer os clubes</span><i aria-hidden="true">↗</i>';
    }

    if (!$('.arena-hero-layout', hero)) {
      const layout = document.createElement('div');
      layout.className = 'arena-hero-layout';
      content.before(layout);
      layout.append(content);

      const consolePanel = document.createElement('aside');
      consolePanel.className = 'arena-hero-console';
      consolePanel.setAttribute('aria-label', 'Resumo da Arena BDA');
      consolePanel.innerHTML = `
        <header><span><i></i>Arena conectada</span><small>Atualização automática</small></header>
        <div class="arena-console-brand">
          <img src="${$('link[rel~="icon"]')?.href || './favicon.svg'}" alt="">
          <div><small>PAINEL CENTRAL</small><b>Visão geral da Arena</b></div>
        </div>
      `;

      const stats = $('.quick-stats', home);
      if (stats) {
        stats.classList.add('arena-console-stats');
        consolePanel.append(stats);
      }
      layout.append(consolePanel);
    }

    $('.home-grid', home)?.classList.add('arena-home-dashboard');
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
    enhanceHome();
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

    /* Arena BDA Design V4 */
    body.arena-design-v4{
      --arena-bg-0:#020604;
      --arena-bg-1:#06100a;
      --arena-panel:rgba(9,21,14,.92);
      --arena-border:rgba(231,244,235,.105);
      --arena-border-strong:rgba(242,215,125,.30);
      background:
        radial-gradient(ellipse at 72% -8%,rgba(242,215,125,.13),transparent 33%),
        radial-gradient(ellipse at 6% 42%,rgba(70,207,135,.055),transparent 28%),
        linear-gradient(180deg,#09150e 0,#030805 48%,#020503 100%)!important;
    }
    body.arena-design-v4:before{opacity:.12!important;background-size:64px 64px!important}
    body.arena-design-v4 .app-shell{width:min(100%,1380px)!important;max-width:1380px!important}
    body.arena-design-v4 main{padding-top:20px!important}

    .arena-design-v4 .topbar{
      min-height:68px!important;
      border-color:rgba(231,244,235,.09)!important;
      background:rgba(5,13,8,.86)!important;
      box-shadow:0 16px 42px rgba(0,0,0,.25)!important;
    }
    .arena-design-v4 .brand-mark{border-radius:14px!important}
    .arena-design-v4 .brand-copy strong{font-size:22px!important;letter-spacing:.045em!important}
    .arena-design-v4 .brand-copy span{letter-spacing:.11em!important}

    .arena-design-v4 .arena-hero-v4{
      min-height:0!important;
      padding:0!important;
      border-color:rgba(242,215,125,.25)!important;
      background:
        radial-gradient(circle at 76% 15%,rgba(242,215,125,.16),transparent 24%),
        linear-gradient(135deg,rgba(24,58,39,.96),rgba(5,14,9,.99) 66%)!important;
    }
    .arena-design-v4 .arena-hero-v4:before{
      content:"";
      position:absolute;
      inset:0;
      opacity:.25;
      background:
        linear-gradient(115deg,transparent 0 57%,rgba(242,215,125,.055) 57.2%,transparent 57.5%),
        linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
      background-size:auto,36px 36px,36px 36px;
      mask-image:linear-gradient(90deg,black,transparent 82%);
      transform:none;
      filter:none;
    }
    .arena-design-v4 .arena-hero-v4:after{
      inset:auto -80px -150px auto;
      width:420px;
      height:420px;
      border:1px solid rgba(242,215,125,.10);
      border-radius:50%;
      background:radial-gradient(circle,rgba(242,215,125,.06),transparent 66%);
    }
    .arena-hero-layout{
      position:relative;
      z-index:2;
      display:grid;
      grid-template-columns:minmax(0,1.25fr) minmax(310px,.75fr);
      align-items:stretch;
      gap:18px;
      width:100%;
      padding:clamp(20px,3vw,34px);
    }
    .arena-design-v4 .arena-hero-v4 .hero-content{
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:center;
      max-width:760px;
      min-height:330px;
      padding:10px clamp(0px,1vw,12px);
    }
    .arena-design-v4 .arena-hero-v4 .eyebrow{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:7px 10px;
      border:1px solid rgba(242,215,125,.21);
      border-radius:999px;
      background:rgba(242,215,125,.055);
      font-size:9px;
      letter-spacing:.14em;
    }
    .arena-design-v4 .arena-hero-v4 h1{
      max-width:760px;
      margin:17px 0 12px!important;
      font-size:clamp(48px,6.7vw,82px)!important;
      line-height:.86!important;
      letter-spacing:-.025em!important;
    }
    .arena-design-v4 .arena-hero-v4 p{
      max-width:620px!important;
      color:#c5d2c9!important;
      font-size:13px!important;
      line-height:1.7!important;
    }
    .arena-design-v4 .hero-actions{width:100%;margin-top:23px!important}
    .arena-design-v4 .hero-actions button{
      display:inline-flex;
      align-items:center;
      justify-content:space-between;
      gap:18px;
      min-height:48px!important;
      padding:0 18px!important;
      border-radius:13px!important;
    }
    .arena-design-v4 .hero-actions button i{font-size:17px;font-style:normal}

    .arena-hero-console{
      align-self:stretch;
      display:flex;
      flex-direction:column;
      min-width:0;
      padding:16px;
      border:1px solid rgba(231,244,235,.10);
      border-radius:22px;
      background:linear-gradient(160deg,rgba(10,25,16,.88),rgba(3,9,6,.92));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 20px 55px rgba(0,0,0,.22);
      backdrop-filter:blur(18px);
    }
    .arena-hero-console>header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:1px 2px 13px;
      border-bottom:1px solid var(--arena-border);
    }
    .arena-hero-console>header span{
      display:flex;
      align-items:center;
      gap:7px;
      color:#dfe9e2;
      font-size:8px;
      font-weight:900;
      letter-spacing:.11em;
      text-transform:uppercase;
    }
    .arena-hero-console>header span i{
      width:7px;
      height:7px;
      border-radius:50%;
      background:var(--arena-green);
      box-shadow:0 0 0 4px rgba(91,225,154,.09),0 0 14px rgba(91,225,154,.42);
    }
    .arena-hero-console>header small{color:var(--arena-muted);font-size:7px}
    .arena-console-brand{
      display:flex;
      align-items:center;
      gap:11px;
      padding:15px 2px 13px;
    }
    .arena-console-brand img{
      width:45px;
      height:45px;
      border:1px solid rgba(242,215,125,.36);
      border-radius:13px;
      object-fit:cover;
      background:#020503;
    }
    .arena-console-brand small,.arena-console-brand b{display:block}
    .arena-console-brand small{color:var(--arena-gold-soft);font-size:7px;font-weight:900;letter-spacing:.13em}
    .arena-console-brand b{margin-top:5px;font:800 20px/1 "Barlow Condensed",sans-serif;text-transform:uppercase}
    .arena-console-stats{
      flex:1;
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:7px!important;
      margin:0!important;
    }
    .arena-console-stats .stat{
      min-height:76px!important;
      padding:12px!important;
      border-color:rgba(231,244,235,.085)!important;
      border-radius:14px!important;
      background:rgba(255,255,255,.026)!important;
      box-shadow:none!important;
    }
    .arena-console-stats .stat b{font-size:26px!important}
    .arena-console-stats .stat span{margin-top:6px!important;font-size:7px!important;letter-spacing:.11em!important}

    .arena-design-v4 .section-head{
      min-height:50px;
      margin:34px 2px 14px!important;
      padding-left:0;
      border-left:0;
    }
    .arena-design-v4 .section-head h2{
      font-size:clamp(26px,3vw,34px)!important;
      letter-spacing:.005em!important;
      text-transform:uppercase;
    }
    .arena-design-v4 .section-head p{color:#92a59a!important;font-size:10px!important}
    .arena-design-v4 .section-head>button{
      padding:0 14px!important;
      border-color:rgba(242,215,125,.18)!important;
      color:var(--arena-gold-soft)!important;
    }

    .arena-design-v4 .arena-home-dashboard{gap:16px!important}
    .arena-design-v4 .arena-home-dashboard>div{
      min-width:0;
      padding:0;
      border-radius:22px;
    }
    .arena-design-v4 .live-card,.arena-design-v4 .match-list{
      overflow:hidden;
      border-color:rgba(231,244,235,.09)!important;
      background:rgba(7,17,11,.86)!important;
      box-shadow:0 18px 45px rgba(0,0,0,.22)!important;
    }
    .arena-design-v4 .live-top{padding:14px 16px!important;background:rgba(255,255,255,.018)}
    .arena-design-v4 .versus{min-height:190px;padding:24px 18px!important}
    .arena-design-v4 .club-badge{width:64px!important;height:64px!important;border-radius:18px!important}
    .arena-design-v4 .scorebox b{color:var(--arena-gold-soft);font-size:30px!important}
    .arena-design-v4 .match-row{
      min-height:72px;
      padding:13px 15px!important;
      border-radius:0!important;
      background:transparent!important;
    }
    .arena-design-v4 .match-row+.match-row{border-top:1px solid rgba(231,244,235,.07)}
    .arena-design-v4 .match-stage{
      display:inline-flex;
      width:max-content;
      padding:5px 7px;
      border:1px solid rgba(242,215,125,.16);
      border-radius:7px;
      background:rgba(242,215,125,.04);
    }
    .arena-design-v4 .match-status{
      padding:5px 7px;
      border-radius:999px;
      background:rgba(91,225,154,.07);
      color:#8fd9af;
      font-size:8px;
    }

    .arena-design-v4 .arena-surface-v3,.arena-design-v4 .card,.arena-design-v4 .form-card,.arena-design-v4 .admin-panel{
      border-color:rgba(231,244,235,.09)!important;
      background:linear-gradient(155deg,rgba(12,28,18,.90),rgba(5,13,8,.94))!important;
      box-shadow:0 16px 42px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.02)!important;
    }
    .arena-design-v4 .team-grid,.arena-design-v4 .champion-grid,.arena-design-v4 .arena-grid{gap:12px!important}
    .arena-design-v4 .team-card,.arena-design-v4 .champion-card,.arena-design-v4 .arena-card{border-radius:18px!important}
    .arena-design-v4 .primary{box-shadow:0 10px 28px rgba(214,170,57,.16)!important}
    .arena-design-v4 button:active{transform:scale(.98)}

    @media(min-width:981px){
      body.arena-design-v4.arena-navigation-ready{padding-left:244px!important}
      .arena-design-v4 .bottom-nav.arena-side-nav{
        left:12px!important;
        top:12px!important;
        bottom:12px!important;
        width:216px!important;
        padding:12px!important;
        border-color:rgba(231,244,235,.10)!important;
        border-radius:22px!important;
        background:linear-gradient(180deg,rgba(8,20,13,.98),rgba(3,9,6,.99))!important;
        box-shadow:0 24px 65px rgba(0,0,0,.40),inset 0 1px 0 rgba(255,255,255,.025)!important;
      }
      .arena-design-v4 .arena-side-brand{border-bottom-color:rgba(231,244,235,.08)!important}
      .arena-design-v4 .arena-side-logo{border-radius:13px!important;box-shadow:none!important}
      .arena-design-v4 .arena-side-nav .nav-btn{
        min-height:52px!important;
        border-radius:13px!important;
      }
      .arena-design-v4 .arena-side-nav .nav-btn.active{
        color:var(--arena-gold-soft)!important;
        border-color:rgba(242,215,125,.18)!important;
        background:rgba(242,215,125,.075)!important;
        box-shadow:inset 3px 0 0 var(--arena-gold-soft)!important;
      }
      .arena-design-v4 .arena-side-nav .nav-btn.active i{
        color:#171107!important;
        border-color:rgba(242,215,125,.34)!important;
        background:linear-gradient(135deg,var(--arena-gold-soft),var(--arena-gold))!important;
      }
      .arena-design-v4 .arena-side-nav .nav-btn.active .arena-nav-copy small{color:#acbdb2!important}
      .arena-design-v4 .arena-side-nav .nav-btn.active:after{display:none!important}
      .arena-design-v4 .arena-side-footer{border-color:rgba(231,244,235,.08)!important;background:rgba(255,255,255,.02)!important}
    }
    @media(max-width:980px){
      .arena-design-v4 .arena-mobile-nav{
        left:8px;
        right:8px;
        bottom:7px;
        min-height:66px;
        border-color:rgba(231,244,235,.11);
        border-radius:20px;
        background:rgba(5,14,9,.96);
        box-shadow:0 18px 48px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.025);
      }
      .arena-design-v4 .arena-mobile-item{border-radius:13px}
      .arena-design-v4 .arena-mobile-item.active{
        box-shadow:0 8px 20px rgba(214,170,57,.14);
      }
    }

    @media(min-width:980px){
      .arena-design-v4 .arena-home-dashboard{
        grid-template-columns:minmax(0,1.35fr) minmax(330px,.65fr)!important;
        gap:18px!important;
      }
    }
    @media(max-width:900px){
      .arena-hero-layout{grid-template-columns:1fr}
      .arena-design-v4 .arena-hero-v4 .hero-content{min-height:270px}
      .arena-console-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    }
    @media(max-width:560px){
      .arena-design-v4 main{padding-inline:6px!important}
      .arena-hero-layout{gap:10px;padding:13px}
      .arena-design-v4 .arena-hero-v4{border-radius:22px!important}
      .arena-design-v4 .arena-hero-v4 .hero-content{min-height:290px;padding:13px 8px}
      .arena-design-v4 .arena-hero-v4 h1{font-size:clamp(43px,13.3vw,62px)!important}
      .arena-design-v4 .arena-hero-v4 p{font-size:12px!important;line-height:1.6!important}
      .arena-design-v4 .hero-actions button{flex:1 1 100%;width:100%}
      .arena-hero-console{padding:12px;border-radius:17px}
      .arena-console-brand{padding-block:12px 10px}
      .arena-console-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .arena-console-stats .stat{min-height:67px!important}
      .arena-design-v4 .section-head{margin-top:27px!important}
      .arena-design-v4 .section-head h2{font-size:27px!important}
      .arena-design-v4 .match-row{grid-template-columns:58px 1fr!important;gap:8px!important}
      .arena-design-v4 .match-status{display:none}
      .arena-design-v4 .versus{min-height:170px;padding-inline:10px!important}
      .arena-design-v4 .club-badge{width:54px!important;height:54px!important}
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
