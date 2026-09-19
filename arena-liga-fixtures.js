(() => {
  'use strict';

  if (window.ArenaBDALigaFixtures) return;

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const REVISION = '20260919-1';
  const LEAGUE_IDS = new Set(['liga-a', 'liga-b']);

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const tournaments = () => {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  };

  const store = () => {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  };

  const unique = values => {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).filter(name => {
      const key = normalize(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  function roundRobin(teams) {
    const source = [...teams];
    if (source.length % 2) source.push(null);

    const size = source.length;
    const rounds = [];
    let rotation = [...source];

    for (let round = 1; round < size; round += 1) {
      const pairs = [];

      for (let index = 0; index < size / 2; index += 1) {
        let home = rotation[index];
        let away = rotation[size - 1 - index];
        if (!home || !away) continue;

        if ((round + index) % 2 === 0) [home, away] = [away, home];
        pairs.push({ home, away, round, turn: 1 });
      }

      rounds.push(pairs);
      rotation = [rotation[0], rotation[size - 1], ...rotation.slice(1, size - 1)];
    }

    return [
      ...rounds.flat(),
      ...rounds.flat().map(match => ({
        home: match.away,
        away: match.home,
        round: match.round + (size - 1),
        turn: 2
      }))
    ];
  }

  function gameId(id, round, position, turn) {
    return `liga-${id}-r${round}-j${position}-${turn === 2 ? 'v' : 't'}`;
  }

  function makeGame(tournament, match, position) {
    const turnLabel = match.turn === 2 ? 'Returno' : 'Turno';
    const phase = `Rodada ${match.round}`;

    return {
      id: gameId(tournament.id, match.round, position, match.turn),
      tieId: gameId(tournament.id, match.round, position, 1),
      leg: match.turn,
      phase,
      status: 'Agendado',
      ta: match.home,
      tb: match.away,
      a: '',
      b: '',
      pa: '',
      pb: '',
      wo: 'none',
      pos: position,
      date: '',
      time: '',
      place: '',
      note: `${tournament.name} • ${turnLabel}`,
      created: Date.now() + position,
      updated: Date.now() + position
    };
  }

  function hasFixture(game, home, away, round, turn) {
    return normalize(game?.ta) === normalize(home)
      && normalize(game?.tb) === normalize(away)
      && Number(game?.leg || 1) === turn
      && String(game?.phase || '').trim() === `Rodada ${round}`;
  }

  function buildFor(tournament, currentGames) {
    const teams = unique(tournament.participants);
    if (teams.length < 2) return { games: currentGames, added: 0, total: 0 };

    const schedule = roundRobin(teams);
    const existing = Array.isArray(currentGames) ? [...currentGames] : [];
    let added = 0;

    schedule.forEach((match, index) => {
      if (existing.some(game => hasFixture(game, match.home, match.away, match.round, match.turn))) return;
      existing.push(makeGame(tournament, match, (index % Math.max(1, Math.floor(teams.length / 2))) + 1));
      added += 1;
    });

    return {
      games: existing,
      added,
      total: schedule.length
    };
  }

  async function publishCloud(id, games) {
    if (!window.firebase || typeof firebase.firestore !== 'function') return false;
    if (!window.ArenaBDAAuth?.isAdmin?.()) return false;

    try {
      await firebase.firestore().collection('arenaData').doc(`confrontos-${id}`).set({
        dataset: 'confrontos',
        tournamentId: id,
        games,
        revision: REVISION,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: String(window.ArenaBDAAuth.currentEmail?.() || '').toLowerCase()
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Falha ao publicar confrontos da liga', id, error);
      return false;
    }
  }

  async function publish() {
    const list = tournaments();
    const matches = store();
    let changed = false;

    for (const id of LEAGUE_IDS) {
      const tournament = list.find(item => String(item?.id || '').toLowerCase() === id);
      if (!tournament) continue;

      const result = buildFor(tournament, matches[id]);
      if (result.added > 0) {
        matches[id] = result.games;
        changed = true;
        window.dispatchEvent(new CustomEvent('arena:matches-updated', {
          detail: { tournamentId: id, count: result.total, added: result.added, source: 'liga-fixtures' }
        }));
      }

      if (result.added > 0) await publishCloud(id, result.games);
    }

    if (changed) {
      localStorage.setItem(MATCH_KEY, JSON.stringify(matches));
      window.dispatchEvent(new CustomEvent('arena:matches-updated', {
        detail: { tournamentId: 'liga-a-b', source: 'liga-fixtures', revision: REVISION }
      }));
    }
  }

  [0, 600, 1600, 3500, 7000].forEach(delay => window.setTimeout(publish, delay));

  window.addEventListener('arena:auth-changed', publish);
  window.addEventListener('arena:cloud-status', event => {
    if (event.detail?.state === 'ok') publish();
  });

  window.ArenaBDALigaFixtures = Object.freeze({
    revision: REVISION,
    publish
  });
})();
