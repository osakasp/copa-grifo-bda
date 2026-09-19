(() => {
  'use strict';

  const VERSION = 6;
  const MAX_RETRIES = 40;
  const LEAGUE_RE = /\bliga\s*(?:a|b)(?:\s*bda)?\b/i;
  let publishTimer = 0;
  let publishing = false;

  function cloud() {
    return window.ArenaBDACloudSync;
  }

  function isChampionForm(target) {
    return target instanceof Element && target.id === 'championForm';
  }

  function isLeagueEdition(value) {
    return LEAGUE_RE.test(String(value || ''));
  }

  function currentFormIsLeague() {
    return isLeagueEdition(document.getElementById('championEdition')?.value || '');
  }

  function updateFormPublishState(form) {
    if (!form) return;
    const button = form.querySelector('button.primary');
    if (!button) return;

    const league = currentFormIsLeague();
    const title = document.getElementById('championModalTitle')?.textContent?.trim().toLowerCase() || '';
    button.textContent = league
      ? (title.includes('editar') ? 'Publicar alterações' : 'Publicar no site')
      : (title.includes('editar') ? 'Salvar alterações' : 'Salvar campeão');
    button.dataset.championPublishSubmit = league ? 'true' : 'false';
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
    publishing = true;

    try {
      await sync.uploadDataset('champions');
      const after = sync.meta?.()?.revisions?.champions || '';

      if (!after || after === before) {
        retry(attempt, 600);
        return;
      }

      if (typeof toast === 'function') {
        toast('Campeão publicado no site ✓');
      }
    } catch (error) {
      console.error('[Arena BDA] Falha ao publicar campeão', error);
      if (attempt < MAX_RETRIES) {
        retry(attempt, 800);
      } else if (typeof toast === 'function') {
        toast('Campeão salvo, mas não foi possível publicar no site');
      }
    } finally {
      publishing = false;
    }
  }

  function schedulePublish(delay = 250) {
    window.clearTimeout(publishTimer);
    publishTimer = window.setTimeout(() => publishChampions(), delay);
  }

  document.addEventListener('submit', event => {
    if (isChampionForm(event.target) && currentFormIsLeague()) {
      schedulePublish(250);
    }
  }, true);

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;

    if (event.target.closest('[data-change-champion-banner],[data-remove-champion-banner]')) {
      const form = document.getElementById('championForm');
      if (form && currentFormIsLeague()) schedulePublish(100);
    }
  }, true);

  window.addEventListener('arena:champions-updated', () => {
    const form = document.getElementById('championForm');
    if (form) updateFormPublishState(form);
  });

  const observer = new MutationObserver(() => {
    const form = document.getElementById('championForm');
    if (form) updateFormPublishState(form);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  [0, 250, 700, 1500, 3000].forEach(delay => window.setTimeout(() => {
    const form = document.getElementById('championForm');
    if (form) updateFormPublishState(form);
  }, delay));

  document.addEventListener('input', event => {
    if (!(event.target instanceof Element) || event.target.id !== 'championEdition') return;
    updateFormPublishState(event.target.closest('#championForm'));
  });

  window.ArenaBDAChampionPublish = Object.freeze({
    version: VERSION,
    publish: publishChampions
  });
})();