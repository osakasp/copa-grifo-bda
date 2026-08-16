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
      || phase.startsWith('liga')
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
    const groupFormat = format.includes('grupo') || configuredGroups(tournament).size > 1;
    if (!groupFormat) return list;

    const hasGroupSchedule = list.some(game => kind(game) === 'group');
    const hasLeagueSchedule = list.some(game => kind(game) === 'league');
    if (!hasGroupSchedule || !hasLeagueSchedule) return list;

    const groups = configuredGroups(tournament);
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
})();
