(() => {
  'use strict';

  if (window.ArenaBDATeamCloudSync?.version >= 3) return;

  const MATCH_KEY = 'bda-v3-confrontos';
  const COPA_BDA_LIVRE_GUARD_SRC = './arena-copa-bda-livre-guard.js?v=20260903-2';
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

  function ensureCopaBDALivreGuard() {
    if (window.ArenaBDACopaBDALivreGuard?.version >= 5) return;
    const existing = document.querySelector('script[data-arena-copa-bda-livre-guard]');
    if (existing) {
      if (!window.ArenaBDACopaBDALivreGuard || Number(window.ArenaBDACopaBDALivreGuard.version || 0) < 5) existing.remove();
      else return;
    }
    const script = document.createElement('script');
    script.src = COPA_BDA_LIVRE_GUARD_SRC;
    script.async = false;
    script.dataset.arenaCopaBdaLivreGuard = 'true';
    script.addEventListener('error', () => {
      console.warn('[Arena BDA] Não foi possível carregar a proteção da Copa BDA LIVRE');
    }, { once: true });
    (document.body || document.head || document.documentElement).appendChild(script);
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

  function refreshTeamsPage() {
    const grid = document.getElementById('teamGrid');
    if (grid) grid.removeAttribute('data-arena-team-editor-state');
    requestAnimationFrame(() => window.ArenaBDATeamEditor?.refresh?.());
  }

  function handleUpdate(detail) {
    refreshTeamsPage();
    if (!detail?.renamed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      syncAllMatchStores().catch(error => {
        console.warn('[Arena BDA] O cadastro do time foi salvo, mas a renomeação dos confrontos ainda não sincronizou', error);
      });
    }, 350);
  }

  window.addEventListener('arena:teams-updated', event => handleUpdate(event.detail));
  window.addEventListener('arena:cloud-ready', ensureCopaBDALivreGuard);
  window.addEventListener('arena:tournaments-updated', ensureCopaBDALivreGuard);

  window.ArenaBDATeamCloudSync = Object.freeze({
    version: 3,
    sync: syncAllMatchStores,
    refreshTeamsPage,
    copaBDALivreGuardSource: COPA_BDA_LIVRE_GUARD_SRC
  });

  ensureCopaBDALivreGuard();
})();
