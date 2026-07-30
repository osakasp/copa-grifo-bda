(() => {
  'use strict';

  const TABLE_EXPORT_SRC = './exportar-tabela-copa-facil.js?v=20260729-1';
  const BUNDLES = Object.freeze({
    history: [
      './historia-cla.js?v=20260727-2',
      './galeria-historica-v2.js?v=20260727-2'
    ],
    teams: [
      './profile-observer-scope.js?v=20260726-1',
      './perfis-clubes.js?v=20260726-2',
      './editor-perfis-times.js?v=20260726-2',
      './club-profile-router.js?v=20260726-2',
      './solicitacoes-edicao-times.js?v=20260726-1',
      './profile-observer-scope-end.js?v=20260726-1'
    ],
    news: [
      './noticias-bootstrap.js?v=20260727-1',
      './noticias-bda.js?v=20260727-2',
      './noticias-nav-fix.js?v=20260729-1'
    ],
    tournament: [
      './confrontos-copa-grifo.js?v=20260729-1',
      './sorteio-campeonatos.js?v=20260729-1',
      './arena-editor-pro.js?v=20260729-1',
      './classificacao-automatica.js?v=20260729-1',
      './gerador-grupos-ligas.js?v=20260729-1',
      './logo-liga.js?v=20260729-1',
      './cores-automaticas-campeonatos.js?v=20260729-1',
      './midia-campeonato-refresh.js?v=20260729-1',
      './arena-auth-consumers.js?v=20260729-1',
      './copa-francos-design-lite.js?v=20260729-1',
      './confronto-editor-v2.js?v=20260729-1',
      './resultados-cards-pro.js?v=20260729-1',
      './placar-mobile-stability.js?v=20260729-1',
      './captura-confrontos-simples.js?v=20260729-1',
      './match-center-bda.js?v=20260727-1',
      './regulamento-interativo.js?v=20260727-1'
    ]
  });
  const PAGE_BUNDLE = Object.freeze({ history: 'history', teams: 'teams', news: 'news', tournament: 'tournament' });
  const scriptPromises = new Map();
  const bundlePromises = new Map();
  const loadedBundles = new Set();
  const prefetched = new Set();
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function constrainedConnection() {
    return Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''));
  }
  function absolute(source) {
    try { return new URL(source, document.baseURI).href; }
    catch { return source; }
  }
  function existingScript(source) {
    const expected = absolute(source).split('?')[0];
    return [...document.scripts].find(script => String(script.src || '').split('?')[0] === expected);
  }
  function loadScript(source, key = source) {
    const url = absolute(source);
    if (scriptPromises.has(url)) return scriptPromises.get(url);
    const promise = new Promise((resolve, reject) => {
      const existing = existingScript(source);
      if (existing?.dataset.arenaLoaded === 'true' || existing?.readyState === 'complete') {
        resolve(existing);
        return;
      }
      const script = existing || document.createElement('script');
      const done = () => {
        script.dataset.arenaLoaded = 'true';
        resolve(script);
      };
      const fail = () => reject(new Error(`Falha ao carregar ${key}`));
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', fail, { once: true });
      if (!existing) {
        script.src = source;
        script.async = false;
        script.dataset.arenaLazyFeature = key;
        document.head.append(script);
      }
    }).catch(error => {
      scriptPromises.delete(url);
      throw error;
    });
    scriptPromises.set(url, promise);
    return promise;
  }
  async function loadBundle(name) {
    if (loadedBundles.has(name)) return;
    if (bundlePromises.has(name)) return bundlePromises.get(name);
    const sources = BUNDLES[name];
    if (!sources) return;
    const promise = (async () => {
      document.documentElement.dataset.loadingBundle = name;
      sources.forEach(prefetchScript);
      for (const source of sources) await loadScript(source, `${name}:${source}`);
      loadedBundles.add(name);
      window.dispatchEvent(new CustomEvent('arena:bundle-loaded', { detail: { name, sources: [...sources] } }));
    })().finally(() => {
      if (document.documentElement.dataset.loadingBundle === name) delete document.documentElement.dataset.loadingBundle;
    }).catch(error => {
      bundlePromises.delete(name);
      console.error(error);
      throw error;
    });
    bundlePromises.set(name, promise);
    return promise;
  }
  function prefetchScript(source) {
    if (constrainedConnection()) return;
    const url = absolute(source);
    if (prefetched.has(url) || existingScript(source)) return;
    prefetched.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = source;
    link.dataset.arenaPrefetch = 'true';
    document.head.append(link);
  }
  function prefetchBundle(name) {
    (BUNDLES[name] || []).forEach(prefetchScript);
  }
  function triggerPage(trigger) {
    if (!trigger) return '';
    if (trigger.id === 'newsTopShortcut') return 'news';
    return trigger.dataset.go || trigger.dataset.mobileGo || trigger.dataset.sheetGo || '';
  }
  function routeTrigger(event) {
    if (!(event.target instanceof Element)) return null;
    return event.target.closest('[data-go],[data-mobile-go],[data-sheet-go],#newsTopShortcut');
  }
  function setRouteLoading(trigger, loading) {
    if (!trigger) return;
    if (loading) {
      if (!trigger.dataset.arenaOriginalHtml) trigger.dataset.arenaOriginalHtml = trigger.innerHTML;
      trigger.classList.add('arena-route-loading');
      trigger.setAttribute('aria-busy', 'true');
      trigger.disabled = true;
    } else {
      trigger.classList.remove('arena-route-loading');
      trigger.removeAttribute('aria-busy');
      trigger.disabled = false;
      if (trigger.dataset.arenaOriginalHtml) {
        trigger.innerHTML = trigger.dataset.arenaOriginalHtml;
        delete trigger.dataset.arenaOriginalHtml;
      }
    }
  }
  function navigateTo(page) {
    document.body.classList.remove('arena-sheet-open');
    document.querySelector('.arena-nav-sheet-backdrop')?.classList.remove('show');
    if (typeof navigate === 'function') navigate(page);
    else {
      document.querySelectorAll('.page').forEach(item => item.classList.toggle('active', item.dataset.page === page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.ArenaBDAMotion?.refresh?.();
  }
  async function loadPage(page, trigger = null) {
    const bundle = PAGE_BUNDLE[page];
    if (!bundle) {
      navigateTo(page);
      return;
    }
    setRouteLoading(trigger, true);
    try {
      await loadBundle(bundle);
      navigateTo(page);
    } catch (error) {
      notify(`Não foi possível carregar ${page === 'news' ? 'as Notícias' : page === 'teams' ? 'os perfis dos clubes' : page === 'history' ? 'a História' : 'os recursos do campeonato'}`);
    } finally {
      setRouteLoading(trigger, false);
    }
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
      await loadScript(TABLE_EXPORT_SRC, 'table-export');
      if (!window.ArenaBDATableExporter?.open) throw new Error('O editor da tabela não iniciou');
      window.ArenaBDATableExporter.open();
    } catch (error) {
      console.error(error);
      const capture = document.querySelector('#standCapture') || document.querySelector('#autoStandings');
      if (capture && window.ArenaBDACapture?.element) window.ArenaBDACapture.element(capture, 'Classificação automática', 'classificacao-arena-bda');
      else notify('Não foi possível abrir o editor da tabela');
    } finally {
      if (button) button.dataset.lazyLoading = 'false';
      setButtonLoading(button, false);
    }
  }

  document.addEventListener('click', event => {
    const tableButton = event.target instanceof Element ? event.target.closest('#standPhoto') : null;
    if (tableButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openTableExporter(tableButton);
      return;
    }
    const trigger = routeTrigger(event);
    const page = triggerPage(trigger);
    const bundle = PAGE_BUNDLE[page];
    if (bundle && !loadedBundles.has(bundle)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      loadPage(page, trigger);
    }
  }, true);

  document.addEventListener('pointerover', event => {
    if (!(event.target instanceof Element) || constrainedConnection()) return;
    if (event.target.closest('#standPhoto')) prefetchScript(TABLE_EXPORT_SRC);
    const page = triggerPage(routeTrigger(event));
    const bundle = PAGE_BUNDLE[page];
    if (bundle) prefetchBundle(bundle);
  }, { passive: true, capture: true });

  document.addEventListener('focusin', event => {
    if (!(event.target instanceof Element) || constrainedConnection()) return;
    if (event.target.closest('#standPhoto')) prefetchScript(TABLE_EXPORT_SRC);
    const page = triggerPage(routeTrigger(event));
    const bundle = PAGE_BUNDLE[page];
    if (bundle) prefetchBundle(bundle);
  });

  const active = document.querySelector('.page.active')?.dataset.page;
  if (active && PAGE_BUNDLE[active]) loadBundle(PAGE_BUNDLE[active]).catch(() => {});

  const style = document.createElement('style');
  style.id = 'arenaLazyFeatureStyles';
  style.textContent = `
    .arena-route-loading{position:relative;opacity:.68!important;cursor:wait!important}
    .arena-route-loading:after{content:"";position:absolute;right:9px;top:9px;width:10px;height:10px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:arenaLazySpin .7s linear infinite}
    @keyframes arenaLazySpin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.arena-route-loading:after{animation:none}}
  `;
  document.head.append(style);

  window.ArenaBDALazyFeatures = Object.freeze({
    loadBundle,
    loadPage,
    preloadBundle: prefetchBundle,
    preloadTable: () => loadScript(TABLE_EXPORT_SRC, 'table-export'),
    loaded: name => loadedBundles.has(name),
    state: () => ({ loaded: [...loadedBundles], loading: [...bundlePromises.keys()], prefetched: prefetched.size })
  });
})();
