(() => {
  'use strict';

  if (window.ArenaBDACopaBDALivreGuard?.version >= 6) return;

  const VERSION = 6;
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const BACKUP_KEY = 'bda-v3-copa-bda-livre-backup';
  const FIRST_RELOAD_KEY = 'arena-copa-bda-livre-first-reload-v6';
  const CANONICAL_ID = 'copa-bda-livre';
  const CANONICAL_NAME = 'Copa BDA LIVRE';
  const REMOTE_PREFIX = `confrontos-${CANONICAL_ID}`;

  let hydrating = false;
  let cloudRequested = false;
  let hydrateTimer = 0;

  const clone = value => JSON.parse(JSON.stringify(value));
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const slug = value => normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const isCupIdLike = value => slug(value).startsWith(CANONICAL_ID);

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function isCopaBDALivre(item) {
    if (!item) return false;
    const id = slug(item.id || '');
    const name = slug(item.name || '');
    return id.startsWith(CANONICAL_ID) || name === CANONICAL_ID || name.includes(CANONICAL_ID);
  }

  function currentCup() {
    return tournaments().find(isCopaBDALivre) || null;
  }

  function savedBackup() {
    const value = read(BACKUP_KEY, null);
    return isCopaBDALivre(value) ? value : null;
  }

  function saveBackup(item) {
    if (!isCopaBDALivre(item)) return;
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(item)); } catch {}
  }

  function same(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
  }

  function realTeamName(value) {
    const name = String(value || '').trim();
    if (!name) return '';
    if (/^(vencedor|perdedor|classificado|bye|folga|aguardando)\b/i.test(name)) return '';
    return name;
  }

  function uniqueParticipants(games) {
    const map = new Map();
    (Array.isArray(games) ? games : []).forEach(game => {
      [game?.ta, game?.tb].forEach(value => {
        const name = realTeamName(value);
        const key = normalize(name);
        if (key && !map.has(key)) map.set(key, name);
      });
    });
    return [...map.values()];
  }

  function localMatchId() {
    return Object.keys(matchStore()).find(key => isCupIdLike(key)) || '';
  }

  function gamesFor(id) {
    const store = matchStore();
    if (id && Array.isArray(store[id])) return store[id];
    const alternate = Object.keys(store).find(key => isCupIdLike(key));
    return alternate && Array.isArray(store[alternate]) ? store[alternate] : [];
  }

  function inferredPhase(games, fallback = 'Preliminar') {
    if (!Array.isArray(games) || !games.length) return fallback;
    const unfinished = games.find(game => {
      const hasScore = game?.a !== '' && game?.a != null && game?.b !== '' && game?.b != null;
      return !hasScore && !['Finalizado', 'Encerrado'].includes(String(game?.status || ''));
    });
    return String(unfinished?.phase || games[0]?.phase || fallback);
  }

  function repairedStatus(existing, backup, games) {
    const previous = String(existing?.status || backup?.status || '').trim();
    if (['Finalizado', 'Encerrado'].includes(previous)) return previous;
    if (games.length) return 'Em andamento';
    return previous || 'Em andamento';
  }

  function maybeReloadOnce(added) {
    if (!added || !document.getElementById('arenaGrid')) return;
    try {
      if (sessionStorage.getItem(FIRST_RELOAD_KEY) === '1') return;
      sessionStorage.setItem(FIRST_RELOAD_KEY, '1');
    } catch { return; }
    window.setTimeout(() => location.reload(), 80);
  }

  function ensureTournament() {
    const list = tournaments();
    const index = list.findIndex(isCopaBDALivre);
    const existing = index >= 0 ? list[index] : null;
    const backup = savedBackup();
    const id = String(existing?.id || backup?.id || localMatchId() || CANONICAL_ID);
    const games = gamesFor(id);
    const fromGames = uniqueParticipants(games);
    const participants = fromGames.length
      ? fromGames
      : (Array.isArray(existing?.participants) && existing.participants.length
        ? existing.participants
        : (Array.isArray(backup?.participants) ? backup.participants : []));

    const repaired = {
      ...(backup ? clone(backup) : {}),
      ...(existing ? clone(existing) : {}),
      id,
      name: CANONICAL_NAME,
      edition: existing?.edition || backup?.edition || 'Edição atual',
      format: existing?.format || backup?.format || 'Mata-mata',
      status: repairedStatus(existing, backup, games),
      phase: games.length
        ? inferredPhase(games, existing?.phase || backup?.phase || 'Preliminar')
        : (existing?.phase || backup?.phase || 'Preliminar'),
      maxTeams: Number(existing?.maxTeams || backup?.maxTeams) || participants.length || 0,
      badge: existing?.badge || backup?.badge || '🏆',
      participants,
      description: existing?.description || backup?.description || 'Competição Full Livre do Clã BDA em formato eliminatório.'
    };

    saveBackup(repaired);

    if (index >= 0 && same(list[index], repaired)) return repaired;
    const added = index < 0;
    if (index >= 0) list[index] = repaired;
    else list.push(repaired);

    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { source: 'copa-bda-livre-recovery', tournamentId: repaired.id }
      }));
      maybeReloadOnce(added);
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível recuperar a Copa BDA LIVRE no catálogo', error);
    }
    return repaired;
  }

  function snapshotScore(snapshot) {
    const data = snapshot?.data?.() || {};
    return data.updatedAt?.toMillis?.() || Number(data.draw?.createdAt) || 0;
  }

  async function findRemoteSnapshot(db, cup) {
    if (cup?.id && isCupIdLike(cup.id)) {
      const direct = await db.collection('arenaData').doc(`confrontos-${cup.id}`).get();
      if (direct.exists) return direct;
    }

    const fieldPath = firebase.firestore.FieldPath?.documentId?.();
    if (!fieldPath) return null;
    const query = await db.collection('arenaData')
      .orderBy(fieldPath)
      .startAt(REMOTE_PREFIX)
      .endAt(`${REMOTE_PREFIX}\uf8ff`)
      .get();
    if (query.empty) return null;
    return [...query.docs].sort((a, b) => snapshotScore(b) - snapshotScore(a))[0] || null;
  }

  function applyRemoteGames(localTournamentId, snapshot) {
    const data = snapshot?.data?.() || {};
    const games = Array.isArray(data.games) ? data.games : [];
    if (!games.length) return false;

    const store = matchStore();
    const current = Array.isArray(store[localTournamentId]) ? store[localTournamentId] : [];
    if (current.length && same(current, games)) return false;
    if (current.length && window.ArenaBDAAuth?.isAdmin?.()) return false;

    store[localTournamentId] = games;
    try {
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));
      const list = tournaments();
      const index = list.findIndex(isCopaBDALivre);
      if (index >= 0) {
        const drawTeams = Array.isArray(data.draw?.teams) ? data.draw.teams.filter(Boolean) : [];
        const participants = drawTeams.length ? drawTeams : uniqueParticipants(games);
        list[index] = {
          ...list[index],
          name: CANONICAL_NAME,
          status: repairedStatus(list[index], savedBackup(), games),
          phase: inferredPhase(games, list[index]?.phase || 'Preliminar'),
          participants: participants.length ? participants : list[index].participants,
          maxTeams: Number(list[index].maxTeams) || participants.length || 0
        };
        localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
        saveBackup(list[index]);
      }
      window.dispatchEvent(new CustomEvent('arena:matches-updated', {
        detail: { source: 'copa-bda-livre-cloud', tournamentId: localTournamentId, count: games.length }
      }));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { source: 'copa-bda-livre-cloud', tournamentId: localTournamentId }
      }));
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível aplicar os jogos da Copa BDA LIVRE', error);
      return false;
    }
  }

  async function hydrateFromCloud() {
    if (hydrating || !window.firebase || typeof firebase.firestore !== 'function') return false;
    const cup = ensureTournament();
    if (!cup) return false;
    hydrating = true;
    try {
      const db = firebase.firestore();
      const snapshot = await findRemoteSnapshot(db, cup);
      if (!snapshot?.exists) return false;
      return applyRemoteGames(cup.id, snapshot);
    } catch (error) {
      console.warn('[Arena BDA] A Copa BDA LIVRE está disponível, mas os jogos não puderam ser sincronizados agora', error);
      return false;
    } finally {
      hydrating = false;
    }
  }

  async function ensureCloudAndHydrate() {
    if (!window.firebase || typeof firebase.firestore !== 'function') {
      if (!cloudRequested && typeof window.ArenaBDAEnsureCloud === 'function') {
        cloudRequested = true;
        try { await window.ArenaBDAEnsureCloud('copa-bda-livre-public-sync'); }
        catch {}
        finally { cloudRequested = false; }
      }
    }
    return hydrateFromCloud();
  }

  function cupIsOpen() {
    const cup = currentCup();
    const managerId = document.querySelector('#giManager')?.dataset?.tid || '';
    if (cup?.id && String(managerId) === String(cup.id)) return true;
    const heading = document.querySelector('#arenaDetail .arena-hero-copy h2')?.textContent || '';
    return slug(heading) === CANONICAL_ID;
  }

  function scheduleHydrate(delay = 180) {
    clearTimeout(hydrateTimer);
    hydrateTimer = window.setTimeout(() => {
      if (cupIsOpen()) ensureCloudAndHydrate();
    }, delay);
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-open-tournament],[data-home-tournament]');
    if (!trigger) return;
    const id = trigger.dataset.openTournament || trigger.dataset.homeTournament || '';
    const cup = currentCup();
    if (isCupIdLike(id) || (cup?.id && String(id) === String(cup.id))) scheduleHydrate(0);
  }, true);

  window.addEventListener('arena:cloud-ready', () => scheduleHydrate(120));
  window.addEventListener('arena:matches-updated', event => {
    const cup = currentCup();
    if (cup?.id && event.detail?.tournamentId === cup.id) ensureTournament();
  });

  window.ArenaBDACopaBDALivreGuard = Object.freeze({
    version: VERSION,
    id: CANONICAL_ID,
    name: CANONICAL_NAME,
    repair: ensureTournament,
    hydrate: ensureCloudAndHydrate
  });

  ensureTournament();
  const idle = window.requestIdleCallback || (callback => window.setTimeout(callback, 1400));
  idle(() => ensureCloudAndHydrate());
})();
