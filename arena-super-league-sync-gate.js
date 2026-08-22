(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueSyncGate?.version >= 2) return;

  const TID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const DOC_ID = `confrontos-${TID}`;
  const MAX_WAIT_MS = 12000;
  let db = null;
  let unsubscribe = null;
  let syncPromise = null;
  let retryTimer = 0;
  let retryCount = 0;
  let adminUploadTimer = 0;
  let statusFrame = 0;

  const stable = value => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((out, key) => {
        out[key] = stable(value[key]);
        return out;
      }, {});
    }
    return value;
  };
  const signature = value => JSON.stringify(stable(value));

  function isAdmin() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.());
  }

  function manager() {
    return document.querySelector(`#giManager[data-tid="${TID}"]`);
  }

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function localGames() {
    const games = readStore()[TID];
    return Array.isArray(games) ? games : [];
  }

  function freshness(game) {
    return Number(game?.updated || game?.created || 0);
  }

  function hasResult(game) {
    if (game?.wo === 'a' || game?.wo === 'b') return true;
    const a = game?.a;
    const b = game?.b;
    return a !== '' && a != null && b !== '' && b != null && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b));
  }

  function resultSignature(game) {
    return JSON.stringify([
      game?.wo || 'none',
      game?.a === '' || game?.a == null ? null : Number(game.a),
      game?.b === '' || game?.b == null ? null : Number(game.b),
      game?.pa === '' || game?.pa == null ? null : Number(game.pa),
      game?.pb === '' || game?.pb == null ? null : Number(game.pb)
    ]);
  }

  function chooseGame(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const localHas = hasResult(local);
    const remoteHas = hasResult(remote);

    if (remoteHas && !localHas) return remote;
    if (localHas && !remoteHas) return local;

    if (localHas && remoteHas && resultSignature(local) !== resultSignature(remote)) {
      return freshness(local) > freshness(remote) ? local : remote;
    }

    return freshness(local) > freshness(remote) ? local : remote;
  }

  function mergeSafely(local, remote) {
    const localMap = new Map();
    const remoteMap = new Map();
    (Array.isArray(local) ? local : []).forEach(game => {
      const id = String(game?.id || '');
      if (id) localMap.set(id, game);
    });
    (Array.isArray(remote) ? remote : []).forEach(game => {
      const id = String(game?.id || '');
      if (id) remoteMap.set(id, game);
    });
    const ids = new Set([...remoteMap.keys(), ...localMap.keys()]);
    return [...ids].map(id => chooseGame(localMap.get(id), remoteMap.get(id))).filter(Boolean);
  }

  function setLocalGames(games, reason) {
    if (!Array.isArray(games)) return false;
    const current = localGames();
    if (signature(current) === signature(games)) return false;
    const store = readStore();
    store[TID] = games;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail:{ tournamentId:TID, reason, count:games.length }
    }));
    window.ArenaBDASuperLeagueRuntimeFix?.refresh?.();
    window.ArenaBDASuperLeagueRuleV3?.refresh?.();
    return true;
  }

  function statusElement(create = true) {
    const host = manager();
    if (!host) return null;
    let status = host.querySelector(':scope > #arenaSuperLeagueSyncStatus');
    if (!status && create) {
      status = document.createElement('div');
      status.id = 'arenaSuperLeagueSyncStatus';
      status.className = 'arena-sl-sync-status';
      const nav = host.querySelector(':scope > nav');
      if (nav) nav.after(status);
      else host.prepend(status);
    }
    return status;
  }

  function setWaiting() {
    if (!manager()) return;
    document.documentElement.classList.add('arena-sl-cloud-wait');
    document.documentElement.dataset.arenaSuperLeagueCloud = 'loading';
    const status = statusElement(true);
    if (status) {
      status.dataset.state = 'loading';
      status.innerHTML = '<span class="arena-sl-sync-spinner" aria-hidden="true"></span><div><b>Sincronizando resultados oficiais</b><small>Aguarde um instante. A Arena está buscando os placares da nuvem antes de liberar os jogos e a classificação.</small></div>';
    }
  }

  function setReady(state = 'ready', message = '') {
    document.documentElement.classList.remove('arena-sl-cloud-wait');
    document.documentElement.dataset.arenaSuperLeagueCloud = state;
    const status = statusElement(false);
    if (status) {
      if (state === 'ready') status.remove();
      else {
        status.dataset.state = state;
        status.innerHTML = `<div><b>${state === 'offline' ? 'Sem conexão com a nuvem' : 'Sincronização parcial'}</b><small>${message || 'A Arena liberou os dados disponíveis neste aparelho e continuará tentando sincronizar.'}</small></div>`;
        setTimeout(() => status.remove(), 5000);
      }
    }
    window.ArenaBDASuperLeagueRuntimeFix?.refresh?.();
    window.ArenaBDASuperLeagueRuleV3?.refresh?.();
    window.dispatchEvent(new CustomEvent('arena:super-league-cloud-synced', {
      detail:{ tournamentId:TID, state }
    }));
  }

  async function ensureFirebase() {
    if (window.firebase && typeof firebase.firestore === 'function') return true;
    if (typeof window.ArenaBDAEnsureCloud === 'function') {
      try { await window.ArenaBDAEnsureCloud('super-league-sync-gate-v2'); } catch {}
    }
    return Boolean(window.firebase && typeof firebase.firestore === 'function');
  }

  async function writeMerged(remote = []) {
    if (!db || !isAdmin()) return false;
    const local = localGames();
    const merged = mergeSafely(local, remote);
    setLocalGames(merged, 'super-league-admin-safe-cloud-merge');
    if (signature(merged) === signature(Array.isArray(remote) ? remote : [])) return true;
    await db.collection('arenaData').doc(DOC_ID).set({
      dataset:'confrontos',
      tournamentId:TID,
      games:merged,
      syncRule:'v2-safe-result-merge',
      updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:window.ArenaBDAAuth?.currentEmail?.() || ''
    });
    return true;
  }

  async function handleSnapshot(snapshot, source = 'listener') {
    if (!snapshot?.exists) {
      if (isAdmin() && localGames().length) await writeMerged([]);
      setReady('ready');
      return;
    }

    const remote = snapshot.data()?.games;
    if (!Array.isArray(remote)) {
      setReady('partial', 'A nuvem respondeu sem uma lista válida de confrontos.');
      return;
    }

    if (isAdmin()) await writeMerged(remote);
    else setLocalGames(remote, `super-league-cloud-${source}`);
    setReady('ready');
  }

  function subscribe() {
    if (!db || unsubscribe) return;
    unsubscribe = db.collection('arenaData').doc(DOC_ID).onSnapshot(
      snapshot => { handleSnapshot(snapshot, 'listener').catch(() => {}); },
      () => {
        unsubscribe = null;
        if (navigator.onLine === false) setReady('offline');
        else scheduleRetry();
      }
    );
  }

  async function connectAndSync() {
    if (!manager()) return false;
    setWaiting();
    const timer = setTimeout(() => {
      if (document.documentElement.dataset.arenaSuperLeagueCloud === 'loading') {
        setReady(navigator.onLine === false ? 'offline' : 'partial');
        scheduleRetry();
      }
    }, MAX_WAIT_MS);

    try {
      const available = await ensureFirebase();
      if (!available) throw new Error('Firebase indisponível');
      db = firebase.firestore();
      subscribe();
      const snapshot = await db.collection('arenaData').doc(DOC_ID).get({ source:'server' });
      await handleSnapshot(snapshot, 'server');
      retryCount = 0;
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Sincronização inicial da Super League não terminou', error);
      if (navigator.onLine === false) setReady('offline');
      else {
        setReady('partial');
        scheduleRetry();
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  function startSync(force = false) {
    if (!manager()) return Promise.resolve(false);
    const state = document.documentElement.dataset.arenaSuperLeagueCloud;
    if (!force && state === 'ready' && unsubscribe) return Promise.resolve(true);
    if (syncPromise) return syncPromise;
    syncPromise = connectAndSync().finally(() => { syncPromise = null; });
    return syncPromise;
  }

  function scheduleRetry() {
    if (retryTimer || retryCount >= 24 || !manager()) return;
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      retryCount += 1;
      startSync(true).catch(() => {});
    }, Math.min(6000, 650 + retryCount * 350));
  }

  async function uploadAdminLatest() {
    if (!isAdmin() || !manager()) return false;
    const available = await ensureFirebase();
    if (!available) {
      scheduleRetry();
      return false;
    }
    db = firebase.firestore();
    subscribe();
    try {
      let remote = [];
      try {
        const snapshot = await db.collection('arenaData').doc(DOC_ID).get({ source:'server' });
        remote = snapshot.exists && Array.isArray(snapshot.data()?.games) ? snapshot.data().games : [];
      } catch {}
      await writeMerged(remote);
      setReady('ready');
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Placar local aguardando reenvio para a nuvem', error);
      scheduleRetry();
      return false;
    }
  }

  function scheduleAdminUpload(delay = 900) {
    if (!isAdmin()) return;
    clearTimeout(adminUploadTimer);
    adminUploadTimer = setTimeout(() => {
      adminUploadTimer = 0;
      uploadAdminLatest().catch(() => {});
    }, delay);
  }

  function scheduleStatusCheck() {
    if (statusFrame) return;
    statusFrame = requestAnimationFrame(() => {
      statusFrame = 0;
      if (!manager()) return;
      startSync(false).catch(() => {});
      if (document.documentElement.dataset.arenaSuperLeagueCloud === 'loading') setWaiting();
    });
  }

  if (!document.getElementById('arenaSuperLeagueSyncGateStyles')) {
    const style = document.createElement('style');
    style.id = 'arenaSuperLeagueSyncGateStyles';
    style.textContent = `
      html.arena-sl-cloud-wait #giManager[data-tid="${TID}"] > .gi-content{display:none!important}
      html.arena-sl-cloud-wait #giManager[data-tid="${TID}"] #autoStandings:not([hidden]) #standCapture{display:none!important}
      .arena-sl-sync-status{display:flex;align-items:center;gap:11px;margin:12px 0;padding:14px 15px;border:1px solid rgba(79,223,143,.22);border-radius:15px;color:#e9f3ed;background:rgba(10,24,16,.96)}
      .arena-sl-sync-status b{display:block;font-size:11px}.arena-sl-sync-status small{display:block;margin-top:3px;color:#9fb0a5;font-size:8px;line-height:1.45}
      .arena-sl-sync-spinner{flex:0 0 auto;width:20px;height:20px;border:2px solid rgba(79,223,143,.18);border-top-color:#4fdf8f;border-radius:50%;animation:arenaSlSyncSpin .8s linear infinite}
      .arena-sl-sync-status[data-state="partial"],.arena-sl-sync-status[data-state="offline"]{border-color:rgba(216,178,72,.24)}
      @keyframes arenaSlSyncSpin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){.arena-sl-sync-spinner{animation-duration:1.5s}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('input', event => {
    const input = event.target instanceof Element ? event.target.closest(`#giManager[data-tid="${TID}"] .gi-score-input`) : null;
    if (input) scheduleAdminUpload(1500);
  }, true);
  document.addEventListener('blur', event => {
    const input = event.target instanceof Element ? event.target.closest(`#giManager[data-tid="${TID}"] .gi-score-input`) : null;
    if (input) scheduleAdminUpload(350);
  }, true);

  ['arena:bundle-loaded','arena:cloud-ready','arena:auth-changed','arena:tournaments-updated','arena:build-ready'].forEach(type => {
    window.addEventListener(type, scheduleStatusCheck);
  });
  window.addEventListener('arena:matches-updated', event => {
    if (event.detail?.tournamentId !== TID) return;
    const reason = String(event.detail?.reason || '');
    if (isAdmin() && !reason.includes('cloud') && !reason.includes('safe-cloud-merge')) scheduleAdminUpload(700);
    scheduleStatusCheck();
  });
  window.addEventListener('arena:quick-score-saved', event => {
    if (event.detail?.tournamentId === TID) scheduleAdminUpload(250);
  });
  window.addEventListener('online', () => startSync(true).then(() => {
    if (isAdmin()) scheduleAdminUpload(200);
  }).catch(() => {}), { passive:true });

  const observer = new MutationObserver(scheduleStatusCheck);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  const api = Object.freeze({
    version:2,
    startSync,
    uploadAdminLatest,
    mergeSafely,
    state:() => document.documentElement.dataset.arenaSuperLeagueCloud || 'idle'
  });
  window.ArenaBDASuperLeagueSyncGate = api;
  scheduleStatusCheck();
})();
