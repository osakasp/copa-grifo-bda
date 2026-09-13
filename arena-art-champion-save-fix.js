(() => {
  'use strict';

  if (window.ArenaBDAChampionSaveFix?.version >= 1) return;

  const VERSION = 1;
  const NORMALIZE = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function isChampionButton(button) {
    const text = NORMALIZE(button?.textContent);
    const aria = NORMALIZE(button?.getAttribute('aria-label'));
    const title = NORMALIZE(button?.getAttribute('title'));
    return [text, aria, title].some(value => value.includes('salvar campeao') || value.includes('baixar campeao'));
  }

  function safeName() {
    const tournament = document.querySelector('#arenaDetail .arena-hero-copy h2')?.textContent?.trim()
      || document.querySelector('#giManager')?.dataset?.tid
      || 'arena-bda';
    return `${NORMALIZE(tournament).replace(/[^a-z0-9]+/g, '-') || 'arena-bda'}-campeao.png`;
  }

  function findStoredItem() {
    const modals = [document.getElementById('bdaProResult'), document.getElementById('bdaArtResult')].filter(Boolean);
    for (const modal of modals) {
      const items = modal._items || modal._artItems;
      if (!Array.isArray(items)) continue;
      const item = items.find(value => {
        const text = NORMALIZE(`${value?.fileName || ''} ${value?.label || ''}`);
        return text.includes('campeao') || text.includes('champion');
      }) || (items.length === 1 ? items[0] : null);
      if (item?.blob instanceof Blob && item.blob.size) return item;
    }
    return null;
  }

  function findVisual(button) {
    const roots = [];
    const localRoot = button.closest?.('#bdaProResult,#bdaArtResult,[role="dialog"],.bda-art-modal,.bda-art-result-modal,.bda-pro-champion');
    if (localRoot) roots.push(localRoot);
    roots.push(document.querySelector('.bda-pro-champion'), document.querySelector('.bda-art-result-modal'), document.querySelector('.bda-art-stage'));

    for (const root of roots.filter(Boolean)) {
      const canvas = [...root.querySelectorAll?.('canvas') || []].find(node => node.width > 0 && node.height > 0);
      if (canvas) return { type: 'canvas', node: canvas };
      const image = [...root.querySelectorAll?.('img') || []].find(node => node.currentSrc || node.src);
      if (image) return { type: 'image', node: image };
    }
    return null;
  }

  async function visualBlob(visual) {
    if (!visual?.node) return null;
    if (visual.type === 'canvas') {
      return new Promise((resolve, reject) => visual.node.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('Canvas vazio')), 'image/png', 1));
    }

    const src = visual.node.currentSrc || visual.node.src || '';
    if (!src) return null;
    try {
      const response = await fetch(src, { mode: 'cors', cache: 'no-store' });
      const blob = await response.blob();
      if (blob.size) return blob;
    } catch {}

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;
          if (!canvas.width || !canvas.height) throw new Error('Imagem vazia');
          canvas.getContext('2d').drawImage(image, 0, 0);
          canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('PNG indisponível')), 'image/png', 1);
        } catch (error) { reject(error); }
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  function download(blob, filename) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error('O banner ainda não está pronto');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    try { link.click(); }
    finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }

  async function share(blob, filename) {
    if (!navigator.share || typeof File !== 'function') return false;
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
      await navigator.share({ files: [file], title: 'Campeão Arena BDA' });
      return true;
    } catch (error) {
      return error?.name === 'AbortError';
    }
  }

  async function save(button) {
    const filename = safeName();
    const item = findStoredItem();
    const visual = item ? null : findVisual(button);
    const blob = item?.blob || await visualBlob(visual);
    if (!blob) throw new Error('Não encontrei a arte do campeão para salvar');
    try {
      download(blob, filename);
      button.textContent = 'Salvo ✓';
      window.toast?.('Banner do campeão salvo no dispositivo');
      return true;
    } catch {
      const shared = await share(blob, filename);
      if (shared) {
        button.textContent = 'Compartilhado ✓';
        return true;
      }
      throw new Error('Não foi possível salvar o banner do campeão');
    } finally {
      setTimeout(() => { if (button.isConnected) button.textContent = 'Salvar campeão'; }, 2200);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button,a,[role="button"]');
    if (!button || !isChampionButton(button)) return;
    const item = findStoredItem();
    const visual = item ? null : findVisual(button);
    if (!item && !visual) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.arenaChampionSaving === '1') return;
    button.dataset.arenaChampionSaving = '1';
    button.disabled = true;
    save(button).catch(error => window.toast?.(error.message || 'Não foi possível salvar o banner do campeão')).finally(() => {
      if (button.isConnected) {
        button.disabled = false;
        button.dataset.arenaChampionSaving = '0';
      }
    });
  }, true);

  window.ArenaBDAChampionSaveFix = Object.freeze({ version: VERSION, save });
})();
