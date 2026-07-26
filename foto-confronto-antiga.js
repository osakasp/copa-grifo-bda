(() => {
  'use strict';

  const STUDIO_SRC = './foto-confronto-estilo-copa-facil.js?v=20260726-4';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let observer = null;
  let timer = 0;
  let applying = false;
  let studioPromise = null;

  function gameLabel(game) {
    const names = $$('.gi-team strong', game)
      .slice(0, 2)
      .map(element => element.textContent.trim())
      .filter(Boolean);
    return names.length === 2 ? `${names[0]} x ${names[1]}` : 'Confronto BDA';
  }

  function loadStudio() {
    if (window.ArenaBDAMatchPhotoStudio?.open) return Promise.resolve(window.ArenaBDAMatchPhotoStudio);
    if (studioPromise) return studioPromise;

    studioPromise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src.includes('foto-confronto-estilo-copa-facil.js'));
      const ready = () => window.ArenaBDAMatchPhotoStudio?.open
        ? resolve(window.ArenaBDAMatchPhotoStudio)
        : reject(new Error('O editor de confronto não iniciou'));

      if (existing) {
        existing.addEventListener('load', ready, { once: true });
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar o editor')), { once: true });
        setTimeout(() => window.ArenaBDAMatchPhotoStudio?.open && resolve(window.ArenaBDAMatchPhotoStudio), 0);
        return;
      }

      const script = document.createElement('script');
      script.src = STUDIO_SRC;
      script.async = true;
      script.dataset.arenaLazyFeature = 'match-photo';
      script.addEventListener('load', ready, { once: true });
      script.addEventListener('error', () => reject(new Error('Falha ao carregar o editor')), { once: true });
      document.head.append(script);
    }).catch(error => {
      studioPromise = null;
      throw error;
    });

    return studioPromise;
  }

  async function takePhoto(game, button = null) {
    if (!game || button?.dataset.loading === 'true') return;
    const original = button?.innerHTML || '';

    if (button) {
      button.dataset.loading = 'true';
      button.disabled = true;
      button.innerHTML = '<span>⏳</span><span class="old-match-photo-copy"><b>Carregando editor</b><small>Preparando a prévia...</small></span>';
    }

    try {
      const studio = await loadStudio();
      studio.open(game);
    } catch (error) {
      console.error(error);
      const label = gameLabel(game);
      if (window.ArenaBDACapture?.element) {
        window.ArenaBDACapture.element(game, label, label);
      } else {
        notify('Não foi possível abrir o editor de imagens');
      }
    } finally {
      if (button) {
        button.dataset.loading = 'false';
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  function addButton(game) {
    let button = $('[data-old-match-photo]', game);
    if (button) {
      button.innerHTML = '<span>📸</span><span class="old-match-photo-copy"><b>Criar arte do confronto</b><small>Prévia, modelos e compartilhamento</small></span><i>NOVO</i>';
      return;
    }

    const bar = document.createElement('div');
    bar.className = 'old-match-photo-bar';
    bar.dataset.proIgnore = 'true';

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'old-match-photo-button';
    button.dataset.oldMatchPhoto = '';
    button.innerHTML = '<span>📸</span><span class="old-match-photo-copy"><b>Criar arte do confronto</b><small>Prévia, modelos e compartilhamento</small></span><i>NOVO</i>';
    button.title = 'Abrir o editor da foto deste confronto';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      takePhoto(game, button);
    });

    bar.append(button);
    const editor = $('.gi-editor', game);
    const footer = $(':scope > footer', game);
    if (editor) game.insertBefore(bar, editor);
    else if (footer) game.insertBefore(bar, footer);
    else game.append(bar);
  }

  function restore() {
    if (applying) return;
    applying = true;
    observer?.disconnect();
    try {
      $$('#giManager .gi-game').forEach(addButton);
    } finally {
      applying = false;
      observer?.observe(document.body, { childList: true, subtree: true });
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(restore, 120);
  }

  function relevantMutation(mutation) {
    return [...mutation.addedNodes].some(node => node.nodeType === 1 && (
      node.matches?.('#giManager,.gi-game,.gi-phase')
      || node.querySelector?.('.gi-game')
    ));
  }

  const style = document.createElement('style');
  style.textContent = `
    .gi-game>.pro-game-photo,.gi-game footer>.pro-game-photo,.francos-lite-photo-tools{display:none!important}
    .old-match-photo-bar{display:flex;justify-content:stretch;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.10)}
    .old-match-photo-button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:50px;padding:8px 11px;border:1px solid rgba(245,220,134,.42);border-radius:13px;color:var(--gold-soft,#f5dc86);background:radial-gradient(circle at 100% 0,rgba(245,220,134,.15),transparent 35%),linear-gradient(145deg,rgba(245,220,134,.10),rgba(255,255,255,.035));text-align:left;cursor:pointer;box-shadow:0 9px 22px rgba(0,0,0,.22)}
    .old-match-photo-button:hover{transform:translateY(-1px);border-color:rgba(245,220,134,.68);background:radial-gradient(circle at 100% 0,rgba(245,220,134,.22),transparent 35%),linear-gradient(145deg,rgba(245,220,134,.16),rgba(255,255,255,.05))}
    .old-match-photo-button:disabled{cursor:wait;opacity:.72;transform:none!important}
    .old-match-photo-button>span:first-child{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(245,220,134,.28);border-radius:10px;background:rgba(0,0,0,.22);font-size:16px}
    .old-match-photo-copy b,.old-match-photo-copy small{display:block}.old-match-photo-copy b{font-size:9px;font-weight:900}.old-match-photo-copy small{margin-top:3px;color:var(--muted,#9fb0a5);font-size:7px;font-weight:700}.old-match-photo-button i{padding:5px 7px;border-radius:999px;color:#151006;background:linear-gradient(135deg,#fff0a5,#e9bc43);font-size:6px;font-style:normal;font-weight:1000;letter-spacing:.08em}
    .francos-lite-manager .old-match-photo-button{border-color:rgba(68,204,246,.44);color:#a4efff;background:radial-gradient(circle at 100% 0,rgba(32,200,243,.18),transparent 35%),linear-gradient(145deg,rgba(32,200,243,.13),rgba(23,125,255,.055));box-shadow:0 9px 22px rgba(0,0,0,.22),0 0 18px rgba(32,200,243,.07)}
    .francos-lite-manager .old-match-photo-button:hover{border-color:rgba(111,229,255,.68);background:radial-gradient(circle at 100% 0,rgba(32,200,243,.26),transparent 35%),linear-gradient(145deg,rgba(32,200,243,.20),rgba(23,125,255,.09))}
    .francos-lite-manager .old-match-photo-button>span:first-child{border-color:rgba(92,220,255,.30)}.francos-lite-manager .old-match-photo-button i{color:#031018;background:linear-gradient(135deg,#a4f2ff,#20c8f3,#177dff)}
    @media(max-width:560px){.old-match-photo-button{min-height:54px}.old-match-photo-copy b{font-size:10px}}
    @media(prefers-reduced-motion:reduce){.old-match-photo-button{transition:none!important}}
  `;
  document.head.append(style);

  observer = new MutationObserver(mutations => {
    if (mutations.some(relevantMutation)) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();

  window.ArenaBDAOldMatchPhoto = { refresh: schedule, take: takePhoto, preload: loadStudio };
})();