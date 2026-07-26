(() => {
  'use strict';

  const TABLE_EXPORT_SRC = './exportar-tabela-copa-facil.js?v=20260726-2';
  const scripts = new Map();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function loadScript(key, source, ready) {
    if (ready()) return Promise.resolve();
    if (scripts.has(key)) return scripts.get(key);

    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src.includes(source.split('?')[0].replace('./', '')));
      const finish = () => ready() ? resolve() : reject(new Error(`O recurso ${key} não iniciou`));

      if (existing) {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', reject, { once: true });
        setTimeout(() => ready() && resolve(), 0);
        return;
      }

      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.dataset.arenaLazyFeature = key;
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error(`Falha ao carregar ${key}`)), { once: true });
      document.head.append(script);
    }).catch(error => {
      scripts.delete(key);
      throw error;
    });

    scripts.set(key, promise);
    return promise;
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.dataset.lazyOriginalText = button.textContent;
      button.disabled = true;
      button.textContent = '⏳ Preparando editor...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.lazyOriginalText || '⇩ Exportar tabela';
      delete button.dataset.lazyOriginalText;
    }
  }

  async function openTableExporter(button) {
    if (button?.dataset.lazyLoading === 'true') return;
    if (button) button.dataset.lazyLoading = 'true';
    setButtonLoading(button, true);

    try {
      await loadScript('table-export', TABLE_EXPORT_SRC, () => Boolean(window.ArenaBDATableExporter?.open));
      window.ArenaBDATableExporter.open();
    } catch (error) {
      console.error(error);
      const capture = document.querySelector('#standCapture') || document.querySelector('#autoStandings');
      if (capture && window.ArenaBDACapture?.element) {
        window.ArenaBDACapture.element(capture, 'Classificação automática', 'classificacao-arena-bda');
      } else {
        notify('Não foi possível abrir o editor da tabela');
      }
    } finally {
      if (button) button.dataset.lazyLoading = 'false';
      setButtonLoading(button, false);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#standPhoto');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openTableExporter(button);
  }, true);

  document.addEventListener('pointerover', event => {
    if (event.target.closest('#standPhoto')) {
      loadScript('table-export', TABLE_EXPORT_SRC, () => Boolean(window.ArenaBDATableExporter?.open)).catch(() => {});
    }
    if (event.target.closest('[data-old-match-photo]')) {
      window.ArenaBDAOldMatchPhoto?.preload?.().catch?.(() => {});
    }
  }, { passive: true });

  document.addEventListener('focusin', event => {
    if (event.target.closest('#standPhoto')) {
      loadScript('table-export', TABLE_EXPORT_SRC, () => Boolean(window.ArenaBDATableExporter?.open)).catch(() => {});
    }
  });

  window.ArenaBDALazyFeatures = {
    preloadTable: () => loadScript('table-export', TABLE_EXPORT_SRC, () => Boolean(window.ArenaBDATableExporter?.open))
  };
})();