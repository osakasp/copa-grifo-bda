(() => {
  'use strict';

  const TABLE_EXPORT_SRC = './exportar-tabela-copa-facil.js?v=20260726-2';
  const BUNDLES = Object.freeze({
    home: [
      './home-campeonato-atual-v2.js?v=20260816-4'
    ],
    champions: [
      './champion-banners.js?v=20260808-2',
      './ranking-campeoes.js?v=20260815-1'
    ],
    registrations: [
      './central-inscricoes.js'
    ],
    history: [
      './arena-editor-pro.js',
      './historia-cla.js?v=20260727-2',
      './galeria-historica-v2.js?v=20260816-3'
    ],
    season: [
      './temporada-bda.js?v=20260822-7'
    ],
    flash: [
      './copas-flash.js?v=20260803-2'
    ],
    feedback: [
      './feedback-bda.js?v=20260803-1'
    ],
    teams: [
      './perfis-clubes.js?v=20260816-2',
      './editor-perfis-times.js?v=20260726-2',
      './club-profile-router.js?v=20260726-2',
      './solicitacoes-edicao-times.js?v=20260726-1'
    ],
    news: [
      './noticias-bootstrap.js?v=20260727-1',
      './noticias-bda.js?v=20260816-4'
    ],
    tournament: [
      './cores-automaticas-campeonatos.js?v=20260802-2'
    ],
    tournamentDetail: [
      './confrontos-copa-grifo.js',
      './gestor-inteligente.js?v=20260816-5',
      './classificacao-automatica.js?v=20260822-7',
      './resultados-cards-pro.js?v=20260816-2',
      './placar-mobile-stability.js?v=20260803-1'
    ],
    tournamentEnhancements: [
      './logo-liga.js',
      './midia-campeonato-refresh.js?v=20260726-1',
      './copa-francos-design-lite.js?v=20260726-2',
      './captura-confrontos-simples.js?v=20260816-2',
      './match-center-bda.js?v=20260816-2',
      './regulamento-interativo.js?v=20260814-1'
    ],
    tournamentAdmin: [
      './sorteio-campeonatos.js?v=20260730-1',
      './arena-editor-pro.js',
      './gerador-grupos-ligas.js?v=20260816-2',
      './confronto-editor-v2.js?v=20260816-2'
    ]
  });
  const PAGE_BUNDLE = Object.freeze({
    home: 'home',
    champions: 'champions',
    history: 'history',
    season: 'season',
    flash: 'flash',
    news: 'news',
    registrations: 'registrations',
    teams: 'teams',
    tournament: 'tournament',
    feedback: 'feedback'
  });
  const ROUTES = Object.freeze({
    history: ['📜', 'História'],
    season: ['🗓️', 'Temporada'],
    flash: ['⚡', 'Copas Flash'],
    registrations: ['✍️', 'Inscrições'],
    news: ['📰', 'Notícias'],
    feedback: ['💬', 'Feedback']
  });
  const scriptPromises = new Map();
  const bundlePromises = new Map();
  const loadedBundles = new Set();
  const prefetched = new Set();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

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
        script.async = true;
        script.dataset.arenaLazyFeature = key;
        document.head.append(script);
      } else {
        window.setTimeout(() => {
          if (script.dataset.arenaLoaded === 'true') resolve(script);
        }, 0);
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
      for (let index = 0; index < sources.length; index += 1) {
        await loadScript(sources[index], `${name}:${sources[index]}`);
        if (index < sources.length - 1) await yieldToBrowser();
      }
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
    const page = trigger.dataset.go || trigger.dataset.mobileGo || trigger.dataset.sheetGo || '';
    return page === 'ranking' ? 'champions' : page;
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

  function yieldToBrowser() {
    return new Promise(resolve => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      window.setTimeout(finish, 120);
    });
  }

  function ensureRoutes() {
    const nav = document.querySelector('.bottom-nav');
    const main = document.querySelector('main');
    Object.entries(ROUTES).forEach(([page, meta]) => {
      if (main && !document.querySelector(`[data-page="${page}"]`)) {
        const section = document.createElement('section');
        section.className = 'page arena-lazy-page';
        section.dataset.page = page;
        section.innerHTML = `<div class="arena-section-loading"><span>${meta[0]}</span><b>${meta[1]}</b><small>O conteúdo será carregado ao abrir.</small></div>`;
        main.append(section);
      }
      if (nav && !nav.querySelector(`[data-go="${page}"]`)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nav-btn';
        button.dataset.go = page;
        button.innerHTML = `<i>${meta[0]}</i><span>${meta[1]}</span>`;
        nav.append(button);
      }
    });
  }

  async function loadPage(page, trigger = null) {
    const bundle = PAGE_BUNDLE[page];
    if (!bundle) {
      navigateTo(page);
      return;
    }
    setRouteLoading(trigger, true);
    navigateTo(page);
    try {
      await yieldToBrowser();
      await loadBundle(bundle);
    } catch (error) {
      const label = ROUTES[page]?.[1] || page;
      notify(`Não foi possível carregar ${label}`);
    } finally {
      setRouteLoading(trigger, false);
    }
  }

  function tournamentPageActive() {
    return document.querySelector('.page.active')?.dataset.page === 'tournament';
  }

  function adminActive() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.() || document.documentElement.classList.contains('arena-admin-authenticated'));
  }

  function scheduleTournamentAdmin() {
    if (!adminActive()) return;
    idle(() => {
      if (tournamentPageActive()) loadBundle('tournamentAdmin').catch(() => {});
    }, 1400);
  }

  function scheduleTournamentExtras() {
    idle(() => {
      if (!tournamentPageActive()) return;
      loadBundle('tournamentEnhancements')
        .then(scheduleTournamentAdmin)
        .catch(() => {});
    }, 900);
  }

  function scheduleTournamentDetail() {
    window.setTimeout(() => {
      if (!tournamentPageActive()) return;
      loadBundle('tournament')
        .then(() => yieldToBrowser())
        .then(() => loadBundle('tournamentDetail'))
        .then(scheduleTournamentExtras)
        .catch(() => notify('Não foi possível carregar os detalhes do campeonato'));
    }, 0);
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
    if (PAGE_BUNDLE[page] && !loadedBundles.has(PAGE_BUNDLE[page])) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      loadPage(page, trigger);
      return;
    }

    const tournamentTrigger = event.target instanceof Element ? event.target.closest('[data-open-tournament],[data-home-tournament]') : null;
    if (tournamentTrigger) {
      if (loadedBundles.has('tournamentDetail')) scheduleTournamentExtras();
      else scheduleTournamentDetail();
    }
  }, true);

  document.addEventListener('pointerover', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#standPhoto')) prefetchScript(TABLE_EXPORT_SRC);
    if (event.target.closest('[data-old-match-photo]')) window.ArenaBDAOldMatchPhoto?.preload?.().catch?.(() => {});
    const page = triggerPage(routeTrigger(event));
    const bundle = PAGE_BUNDLE[page];
    if (bundle) prefetchBundle(bundle);
    if (page === 'tournament' || event.target.closest('[data-open-tournament],[data-home-tournament]')) {
      prefetchBundle('tournament');
      prefetchBundle('tournamentDetail');
    }
  }, { passive: true, capture: true });

  document.addEventListener('focusin', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#standPhoto')) prefetchScript(TABLE_EXPORT_SRC);
    const page = triggerPage(routeTrigger(event));
    const bundle = PAGE_BUNDLE[page];
    if (bundle) prefetchBundle(bundle);
  });

  function idle(callback, timeout = 2500) {
    if ('requestIdleCallback' in window) requestIdleCallback(callback, { timeout });
    else window.setTimeout(callback, timeout);
  }

  function initialRoute() {
    const params = new URLSearchParams(location.search);
    if (params.has('news')) {
      loadBundle('news').then(() => navigateTo('news')).catch(() => {});
      return;
    }
    const active = document.querySelector('.page.active')?.dataset.page;
    if (active && PAGE_BUNDLE[active]) loadBundle(PAGE_BUNDLE[active]).catch(() => {});
  }

  function backgroundWarmup() {
    idle(() => {
      const constrained = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
      if (!constrained && document.querySelector('.page.active')?.dataset.page === 'home') prefetchBundle('tournament');
    }, 1800);
  }

  const style = document.createElement('style');
  style.id = 'arenaLazyFeatureStyles';
  style.textContent = `
    .arena-route-loading{position:relative;opacity:.68!important;cursor:wait!important}
    .arena-route-loading:after{content:"";position:absolute;right:9px;top:9px;width:10px;height:10px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:arenaLazySpin .7s linear infinite}
    .arena-section-loading{display:grid;place-items:center;gap:6px;min-height:240px;padding:28px;color:var(--muted);text-align:center}.arena-section-loading>span{font-size:38px}.arena-section-loading>b{color:var(--text);font-size:13px}.arena-section-loading>small{font-size:9px}
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

  ensureRoutes();
  window.addEventListener('arena:permissions-updated', event => {
    if (event.detail?.isAdmin && tournamentPageActive() && loadedBundles.has('tournamentDetail')) scheduleTournamentAdmin();
  });
  initialRoute();
  backgroundWarmup();
})();
