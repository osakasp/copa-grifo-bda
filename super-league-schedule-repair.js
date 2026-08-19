(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueScheduleRepair) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';

  const GROUPS = Object.freeze([
    Object.freeze({ name: 'Grupo A', teams: Object.freeze(['CV Cruz BDA','Hellyeah BDA','Imortais FC BDA','BDA Golden FC','CR Flamengo','Vera Cruz Do Oeste PR BDA']) }),
    Object.freeze({ name: 'Grupo B', teams: Object.freeze(['Zombie BDA','Sport Recife BDA','São Paulo BDA','Nacional AC BDA','Imperial São Paulo BDA']) }),
    Object.freeze({ name: 'Grupo C', teams: Object.freeze(['Red Bull BDA','Independente FC BDA','Vasco Da Gama BDA','Esperança BDA','Florence Real BDA']) }),
    Object.freeze({ name: 'Grupo D', teams: Object.freeze(['Boca Juniors','Praia Grande Jogobugado BDA','Flamestre BDA','BDA URDLS','Isaías 55-6-7']) })
  ]);

  const ALIASES = Object.freeze({
    'CV Cruz BDA':['CV CRUZ BDA'],
    'Hellyeah BDA':['HELLYEAH BDA'],
    'Imortais FC BDA':['IMORTAIS FC BDA'],
    'BDA Golden FC':['BDA GOLDEN','BDA GOLDEN FC'],
    'CR Flamengo':['CR FLAMENGO','CR FLAMENGO BDA'],
    'Vera Cruz Do Oeste PR BDA':['VERA CRUZ DO OESTE PR BDA'],
    'Zombie BDA':['ZOMBIE BDA','ZOMBIE FC BDA','Zombie FC BDA'],
    'Sport Recife BDA':['SPORT RECIFE BDA'],
    'São Paulo BDA':['SAO PAULO BDA','SÃO PAULO FC BDA','SAO PAULO FC BDA'],
    'Nacional AC BDA':['NACIONAL AC BDA','NACIONAL FC BDA'],
    'Imperial São Paulo BDA':['IMPERIAL SÃO PAULO BDA','IMPERIAL SAO PAULO BDA'],
    'Red Bull BDA':['RED BULL BDA'],
    'Independente FC BDA':['INDEPENDENTE FC BDA','INDEPENDENTE FC APOSENTADO BDA'],
    'Vasco Da Gama BDA':['VASCO DA GAMA BDA'],
    'Esperança BDA':['ESPERANÇA BDA','ESPERANCA BDA'],
    'Florence Real BDA':['FLORENCE REAL BDA','FLORENCE REAL FC BDA'],
    'Boca Juniors':['BOCA JUNIORS','BOCA JUNIORS BDA'],
    'Praia Grande Jogobugado BDA':['PRAIA GRANDE JOGOBUGADO BDA','JOGOBUGADO BDA','JOGO BUGADO BDA'],
    'Flamestre BDA':['FLAMESTRE BDA','FLAMESTRE FC DF BDA'],
    'BDA URDLS':['BDA URDLS'],
    'Isaías 55-6-7':['ISAIAS 55-6-7','ISAÍAS 55-6-7']
  });

  const token = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  const aliasMap = new Map();
  GROUPS.flatMap(group => group.teams).forEach(name => {
    aliasMap.set(token(name), name);
    (ALIASES[name] || []).forEach(alias => aliasMap.set(token(alias), name));
  });

  function canonicalName(name) {
    return aliasMap.get(token(name)) || '';
  }

  function pairKey(a, b) {
    return [token(a), token(b)].sort().join('|');
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

  function expectedGroups() {
    const expected = [];
    let pos = 0;
    GROUPS.forEach((group, groupIndex) => {
      roundRobin(group.teams).forEach((match, matchIndex) => {
        pos += 1;
        const id = `grupo-super-league-v2-${groupIndex + 1}-${match.round}-${matchIndex + 1}`;
        expected.push({
          id,
          tieId: id,
          leg: 1,
          phase: `${group.name} • Rodada ${match.round}`,
          group: group.name,
          pos,
          status: 'Agendado',
          ta: match.home,
          tb: match.away,
          a: '', b: '', pa: '', pb: '', wo: 'none', date: '', time: '', place: '',
          note: `${group.name} • Jogo único`,
          created: Date.now() + pos,
          updated: Date.now() + pos,
          __expectedPair: pairKey(match.home, match.away)
        });
      });
    });
    return expected;
  }

  function isKnockout(game) {
    const text = `${game?.phase || ''} ${game?.note || ''} ${game?.id || ''}`.toLowerCase();
    return /quartas|semifinal|semi-final|\bfinal\b|mata-super-league|qf\d|sf\d/.test(text);
  }

  function chooseBetter(current, candidate) {
    if (!current) return candidate;
    const finished = game => ['a','b'].includes(game?.wo) || (game?.a !== '' && game?.a != null && game?.b !== '' && game?.b != null);
    if (finished(candidate) !== finished(current)) return finished(candidate) ? candidate : current;
    return Number(candidate?.updated || candidate?.created || 0) >= Number(current?.updated || current?.created || 0) ? candidate : current;
  }

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function repair() {
    const store = readStore();
    const current = Array.isArray(store[SUPER_LEAGUE_ID]) ? store[SUPER_LEAGUE_ID] : [];
    const expected = expectedGroups();
    const existingByPair = new Map();
    const keepOther = [];

    current.forEach(game => {
      if (isKnockout(game)) {
        keepOther.push(game);
        return;
      }
      const home = canonicalName(game?.ta);
      const away = canonicalName(game?.tb);
      if (!home || !away) {
        keepOther.push(game);
        return;
      }
      const key = pairKey(home, away);
      existingByPair.set(key, chooseBetter(existingByPair.get(key), { ...game, __canonicalHome: home, __canonicalAway: away }));
    });

    let added = 0;
    let migrated = 0;
    const canonicalGames = expected.map(template => {
      const existing = existingByPair.get(template.__expectedPair);
      if (!existing) {
        added += 1;
        const { __expectedPair, ...fresh } = template;
        return fresh;
      }
      const changedNames = token(existing.ta) !== token(existing.__canonicalHome) || token(existing.tb) !== token(existing.__canonicalAway);
      if (changedNames) migrated += 1;
      const { __canonicalHome, __canonicalAway, ...source } = existing;
      const existingHomeCanonical = canonicalName(source.ta);
      const homeMatchesTemplate = token(existingHomeCanonical) === token(template.ta);
      return {
        ...source,
        id: source.id || template.id,
        tieId: source.tieId || source.id || template.tieId,
        leg: source.leg || 1,
        phase: template.phase,
        group: template.group,
        pos: template.pos,
        ta: homeMatchesTemplate ? template.ta : template.tb,
        tb: homeMatchesTemplate ? template.tb : template.ta,
        note: template.note,
        status: source.status || 'Agendado'
      };
    });

    const repaired = [...canonicalGames, ...keepOther];
    const oldSignature = JSON.stringify(current.map(game => [game.id,game.phase,game.ta,game.tb,game.a,game.b,game.wo]));
    const newSignature = JSON.stringify(repaired.map(game => [game.id,game.phase,game.ta,game.tb,game.a,game.b,game.wo]));
    if (oldSignature === newSignature) return { changed:false, added:0, migrated:0, totalGroups:canonicalGames.length };

    store[SUPER_LEAGUE_ID] = repaired;
    try {
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('arena:matches-updated', { detail:{ tournamentId:SUPER_LEAGUE_ID, reason:'super-league-schedule-repair', added, migrated, totalGroups:canonicalGames.length } }));
      return { changed:true, added, migrated, totalGroups:canonicalGames.length };
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível completar os jogos da Super League', error);
      return { changed:false, added:0, migrated:0, totalGroups:canonicalGames.length, error:true };
    }
  }

  let frame = 0;
  function scheduleRepair() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const result = repair();
      if (result.changed) console.info(`[Arena BDA] Super League reparada: ${result.totalGroups} jogos de grupos, ${result.added} adicionados.`);
    });
  }

  ['arena:cloud-ready','arena:bundle-loaded','arena:tournaments-updated'].forEach(type => window.addEventListener(type, scheduleRepair));
  window.addEventListener('storage', event => { if (event.key === MATCH_KEY) scheduleRepair(); });

  window.ArenaBDASuperLeagueScheduleRepair = Object.freeze({ version:1, repair, expectedGroupGames:45 });
  scheduleRepair();
})();
