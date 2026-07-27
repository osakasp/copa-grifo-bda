(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let refreshTimer = 0;
  let applying = false;

  function isAdminActive() {
    try {
      if (window.ArenaBDAAuth?.isAdmin) return Boolean(window.ArenaBDAAuth.isAdmin());
    } catch {}
    const button = $('#adminBtn');
    return Boolean(
      document.documentElement.classList.contains('arena-admin-authenticated')
      || button?.classList.contains('active')
      || /ativo|sair/i.test(button?.textContent || '')
    );
  }

  function decoratePanel() {
    const button = $('#cloudPanelBtn');
    if (!button) return;
    button.classList.add('arena-clean-panel');
    if (!button.querySelector('.arena-clean-panel-icon')) {
      button.innerHTML = '<span class="arena-clean-panel-icon" aria-hidden="true">⚙</span><b>Painel</b>';
    }
  }

  function decorateAdmin() {
    const button = $('#adminBtn');
    if (!button) return;
    const active = isAdminActive();
    const state = active ? 'active' : 'guest';
    if (button.dataset.cleanAdminState === state && button.querySelector('.arena-clean-admin-icon')) return;

    button.dataset.cleanAdminState = state;
    button.classList.add('arena-clean-admin');
    button.classList.toggle('active', active);
    button.innerHTML = active
      ? '<i class="arena-clean-admin-dot" aria-hidden="true"></i><span class="arena-clean-admin-icon" aria-hidden="true">👤</span><b>Admin</b>'
      : '<span class="arena-clean-admin-icon" aria-hidden="true">🔐</span><b>Entrar</b>';
    button.setAttribute('aria-label', active ? 'Administrador ativo. Toque para sair' : 'Entrar como administrador');
    button.title = active ? 'Administrador ativo • tocar para sair' : 'Entrar como administrador';
  }

  function addShareToMore() {
    const grid = $('.arena-nav-sheet-grid');
    const share = $('#shareBtn');
    if (!grid || !share || $('#arenaShareMore')) return;

    const button = document.createElement('button');
    button.id = 'arenaShareMore';
    button.type = 'button';
    button.className = 'arena-sheet-item arena-share-more';
    button.innerHTML = '<i aria-hidden="true">↗</i><span><b>Compartilhar Arena</b><small>Enviar o link para outro membro</small></span><em>›</em>';
    button.addEventListener('click', () => {
      $('.arena-nav-sheet-backdrop')?.classList.remove('show');
      document.body.classList.remove('arena-sheet-open');
      share.click();
    });
    grid.append(button);
  }

  function scoreValue(element) {
    if (!element) return '–';
    const raw = 'value' in element ? element.value : element.textContent;
    const value = String(raw ?? '').trim();
    return value === '' ? '–' : value;
  }

  function syncPhotoScore(game) {
    if (!game) return;
    const scores = $$('.gip-scoreboard > .gi-score-input, .gip-scoreboard > .gi-score', game)
      .slice(0, 2)
      .map(scoreValue);
    const teams = $$('.gi-team', game).slice(0, 2);
    if (scores.length !== 2 || teams.length !== 2) return;

    teams.forEach((team, index) => {
      let bridge = $('.arena-photo-score-bridge', team);
      if (!bridge) {
        bridge = document.createElement('span');
        bridge.className = 'gi-score arena-photo-score-bridge';
        bridge.setAttribute('aria-hidden', 'true');
        team.append(bridge);
      }
      bridge.textContent = scores[index];
    });
  }

  function syncAllPhotoScores() {
    $$('#giManager .gi-game').forEach(syncPhotoScore);
  }

  function syncFromTarget(target) {
    syncPhotoScore(target?.closest?.('.gi-game'));
  }

  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (applying) return;
      applying = true;
      try {
        const topbar = $('.topbar');
        if (topbar) {
          topbar.classList.add('arena-topbar-clean');
          decoratePanel();
          decorateAdmin();
          addShareToMore();
        }
        syncAllPhotoScores();
      } finally {
        applying = false;
      }
    }, 0);
  }

  const style = document.createElement('style');
  style.id = 'arenaTopbarCleanStyles';
  style.textContent = `
    .arena-photo-score-bridge{display:none!important}
    .arena-topbar-clean .top-actions{min-width:0}
    .arena-clean-panel,.arena-clean-admin{display:inline-flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
    .arena-clean-panel-icon,.arena-clean-admin-icon{font-size:15px;line-height:1}
    .arena-clean-panel b,.arena-clean-admin b{font-size:10px;line-height:1;text-transform:uppercase}
    .arena-clean-admin{position:relative}.arena-clean-admin-dot{position:absolute;right:5px;top:5px;width:7px;height:7px;border:2px solid #102018;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px rgba(79,223,143,.12)}
    #cloudPanelBtn[hidden]{display:none!important}
    @media(max-width:720px){
      .topbar.arena-topbar-clean{position:sticky!important;top:6px!important;z-index:48!important;width:auto!important;min-height:62px!important;margin:6px 8px 12px!important;padding:7px 8px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:7px!important;border:1px solid rgba(242,215,125,.20)!important;border-radius:20px!important;background:linear-gradient(180deg,rgba(13,28,20,.96),rgba(5,13,9,.97))!important;box-shadow:0 13px 34px rgba(0,0,0,.34)!important;backdrop-filter:blur(20px)!important}
      .topbar.arena-topbar-clean .brand{width:46px!important;min-width:46px!important;flex:0 0 46px!important;margin:0!important;padding:0!important;display:block!important;border:0!important}
      .topbar.arena-topbar-clean .brand:before,.topbar.arena-topbar-clean .brand:after,.topbar.arena-topbar-clean .brand-copy{display:none!important}
      .topbar.arena-topbar-clean .brand-mark{width:46px!important;height:46px!important;margin:0!important;border-radius:14px!important;transform:none!important;box-shadow:0 8px 20px rgba(0,0,0,.24)!important}
      .topbar.arena-topbar-clean .top-actions{flex:1 1 auto!important;display:grid!important;grid-template-columns:40px 40px minmax(72px,92px) 42px!important;justify-content:end!important;align-items:center!important;gap:5px!important}
      .topbar.arena-topbar-clean #shareBtn{display:none!important}
      .topbar.arena-topbar-clean #arenaThemeToggle,.topbar.arena-topbar-clean #arenaNotificationsBtn{width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;padding:0!important;border-radius:12px!important}
      .topbar.arena-topbar-clean #arenaThemeToggle b{display:none!important}
      .topbar.arena-topbar-clean #cloudPanelBtn{width:100%!important;min-width:0!important;height:40px!important;min-height:40px!important;padding:0 9px!important;border-radius:12px!important;gap:5px!important}
      .topbar.arena-topbar-clean #cloudPanelBtn b{font-size:9px!important}
      .topbar.arena-topbar-clean #adminBtn{width:42px!important;min-width:42px!important;height:40px!important;min-height:40px!important;padding:0!important;border-radius:12px!important;font-size:0!important}
      .topbar.arena-topbar-clean #adminBtn b{display:none!important}
      .topbar.arena-topbar-clean #adminBtn:not(.active){color:var(--gold-soft)!important;background:rgba(255,255,255,.04)!important;border-color:var(--line)!important}
      html[data-theme="light"] .topbar.arena-topbar-clean{background:linear-gradient(180deg,rgba(250,252,250,.97),rgba(235,243,236,.97))!important;border-color:rgba(166,126,20,.24)!important;box-shadow:0 13px 32px rgba(39,72,49,.14)!important}
      html[data-theme="light"] .arena-clean-admin-dot{border-color:#f3f8f4}
    }
    @media(max-width:370px){
      .topbar.arena-topbar-clean{margin-inline:5px!important;padding-inline:6px!important;gap:5px!important}
      .topbar.arena-topbar-clean .brand{width:42px!important;min-width:42px!important;flex-basis:42px!important}.topbar.arena-topbar-clean .brand-mark{width:42px!important;height:42px!important}
      .topbar.arena-topbar-clean .top-actions{grid-template-columns:38px 38px minmax(60px,78px) 38px!important;gap:4px!important}
      .topbar.arena-topbar-clean #arenaThemeToggle,.topbar.arena-topbar-clean #arenaNotificationsBtn,.topbar.arena-topbar-clean #cloudPanelBtn,.topbar.arena-topbar-clean #adminBtn{height:38px!important;min-height:38px!important}
      .topbar.arena-topbar-clean #arenaThemeToggle,.topbar.arena-topbar-clean #arenaNotificationsBtn,.topbar.arena-topbar-clean #adminBtn{width:38px!important;min-width:38px!important}
      .topbar.arena-topbar-clean #cloudPanelBtn{padding-inline:6px!important}.topbar.arena-topbar-clean #cloudPanelBtn b{font-size:8px!important}
    }
  `;
  document.head.append(style);

  document.addEventListener('pointerdown', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-old-match-photo],.pro-game-photo') : null;
    if (button) syncFromTarget(button);
  }, true);

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-old-match-photo],.pro-game-photo') : null;
    if (button) syncFromTarget(button);
  }, true);

  document.addEventListener('input', event => {
    if (event.target instanceof Element && event.target.closest('.gip-scoreboard')) syncFromTarget(event.target);
  }, true);

  const observer = new MutationObserver(refresh);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.ArenaBDAAuth?.subscribe?.(() => window.setTimeout(refresh, 0));
  window.addEventListener('arena:permissions-updated', refresh);
  window.addEventListener('arena:quick-score-saved', refresh);

  window.ArenaBDATopbar = Object.freeze({ refresh, syncPhotoScore });
  refresh();
})();
