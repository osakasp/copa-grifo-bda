(() => {
  'use strict';

  const STORAGE_KEY = 'arena-bda-theme';
  const THEMES = new Set(['light', 'dark']);
  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  let refreshTimer = 0;

  function savedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return THEMES.has(value) ? value : '';
    } catch {
      return '';
    }
  }

  function systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function currentTheme() {
    return THEMES.has(root.dataset.theme) ? root.dataset.theme : (savedTheme() || systemTheme());
  }

  function updateMeta(theme) {
    let scheme = $('meta[name="color-scheme"]');
    if (!scheme) {
      scheme = document.createElement('meta');
      scheme.name = 'color-scheme';
      document.head.append(scheme);
    }
    scheme.content = 'light dark';

    let color = $('meta[name="theme-color"]');
    if (!color) {
      color = document.createElement('meta');
      color.name = 'theme-color';
      document.head.append(color);
    }
    color.content = theme === 'light' ? '#eef4ee' : '#07100c';
  }

  function syncButton() {
    const button = $('#arenaThemeToggle');
    if (!button) return;
    const light = currentTheme() === 'light';
    const state = light ? 'light' : 'dark';

    if (button.dataset.themeState !== state) {
      button.dataset.themeState = state;
      button.innerHTML = light
        ? '<span aria-hidden="true">🌙</span><b>Escuro</b>'
        : '<span aria-hidden="true">☀️</span><b>Claro</b>';
    }

    button.setAttribute('aria-label', light ? 'Ativar tema escuro' : 'Ativar tema claro');
    button.title = light ? 'Ativar tema escuro' : 'Ativar tema claro';
    button.setAttribute('aria-pressed', String(light));
  }

  function applyTheme(theme, { persist = true, announce = false } = {}) {
    const next = THEMES.has(theme) ? theme : systemTheme();
    root.dataset.theme = next;
    root.style.colorScheme = next;
    updateMeta(next);

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    }

    syncButton();
    window.dispatchEvent(new CustomEvent('arena:theme-changed', { detail: { theme: next } }));

    if (announce) {
      const message = next === 'light' ? 'Tema claro ativado' : 'Tema escuro ativado';
      if (typeof window.toast === 'function') window.toast(message);
    }
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'light' ? 'dark' : 'light', { persist: true, announce: true });
  }

  function ensureToggle() {
    const actions = $('.top-actions');
    if (!actions || $('#arenaThemeToggle')) return;

    const button = document.createElement('button');
    button.id = 'arenaThemeToggle';
    button.type = 'button';
    button.className = 'admin-btn arena-theme-toggle';
    button.addEventListener('click', toggleTheme);
    actions.insertBefore(button, actions.firstChild);
    syncButton();
  }

  function installStyles() {
    if ($('#arenaThemeStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaThemeStyles';
    style.textContent = `
      :root{color-scheme:dark}
      html[data-theme="light"]{
        color-scheme:light;
        --bg:#eef4ee;
        --bg-soft:#e4ece5;
        --surface:rgba(255,255,255,.94);
        --surface-2:rgba(244,249,245,.97);
        --line:rgba(24,66,40,.15);
        --line-strong:rgba(166,126,20,.38);
        --text:#16231a;
        --muted:#5d7063;
        --gold:#b58a18;
        --gold-soft:#d6aa32;
        --green:#168449;
        --red:#c54858;
        --blue:#2875ba;
        --shadow:0 18px 48px rgba(39,72,49,.15)
      }
      html[data-theme="light"] body{
        color:var(--text)!important;
        background:radial-gradient(circle at 50% -12%,rgba(214,170,50,.22),transparent 34%),radial-gradient(circle at 8% 30%,rgba(22,132,73,.10),transparent 24%),linear-gradient(180deg,#f7faf7 0%,var(--bg) 65%)!important
      }
      html[data-theme="light"] .topbar{
        background:rgba(249,252,249,.88)!important;
        border-color:var(--line)!important;
        box-shadow:0 10px 30px rgba(34,69,44,.08)!important
      }
      html[data-theme="light"] .card,
      html[data-theme="light"] .stat,
      html[data-theme="light"] .form-card,
      html[data-theme="light"] .team-card,
      html[data-theme="light"] .champion-card,
      html[data-theme="light"] .live-card,
      html[data-theme="light"] .message,
      html[data-theme="light"] .admin-panel,
      html[data-theme="light"] .news-card,
      html[data-theme="light"] .gi-game,
      html[data-theme="light"] .gi-phase,
      html[data-theme="light"] .gip-card{
        color:var(--text)!important;
        background:linear-gradient(150deg,var(--surface-2),var(--surface))!important;
        border-color:var(--line)!important;
        box-shadow:0 12px 32px rgba(39,72,49,.10)!important
      }
      html[data-theme="light"] input,
      html[data-theme="light"] select,
      html[data-theme="light"] textarea{
        color:var(--text)!important;
        background:rgba(255,255,255,.90)!important;
        border-color:var(--line)!important
      }
      html[data-theme="light"] input::placeholder,
      html[data-theme="light"] textarea::placeholder{color:#819086!important}
      html[data-theme="light"] .secondary,
      html[data-theme="light"] .ghost,
      html[data-theme="light"] .icon-btn,
      html[data-theme="light"] .admin-btn:not(.active),
      html[data-theme="light"] .news-admin button{
        color:var(--text)!important;
        background:rgba(255,255,255,.70)!important;
        border-color:var(--line)!important
      }
      html[data-theme="light"] .fixture{
        color:var(--text)!important;
        background:rgba(255,255,255,.66)!important;
        border-color:var(--line)!important
      }
      html[data-theme="light"] .bottom-nav,
      html[data-theme="light"] .arena-mobile-nav{
        color:var(--text)!important;
        background:rgba(248,251,248,.94)!important;
        border-color:rgba(166,126,20,.28)!important;
        box-shadow:0 18px 44px rgba(39,72,49,.18)!important
      }
      html[data-theme="light"] .bottom-nav.arena-side-nav{
        background:radial-gradient(circle at 50% 0,rgba(214,170,50,.18),transparent 28%),linear-gradient(180deg,rgba(249,252,249,.98),rgba(235,243,236,.98))!important;
        border-color:rgba(166,126,20,.30)!important;
        box-shadow:0 22px 52px rgba(39,72,49,.18)!important
      }
      html[data-theme="light"] .arena-side-brand,
      html[data-theme="light"] .arena-side-footer,
      html[data-theme="light"] .arena-sheet-item{
        color:var(--text)!important;
        background:rgba(255,255,255,.70)!important;
        border-color:var(--line)!important
      }
      html[data-theme="light"] .arena-nav-sheet{
        color:var(--text)!important;
        background:radial-gradient(circle at 90% 0,rgba(214,170,50,.18),transparent 31%),linear-gradient(155deg,#f8fbf8,#e7efe8)!important;
        border-color:rgba(166,126,20,.30)!important
      }
      html[data-theme="light"] .modal,
      html[data-theme="light"] .news-editor,
      html[data-theme="light"] .news-article{
        color:var(--text)!important;
        background:#f8fbf8!important;
        border-color:rgba(166,126,20,.32)!important;
        box-shadow:0 24px 60px rgba(39,72,49,.22)!important
      }
      html[data-theme="light"] .modal-backdrop,
      html[data-theme="light"] .arena-nav-sheet-backdrop{
        background:rgba(39,57,45,.46)!important
      }
      html[data-theme="light"] .message p,
      html[data-theme="light"] .quote,
      html[data-theme="light"] .news-summary,
      html[data-theme="light"] .news-article-text p{color:#31483a!important}
      html[data-theme="light"] .hero,
      html[data-theme="light"] .news-lead{
        color:#f7fbf8!important;
        background:linear-gradient(180deg,transparent 0 28%,rgba(8,32,18,.86) 80%),radial-gradient(circle at 72% 22%,rgba(242,215,125,.48),transparent 18%),linear-gradient(135deg,#278452,#103d24 64%)!important;
        border-color:rgba(181,138,24,.48)!important
      }
      html[data-theme="light"] .hero h1,
      html[data-theme="light"] .hero h2,
      html[data-theme="light"] .hero p,
      html[data-theme="light"] .news-lead h2,
      html[data-theme="light"] .news-lead p,
      html[data-theme="light"] .news-lead time{color:#f7fbf8!important}
      html[data-theme="light"] .eyebrow,
      html[data-theme="light"] .round-title,
      html[data-theme="light"] .match-stage,
      html[data-theme="light"] .edition,
      html[data-theme="light"] .section-head button{color:#9b7010!important}
      html[data-theme="light"] .arena-theme-toggle{
        color:#6f5010!important;
        background:linear-gradient(145deg,#fff9df,#f2df97)!important;
        border-color:rgba(181,138,24,.34)!important
      }
      .arena-theme-toggle{display:inline-flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;transition:transform .18s ease,background .18s ease,color .18s ease}
      .arena-theme-toggle:hover{transform:translateY(-1px)}
      .arena-theme-toggle span{font-size:17px;line-height:1}.arena-theme-toggle b{font-size:10px}
      @media(max-width:560px){.arena-theme-toggle{width:42px;padding:0}.arena-theme-toggle b{display:none}}
      @media(prefers-reduced-motion:reduce){.arena-theme-toggle{transition:none}}
    `;
    document.head.append(style);
  }

  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      installStyles();
      ensureToggle();
      syncButton();
    }, 0);
  }

  const media = window.matchMedia?.('(prefers-color-scheme: light)');
  media?.addEventListener?.('change', () => {
    if (!savedTheme()) applyTheme(systemTheme(), { persist: false });
  });

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  applyTheme(currentTheme(), { persist: false });
  refresh();

  window.ArenaBDATheme = Object.freeze({
    get: currentTheme,
    set: theme => applyTheme(theme, { persist: true, announce: true }),
    toggle: toggleTheme,
    useSystem: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      applyTheme(systemTheme(), { persist: false, announce: true });
    }
  });
})();
