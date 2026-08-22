(() => {
  'use strict';

  if (window.ArenaBDATeamCloudSync?.version >= 1) return;

  const MATCH_KEY = 'bda-v3-confrontos';
  const SUPER_LEAGUE_ID = 'bda-super-league';
  let timer = 0;

  function readMatches() {
    try {
      const value = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function ready() {
    return Boolean(
      window.ArenaBDAAuth?.isAdmin?.()
      && window.firebase
      && typeof firebase.firestore === 'function'
    );
  }

  function currentEmail() {
    return String(window.ArenaBDAAuth?.currentEmail?.() || '');
  }

  async function syncAllMatchStores() {
    if (!ready()) return false;
    const store = readMatches();
    const ids = Object.keys(store).filter(id => Array.isArray(store[id]));
    if (!ids.length) return true;
    const db = firebase.firestore();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp;

    await Promise.all(ids.map(tournamentId => db.collection('arenaData').doc(`confrontos-${tournamentId}`).set({
      dataset: 'confrontos',
      tournamentId,
      games: store[tournamentId],
      updatedAt: timestamp(),
      updatedBy: currentEmail()
    })));
    return true;
  }

  function scheduleSync(detail) {
    if (!detail?.renamed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      syncAllMatchStores().catch(error => {
        console.warn('[Arena BDA] O cadastro do time foi salvo, mas a renomeação dos confrontos ainda não sincronizou', error);
      });
    }, 350);
  }

  window.addEventListener('arena:teams-updated', event => scheduleSync(event.detail));

  window.ArenaBDATeamCloudSync = Object.freeze({
    version: 1,
    sync: syncAllMatchStores
  });
})();
