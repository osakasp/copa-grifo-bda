(() => {
  'use strict';

  if (window.ArenaBDAMatchDetails?.version >= 1) return;

  const STORAGE_KEY = 'bda-v3-match-events';
  const STYLE_ID = 'arenaMatchDetailsStyles';
  const expanded = new Set();
  let frame = 0;
  let db = null;
  let cloudTid = '';
  let cloudUnsubscribe = null;
  let cloudRetry = 0;
  let applyingRemote = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function tournamentId() {
    return String($('#giManager[data-tid]')?.dataset.tid || '');
  }

  function adminActive() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.());
  }

  function currentEmail() {
    return String(window.ArenaBDAAuth?.currentEmail?.() || '').trim().toLowerCase();
  }

  function sanitizeEvent(event, index = 0) {
    const now = Date.now();
    return {
      id: String(event?.id || `goal-${now.toString(36)}-${index}`),
      gameId: String(event?.gameId || ''),
      player: String(event?.player || '').trim(),
      team: String(event?.team || '').trim(),
      goals: Math.max(1, Math.min(20, Number(event?.goals) || 1)),
      minute: String(event?.minute || '').trim().slice(0, 24),
      created: Number(event?.created) || now + index,
      updated: Number(event?.updated) || Number(event?.created) || now + index,
      updatedBy: String(event?.updatedBy || '')
    };
  }

  function eventsForTournament(tid = tournamentId()) {
    const list = readStore()[tid];
    return Array.isArray(list)
      ? list.map(sanitizeEvent).filter(event => event.gameId && event.player && event.team)
      : [];
  }

  function eventKey(tid, gameId) {
    return `${tid}::${gameId}`;
  }

  function saveLocal(tid, list, { sync = true } = {}) {
    if (!tid) return;
    const store = readStore();
    store[tid] = list.map(sanitizeEvent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:match-events-updated', {
      detail: { tournamentId: tid, count: store[tid].length }
    }));
    schedule();
    if (sync && !applyingRemote) syncCloud(tid, store[tid]);
  }

  function mergeEvents(local, remote) {
    const map = new Map();
    [...remote, ...local].forEach((event, index) => {
      const item = sanitizeEvent(event, index);
      if (!item.id) return;
      const previous = map.get(item.id);
      if (!previous || item.updated >= previous.updated) map.set(item.id, item);
    });
    return [...map.values()].sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  }

  async function ensureCloud() {
    try {
      await window.ArenaBDAEnsureCloud?.('match-details-scorers');
    } catch {}
    if (!window.firebase || typeof firebase.firestore !== 'function') return null;
    try {
      db = firebase.firestore();
      return db;
    } catch {
      return null;
    }
  }

  async function syncCloud(tid, list = eventsForTournament(tid)) {
    if (!tid || !adminActive()) return;
    const firestore = db || await ensureCloud();
    if (!firestore) {
      clearTimeout(cloudRetry);
      cloudRetry = setTimeout(() => syncCloud(tid, eventsForTournament(tid)), 1800);
      return;
    }
    try {
      await firestore.collection('arenaData').doc(`match-events-${tid}`).set({
        dataset: 'match-events',
        tournamentId: tid,
        events: list.map(sanitizeEvent),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentEmail()
      });
    } catch (error) {
      console.warn('[Arena BDA] Falha ao sincronizar artilharia', error);
      clearTimeout(cloudRetry);
      cloudRetry = setTimeout(() => syncCloud(tid, eventsForTournament(tid)), 2500);
    }
  }

  async function listenCloud() {
    const tid = tournamentId();
    if (!tid) return;
    const firestore = db || await ensureCloud();
    if (!firestore) return;
    if (cloudTid === tid && cloudUnsubscribe) return;
    cloudUnsubscribe?.();
    cloudUnsubscribe = null;
    cloudTid = tid;
    cloudUnsubscribe = firestore.collection('arenaData').doc(`match-events-${tid}`).onSnapshot(snapshot => {
      const remote = snapshot.exists && Array.isArray(snapshot.data()?.events)
        ? snapshot.data().events.map(sanitizeEvent)
        : [];
      const local = eventsForTournament(tid);
      const next = adminActive() ? mergeEvents(local, remote) : remote;
      applyingRemote = true;
      try {
        saveLocal(tid, next, { sync: false });
      } finally {
        applyingRemote = false;
      }
      if (adminActive() && JSON.stringify(next) !== JSON.stringify(remote)) syncCloud(tid, next);
    }, error => console.warn('[Arena BDA] Falha ao ouvir artilharia', error));
  }

  function gameEvents(tid, gameId) {
    return eventsForTournament(tid).filter(event => event.gameId === gameId);
  }

  function teamsFromCard(card) {
    return $$('.gi-team strong', card)
      .map(node => String(node.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  function goalRows(list) {
    if (!list.length) return '<p class="arena-match-no-goals">Nenhum autor de gol cadastrado.</p>';
    return `<div class="arena-match-goal-list">${list
      .sort((a, b) => a.created - b.created)
      .map(event => `<div class="arena-match-goal-row" data-goal-id="${esc(event.id)}">
        <span class="arena-match-ball">⚽</span>
        <div><b>${esc(event.player)}</b><small>${esc(event.team)}${event.minute ? ` • ${esc(event.minute)}'` : ''}</small></div>
        <strong>${event.goals > 1 ? `${event.goals} gols` : '1 gol'}</strong>
        ${adminActive() ? `<button type="button" data-goal-delete="${esc(event.id)}" aria-label="Remover gol de ${esc(event.player)}">×</button>` : ''}
      </div>`).join('')}</div>`;
  }

  function scorerForm(teams, gameId) {
    if (!adminActive()) return '';
    return `<form class="arena-match-goal-form" data-goal-form="${esc(gameId)}">
      <label>Jogador<input name="player" autocomplete="off" maxlength="60" placeholder="Nome do jogador" required></label>
      <label>Time<select name="team" required>${teams.map(team => `<option value="${esc(team)}">${esc(team)}</option>`).join('')}</select></label>
      <label>Gols<input name="goals" type="number" min="1" max="20" inputmode="numeric" value="1" required></label>
      <label>Minuto <small>(opcional)</small><input name="minute" inputmode="numeric" maxlength="24" placeholder="23"></label>
      <button type="submit" class="primary" data-goal-add="${esc(gameId)}">Adicionar</button>
    </form>`;
  }

  function detailHtml(tid, gameId, teams) {
    const list = gameEvents(tid, gameId);
    return `<section class="arena-match-detail-panel" data-match-detail="${esc(gameId)}">
      <header><div><span class="eyebrow">Detalhes da partida</span><h4>Gols da partida</h4></div><small>${list.reduce((sum, event) => sum + event.goals, 0)} gols cadastrados</small></header>
      ${goalRows(list)}
      ${scorerForm(teams, gameId)}
      <p class="arena-match-detail-note">A artilharia é uma estatística complementar e não altera o placar oficial.</p>
    </section>`;
  }

  function decorateCard(card, tid) {
    const gameId = String(card.dataset.card || card.dataset.gameId || '');
    if (!gameId) return;
    const key = eventKey(tid, gameId);
    const open = expanded.has(key);
    const teams = teamsFromCard(card);
    if (card.dataset.arenaMatchDetails !== 'true') {
      card.dataset.arenaMatchDetails = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'group');
    }
    card.classList.toggle('arena-match-expanded', open);
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
    let panel = card.querySelector(':scope > .arena-match-detail-panel');
    const signature = JSON.stringify([open, adminActive(), teams, gameEvents(tid, gameId).map(event => [event.id, event.player, event.team, event.goals, event.minute, event.updated])]);
    if (!open) {
      panel?.remove();
      card.dataset.arenaMatchSignature = signature;
      return;
    }
    if (card.dataset.arenaMatchSignature === signature && panel) return;
    card.dataset.arenaMatchSignature = signature;
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'arena-match-detail-panel';
      card.appendChild(panel);
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = detailHtml(tid, gameId, teams).trim();
    panel.replaceWith(wrapper.firstElementChild);
  }

  function ranking(tid) {
    const map = new Map();
    eventsForTournament(tid).forEach(event => {
      const key = `${norm(event.player)}::${norm(event.team)}`;
      const item = map.get(key) || { player: event.player, team: event.team, goals: 0 };
      item.goals += event.goals;
      if (!item.player) item.player = event.player;
      if (!item.team) item.team = event.team;
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player, 'pt-BR'));
  }

  function renderRanking(manager, tid) {
    const hasCards = Boolean(manager.querySelector('.gi-game'));
    let panel = manager.querySelector(':scope > .arena-scorers-panel');
    if (!hasCards) {
      panel?.remove();
      return;
    }
    const list = ranking(tid);
    if (!list.length && !adminActive()) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'arena-scorers-panel';
      manager.appendChild(panel);
    }
    const signature = JSON.stringify([adminActive(), list]);
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    panel.innerHTML = `<header><div><span class="eyebrow">Estatísticas</span><h3>Artilharia</h3></div><small>${list.length ? `${list.length} jogador${list.length === 1 ? '' : 'es'}` : 'Aguardando gols'}</small></header>
      ${list.length ? `<div class="arena-scorers-list">${list.map((item, index) => `<div class="arena-scorer-row"><i>${index + 1}</i><div><b>${esc(item.player)}</b><small>${esc(item.team)}</small></div><strong>${item.goals}</strong><span>${item.goals === 1 ? 'gol' : 'gols'}</span></div>`).join('')}</div>` : '<p>Nenhum gol cadastrado ainda. Abra uma partida para adicionar os autores.</p>'}`;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #giManager .gi-game[data-arena-match-details="true"]{cursor:pointer;transition:border-color .18s ease,background .18s ease}
      #giManager .gi-game[data-arena-match-details="true"]:hover{border-color:rgba(216,178,72,.28)!important}
      #giManager .gi-game.arena-match-expanded{grid-column:1/-1!important;border-color:rgba(216,178,72,.42)!important;background:linear-gradient(155deg,#0c1c12,#050c08)!important}
      .arena-match-detail-panel{margin-top:10px;padding:12px;border:1px solid rgba(216,178,72,.16);border-radius:12px;background:#06100a;cursor:default}
      .arena-match-detail-panel>header{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:8px}
      .arena-match-detail-panel h4{margin:3px 0 0;color:#f2f6f3;font-size:17px;text-transform:none}
      .arena-match-detail-panel>header small{color:#87998e;font-size:8px}
      .arena-match-no-goals,.arena-scorers-panel>p{margin:0;padding:12px;border:1px dashed rgba(255,255,255,.08);border-radius:10px;color:#83958a;background:#040a06;font-size:9px;text-align:center}
      .arena-match-goal-list{display:grid;gap:5px}
      .arena-match-goal-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto 26px;align-items:center;gap:8px;min-height:44px;padding:7px 8px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:#0a1710}
      .arena-match-ball{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:rgba(216,178,72,.1);font-size:14px}
      .arena-match-goal-row b,.arena-match-goal-row small{display:block}.arena-match-goal-row b{font-size:10px}.arena-match-goal-row small{margin-top:2px;color:#82948a;font-size:7px}
      .arena-match-goal-row>strong{color:#f1d97f;font-size:9px}.arena-match-goal-row>button{width:26px;height:26px;padding:0;border:1px solid rgba(255,120,130,.16);border-radius:8px;color:#ff9aa4;background:#2a0b0f;font-size:16px}
      .arena-match-goal-form{display:grid;grid-template-columns:1.5fr 1.2fr .55fr .65fr auto;align-items:end;gap:7px;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}
      .arena-match-goal-form label{display:block;color:#8b9d92;font-size:7px;font-weight:850;text-transform:uppercase}.arena-match-goal-form label small{font-size:6px;text-transform:none}
      .arena-match-goal-form :is(input,select){width:100%;height:38px;margin-top:4px;padding:0 9px;border:1px solid rgba(255,255,255,.09);border-radius:9px;color:#eef4ef;background:#07120b;font-size:9px}
      .arena-match-goal-form button{height:38px;padding:0 12px;border-radius:9px!important;font-size:8px!important}
      .arena-match-detail-note{margin:8px 0 0!important;padding:0!important;color:#687970!important;background:none!important;font-size:7px!important;text-align:right}
      .arena-scorers-panel{margin-top:14px;padding:14px;border:1px solid rgba(216,178,72,.16);border-radius:16px;background:linear-gradient(155deg,#0a1710,#050c08)}
      .arena-scorers-panel>header{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:9px}.arena-scorers-panel h3{margin:3px 0 0;font-size:24px;text-transform:none}.arena-scorers-panel>header small{color:#85968c;font-size:8px}
      .arena-scorers-list{display:grid;gap:5px}.arena-scorer-row{display:grid;grid-template-columns:32px minmax(0,1fr) 30px 34px;align-items:center;gap:8px;min-height:48px;padding:7px 9px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:#07120b}
      .arena-scorer-row i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:#171207;background:#d8b248;font-size:9px;font-style:normal;font-weight:900}.arena-scorer-row b,.arena-scorer-row small{display:block}.arena-scorer-row b{font-size:10px}.arena-scorer-row small{margin-top:2px;color:#82948a;font-size:7px}.arena-scorer-row>strong{color:#f1d97f;font:900 20px 'Barlow Condensed',sans-serif;text-align:right}.arena-scorer-row>span{color:#82948a;font-size:7px;text-transform:uppercase}
      @media(max-width:760px){
        #giManager .gi-game.arena-match-expanded{grid-column:auto!important}
        .arena-match-detail-panel{padding:10px}.arena-match-detail-panel>header{align-items:flex-start}.arena-match-detail-panel>header small{text-align:right}
        .arena-match-goal-form{grid-template-columns:1fr 1fr}.arena-match-goal-form label:first-child{grid-column:1/-1}.arena-match-goal-form button{grid-column:1/-1;width:100%}
        .arena-match-goal-row{grid-template-columns:28px minmax(0,1fr) auto 26px}.arena-match-goal-row>strong{font-size:8px}
        .arena-scorers-panel{padding:11px}.arena-scorer-row{grid-template-columns:30px minmax(0,1fr) 28px 30px}
      }
    `;
    document.head.appendChild(style);
  }

  function decorate() {
    installStyles();
    const manager = $('#giManager[data-tid]');
    if (!manager) return;
    const tid = String(manager.dataset.tid || '');
    if (!tid) return;
    $$('.gi-game', manager).forEach(card => decorateCard(card, tid));
    renderRanking(manager, tid);
    listenCloud().catch(() => {});
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      decorate();
    });
  }

  function isInteractive(target, card) {
    return Boolean(target.closest('button,a,input,select,textarea,label,form,.gi-editor,.arena-match-detail-panel'))
      || !card.contains(target);
  }

  document.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-goal-delete]');
    if (removeButton) {
      if (!adminActive()) return;
      event.preventDefault();
      event.stopPropagation();
      const tid = tournamentId();
      const id = String(removeButton.dataset.goalDelete || '');
      if (!id || !tid) return;
      if (typeof confirm === 'function' && !confirm('Remover este registro de gol?')) return;
      saveLocal(tid, eventsForTournament(tid).filter(item => item.id !== id));
      return;
    }

    const card = event.target.closest('#giManager .gi-game[data-card],#giManager .gi-game[data-game-id]');
    if (!card || isInteractive(event.target, card)) return;
    const tid = tournamentId();
    const gameId = String(card.dataset.card || card.dataset.gameId || '');
    if (!tid || !gameId) return;
    const key = eventKey(tid, gameId);
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    schedule();
  });

  document.addEventListener('submit', event => {
    const form = event.target.closest('.arena-match-goal-form');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    if (!adminActive()) return;
    const tid = tournamentId();
    const gameId = String(form.dataset.goalForm || '');
    const player = String(form.elements.player?.value || '').trim();
    const team = String(form.elements.team?.value || '').trim();
    const goals = Math.max(1, Math.min(20, Number(form.elements.goals?.value) || 1));
    const minute = String(form.elements.minute?.value || '').trim();
    if (!tid || !gameId || !player || !team) return;
    const now = Date.now();
    const list = eventsForTournament(tid);
    list.push(sanitizeEvent({
      id: `goal-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      gameId,
      player,
      team,
      goals,
      minute,
      created: now,
      updated: now,
      updatedBy: currentEmail()
    }));
    expanded.add(eventKey(tid, gameId));
    saveLocal(tid, list);
    form.reset();
    if (form.elements.goals) form.elements.goals.value = '1';
  });

  document.addEventListener('keydown', event => {
    const card = event.target.closest?.('#giManager .gi-game[data-arena-match-details="true"]');
    if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    const tid = tournamentId();
    const gameId = String(card.dataset.card || card.dataset.gameId || '');
    const key = eventKey(tid, gameId);
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    schedule();
  });

  ['arena:bundle-loaded','arena:matches-updated','arena:tournaments-updated','arena:auth-changed','arena:cloud-ready','arena:match-events-updated']
    .forEach(type => window.addEventListener(type, schedule));
  window.addEventListener('arena:cloud-ready', () => {
    cloudTid = '';
    listenCloud().catch(() => {});
    if (adminActive()) syncCloud(tournamentId()).catch(() => {});
  });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDAMatchDetails = Object.freeze({
    version: 1,
    refresh: decorate,
    events: tid => eventsForTournament(tid),
    ranking: tid => ranking(tid || tournamentId()),
    storageKey: STORAGE_KEY
  });

  decorate();
})();
