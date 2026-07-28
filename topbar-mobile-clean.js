(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);

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

  const style = document.createElement('style');
  style.id = 'arenaTopbarCleanStyles';
  style.textContent = `
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

  window.ArenaBDAAuth?.subscribe?.(() => setTimeout(decorateTopbar, 0));
  window.addEventListener('arena:permissions-updated', decorateTopbar);
  window.ArenaBDATopbar = Object.freeze({ refresh: decorateTopbar });

  [0, 180, 600, 1400].forEach(delay => setTimeout(decorateTopbar, delay));
})();