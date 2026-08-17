(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const SUPER_LEAGUE_ID = 'bda-super-league';
  const PROTECTION_VERSION = 1;

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
    const next = clone(tournaments);

    if (index < 0) next.unshift(canonicalTournament());
    else next[index] = canonicalTournament(next[index]);

    try {
      const before = JSON.stringify(tournaments);
      const after = JSON.stringify(next);
      if (before !== after) localStorage.setItem(TOURNAMENT_KEY, after);
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível proteger a BDA Super League', error);
    }

    return next.find(item => String(item?.id || '').toLowerCase() === SUPER_LEAGUE_ID) || null;
  }

  const protectedTournament = protectSuperLeague();
  window.ArenaBDASuperLeagueGuard = Object.freeze({
    version: PROTECTION_VERSION,
    id: SUPER_LEAGUE_ID,
    groups: GROUPS,
    participants: PARTICIPANTS,
    protect: protectSuperLeague,
    tournament: () => clone(protectedTournament || canonicalTournament())
  });
})();
