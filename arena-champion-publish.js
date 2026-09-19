(() => {
  'use strict';

  const VERSION = 4;
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
    button.dataset.championPublishSubmit = 'true';
  }

  function ensureCardPublishButton() {
    document.querySelectorAll('.champion-banner-actions').forEach(actions => {
      if (actions.querySelector('[data-publish-champions]')) return;
      const button = document.createElement('button');
      button.className = 'secondary';
      button.type = 'button';
      button.dataset.publishChampions = 'true';
      button.textContent = 'Publicar no site';
      actions.appendChild(button);
    });
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
    if (publishing || !window.ArenaBDAAuth?.isAdmin?.()) return false;

    const sync = cloud();
    if (!sync?.isReady?.()) {
      retry(attempt);
      return false;
    }

    if (sync.isBusy?.()) {
      retry(attempt, 700);
      return false;
    }

    const before = sync.meta?.()?.revisions?.champions || '';

    publishing = true;
    try {
      await sync.uploadDataset('champions');
      const after = sync.meta?.()?.revisions?.champions || '';

      if (!after || after === before) {
        retry(attempt, 600);
        return false;
      }

      lastPublishRevision = after;
      if (typeof toast === 'function') toast('Quadro dos campeões publicado no site ✓');
      return true;
    } catch (error) {
      console.error('[Arena BDA] Falha ao publicar campeões', error);
      if (attempt < MAX_RETRIES) {
        retry(attempt, 800);
      } else if (typeof toast === 'function') {
        toast('Campeão salvo, mas não foi possível publicar no site');
      }
      return false;
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

    const publishButton = event.target.closest('[data-publish-champions]');
    if (publishButton) {
      event.preventDefault();
      publishButton.disabled = true;
      publishButton.textContent = 'Publicando...';
      publishChampions().finally(() => {
        publishButton.disabled = false;
        publishButton.textContent = 'Publicar no site';
      });
      return;
    }

    if (event.target.closest('[data-change-champion-banner],[data-remove-champion-banner]')) {
      schedulePublish(100);
    }
  }, true);

  window.addEventListener('arena:champions-updated', () => {
    ensureCardPublishButton();
    schedulePublish(100);
  });

  window.addEventListener('arena:cloud-status', event => {
    if (event.detail?.state === 'ok') schedulePublish(50);
  });

  const observer = new MutationObserver(() => {
    const form = document.getElementById('championForm');
    if (form) setPublishLabel(form);
    ensureCardPublishButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  [0, 250, 700, 1500, 3000].forEach(delay => window.setTimeout(() => {
    const form = document.getElementById('championForm');
    if (form) setPublishLabel(form);
    ensureCardPublishButton();
  }, delay));

  window.ArenaBDAChampionPublish = Object.freeze({
    version: VERSION,
    publish: publishChampions
  });
})();