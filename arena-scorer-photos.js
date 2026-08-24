(() => {
  'use strict';

  if (window.ArenaBDAScorerPhotos?.version >= 1) return;

  const STYLE_ID = 'arenaScorerPhotosStyles';
  const INPUT_ID = 'arenaScorerPhotoInput';
  const cache = new Map();
  const loaded = new Set();
  const loading = new Map();
  let db = null;
  let frame = 0;
  let pendingUpload = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function tournamentId() {
    return String($('#giManager[data-tid]')?.dataset.tid || '');
  }

  function adminActive() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.());
  }

  function currentEmail() {
    return String(window.ArenaBDAAuth?.currentEmail?.() || '').trim().toLowerCase();
  }

  function safePart(value) {
    return encodeURIComponent(String(value || ''))
      .replace(/%/g, '_')
      .replace(/[^A-Za-z0-9_.~-]/g, '_')
      .slice(0, 90) || 'item';
  }

  function playerKey(player, team) {
    return `${norm(player)}::${norm(team)}`;
  }

  function hashKey(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function cacheKey(tid, player, team) {
    return `${tid}::${playerKey(player, team)}`;
  }

  function docId(tid, player, team) {
    const key = playerKey(player, team);
    return `scorer-photo-${safePart(tid)}-${hashKey(key)}-${safePart(player).slice(0, 36)}`;
  }

  async function ensureCloud() {
    try {
      await window.ArenaBDAEnsureCloud?.('scorer-player-photos');
    } catch {}
    if (!window.firebase || typeof firebase.firestore !== 'function') return null;
    try {
      db = firebase.firestore();
      return db;
    } catch {
      return null;
    }
  }

  function normalizePhoto(value, expectedKey = '') {
    if (!value || value.removed || !String(value.image || '').startsWith('data:image/')) return null;
    if (expectedKey && String(value.playerKey || '') && String(value.playerKey) !== expectedKey) return null;
    return {
      image: String(value.image),
      size: Math.max(0, Number(value.size) || 0),
      updatedAtMs: Math.max(0, Number(value.updatedAtMs) || 0),
      updatedBy: String(value.updatedBy || '')
    };
  }

  async function loadPhoto(tid, player, team, { force = false } = {}) {
    const key = cacheKey(tid, player, team);
    if (!force && loaded.has(key)) return cache.get(key) || null;
    if (!force && loading.has(key)) return loading.get(key);

    const request = (async () => {
      const firestore = db || await ensureCloud();
      if (!firestore) return cache.get(key) || null;
      try {
        const snapshot = await firestore.collection('arenaData').doc(docId(tid, player, team)).get();
        const photo = snapshot.exists ? normalizePhoto(snapshot.data(), playerKey(player, team)) : null;
        cache.set(key, photo);
        loaded.add(key);
        schedule();
        return photo;
      } catch (error) {
        console.warn('[Arena BDA] Não foi possível carregar a foto do artilheiro', error);
        return cache.get(key) || null;
      } finally {
        loading.delete(key);
      }
    })();

    loading.set(key, request);
    return request;
  }

  function canvasBlob(canvas, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Imagem inválida'));
      };
      image.src = url;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(blob);
    });
  }

  async function compressPhoto(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Selecione uma foto');
    if (file.size > 12 * 1024 * 1024) throw new Error('A foto é muito grande');

    const image = await fileToImage(file);
    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    const side = Math.min(sourceWidth, sourceHeight);
    const sx = Math.max(0, Math.round((sourceWidth - side) / 2));
    const sy = Math.max(0, Math.round((sourceHeight - side) / 2));
    const outputSize = 220;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Não foi possível processar a foto');
    context.fillStyle = '#07100c';
    context.fillRect(0, 0, outputSize, outputSize);
    context.drawImage(image, sx, sy, side, side, 0, 0, outputSize, outputSize);

    let blob = null;
    for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
      blob = await canvasBlob(canvas, quality);
      if (blob && blob.size <= 95 * 1024) break;
    }
    if (!blob) throw new Error('Não foi possível comprimir a foto');
    if (blob.size > 140 * 1024) throw new Error('Não foi possível reduzir a foto o suficiente');

    return {
      image: await blobToDataUrl(blob),
      size: blob.size
    };
  }

  async function savePhoto(tid, player, team, photo) {
    if (!adminActive()) return false;
    const firestore = db || await ensureCloud();
    if (!firestore) throw new Error('A nuvem ainda não está disponível');
    const now = Date.now();
    const key = playerKey(player, team);
    await firestore.collection('arenaData').doc(docId(tid, player, team)).set({
      dataset: 'scorer-photo',
      tournamentId: tid,
      player,
      team,
      playerKey: key,
      image: photo.image,
      size: photo.size,
      removed: false,
      updatedAtMs: now,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentEmail()
    });
    cache.set(cacheKey(tid, player, team), { ...photo, updatedAtMs: now, updatedBy: currentEmail() });
    loaded.add(cacheKey(tid, player, team));
    window.dispatchEvent(new CustomEvent('arena:scorer-photo-updated', { detail: { tournamentId: tid, player, team } }));
    schedule();
    return true;
  }

  async function removePhoto(tid, player, team) {
    if (!adminActive()) return false;
    const firestore = db || await ensureCloud();
    if (!firestore) throw new Error('A nuvem ainda não está disponível');
    const now = Date.now();
    await firestore.collection('arenaData').doc(docId(tid, player, team)).set({
      dataset: 'scorer-photo',
      tournamentId: tid,
      player,
      team,
      playerKey: playerKey(player, team),
      image: '',
      removed: true,
      updatedAtMs: now,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentEmail()
    });
    cache.set(cacheKey(tid, player, team), null);
    loaded.add(cacheKey(tid, player, team));
    window.dispatchEvent(new CustomEvent('arena:scorer-photo-updated', { detail: { tournamentId: tid, player, team } }));
    schedule();
    return true;
  }

  function rowIdentity(row) {
    const player = String(row.querySelector('b')?.textContent || '').trim();
    const rawTeam = String(row.querySelector('small')?.textContent || '').trim();
    const team = rawTeam.split('•')[0].trim();
    return { player, team };
  }

  function initials(player) {
    return String(player || 'J')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  function ensureFileInput() {
    let input = document.getElementById(INPUT_ID);
    if (input) return input;
    input = document.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    document.body.appendChild(input);
    return input;
  }

  function createAvatar(photo, player) {
    const avatar = document.createElement('button');
    avatar.type = 'button';
    avatar.className = `arena-player-photo-avatar${photo ? ' has-photo' : ''}`;
    avatar.setAttribute('aria-label', photo ? `Foto de ${player}` : `Sem foto para ${player}`);
    avatar.disabled = !photo;
    if (photo) {
      const img = document.createElement('img');
      img.src = photo.image;
      img.alt = `Foto de ${player}`;
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(player);
    }
    return avatar;
  }

  function enhanceRow(row, tid) {
    const { player, team } = rowIdentity(row);
    if (!player || !team) return;
    const key = cacheKey(tid, player, team);
    if (!loaded.has(key) && !loading.has(key)) loadPhoto(tid, player, team).catch(() => {});
    const photo = cache.get(key) || null;
    const signature = JSON.stringify([player, team, adminActive(), loaded.has(key), photo?.updatedAtMs || 0, Boolean(photo)]);
    if (row.dataset.arenaPlayerPhotoSignature === signature && row.querySelector('.arena-player-photo-profile')) return;
    row.dataset.arenaPlayerPhotoSignature = signature;

    const host = row.querySelector(':scope > div');
    if (!host) return;
    let profile = host.querySelector(':scope > .arena-player-photo-profile');
    const b = host.querySelector('b');
    const small = host.querySelector('small');

    if (!profile) {
      profile = document.createElement('div');
      profile.className = 'arena-player-photo-profile';
      const copy = document.createElement('div');
      copy.className = 'arena-player-photo-copy';
      if (b) copy.appendChild(b);
      if (small) copy.appendChild(small);
      host.appendChild(profile);
      profile.appendChild(copy);
    }

    const previousAvatar = profile.querySelector(':scope > .arena-player-photo-avatar');
    const avatar = createAvatar(photo, player);
    previousAvatar?.replaceWith(avatar);
    if (!previousAvatar) profile.prepend(avatar);

    let actions = profile.querySelector('.arena-player-photo-actions');
    if (!adminActive()) {
      actions?.remove();
      return;
    }
    if (!actions) {
      actions = document.createElement('span');
      actions.className = 'arena-player-photo-actions';
      profile.querySelector('.arena-player-photo-copy')?.appendChild(actions);
    }
    actions.innerHTML = '';

    const upload = document.createElement('button');
    upload.type = 'button';
    upload.className = 'arena-player-photo-action';
    upload.textContent = photo ? 'Trocar foto' : 'Adicionar foto';
    upload.dataset.playerPhotoUpload = 'true';
    upload.dataset.player = player;
    upload.dataset.team = team;
    actions.appendChild(upload);

    if (photo) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'arena-player-photo-action danger';
      remove.textContent = 'Remover';
      remove.dataset.playerPhotoRemove = 'true';
      remove.dataset.player = player;
      remove.dataset.team = team;
      actions.appendChild(remove);
    }
  }

  function decorate() {
    installStyles();
    const tid = tournamentId();
    if (!tid) return;
    $$('.arena-match-goal-row,.arena-scorer-row').forEach(row => enhanceRow(row, tid));
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      decorate();
    });
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .arena-player-photo-profile{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:8px;min-width:0}
      .arena-player-photo-copy{min-width:0}.arena-player-photo-copy>b,.arena-player-photo-copy>small{display:block}
      .arena-player-photo-avatar{display:grid;place-items:center;width:36px;height:36px;padding:0;overflow:hidden;border:1px solid rgba(216,178,72,.25);border-radius:50%;color:#d8b248;background:#111b14;font-size:9px;font-weight:900;letter-spacing:.03em}
      .arena-player-photo-avatar.has-photo{border-color:rgba(79,223,143,.42);background:#07100c}.arena-player-photo-avatar img{width:100%;height:100%;object-fit:cover}
      .arena-player-photo-avatar:disabled{opacity:1;cursor:default}
      .arena-player-photo-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
      .arena-player-photo-action{min-height:22px;padding:0 7px;border:1px solid rgba(216,178,72,.20);border-radius:7px;color:#e9ce78;background:rgba(216,178,72,.08);font-size:6px;font-weight:850;text-transform:none}
      .arena-player-photo-action.danger{color:#ff9aa4;border-color:rgba(255,105,120,.20);background:rgba(255,105,120,.07)}
      .arena-match-goal-row>.arena-match-ball{display:none}
      .arena-match-goal-row{grid-template-columns:minmax(0,1fr) auto 26px!important}
      .arena-match-goal-row>div{min-width:0}
      .arena-scorer-row>div{min-width:0}
      @media(max-width:760px){.arena-player-photo-profile{grid-template-columns:34px minmax(0,1fr);gap:7px}.arena-player-photo-avatar{width:32px;height:32px}.arena-player-photo-action{font-size:6px}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const upload = event.target.closest?.('[data-player-photo-upload]');
    if (upload) {
      if (!adminActive()) return;
      event.preventDefault();
      event.stopPropagation();
      const tid = tournamentId();
      const player = String(upload.dataset.player || '').trim();
      const team = String(upload.dataset.team || '').trim();
      if (!tid || !player || !team) return;
      pendingUpload = { tid, player, team, button: upload };
      const input = ensureFileInput();
      input.value = '';
      input.click();
      return;
    }

    const remove = event.target.closest?.('[data-player-photo-remove]');
    if (remove) {
      if (!adminActive()) return;
      event.preventDefault();
      event.stopPropagation();
      const tid = tournamentId();
      const player = String(remove.dataset.player || '').trim();
      const team = String(remove.dataset.team || '').trim();
      if (!tid || !player || !team) return;
      if (typeof confirm === 'function' && !confirm(`Remover a foto de ${player}?`)) return;
      remove.disabled = true;
      remove.textContent = 'Removendo...';
      removePhoto(tid, player, team).catch(error => {
        console.warn('[Arena BDA] Falha ao remover foto do artilheiro', error);
        if (typeof window.toast === 'function') window.toast(error?.message || 'Não foi possível remover a foto');
      }).finally(schedule);
    }
  });

  document.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== INPUT_ID) return;
    const target = pendingUpload;
    pendingUpload = null;
    const file = input.files?.[0];
    if (!target || !file || !adminActive()) return;
    const button = target.button;
    if (button?.isConnected) {
      button.disabled = true;
      button.textContent = 'Enviando...';
    }
    compressPhoto(file)
      .then(photo => savePhoto(target.tid, target.player, target.team, photo))
      .then(() => {
        if (typeof window.toast === 'function') window.toast(`Foto de ${target.player} salva`);
      })
      .catch(error => {
        console.warn('[Arena BDA] Falha ao salvar foto do artilheiro', error);
        if (typeof window.toast === 'function') window.toast(error?.message || 'Não foi possível salvar a foto');
      })
      .finally(schedule);
  });

  ['arena:bundle-loaded','arena:match-events-updated','arena:auth-changed','arena:cloud-ready','arena:scorer-photo-updated']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAScorerPhotos = Object.freeze({
    version:1,
    refresh:decorate,
    load:loadPhoto,
    save:savePhoto,
    remove:removePhoto
  });

  decorate();
})();
