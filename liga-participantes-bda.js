(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const REVISION = '20260918-1';

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

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(TOURNAMENT_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function sameList(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function apply() {
    const tournaments = read();
    if (!tournaments.length) return false;

    let changed = false;

    Object.entries(LEAGUES).forEach(([id, config]) => {
      const index = tournaments.findIndex(item => String(item?.id || '') === id);
      if (index < 0) return;

      const current = tournaments[index];
      if (
        sameList(current.participants, config.participants)
        && Number(current.maxTeams) === config.maxTeams
      ) return;

      tournaments[index] = {
        ...current,
        participants: [...config.participants],
        maxTeams: config.maxTeams
      };
      changed = true;
    });

    if (!changed) return false;

    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(tournaments));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
      detail: { source: 'league-participants-bda', revision: REVISION }
    }));

    return true;
  }

  async function publish() {
    const changed = apply();
    if (!changed) return;

    const cloud = window.ArenaBDACloudSync;
    if (!cloud?.isReady?.() || !window.ArenaBDAAuth?.isAdmin?.()) return;

    try {
      await cloud.uploadDataset('tournaments');
      if (typeof toast === 'function') toast('Liga A e Liga B atualizadas no site');
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível publicar automaticamente as ligas na nuvem', error);
    }
  }

  [0, 500, 1500, 3500, 7000].forEach(delay => {
    window.setTimeout(publish, delay);
  });

  window.addEventListener('arena:cloud-data-applied', event => {
    if (event.detail?.datasets?.includes('tournaments')) publish();
  });

  window.addEventListener('arena:cloud-status', event => {
    if (event.detail?.state === 'ok') publish();
  });

  window.addEventListener('arena:auth-changed', publish);

  window.ArenaBDALigaParticipants = Object.freeze({
    revision: REVISION,
    leagues: clone(LEAGUES),
    apply,
    publish
  });

  publish();
})();
