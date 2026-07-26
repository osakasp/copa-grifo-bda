(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const lowPower = reduceMotion.matches || (coarsePointer.matches && Number(navigator.hardwareConcurrency || 4) <= 4);
  const q = (selector, root = document) => root?.querySelector?.(selector) || null;
  const qa = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
  const escapeCss = value => window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const decorated = new WeakSet();
  const REVEAL_SELECTOR = '.section-head,.arena-hero,.arena-card,.arena-home-card,.team-card,.champion-card,.profile-card,.gi-phase,.gi-metrics>div,.gi-game,.gi-bracket article,.news-card,.news-lead,.card:not(.gi-game)';

  let revealObserver = null;
  let mutationObserver = null;
  let frame = 0;

  function pulse(element, className = 'arena-motion-pulse') {
    if (!element || reduceMotion.matches) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element?.classList?.remove(className), 680);
  }

  function reveal(element) {
    if (!element) return;
    element.classList.add('arena-motion-visible');
    element.style.removeProperty('will-change');
  }

  function decorateElement(element, order = 0) {
    if (!element || decorated.has(element)) return;
    decorated.add(element);
    element.classList.add('arena-motion-item');
    element.style.setProperty('--arena-motion-delay', `${Math.min(order, 7) * 42}ms`);
    if (lowPower || !revealObserver) reveal(element);
    else revealObserver.observe(element);
  }

  function decorate(root = document) {
    const list = [];
    if (root instanceof Element && root.matches(REVEAL_SELECTOR)) list.push(root);
    list.push(...qa(REVEAL_SELECTOR, root));
    list.forEach((element, index) => decorateElement(element, index));
  }

  function schedule(root = document) {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      decorate(root);
    });
  }

  function installRevealObserver() {
    if (lowPower || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -4% 0px' });
  }

  function addRipple(target, event) {
    if (lowPower || reduceMotion.matches || !target || target.matches(':disabled,[aria-disabled="true"]')) return;
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
    const page = q('.page.active,[data-page].active,.screen.active,[data-screen].active');
    if (!page) return;
    page.classList.remove('arena-page-switching');
    void page.offsetWidth;
    page.classList.add('arena-page-switching');
    setTimeout(() => page?.classList?.remove('arena-page-switching'), 360);
    pulse(trigger?.closest?.('nav,.bottom-nav,.top-nav'), 'arena-nav-pulse');
  }

  function scoreSaved(detail = {}) {
    const ids = Array.isArray(detail.gameIds) ? detail.gameIds : detail.gameId ? [detail.gameId] : [];
    ids.forEach(id => {
      const card = q(`#giManager .gi-game[data-card="${escapeCss(id)}"]`);
      if (!card) return;
      pulse(card, 'arena-card-confirmed');
      pulse(q('.gip-scoreboard', card), 'arena-score-confirmed');
    });
  }

  function installEvents() {
    document.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      const target = event.target.closest('button,.btn,[role="button"],a.arena-open');
      if (!target || target.closest('input,select,textarea')) return;
      target.classList.add('arena-motion-clickable');
      addRipple(target, event);
    }, { passive: true });

    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest('[data-nav],[data-tab],[data-open-tournament],[data-home-tournament],[data-go],[data-mobile-go],[data-sheet-go],[data-route],[data-target-page],.bottom-nav button,.top-nav button');
      if (trigger) pageTransition(trigger);
    }, true);

    window.addEventListener('arena:quick-score-saved', event => scoreSaved(event.detail));
    window.addEventListener('arena:matches-updated', event => {
      schedule(q('#arenaDetail') || document);
      if (event.detail?.gameId) scoreSaved(event.detail);
    });
    ['arena:permissions-updated','arena:team-profile-updated','arena:teams-prepared-for-cloud'].forEach(name => window.addEventListener(name, () => schedule()));

    reduceMotion.addEventListener?.('change', () => {
      document.documentElement.classList.toggle('arena-reduce-motion', reduceMotion.matches);
      if (reduceMotion.matches) {
        revealObserver?.disconnect();
        qa('.arena-motion-item').forEach(reveal);
      }
    });
  }

  function installMutationObserver() {
    if (!('MutationObserver' in window)) return;
    const root = q('.app-shell,#app,main,[data-app]') || document.body;
    mutationObserver = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node => node.nodeType === 1 && (node.matches?.(REVEAL_SELECTOR) || node.querySelector?.(REVEAL_SELECTOR) || node.matches?.('.modal-backdrop,.ame2-backdrop,#giManager,[data-page]'))));
      if (relevant) schedule(root);
    });
    mutationObserver.observe(root, { childList: true, subtree: true });
  }

  function installStyles() {
    q('#arenaMotionStyles')?.remove();
    const style = document.createElement('style');
    style.id = 'arenaMotionStyles';
    style.textContent = `
      :root{--arena-motion-ease:cubic-bezier(.22,1,.36,1)}
      .arena-motion-item{will-change:transform,opacity}
      html:not(.arena-reduce-motion) .arena-motion-item:not(.arena-motion-visible){opacity:0;transform:translate3d(0,16px,0) scale(.988)}
      html:not(.arena-reduce-motion) .arena-motion-item.arena-motion-visible{opacity:1;transform:none;transition:opacity .48s var(--arena-motion-ease) var(--arena-motion-delay,0ms),transform .48s var(--arena-motion-ease) var(--arena-motion-delay,0ms)}
      .arena-motion-clickable{position:relative;overflow:hidden;isolation:isolate;transform:translateZ(0)}
      .arena-motion-ripple{position:absolute;z-index:0;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.18);transform:scale(0);animation:arenaRipple .56s ease-out forwards}
      @keyframes arenaRipple{to{opacity:0;transform:scale(2.15)}}
      @media(hover:hover) and (pointer:fine){.arena-card,.arena-home-card,.team-card,.champion-card,.news-card,#giManager .gip-card,.gi-bracket article{transition:transform .25s var(--arena-motion-ease),border-color .25s ease,box-shadow .25s ease}.arena-card:hover,.arena-home-card:hover,.team-card:hover,.champion-card:hover,.news-card:hover,#giManager .gip-card:hover,.gi-bracket article:hover{transform:translate3d(0,-4px,0);border-color:rgba(245,220,134,.28)!important;box-shadow:0 20px 48px rgba(0,0,0,.34)!important}button:not(:disabled):hover{transform:translateY(-1px)}button:not(:disabled):active{transform:scale(.98)}}
      .modal-backdrop.show,.ame2-backdrop.show{animation:arenaBackdropIn .2s ease-out both}.modal-backdrop.show>.modal,.ame2-backdrop.show>.ame2-dialog{animation:arenaDialogIn .32s var(--arena-motion-ease) both}
      @keyframes arenaBackdropIn{from{opacity:0}to{opacity:1}}@keyframes arenaDialogIn{from{opacity:0;transform:translate3d(0,18px,0) scale(.97)}to{opacity:1;transform:none}}
      .arena-page-switching{animation:arenaPageSwitch .32s var(--arena-motion-ease) both}@keyframes arenaPageSwitch{from{opacity:.76;transform:translate3d(0,7px,0)}to{opacity:1;transform:none}}
      .arena-nav-pulse{animation:arenaNavPulse .36s ease-out}@keyframes arenaNavPulse{50%{filter:brightness(1.14)}}
      .arena-card-confirmed{animation:arenaCardConfirmed .6s var(--arena-motion-ease)}.arena-score-confirmed{animation:arenaScoreConfirmed .56s var(--arena-motion-ease)}
      @keyframes arenaCardConfirmed{35%{border-color:rgba(79,223,143,.58);box-shadow:0 0 0 3px rgba(79,223,143,.1),0 20px 48px rgba(0,0,0,.34)}}@keyframes arenaScoreConfirmed{40%{transform:scale(1.05);filter:brightness(1.18)}100%{transform:scale(1);filter:none}}
      .gip-status.is-live:before{content:"";width:6px;height:6px;margin-right:6px;border-radius:50%;background:currentColor;animation:arenaLivePulse 1.7s ease-out infinite}@keyframes arenaLivePulse{0%{box-shadow:0 0 0 0 rgba(255,224,139,.42)}70%{box-shadow:0 0 0 7px rgba(255,224,139,0)}100%{box-shadow:0 0 0 0 rgba(255,224,139,0)}}
      @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}.arena-motion-item{opacity:1!important;transform:none!important;will-change:auto!important}}
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
  }

  window.ArenaBDAMotion = Object.freeze({ refresh: schedule, pulse: target => pulse(typeof target === 'string' ? q(target) : target), reduced: () => reduceMotion.matches, lowPower: () => lowPower });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();