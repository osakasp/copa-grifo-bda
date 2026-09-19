(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const REVISION = '20260919-2';

  const LEAGUES = Object.freeze({
    'liga-a': {
      maxTeams: 12,
      participants: [
        'Inter FC BDA',
        'Cajueiro FC BDA',
        'São Paulo FC BDA',
        'Flamestre FC BDA',
        'Imortais FC BDA',
        'Santos FC BDA',
        'Independente FC BDA',
        'Jester Warriors FC BDA',
        'Vasco BDA',
        'HellYear BDA',
        'CR Flamengo BDA',
        'CV Cruz BDA'
      ]
    },
    'liga-b': {
      maxTeams: 17,
      participants: [
        'CRUZEIRO FC BDA',
        'SPORT RECIFE BDA',
        'VERA CRUZ BDA',
        'BDA GOLDEN FC',
        'LIGA BDA',
        'CHAPECOENSE BDA',
        'REAL CITY BDA',
        'PRAIA BDA',
        'Nacional BDA',
        'Florence real FC BDA',
        'Gomes BDA',
        'Esperança BDA',
        'Lobo BDA',
        'BDA URDLS',
        'LOS KANSAS BDA',
        'Atlético goianiense BDA',
        'Boleiros FC BDA'
      ]
    }
  });

  const clone = value => JSON.parse(JSON.stringify(value));

  function read(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function matches() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function sameList(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function apply() {
    const list = tournaments();
    if (!list.length) return false;

    let changed = false;

    Object.entries(LEAGUES).forEach(([id, config]) => {
      const index = list.findIndex(item => String(item?.id || '') === id);
      if (index < 0) return;

      const current = list[index];
      const alreadyConfigured = current.format === 'Pontos corridos • Turno e returno'
        && Number(current.matchSettings?.leagueTurns) === 2
        && current.matchSettings?.autoAdvance === false
        && current.groupGenerator?.mode === 'league'
        && Number(current.groupGenerator?.legs) === 2;

      if (
        sameList(current.participants, config.participants)
        && Number(current.maxTeams) === config.maxTeams
        && alreadyConfigured
      ) return;

      list[index] = {
        ...current,
        participants: [...config.participants],
        maxTeams: config.maxTeams,
        format: 'Pontos corridos • Turno e returno',
        matchSettings: {
          ...(current.matchSettings || {}),
          leagueTurns: 2,
          autoAdvance: false
        },
        groupGenerator: {
          ...(current.groupGenerator || {}),
          mode: 'league',
          groupCount: 1,
          qualifiers: 0,
          legs: 2,
          distribution: 'random'
        }
      };
      changed = true;
    });

    if (!changed) return false;

    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
      detail: { source: 'league-participants-bda', revision: REVISION }
    }));

    return true;
  }

  async function publishMatches(id) {
    const list = matches();
    const games = Array.isArray(list[id]) ? list[id] : [];
    if (!games.length) return false;

    if (!window.firebase || typeof firebase.firestore !== 'function') {
      throw new Error('A conexão com a nuvem não carregou');
    }
    if (!window.ArenaBDAAuth?.isAdmin?.()) {
      throw new Error('Acesso administrativo necessário');
    }

    await firebase.firestore().collection('arenaData').doc(`confrontos-${id}`).set({
      dataset: 'confrontos',
      tournamentId: id,
      games: clone(games),
      revision: `${REVISION}-${Date.now()}`,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: String(window.ArenaBDAAuth.currentEmail?.() || '').toLowerCase()
    }, { merge: true });

    return true;
  }

  async function publish(id = '') {
    const changed = apply();
    const cloud = window.ArenaBDACloudSync;

    if (!cloud?.isReady?.() || !window.ArenaBDAAuth?.isAdmin?.()) return false;

    if (id && !LEAGUES[id]) return false;

    try {
      await cloud.uploadDataset('tournaments');

      if (id) {
        await publishMatches(id);
      } else {
        for (const leagueId of Object.keys(LEAGUES)) {
          await publishMatches(leagueId);
        }
      }

      if (typeof toast === 'function') {
        toast(id
          ? `${id === 'liga-a' ? 'Liga A' : 'Liga B'} publicado no site ✓`
          : 'Liga A e Liga B publicadas no site ✓');
      }
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível publicar as ligas na nuvem', error);
      if (id && typeof toast === 'function') {
        toast(error.message || 'Não foi possível publicar a liga');
      }
      return false;
    }
  }

  function ensurePublishButtons() {
    document.querySelectorAll('.arena-actions').forEach(actions => {
      const detail = actions.closest('.arena-detail');
      if (!detail) return;

      const title = detail.querySelector('.arena-hero-copy h2')?.textContent?.trim().toLowerCase() || '';
      const id = Object.keys(LEAGUES).find(key => {
        const item = tournaments().find(tournament => String(tournament?.id || '') === key);
        return item && String(item.name || '').trim().toLowerCase() === title;
      });

      if (!id || actions.querySelector('[data-publish-league]')) return;

      const button = document.createElement('button');
      button.className = 'primary';
      button.type = 'button';
      button.dataset.publishLeague = id;
      button.textContent = 'Publicar no site';
      actions.appendChild(button);
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-publish-league]');
    if (!button) return;

    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = 'Publicando...';

    publish(button.dataset.publishLeague).finally(() => {
      button.disabled = false;
      button.textContent = 'Publicar no site';
    });
  });

  [0, 500, 1500, 3500, 7000].forEach(delay => {
    window.setTimeout(() => {
      publish();
      ensurePublishButtons();
    }, delay);
  });

  window.addEventListener('arena:cloud-data-applied', event => {
    if (event.detail?.datasets?.includes('tournaments')) {
      publish();
      ensurePublishButtons();
    }
  });

  window.addEventListener('arena:cloud-status', event => {
    if (event.detail?.state === 'ok') {
      publish();
      ensurePublishButtons();
    }
  });

  window.addEventListener('arena:auth-changed', () => {
    publish();
    ensurePublishButtons();
  });

  const observer = new MutationObserver(ensurePublishButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDALigaParticipants = Object.freeze({
    revision: REVISION,
    leagues: clone(LEAGUES),
    apply,
    publish
  });

  publish();
})();
