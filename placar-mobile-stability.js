(() => {
  'use strict';

  const SELECTOR = '#giManager .gi-score-input';
  let activeInput = null;
  let activeCard = null;
  let cleanupTimer = 0;

  function scoreInputFrom(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest(SELECTOR);
  }

  function begin(input) {
    activeInput = input;
    activeCard = input.closest('.gi-game');
    document.documentElement.classList.add('arena-score-editing');
    activeCard?.classList.add('is-score-editing');

    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('enterkeyhint', 'done');
    input.setAttribute('autocomplete', 'off');

    clearTimeout(cleanupTimer);
    requestAnimationFrame(() => {
      if (!input.isConnected || document.activeElement !== input) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const bottom = top + (viewport?.height || window.innerHeight);
      const rect = input.getBoundingClientRect();
      const safeTop = top + 92;
      const safeBottom = bottom - 82;
      if (rect.top < safeTop || rect.bottom > safeBottom) {
        input.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    });
  }

  function finish(input) {
    clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      const current = document.activeElement;
      if (current instanceof Element && current.matches(SELECTOR)) {
        begin(current);
        return;
      }
      input?.closest('.gi-game')?.classList.remove('is-score-editing');
      activeCard?.classList.remove('is-score-editing');
      activeInput = null;
      activeCard = null;
      document.documentElement.classList.remove('arena-score-editing');
    }, 180);
  }

  function stopLegacyInput(event) {
    const input = scoreInputFrom(event);
    if (!input) return;

    // resultados-cards-pro já processou o valor no listener de captura
    // registrado antes deste módulo. Impedimos apenas o listener legado,
    // que redesenhava toda a central e removia o campo focado.
    event.stopImmediatePropagation();

    if (input.value !== '') {
      const number = Math.max(0, Math.min(99, Number(input.value) || 0));
      const normalized = String(number);
      if (input.value !== normalized) input.value = normalized;
    }

    if (activeInput !== input) begin(input);
  }

  document.addEventListener('focusin', event => {
    const input = scoreInputFrom(event);
    if (input) begin(input);
  }, true);

  document.addEventListener('input', stopLegacyInput, true);

  document.addEventListener('focusout', event => {
    const input = scoreInputFrom(event);
    if (input) finish(input);
  }, true);

  document.addEventListener('keydown', event => {
    const input = scoreInputFrom(event);
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    input.blur();
  }, true);

  const style = document.createElement('style');
  style.id = 'placarMobileStabilityStyles';
  style.textContent = `
    #giManager .gi-score-input{touch-action:manipulation;scroll-margin-block:34vh;caret-color:var(--gold-soft,#f5dc86)}
    #giManager .gip-card.is-score-editing{z-index:3;border-color:rgba(245,220,134,.48)!important;box-shadow:0 0 0 3px rgba(245,220,134,.08),0 18px 46px rgba(0,0,0,.34)!important}
    html.arena-score-editing{scroll-behavior:auto!important}
    @media(max-width:720px){
      html.arena-score-editing .arena-mobile-nav{opacity:.58;transform:translateY(4px);pointer-events:none;transition:opacity .16s ease,transform .16s ease}
      #giManager .gip-scoreboard .gi-score-input{font-size:26px!important}
    }
    @media(prefers-reduced-motion:reduce){html.arena-score-editing .arena-mobile-nav{transition:none}}
  `;
  document.head.append(style);

  window.ArenaBDAScoreStability = Object.freeze({
    active: () => Boolean(activeInput?.isConnected),
    input: () => activeInput,
    card: () => activeCard
  });
})();
