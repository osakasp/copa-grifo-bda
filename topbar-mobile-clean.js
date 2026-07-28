(() => {
  'use strict';

  const PHOTO_FORMATS = Object.freeze({
    square: { width: 1080, height: 1080 },
    portrait: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 }
  });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let lastExportFormat = '';

  function forceDarkTheme() {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
    $('#arenaThemeToggle')?.remove();
    try { localStorage.removeItem('arena-bda-theme'); } catch {}
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = '#07100c';
  }

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

  function decorateTopbar() {
    forceDarkTheme();
    const topbar = $('.topbar');
    if (!topbar) return;
    topbar.classList.add('arena-topbar-clean');

    const panel = $('#cloudPanelBtn');
    if (panel && !panel.querySelector('.arena-clean-panel-icon')) {
      panel.classList.add('arena-clean-panel');
      panel.innerHTML = '<span class="arena-clean-panel-icon" aria-hidden="true">⚙</span><b>Painel</b>';
    }

    const admin = $('#adminBtn');
    if (admin) {
      const active = isAdminActive();
      const state = active ? 'active' : 'guest';
      if (admin.dataset.cleanAdminState !== state || !admin.querySelector('.arena-clean-admin-icon')) {
        admin.dataset.cleanAdminState = state;
        admin.classList.add('arena-clean-admin');
        admin.classList.toggle('active', active);
        admin.innerHTML = active
          ? '<i class="arena-clean-admin-dot" aria-hidden="true"></i><span class="arena-clean-admin-icon" aria-hidden="true">👤</span><b>Admin</b>'
          : '<span class="arena-clean-admin-icon" aria-hidden="true">🔐</span><b>Entrar</b>';
        admin.setAttribute('aria-label', active ? 'Administrador ativo. Toque para sair' : 'Entrar como administrador');
      }
    }

    const grid = $('.arena-nav-sheet-grid');
    const share = $('#shareBtn');
    if (grid && share && !$('#arenaShareMore')) {
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
  }

  function scoreValue(element) {
    if (!element) return '–';
    const raw = 'value' in element ? element.value : element.textContent;
    return String(raw ?? '').trim() || '–';
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

  function selectedPhotoFormat() {
    const previewFormat = $('#cfpPreviewViewport .cfp-card')?.dataset?.format;
    if (PHOTO_FORMATS[previewFormat]) return previewFormat;
    const selected = $('#cfpFormat')?.value;
    if (PHOTO_FORMATS[selected]) return selected;
    return PHOTO_FORMATS[lastExportFormat] ? lastExportFormat : 'portrait';
  }

  function copyPreviewIntoExport(stage) {
    if (!stage?.classList?.contains('cfp-export-stage')) return PHOTO_FORMATS.portrait;
    const preview = $('#cfpPreviewViewport .cfp-card');
    const key = PHOTO_FORMATS[preview?.dataset?.format] ? preview.dataset.format : selectedPhotoFormat();
    const format = PHOTO_FORMATS[key] || PHOTO_FORMATS.portrait;

    if (preview) {
      stage.className = `${preview.className} cfp-export-stage`;
      stage.innerHTML = preview.innerHTML;
      ['--cfp-a', '--cfp-b', '--cfp-accent', '--cfp-glow', '--cfp-background-image'].forEach(property => {
        const value = preview.style.getPropertyValue(property);
        if (value) stage.style.setProperty(property, value);
      });
    }

    stage.dataset.format = key;
    stage.style.setProperty('width', `${format.width}px`, 'important');
    stage.style.setProperty('height', `${format.height}px`, 'important');
    stage.style.setProperty('transform', 'none', 'important');
    lastExportFormat = key;
    return format;
  }

  function installCaptureBridge() {
    const original = window.html2canvas;
    if (typeof original !== 'function' || original.__arenaPreviewBridge) return;

    const wrapped = function arenaPreviewHtml2Canvas(element, options = {}) {
      if (!element?.classList?.contains('cfp-export-stage')) return original.call(this, element, options);
      const format = copyPreviewIntoExport(element);
      return original.call(this, element, {
        ...options,
        width: format.width,
        height: format.height,
        windowWidth: format.width,
        windowHeight: format.height,
        scrollX: 0,
        scrollY: 0
      });
    };

    wrapped.__arenaPreviewBridge = true;
    wrapped.__arenaOriginal = original;
    window.html2canvas = wrapped;
  }

  function watchCaptureLoader() {
    installCaptureBridge();
    $$('script[src*="html2canvas"]').forEach(script => {
      if (script.dataset.arenaPreviewBridgeBound === 'true') return;
      script.dataset.arenaPreviewBridgeBound = 'true';
      script.addEventListener('load', installCaptureBridge, { once: true });
    });
  }

  function refresh() {
    decorateTopbar();
    syncAllPhotoScores();
    watchCaptureLoader();
  }

  const style = document.createElement('style');
  style.id = 'arenaTopbarCleanStyles';
  style.textContent = `
    .arena-photo-score-bridge{display:none!important}
    .arena-topbar-clean .top-actions{min-width:0}
    .arena-clean-panel,.arena-clean-admin{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
    .arena-clean-panel-icon,.arena-clean-admin-icon{font-size:15px;line-height:1}
    .arena-clean-panel b,.arena-clean-admin b{font-size:9px;line-height:1;text-transform:uppercase}
    .arena-clean-admin{position:relative}
    .arena-clean-admin-dot{position:absolute;right:5px;top:5px;width:7px;height:7px;border:2px solid #102018;border-radius:50%;background:var(--green)}
    #cloudPanelBtn[hidden]{display:none!important}
    @media(max-width:720px){
      .topbar.arena-topbar-clean{position:sticky!important;top:6px!important;z-index:48!important;min-height:58px!important;margin:6px 8px 12px!important;padding:6px 8px!important;gap:7px!important;border:1px solid rgba(242,215,125,.18)!important;border-radius:18px!important;background:rgba(6,16,11,.96)!important;box-shadow:0 10px 26px rgba(0,0,0,.28)!important;backdrop-filter:blur(14px)!important}
      .topbar.arena-topbar-clean .brand{width:44px!important;min-width:44px!important;flex:0 0 44px!important;margin:0!important;padding:0!important}
      .topbar.arena-topbar-clean .brand-copy,.topbar.arena-topbar-clean .brand:before,.topbar.arena-topbar-clean .brand:after{display:none!important}
      .topbar.arena-topbar-clean .brand-mark{width:44px!important;height:44px!important;margin:0!important;border-radius:13px!important;transform:none!important}
      .topbar.arena-topbar-clean .top-actions{flex:1 1 auto!important;display:flex!important;justify-content:flex-end!important;align-items:center!important;gap:5px!important}
      .topbar.arena-topbar-clean #shareBtn{display:none!important}
      .topbar.arena-topbar-clean #arenaNotificationsBtn{width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;padding:0!important;border-radius:12px!important}
      .topbar.arena-topbar-clean #cloudPanelBtn{min-width:72px!important;height:40px!important;min-height:40px!important;padding:0 9px!important;border-radius:12px!important}
      .topbar.arena-topbar-clean #adminBtn{width:42px!important;min-width:42px!important;height:40px!important;min-height:40px!important;padding:0!important;border-radius:12px!important;font-size:0!important}
      .topbar.arena-topbar-clean #adminBtn b{display:none!important}
      .topbar.arena-topbar-clean #adminBtn:not(.active){color:var(--gold-soft)!important;background:rgba(255,255,255,.04)!important;border-color:var(--line)!important}
    }
    @media(max-width:370px){
      .topbar.arena-topbar-clean{margin-inline:5px!important;padding-inline:6px!important}
      .topbar.arena-topbar-clean .brand,.topbar.arena-topbar-clean .brand-mark{width:40px!important;min-width:40px!important;height:40px!important}
      .topbar.arena-topbar-clean #arenaNotificationsBtn,.topbar.arena-topbar-clean #adminBtn{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important}
      .topbar.arena-topbar-clean #cloudPanelBtn{min-width:64px!important;height:38px!important;min-height:38px!important;padding-inline:6px!important}
    }
  `;
  document.head.append(style);

  document.addEventListener('pointerdown', event => {
    const target = event.target instanceof Element ? event.target : null;
    const photoButton = target?.closest('[data-old-match-photo],.pro-game-photo');
    if (photoButton) syncPhotoScore(photoButton.closest('.gi-game'));
    if (target?.closest('[data-cfp-download-action],[data-cfp-share-action]')) {
      lastExportFormat = selectedPhotoFormat();
      watchCaptureLoader();
    }
  }, true);

  document.addEventListener('input', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.gip-scoreboard')) syncPhotoScore(target.closest('.gi-game'));
  }, true);

  document.addEventListener('change', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('#cfpFormat')) lastExportFormat = target.value;
  }, true);

  const headObserver = new MutationObserver(watchCaptureLoader);
  headObserver.observe(document.head, { childList: true });

  window.ArenaBDAAuth?.subscribe?.(() => setTimeout(decorateTopbar, 0));
  window.addEventListener('arena:permissions-updated', decorateTopbar);
  window.addEventListener('arena:quick-score-saved', syncAllPhotoScores);
  window.addEventListener('arena:matches-updated', syncAllPhotoScores);

  window.ArenaBDATopbar = Object.freeze({
    refresh,
    syncPhotoScore,
    syncPhotoExport: installCaptureBridge
  });

  refresh();
})();