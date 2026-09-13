(() => {
  'use strict';

  if (window.ArenaBDACopaBDALivreResultFix?.version >= 1) return;

  const VERSION = 1;
  const MATCH_KEY = 'bda-v3-confrontos';
  const TID = 'copa-bda-livre';
  let running = false;
  let retryTimer = 0;

  const readStore = () => {
    try {
      const value = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  };

  const writeGames = games => {
    const store = readStore();
    store[TID] = games;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
  };

  const hasResult = game => {
    if (game?.wo === 'a' || game?.wo === 'b') return true;
    const a = game?.a;
    const b = game?.b;
    return a !== '' && a != null && b !== '' && b != null && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b));
  };

  const freshness = game => Number(game?.updated || game?.created || 0);

  function mergeRemote(local, remote) {
    const lm = new Map((Array.isArray(local) ? local : []).map(g => [String(g?.id || ''), g]));
    const rm = new Map((Array.isArray(remote) ? remote : []).map(g => [String(g?.id || ''), g]));
    const ids = new Set([...lm.keys(), ...rm.keys()].filter(Boolean));
    return [...ids].map(id => {
      const l = lm.get(id);
      const r = rm.get(id);
      if (!l) return r;
      if (!r) return l;
      const lr = hasResult(l), rr = hasResult(r);
      if (rr && !lr) return r;
      if (lr && !rr) return l;
      return freshness(r) > freshness(l) ? r : l;
    }).filter(Boolean);
  }

  async function sync() {
    if (running) return false;
    if (!document.querySelector(`#giManager[data-tid="${TID}"]`)) return false;
    if (!window.firebase || typeof firebase.firestore !== 'function') return false;
    running = true;
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection('arenaData').doc(`confrontos-${TID}`).get({ source:'server' });
      const remote = snapshot.data()?.games;
      if (!Array.isArray(remote) || !remote.length) return false;

      const local = readStore()[TID];
      const localList = Array.isArray(local) ? local : [];
      const merged = mergeRemote(localList, remote);
      const localResults = localList.filter(hasResult).length;
      const mergedResults = merged.filter(hasResult).length;

      if (mergedResults > localResults || (!localList.length && merged.length)) {
        writeGames(merged);
        window.dispatchEvent(new CustomEvent('arena:matches-updated', {
          detail:{ tournamentId:TID, source:'copa-bda-livre-result-fix', count:merged.length }
        }));
        window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
          detail:{ tournamentId:TID, source:'copa-bda-livre-result-fix' }
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível atualizar os resultados da Copa BDA LIVRE', error);
      return false;
    } finally {
      running = false;
    }
  }

  function schedule() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      sync().catch(() => {});
    }, 500);
  }

  ['arena:bundle-loaded','arena:cloud-ready','arena:auth-changed','arena:matches-updated','arena:tournaments-updated']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(() => {
    if (document.querySelector(`#giManager[data-tid="${TID}"]`)) schedule();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDACopaBDALivreResultFix = Object.freeze({ version:VERSION, sync });
  schedule();
})();
