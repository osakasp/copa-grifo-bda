(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let scheduled = false;
  let backdrop = null;
  let activeCard = null;
  let returnFocus = null;
  let scrollBeforeOpen = 0;

  function teamNames(card) {
    return $$('.gi-team strong', card)
      .slice(0, 2)
      .map(element => element.textContent.trim())
      .filter(Boolean);
  }

  function ensureBackdrop() {
    if (backdrop?.isConnected) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'gi-editor-modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', closeEditor);
    document.body.append(backdrop);
    return backdrop;
  }

  function closeEditor() {
    const card = $('.gi-game.editing');
    const closeButton = $('[data-edit]', card);
    if (closeButton) {
      closeButton.click();
      return;
    }
    cleanup();
  }

  function cleanup() {
    document.body.classList.remove('gi-editor-modal-open');
    backdrop?.classList.remove('show');
    activeCard = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  function decorate(card) {
    if (!card || card.dataset.modalEditorReady === 'true') return;
    card.dataset.modalEditorReady = 'true';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'giEditorModalTitle');

    const names = teamNames(card);
    const heading = document.createElement('div');
    heading.className = 'gi-editor-modal-head';
    heading.innerHTML = `
      <div>
        <span>Administração do confronto</span>
        <h2 id="giEditorModalTitle">Editar jogo</h2>
        <p>${names.length === 2 ? `${names[0]} × ${names[1]}` : 'Ajuste times, fase, data, placar e regras.'}</p>
      </div>
      <button type="button" data-gi-editor-modal-close aria-label="Fechar editor">×</button>`;
    card.prepend(heading);

    const actions = $('.gi-actions', card);
    if (actions && !$('[data-gi-editor-cancel]', actions)) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'secondary';
      cancel.dataset.giEditorCancel = 'true';
      cancel.textContent = 'Cancelar';
      actions.prepend(cancel);
    }

    $$('[data-gi-editor-modal-close],[data-gi-editor-cancel]', card).forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        closeEditor();
      });
    });
  }

  function sync() {
    scheduled = false;
    const card = $('.gi-game.editing');
    if (!card) {
      cleanup();
      return;
    }

    activeCard = card;
    decorate(card);
    ensureBackdrop().classList.add('show');
    document.body.classList.add('gi-editor-modal-open');
    window.scrollTo(0, scrollBeforeOpen);

    requestAnimationFrame(() => {
      const first = $('.gi-editor input,.gi-editor select,.gi-editor textarea', card);
      first?.focus({ preventScroll: true });
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(sync));
  }

  document.addEventListener('click', event => {
    const managerAction = event.target.closest('#giManager [data-edit],#giManager [data-open],#giManager [data-add],#giManager [data-add-phase]');
    if (managerAction) {
      if (!$('.gi-game.editing')) {
        scrollBeforeOpen = window.scrollY;
        returnFocus = managerAction;
      }
      schedule();
      return;
    }

    if (event.target.closest('#giManager [data-save],#giManager [data-clear],#giManager [data-del]')) {
      schedule();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('.gi-game.editing')) {
      event.preventDefault();
      closeEditor();
    }
  });

  const root = $('#arenaDetail') || $('[data-page="tournament"]');
  if (root && window.MutationObserver) {
    new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node =>
        node.nodeType === 1 && (node.matches?.('#giManager,.gi-game.editing') || node.querySelector?.('.gi-game.editing'))
      ));
      if (relevant || (!$('.gi-game.editing') && document.body.classList.contains('gi-editor-modal-open'))) schedule();
    }).observe(root, { childList: true, subtree: true });
  }

  const style = document.createElement('style');
  style.id = 'giEditorModalFixStyles';
  style.textContent = `
    .gi-editor-modal-backdrop{position:fixed;inset:0;z-index:79998;display:none;background:rgba(0,0,0,.84);backdrop-filter:blur(12px)}
    .gi-editor-modal-backdrop.show{display:block}
    .gi-editor-modal-open{overflow:hidden!important}
    .gi-game.editing{
      position:fixed!important;
      inset:12px!important;
      z-index:79999!important;
      display:block!important;
      overflow:auto!important;
      width:min(1040px,calc(100vw - 24px))!important;
      height:max-content!important;
      max-height:calc(100dvh - 24px)!important;
      margin:auto!important;
      padding:0!important;
      grid-column:auto!important;
      border:1px solid rgba(245,220,134,.46)!important;
      border-radius:25px!important;
      background:radial-gradient(circle at 100% 0,rgba(245,220,134,.12),transparent 30%),linear-gradient(150deg,#153421,#050c08)!important;
      box-shadow:0 40px 120px rgba(0,0,0,.86)!important;
      overscroll-behavior:contain;
    }
    .gi-game.editing>header,.gi-game.editing>.gi-team,.gi-game.editing>.gi-agg,.gi-game.editing>p,.gi-game.editing>.old-match-photo-bar,.gi-game.editing>footer{display:none!important}
    .gi-editor-modal-head{position:sticky;top:0;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.10);background:rgba(5,13,8,.94);backdrop-filter:blur(14px)}
    .gi-editor-modal-head span{color:var(--gold-soft,#f5dc86);font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .gi-editor-modal-head h2{margin:5px 0 3px;color:#fff;font:900 32px/1 "Barlow Condensed",sans-serif;text-transform:uppercase}
    .gi-editor-modal-head p{margin:0;color:var(--muted,#9fb0a5);font-size:10px}
    .gi-editor-modal-head>button{flex:0 0 auto;width:44px;height:44px;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:13px;color:#fff;background:rgba(255,255,255,.05);font-size:26px;cursor:pointer}
    .gi-game.editing>.gi-editor{margin:0!important;padding:18px!important;border:0!important;border-radius:0!important;background:transparent!important}
    .gi-game.editing .gi-form{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:11px!important}
    .gi-game.editing .gi-editor input,.gi-game.editing .gi-editor select,.gi-game.editing .gi-editor textarea{min-height:46px!important;font-size:12px!important}
    .gi-game.editing .gi-editor textarea{min-height:100px!important}
    .gi-game.editing .gi-actions{position:sticky;bottom:-18px;z-index:3;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin:16px -18px -18px!important;padding:14px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.10);background:rgba(5,13,8,.96);backdrop-filter:blur(14px)}
    .gi-game.editing .gi-actions button{min-height:44px!important}
    @media(max-width:680px){
      .gi-game.editing{inset:6px!important;width:calc(100vw - 12px)!important;max-height:calc(100dvh - 12px)!important;border-radius:20px!important}
      .gi-editor-modal-head{padding:15px 14px}.gi-editor-modal-head h2{font-size:28px}
      .gi-game.editing>.gi-editor{padding:13px!important}
      .gi-game.editing .gi-form{grid-template-columns:1fr!important;gap:9px!important}
      .gi-game.editing .gi-actions{bottom:-13px;margin:14px -13px -13px!important;padding:12px 13px calc(12px + env(safe-area-inset-bottom))}
      .gi-game.editing .gi-actions button{flex:1 1 140px}
    }
    @media(prefers-reduced-motion:reduce){.gi-editor-modal-backdrop{backdrop-filter:none}}
  `;
  document.head.append(style);

  window.ArenaBDAMatchEditorModalFix = { refresh: schedule, close: closeEditor };
  schedule();
})();
