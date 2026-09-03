(() => {
  'use strict';

  if (window.ArenaBDACopaBDALivreGuard?.version >= 2) return;

  const VERSION = 2;
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const BACKUP_KEY = 'bda-v3-copa-bda-livre-backup';
  const CANONICAL_ID = 'copa-bda-livre';
  const CANONICAL_NAME = 'Copa BDA LIVRE';

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
    return id === CANONICAL_ID || name === CANONICAL_ID || name.includes('copa-bda-livre');
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
    const alternateKey = Object.keys(store).find(key => slug(key) === CANONICAL_ID);
    return alternateKey && Array.isArray(store[alternateKey]) ? store[alternateKey] : [];
  }

  function currentCup() {
    return tournaments().find(isCopaBDALivre) || null;
  }

  function matchesCurrentCupId(value) {
    const cup = currentCup();
    return slug(value) === CANONICAL_ID || Boolean(cup?.id && String(value) === String(cup.id));
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

  function ensureTournament() {
    const list = tournaments();
    const index = list.findIndex(isCopaBDALivre);
    const backup = savedBackup();
    const existing = index >= 0 ? list[index] : null;
    const id = String(existing?.id || backup?.id || CANONICAL_ID);
    const games = gamesFor(id);
    const fromGames = uniqueParticipants(games);
    const existingParticipants = Array.isArray(existing?.participants) ? existing.participants : [];
    const backupParticipants = Array.isArray(backup?.participants) ? backup.participants : [];
    const participants = fromGames.length ? fromGames : (existingParticipants.length ? existingParticipants : backupParticipants);
    const previousStatus = String(existing?.status || backup?.status || '').trim();
    const finishedTournament = ['Finalizado', 'Encerrado'].includes(previousStatus);
    const status = finishedTournament
      ? previousStatus
      : (games.length ? 'Em andamento' : (previousStatus || 'Em andamento'));

    const repaired = {
      ...(backup ? clone(backup) : {}),
      ...(existing ? clone(existing) : {}),
      id,
      name: CANONICAL_NAME,
      edition: existing?.edition || backup?.edition || 'Edição atual',
      format: existing?.format || backup?.format || 'Mata-mata',
      status,
      phase: games.length ? inferredPhase(games, existing?.phase || backup?.phase || 'Preliminar') : (existing?.phase || backup?.phase || 'Preliminar'),
      maxTeams: Number(existing?.maxTeams || backup?.maxTeams) || participants.length || 0,
      badge: existing?.badge || backup?.badge || '🏆',
      participants,
      description: existing?.description || backup?.description || 'Competição Full Livre do Clã BDA em formato eliminatório.'
    };

    saveBackup(repaired);

    if (index >= 0) {
      if (same(list[index], repaired)) return false;
      list[index] = repaired;
    } else {
      list.push(repaired);
    }

    try {
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { source: 'copa-bda-livre-recovery', tournamentId: repaired.id }
      }));
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível recuperar a Copa BDA LIVRE no catálogo', error);
      return false;
    }
  }

  function saveRemoteGames(tournamentId, games) {
    if (!Array.isArray(games) || !games.length) return false;
    const store = matchStore();
    const local = Array.isArray(store[tournamentId]) ? store[tournamentId] : [];
    if (local.length && same(local, games)) return false;
    if (local.length && window.ArenaBDAAuth?.isAdmin?.()) return false;

    store[tournamentId] = games;
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

  async function hydrateFromCloud() {
    if (hydrating || !window.firebase || typeof firebase.firestore !== 'function') return false;
    const cup = currentCup();
    if (!cup) return false;
    hydrating = true;
    try {
      const snapshot = await firebase.firestore().collection('arenaData').doc(`confrontos-${cup.id}`).get();
      const remote = snapshot.exists ? snapshot.data()?.games : null;
      return saveRemoteGames(cup.id, remote);
    } catch (error) {
      console.warn('[Arena BDA] A Copa BDA LIVRE apareceu, mas os jogos não puderam ser baixados agora', error);
      return false;
    } finally {
      hydrating = false;
    }
  }

  function cupIsOpen() {
    const managerId = document.querySelector('#giManager')?.dataset?.tid;
    if (managerId && matchesCurrentCupId(managerId)) return true;
    const heading = document.querySelector('#arenaDetail .arena-hero-copy h2')?.textContent;
    return slug(heading) === CANONICAL_ID;
  }

  async function prepareCloud() {
    if (!cupIsOpen()) return;
    if (!window.firebase || typeof firebase.firestore !== 'function') {
      if (!cloudRequested && typeof window.ArenaBDAEnsureCloud === 'function') {
        cloudRequested = true;
        try { await window.ArenaBDAEnsureCloud('copa-bda-livre-public-sync'); }
        catch {}
        finally { cloudRequested = false; }
      }
    }
    await hydrateFromCloud();
  }

  function scheduleRepair() {
    if (repairFrame) return;
    repairFrame = requestAnimationFrame(() => {
      repairFrame = 0;
      ensureTournament();
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

  const observer = new MutationObserver(() => {
    if (cupIsOpen()) scheduleRepair();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDACopaBDALivreGuard = Object.freeze({
    version: VERSION,
    id: CANONICAL_ID,
    name: CANONICAL_NAME,
    repair: ensureTournament,
    hydrate: prepareCloud
  });

  ensureTournament();
  if (cupIsOpen()) prepareCloud();
})();
