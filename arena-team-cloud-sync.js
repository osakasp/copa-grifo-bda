(() => {
  'use strict';

  if (window.ArenaBDATeamCloudSync?.version >= 10) return;

  const MATCH_KEY = 'bda-v3-confrontos';
  const COPA_BDA_LIVRE_GUARD_SRC = './arena-copa-bda-livre-guard.js?v=20260903-3';
  const COPA_BDA_LIVRE_LEGS_SRC = './arena-copa-bda-livre-legs.js?v=20260906-1';
  const PHASE_BATCH_CAPTURE_SRC = './arena-capture-phase-batch.js?v=20260903-1';
  const ART_STUDIO_SRC = './arena-art-studio.js?v=20260906-2';
  const ART_STUDIO_PRO_SRC = './arena-art-studio-pro.js?v=20260906-2';
  const ART_BROADCAST_SRC = './arena-art-studio-broadcast.js?v=20260906-2';
  const ART_V32_SRC = './arena-art-studio-v32.js?v=20260906-1';
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
    ensureScript({ globalName:'ArenaBDACopaBDALivreGuard', minVersion:6, selector:'script[data-arena-copa-bda-livre-guard]', src:COPA_BDA_LIVRE_GUARD_SRC, label:'a proteção da Copa BDA LIVRE', datasetName:'arenaCopaBdaLivreGuard' });
  }

  function ensureCopaBDALivreLegs() {
    ensureScript({ globalName:'ArenaBDACopaBDALivreLegs', minVersion:1, selector:'script[data-arena-copa-bda-livre-legs]', src:COPA_BDA_LIVRE_LEGS_SRC, label:'a regra de ida e volta da Copa BDA LIVRE', datasetName:'arenaCopaBdaLivreLegs' });
  }

  function ensurePhaseBatchCapture() {
    ensureScript({ globalName:'ArenaBDAPhaseBatchCapture', minVersion:1, selector:'script[data-arena-phase-batch-capture]', src:PHASE_BATCH_CAPTURE_SRC, label:'o gerador completo das fases', datasetName:'arenaPhaseBatchCapture' });
  }

  function ensureArtStudio() {
    ensureScript({ globalName:'ArenaBDAArtStudio', minVersion:1, selector:'script[data-arena-art-studio]', src:ART_STUDIO_SRC, label:'a Central de Artes BDA', datasetName:'arenaArtStudio' });
  }

  function ensureArtStudioPro() {
    ensureScript({ globalName:'ArenaBDAArtStudioPro', minVersion:1, selector:'script[data-arena-art-studio-pro]', src:ART_STUDIO_PRO_SRC, label:'a Central de Artes BDA Pro', datasetName:'arenaArtStudioPro' });
  }

  function ensureArtBroadcast() {
    ensureScript({ globalName:'ArenaBDAArtBroadcast', minVersion:2, selector:'script[data-arena-art-broadcast]', src:ART_BROADCAST_SRC, label:'o visual broadcast da Central de Artes BDA', datasetName:'arenaArtBroadcast' });
  }

  function ensureArtV32() {
    ensureScript({ globalName:'ArenaBDAArtV32', minVersion:1, selector:'script[data-arena-art-v32]', src:ART_V32_SRC, label:'o refinamento V3.2 da Central de Artes BDA', datasetName:'arenaArtV32' });
  }

  function ensureRuntimeFixes() {
    ensureCopaBDALivreGuard();
    ensureCopaBDALivreLegs();
    ensurePhaseBatchCapture();
    ensureArtStudio();
    ensureArtStudioPro();
    ensureArtBroadcast();
    ensureArtV32();
  }

  async function syncAllMatchStores() {
    if (!ready()) return false;
    const store = readMatches();
    const ids = Object.keys(store).filter(id => Array.isArray(store[id]));
    if (!ids.length) return true;
    const db = firebase.firestore();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp;
    await Promise.all(ids.map(tournamentId => db.collection('arenaData').doc(`confrontos-${tournamentId}`).set({
      dataset:'confrontos',
      tournamentId,
      games:store[tournamentId],
      updatedAt:timestamp(),
      updatedBy:currentEmail()
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
    version:10,
    sync:syncAllMatchStores,
    refreshTeamsPage,
    copaBDALivreGuardSource:COPA_BDA_LIVRE_GUARD_SRC,
    copaBDALivreLegsSource:COPA_BDA_LIVRE_LEGS_SRC,
    phaseBatchCaptureSource:PHASE_BATCH_CAPTURE_SRC,
    artStudioSource:ART_STUDIO_SRC,
    artStudioProSource:ART_STUDIO_PRO_SRC,
    artBroadcastSource:ART_BROADCAST_SRC,
    artV32Source:ART_V32_SRC
  });

  ensureRuntimeFixes();
})();