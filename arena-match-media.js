(() => {
  'use strict';

  if (window.ArenaBDAMatchMedia?.version >= 1) return;

  const STYLE_ID = 'arenaMatchMediaStyles';
  const cache = new Map();
  const loaded = new Set();
  const loading = new Map();
  let db = null;
  let frame = 0;
  let lightbox = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
      .slice(0, 140) || 'item';
  }

  function mediaKey(tid, gameId) {
    return `${tid}::${gameId}`;
  }

  function docId(tid, gameId) {
    return `match-media-${safePart(tid)}-${safePart(gameId)}`;
  }

  async function ensureCloud() {
    try {
      await window.ArenaBDAEnsureCloud?.('match-media');
    } catch {}
    if (!window.firebase || typeof firebase.firestore !== 'function') return null;
    try {
      db = firebase.firestore();
      return db;
    } catch {
      return null;
    }
  }

  function normalizeMedia(value) {
    if (!value || value.removed || !String(value.image || '').startsWith('data:image/')) return null;
    return {
      image: String(value.image),
      width: Math.max(0, Number(value.width) || 0),
      height: Math.max(0, Number(value.height) || 0),
      size: Math.max(0, Number(value.size) || 0),
      updatedAtMs: Math.max(0, Number(value.updatedAtMs) || 0),
      updatedBy: String(value.updatedBy || '')
    };
  }

  async function loadMedia(tid, gameId, { force = false } = {}) {
    const key = mediaKey(tid, gameId);
    if (!force && loaded.has(key)) return cache.get(key) || null;
    if (!force && loading.has(key)) return loading.get(key);

    const request = (async () => {
      const firestore = db || await ensureCloud();
      if (!firestore) return cache.get(key) || null;
      try {
        const snapshot = await firestore.collection('arenaData').doc(docId(tid, gameId)).get();
        const media = snapshot.exists ? normalizeMedia(snapshot.data()) : null;
        cache.set(key, media);
        loaded.add(key);
        schedule();
        return media;
      } catch (error) {
        console.warn('[Arena BDA] Não foi possível carregar o print da partida', error);
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

  async function compressImage(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Selecione uma imagem');
    if (file.size > 15 * 1024 * 1024) throw new Error('A imagem é muito grande');

    const image = await fileToImage(file);
    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Não foi possível processar a imagem');

    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
    const targetBytes = 360 * 1024;
    let blob = null;

    for (let pass = 0; pass < 3; pass += 1) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#050805';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        blob = await canvasBlob(canvas, quality);
        if (blob && blob.size <= targetBytes) break;
      }
      if (blob && blob.size <= targetBytes) break;
      width = Math.max(640, Math.round(width * 0.82));
      height = Math.max(360, Math.round(height * 0.82));
    }

    if (!blob) throw new Error('Não foi possível comprimir a imagem');
    if (blob.size > 650 * 1024) throw new Error('Não foi possível reduzir o print o suficiente');

    return {
      image: await blobToDataUrl(blob),
      width,
      height,
      size: blob.size
    };
  }

  async function saveMedia(tid, gameId, media) {
    if (!adminActive()) return false;
    const firestore = db || await ensureCloud();
    if (!firestore) throw new Error('A nuvem ainda não está disponível');
    const now = Date.now();
    await firestore.collection('arenaData').doc(docId(tid, gameId)).set({
      dataset: 'match-media',
      tournamentId: tid,
      gameId,
      image: media.image,
      width: media.width,
      height: media.height,
      size: media.size,
      removed: false,
      updatedAtMs: now,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentEmail()
    });
    cache.set(mediaKey(tid, gameId), { ...media, updatedAtMs: now, updatedBy: currentEmail() });
    loaded.add(mediaKey(tid, gameId));
    schedule();
    window.dispatchEvent(new CustomEvent('arena:match-media-updated', { detail: { tournamentId: tid, gameId } }));
    return true;
  }

  async function removeMedia(tid, gameId) {
    if (!adminActive()) return false;
    const firestore = db || await ensureCloud();
    if (!firestore) throw new Error('A nuvem ainda não está disponível');
    const now = Date.now();
    await firestore.collection('arenaData').doc(docId(tid, gameId)).set({
      dataset: 'match-media',
      tournamentId: tid,
      gameId,
      image: '',
      removed: true,
      updatedAtMs: now,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentEmail()
    });
    cache.set(mediaKey(tid, gameId), null);
    loaded.add(mediaKey(tid, gameId));
    schedule();
    window.dispatchEvent(new CustomEvent('arena:match-media-updated', { detail: { tournamentId: tid, gameId } }));
    return true;
  }

  function mediaHtml(tid, gameId) {
    const key = mediaKey(tid, gameId);
    const media = cache.get(key) || null;
    const waiting = loading.has(key) && !loaded.has(key);
    const actions = adminActive()
      ? `<div class="arena-match-media-actions">
          <label class="arena-match-media-upload">${media ? 'Trocar print' : 'Adicionar print'}<input type="file" accept="image/*" data-match-media-input="${esc(gameId)}"></label>
          ${media ? `<button type="button" data-match-media-remove="${esc(gameId)}">Remover</button>` : ''}
        </div>`
      : '';

    return `<section class="arena-match-media" data-match-media="${esc(gameId)}">
      <header><div><span class="eyebrow">Registro da partida</span><h4>Print da partida</h4></div>${actions}</header>
      ${media
        ? `<button type="button" class="arena-match-media-image" data-match-media-open="${esc(gameId)}" aria-label="Ampliar print da partida"><img src="${esc(media.image)}" alt="Print da partida"></button>`
        : waiting
          ? '<div class="arena-match-media-empty">Carregando print...</div>'
          : `<div class="arena-match-media-empty">${adminActive() ? 'Adicione um print do resultado ou da tela da partida.' : 'Nenhum print publicado para esta partida.'}</div>`}
      <small>O print é comprimido antes de ser enviado e não altera o placar oficial.</small>
    </section>`;
  }

  function decorateCard(card, tid) {
    if (!card.classList.contains('arena-match-expanded')) return;
    const gameId = String(card.dataset.card || card.dataset.gameId || '');
    if (!gameId) return;
    const detail = card.querySelector(':scope > .arena-match-detail-panel');
    if (!detail) return;

    const key = mediaKey(tid, gameId);
    if (!loaded.has(key) && !loading.has(key)) loadMedia(tid, gameId).catch(() => {});

    const previous = detail.querySelector(':scope > .arena-match-media');
    const signature = JSON.stringify([
      adminActive(),
      loading.has(key),
      loaded.has(key),
      cache.get(key)?.updatedAtMs || 0,
      Boolean(cache.get(key))
    ]);
    if (previous?.dataset.signature === signature) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = mediaHtml(tid, gameId).trim();
    const next = wrapper.firstElementChild;
    next.dataset.signature = signature;
    if (previous) previous.replaceWith(next);
    else detail.insertBefore(next, detail.firstElementChild?.nextSibling || detail.firstChild);
  }

  function decorate() {
    installStyles();
    const manager = $('#giManager[data-tid]');
    if (!manager) return;
    const tid = String(manager.dataset.tid || '');
    if (!tid) return;
    $$('.gi-game.arena-match-expanded', manager).forEach(card => decorateCard(card, tid));
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      decorate();
    });
  }

  function openLightbox(src) {
    if (!src) return;
    closeLightbox();
    const node = document.createElement('div');
    node.className = 'arena-match-media-lightbox';
    node.innerHTML = `<button type="button" aria-label="Fechar">×</button><img src="${esc(src)}" alt="Print ampliado da partida">`;
    node.addEventListener('click', event => {
      if (event.target === node || event.target.closest('button')) closeLightbox();
    });
    document.body.appendChild(node);
    lightbox = node;
  }

  function closeLightbox() {
    lightbox?.remove();
    lightbox = null;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .arena-match-media{margin:0 0 10px;padding:11px;border:1px solid rgba(216,178,72,.14);border-radius:12px;background:#07130c;cursor:default}
      .arena-match-media>header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .arena-match-media h4{margin:3px 0 0;color:#f2f6f3;font-size:16px;text-transform:none}
      .arena-match-media-actions{display:flex;align-items:center;gap:6px}
      .arena-match-media-actions :is(button,.arena-match-media-upload){display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 9px;border:1px solid rgba(216,178,72,.18);border-radius:8px;color:#f1d97f;background:#0b1a11;font-size:7px;font-weight:900;text-transform:uppercase;cursor:pointer}
      .arena-match-media-actions button{color:#ff9aa4;border-color:rgba(255,120,130,.16);background:#250b0e}
      .arena-match-media-upload input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
      .arena-match-media-image{overflow:hidden;display:block;width:100%;max-height:430px;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#030806;cursor:zoom-in}
      .arena-match-media-image img{display:block;width:100%;max-height:430px;object-fit:contain;background:#030806}
      .arena-match-media-empty{display:grid;place-items:center;min-height:118px;padding:18px;border:1px dashed rgba(255,255,255,.09);border-radius:11px;color:#809289;background:#040a06;font-size:9px;text-align:center}
      .arena-match-media>small{display:block;margin-top:7px;color:#64756b;font-size:7px;text-align:right}
      .arena-match-media-lightbox{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.9);backdrop-filter:blur(8px)}
      .arena-match-media-lightbox img{display:block;max-width:min(96vw,1400px);max-height:92vh;border-radius:12px;object-fit:contain;box-shadow:0 22px 70px rgba(0,0,0,.55)}
      .arena-match-media-lightbox button{position:fixed;top:calc(12px + env(safe-area-inset-top));right:14px;width:42px;height:42px;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:12px;color:#fff;background:#101511;font-size:25px;line-height:1}
      @media(max-width:760px){
        .arena-match-media{padding:9px}.arena-match-media>header{align-items:flex-start;flex-direction:column}.arena-match-media-actions{width:100%}.arena-match-media-actions :is(button,.arena-match-media-upload){flex:1;min-height:36px}
        .arena-match-media-image,.arena-match-media-image img{max-height:62vh}.arena-match-media-empty{min-height:96px}
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('change', async event => {
    const input = event.target.closest?.('[data-match-media-input]');
    if (!input || !adminActive()) return;
    event.stopPropagation();
    const file = input.files?.[0];
    if (!file) return;
    const tid = tournamentId();
    const gameId = String(input.dataset.matchMediaInput || '');
    if (!tid || !gameId) return;

    const label = input.closest('.arena-match-media-upload');
    const original = label?.childNodes?.[0]?.nodeValue || '';
    if (label?.firstChild) label.firstChild.nodeValue = 'Processando...';
    input.disabled = true;
    try {
      const media = await compressImage(file);
      await saveMedia(tid, gameId, media);
    } catch (error) {
      console.error(error);
      if (typeof toast === 'function') toast(error?.message || 'Não foi possível salvar o print');
      else alert(error?.message || 'Não foi possível salvar o print');
    } finally {
      input.disabled = false;
      input.value = '';
      if (label?.firstChild) label.firstChild.nodeValue = original || 'Adicionar print';
      schedule();
    }
  });

  document.addEventListener('click', async event => {
    const open = event.target.closest?.('[data-match-media-open]');
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      const key = mediaKey(tournamentId(), String(open.dataset.matchMediaOpen || ''));
      openLightbox(cache.get(key)?.image || '');
      return;
    }

    const remove = event.target.closest?.('[data-match-media-remove]');
    if (remove) {
      event.preventDefault();
      event.stopPropagation();
      if (!adminActive()) return;
      const tid = tournamentId();
      const gameId = String(remove.dataset.matchMediaRemove || '');
      if (!tid || !gameId) return;
      if (typeof confirm === 'function' && !confirm('Remover o print desta partida?')) return;
      remove.disabled = true;
      try {
        await removeMedia(tid, gameId);
      } catch (error) {
        console.error(error);
        if (typeof toast === 'function') toast(error?.message || 'Não foi possível remover o print');
        else alert(error?.message || 'Não foi possível remover o print');
      } finally {
        remove.disabled = false;
      }
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeLightbox();
  });

  ['arena:bundle-loaded','arena:matches-updated','arena:tournaments-updated','arena:auth-changed','arena:cloud-ready','arena:match-events-updated','arena:match-media-updated']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAMatchMedia = Object.freeze({
    version: 1,
    refresh: decorate,
    load: loadMedia,
    get: (tid, gameId) => cache.get(mediaKey(tid, gameId)) || null,
    compressImage
  });

  decorate();
})();