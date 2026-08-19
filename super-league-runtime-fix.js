(() => {
  'use strict';

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';

  const FALLBACK_GROUPS = Object.freeze([
    Object.freeze({ name: 'Grupo A', teams: Object.freeze(['CV Cruz BDA','Hellyeah BDA','Imortais FC BDA','BDA Golden FC','CR Flamengo','Vera Cruz Do Oeste PR BDA']) }),
    Object.freeze({ name: 'Grupo B', teams: Object.freeze(['Zombie BDA','Sport Recife BDA','São Paulo BDA','Nacional AC BDA','Imperial São Paulo BDA']) }),
    Object.freeze({ name: 'Grupo C', teams: Object.freeze(['Red Bull BDA','Independente FC BDA','Vasco Da Gama BDA','Esperança BDA','Florence Real BDA']) }),
    Object.freeze({ name: 'Grupo D', teams: Object.freeze(['Boca Juniors','Praia Grande Jogobugado BDA','Flamestre BDA','BDA URDLS','Isaías 55-6-7']) })
  ]);

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const clone = value => JSON.parse(JSON.stringify(value));

  function groups() {
    const source = window.ArenaBDASuperLeagueGuard?.groups;
    return Array.isArray(source) && source.length ? source : FALLBACK_GROUPS;
  }

  function hasConfiguredGroups(tournament) {
    const source = tournament?.groupGenerator?.groups
      || tournament?.groupSettings?.groups
      || tournament?.settings?.groups;
    return Array.isArray(source) && source.some(group => Array.isArray(group?.teams) && group.teams.length);
  }

  function withCanonicalGroups(tournament) {
    if (!tournament || String(tournament.id || '') !== SUPER_LEAGUE_ID || hasConfiguredGroups(tournament)) return tournament;
    const canonicalGroups = groups().map(group => ({ name: group.name, teams: [...group.teams] }));
    return {
      ...tournament,
      format: tournament.format || 'Grupos + mata-mata',
      qualifiersPerGroup: Number(tournament.qualifiersPerGroup || 2),
      groupSettings: {
        ...(tournament.groupSettings || {}),
        qualifiersPerGroup: Number(tournament.groupSettings?.qualifiersPerGroup || tournament.qualifiersPerGroup || 2),
        rankingMode: tournament.groupSettings?.rankingMode || tournament.rankingMode || 'efficiency',
        groups: canonicalGroups
      },
      groupGenerator: {
        ...(tournament.groupGenerator || {}),
        mode: 'groups',
        groupCount: 4,
        qualifiers: Number(tournament.groupGenerator?.qualifiers || tournament.qualifiersPerGroup || 2),
        groups: canonicalGroups
      }
    };
  }

  function patchValidMatches() {
    const current = window.ArenaBDAValidMatches;
    if (!current?.forTournament || current.__superLeagueRuntimeFix) return;

    const originalForTournament = current.forTournament.bind(current);
    const patchedForTournament = (tournament, games) => originalForTournament(withCanonicalGroups(tournament), games);

    const patched = {
      ...current,
      forTournament: patchedForTournament,
      forTournamentId(tournamentId, games, tournaments) {
        const list = Array.isArray(tournaments) ? tournaments : [];
        const tournament = list.find(item => String(item?.id) === String(tournamentId)) || null;
        return patchedForTournament(tournament, games);
      },
      diagnostics(tournament, games) {
        const list = Array.isArray(games) ? games : [];
        const visible = patchedForTournament(tournament, list);
        return Object.freeze({
          total: list.length,
          visible: visible.length,
          ignored: Math.max(0, list.length - visible.length)
        });
      }
    };

    Object.defineProperty(patched, '__superLeagueRuntimeFix', { value: true });
    window.ArenaBDAValidMatches = Object.freeze(patched);
  }

  function teamGroup(name) {
    const key = normalize(name);
    for (const group of groups()) {
      if (group.teams.some(team => normalize(team) === key)) return group.name;
    }
    return '';
  }

  function isCanonicalGroupGame(game) {
    const homeGroup = teamGroup(game?.ta);
    const awayGroup = teamGroup(game?.tb);
    return Boolean(homeGroup && awayGroup && homeGroup === awayGroup);
  }

  function installMatchStorageGuard() {
    const previous = Storage.prototype.setItem;
    if (previous.__arenaSuperLeagueMatchGuard) return;

    const guarded = function(key, value) {
      let nextValue = value;
      if (this === localStorage && key === MATCH_KEY) {
        try {
          const nextStore = JSON.parse(String(value || '{}'));
          const oldStore = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
          const incoming = Array.isArray(nextStore?.[SUPER_LEAGUE_ID]) ? nextStore[SUPER_LEAGUE_ID] : null;
          const existing = Array.isArray(oldStore?.[SUPER_LEAGUE_ID]) ? oldStore[SUPER_LEAGUE_ID] : [];

          if (incoming && existing.length) {
            const incomingHasGroups = incoming.some(isCanonicalGroupGame);
            const existingGroups = existing.filter(isCanonicalGroupGame);
            if (!incomingHasGroups && existingGroups.length) {
              const incomingIds = new Set(incoming.map(game => String(game?.id || '')));
              nextStore[SUPER_LEAGUE_ID] = [
                ...existingGroups.filter(game => !incomingIds.has(String(game?.id || ''))),
                ...incoming
              ];
              nextValue = JSON.stringify(nextStore);
              console.warn('[Arena BDA] Jogos da fase de grupos foram preservados durante a edição.');
            }
          }
        } catch (error) {
          console.warn('[Arena BDA] Não foi possível validar a gravação dos confrontos', error);
        }
      }
      return previous.call(this, key, nextValue);
    };

    Object.defineProperty(guarded, '__arenaSuperLeagueMatchGuard', { value: true });
    Storage.prototype.setItem = guarded;
  }

  let editProtectionUntil = 0;
  let scoreSyncPatched = false;

  function patchScoreSync() {
    const sync = window.ArenaBDAScoreSync;
    if (!sync?.isPending || scoreSyncPatched || sync.__arenaSuperLeagueScoreGuard) return;
    const originalIsPending = sync.isPending.bind(sync);
    sync.isPending = tournamentId => originalIsPending(tournamentId)
      || (String(tournamentId) === SUPER_LEAGUE_ID && Date.now() < editProtectionUntil);
    Object.defineProperty(sync, '__arenaSuperLeagueScoreGuard', { value: true });
    scoreSyncPatched = true;
  }

  function protectScoreEdit(event) {
    const target = event.target instanceof Element
      ? event.target.closest('#giManager .gi-score-input')
      : null;
    if (!target) return;
    const manager = target.closest('#giManager');
    if (manager?.dataset?.tid !== SUPER_LEAGUE_ID) return;
    editProtectionUntil = Date.now() + 4500;
    patchScoreSync();
  }

  function ensureRuntimeStyles() {
    if (document.getElementById('superLeagueRuntimeFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'superLeagueRuntimeFixStyles';
    style.textContent = `
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gip-card,
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gi-game,
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gi-score-input{
        transition:none!important;
        animation:none!important;
      }
      #giManager[data-tid="${SUPER_LEAGUE_ID}"] #autoStandings:not([hidden]){display:block}
    `;
    document.head.append(style);
  }

  function nudgeStandings() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
    const panel = document.getElementById('autoStandings');
    if (!panel || panel.hidden || panel.querySelectorAll('.stand-group').length >= 4) return;

    const tournaments = (() => {
      try {
        const value = JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || '[]');
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    })();
    const index = tournaments.findIndex(item => String(item?.id) === SUPER_LEAGUE_ID);
    if (index < 0 || hasConfiguredGroups(tournaments[index])) return;

    const effective = withCanonicalGroups(tournaments[index]);
    const patched = clone(tournaments);
    patched[index] = effective;
    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(patched));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { tournamentId: SUPER_LEAGUE_ID, reason: 'groups-runtime-repair' }
      }));
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível reparar os grupos em memória', error);
    }
  }

  let refreshFrame = 0;
  function refresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      patchValidMatches();
      patchScoreSync();
      ensureRuntimeStyles();
      nudgeStandings();
    });
  }

  installMatchStorageGuard();
  patchValidMatches();
  ensureRuntimeStyles();

  document.addEventListener('focusin', protectScoreEdit, true);
  document.addEventListener('input', protectScoreEdit, true);
  document.addEventListener('change', protectScoreEdit, true);
  window.addEventListener('arena:quick-score-saved', () => {
    editProtectionUntil = Date.now() + 1800;
    refresh();
  });
  window.addEventListener('arena:bundle-loaded', refresh);
  window.addEventListener('arena:cloud-ready', refresh);
  window.addEventListener('arena:matches-updated', refresh);
  window.addEventListener('arena:tournaments-updated', refresh);

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDASuperLeagueRuntimeFix = Object.freeze({
    version: 1,
    refresh,
    groups: () => groups().map(group => ({ name: group.name, teams: [...group.teams] }))
  });

  refresh();
})();
