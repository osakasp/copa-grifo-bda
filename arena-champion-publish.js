(() => {
  'use strict';

  const VERSION = 3;
  const MAX_RETRIES = 40;
  let publishTimer = 0;
  let publishing = false;
  let lastPublishRevision = '';

  function cloud() {
    return window.ArenaBDACloudSync;
  }

  function isChampionForm(target) {
    return target instanceof Element && target.id === 'championForm';
  }

  function setPublishLabel(form) {
    if (!form) return;
    const button = form.querySelector('button.primary');
    if (!button) return;
    const title = document.getElementById('championModalTitle')?.textContent?.trim().toLowerCase() || '';
    button.textContent = title.includes('editar') ? 'Publicar alterações' : 'Publicar no site';
  }

  function retry(attempt, delay = 500) {
    if (attempt >= MAX_RETRIES) {
      if (typeof toast === 'function') {
        toast('O campeão foi salvo neste aparelho, mas não foi possível publicar no site');
      }
      return;
    }
    window.clearTimeout(publishTimer);
    publishTimer = window.setTimeout(() => publishChampions(attempt + 1), delay);
  }

  async function publishChampions(attempt = 0) {
    if (publishing || !window.ArenaBDAAuth?.isAdmin?.()) return;

    const sync = cloud();
    if (!sync?.isReady?.()) {
      retry(attempt);
      return;
    }

    if (sync.isBusy?.()) {
      retry(attempt, 700);
      return;
    }

    const before = sync.meta?.()?.revisions?.champions || '';
    if (before && before === lastPublishRevision) {
      retry(attempt, 500);
      return;
    }

    publishing = true;
    try {
      await sync.uploadDataset('champions');
      const after = sync.meta?.()?.revisions?.champions || '';

      if (!after || after === before) {
        retry(attempt, 600);
        return;
      }

      lastPublishRevision = after;
      if (typeof toast === 'function') toast('Quadro dos campeões publicado no site ✓');
    } catch (error) {
      console.error('[Arena BDA] Falha ao publicar campeões', error);
      if (attempt < MAX_RETRIES) {
        retry(attempt, 800);
      } else if (typeof toast === 'function') {
        toast('Campeão salvo, mas não foi possível publicar no site');
      }
    } finally {
      publishing = false;
    }
  }

  function schedulePublish(delay = 0) {
    window.clearTimeout(publishTimer);
    publishTimer = window.setTimeout(() => publishChampions(), delay);
  }

  document.addEventListener('submit', event => {
    if (isChampionForm(event.target)) schedulePublish(50);
  }, true);

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-change-champion-banner],[data-remove-champion-banner]')) {
      schedulePublish(100);
    }
  }, true);

  window.addEventListener('arena:champions-updated', () => schedulePublish(100));
  window.addEventListener('arena:cloud-status', event => {
    if (event.detail?.state === 'ok') schedulePublish(50);
  });

  const observer = new MutationObserver(() => {
    const form = document.getElementById('championForm');
    if (form) setPublishLabel(form);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  [0, 250, 700, 1500, 3000].forEach(delay => window.setTimeout(() => {
    const form = document.getElementById('championForm');
    if (form) setPublishLabel(form);
  }, delay));

  window.ArenaBDAChampionPublish = Object.freeze({
    version: VERSION,
    publish: publishChampions
  });
})();
