(() => {
  'use strict';

  const TEAM_KEY = 'bda-v2-teams';
  const MAX_BADGE_SIDE = 240;
  const COMPRESS_THRESHOLD = 360 * 1024;
  const MAX_SAFE_ITEM_BYTES = 700 * 1024;

  let timer = 0;
  let running = false;
  let queued = false;
  let lastPreparedJson = localStorage.getItem(TEAM_KEY) || '[]';

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
    let changed = false;

    for (const original of values) {
      const team = { ...original };

      if (team.badge && bytes(team) > COMPRESS_THRESHOLD) {
        try {
          const smaller = await compressBadge(team.badge);
          if (smaller && smaller !== team.badge && smaller.length < String(team.badge).length) {
            team.badge = smaller;
            changed = true;
          }
        } catch (error) {
          console.warn('Não foi possível reduzir um escudo', error);
        }
      }

      if (bytes(team) > MAX_SAFE_ITEM_BYTES) {
        throw new Error(`O cadastro de ${team.name || 'um time'} ainda está grande demais para a nuvem`);
      }

      prepared.push(team);
    }

    return { prepared, changed };
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
      const { prepared, changed } = await prepareTeams(current);
      const preparedJson = JSON.stringify(prepared);

      if (changed && preparedJson !== currentJson) {
        localStorage.setItem(TEAM_KEY, preparedJson);
        lastPreparedJson = preparedJson;

        if (typeof window.teams !== 'undefined' && Array.isArray(window.teams)) {
          window.teams.splice(0, window.teams.length, ...prepared);
        }

        if (typeof renderTeams === 'function') renderTeams();
        window.dispatchEvent(new CustomEvent('arena:teams-prepared-for-cloud', {
          detail: { count: prepared.length }
        }));
        notify('Escudos preparados para sincronização');
      } else {
        lastPreparedJson = currentJson;
      }

      return { changed, teams: prepared };
    } catch (error) {
      console.error('Falha ao preparar os times para a nuvem', error);
      notify(error.message || 'Não foi possível preparar os times para a nuvem');
      return { changed: false, error };
    } finally {
      running = false;
      if (queued) schedulePreparation(500);
    }
  }

  function schedulePreparation(delay = 700) {
    clearTimeout(timer);
    timer = window.setTimeout(() => runPreparation(), delay);
  }

  window.addEventListener('arena:team-profile-updated', () => schedulePreparation(250));
  window.addEventListener('arena:team-edit-request-updated', () => schedulePreparation(500));
  window.addEventListener('arena:cloud-prepare-teams', () => schedulePreparation(0));
  window.addEventListener('storage', event => {
    if (event.key !== TEAM_KEY || event.newValue === lastPreparedJson) return;
    schedulePreparation(350);
  });

  if (window.ArenaBDAAuth?.subscribe) {
    window.ArenaBDAAuth.subscribe(state => {
      if (state.isAdmin) schedulePreparation(400);
    });
  } else if (window.firebase?.auth) {
    firebase.auth().onAuthStateChanged(() => schedulePreparation(400));
  }

  window.ArenaBDACloudRecovery = Object.freeze({
    prepare: options => runPreparation({ force: Boolean(options?.force) }),
    schedule: schedulePreparation,
    state: () => ({ running, queued, lastPreparedJson })
  });
})();
