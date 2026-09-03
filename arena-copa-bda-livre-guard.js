(() => {
  'use strict';

  if (window.ArenaBDACopaBDALivreGuard?.version >= 5) return;

  const VERSION = 5;
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const BACKUP_KEY = 'bda-v3-copa-bda-livre-backup';
  const CATALOG_REFRESH_PREFIX = 'arena-copa-bda-livre-catalog-refresh-v5:';
  const OPEN_AFTER_REFRESH_KEY = 'arena-copa-bda-livre-open-after-refresh-v5';
  const CANONICAL_ID = 'copa-bda-livre';
  const CANONICAL_NAME = 'Copa BDA LIVRE';
  const REMOTE_PREFIX = `confrontos-${CANONICAL_ID}`;

  let hydrating = false;
  let cloudRequested = false;
  let repairFrame = 0;

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
    return id.startsWith(CANONICAL_ID) || name === CANONICAL_ID || name.includes('copa-bda-livre');
  }

  function savedBackup() {
    const value = read(BACKUP_KEY, null);
    return isCopaBDALivre(value) ? value : null;
  }

  function saveBackup(item) {
    if (!isCopaBDALivre(item)) return;
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(item)); } catch {}
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

  function gamesFor(id = CANONICAL_ID) {
    const store = matchStore();
    if (Array.isArray(store[id])) return store[id];
    const alternateKey = Object.keys(store).find(key => isCupIdLike(key));
    return alternateKey && Array.isArray(store[alternateKey]) ? store[alternateKey] : [];
  }

  function currentCup() {
    return tournaments().find(isCopaBDALivre) || null;
  }

  function matchesCurrentCupId(value) {
    const cup = currentCup();
    return isCupIdLike(value) || Boolean(cup?.id && String(value) === String(cup.id));
  }

  function same(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
  }

  function inferredPhase(games, fallback = 'Preliminar') {
    if (!Array.isArray(games) || !games.length) return fallback;
    const unfinished = games.find(game => {
      const hasScore = game?.a !== '' && game?.a != null && game?.b !== '' && game?.b != null;
      return !hasScore && !['Finalizado', 'Encerrado'].includes(String(game?.status || ''));
    });
    return String(unfinished?.phase || games[0]?.phase || fallback);
  }

  function cupIsOpen() {
    const managerId = document.querySelector('#giManager')?.dataset?.tid;
    if (managerId && matchesCurrentCupId(managerId)) return true;
    const heading = document.querySelector('#arenaDetail .arena-hero-copy h2')?.textContent;
    return slug(heading) === CANONICAL_ID;
  }

  function rememberOpenCup(tournamentId) {
    if (!cupIsOpen()) return;
    try { sessionStorage.setItem(OPEN_AFTER_REFRESH_KEY, String(tournamentId || CANONICAL_ID)); } catch {}
  }

  function reopenIfRequested() {
    let requested = '';
    try { requested = sessionStorage.getItem(OPEN_AFTER_REFRESH_KEY) || ''; } catch {}
    if (!requested) return false;

    const button = [...document.querySelectorAll('#arenaGrid [data-open-tournament]')]
      .find(item => String(item.dataset.openTournament || '') === requested);
    if (!button) return false;

    try { sessionStorage.removeItem(OPEN_AFTER_REFRESH_KEY); } catch {}
    if (typeof window.navigate === 'function') window.navigate('tournament');
    requestAnimationFrame(() => button.click());
    return true;
  }

  function ensureCatalogVisible(tournamentId) {
    const grid = document.getElementById('arenaGrid');
    if (!grid) return;
    const visible = [...grid.querySelectorAll('[data-open-tournament]')]
      .some(button => String(button.dataset.openTournament || '') === String(tournamentId));
    if (visible) {
      reopenIfRequested();
      return;
    }

    const refreshKey = `${CATALOG_REFRESH_PREFIX}${String(tournamentId || CANONICAL_ID)}`;
    try {
      if (sessionStorage.getItem(refreshKey) === '1') return;
      rememberOpenCup(tournamentId);
      sessionStorage.setItem(refreshKey, '1');
    } catch {}
    window.setTimeout(() => location.reload(), 90);
  }

  function repairedStatus(existing, backup, games) {
    const previousStatus = String(existing?.status || backup?.status || '').trim();
    if (['Finalizado', 'Encerrado'].includes(previousStatus)) return previousStatus;
    if (games.length) return 'Em andamento';
    return previousStatus || 'Em andamento';
  }

  function ensureTournament() {
    const list = tournaments();
    const index = list.findIndex(isCopaBDALivre);
    const backup = savedBackup();
    const existing = index >= 0 ? list[index] : null;
    const localMatchId = Object.keys(matchStore()).find(key => isCupIdLike(key)) || '';
    const id = String(existing?.id || backup?.id || localMatchId || CANONICAL_ID);
    const games = gamesFor(id);
    const fromGames = uniqueParticipants(games);
    const existingParticipants = Array.isArray(existing?.participants) ? existing.participants : [];
    const backupParticipants = Array.isArray(backup?.participants) ? backup.participants : [];
    const participants = fromGames.length ? fromGames : (existingParticipants.length ? existingParticipants : backupParticipants);

    const repaired = {
      ...(backup ? clone(backup) : {}),
      ...(existing ? clone(existing) : {}),
      id,
      name: CANONICAL_NAME,
      edition: existing?.edition || backup?.edition || 'Edição atual',
      format: existing?.format || backup?.format || 'Mata-mata',
      status: repairedStatus(existing, backup, games),
      phase: games.length ? inferredPhase(games, existing?.phase || backup?.phase || 'Preliminar') : (existing?.phase || backup?.phase || 'Preliminar'),
      maxTeams: Number(existing?.maxTeams || backup?.maxTeams) || participants.length || 0,
      badge: existing?.badge || backup?.badge || '🏆',
      participants,
      description: existing?.description || backup?.description || 'Competição Full Livre do Clã BDA em formato eliminatório.'
    };

    saveBackup(repaired);

    if (index >= 0) {
      if (same(list[index], repaired)) {
        ensureCatalogVisible(repaired.id);
        return false;
      }
      list[index] = repaired;
    } else {
      list.push(repaired);
    }

    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { source: 'copa-bda-livre-recovery', tournamentId: repaired.id }
      }));
      ensureCatalogVisible(repaired.id);
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível recuperar a Copa BDA LIVRE no catálogo', error);
      return false;
    }
  }

  function saveRemoteGames(tournamentId, games, previousId = '') {
    if (!Array.isArray(games) || !games.length) return false;
    const store = matchStore();
    const local = Array.isArray(store[tournamentId]) ? store[tournamentId] : [];
    if (local.length && same(local, games)) return false;
    if (local.length && window.ArenaBDAAuth?.isAdmin?.()) return false;

    store[tournamentId] = games;
    if (previousId && previousId !== tournamentId && isCupIdLike(previousId)) delete store[previousId];
    try {
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('arena:matches-updated', {
        detail: { source: 'copa-bda-livre-cloud', tournamentId, count: games.length }
      }));
      ensureTournament();
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível aplicar os jogos da Copa BDA LIVRE', error);
      return false;
    }
  }

  function snapshotScore(snapshot) {
    const data = snapshot?.data?.() || {};
    const updated = data.updatedAt?.toMillis?.() || 0;
    return updated || Number(data.draw?.createdAt) || 0;
  }

  async function findRemoteCupSnapshot(db, cup) {
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

  function adoptRemoteTournament(snapshot) {
    const data = snapshot?.data?.() || {};
    const remoteId = String(data.tournamentId || snapshot?.id?.replace(/^confrontos-/, '') || '').trim();
    if (!remoteId || !isCupIdLike(remoteId)) return currentCup();

    const list = tournaments();
    const index = list.findIndex(isCopaBDALivre);
    const current = index >= 0 ? list[index] : currentCup();
    const games = Array.isArray(data.games) ? data.games : [];
    const drawTeams = Array.isArray(data.draw?.teams) ? data.draw.teams.filter(Boolean) : [];
    const participants = drawTeams.length ? drawTeams : uniqueParticipants(games);
    const next = {
      ...(current ? clone(current) : {}),
      id: remoteId,
      name: CANONICAL_NAME,
      edition: current?.edition || 'Edição atual',
      format: current?.format || 'Mata-mata',
      status: repairedStatus(current, savedBackup(), games),
      phase: inferredPhase(games, current?.phase || 'Preliminar'),
      maxTeams: Number(current?.maxTeams) || participants.length || 0,
      badge: current?.badge || '🏆',
      participants: participants.length ? participants : (Array.isArray(current?.participants) ? current.participants : []),
      description: current?.description || 'Competição Full Livre do Clã BDA em formato eliminatório.'
    };

    if (index >= 0) list[index] = next;
    else list.push(next);
    saveBackup(next);
    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { source: 'copa-bda-livre-cloud-id', tournamentId: remoteId }
      }));
      ensureCatalogVisible(remoteId);
    } catch {}
    return next;
  }

  async function hydrateFromCloud() {
    if (hydrating || !window.firebase || typeof firebase.firestore !== 'function') return false;
    const cup = currentCup();
    hydrating = true;
    try {
      const db = firebase.firestore();
      const snapshot = await findRemoteCupSnapshot(db, cup);
      if (!snapshot?.exists) return false;
      const previousId = cup?.id || '';
      const adopted = adoptRemoteTournament(snapshot) || cup;
      const remote = snapshot.data()?.games;
      return adopted ? saveRemoteGames(adopted.id, remote, previousId) : false;
    } catch (error) {
      console.warn('[Arena BDA] A Copa BDA LIVRE apareceu, mas os jogos não puderam ser baixados agora', error);
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

  function prepareCloud() {
    if (!cupIsOpen()) return Promise.resolve(false);
    return ensureCloudAndHydrate();
  }

  function scheduleRepair() {
    if (repairFrame) return;
    repairFrame = requestAnimationFrame(() => {
      repairFrame = 0;
      ensureTournament();
      reopenIfRequested();
      if (cupIsOpen()) prepareCloud();
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-open-tournament],[data-home-tournament]')
      : null;
    if (!target) return;
    const id = target.dataset.openTournament || target.dataset.homeTournament || '';
    if (!matchesCurrentCupId(id)) return;
    window.setTimeout(prepareCloud, 0);
  }, true);

  ['arena:cloud-ready', 'arena:tournaments-updated', 'arena:matches-updated', 'arena:cloud-data-applied']
    .forEach(type => window.addEventListener(type, scheduleRepair));

  const observer = new MutationObserver(scheduleRepair);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDACopaBDALivreGuard = Object.freeze({
    version: VERSION,
    id: CANONICAL_ID,
    name: CANONICAL_NAME,
    repair: ensureTournament,
    hydrate: ensureCloudAndHydrate
  });

  ensureTournament();
  reopenIfRequested();
  const idle = window.requestIdleCallback || (callback => window.setTimeout(callback, 1200));
  idle(() => ensureCloudAndHydrate());
})();
