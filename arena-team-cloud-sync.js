(() => {
  'use strict';

  if (window.ArenaBDATeamCloudSync?.version >= 4) return;

  const MATCH_KEY = 'bda-v3-confrontos';
  const COPA_BDA_LIVRE_GUARD_SRC = './arena-copa-bda-livre-guard.js?v=20260903-3';
  const PHASE_BATCH_CAPTURE_SRC = './arena-capture-phase-batch.js?v=20260903-1';
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

  function ensureScript({ globalName, minVersion, selector, src, label, datasetName }) {
    const current = window[globalName];
    if (current && Number(current.version || 0) >= minVersion) return;
    const existing = document.querySelector(selector);
    if (existing) {
      if (!current || Number(current.version || 0) < minVersion) existing.remove();
      else return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[datasetName] = 'true';
    script.addEventListener('error', () => console.warn(`[Arena BDA] Não foi possível carregar ${label}`), { once: true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  function ensureCopaBDALivreGuard() {
    ensureScript({
      globalName: 'ArenaBDACopaBDALivreGuard',
      minVersion: 6,
      selector: 'script[data-arena-copa-bda-livre-guard]',
      src: COPA_BDA_LIVRE_GUARD_SRC,
      label: 'a proteção da Copa BDA LIVRE',
      datasetName: 'arenaCopaBdaLivreGuard'
    });
  }

  function ensurePhaseBatchCapture() {
    ensureScript({
      globalName: 'ArenaBDAPhaseBatchCapture',
      minVersion: 1,
      selector: 'script[data-arena-phase-batch-capture]',
      src: PHASE_BATCH_CAPTURE_SRC,
      label: 'o gerador completo das fases',
      datasetName: 'arenaPhaseBatchCapture'
    });
  }

  function ensureRuntimeFixes() {
    ensureCopaBDALivreGuard();
    ensurePhaseBatchCapture();
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
  window.addEventListener('arena:cloud-ready', ensureRuntimeFixes);
  window.addEventListener('arena:tournaments-updated', ensureRuntimeFixes);
  window.addEventListener('arena:bundle-loaded', ensureRuntimeFixes);

  window.ArenaBDATeamCloudSync = Object.freeze({
    version: 4,
    sync: syncAllMatchStores,
    refreshTeamsPage,
    copaBDALivreGuardSource: COPA_BDA_LIVRE_GUARD_SRC,
    phaseBatchCaptureSource: PHASE_BATCH_CAPTURE_SRC
  });

  ensureRuntimeFixes();
})();
