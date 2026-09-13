(() => {
  'use strict';

  if (window.ArenaBDAArtSaveFix?.version >= 1) return;

  const VERSION = 1;
  const MODAL_ID = 'bdaProResult';

  function itemFromButton(button) {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || !Array.isArray(modal._items)) return null;
    const index = Number(button?.dataset?.proDl);
    return Number.isInteger(index) ? modal._items[index] || null : null;
  }

  function safeName(item) {
    const base = String(item?.fileName || item?.label || 'arena-bda-banner')
      .replace(/\.png$/i, '')
      .split(/[\\/]/).pop()
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'arena-bda-banner';
    return `${base}.png`;
  }

  function downloadBlob(blob, filename) {
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

  async function shareFallback(item, filename) {
    if (!navigator.share || typeof File !== 'function') return false;
    try {
      const file = new File([item.blob], filename, { type:'image/png' });
      if (navigator.canShare && !navigator.canShare({ files:[file] })) return false;
      await navigator.share({ files:[file], title:'Banner Arena BDA' });
      return true;
    } catch (error) {
      return error?.name === 'AbortError';
    }
  }

  async function save(item, button) {
    const filename = safeName(item);
    try {
      downloadBlob(item.blob, filename);
      button.textContent = 'Salvo ✓';
      if (typeof window.toast === 'function') window.toast('Banner salvo no dispositivo');
      setTimeout(() => { if (button.isConnected) button.textContent = 'Baixar'; }, 1800);
      return true;
    } catch {
      const shared = await shareFallback(item, filename);
      if (shared) return true;
      if (typeof window.toast === 'function') window.toast('Não foi possível salvar o banner neste navegador');
      return false;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-pro-dl]');
    if (!button) return;
    const item = itemFromButton(button);
    if (!item) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    save(item, button).finally(() => { if (button.isConnected) button.disabled = false; });
  }, true);

  const observer = new MutationObserver(() => {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.querySelectorAll('[data-pro-dl]').forEach(button => {
      button.dataset.arenaSaveFixed = '1';
      button.textContent = 'Baixar';
      button.title = 'Salvar banner no dispositivo';
    });
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAArtSaveFix = Object.freeze({ version:VERSION, save });
})();
