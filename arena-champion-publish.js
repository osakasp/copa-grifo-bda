(() => {
  'use strict';

  const VERSION = 1;
  const MAX_RETRIES = 20;
  let publishTimer = 0;
  let publishing = false;

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

  async function publishChampions(attempt = 0) {
    if (publishing || !window.ArenaBDAAuth?.isAdmin?.()) return;
    const sync = cloud();
    if (!sync) {
      if (attempt < MAX_RETRIES) {
        window.clearTimeout(publishTimer);
        publishTimer = window.setTimeout(() => publishChampions(attempt + 1), 500);
      }
      return;
    }

    if (!sync.isReady?.()) {
      if (attempt < MAX_RETRIES) {
        window.clearTimeout(publishTimer);
        publishTimer = window.setTimeout(() => publishChampions(attempt + 1), 500);
      } else if (typeof toast === 'function') {
        toast('O campeão foi salvo neste aparelho, mas a nuvem ainda não está pronta para publicar');
      }
      return;
    }

    if (sync.isBusy?.()) {
      if (attempt < MAX_RETRIES) {
        window.clearTimeout(publishTimer);
        publishTimer = window.setTimeout(() => publishChampions(attempt + 1), 600);
      }
      return;
    }

    publishing = true;
    try {
      await sync.uploadDataset('champions');
      if (typeof toast === 'function') toast('Campeão publicado no site ✓');
    } catch (error) {
      console.error('[Arena BDA] Falha ao publicar campeões', error);
      if (typeof toast === 'function') toast('Campeão salvo, mas não foi possível publicar no site');
    } finally {
      publishing = false;
    }
  }

  document.addEventListener('submit', event => {
    if (!isChampionForm(event.target)) return;
    window.setTimeout(() => publishChampions(), 0);
  }, true);

  const observer = new MutationObserver(() => {
    const form = document.getElementById('championForm');
    if (form) setPublishLabel(form);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  [0, 250, 700, 1500, 3000].forEach(delay => window.setTimeout(() => {
    const form = document.getElementById('championForm');
    if (form) setPublishLabel(form);
  }, delay));

  window.ArenaBDAChampionPublish = Object.freeze({ version: VERSION, publish: publishChampions });
})();
