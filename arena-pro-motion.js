(() => {
  'use strict';

  if (document.getElementById('arenaProMotionStyles')) return;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches === true;

  document.documentElement.classList.add('arena-pro');
  document.documentElement.dataset.arenaMotion = reducedMotion ? 'reduced' : 'pro';

  const style = document.createElement('style');
  style.id = 'arenaProMotionStyles';
  style.textContent = `
    :root{
      --bg:#030705;
      --bg-soft:#07100c;
      --surface:rgba(11,23,16,.94);
      --surface-2:rgba(18,35,25,.90);
      --line:rgba(211,239,220,.11);
      --line-strong:rgba(242,215,125,.32);
      --shadow:0 22px 60px rgba(0,0,0,.42);
      --pro-glow:0 0 0 1px rgba(242,215,125,.05),0 22px 58px rgba(0,0,0,.38);
      --pro-green-glow:0 14px 34px rgba(79,223,143,.12);
    }

    html.arena-pro{background:#030705}
    html.arena-pro body{
      background:
        radial-gradient(circle at 52% -12%,rgba(242,215,125,.14),transparent 31%),
        radial-gradient(circle at 9% 24%,rgba(79,223,143,.08),transparent 22%),
        radial-gradient(circle at 96% 64%,rgba(109,182,255,.045),transparent 26%),
        linear-gradient(180deg,#06100b 0%,#030705 58%,#020504 100%);
      background-attachment:fixed;
    }

    html.arena-pro body::before{
      content:"";
      position:fixed;
      inset:0;
      z-index:-1;
      pointer-events:none;
      opacity:.32;
      background-image:linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px);
      background-size:42px 42px;
      mask-image:linear-gradient(to bottom,black,transparent 78%);
    }

    .topbar{
      border-bottom-color:rgba(242,215,125,.13)!important;
      background:linear-gradient(180deg,rgba(5,12,8,.94),rgba(5,10,8,.82))!important;
      box-shadow:0 10px 34px rgba(0,0,0,.28);
      backdrop-filter:blur(22px) saturate(1.25)!important;
    }

    .brand-mark{
      position:relative;
      box-shadow:0 10px 30px rgba(216,178,72,.22),inset 0 1px 0 rgba(255,255,255,.38)!important;
      transition:transform .35s cubic-bezier(.2,.75,.25,1),box-shadow .35s ease!important;
    }
    .brand-mark::after{
      content:"";
      position:absolute;
      inset:-5px;
      z-index:-1;
      border-radius:19px;
      background:radial-gradient(circle,rgba(242,215,125,.24),transparent 68%);
      filter:blur(7px);
      opacity:.72;
    }

    .hero,.arena-hero{
      isolation:isolate;
      border-color:rgba(242,215,125,.28)!important;
      box-shadow:0 28px 76px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.05)!important;
      transform:translateZ(0);
    }
    .hero::after,.arena-hero::after{
      background:
        linear-gradient(180deg,rgba(3,7,5,.02),rgba(3,7,5,.82) 82%),
        repeating-linear-gradient(115deg,transparent 0 46px,rgba(255,255,255,.018) 46px 47px)!important;
    }
    .hero-content,.arena-hero-copy{filter:drop-shadow(0 10px 26px rgba(0,0,0,.22))}
    .eyebrow{color:#f5dd8f!important;text-shadow:0 0 24px rgba(242,215,125,.18)}

    .card,.stat,.arena-card,.champion-card,.team-card,.live-card,.fixture,.form-card,.arena-stat{
      --spot-x:50%;
      --spot-y:0%;
      position:relative;
      border-color:rgba(211,239,220,.105)!important;
      box-shadow:var(--pro-glow)!important;
      transition:transform .26s cubic-bezier(.2,.72,.2,1),border-color .26s ease,box-shadow .26s ease,background-color .26s ease!important;
      transform:translateZ(0);
    }
    .card::before,.stat::before,.arena-card::before,.champion-card::before,.team-card::before,.live-card::before,.fixture::before,.form-card::before,.arena-stat::before{
      content:"";
      position:absolute;
      inset:0;
      z-index:0;
      pointer-events:none;
      border-radius:inherit;
      opacity:0;
      background:radial-gradient(340px circle at var(--spot-x) var(--spot-y),rgba(242,215,125,.10),transparent 50%);
      transition:opacity .22s ease;
    }
    .card>*:not(style),.stat>*:not(style),.arena-card>*:not(style),.champion-card>*:not(style),.team-card>*:not(style),.live-card>*:not(style),.fixture>*:not(style),.form-card>*:not(style),.arena-stat>*:not(style){position:relative;z-index:1}

    .quick-stats{gap:11px!important}
    .stat b,.arena-stat b{filter:drop-shadow(0 6px 14px rgba(242,215,125,.12))}
    .section-head h2{letter-spacing:.045em!important;text-shadow:0 8px 26px rgba(0,0,0,.22)}

    button,.primary,.secondary,.ghost,.danger,.nav-btn,.icon-btn,.admin-btn{
      transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .22s ease,border-color .22s ease,background-color .22s ease,color .22s ease,filter .22s ease!important;
      -webkit-tap-highlight-color:transparent;
    }
    button:active,.primary:active,.secondary:active,.ghost:active,.danger:active,.nav-btn:active,.icon-btn:active,.admin-btn:active{transform:scale(.965)!important}
    .primary{
      position:relative;
      overflow:hidden;
      box-shadow:0 10px 26px rgba(216,178,72,.18),inset 0 1px 0 rgba(255,255,255,.28)!important;
    }
    .primary::after{
      content:"";
      position:absolute;
      top:-60%;
      bottom:-60%;
      left:-42%;
      width:28%;
      pointer-events:none;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.36),transparent);
      transform:skewX(-18deg);
      opacity:0;
    }

    input,select,textarea{
      transition:border-color .2s ease,box-shadow .2s ease,background-color .2s ease!important;
      background:rgba(2,8,5,.72)!important;
    }
    input:focus,select:focus,textarea:focus{
      border-color:rgba(242,215,125,.48)!important;
      box-shadow:0 0 0 3px rgba(242,215,125,.08)!important;
      background:rgba(5,13,9,.90)!important;
    }

    .bottom-nav,.arena-mobile-nav{
      border-color:rgba(242,215,125,.16)!important;
      background:linear-gradient(180deg,rgba(10,22,15,.93),rgba(6,13,9,.96))!important;
      box-shadow:0 18px 54px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.035)!important;
      backdrop-filter:blur(24px) saturate(1.35)!important;
    }
    .nav-btn{position:relative;overflow:hidden}
    .nav-btn.active{
      box-shadow:0 8px 24px rgba(216,178,72,.19),inset 0 1px 0 rgba(255,255,255,.30)!important;
    }
    .nav-btn.active i{filter:drop-shadow(0 4px 8px rgba(0,0,0,.18))}

    .modal-backdrop.show{animation:proBackdropIn .2s ease both}
    .modal-backdrop.show .modal{animation:proModalIn .28s cubic-bezier(.2,.78,.25,1) both}
    .modal{
      border-color:rgba(242,215,125,.26)!important;
      box-shadow:0 28px 90px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.04)!important;
    }

    .live-dot{box-shadow:0 0 0 5px rgba(255,105,120,.10),0 0 18px rgba(255,105,120,.28)!important}
    .club-badge,.team-mini-badge{box-shadow:0 12px 28px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.36)!important}
    .arena-cover img,.arena-banner-preview img{transition:transform .5s cubic-bezier(.2,.72,.2,1),filter .35s ease!important}

    .page.active{animation:proPageIn .30s cubic-bezier(.2,.72,.2,1)!important}
    .pro-reveal{
      opacity:0;
      transform:translateY(14px) scale(.992);
      filter:blur(2px);
      transition:opacity .44s ease calc(var(--pro-delay,0) * 42ms),transform .48s cubic-bezier(.2,.72,.2,1) calc(var(--pro-delay,0) * 42ms),filter .38s ease calc(var(--pro-delay,0) * 42ms)!important;
    }
    .pro-reveal.pro-visible{opacity:1;transform:none;filter:none}

    .toast,.cloud-status{backdrop-filter:blur(18px) saturate(1.25)}

    @media(hover:hover) and (pointer:fine){
      .card:hover,.stat:hover,.arena-card:hover,.champion-card:hover,.team-card:hover,.live-card:hover,.fixture:hover,.form-card:hover,.arena-stat:hover{
        transform:translateY(-4px);
        border-color:rgba(242,215,125,.24)!important;
        box-shadow:0 24px 64px rgba(0,0,0,.46),0 0 0 1px rgba(242,215,125,.045)!important;
      }
      .card:hover::before,.stat:hover::before,.arena-card:hover::before,.champion-card:hover::before,.team-card:hover::before,.live-card:hover::before,.fixture:hover::before,.form-card:hover::before,.arena-stat:hover::before{opacity:1}
      .arena-card:hover .arena-cover img,.champion-card:hover img,.team-card:hover img{transform:scale(1.025);filter:saturate(1.05) contrast(1.02)}
      .primary:hover{transform:translateY(-1px);filter:brightness(1.04);box-shadow:0 14px 34px rgba(216,178,72,.24),inset 0 1px 0 rgba(255,255,255,.32)!important}
      .primary:hover::after{opacity:1;animation:proShine .72s ease forwards}
      .ghost:hover,.secondary:hover,.icon-btn:hover,.admin-btn:hover{border-color:rgba(242,215,125,.32)!important;background-color:rgba(242,215,125,.06)!important}
      .brand:hover .brand-mark{transform:rotate(0deg) translateY(-2px) scale(1.025)!important;box-shadow:0 15px 36px rgba(216,178,72,.28)!important}
    }

    @keyframes proPageIn{from{opacity:0;transform:translateY(8px) scale(.996);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
    @keyframes proBackdropIn{from{opacity:0}to{opacity:1}}
    @keyframes proModalIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
    @keyframes proShine{from{left:-42%}to{left:118%}}
    @keyframes proNavPop{0%{transform:scale(.88)}65%{transform:scale(1.10)}100%{transform:scale(1)}}

    @media(max-width:560px){
      .hero,.arena-hero{box-shadow:0 20px 52px rgba(0,0,0,.44)!important}
      .card,.stat,.arena-card,.champion-card,.team-card,.live-card,.fixture,.form-card,.arena-stat{box-shadow:0 12px 34px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.018)!important}
      .bottom-nav,.arena-mobile-nav{box-shadow:0 15px 42px rgba(0,0,0,.58)!important}
    }

    @media(prefers-reduced-motion:reduce){
      .pro-reveal,.pro-reveal.pro-visible,.page.active,.modal-backdrop.show,.modal-backdrop.show .modal{opacity:1!important;transform:none!important;filter:none!important;animation:none!important;transition:none!important}
      .primary::after{display:none!important}
      html{scroll-behavior:auto!important}
    }
  `;
  document.head.append(style);

  const revealSelector = [
    '.section-head',
    '.stat',
    '.card',
    '.arena-card',
    '.arena-stat',
    '.arena-hero',
    '.champion-card',
    '.team-card',
    '.live-card',
    '.fixture',
    '.match-row',
    '.form-card'
  ].join(',');

  let observer = null;
  if (!reducedMotion && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('pro-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -28px 0px' });
  }

  function registerReveal(root = document) {
    const nodes = [];
    if (root instanceof Element && root.matches(revealSelector)) nodes.push(root);
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll(revealSelector));

    nodes.forEach((node, index) => {
      if (node.dataset.proReveal === 'true') return;
      node.dataset.proReveal = 'true';
      node.style.setProperty('--pro-delay', String(Math.min(index % 6, 5)));
      if (reducedMotion || !observer) {
        node.classList.add('pro-visible');
        return;
      }
      node.classList.add('pro-reveal');
      observer.observe(node);
    });
  }

  function popActiveNavigation(target) {
    const button = target?.closest?.('.nav-btn,[data-mobile-go]');
    if (!button) return;
    const icon = button.querySelector('i,svg');
    if (!icon || reducedMotion) return;
    icon.style.animation = 'none';
    void icon.offsetWidth;
    icon.style.animation = 'proNavPop .34s cubic-bezier(.2,.8,.2,1)';
  }

  registerReveal(document);

  const mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) registerReveal(node);
      });
    });
  });
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', event => popActiveNavigation(event.target), { passive: true });

  if (finePointer && !reducedMotion) {
    const spotlightSelector = '.card,.stat,.arena-card,.champion-card,.team-card,.live-card,.fixture,.form-card,.arena-stat';
    let active = null;
    let frame = 0;
    let lastEvent = null;

    document.addEventListener('pointermove', event => {
      const target = event.target instanceof Element ? event.target.closest(spotlightSelector) : null;
      if (!target) {
        active = null;
        return;
      }
      active = target;
      lastEvent = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!active || !lastEvent) return;
        const rect = active.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(0, Math.min(100, ((lastEvent.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((lastEvent.clientY - rect.top) / rect.height) * 100));
        active.style.setProperty('--spot-x', `${x.toFixed(1)}%`);
        active.style.setProperty('--spot-y', `${y.toFixed(1)}%`);
      });
    }, { passive: true });
  }

  window.addEventListener('arena:bundle-loaded', () => registerReveal(document));
  window.addEventListener('arena:matches-updated', () => registerReveal(document));
  window.addEventListener('arena:auth-changed', () => registerReveal(document));

  window.ArenaBDAProMotion = Object.freeze({
    version: 1,
    reducedMotion,
    refresh: () => registerReveal(document)
  });

  window.dispatchEvent(new CustomEvent('arena:pro-motion-ready', {
    detail: { reducedMotion, finePointer }
  }));
})();
