(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const lowPower = reduceMotion.matches || (
    coarsePointer.matches && Number(navigator.hardwareConcurrency || 4) <= 4
  );

  const REVEAL_SELECTOR = [
    '.section-head',
    '.arena-hero',
    '.arena-card',
    '.arena-home-card',
    '.team-card',
    '.champion-card',
    '.profile-card',
    '.gi-phase',
    '.gi-metrics > div',
    '.gi-game',
    '.gi-bracket article',
    '.card:not(.gi-game)'
  ].join(',');

  const MOTION_ROOT_SELECTOR = '.app-shell,#app,main,[data-app]';
  const decorated = new WeakSet();
  let revealObserver = null;
  let mutationObserver = null;
  let refreshFrame = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function pulse(element, className = 'arena-motion-pulse') {
    if (!element || reduceMotion.matches) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), 680);
  }

  function revealImmediately(element) {
    element.classList.add('arena-motion-visible');
  }

  function decorateElement(element, order = 0) {
    if (!element || decorated.has(element)) return;
    decorated.add(element);
    element.classList.add('arena-motion-item');
    element.style.setProperty('--arena-motion-delay', `${Math.min(order, 7) * 45}ms`);

    if (lowPower || !revealObserver) revealImmediately(element);
    else revealObserver.observe(element);
  }

  function decorate(root = document) {
    const elements = [];
    if (root instanceof Element && root.matches(REVEAL_SELECTOR)) elements.push(root);
    elements.push(...$$(REVEAL_SELECTOR, root));
    elements.forEach((element, index) => decorateElement(element, index));
  }

  function scheduleRefresh(root = document) {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      decorate(root);
    });
  }

  function installRevealObserver() {
    if (lowPower || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('arena-motion-visible');
        revealObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -5% 0px'
    });
  }

  function addRipple(target, event) {
    if (lowPower || reduceMotion.matches || !target) return;
    if (target.matches(':disabled,[aria-disabled="true"]')) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.15;
    const ripple = document.createElement('span');
    ripple.className = 'arena-motion-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  function pageTransition(trigger) {
    if (reduceMotion.matches) return;
    const page = $('.page.active,[data-page].active,.screen.active,[data-screen].active');
    if (!page) return;
    page.classList.remove('arena-page-switching');
    void page.offsetWidth;
    page.classList.add('arena-page-switching');
    window.setTimeout(() => page.classList.remove('arena-page-switching'), 360);

    const nav = trigger?.closest('nav,.bottom-nav,.top-nav');
    if (nav) pulse(nav, 'arena-nav-pulse');
  }

  function scoreSaved(detail = {}) {
    const ids = Array.isArray(detail.gameIds)
      ? detail.gameIds
      : detail.gameId ? [detail.gameId] : [];

    ids.forEach(id => {
      const card = $(`#giManager .gi-game[data-card="${CSS.escape(String(id))}"]`);
      pulse(card, 'arena-card-confirmed');
      pulse($('.gip-scoreboard', card), 'arena-score-confirmed');
    });
  }

  function installEvents() {
    document.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const target = event.target.closest('button,.btn,[role="button"],a.arena-open');
      if (!target || target.closest('input,select,textarea')) return;
      target.classList.add('arena-motion-clickable');
      addRipple(target, event);
    }, { passive: true });

    document.addEventListener('click', event => {
      const trigger = event.target.closest(
        '[data-nav],[data-tab],[data-open-tournament],[data-home-tournament],[data-go],[data-route],[data-target-page],.bottom-nav button,.top-nav button'
      );
      if (trigger) pageTransition(trigger);
    }, true);

    window.addEventListener('arena:quick-score-saved', event => scoreSaved(event.detail));
    window.addEventListener('arena:matches-updated', event => {
      scheduleRefresh($('#arenaDetail') || document);
      if (event.detail?.gameId) scoreSaved(event.detail);
    });
    window.addEventListener('arena:permissions-updated', () => scheduleRefresh());
    window.addEventListener('arena:team-profile-updated', () => scheduleRefresh());
    window.addEventListener('arena:teams-prepared-for-cloud', () => scheduleRefresh());

    reduceMotion.addEventListener?.('change', () => {
      document.documentElement.classList.toggle('arena-reduce-motion', reduceMotion.matches);
      if (reduceMotion.matches) {
        revealObserver?.disconnect();
        $$('.arena-motion-item').forEach(revealImmediately);
      }
    });
  }

  function installMutationObserver() {
    if (!('MutationObserver' in window)) return;
    const root = $(MOTION_ROOT_SELECTOR) || document.body;
    mutationObserver = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node =>
        node.nodeType === 1 && (
          node.matches?.(REVEAL_SELECTOR)
          || node.querySelector?.(REVEAL_SELECTOR)
          || node.matches?.('.modal-backdrop,.ame2-backdrop,#giManager,[data-page]')
        )
      ));
      if (relevant) scheduleRefresh(root);
    });
    mutationObserver.observe(root, { childList: true, subtree: true });
  }

  function installStyles() {
    if ($('#arenaMotionStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaMotionStyles';
    style.textContent = `
      :root{--arena-motion-ease:cubic-bezier(.22,1,.36,1)}
      .arena-motion-item{will-change:transform,opacity}
      html:not(.arena-reduce-motion) .arena-motion-item:not(.arena-motion-visible){opacity:0;transform:translate3d(0,18px,0) scale(.985)}
      html:not(.arena-reduce-motion) .arena-motion-item.arena-motion-visible{opacity:1;transform:translate3d(0,0,0) scale(1);will-change:auto;transition:opacity .52s var(--arena-motion-ease) var(--arena-motion-delay,0ms),transform .52s var(--arena-motion-ease) var(--arena-motion-delay,0ms)}

      .arena-motion-clickable{position:relative;overflow:hidden;isolation:isolate;transform:translateZ(0)}
      .arena-motion-ripple{position:absolute;z-index:0;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.18);transform:scale(0);animation:arenaRipple .58s ease-out forwards}
      @keyframes arenaRipple{to{opacity:0;transform:scale(2.15)}}

      @media(hover:hover) and (pointer:fine){
        .arena-card,.arena-home-card,.team-card,.champion-card,#giManager .gip-card,.gi-bracket article{transition:transform .26s var(--arena-motion-ease),border-color .26s ease,box-shadow .26s ease}
        .arena-card:hover,.arena-home-card:hover,.team-card:hover,.champion-card:hover,#giManager .gip-card:hover,.gi-bracket article:hover{transform:translate3d(0,-4px,0);border-color:rgba(245,220,134,.28)!important;box-shadow:0 20px 48px rgba(0,0,0,.34)!important}
        button:not(:disabled):hover{transform:translateY(-1px)}
        button:not(:disabled):active{transform:translateY(0) scale(.98)}
      }

      .modal-backdrop.show,.ame2-backdrop.show{animation:arenaBackdropIn .2s ease-out both}
      .modal-backdrop.show>.modal,.ame2-backdrop.show>.ame2-dialog{animation:arenaDialogIn .34s var(--arena-motion-ease) both}
      @keyframes arenaBackdropIn{from{opacity:0}to{opacity:1}}
      @keyframes arenaDialogIn{from{opacity:0;transform:translate3d(0,20px,0) scale(.965)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}

      .arena-page-switching{animation:arenaPageSwitch .34s var(--arena-motion-ease) both}
      @keyframes arenaPageSwitch{0%{opacity:.72;transform:translate3d(0,8px,0)}100%{opacity:1;transform:translate3d(0,0,0)}}
      .arena-nav-pulse{animation:arenaNavPulse .38s ease-out}
      @keyframes arenaNavPulse{50%{filter:brightness(1.15)}}

      .arena-card-confirmed{animation:arenaCardConfirmed .62s var(--arena-motion-ease)}
      .arena-score-confirmed{animation:arenaScoreConfirmed .58s var(--arena-motion-ease)}
      @keyframes arenaCardConfirmed{35%{border-color:rgba(79,223,143,.58);box-shadow:0 0 0 3px rgba(79,223,143,.10),0 20px 48px rgba(0,0,0,.34)}100%{}}
      @keyframes arenaScoreConfirmed{40%{transform:scale(1.055);filter:brightness(1.2)}100%{transform:scale(1);filter:none}}

      .gip-status.is-live:before{content:"";width:6px;height:6px;margin-right:6px;border-radius:50%;background:currentColor;box-shadow:0 0 0 0 currentColor;animation:arenaLivePulse 1.7s ease-out infinite}
      @keyframes arenaLivePulse{0%{box-shadow:0 0 0 0 rgba(255,224,139,.42)}70%{box-shadow:0 0 0 7px rgba(255,224,139,0)}100%{box-shadow:0 0 0 0 rgba(255,224,139,0)}}

      .arena-hero:before{transition:transform .7s var(--arena-motion-ease)}
      @media(hover:hover) and (pointer:fine){.arena-hero:hover:before{transform:translate3d(8px,-5px,0) scale(1.03)}}

      @media(prefers-reduced-motion:reduce){
        *,*:before,*:after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
        .arena-motion-item{opacity:1!important;transform:none!important;will-change:auto!important}
      }
    `;
    document.head.append(style);
  }

  function init() {
    document.documentElement.classList.toggle('arena-reduce-motion', reduceMotion.matches);
    installStyles();
    installRevealObserver();
    installEvents();
    installMutationObserver();
    decorate();
    requestAnimationFrame(() => document.documentElement.classList.add('arena-motion-ready'));
  }

  window.ArenaBDAMotion = Object.freeze({
    refresh: scheduleRefresh,
    pulse: target => pulse(typeof target === 'string' ? $(target) : target),
    reduced: () => reduceMotion.matches,
    lowPower: () => lowPower
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
