(() => {
  'use strict';

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function groupName(game) {
    const match = `${game?.phase || ''} ${game?.note || ''}`.match(/Grupo\s+([A-Z0-9]+)/i);
    return match ? `grupo ${match[1].toUpperCase()}` : '';
  }

  function kind(game) {
    const id = normalize(game?.id);
    const phase = normalize(game?.phase);
    const note = normalize(game?.note);
    if (groupName(game)) return 'group';
    if (
      id.startsWith('liga-')
      || /^l\d+$/.test(id)
      || phase.startsWith('liga')
      || /^rodada\s+\d+$/.test(phase)
      || phase.includes('classificacao geral')
      || note.includes('classificacao geral')
    ) return 'league';
    return 'other';
  }

  function configuredGroups(tournament) {
    const source = tournament?.groupGenerator?.groups
      || tournament?.groupSettings?.groups
      || tournament?.settings?.groups
      || [];
    const map = new Map();
    if (!Array.isArray(source)) return map;
    source.forEach((group, index) => {
      const name = normalize(group?.name || `Grupo ${String.fromCharCode(65 + index)}`);
      const teams = new Set((group?.teams || []).map(normalize).filter(Boolean));
      if (name && teams.size) map.set(name, teams);
    });
    return map;
  }

  function displayGroupName(name) {
    const match = String(name || '').match(/^grupo\s+(.+)$/i);
    return match ? `Grupo ${match[1].toUpperCase()}` : String(name || 'Grupo');
  }

  function configuredGroupForGame(game, groups) {
    const home = normalize(game?.ta);
    const away = normalize(game?.tb);
    if (!home || !away) return '';
    for (const [name, teams] of groups) {
      if (teams.has(home) && teams.has(away)) return name;
    }
    return '';
  }

  function adaptLeagueScheduleToGroups(list, groups) {
    return list.flatMap(game => {
      const group = configuredGroupForGame(game, groups);
      if (!group) return [];
      const label = displayGroupName(group);
      const round = `${game?.phase || ''} ${game?.note || ''}`.match(/Rodada\s+(\d+)/i)?.[1] || '';
      return [{
        ...game,
        group: label,
        phase: round ? `${label} • Rodada ${round}` : label,
        note: `${label} • Jogo único`
      }];
    });
  }

  function preferGame(current, candidate) {
    if (!current) return candidate;
    const finished = game => ['a', 'b'].includes(game?.wo)
      || (game?.a !== '' && game?.a != null && game?.b !== '' && game?.b != null);
    if (finished(candidate) !== finished(current)) return finished(candidate) ? candidate : current;
    return Number(candidate?.updated || candidate?.created || 0) >= Number(current?.updated || current?.created || 0)
      ? candidate
      : current;
  }

  function dedupeGroups(list) {
    const chosen = new Map();
    const output = [];
    list.forEach(game => {
      if (kind(game) !== 'group') {
        output.push(game);
        return;
      }
      const teams = [normalize(game?.ta), normalize(game?.tb)].sort();
      const turn = normalize(game?.note).includes('returno') ? 'returno' : 'turno';
      const key = [groupName(game), teams[0], teams[1], turn].join('|');
      chosen.set(key, preferGame(chosen.get(key), game));
    });
    return [...output, ...chosen.values()];
  }

  function forTournament(tournament, games) {
    const list = Array.isArray(games) ? games : [];
    const format = normalize(tournament?.format);
    const groups = configuredGroups(tournament);
    const groupFormat = format.includes('grupo') || groups.size > 1;
    if (!groupFormat) return list;

    const hasGroupSchedule = list.some(game => kind(game) === 'group');
    const hasLeagueSchedule = list.some(game => kind(game) === 'league');
    if (!hasLeagueSchedule) return dedupeGroups(list);

    if (!hasGroupSchedule) {
      const compatible = groups.size > 1
        ? adaptLeagueScheduleToGroups(list.filter(game => kind(game) === 'league'), groups)
        : [];
      const knockout = list.filter(game => kind(game) === 'other');
      return dedupeGroups([...knockout, ...compatible]);
    }

    const filtered = list.filter(game => {
      const type = kind(game);
      if (type === 'league') return false;
      if (type !== 'group' || groups.size === 0) return true;
      const teams = groups.get(normalize(groupName(game)));
      if (!teams) return false;
      return teams.has(normalize(game?.ta)) && teams.has(normalize(game?.tb));
    });
    return dedupeGroups(filtered);
  }

  function forTournamentId(tournamentId, games, tournaments) {
    const list = Array.isArray(tournaments) ? tournaments : [];
    const tournament = list.find(item => String(item?.id) === String(tournamentId)) || null;
    return forTournament(tournament, games);
  }

  function diagnostics(tournament, games) {
    const list = Array.isArray(games) ? games : [];
    const visible = forTournament(tournament, list);
    return Object.freeze({
      total: list.length,
      visible: visible.length,
      ignored: Math.max(0, list.length - visible.length)
    });
  }

  window.ArenaBDAValidMatches = Object.freeze({
    diagnostics,
    forTournament,
    forTournamentId,
    kind
  });

  /* BDA Super League: 21 clubes, quatro grupos e mata-mata a partir das quartas. */
  const SUPER_LEAGUE_ID = 'bda-super-league';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const SETUP_VERSION = 1;

  const SUPER_LEAGUE_GROUPS = Object.freeze([
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

  const SUPER_LEAGUE_PARTICIPANTS = Object.freeze(
    SUPER_LEAGUE_GROUPS.flatMap(group => [...group.teams])
  );

  const ARENA_DEFAULT_TOURNAMENTS = Object.freeze([
    {id:'copa-grifo',name:'Copa Grifo BDA',edition:'8ª edição',format:'Mata-mata',status:'Finalizado',phase:'Campeão definido',maxTeams:19,badge:'🦅',participants:['Zombie FC BDA','JOGOBUGADO BDA','Inter Brasil BDA','Vasco da Gama BDA'],description:'Competição tradicional do Clã BDA em formato eliminatório e jogo único.',legacy:true,locked:true},
    {id:'copa-francos',name:'Copa Francos',edition:'Próxima edição',format:'Mata-mata',status:'Planejado',phase:'Preparação',maxTeams:16,badge:'🕊️',participants:[],description:'Competição especial em homenagem à história do Francos FC BDA.'},
    {id:'liga-a',name:'Liga A BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Inter Brasil BDA',maxTeams:20,badge:'🥇',participants:['Inter Brasil BDA'],description:'A divisão de elite do Clã BDA.'},
    {id:'liga-b',name:'Liga B BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Vasco da Gama BDA',maxTeams:20,badge:'🛡️',participants:['Vasco da Gama BDA'],description:'A divisão de acesso para a Liga A BDA.'}
  ]);

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function superLeagueTournament() {
    return {
      id: SUPER_LEAGUE_ID,
      name: 'BDA Super League',
      edition: 'Temporada atual',
      format: 'Grupos + mata-mata',
      status: 'Em andamento',
      phase: 'Fase de grupos',
      maxTeams: 0,
      badge: '⚜️',
      participants: [...SUPER_LEAGUE_PARTICIPANTS],
      deadline: 'Conforme organização BDA',
      description: 'Full Razz • 21 clubes • 2 classificados por grupo. Campeão: R$ 20 • Vice: R$ 10.',
      qualifiersPerGroup: 2,
      rankingMode: 'efficiency',
      rankingTieBreakers: ['goalDifference', 'goalsFor'],
      superLeagueSetupVersion: SETUP_VERSION,
      groupSettings: {
        qualifiersPerGroup: 2,
        rankingMode: 'efficiency',
        tieBreakers: ['goalDifference', 'goalsFor'],
        groups: SUPER_LEAGUE_GROUPS.map(group => ({ name: group.name, teams: [...group.teams] }))
      },
      groupGenerator: {
        mode: 'groups',
        groupCount: 4,
        qualifiers: 2,
        legs: 1,
        distribution: 'serpentine',
        groups: SUPER_LEAGUE_GROUPS.map(group => ({ name: group.name, teams: [...group.teams] })),
        generatedAt: Date.now(),
        knockoutGenerated: false,
        knockoutMode: 'direct-top-2'
      }
    };
  }

  function roundRobin(teams) {
    const source = [...teams];
    if (source.length % 2) source.push(null);
    const size = source.length;
    const matches = [];
    let rotation = [...source];

    for (let round = 1; round < size; round += 1) {
      for (let index = 0; index < size / 2; index += 1) {
        let home = rotation[index];
        let away = rotation[size - 1 - index];
        if (!home || !away) continue;
        if ((round + index) % 2 === 0) [home, away] = [away, home];
        matches.push({ home, away, round });
      }
      rotation = [rotation[0], rotation[size - 1], ...rotation.slice(1, size - 1)];
    }
    return matches;
  }

  function baseGame(id, phase, position, home, away, note) {
    const created = Date.now() + position;
    return {
      id,
      tieId: id,
      leg: 1,
      phase,
      pos: position,
      status: 'Agendado',
      ta: home,
      tb: away,
      a: '',
      b: '',
      pa: '',
      pb: '',
      wo: 'none',
      date: '',
      time: '',
      place: '',
      note,
      created,
      updated: created
    };
  }

  function buildSuperLeagueSchedule() {
    const games = [];
    let position = 0;

    SUPER_LEAGUE_GROUPS.forEach((group, groupIndex) => {
      roundRobin(group.teams).forEach((match, matchIndex) => {
        position += 1;
        const id = `grupo-super-league-v1-${groupIndex + 1}-${match.round}-${matchIndex + 1}`;
        games.push(baseGame(
          id,
          `${group.name} • Rodada ${match.round}`,
          position,
          match.home,
          match.away,
          `${group.name} • Jogo único`
        ));
      });
    });

    const knockout = [
      ['qf1', 'Quartas de final', '1º Grupo A', '2º Grupo B', 'QF1'],
      ['qf2', 'Quartas de final', '1º Grupo B', '2º Grupo A', 'QF2'],
      ['qf3', 'Quartas de final', '1º Grupo C', '2º Grupo D', 'QF3'],
      ['qf4', 'Quartas de final', '1º Grupo D', '2º Grupo C', 'QF4'],
      ['sf1', 'Semifinal', 'Vencedor QF1', 'Vencedor QF3', 'SF1'],
      ['sf2', 'Semifinal', 'Vencedor QF2', 'Vencedor QF4', 'SF2'],
      ['final', 'Final', 'Vencedor SF1', 'Vencedor SF2', 'Final']
    ];

    knockout.forEach(([id, phase, home, away, note]) => {
      position += 1;
      games.push(baseGame(`mata-super-league-${id}`, phase, position, home, away, note));
    });

    return games;
  }

  function installSuperLeague() {
    const stored = readJson(TOURNAMENT_KEY, null);
    let tournaments = Array.isArray(stored) && stored.length
      ? stored
      : cloneJson(ARENA_DEFAULT_TOURNAMENTS);

    const currentIndex = tournaments.findIndex(item => String(item?.id) === SUPER_LEAGUE_ID);
    const canonical = superLeagueTournament();

    if (currentIndex < 0) {
      tournaments.unshift(canonical);
    } else if (Number(tournaments[currentIndex]?.superLeagueSetupVersion || 0) < SETUP_VERSION) {
      const current = tournaments[currentIndex] || {};
      tournaments[currentIndex] = {
        ...current,
        ...canonical,
        banner: current.banner || canonical.banner
      };
    }

    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(tournaments));
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível instalar a BDA Super League', error);
      return;
    }

    const store = readJson(MATCH_KEY, {});
    const matchStore = store && typeof store === 'object' ? store : {};
    if (!Array.isArray(matchStore[SUPER_LEAGUE_ID]) || matchStore[SUPER_LEAGUE_ID].length === 0) {
      matchStore[SUPER_LEAGUE_ID] = buildSuperLeagueSchedule();
      try {
        localStorage.setItem(MATCH_KEY, JSON.stringify(matchStore));
      } catch (error) {
        console.warn('[Arena BDA] Não foi possível salvar os jogos da BDA Super League', error);
      }
    }
  }

  function numericCell(row, index) {
    const text = String(row.children[index]?.textContent || '').replace('%', '').replace('+', '').trim();
    const value = Number(text);
    return Number.isFinite(value) ? value : 0;
  }

  function applySuperLeagueRanking() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
    const panel = document.getElementById('autoStandings');
    if (!panel) return;

    const description = panel.querySelector('.stand-head p');
    if (description) {
      description.textContent = 'Classificação por aproveitamento. Desempate: saldo de gols e gols marcados.';
    }

    panel.querySelectorAll('.stand-group tbody').forEach(tbody => {
      const current = [...tbody.querySelectorAll('tr')];
      if (!current.length) return;
      const sorted = [...current].sort((a, b) => {
        const apr = numericCell(b, 10) - numericCell(a, 10);
        if (apr) return apr;
        const sg = numericCell(b, 9) - numericCell(a, 9);
        if (sg) return sg;
        const gp = numericCell(b, 7) - numericCell(a, 7);
        if (gp) return gp;
        const nameA = a.querySelector('.stand-club b')?.textContent || '';
        const nameB = b.querySelector('.stand-club b')?.textContent || '';
        return nameA.localeCompare(nameB, 'pt-BR');
      });

      if (sorted.some((row, index) => row !== current[index])) {
        sorted.forEach(row => tbody.appendChild(row));
      }

      sorted.forEach((row, index) => {
        row.classList.toggle('qualified', index < 2);
        const position = row.querySelector('.stand-pos');
        if (position) position.textContent = String(index + 1);
      });
    });
  }

  let rankingFrame = 0;
  function scheduleRankingPatch() {
    if (rankingFrame) return;
    rankingFrame = requestAnimationFrame(() => {
      rankingFrame = 0;
      applySuperLeagueRanking();
    });
  }

  installSuperLeague();
  window.ArenaDOMEvents?.subscribe(scheduleRankingPatch, { selector: '#giManager,#autoStandings,.stand-group' });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-open-tournament],[data-home-tournament],[data-standings-tab],[data-tab="standings"]')) {
      setTimeout(scheduleRankingPatch, 120);
    }
  });
})();
