(() => {
  'use strict';

  const ADMIN_EMAIL = 'miniamikaren@gmail.com';
  const TEAM_KEY = 'bda-v2-teams';
  const COLLECTION = 'arenaData';
  const MAX_BADGE_SIDE = 240;
  const MAX_SAFE_ITEM_BYTES = 700 * 1024;

  if (!window.firebase || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const root = db.collection(COLLECTION);
  const metaRef = root.doc('meta');
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
  const currentSetItem = Storage.prototype.setItem;

  let currentUser = null;
  let timer = 0;
  let running = false;
  let queued = false;
  let internalWrite = false;
  let lastTeamsJson = localStorage.getItem(TEAM_KEY) || '[]';

  function isAdmin() {
    return Boolean(
      currentUser && String(currentUser.email || '').toLowerCase() === ADMIN_EMAIL
    );
  }

  function notify(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  function statusElement() {
    return document.querySelector('.cloud-status');
  }

  function setStatus(text, state = '', detail = '') {
    const element = statusElement();
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
    element.title = detail;
  }

  function readTeams() {
    try {
      const values = JSON.parse(localStorage.getItem(TEAM_KEY));
      return Array.isArray(values) ? values : [];
    } catch {
      return [];
    }
  }

  function bytes(value) {
    return new Blob([JSON.stringify(value)]).size;
  }

  function imageFromSource(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Escudo inválido'));
      image.src = src;
    });
  }

  async function compressBadge(src) {
    if (!String(src || '').startsWith('data:image/')) return src;

    const image = await imageFromSource(src);
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

      if (team.badge && bytes(team) > 360 * 1024) {
        try {
          const smaller = await compressBadge(team.badge);
          if (smaller && smaller !== team.badge) {
            team.badge = smaller;
            changed = true;
          }
        } catch (error) {
          console.warn('Não foi possível reduzir um escudo', error);
        }
      }

      if (bytes(team) > MAX_SAFE_ITEM_BYTES) {
        throw new Error(`O escudo de ${team.name || 'um time'} ainda está grande demais`);
      }

      prepared.push(team);
    }

    if (changed) {
      internalWrite = true;
      try {
        currentSetItem.call(localStorage, TEAM_KEY, JSON.stringify(prepared));
        lastTeamsJson = JSON.stringify(prepared);

        if (typeof teams !== 'undefined' && Array.isArray(teams)) {
          teams = JSON.parse(JSON.stringify(prepared));
          if (typeof renderTeams === 'function') renderTeams();
        }
      } finally {
        internalWrite = false;
      }
    }

    return prepared;
  }

  function documentId(index) {
    return `team-${String(index).padStart(4, '0')}`;
  }

  async function writeTeams(values) {
    const metaSnapshot = await metaRef.get();
    const meta = metaSnapshot.exists ? metaSnapshot.data() : {};
    const previousCount = Number(meta?.counts?.teams || 0);
    const revision = `${Date.now()}-teams-${Math.random().toString(36).slice(2, 8)}`;
    const operations = [];

    values.forEach((value, index) => {
      operations.push({
        type: 'set',
        ref: root.doc(documentId(index)),
        data: {
          dataset: 'teams',
          position: index,
          revision,
          value
        }
      });
    });

    for (let index = values.length; index < previousCount; index += 1) {
      operations.push({ type: 'delete', ref: root.doc(documentId(index)) });
    }

    for (let start = 0; start < operations.length; start += 350) {
      const batch = db.batch();
      operations.slice(start, start + 350).forEach(operation => {
        if (operation.type === 'delete') batch.delete(operation.ref);
        else batch.set(operation.ref, operation.data);
      });
      await batch.commit();
    }

    await metaRef.set({
      initialized: true,
      schemaVersion: 2,
      counts: {
        ...(meta?.counts || {}),
        teams: values.length
      },
      revisions: {
        ...(meta?.revisions || {}),
        teams: revision
      },
      updatedAt: serverTimestamp(),
      updatedBy: String(currentUser.email || '').toLowerCase()
    }, { merge: true });
  }

  function errorMessage(error) {
    const code = String(error?.code || '');

    if (code.includes('permission-denied')) {
      return 'As regras do Firestore não liberaram esta conta';
    }

    if (code.includes('resource-exhausted')) {
      return 'O limite temporário do Firestore foi atingido';
    }

    if (code.includes('unavailable')) {
      return 'A internet ou o Firestore está indisponível';
    }

    if (code.includes('not-found')) {
      return 'O registro principal da nuvem estava ausente';
    }

    return error?.message || 'Falha ao enviar o time para a nuvem';
  }

  async function synchronizeTeams() {
    if (!isAdmin()) return;

    if (running) {
      queued = true;
      return;
    }

    running = true;
    queued = false;
    setStatus('Salvando time', 'warn');

    try {
      const prepared = await prepareTeams(readTeams());
      await writeTeams(prepared);
      setStatus('Sincronizado', 'ok');
      notify('Time salvo e sincronizado');
    } catch (error) {
      console.error('Falha ao sincronizar times', error);
      const message = errorMessage(error);
      setStatus('Salvo no aparelho', 'warn', message);
      notify(`${message}. O time continua salvo neste aparelho.`);
    } finally {
      running = false;
      if (queued) scheduleSync(700);
    }
  }

  function scheduleSync(delay = 1500) {
    if (!isAdmin()) return;
    clearTimeout(timer);
    timer = window.setTimeout(synchronizeTeams, delay);
  }

  Storage.prototype.setItem = function setItemWithTeamRecovery(key, value) {
    currentSetItem.call(this, key, value);

    if (this === localStorage && key === TEAM_KEY && !internalWrite) {
      lastTeamsJson = String(value || '[]');
      scheduleSync();
    }
  };

  auth.onAuthStateChanged(user => {
    currentUser = user;

    if (isAdmin()) {
      const current = localStorage.getItem(TEAM_KEY) || '[]';
      if (current !== lastTeamsJson || statusElement()?.dataset.state === 'error') {
        lastTeamsJson = current;
        scheduleSync(900);
      }
    }
  });

  const observer = new MutationObserver(() => {
    const element = statusElement();
    if (isAdmin() && element?.dataset.state === 'error') {
      scheduleSync(1200);
    }
  });

  function startObserver() {
    const element = statusElement();
    if (!element) return;

    observer.observe(element, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }
})();
