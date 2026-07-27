(() => {
  'use strict';

  const TEAM_KEY = 'bda-v2-teams';
  const MAX_BADGE_SIDE = 240;
  const DATASET_COMPRESS_THRESHOLD = 360 * 1024;
  const ITEM_COMPRESS_THRESHOLD = 180 * 1024;
  const MIN_BADGE_SOURCE_CHARS = 14 * 1024;
  const MAX_SAFE_ITEM_BYTES = 700 * 1024;

  let timer = 0;
  let idleHandle = 0;
  let running = false;
  let queued = false;
  let lastPreparedJson = localStorage.getItem(TEAM_KEY) || '[]';
  let lastMetrics = { beforeBytes: 0, afterBytes: 0, optimized: 0 };

  function notify(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  function isAdminSession() {
    if (window.ArenaBDAAuth?.isAdmin) return window.ArenaBDAAuth.isAdmin();
    try {
      const user = window.firebase?.auth?.()?.currentUser;
      const email = String(user?.email || '').toLowerCase();
      const allowed = window.ARENA_ADMIN_EMAILS || [];
      return Boolean(user && allowed.includes(email));
    } catch {
      return false;
    }
  }

  function readTeams() {
    try {
      const values = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
      return Array.isArray(values) ? values : [];
    } catch {
      return [];
    }
  }

  function bytes(value) {
    return new Blob([JSON.stringify(value)]).size;
  }

  function yieldToBrowser() {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 120 });
      else requestAnimationFrame(() => resolve());
    });
  }

  function imageFromSource(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Escudo inválido'));
      image.src = source;
    });
  }

  async function compressBadge(source) {
    if (!String(source || '').startsWith('data:image/')) return source;

    const image = await imageFromSource(source);
    const sourceSize = Math.min(image.width, image.height);
    const sourceX = Math.max(0, (image.width - sourceSize) / 2);
    const sourceY = Math.max(0, (image.height - sourceSize) / 2);
    const outputSize = Math.max(1, Math.min(MAX_BADGE_SIDE, sourceSize));
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');

    if (!context) throw new Error('Não foi possível reduzir o escudo');

    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    return canvas.toDataURL('image/webp', 0.76);
  }

  async function prepareTeams(values) {
    const prepared = [];
    const beforeBytes = bytes(values);
    const largeDataset = beforeBytes > DATASET_COMPRESS_THRESHOLD;
    let changed = false;
    let optimized = 0;

    for (let index = 0; index < values.length; index += 1) {
      const original = values[index];
      const team = { ...original };
      const badge = String(team.badge || '');
      const shouldOptimizeBadge = badge.startsWith('data:image/') && (
        bytes(team) > ITEM_COMPRESS_THRESHOLD
        || (largeDataset && badge.length > MIN_BADGE_SOURCE_CHARS)
      );

      if (shouldOptimizeBadge) {
        try {
          const smaller = await compressBadge(team.badge);
          if (smaller && smaller !== team.badge && smaller.length < badge.length) {
            team.badge = smaller;
            changed = true;
            optimized += 1;
          }
        } catch (error) {
          console.warn('Não foi possível reduzir um escudo', error);
        }
      }

      if (bytes(team) > MAX_SAFE_ITEM_BYTES) {
        throw new Error(`O cadastro de ${team.name || 'um time'} ainda está grande demais para a nuvem`);
      }

      prepared.push(team);
      if (index > 0 && index % 6 === 0) await yieldToBrowser();
    }

    const afterBytes = bytes(prepared);
    return { prepared, changed, beforeBytes, afterBytes, optimized };
  }

  async function runPreparation({ force = false } = {}) {
    if (!isAdminSession() && !force) return { changed: false, skipped: true };

    if (running) {
      queued = true;
      return { changed: false, queued: true };
    }

    running = true;
    queued = false;

    try {
      const current = readTeams();
      const currentJson = JSON.stringify(current);
      const result = await prepareTeams(current);
      const preparedJson = JSON.stringify(result.prepared);
      lastMetrics = {
        beforeBytes: result.beforeBytes,
        afterBytes: result.afterBytes,
        optimized: result.optimized
      };

      if (result.changed && preparedJson !== currentJson) {
        localStorage.setItem(TEAM_KEY, preparedJson);
        lastPreparedJson = preparedJson;

        if (typeof window.teams !== 'undefined' && Array.isArray(window.teams)) {
          window.teams.splice(0, window.teams.length, ...result.prepared);
        }

        if (typeof renderTeams === 'function') renderTeams();
        window.dispatchEvent(new CustomEvent('arena:teams-prepared-for-cloud', {
          detail: {
            count: result.prepared.length,
            optimized: result.optimized,
            beforeBytes: result.beforeBytes,
            afterBytes: result.afterBytes
          }
        }));
        const savedKb = Math.max(0, Math.round((result.beforeBytes - result.afterBytes) / 1024));
        notify(savedKb ? `${result.optimized} escudos otimizados • ${savedKb} KB economizados` : 'Escudos preparados para sincronização');
      } else {
        lastPreparedJson = currentJson;
      }

      return { ...result, teams: result.prepared };
    } catch (error) {
      console.error('Falha ao preparar os times para a nuvem', error);
      notify(error.message || 'Não foi possível preparar os times para a nuvem');
      return { changed: false, error };
    } finally {
      running = false;
      if (queued) schedulePreparation(900);
    }
  }

  function schedulePreparation(delay = 1500) {
    clearTimeout(timer);
    if ('cancelIdleCallback' in window && idleHandle) cancelIdleCallback(idleHandle);
    idleHandle = 0;
    timer = window.setTimeout(() => {
      const run = () => {
        idleHandle = 0;
        runPreparation();
      };
      if ('requestIdleCallback' in window) idleHandle = requestIdleCallback(run, { timeout: 3000 });
      else run();
    }, delay);
  }

  window.addEventListener('arena:team-profile-updated', () => schedulePreparation(900));
  window.addEventListener('arena:team-edit-request-updated', () => schedulePreparation(1100));
  window.addEventListener('arena:cloud-prepare-teams', () => schedulePreparation(0));
  window.addEventListener('storage', event => {
    if (event.key !== TEAM_KEY || event.newValue === lastPreparedJson) return;
    schedulePreparation(1200);
  });

  if (window.ArenaBDAAuth?.subscribe) {
    window.ArenaBDAAuth.subscribe(state => {
      if (state.isAdmin) schedulePreparation(2600);
    });
  } else if (window.firebase?.auth) {
    firebase.auth().onAuthStateChanged(() => schedulePreparation(2600));
  }

  window.ArenaBDACloudRecovery = Object.freeze({
    prepare: options => runPreparation({ force: Boolean(options?.force) }),
    schedule: schedulePreparation,
    state: () => ({ running, queued, lastPreparedJson, metrics: { ...lastMetrics } })
  });
})();