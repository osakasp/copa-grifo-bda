(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const SUPER_LEAGUE_ID = 'bda-super-league';
  const PROTECTION_VERSION = 2;
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
      'Zombie BDA',
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
    {id:'supercopa',name:'Supercopa BDA',edition:'Nova edição',format:'Grupos + mata-mata',status:'Inscrições abertas',phase:'Preparação',maxTeams:25,badge:'🏆',participants:['Esperança BDA','Boca Juniors','HELLYEAH BDA','SPORT RECIFE BDA','NACIONAL AC BDA','SANTOS RB BDA','BDA URDLS','CV CRUZ BDA','INDEPENDENTE FC APOSENTADO BDA','FLAMESTRE FC DF BDA','IMORTAIS FC BDA','BDA GOLDEN','Zombie FC BDA','JOGOBUGADO BDA','Vasco da Gama BDA','São Paulo BDA'],deadline:'24h por rodada',description:'Campeonato oficial do Clã BDA.'},
    {id:'liga-a',name:'Liga A BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Inter Brasil BDA',maxTeams:20,badge:'🥇',participants:['Inter Brasil BDA'],description:'A divisão de elite do Clã BDA.'},
    {id:'liga-b',name:'Liga B BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Vasco da Gama BDA',maxTeams:20,badge:'🛡️',participants:['Vasco da Gama BDA'],description:'A divisão de acesso para a Liga A BDA.'}
  ]);

  const clone = value => JSON.parse(JSON.stringify(value));

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
      return Array.isArray(stored) && stored.length ? stored : clone(DEFAULT_TOURNAMENTS);
    } catch {
      return clone(DEFAULT_TOURNAMENTS);
    }
  }

  function protectSuperLeague() {
    const tournaments = readTournaments();
    const index = tournaments.findIndex(item => String(item?.id || '').toLowerCase() === SUPER_LEAGUE_ID);

    // A proteção agora garante apenas que a competição exista. Se a Super League
    // já veio da nuvem, não reescrevemos seus campos durante o boot. Isso evita
    // que o guard e o Firestore fiquem alternando versões do mesmo campeonato e
    // provoquem reload em ciclo logo após o login.
    if (index >= 0) return clone(tournaments[index]);

    const next = clone(tournaments);
    next.push(canonicalTournament());

    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível proteger a BDA Super League', error);
    }

    return clone(next[next.length - 1]);
  }

  function ensureCommunityRemovalStyle() {
    if (document.getElementById('arenaNoCommunityStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaNoCommunityStyles';
    style.textContent = `
      ${COMMUNITY_SELECTORS}{display:none!important}
      #adminModal .member-auth-tabs{display:none!important}
    `;
    document.head.append(style);
  }

  function removeCommunityUI() {
    ensureCommunityRemovalStyle();
    const communityWasActive = Boolean(document.querySelector('.page.active[data-page="community"]'));
    document.querySelectorAll(COMMUNITY_SELECTORS).forEach(node => node.remove());

    document.querySelectorAll('.bottom-nav,.arena-mobile-nav').forEach(nav => {
      const visibleButtons = [...nav.querySelectorAll('button')].filter(button => !button.hidden && button.isConnected);
      if (visibleButtons.length > 0) nav.style.gridTemplateColumns = `repeat(${visibleButtons.length},minmax(0,1fr))`;
    });

    if (communityWasActive) {
      document.querySelectorAll('.page.active').forEach(page => page.classList.remove('active'));
      const home = document.querySelector('[data-page="home"]');
      home?.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(button => {
        const homeButton = button.dataset.go === 'home';
        button.classList.toggle('active', homeButton);
        if (homeButton) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
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
    if (tabs && tabs.style.display !== 'none') tabs.style.display = 'none';

    setText('#adminModal .member-auth-brand .eyebrow', 'Gestão da Arena BDA');
    setText('#adminModalTitle', 'Acesso administrativo');
    setText('#memberAuthDescription', 'Entre para gerenciar campeonatos, times e placares.');
    setText('#adminResetBtn', 'Esqueci minha senha');
    setText('#adminModal .member-auth-note', 'Acesso restrito à administração da Arena BDA.');
    setText('.brand-copy span', 'Arena competitiva • Campeonatos do Clã');

    const adminButton = document.getElementById('adminBtn');
    adminButton?.setAttribute('aria-label', 'Acesso administrativo');
  }

  let cleanupFrame = 0;
  function scheduleCleanup() {
    if (cleanupFrame) return;
    cleanupFrame = requestAnimationFrame(() => {
      cleanupFrame = 0;
      removeCommunityUI();
      makeAuthAdminOnly();
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const communityTrigger = target.closest('[data-go="community"],[data-mobile-go="community"],[data-sheet-go="community"]');
    if (communityTrigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof window.navigate === 'function') window.navigate('home');
      return;
    }

    const adminButton = target.closest('#adminBtn');
    if (!adminButton || !window.ArenaBDAAuth?.isAdmin?.()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof window.navigate === 'function') window.navigate('tournament');
  }, true);

  window.addEventListener('arena:cloud-ready', scheduleCleanup);
  window.addEventListener('arena:auth-changed', scheduleCleanup);
  window.addEventListener('arena:bundle-loaded', scheduleCleanup);
  window.addEventListener('arena:matches-updated', scheduleCleanup);

  if (document.documentElement) {
    new MutationObserver(scheduleCleanup).observe(document.documentElement, { childList: true, subtree: true });
  }

  const protectedTournament = protectSuperLeague();
  scheduleCleanup();

  window.ArenaBDASuperLeagueGuard = Object.freeze({
    version: PROTECTION_VERSION,
    id: SUPER_LEAGUE_ID,
    groups: GROUPS,
    participants: PARTICIPANTS,
    protect: protectSuperLeague,
    canonicalize: current => clone(canonicalTournament(current)),
    tournament: () => clone(protectedTournament || canonicalTournament())
  });
})();
