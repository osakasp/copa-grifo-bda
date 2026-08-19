(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const SUPER_LEAGUE_ID = 'bda-super-league';
  const PROTECTION_VERSION = 5;
  const COMMUNITY_SELECTORS = '[data-page="community"],[data-go="community"],[data-mobile-go="community"],[data-sheet-go="community"]';

  const GROUPS = Object.freeze([
    Object.freeze({ name: 'Grupo A', teams: Object.freeze([
      'CV Cruz BDA',
      'Hellyeah BDA',
      'Imortais FC BDA',
      'BDA Golden FC',
      'CR Flamengo',
      'Vera Cruz Do Oeste PR BDA'
    ]) }),
    Object.freeze({ name: 'Grupo B', teams: Object.freeze([
      'Zombie FC BDA',
      'Sport Recife BDA',
      'São Paulo BDA',
      'Nacional AC BDA',
      'Imperial São Paulo BDA'
    ]) }),
    Object.freeze({ name: 'Grupo C', teams: Object.freeze([
      'Red Bull BDA',
      'Independente FC BDA',
      'Vasco Da Gama BDA',
      'Esperança BDA',
      'Florence Real BDA'
    ]) }),
    Object.freeze({ name: 'Grupo D', teams: Object.freeze([
      'Boca Juniors',
      'Praia Grande Jogobugado BDA',
      'Flamestre BDA',
      'BDA URDLS',
      'Isaías 55-6-7'
    ]) })
  ]);

  const PARTICIPANTS = Object.freeze(GROUPS.flatMap(group => [...group.teams]));

  const DEFAULT_TOURNAMENTS = Object.freeze([
    {id:'copa-grifo',name:'Copa Grifo BDA',edition:'8ª edição',format:'Mata-mata',status:'Finalizado',phase:'Campeão definido',maxTeams:19,badge:'🦅',participants:['Zombie FC BDA','JOGOBUGADO BDA','Inter Brasil BDA','Vasco da Gama BDA'],description:'Competição tradicional do Clã BDA em formato eliminatório e jogo único.',legacy:true,locked:true},
    {id:'copa-francos',name:'Copa Francos',edition:'Próxima edição',format:'Mata-mata',status:'Planejado',phase:'Preparação',maxTeams:16,badge:'🕊️',participants:[],description:'Competição especial em homenagem à história do Francos FC BDA.'},
    {id:'liga-a',name:'Liga A BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Inter Brasil BDA',maxTeams:20,badge:'🥇',participants:['Inter Brasil BDA'],description:'A divisão de elite do Clã BDA.'},
    {id:'liga-b',name:'Liga B BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Vasco da Gama BDA',maxTeams:20,badge:'🛡️',participants:['Vasco da Gama BDA'],description:'A divisão de acesso para a Liga A BDA.'}
  ]);

  const clone = value => JSON.parse(JSON.stringify(value));
  const nativeStorageSetItem = Storage.prototype.setItem;

  function normalizeToken(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function isSupercopa(item) {
    const id = String(item?.id || '').toLowerCase();
    const name = normalizeToken(item?.name || item?.textContent || '');
    return id === 'supercopa' || id.startsWith('super-copa-bda-') || name.includes('supercopabda');
  }

  function withoutSupercopa(values) {
    return Array.isArray(values) ? values.filter(item => !isSupercopa(item)) : [];
  }

  function installSupercopaRemovalGuard() {
    if (Storage.prototype.setItem.__arenaNoSupercopa) return;

    const guardedSetItem = function(key, value) {
      let nextValue = value;
      if (this === localStorage && key === TOURNAMENT_KEY) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) nextValue = JSON.stringify(withoutSupercopa(parsed));
        } catch {}
      }
      return nativeStorageSetItem.call(this, key, nextValue);
    };

    Object.defineProperty(guardedSetItem, '__arenaNoSupercopa', { value: true });
    Storage.prototype.setItem = guardedSetItem;
  }

  function removeSupercopaFromStorage() {
    try {
      const raw = localStorage.getItem(TOURNAMENT_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return false;
      const cleaned = withoutSupercopa(parsed);
      if (cleaned.length === parsed.length) return false;
      nativeStorageSetItem.call(localStorage, TOURNAMENT_KEY, JSON.stringify(cleaned));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { reason: 'supercopa-removed', count: cleaned.length }
      }));
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível remover a Supercopa do armazenamento', error);
      return false;
    }
  }

  function canonicalTournament(current = {}) {
    return {
      ...current,
      id: SUPER_LEAGUE_ID,
      name: 'BDA Super League',
      edition: current.edition || 'Temporada atual',
      format: 'Grupos + mata-mata',
      status: current.status || 'Em andamento',
      phase: current.phase || 'Fase de grupos',
      maxTeams: 21,
      badge: '⚜️',
      participants: [...PARTICIPANTS],
      deadline: current.deadline || 'Conforme organização BDA',
      description: current.description || 'Full Razz • 21 clubes • 2 classificados por grupo. Campeão: R$ 20 • Vice: R$ 10.',
      qualifiersPerGroup: 2,
      rankingMode: 'efficiency',
      rankingTieBreakers: ['goalDifference', 'goalsFor'],
      superLeagueSetupVersion: Math.max(Number(current.superLeagueSetupVersion || 0), 1),
      superLeagueProtectionVersion: PROTECTION_VERSION,
      groupSettings: {
        ...(current.groupSettings || {}),
        qualifiersPerGroup: 2,
        rankingMode: 'efficiency',
        tieBreakers: ['goalDifference', 'goalsFor'],
        groups: GROUPS.map(group => ({ name: group.name, teams: [...group.teams] }))
      },
      groupGenerator: {
        ...(current.groupGenerator || {}),
        mode: 'groups',
        groupCount: 4,
        qualifiers: 2,
        legs: 1,
        distribution: current.groupGenerator?.distribution || 'serpentine',
        groups: GROUPS.map(group => ({ name: group.name, teams: [...group.teams] })),
        knockoutGenerated: true
      }
    };
  }

  function readTournaments() {
    try {
      const stored = JSON.parse(localStorage.getItem(TOURNAMENT_KEY));
      const cleaned = withoutSupercopa(stored);
      return cleaned.length ? cleaned : clone(DEFAULT_TOURNAMENTS);
    } catch {
      return clone(DEFAULT_TOURNAMENTS);
    }
  }

  function protectSuperLeague() {
    const tournaments = readTournaments();
    const index = tournaments.findIndex(item => String(item?.id || '').toLowerCase() === SUPER_LEAGUE_ID);

    if (index >= 0) {
      const current = tournaments[index] || {};
      const canonical = canonicalTournament(current);
      const currentGroups = current?.groupSettings?.groups || current?.groupGenerator?.groups || [];
      const hasOldZombieName = (current.participants || []).some(name => normalizeToken(name) === 'zombiebda')
        || currentGroups.some(group => (group?.teams || []).some(name => normalizeToken(name) === 'zombiebda'));
      const needsMigration = Number(current.superLeagueProtectionVersion || 0) < PROTECTION_VERSION || hasOldZombieName;

      if (!needsMigration) return clone(current);

      const next = clone(tournaments);
      next[index] = canonical;
      try {
        localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
          detail: { reason: 'super-league-canonical-name-migration', tournamentId: SUPER_LEAGUE_ID }
        }));
      } catch (error) {
        console.warn('[Arena BDA] Não foi possível atualizar o nome oficial do Zombie FC BDA', error);
      }
      return clone(canonical);
    }

    const next = clone(tournaments);
    next.push(canonicalTournament());

    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível proteger a BDA Super League', error);
    }

    return clone(next[next.length - 1]);
  }

  function ensureRemovalStyles() {
    if (document.getElementById('arenaNoCommunityStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaNoCommunityStyles';
    style.textContent = `
      ${COMMUNITY_SELECTORS},
      [data-featured="supercopa"]{display:none!important}
      #adminModal .member-auth-tabs,
      #adminModal [data-auth-mode="register"],
      #memberNameLabel,
      #memberConfirmLabel{display:none!important}
    `;
    document.head.append(style);
  }

  function removeCommunityUI() {
    ensureRemovalStyles();
    const communityWasActive = Boolean(document.querySelector('.page.active[data-page="community"]'));
    document.querySelectorAll(COMMUNITY_SELECTORS).forEach(node => node.remove());

    document.querySelectorAll('.bottom-nav,.arena-mobile-nav').forEach(nav => {
      const visibleButtons = [...nav.querySelectorAll('button')].filter(button => !button.hidden && button.isConnected);
      if (visibleButtons.length > 0) nav.style.gridTemplateColumns = `repeat(${visibleButtons.length},minmax(0,1fr))`;
    });

    if (communityWasActive) {
      document.querySelectorAll('.page.active').forEach(page => page.classList.remove('active'));
      document.querySelector('[data-page="home"]')?.classList.add('active');
    }
  }

  let redirectingSupercopa = false;
  function removeSupercopaUI() {
    document.querySelectorAll('[data-featured="supercopa"]').forEach(node => node.remove());

    document.querySelectorAll('[data-open-tournament],[data-home-tournament],[data-tournament-id]').forEach(node => {
      const id = node.dataset.openTournament || node.dataset.homeTournament || node.dataset.tournamentId || '';
      if (!isSupercopa({ id, name: node.textContent })) return;
      const card = node.closest('.arena-card,.arena-home-card,[data-tournament-card],article');
      if (card) card.remove();
      else node.remove();
    });

    const detail = document.getElementById('arenaDetail');
    const title = detail?.querySelector('h1,h2,h3');
    if (!title || !isSupercopa({ name: title.textContent })) return;

    const fallback = [...document.querySelectorAll('[data-open-tournament]')]
      .find(node => !isSupercopa({
        id: node.dataset.openTournament,
        name: node.textContent
      }));

    if (fallback && !redirectingSupercopa) {
      redirectingSupercopa = true;
      setTimeout(() => {
        try { fallback.click(); }
        finally { redirectingSupercopa = false; }
      }, 0);
    } else {
      detail.innerHTML = '';
    }
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function makeAuthAdminOnly() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    const tabs = modal.querySelector('.member-auth-tabs');
    if (tabs) {
      tabs.hidden = true;
      tabs.setAttribute('aria-hidden', 'true');
      tabs.style.display = 'none';
    }

    const memberNameLabel = document.getElementById('memberNameLabel');
    const memberConfirmLabel = document.getElementById('memberConfirmLabel');
    const memberName = document.getElementById('memberName');
    const memberConfirm = document.getElementById('memberConfirmPassword');
    if (memberNameLabel) memberNameLabel.hidden = true;
    if (memberConfirmLabel) memberConfirmLabel.hidden = true;
    if (memberName) memberName.required = false;
    if (memberConfirm) memberConfirm.required = false;

    setText('#adminModal .member-auth-brand .eyebrow', 'Gestão da Arena BDA');
    setText('#adminModalTitle', 'Acesso administrativo');
    setText('#memberAuthDescription', 'Entre para gerenciar campeonatos, times e placares.');
    setText('#adminResetBtn', 'Esqueci minha senha');
    setText('#adminModal .member-auth-note', 'Acesso restrito à administração da Arena BDA.');
    setText('.brand-copy span', 'Arena competitiva • Campeonatos do Clã');

    const adminButton = document.getElementById('adminBtn');
    if (adminButton) {
      adminButton.setAttribute('aria-label', 'Acesso administrativo');
      adminButton.title = 'Acesso administrativo';
    }

    const logoutButton = document.getElementById('memberLogoutBtn');
    if (logoutButton) logoutButton.setAttribute('aria-label', 'Sair da administração');
  }

  function protectNavigation() {
    const current = window.navigate;
    if (typeof current !== 'function' || current.__arenaNoCommunity) return;

    const wrapped = function(page, ...args) {
      const destination = page === 'community' ? 'home' : page;
      return current.call(this, destination, ...args);
    };
    Object.defineProperty(wrapped, '__arenaNoCommunity', { value: true });
    window.navigate = wrapped;
  }

  function loadProMotion() {
    if (window.ArenaBDAProMotion || document.querySelector('script[data-arena-pro-motion]')) return;
    const script = document.createElement('script');
    script.src = './arena-pro-motion.js?v=20260818-1';
    script.async = true;
    script.dataset.arenaProMotion = 'true';
    script.addEventListener('error', () => console.warn('[Arena BDA] Não foi possível carregar o visual premium'), { once: true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  function loadSuperLeagueRuntimeFix() {
    if (window.ArenaBDASuperLeagueRuntimeFix || document.querySelector('script[data-super-league-runtime-fix]')) return;
    const script = document.createElement('script');
    script.src = './super-league-runtime-fix.js?v=20260818-1';
    script.async = true;
    script.dataset.superLeagueRuntimeFix = 'true';
    script.addEventListener('error', () => console.warn('[Arena BDA] Não foi possível carregar a correção da Super League'), { once: true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  let cleanupFrame = 0;
  function scheduleCleanup() {
    if (cleanupFrame) return;
    cleanupFrame = requestAnimationFrame(() => {
      cleanupFrame = 0;
      removeSupercopaFromStorage();
      protectNavigation();
      removeCommunityUI();
      removeSupercopaUI();
      makeAuthAdminOnly();
    });
  }

  let rejectingNonAdmin = false;
  async function rejectNonAdminAccount(state) {
    if (!state?.isAuthenticated || state.isAdmin || rejectingNonAdmin) return;
    rejectingNonAdmin = true;
    try {
      await window.ArenaBDAAuth?.signOut?.();
      if (typeof window.toast === 'function') window.toast('Acesso restrito aos administradores');
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível encerrar uma conta sem acesso administrativo', error);
    } finally {
      rejectingNonAdmin = false;
      scheduleCleanup();
    }
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const communityTrigger = target.closest('[data-go="community"],[data-mobile-go="community"],[data-sheet-go="community"]');
    if (communityTrigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.navigate?.('home');
      return;
    }

    const tournamentTrigger = target.closest('[data-open-tournament],[data-home-tournament],[data-tournament-id]');
    if (tournamentTrigger) {
      const id = tournamentTrigger.dataset.openTournament || tournamentTrigger.dataset.homeTournament || tournamentTrigger.dataset.tournamentId || '';
      if (isSupercopa({ id, name: tournamentTrigger.textContent })) {
        event.preventDefault();
        event.stopImmediatePropagation();
        removeSupercopaUI();
        return;
      }
    }

    const adminButton = target.closest('#adminBtn');
    if (!adminButton) return;

    if (window.ArenaBDAAuth?.isAdmin?.()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.navigate?.('tournament');
      return;
    }

    if (window.ArenaBDAAuthUI?.open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.ArenaBDAAuthUI.open('login');
      makeAuthAdminOnly();
      queueMicrotask(makeAuthAdminOnly);
      setTimeout(makeAuthAdminOnly, 0);
    }
  }, true);

  window.addEventListener('arena:cloud-ready', () => {
    removeSupercopaFromStorage();
    protectSuperLeague();
    makeAuthAdminOnly();
    scheduleCleanup();
    setTimeout(scheduleCleanup, 0);
    setTimeout(scheduleCleanup, 120);
  });

  window.addEventListener('arena:auth-changed', event => {
    scheduleCleanup();
    rejectNonAdminAccount(event.detail);
  });

  window.addEventListener('arena:bundle-loaded', scheduleCleanup);
  window.addEventListener('arena:matches-updated', scheduleCleanup);
  window.addEventListener('arena:tournaments-updated', scheduleCleanup);

  if (document.documentElement) {
    new MutationObserver(scheduleCleanup).observe(document.documentElement, { childList: true, subtree: true });
  }

  installSupercopaRemovalGuard();
  removeSupercopaFromStorage();
  const protectedTournament = protectSuperLeague();
  protectNavigation();
  loadSuperLeagueRuntimeFix();
  loadProMotion();
  scheduleCleanup();

  window.ArenaBDASuperLeagueGuard = Object.freeze({
    version: PROTECTION_VERSION,
    id: SUPER_LEAGUE_ID,
    groups: GROUPS,
    participants: PARTICIPANTS,
    protect: protectSuperLeague,
    removeSupercopa: removeSupercopaFromStorage,
    canonicalize: current => clone(canonicalTournament(current)),
    tournament: () => clone(protectedTournament || canonicalTournament())
  });
})();