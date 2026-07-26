(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let observer = null;
  let timer = 0;
  let applying = false;

  function gameLabel(game) {
    const names = $$('.gi-team strong', game)
      .slice(0, 2)
      .map(element => element.textContent.trim())
      .filter(Boolean);
    return names.length === 2 ? `${names[0]} x ${names[1]}` : 'Confronto BDA';
  }

  function takePhoto(game) {
    if (!game) return;
    const label = gameLabel(game);
    if (window.ArenaBDACapture?.element) {
      window.ArenaBDACapture.element(game, label, label);
      return;
    }
    const fallback = $('.pro-game-photo', game);
    if (fallback) fallback.click();
    else if (typeof toast === 'function') toast('A ferramenta de foto ainda está carregando');
  }

  function addButton(game) {
    if ($('[data-old-match-photo]', game)) return;

    const bar = document.createElement('div');
    bar.className = 'old-match-photo-bar';
    bar.dataset.proIgnore = 'true';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'old-match-photo-button';
    button.dataset.oldMatchPhoto = '';
    button.innerHTML = '<span>📸</span><b>Foto do confronto</b>';
    button.title = 'Gerar a foto deste confronto como na versão antiga';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      takePhoto(game);
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
    timer = setTimeout(restore, 80);
  }

  const style = document.createElement('style');
  style.textContent = `
    .old-match-photo-bar{display:flex;justify-content:flex-end;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.10)}
    .old-match-photo-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 12px;border:1px solid rgba(245,220,134,.38);border-radius:11px;color:var(--gold-soft,#f5dc86);background:linear-gradient(145deg,rgba(245,220,134,.12),rgba(255,255,255,.04));font-size:9px;font-weight:900;letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 18px rgba(0,0,0,.18)}
    .old-match-photo-button:hover{transform:translateY(-1px);border-color:rgba(245,220,134,.62);background:linear-gradient(145deg,rgba(245,220,134,.20),rgba(255,255,255,.06))}
    .old-match-photo-button span{font-size:14px}.old-match-photo-button b{font:inherit}
    .francos-lite-manager .old-match-photo-button{border-color:rgba(68,204,246,.38);color:#a4efff;background:linear-gradient(145deg,rgba(32,200,243,.15),rgba(23,125,255,.06));box-shadow:0 8px 18px rgba(0,0,0,.20),0 0 16px rgba(32,200,243,.06)}
    .francos-lite-manager .old-match-photo-button:hover{border-color:rgba(111,229,255,.62);background:linear-gradient(145deg,rgba(32,200,243,.23),rgba(23,125,255,.10))}
    @media(max-width:560px){.old-match-photo-bar{justify-content:stretch}.old-match-photo-button{width:100%;min-height:39px}}
    @media(prefers-reduced-motion:reduce){.old-match-photo-button{transition:none!important}}
  `;
  document.head.append(style);

  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();

  window.ArenaBDAOldMatchPhoto = { refresh: schedule, take: takePhoto };
})();
