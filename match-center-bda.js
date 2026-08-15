(() => {
  'use strict';

  const KEYS = {
    matches: 'bda-v3-confrontos',
    tournaments: 'bda-v3-tournaments',
    teams: 'bda-v2-teams',
    live: 'bda-v4-live-centers',
    chat: 'bda-v4-live-chat',
    chatName: 'bda-v4-live-chat-name'
  };
  const auth = window.ArenaBDAAuth;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const number = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let db = null;
  let observer = null;
  let enhanceFrame = 0;
  let active = null;
  let liveData = null;
  let chatMessages = [];
  let liveUnsubscribe = null;
  let matchUnsubscribe = null;
  let chatUnsubscribe = null;
  let refreshTimer = 0;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function isAdmin() {
    if (auth?.isAdmin) return auth.isAdmin();
    const user = window.firebase?.auth?.()?.currentUser;
    const email = String(user?.email || '').toLowerCase();
    return Boolean(user && (window.ARENA_ADMIN_EMAILS || []).includes(email));
  }

  function currentEmail() {
    if (auth?.currentEmail) return auth.currentEmail();
    return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
  }

  function matchStore() {
    const value = read(KEYS.matches, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function tournaments() {
    const value = read(KEYS.tournaments, []);
    return Array.isArray(value) ? value : [];
  }

  function teams() {
    const value = read(KEYS.teams, []);
    return Array.isArray(value) ? value : [];
  }

  function tournament(id) {
    return tournaments().find(item => String(item.id) === String(id)) || null;
  }

  function games(tid) {
    const value = matchStore()[tid];
    return Array.isArray(value) ? value : [];
  }

  function game(tid, id) {
    return games(tid).find(item => String(item?.id) === String(id)) || null;
  }

  function team(name) {
    return teams().find(item => norm(item?.name) === norm(name)) || { name: String(name || 'Time BDA') };
  }

  function score(item, side) {
    if (item?.wo === 'a') return side === 'a' ? 3 : 0;
    if (item?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? item?.a : item?.b;
    return number(value) ? Number(value) : null;
  }

  function finished(item) {
    return ['a', 'b'].includes(item?.wo) || (number(item?.a) && number(item?.b));
  }

  function gameTime(item) {
    if (item?.date) {
      const parsed = Date.parse(`${item.date}T${item.time || '00:00'}:00`);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Number(item?.updated || item?.created || 0);
  }

  function allFinished() {
    const store = matchStore();
    const competitionMap = new Map(tournaments().map(item => [String(item.id), item.name]));
    return Object.entries(store).flatMap(([tid, list]) => (Array.isArray(list) ? list : []).filter(finished).map(item => ({
      ...item,
      tournamentId: tid,
      tournamentName: competitionMap.get(tid) || 'Campeonato BDA',
      _time: gameTime(item)
    })));
  }

  function localKey(tid, id) {
    return `${tid}:${id}`;
  }

  function documentId(tid, id) {
    const safe = value => String(value || 'jogo').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
    return `live-${safe(tid)}-${safe(id)}`;
  }

  function defaultLive(tid, item) {
    const a = team(item?.ta);
    const b = team(item?.tb);
    return {
      dataset: 'liveCenter',
      tournamentId: tid,
      gameId: String(item?.id || ''),
      formationA: a.formation || 'A definir',
      formationB: b.formation || 'A definir',
      possessionA: 50,
      possessionB: 50,
      shotsA: 0,
      shotsB: 0,
      shotsOnA: 0,
      shotsOnB: 0,
      yellowA: 0,
      yellowB: 0,
      redA: 0,
      redB: 0,
      events: [],
      updatedAtClient: Date.now()
    };
  }

  function loadLive(tid, item) {
    const store = read(KEYS.live, {});
    return { ...defaultLive(tid, item), ...(store[localKey(tid, item?.id)] || {}) };
  }

  function saveLiveLocal(tid, id, value) {
    const store = read(KEYS.live, {});
    store[localKey(tid, id)] = value;
    write(KEYS.live, store);
  }

  function localChat(tid, id) {
    const store = read(KEYS.chat, {});
    const list = store[localKey(tid, id)];
    return Array.isArray(list) ? list : [];
  }

  function saveLocalChat(tid, id, list) {
    const store = read(KEYS.chat, {});
    store[localKey(tid, id)] = list.slice(-80);
    write(KEYS.chat, store);
  }

  function initials(name, code = '') {
    return String(code || name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 3).map(part => part[0]).join('').toUpperCase().slice(0, 4);
  }

  function badge(name, className = 'mc-badge') {
    const info = team(name);
    return info.badge
      ? `<span class="${className}"><img src="${esc(info.badge)}" alt="Escudo de ${esc(name)}"></span>`
      : `<span class="${className}">${esc(initials(name, info.code))}</span>`;
  }

  function resultText(item, clubName) {
    if (!item) return 'Nenhum resultado registrado';
    const isA = norm(item.ta) === norm(clubName);
    const own = isA ? score(item, 'a') : score(item, 'b');
    const opponent = isA ? score(item, 'b') : score(item, 'a');
    const rival = isA ? item.tb : item.ta;
    const code = own > opponent ? 'V' : own === opponent ? 'E' : 'D';
    return `${code} • ${esc(clubName)} ${own} × ${opponent} ${esc(rival)}`;
  }

  function historyFor(name, excludeTid = '', excludeId = '') {
    return allFinished()
      .filter(item => (norm(item.ta) === norm(name) || norm(item.tb) === norm(name)) && !(String(item.tournamentId) === String(excludeTid) && String(item.id) === String(excludeId)))
      .sort((a, b) => b._time - a._time);
  }

  function overall(name) {
    const list = historyFor(name);
    const out = { played: list.length, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
    list.forEach(item => {
      const isA = norm(item.ta) === norm(name);
      const own = isA ? score(item, 'a') : score(item, 'b');
      const opp = isA ? score(item, 'b') : score(item, 'a');
      out.gf += own || 0;
      out.ga += opp || 0;
      if (own > opp) out.wins += 1;
      else if (own === opp) out.draws += 1;
      else out.losses += 1;
    });
    return out;
  }

  function h2h(a, b, excludeTid = '', excludeId = '') {
    const list = allFinished().filter(item => {
      const pair = (norm(item.ta) === norm(a) && norm(item.tb) === norm(b)) || (norm(item.ta) === norm(b) && norm(item.tb) === norm(a));
      const current = String(item.tournamentId) === String(excludeTid) && String(item.id) === String(excludeId);
      return pair && !current;
    }).sort((x, y) => y._time - x._time);
    const result = { list, winsA: 0, winsB: 0, draws: 0, goalsA: 0, goalsB: 0 };
    list.forEach(item => {
      const aIsHome = norm(item.ta) === norm(a);
      const sa = aIsHome ? score(item, 'a') : score(item, 'b');
      const sb = aIsHome ? score(item, 'b') : score(item, 'a');
      result.goalsA += sa || 0;
      result.goalsB += sb || 0;
      if (sa > sb) result.winsA += 1;
      else if (sb > sa) result.winsB += 1;
      else result.draws += 1;
    });
    return result;
  }

  function statusLabel(item) {
    if (finished(item)) return 'Finalizado';
    return String(item?.status || 'Agendado');
  }

  function ensureModals() {
    if (!$('#matchPreviewModal')) {
      const modal = document.createElement('div');
      modal.id = 'matchPreviewModal';
      modal.className = 'modal-backdrop mc-modal-backdrop';
      modal.innerHTML = '<section class="modal mc-dialog" id="matchPreviewContent"></section>';
      modal.addEventListener('click', event => { if (event.target === modal) closePreview(); });
      document.body.append(modal);
    }
    if (!$('#matchLiveModal')) {
      const modal = document.createElement('div');
      modal.id = 'matchLiveModal';
      modal.className = 'modal-backdrop mc-modal-backdrop';
      modal.innerHTML = '<section class="modal mc-live-dialog" id="matchLiveContent"></section>';
      modal.addEventListener('click', event => { if (event.target === modal) closeLive(); });
      document.body.append(modal);
    }
  }

  function nextGame(tid, preferLive = false) {
    const list = games(tid);
    if (!list.length) return null;
    if (preferLive) {
      const live = list.find(item => norm(item.status).includes('andamento'));
      if (live) return live;
    }
    return [...list].sort((a, b) => {
      const af = finished(a) ? 1 : 0;
      const bf = finished(b) ? 1 : 0;
      return af - bf || gameTime(a) - gameTime(b);
    })[0];
  }

  function enhanceToolbar() {
    const manager = $('#giManager');
    const head = $('#giManager .gi-head');
    if (!manager || !head) return;
    let tools = $('#giExperienceTools', manager);
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'giExperienceTools';
      tools.className = 'mc-tools';
      tools.innerHTML = '<button type="button" class="secondary" data-mc-global-preview>📋 Prévia do próximo jogo</button><button type="button" class="ghost" data-mc-global-live>📡 Central ao vivo</button>';
      head.after(tools);
    }
  }

  function enhanceCards() {
    const tid = $('#giManager')?.dataset?.tid || '';
    if (!tid) return;
    $$('#giManager .gi-game').forEach(card => {
      if (card.dataset.matchCenterReady === 'true') return;
      const id = card.dataset.card;
      if (!id) return;
      card.dataset.matchCenterReady = 'true';
      const actions = document.createElement('div');
      actions.className = 'mc-card-actions';
      actions.innerHTML = `<button type="button" data-match-preview="${esc(id)}">📋 Prévia</button><button type="button" data-match-live="${esc(id)}">📡 Ao vivo</button>`;
      const editor = $(':scope > .gi-editor', card);
      editor ? card.insertBefore(actions, editor) : card.append(actions);
    });
  }

  function enhance() {
    enhanceFrame = 0;
    ensureModals();
    enhanceToolbar();
    enhanceCards();
  }

  function scheduleEnhance() {
    if (enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(enhance);
  }

  function previewHtml(tid, item, center) {
    const competition = tournament(tid);
    const a = item.ta || 'Time A';
    const b = item.tb || 'Time B';
    const duel = h2h(a, b, tid, item.id);
    const lastA = historyFor(a, tid, item.id)[0];
    const lastB = historyFor(b, tid, item.id)[0];
    const statsA = overall(a);
    const statsB = overall(b);
    const recent = duel.list.slice(0, 5).map(match => `<li><span>${esc(match.tournamentName)} • ${esc(match.phase || 'Confronto')}</span><b>${esc(match.ta)} ${score(match, 'a')} × ${score(match, 'b')} ${esc(match.tb)}</b></li>`).join('');
    return `<button type="button" class="mc-close" data-mc-close-preview aria-label="Fechar">×</button>
      <header class="mc-preview-head"><span class="eyebrow">Ficha técnica • ${esc(competition?.name || 'Campeonato BDA')}</span><h2>${esc(a)} × ${esc(b)}</h2><p>${esc(item.phase || 'Confronto')} • ${esc(statusLabel(item))}${item.date ? ` • ${esc(item.date)}` : ''}${item.time ? ` às ${esc(item.time)}` : ''}</p></header>
      <section class="mc-versus">
        <article>${badge(a, 'mc-badge large')}<h3>${esc(a)}</h3><span>${esc(center.formationA || 'A definir')}</span><small>${resultText(lastA, a)}</small></article>
        <div><b>${number(item.a) ? Number(item.a) : '–'}</b><em>×</em><b>${number(item.b) ? Number(item.b) : '–'}</b><span>${esc(statusLabel(item))}</span></div>
        <article>${badge(b, 'mc-badge large')}<h3>${esc(b)}</h3><span>${esc(center.formationB || 'A definir')}</span><small>${resultText(lastB, b)}</small></article>
      </section>
      <section class="mc-stat-compare"><div><span>Jogos</span><b>${statsA.played}</b><b>${statsB.played}</b></div><div><span>Vitórias</span><b>${statsA.wins}</b><b>${statsB.wins}</b></div><div><span>Gols marcados</span><b>${statsA.gf}</b><b>${statsB.gf}</b></div><div><span>Chutes nesta partida</span><b>${Number(center.shotsA) || 0}</b><b>${Number(center.shotsB) || 0}</b></div><div><span>Posse nesta partida</span><b>${Number(center.possessionA) || 0}%</b><b>${Number(center.possessionB) || 0}%</b></div></section>
      <section class="mc-h2h"><div class="mc-section-head"><div><span>Head-to-head</span><h3>Histórico do confronto</h3></div><small>${duel.list.length} encontro${duel.list.length === 1 ? '' : 's'}</small></div><div class="mc-h2h-score"><article><b>${duel.winsA}</b><span>Vitórias ${esc(a)}</span></article><article><b>${duel.draws}</b><span>Empates</span></article><article><b>${duel.winsB}</b><span>Vitórias ${esc(b)}</span></article></div>${recent ? `<ol>${recent}</ol>` : '<div class="mc-empty">Este será o primeiro confronto registrado entre os clubes.</div>'}</section>
      <footer class="mc-preview-actions"><button type="button" class="primary" data-match-live="${esc(item.id)}">📡 Abrir central do jogo</button></footer>`;
  }

  async function openPreview(tid, id) {
    const item = game(tid, id);
    if (!item) return;
    active = { mode: 'preview', tid, id };
    liveData = loadLive(tid, item);
    ensureModals();
    $('#matchPreviewContent').innerHTML = previewHtml(tid, item, liveData);
    $('#matchPreviewModal').classList.add('show');
    document.body.classList.add('mc-modal-open');
    if (db) {
      try {
        const snapshot = await db.collection('arenaData').doc(documentId(tid, id)).get();
        if (snapshot.exists && active?.mode === 'preview' && active.tid === tid && active.id === id) {
          liveData = { ...liveData, ...snapshot.data() };
          saveLiveLocal(tid, id, liveData);
          $('#matchPreviewContent').innerHTML = previewHtml(tid, item, liveData);
        }
      } catch (error) {
        console.warn('Prévia em modo local', error);
      }
    }
  }

  function closePreview() {
    $('#matchPreviewModal')?.classList.remove('show');
    if (active?.mode === 'preview') active = null;
    document.body.classList.toggle('mc-modal-open', Boolean($('#matchLiveModal')?.classList.contains('show')));
  }

  function eventIcon(type) {
    return type === 'goal' ? '⚽' : type === 'yellow' ? '🟨' : type === 'red' ? '🟥' : '📣';
  }

  function renderTimeline(item) {
    const events = Array.isArray(liveData?.events) ? [...liveData.events].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) : [];
    return events.length ? events.map(event => `<article><i>${eventIcon(event.type)}</i><div><b>${esc(event.minute || '—')} ${esc(event.team || '')}</b><p>${esc(event.text || 'Atualização da partida')}</p></div></article>`).join('') : `<div class="mc-empty">Gols, cartões e atualizações aparecerão aqui.</div>`;
  }

  function renderChat(tid, id) {
    const local = localChat(tid, id);
    const map = new Map([...local, ...chatMessages].map(message => [String(message.id), message]));
    const list = [...map.values()].sort((a, b) => Number(a.createdAtClient || 0) - Number(b.createdAtClient || 0)).slice(-60);
    return list.length ? list.map(message => `<article class="mc-chat-message${message.localOnly ? ' local' : ''}"><div><b>${esc(message.author || 'Torcida BDA')}</b><time>${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(Number(message.createdAtClient) || Date.now()))}</time></div><p>${esc(message.text)}</p>${message.localOnly ? '<small>Salvo neste aparelho</small>' : ''}</article>`).join('') : '<div class="mc-empty">A arquibancada ainda está silenciosa.</div>';
  }

  function liveHtml(tid, item) {
    const a = item.ta || 'Time A';
    const b = item.tb || 'Time B';
    const center = liveData || defaultLive(tid, item);
    const admin = isAdmin();
    const liveStatus = norm(item.status).includes('andamento');
    const name = localStorage.getItem(KEYS.chatName) || currentEmail().split('@')[0] || 'Torcida BDA';
    return `<button type="button" class="mc-close" data-mc-close-live aria-label="Fechar">×</button>
      <header class="mc-live-head"><div><span class="mc-live-pill${liveStatus ? ' active' : ''}"><i></i>${liveStatus ? 'Ao vivo' : esc(statusLabel(item))}</span><h2>Central do jogo</h2><p>${esc(tournament(tid)?.name || 'Campeonato BDA')} • ${esc(item.phase || 'Confronto')}</p></div><button type="button" class="secondary" data-match-preview="${esc(item.id)}">Ficha técnica</button></header>
      <section class="mc-live-score"><article>${badge(a, 'mc-badge large')}<h3>${esc(a)}</h3><span>${esc(center.formationA || 'A definir')}</span></article><div><b>${number(item.a) ? Number(item.a) : 0}</b><em>×</em><b>${number(item.b) ? Number(item.b) : 0}</b><small>Atualização em tempo real</small></div><article>${badge(b, 'mc-badge large')}<h3>${esc(b)}</h3><span>${esc(center.formationB || 'A definir')}</span></article></section>
      <section class="mc-live-stats"><div><span>Posse</span><b>${Number(center.possessionA) || 0}%</b><b>${Number(center.possessionB) || 0}%</b></div><div><span>Chutes</span><b>${Number(center.shotsA) || 0}</b><b>${Number(center.shotsB) || 0}</b></div><div><span>No alvo</span><b>${Number(center.shotsOnA) || 0}</b><b>${Number(center.shotsOnB) || 0}</b></div><div><span>Cartões amarelos</span><b>${Number(center.yellowA) || 0}</b><b>${Number(center.yellowB) || 0}</b></div><div><span>Cartões vermelhos</span><b>${Number(center.redA) || 0}</b><b>${Number(center.redB) || 0}</b></div></section>
      ${admin ? `<details class="mc-admin-panel"><summary>⚙️ Controles da transmissão</summary><form id="mcStatsForm" class="mc-admin-grid"><label>Formação ${esc(a)}<input name="formationA" maxlength="25" value="${esc(center.formationA || '')}"></label><label>Formação ${esc(b)}<input name="formationB" maxlength="25" value="${esc(center.formationB || '')}"></label><label>Posse ${esc(a)}<input name="possessionA" type="number" min="0" max="100" value="${Number(center.possessionA) || 0}"></label><label>Posse ${esc(b)}<input name="possessionB" type="number" min="0" max="100" value="${Number(center.possessionB) || 0}"></label><label>Chutes ${esc(a)}<input name="shotsA" type="number" min="0" max="99" value="${Number(center.shotsA) || 0}"></label><label>Chutes ${esc(b)}<input name="shotsB" type="number" min="0" max="99" value="${Number(center.shotsB) || 0}"></label><label>No alvo ${esc(a)}<input name="shotsOnA" type="number" min="0" max="99" value="${Number(center.shotsOnA) || 0}"></label><label>No alvo ${esc(b)}<input name="shotsOnB" type="number" min="0" max="99" value="${Number(center.shotsOnB) || 0}"></label><label>Amarelos ${esc(a)}<input name="yellowA" type="number" min="0" max="20" value="${Number(center.yellowA) || 0}"></label><label>Amarelos ${esc(b)}<input name="yellowB" type="number" min="0" max="20" value="${Number(center.yellowB) || 0}"></label><label>Vermelhos ${esc(a)}<input name="redA" type="number" min="0" max="10" value="${Number(center.redA) || 0}"></label><label>Vermelhos ${esc(b)}<input name="redB" type="number" min="0" max="10" value="${Number(center.redB) || 0}"></label><button class="primary" type="submit">Salvar estatísticas</button></form><form id="mcEventForm" class="mc-event-form"><select name="type"><option value="goal">⚽ Gol</option><option value="yellow">🟨 Cartão amarelo</option><option value="red">🟥 Cartão vermelho</option><option value="info">📣 Atualização</option></select><input name="minute" maxlength="6" placeholder="Minuto"><select name="team"><option>${esc(a)}</option><option>${esc(b)}</option></select><input name="text" maxlength="140" required placeholder="Descrição do lance"><button class="ghost" type="submit">Adicionar lance</button></form></details>` : ''}
      <div class="mc-live-columns"><section class="mc-panel"><div class="mc-section-head"><div><span>Broadcast</span><h3>Linha do tempo</h3></div><small>Atualiza a cada 30s</small></div><div class="mc-timeline">${renderTimeline(item)}</div></section><section class="mc-panel"><div class="mc-section-head"><div><span>Arquibancada</span><h3>Chat ao vivo</h3></div><small>Mensagens públicas</small></div><div class="mc-chat-list" id="mcChatList">${renderChat(tid, item.id)}</div><form id="mcChatForm" class="mc-chat-form"><input name="author" maxlength="30" value="${esc(name)}" aria-label="Seu nome"><input name="text" maxlength="180" required placeholder="Escreva no chat..."><button class="primary" type="submit">Enviar</button></form></section></div>`;
  }

  function renderLive() {
    if (!active || active.mode !== 'live') return;
    const item = game(active.tid, active.id);
    if (!item) return;
    $('#matchLiveContent').innerHTML = liveHtml(active.tid, item);
    const list = $('#mcChatList');
    if (list) list.scrollTop = list.scrollHeight;
  }

  function stopLiveSubscriptions() {
    liveUnsubscribe?.(); liveUnsubscribe = null;
    matchUnsubscribe?.(); matchUnsubscribe = null;
    chatUnsubscribe?.(); chatUnsubscribe = null;
    clearInterval(refreshTimer); refreshTimer = 0;
  }

  async function refreshLiveRemote() {
    if (!db || !active || active.mode !== 'live') return;
    try {
      const [matchSnapshot, centerSnapshot] = await Promise.all([
        db.collection('arenaData').doc(`confrontos-${active.tid}`).get(),
        db.collection('arenaData').doc(documentId(active.tid, active.id)).get()
      ]);
      const remoteGames = matchSnapshot.data()?.games;
      if (Array.isArray(remoteGames)) {
        const store = matchStore();
        store[active.tid] = remoteGames;
        write(KEYS.matches, store);
      }
      if (centerSnapshot.exists) {
        liveData = { ...liveData, ...centerSnapshot.data() };
        saveLiveLocal(active.tid, active.id, liveData);
      }
      renderLive();
    } catch (error) {
      console.warn('Atualização periódica indisponível', error);
    }
  }

  function subscribeLive() {
    stopLiveSubscriptions();
    if (!db || !active) return;
    const { tid, id } = active;
    matchUnsubscribe = db.collection('arenaData').doc(`confrontos-${tid}`).onSnapshot(snapshot => {
      const remote = snapshot.data()?.games;
      if (!Array.isArray(remote)) return;
      const store = matchStore();
      store[tid] = remote;
      write(KEYS.matches, store);
      renderLive();
    }, error => console.warn('Placar em modo local', error));
    liveUnsubscribe = db.collection('arenaData').doc(documentId(tid, id)).onSnapshot(snapshot => {
      if (!snapshot.exists) return;
      liveData = { ...liveData, ...snapshot.data() };
      saveLiveLocal(tid, id, liveData);
      renderLive();
    }, error => console.warn('Estatísticas em modo local', error));
    chatUnsubscribe = db.collection('liveChat').where('matchKey', '==', localKey(tid, id)).onSnapshot(snapshot => {
      chatMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), localOnly: false }));
      renderLive();
    }, error => console.warn('Chat público indisponível; usando este aparelho', error));
    refreshTimer = window.setInterval(refreshLiveRemote, 30000);
  }

  function openLive(tid, id) {
    const item = game(tid, id);
    if (!item) return;
    closePreview();
    active = { mode: 'live', tid, id };
    liveData = loadLive(tid, item);
    chatMessages = [];
    ensureModals();
    $('#matchLiveModal').classList.add('show');
    document.body.classList.add('mc-modal-open');
    renderLive();
    subscribeLive();
  }

  function closeLive() {
    stopLiveSubscriptions();
    $('#matchLiveModal')?.classList.remove('show');
    if (active?.mode === 'live') active = null;
    document.body.classList.toggle('mc-modal-open', Boolean($('#matchPreviewModal')?.classList.contains('show')));
  }

  async function saveCenter(next) {
    if (!active || !isAdmin()) return;
    liveData = { ...liveData, ...next, updatedAtClient: Date.now(), updatedBy: currentEmail() };
    saveLiveLocal(active.tid, active.id, liveData);
    renderLive();
    if (!db) {
      notify('Estatísticas salvas neste aparelho');
      return;
    }
    try {
      await db.collection('arenaData').doc(documentId(active.tid, active.id)).set({
        ...clone(liveData),
        dataset: 'liveCenter',
        tournamentId: active.tid,
        gameId: active.id,
        serverUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      notify('Transmissão atualizada');
    } catch (error) {
      console.error(error);
      notify('Dados salvos no aparelho; a nuvem não respondeu');
    }
  }

  async function submitStats(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const numeric = ['possessionA','possessionB','shotsA','shotsB','shotsOnA','shotsOnB','yellowA','yellowB','redA','redB'];
    numeric.forEach(key => { values[key] = Math.max(0, Number(values[key]) || 0); });
    values.possessionA = Math.min(100, values.possessionA);
    values.possessionB = Math.min(100, values.possessionB);
    await saveCenter(values);
  }

  async function submitEvent(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const events = Array.isArray(liveData?.events) ? [...liveData.events] : [];
    events.push({ id: `evt-${Date.now().toString(36)}`, type: values.type, minute: values.minute.trim(), team: values.team, text: values.text.trim(), createdAt: Date.now() });
    await saveCenter({ events: events.slice(-120) });
  }

  async function submitChat(form) {
    if (!active) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const author = String(values.author || 'Torcida BDA').trim().slice(0, 30);
    const text = String(values.text || '').trim().slice(0, 180);
    if (author.length < 2 || !text) return;
    localStorage.setItem(KEYS.chatName, author);
    const message = {
      id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      matchKey: localKey(active.tid, active.id),
      tournamentId: active.tid,
      gameId: active.id,
      author,
      text,
      createdAtClient: Date.now(),
      source: 'arena-bda-live',
      status: 'visible',
      localOnly: true
    };
    const local = localChat(active.tid, active.id);
    local.push(message);
    saveLocalChat(active.tid, active.id, local);
    renderLive();
    if (!db) return;
    try {
      await db.collection('liveChat').add({
        matchKey: message.matchKey,
        tournamentId: message.tournamentId,
        gameId: message.gameId,
        author: message.author,
        text: message.text,
        createdAtClient: message.createdAtClient,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        source: message.source,
        status: message.status
      });
      const remaining = localChat(active.tid, active.id).filter(item => item.id !== message.id);
      saveLocalChat(active.tid, active.id, remaining);
    } catch (error) {
      console.warn('Mensagem mantida somente neste aparelho', error);
      notify('Mensagem salva neste aparelho');
    }
  }

  function currentTid() {
    return $('#giManager')?.dataset?.tid || window.ArenaBDAMatchManager?.tournamentId?.() || 'copa-grifo';
  }

  function installEvents() {
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-mc-close-preview]')) { closePreview(); return; }
      if (event.target.closest('[data-mc-close-live]')) { closeLive(); return; }
      const preview = event.target.closest('[data-match-preview]');
      if (preview) { event.preventDefault(); openPreview(currentTid(), preview.dataset.matchPreview); return; }
      const live = event.target.closest('[data-match-live]');
      if (live) { event.preventDefault(); openLive(currentTid(), live.dataset.matchLive); return; }
      if (event.target.closest('[data-mc-global-preview]')) {
        const item = nextGame(currentTid());
        item ? openPreview(currentTid(), item.id) : notify('Nenhum jogo cadastrado');
        return;
      }
      if (event.target.closest('[data-mc-global-live]')) {
        const item = nextGame(currentTid(), true);
        item ? openLive(currentTid(), item.id) : notify('Nenhum jogo cadastrado');
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'mcStatsForm') { event.preventDefault(); submitStats(event.target); }
      if (event.target.id === 'mcEventForm') { event.preventDefault(); submitEvent(event.target); event.target.reset(); }
      if (event.target.id === 'mcChatForm') { event.preventDefault(); submitChat(event.target); event.target.elements.text.value = ''; }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if ($('#matchLiveModal')?.classList.contains('show')) closeLive();
      else if ($('#matchPreviewModal')?.classList.contains('show')) closePreview();
    });
    window.addEventListener('arena:matches-updated', () => {
      scheduleEnhance();
      if (active?.mode === 'live') renderLive();
    });
  }

  function installStyles() {
    if ($('#matchCenterBdaStyles')) return;
    const style = document.createElement('style');
    style.id = 'matchCenterBdaStyles';
    style.textContent = `
      .mc-tools{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 12px}.mc-tools button{min-height:40px}.mc-card-actions{display:flex;gap:7px;margin-top:10px;padding-top:9px;border-top:1px solid var(--line)}.mc-card-actions button{flex:1;min-height:36px;border:1px solid var(--line);border-radius:11px;color:var(--gold-soft);background:rgba(255,255,255,.035);font-size:8px;font-weight:900;text-transform:uppercase}
      .mc-modal-backdrop{z-index:95000;place-items:center}.mc-dialog,.mc-live-dialog{position:relative;width:min(100%,900px);max-height:calc(100dvh - 24px);overflow:auto;padding:22px}.mc-live-dialog{width:min(100%,1040px)}body.mc-modal-open{overflow:hidden}.mc-close{position:absolute;right:13px;top:13px;z-index:4;width:42px;height:42px;padding:0;border:1px solid var(--line);border-radius:13px;color:#fff;background:rgba(3,8,6,.82);font-size:24px}
      .mc-preview-head{padding-right:48px}.mc-preview-head h2,.mc-live-head h2{margin:6px 0 5px;font-size:clamp(34px,7vw,56px);line-height:.9;text-transform:uppercase}.mc-preview-head p,.mc-live-head p{margin:0;color:var(--muted);font-size:10px}.mc-versus,.mc-live-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:13px;margin-top:18px;padding:18px;border:1px solid var(--line-strong);border-radius:22px;background:radial-gradient(circle at 50% 10%,rgba(216,178,72,.13),transparent 40%),rgba(3,8,6,.52)}.mc-versus article,.mc-live-score article{text-align:center}.mc-versus h3,.mc-live-score h3{margin:8px 0 4px;font-size:20px;text-transform:uppercase}.mc-versus article>span,.mc-live-score article>span{display:block;color:var(--gold-soft);font-size:9px}.mc-versus article>small{display:block;margin-top:8px;color:var(--muted);font-size:8px;line-height:1.45}.mc-versus>div,.mc-live-score>div{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;text-align:center}.mc-versus>div b,.mc-live-score>div b{font:900 38px "Barlow Condensed",sans-serif}.mc-versus>div em,.mc-live-score>div em{color:var(--muted);font-style:normal}.mc-versus>div span,.mc-live-score>div small{flex-basis:100%;color:var(--muted);font-size:8px;text-transform:uppercase}
      .mc-badge{overflow:hidden;display:grid;place-items:center;width:42px;height:42px;margin:auto;border:2px solid rgba(255,255,255,.16);border-radius:50%;color:#171107;background:linear-gradient(145deg,var(--gold-soft),var(--gold));font-size:9px;font-weight:900}.mc-badge.large{width:64px;height:64px}.mc-badge img{width:100%;height:100%;object-fit:cover}
      .mc-stat-compare,.mc-live-stats{display:grid;gap:7px;margin-top:11px}.mc-stat-compare>div,.mc-live-stats>div{display:grid;grid-template-columns:1fr 82px 82px;align-items:center;gap:7px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)}.mc-stat-compare span,.mc-live-stats span{color:var(--muted);font-size:8px;text-transform:uppercase}.mc-stat-compare b,.mc-live-stats b{text-align:center;color:var(--gold-soft);font-size:12px}
      .mc-h2h,.mc-panel,.mc-admin-panel{margin-top:14px;padding:16px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.mc-section-head{display:flex;align-items:end;justify-content:space-between;gap:12px}.mc-section-head span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}.mc-section-head h3{margin:3px 0 0;font-size:23px;text-transform:uppercase}.mc-section-head small{color:var(--muted);font-size:8px}.mc-h2h-score{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.mc-h2h-score article{padding:12px;border:1px solid var(--line);border-radius:12px;text-align:center}.mc-h2h-score b,.mc-h2h-score span{display:block}.mc-h2h-score b{color:var(--gold-soft);font:900 25px "Barlow Condensed",sans-serif}.mc-h2h-score span{margin-top:3px;color:var(--muted);font-size:7px}.mc-h2h ol{display:grid;gap:7px;margin:12px 0 0;padding:0;list-style:none}.mc-h2h li{display:flex;justify-content:space-between;gap:10px;padding:9px;border-top:1px solid var(--line);font-size:8px}.mc-h2h li span{color:var(--muted)}.mc-preview-actions{display:flex;justify-content:flex-end;margin-top:14px}
      .mc-live-head{display:flex;align-items:end;justify-content:space-between;gap:12px;padding-right:48px}.mc-live-pill{display:inline-flex;align-items:center;gap:7px;min-height:27px;padding:0 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.mc-live-pill i{width:7px;height:7px;border-radius:50%;background:currentColor}.mc-live-pill.active{color:#ff9aa4;border-color:rgba(255,105,120,.3);background:rgba(255,105,120,.08)}.mc-live-pill.active i{animation:mcLivePulse 1.5s infinite}@keyframes mcLivePulse{50%{opacity:.3;transform:scale(.72)}}
      .mc-admin-panel summary{cursor:pointer;color:var(--gold-soft);font-size:10px;font-weight:900;text-transform:uppercase}.mc-admin-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.mc-admin-grid label{font-size:7px}.mc-admin-grid input,.mc-event-form input,.mc-event-form select{margin-top:5px}.mc-admin-grid button{grid-column:1/-1}.mc-event-form{display:grid;grid-template-columns:150px 85px 1fr 2fr auto;gap:8px;margin-top:12px;align-items:end}
      .mc-live-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mc-timeline,.mc-chat-list{display:grid;gap:8px;max-height:330px;overflow:auto;margin-top:12px}.mc-timeline article{display:grid;grid-template-columns:36px 1fr;gap:9px;padding:9px;border:1px solid var(--line);border-radius:12px}.mc-timeline i{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:rgba(216,178,72,.08);font-style:normal}.mc-timeline b{font-size:9px}.mc-timeline p,.mc-chat-message p{margin:4px 0 0;color:#d4ddd7;font-size:9px;line-height:1.5}.mc-chat-message{padding:10px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025)}.mc-chat-message.local{border-style:dashed}.mc-chat-message>div{display:flex;justify-content:space-between;gap:8px}.mc-chat-message b{color:var(--gold-soft);font-size:9px}.mc-chat-message time,.mc-chat-message small{color:var(--muted);font-size:7px}.mc-chat-form{display:grid;grid-template-columns:110px 1fr auto;gap:7px;margin-top:10px}.mc-empty{padding:18px;color:var(--muted);text-align:center;font-size:9px;border:1px dashed var(--line);border-radius:13px}
      @media(max-width:760px){.mc-dialog,.mc-live-dialog{padding:17px}.mc-versus,.mc-live-score{grid-template-columns:1fr auto 1fr;padding:13px}.mc-badge.large{width:52px;height:52px}.mc-versus h3,.mc-live-score h3{font-size:15px}.mc-live-columns{grid-template-columns:1fr}.mc-admin-grid{grid-template-columns:repeat(2,1fr)}.mc-event-form{grid-template-columns:1fr 1fr}.mc-event-form input[name=text],.mc-event-form button{grid-column:1/-1}.mc-chat-form{grid-template-columns:1fr}.mc-stat-compare>div,.mc-live-stats>div{grid-template-columns:1fr 65px 65px}.mc-live-head{display:grid}.mc-live-head>button{width:100%}}
      @media(max-width:430px){.mc-versus,.mc-live-score{gap:7px}.mc-versus>div b,.mc-live-score>div b{font-size:30px}.mc-badge.large{width:46px;height:46px}.mc-h2h-score{grid-template-columns:1fr}.mc-tools{display:grid}.mc-tools button{width:100%}}
    `;
    document.head.append(style);
  }

  function init() {
    db = window.firebase && typeof firebase.firestore === 'function' ? firebase.firestore() : null;
    installStyles();
    ensureModals();
    installEvents();
    const root = $('#arenaDetail') || $('[data-page="tournament"]') || document.body;
    if (window.ArenaDOMEvents?.subscribe) {
      window.ArenaDOMEvents.subscribe(scheduleEnhance, { selector: '#giManager,.gi-head,.gi-game' });
    } else {
      observer = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node =>
          node instanceof Element && (node.matches('#giManager,.gi-head,.gi-game') || node.querySelector('#giManager,.gi-head,.gi-game'))
        ));
        if (relevant) scheduleEnhance();
      });
      observer.observe(root, { childList: true, subtree: true });
    }
    auth?.subscribe?.(() => { scheduleEnhance(); if (active?.mode === 'live') renderLive(); });
    scheduleEnhance();
  }

  window.ArenaBDAMatchCenter = Object.freeze({
    preview: (tid, id) => openPreview(tid || currentTid(), id),
    live: (tid, id) => openLive(tid || currentTid(), id),
    close: () => { closePreview(); closeLive(); },
    refresh: scheduleEnhance
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
