(() => {
  'use strict';

  const VERSION = '2026.08.25.3';
  const q = selector => document.querySelector(selector);
  let errorCount = 0;
  let errorWindow = 0;
  const signatures = new Set();

  function notify(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  function ensureStyles() {
    if (q('#arenaHealthStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaHealthStyles';
    style.textContent = `
      .arena-health-banner{position:fixed;left:50%;bottom:calc(var(--nav-h,78px) + 20px);z-index:90000;display:flex;align-items:center;gap:10px;width:min(500px,calc(100% - 24px));padding:10px 11px;border:1px solid rgba(227,196,95,.34);border-radius:6px;color:#edf5ef;background:#0b1510;box-shadow:0 12px 32px #0009;transform:translateX(-50%);text-align:left}
      .arena-health-banner>span{display:grid;place-items:center;width:30px;height:28px;flex:0 0 auto;border-right:1px solid rgba(227,196,95,.28);color:#e3c45f;font:800 7px/1 Inter,Arial,sans-serif;letter-spacing:.05em}.arena-health-banner>div{min-width:0;flex:1}.arena-health-banner b,.arena-health-banner small{display:block}.arena-health-banner b{font-size:10px}.arena-health-banner small{margin-top:3px;color:#95a69c;font-size:8px}.arena-health-banner button{min-height:34px;padding:0 11px;border:1px solid #e4ca70;border-radius:4px;color:#171107;background:#d7b856;font-size:9px;font-weight:800;cursor:pointer}.arena-health-banner .arena-health-close{width:30px;padding:0;border-color:rgba(222,232,225,.12);color:#dce7df;background:transparent}
      .arena-offline-indicator{position:fixed;right:10px;top:75px;z-index:89999;padding:7px 9px;border:1px solid rgba(255,180,80,.34);border-radius:4px;color:#ffd49a;background:#271805e8;font-size:8px;font-weight:800;text-transform:uppercase;box-shadow:none}.arena-offline-indicator[hidden]{display:none!important}
      @media(max-width:520px){.arena-health-banner{align-items:flex-start;bottom:calc(var(--nav-h,78px) + 12px)}.arena-health-banner button:not(.arena-health-close){align-self:center}.arena-health-banner small{font-size:9px}}
    `;
    document.head.append(style);
  }

  function showBanner({ icon = 'IN', title, description, action = '', onAction = null }) {
    ensureStyles();
    q('#arenaHealthBanner')?.remove();
    const banner = document.createElement('aside');
    banner.id = 'arenaHealthBanner';
    banner.className = 'arena-health-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<span>${icon}</span><div><b>${title}</b><small>${description}</small></div>${action ? `<button type="button" data-arena-health-action>${action}</button>` : ''}<button type="button" class="arena-health-close" data-arena-health-close aria-label="Fechar">×</button>`;
    document.body.append(banner);
    banner.querySelector('[data-arena-health-close]')?.addEventListener('click', () => banner.remove());
    banner.querySelector('[data-arena-health-action]')?.addEventListener('click', () => onAction?.(banner));
    return banner;
  }

  function updateMetadata() {
    document.title = 'Arena BDA | Campeonatos do Clã';
    const description = q('meta[name="description"]');
    if (description) description.content = 'Campeonatos, clubes, resultados e notícias do Clã BDA.';
    const brand = q('.brand-copy strong');
    const subtitle = q('.brand-copy span');
    if (brand) brand.textContent = 'Arena BDA';
    if (subtitle && /protótipo|login protegido/i.test(subtitle.textContent)) subtitle.textContent = 'Campeonatos oficiais do Clã';
    document.documentElement.dataset.arenaVersion = VERSION;
    document.documentElement.dataset.arenaHealthOwnsServiceWorker = 'false';
  }

  function secureLegacyFallback() {
    if (window.firebase?.auth || !q('#adminPin')) return;
    const oldButton = q('#adminBtn');
    if (oldButton) {
      const safeButton = oldButton.cloneNode(true);
      oldButton.replaceWith(safeButton);
      safeButton.textContent = 'ENTRAR';
      safeButton.addEventListener('click', () => q('#adminModal')?.classList.add('show'));
    }
    const modal = q('#adminModal');
    if (modal) {
      modal.innerHTML = '<div class="modal"><h2>Acesso seguro indisponível</h2><p>O Firebase não carregou. Verifique sua conexão e tente novamente.</p><div class="form-actions"><button type="button" class="primary" data-safe-admin-close>Fechar</button></div></div>';
      q('[data-safe-admin-close]')?.addEventListener('click', () => modal.classList.remove('show'));
    }
  }

  function setupConnectivity() {
    ensureStyles();
    let indicator = q('#arenaOfflineIndicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = 'arenaOfflineIndicator';
      indicator.className = 'arena-offline-indicator';
      indicator.textContent = 'Modo offline';
      document.body.append(indicator);
    }
    const sync = () => {
      const wasOffline = !indicator.hidden;
      indicator.hidden = navigator.onLine;
      document.documentElement.classList.toggle('arena-is-offline', !navigator.onLine);
      if (navigator.onLine && wasOffline) notify('Conexão restabelecida');
    };
    indicator.hidden = navigator.onLine;
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
  }

  function setupErrorRecovery() {
    const record = error => {
      const text = String(error?.message || error || 'erro desconhecido');
      if (/ResizeObserver loop|AbortError|NetworkError|Load failed/i.test(text)) return;
      const now = Date.now();
      if (now - errorWindow > 10000) {
        errorWindow = now;
        errorCount = 0;
        signatures.clear();
      }
      const signature = text.slice(0, 180);
      if (signatures.has(signature)) return;
      signatures.add(signature);
      errorCount += 1;
      console.warn('Arena BDA capturou um erro de interface', error);
      if (errorCount >= 3 && !q('#arenaHealthBanner')) {
        showBanner({
          icon: 'ER',
          title: 'Alguma função não respondeu',
          description: 'Você pode continuar usando a Arena. Atualize manualmente apenas se algum botão permanecer sem resposta.'
        });
      }
    };
    window.addEventListener('error', event => record(event.error || event.message));
    window.addEventListener('unhandledrejection', event => record(event.reason));
  }

  updateMetadata();
  secureLegacyFallback();
  setupConnectivity();
  setupErrorRecovery();

  window.ArenaBDAHealth = Object.freeze({
    version: VERSION,
    ownsServiceWorker: false,
    refresh: () => location.reload(),
    clearAppCache: async () => {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => /^arena-bda-|^copa-grifo-/.test(key)).map(key => caches.delete(key)));
      }
    }
  });
})();
