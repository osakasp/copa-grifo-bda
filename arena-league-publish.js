(() => {
  'use strict';

  if (window.ArenaBDALeaguePublish) return;

  const LEAGUE_IDS = new Set(['liga-a', 'liga-b']);
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const REVISION = '20260919-1';

  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const isLeague = id => LEAGUE_IDS.has(String(id || '').toLowerCase());

  function currentTournament(id) {
    const list = read(TOURNAMENT_KEY, []);
    return Array.isArray(list)
      ? list.find(item => String(item?.id || '').toLowerCase() === id)
      : null;
  }

  function currentMatches(id) {
    const store = read(MATCH_KEY, {});
    return store && typeof store === 'object' && Array.isArray(store[id]) ? store[id] : [];
  }

  async function publishCloudMatches(id, games) {
    if (!window.firebase || typeof firebase.firestore !== 'function') {
      throw new Error('A conexão com a nuvem não carregou');
    }
    if (!window.ArenaBDAAuth?.isAdmin?.()) {
      throw new Error('Acesso administrativo necessário');
    }

    await firebase.firestore().collection('arenaData').doc(`confrontos-${id}`).set({
      dataset: 'confrontos',
      tournamentId: id,
      games,
      revision: `${REVISION}-${Date.now()}`,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: String(window.ArenaBDAAuth.currentEmail?.() || '').toLowerCase()
    }, { merge: true });
  }

  async function publishLeague(id) {
    const leagueId = String(id || '').toLowerCase();
    if (!isLeague(leagueId)) return false;

    const cloud = window.ArenaBDACloudSync;
    if (!cloud?.isReady?.()) {
      throw new Error('A nuvem ainda está conectando');
    }
    if (!window.ArenaBDAAuth?.isAdmin?.()) {
      throw new Error('Acesso administrativo necessário');
    }
    if (cloud.isBusy?.()) {
      throw new Error('A nuvem está ocupada. Tente novamente em alguns segundos');
    }

    await cloud.uploadDataset('tournaments');

    const games = currentMatches(leagueId);
    if (games.length) {
      await publishCloudMatches(leagueId, games);
    }

    if (window.ArenaBDALigaFixtures?.publish) {
      await window.ArenaBDALigaFixtures.publish();
    }

    if (typeof toast === 'function') {
      toast(`${leagueId === 'liga-a' ? 'Liga A' : 'Liga B'} publicado no site ✓`);
    }
    return true;
  }

  function ensureButtons() {
    document.querySelectorAll('.arena-actions').forEach(actions => {
      const detail = actions.closest('.arena-detail');
      if (!detail) return;
      const title = detail.querySelector('.arena-hero-copy h2')?.textContent?.trim() || '';
      const tournaments = read(TOURNAMENT_KEY, []);
      const tournament = Array.isArray(tournaments)
        ? tournaments.find(item => String(item?.name || '').trim().toLowerCase() === title.toLowerCase())
        : null;
      if (!isLeague(tournament?.id) || actions.querySelector('[data-publish-league]')) return;

      const button = document.createElement('button');
      button.className = 'primary';
      button.type = 'button';
      button.dataset.publishLeague = tournament.id;
      button.textContent = 'Publicar no site';
      actions.appendChild(button);
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-publish-league]');
    if (!button) return;

    event.preventDefault();
    if (button.disabled) return;

    const id = button.dataset.publishLeague;
    button.disabled = true;
    button.textContent = 'Publicando...';

    publishLeague(id)
      .catch(error => {
        console.error('[Arena BDA] Falha ao publicar liga', error);
        if (typeof toast === 'function') toast(error.message || 'Não foi possível publicar a liga');
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = 'Publicar no site';
      });
  });

  window.addEventListener('arena:tournaments-updated', ensureButtons);
  window.addEventListener('arena:cloud-status', event => {
    if (event.detail?.state === 'ok') ensureButtons();
  });

  const observer = new MutationObserver(ensureButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  [0, 300, 900, 1800, 3500].forEach(delay => window.setTimeout(ensureButtons, delay));

  window.ArenaBDALeaguePublish = Object.freeze({
    version: REVISION,
    publish: publishLeague
  });
})();
