(() => {
  'use strict';

  if (window.ArenaBDACopaBDALivreLegs?.version >= 1) return;

  const VERSION = 1;
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const CANONICAL_ID = 'copa-bda-livre';
  const CANONICAL_NAME = 'Copa BDA LIVRE';
  let syncing = false;
  let repairTimer = 0;

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const slug = value => normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const isCupId = value => slug(value).startsWith(CANONICAL_ID);
  const clone = value => JSON.parse(JSON.stringify(value));

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function isCup(item) {
    if (!item) return false;
    return isCupId(item.id) || slug(item.name) === CANONICAL_ID;
  }

  function tournamentList() {
    const list = read(TOURNAMENT_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function currentCup() {
    return tournamentList().find(isCup) || null;
  }

  function matchStore() {
    const store = read(MATCH_KEY, {});
    return store && typeof store === 'object' ? store : {};
  }

  function cupGames(cup) {
    if (!cup) return [];
    const store = matchStore();
    if (Array.isArray(store[cup.id])) return store[cup.id];
    const key = Object.keys(store).find(isCupId);
    return key && Array.isArray(store[key]) ? store[key] : [];
  }

  function tieKey(game, index) {
    return String(game?.tieId || game?.id || `tie-${index}`)
      .replace(/-(volta|ida|v)$/i, '');
  }

  function isGroupPhase(phase) {
    return normalize(phase).includes('grupo');
  }

  function returnId(baseId, existingIds) {
    let value = `${baseId}-volta`;
    let number = 2;
    while (existingIds.has(value)) {
      value = `${baseId}-volta-${number}`;
      number += 1;
    }
    existingIds.add(value);
    return value;
  }

  function addMissingReturnLegs(games) {
    const list = (Array.isArray(games) ? games : []).map(clone);
    const groups = new Map();
    list.forEach((game, index) => {
      if (isGroupPhase(game?.phase)) return;
      const key = tieKey(game, index);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ game, index });
    });

    const existingIds = new Set(list.map(game => String(game?.id || '')).filter(Boolean));
    let changed = false;

    groups.forEach((entries, key) => {
      if (entries.some(entry => Number(entry.game?.leg) === 2)) return;
      const firstEntry = entries.find(entry => Number(entry.game?.leg || 1) === 1) || entries[0];
      const first = firstEntry?.game;
      if (!first || !first.ta || !first.tb) return;

      const created = Number(first.created) || Date.now();
      const baseId = String(first.id || key || `tie-${firstEntry.index + 1}`).replace(/-(volta|ida|v)$/i, '');
      const tieId = String(first.tieId || baseId);
      const second = {
        ...clone(first),
        id: returnId(baseId, existingIds),
        tieId,
        leg: 2,
        ta: first.tb,
        tb: first.ta,
        a: '',
        b: '',
        pa: '',
        pb: '',
        wo: 'none',
        status: 'Agendado',
        date: '',
        time: '',
        place: '',
        note: '',
        created: created + 1,
        updated: Date.now()
      };

      first.leg = 1;
      first.tieId = tieId;
      list.push(second);
      changed = true;
    });

    return { list, changed };
  }

  function enforceTournamentRule() {
    const list = tournamentList();
    const index = list.findIndex(isCup);
    if (index < 0) return null;
    const current = list[index] || {};
    const next = {
      ...current,
      name: CANONICAL_NAME,
      format: 'Mata-mata • ida e volta',
      matchSettings: {
        ...(current.matchSettings || {}),
        knockoutLegs: 2,
        finalLegs: 2,
        autoAdvance: current.matchSettings?.autoAdvance !== false
      },
      description: current.description || 'Competição Full Livre do Clã BDA em mata-mata com jogos de ida e volta.'
    };

    if (JSON.stringify(current) !== JSON.stringify(next)) {
      list[index] = next;
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
        detail: { source: 'copa-bda-livre-ida-volta', tournamentId: next.id }
      }));
    }
    return next;
  }

  async function syncCloud(cup, games) {
    if (syncing || !cup || !Array.isArray(games) || !games.length) return false;
    if (!window.ArenaBDAAuth?.isAdmin?.()) return false;
    if (!window.firebase || typeof firebase.firestore !== 'function') return false;
    syncing = true;
    try {
      await firebase.firestore().collection('arenaData').doc(`confrontos-${cup.id}`).set({
        dataset: 'confrontos',
        tournamentId: cup.id,
        games,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: String(window.ArenaBDAAuth?.currentEmail?.() || '')
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn('[Arena BDA] Ida e volta aplicada localmente, mas a nuvem ainda não foi atualizada', error);
      return false;
    } finally {
      syncing = false;
    }
  }

  function repairMatches() {
    const cup = enforceTournamentRule() || currentCup();
    if (!cup) return false;
    const store = matchStore();
    const key = Array.isArray(store[cup.id]) ? cup.id : (Object.keys(store).find(isCupId) || cup.id);
    const current = Array.isArray(store[key]) ? store[key] : [];
    if (!current.length) return false;

    const repaired = addMissingReturnLegs(current);
    if (!repaired.changed) return false;

    store[key] = repaired.list;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail: { source: 'copa-bda-livre-ida-volta', tournamentId: key, count: repaired.list.length }
    }));
    syncCloud({ ...cup, id: key }, repaired.list);
    return true;
  }

  function forceDrawControls() {
    const cup = currentCup();
    const modal = document.getElementById('drawModal');
    if (!cup || !modal?.classList.contains('show')) return;
    const title = document.getElementById('drawModalTitle')?.textContent || '';
    const managerId = document.getElementById('giManager')?.dataset?.tid || '';
    if (!normalize(title).includes(normalize(CANONICAL_NAME)) && String(managerId) !== String(cup.id)) return;

    const legs = document.getElementById('drawLegs');
    const finalLegs = document.getElementById('drawFinalLegs');
    if (legs) {
      legs.value = '2';
      legs.disabled = true;
      legs.title = 'A Copa BDA LIVRE é disputada em ida e volta';
    }
    if (finalLegs) {
      finalLegs.value = '2';
      finalLegs.disabled = true;
      finalLegs.title = 'A final da Copa BDA LIVRE também segue ida e volta';
    }

    if (!modal.querySelector('[data-bda-livre-two-legs-note]')) {
      const grid = modal.querySelector('.draw-form-grid');
      if (grid) {
        const note = document.createElement('p');
        note.dataset.bdaLivreTwoLegsNote = 'true';
        note.style.gridColumn = '1 / -1';
        note.style.margin = '0';
        note.style.color = 'var(--gold-soft)';
        note.style.fontSize = '9px';
        note.style.fontWeight = '800';
        note.textContent = '⚜️ Regra da Copa BDA LIVRE: todos os confrontos são ida e volta.';
        grid.appendChild(note);
      }
    }
  }

  function scheduleRepair(delay = 80) {
    clearTimeout(repairTimer);
    repairTimer = window.setTimeout(() => {
      enforceTournamentRule();
      repairMatches();
      forceDrawControls();
    }, delay);
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.draw-open-button,#smartDrawButton,#arenaDrawButton,#panelDrawTournament')) {
      window.setTimeout(forceDrawControls, 0);
      window.setTimeout(forceDrawControls, 120);
    }
  }, true);

  ['arena:cloud-ready', 'arena:tournaments-updated', 'arena:matches-updated', 'arena:bundle-loaded']
    .forEach(name => window.addEventListener(name, () => scheduleRepair(120)));

  window.ArenaBDACopaBDALivreLegs = Object.freeze({
    version: VERSION,
    rule: 'ida-e-volta',
    repair: repairMatches,
    enforce: enforceTournamentRule,
    applyDrawControls: forceDrawControls
  });

  enforceTournamentRule();
  repairMatches();
})();
