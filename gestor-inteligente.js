(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const PHASES = ['Preliminar', 'Fase de grupos', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
  const authCore = window.ArenaBDAAuth;

  let tournamentId = 'copa-grifo';
  let currentUser = authCore?.currentUser?.() || null;
  let db = null;
  let cloudUnsubscribe = null;
  let activeTab = 'games';
  let openEditorId = '';
  let cloudTimer = 0;
  let observer = null;
  let rendering = false;

  const scoreSync = window.ArenaBDAScoreSync || (() => {
    const pending = new Map();
    const api = {
      begin(id) {
        const key = String(id || '');
        pending.set(key, (pending.get(key) || 0) + 1);
      },
      end(id) {
        const key = String(id || '');
        const count = (pending.get(key) || 0) - 1;
        if (count > 0) pending.set(key, count);
        else pending.delete(key);
      },
      isPending(id) {
        return (pending.get(String(id || '')) || 0) > 0;
      }
    };
    window.ArenaBDAScoreSync = api;
    return api;
  })();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  const hasNumber = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const stable = value => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stable(value[key]);
        return result;
      }, {});
    }
    return value;
  };
  const stableStringify = value => JSON.stringify(stable(value));

  function adminActive() {
    if (authCore?.isAdmin) return authCore.isAdmin();
    const email = String(currentUser?.email || '').toLowerCase();
    return Boolean(currentUser && (window.ARENA_ADMIN_EMAILS || []).includes(email));
  }

  function currentEmail() {
    if (authCore?.currentEmail) return authCore.currentEmail();
    return String(currentUser?.email || '').toLowerCase();
  }

  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const value = load(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function tournament() {
    return tournaments().find(item => item.id === tournamentId) || null;
  }

  function matchStore() {
    const value = load(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function rawGames(id = tournamentId) {
    const value = matchStore()[id];
    return Array.isArray(value) ? value : [];
  }

  function shape(game, index = 0) {
    const id = String(game?.id || `j-${Date.now().toString(36)}-${index}`);
    const tieId = String(game?.tieId || id.replace(/-(volta|ida|v)$/i, ''));
    return {
      id,
      tieId,
      leg: Number(game?.leg) === 2 ? 2 : 1,
      phase: game?.phase || 'Oitavas de final',
      pos: Number(game?.pos) || index + 1,
      status: game?.status || 'Agendado',
      ta: game?.ta || 'Time A',
      tb: game?.tb || 'Time B',
      a: game?.a === '' || game?.a == null ? '' : Number(game.a),
      b: game?.b === '' || game?.b == null ? '' : Number(game.b),
      pa: game?.pa === '' || game?.pa == null ? '' : Number(game.pa),
      pb: game?.pb === '' || game?.pb == null ? '' : Number(game.pb),
      wo: ['a', 'b'].includes(game?.wo) ? game.wo : 'none',
      date: game?.date || '',
      time: game?.time || '',
      place: game?.place || '',
      note: game?.note || '',
      created: Number(game?.created) || Date.now() + index,
      updated: Number(game?.updated) || Date.now() + index
    };
  }

  function phaseOrder(phase) {
    const value = normalize(phase);
    if (value.includes('prelim')) return 10;
    if (value.includes('grupo')) return 20;
    if (value.includes('oitav')) return 30;
    if (value.includes('quart')) return 40;
    if (value.includes('semi')) return 50;
    if (value === 'final' || value.includes('grande final')) return 60;
    return 25;
  }

  function games() {
    return rawGames()
      .map(shape)
      .sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase) || a.pos - b.pos || a.leg - b.leg || a.created - b.created);
  }

  function saveGames(list, sync = true) {
    const store = matchStore();
    store[tournamentId] = list;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    render();
    window.dispatchEvent(new CustomEvent('arena:matches-updated', { detail: { tournamentId, count: list.length } }));
    if (sync) cloudSave(list);
  }

  function settings() {
    const config = tournament()?.matchSettings || {};
    return {
      legs: Number(config.knockoutLegs) === 2 ? 2 : 1,
      final: Number(config.finalLegs) === 2 ? 2 : Number(config.finalLegs) === 1 ? 1 : 0,
      advance: config.autoAdvance !== false
    };
  }

  function saveSettings(nextSettings) {
    const list = tournaments();
    const index = list.findIndex(item => item.id === tournamentId);
    if (index < 0) return;
    list[index] = {
      ...list[index],
      matchSettings: { ...settings(), ...nextSettings }
    };
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
  }

  function phaseLegs(phase, config = settings()) {
    const value = normalize(phase);
    if (value.includes('grupo')) return 1;
    if (value === 'final' || value.includes('grande final')) return config.final || config.legs;
    return config.legs;
  }

  function initials(name) {
    return String(name || 'BDA')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  function catalog() {
    const map = new Map();
    (load('bda-v2-teams', []) || []).forEach(team => {
      if (team?.name) map.set(normalize(team.name), team);
    });
    (tournament()?.participants || []).forEach(name => {
      if (!map.has(normalize(name))) map.set(normalize(name), { name, code: initials(name) });
    });
    games().forEach(game => {
      [game.ta, game.tb].forEach(name => {
        if (name && !/^vencedor /i.test(name) && !map.has(normalize(name))) {
          map.set(normalize(name), { name, code: initials(name) });
        }
      });
    });
    return map;
  }

  function badge(name, small = false) {
    const team = catalog().get(normalize(name));
    const className = `gi-badge${small ? ' small' : ''}`;
    return team?.badge
      ? `<span class="${className}"><img src="${escapeHtml(team.badge)}" alt="Escudo de ${escapeHtml(name)}"></span>`
      : `<span class="${className}">${escapeHtml(team?.code || initials(name))}</span>`;
  }

  function groups(list = games()) {
    const map = new Map();
    list.forEach(game => {
      if (!map.has(game.tieId)) map.set(game.tieId, []);
      map.get(game.tieId).push(game);
    });
    map.forEach(value => value.sort((a, b) => a.leg - b.leg));
    return map;
  }

  function reference(slot) {
    const match = String(slot || '').match(/^Vencedor\s+(.+)$/i);
    return match ? normalize(match[1]).replace(/\s+/g, '') : '';
  }

  function findTie(referenceValue, grouped) {
    for (const [key, value] of grouped) {
      const normalizedKey = normalize(key).replace(/\s+/g, '');
      const normalizedId = normalize(value[0]?.id || '').replace(/-(volta|ida|v)$/i, '').replace(/\s+/g, '');
      if (normalizedKey === referenceValue || normalizedId === referenceValue) return value;
    }
    return null;
  }

  function resolved(slot, grouped, seen = new Set()) {
    if (!settings().advance) return slot;
    const ref = reference(slot);
    if (!ref || seen.has(ref)) return slot;
    seen.add(ref);
    const tie = findTie(ref, grouped);
    return tie ? winner(tie, grouped, seen)?.team || slot : slot;
  }

  function score(game, side) {
    if (game.wo === 'a') return side === 'a' ? 3 : 0;
    if (game.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game.a : game.b;
    return hasNumber(value) ? Number(value) : null;
  }

  const finished = game => game.wo !== 'none' || (hasNumber(game.a) && hasNumber(game.b));

  function summary(list, grouped = groups()) {
    const totals = new Map();
    let done = true;
    list.forEach(game => {
      const teamA = resolved(game.ta, grouped);
      const teamB = resolved(game.tb, grouped);
      const scoreA = score(game, 'a');
      const scoreB = score(game, 'b');
      if (scoreA == null || scoreB == null) done = false;
      if (!totals.has(teamA)) totals.set(teamA, 0);
      if (!totals.has(teamB)) totals.set(teamB, 0);
      if (scoreA != null) totals.set(teamA, totals.get(teamA) + scoreA);
      if (scoreB != null) totals.set(teamB, totals.get(teamB) + scoreB);
    });

    const teams = [...totals.keys()];
    const teamA = teams[0] || resolved(list[0]?.ta || 'Time A', grouped);
    const teamB = teams[1] || resolved(list[0]?.tb || 'Time B', grouped);
    const scoreA = totals.get(teamA) || 0;
    const scoreB = totals.get(teamB) || 0;
    const last = list[list.length - 1];
    let winnerName = '';

    if (done && scoreA !== scoreB) winnerName = scoreA > scoreB ? teamA : teamB;
    else if (done && last && hasNumber(last.pa) && hasNumber(last.pb) && Number(last.pa) !== Number(last.pb)) {
      winnerName = Number(last.pa) > Number(last.pb) ? resolved(last.ta, grouped) : resolved(last.tb, grouped);
    }

    return { a: teamA, b: teamB, sa: scoreA, sb: scoreB, done, w: winnerName };
  }

  function winner(list, grouped = groups()) {
    const result = summary(list, grouped);
    return result.w ? { team: result.w, summary: result } : null;
  }

  function inferTournament() {
    const heading = $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim();
    const found = tournaments().find(item => normalize(item.name) === normalize(heading));
    if (found && found.id !== tournamentId) {
      tournamentId = found.id;
      activeTab = 'games';
      openEditorId = '';
      listen();
    }
    return tournamentId;
  }

  function metadata(game) {
    const parts = [];
    if (game.date) {
      const [year, month, day] = game.date.split('-');
      parts.push(day && month && year ? `${day}/${month}/${year}` : game.date);
    }
    if (game.time) parts.push(game.time);
    if (game.place) parts.push(game.place);
    return parts.join(' • ');
  }

  function update(id, patch) {
    const list = games();
    const index = list.findIndex(game => game.id === id);
    if (index < 0) return;
    const previous = list[index];
    const next = shape({ ...previous, ...patch, updated: Date.now() }, index);
    list[index] = next;

    if (next.leg === 1 && ('ta' in patch || 'tb' in patch)) {
      const returnIndex = list.findIndex(game => game.tieId === next.tieId && game.leg === 2);
      if (
        returnIndex >= 0
        && normalize(list[returnIndex].ta) === normalize(previous.tb)
        && normalize(list[returnIndex].tb) === normalize(previous.ta)
      ) {
        list[returnIndex] = shape({
          ...list[returnIndex],
          ta: next.tb,
          tb: next.ta,
          updated: Date.now()
        }, returnIndex);
      }
    }

    if (next.status === 'Agendado' && (next.wo !== 'none' || (hasNumber(next.a) && hasNumber(next.b)))) {
      next.status = 'Finalizado';
    }
    saveGames(list);
  }

  function cloudSave(list) {
    if (!db || !adminActive()) return;
    clearTimeout(cloudTimer);
    setCloudStatus('Salvando', 'warn');
    cloudTimer = setTimeout(async () => {
      try {
        await db.collection('arenaData').doc(`confrontos-${tournamentId}`).set({
          dataset: 'confrontos',
          tournamentId,
          games: list,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: currentEmail()
        });
        setCloudStatus('Sincronizado', 'ok');
      } catch (error) {
        console.error(error);
        setCloudStatus('Erro na nuvem', 'error');
        notify(String(error?.code || '').includes('permission-denied')
          ? 'As regras do Firestore não liberaram esta conta'
          : 'Falha ao sincronizar jogos');
      }
    }, 500);
  }

  function setCloudStatus(text, state = '') {
    const element = $('#giCloud');
    if (element) {
      element.textContent = text;
      element.dataset.state = state;
    }
  }

  function listen() {
    if (!db) return;
    cloudUnsubscribe?.();
    cloudUnsubscribe = db.collection('arenaData').doc(`confrontos-${tournamentId}`).onSnapshot(snapshot => {
      const remote = snapshot.data()?.games;
      // Enquanto um placar local está sendo enviado, o Firestore ainda pode
      // entregar o snapshot anterior. Aplicá-lo aqui faria o placar voltar.
      if (scoreSync.isPending(tournamentId)) return;
      if (!snapshot.exists || !Array.isArray(remote) || stableStringify(remote) === stableStringify(rawGames())) return;
      const store = matchStore();
      store[tournamentId] = remote;
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));
      render();
    }, error => {
      console.error(error);
      setCloudStatus('Sem acesso', 'error');
    });
  }

  function scoreInput(game, side) {
    const value = side === 'a' ? game.a : game.b;
    return adminActive()
      ? `<input class="gi-score-input" data-score="${side}" data-id="${escapeHtml(game.id)}" type="number" min="0" max="99" value="${hasNumber(value) ? Number(value) : ''}">`
      : `<b class="gi-score">${hasNumber(value) ? Number(value) : '–'}</b>`;
  }

  function editorOptions(game) {
    const names = [...catalog().values()]
      .map(item => item.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(name => `<option value="${escapeHtml(name)}">`)
      .join('');
    const phases = PHASES.map(phase => `<option ${normalize(phase) === normalize(game.phase) ? 'selected' : ''}>${phase}</option>`).join('');
    const statuses = ['Agendado', 'Em andamento', 'Finalizado', 'Adiado', 'Cancelado']
      .map(status => `<option ${status === game.status ? 'selected' : ''}>${status}</option>`)
      .join('');

    return `<div class="gi-editor" data-editor="${escapeHtml(game.id)}">
      <datalist id="teams-${escapeHtml(game.id)}">${names}</datalist>
      <div class="gi-form">
        <label>Time A<input data-f="ta" list="teams-${escapeHtml(game.id)}" value="${escapeHtml(game.ta)}"></label>
        <label>Time B<input data-f="tb" list="teams-${escapeHtml(game.id)}" value="${escapeHtml(game.tb)}"></label>
        <label>Fase<select data-f="phase">${phases}</select></label>
        <label>Status<select data-f="status">${statuses}</select></label>
        <label>Data<span><input data-f="date" type="date" value="${escapeHtml(game.date)}"></span></label>
        <label>Horário<span><input data-f="time" type="time" value="${escapeHtml(game.time)}"></span></label>
        <label>Local<input data-f="place" value="${escapeHtml(game.place)}"></label>
        <label>Ordem<input data-f="pos" type="number" min="1" value="${game.pos}"></label>
        <label>Pênaltis A<input data-f="pa" type="number" min="0" value="${hasNumber(game.pa) ? Number(game.pa) : ''}"></label>
        <label>Pênaltis B<input data-f="pb" type="number" min="0" value="${hasNumber(game.pb) ? Number(game.pb) : ''}"></label>
        <label>W.O.<select data-f="wo"><option value="none" ${game.wo === 'none' ? 'selected' : ''}>Sem W.O.</option><option value="a" ${game.wo === 'a' ? 'selected' : ''}>Vitória A</option><option value="b" ${game.wo === 'b' ? 'selected' : ''}>Vitória B</option></select></label>
        <label>Jogo<select data-f="leg"><option value="1" ${game.leg === 1 ? 'selected' : ''}>Ida / único</option><option value="2" ${game.leg === 2 ? 'selected' : ''}>Volta</option></select></label>
      </div>
      <label>Observação<textarea data-f="note">${escapeHtml(game.note)}</textarea></label>
      <div class="gi-actions"><button class="secondary" data-clear="${escapeHtml(game.id)}">Limpar resultado</button><button class="primary" data-save="${escapeHtml(game.id)}">Salvar alterações</button></div>
    </div>`;
  }

  function gameCard(game, grouped) {
    const teamA = resolved(game.ta, grouped);
    const teamB = resolved(game.tb, grouped);
    const tie = grouped.get(game.tieId) || [game];
    const result = summary(tie, grouped);
    const editing = openEditorId === game.id && adminActive();
    const winnerA = result.w && normalize(result.w) === normalize(teamA);
    const winnerB = result.w && normalize(result.w) === normalize(teamB);

    return `<article class="gi-game ${editing ? 'editing' : ''}" data-card="${escapeHtml(game.id)}">
      <header><span>${finished(game) ? 'Finalizado' : escapeHtml(game.status)}</span><small>${game.leg === 2 ? 'Volta' : tie.length > 1 ? 'Ida' : 'Jogo único'} • ${escapeHtml(metadata(game) || 'Data a definir')}</small></header>
      <div class="gi-team ${winnerA ? 'winner' : ''}">${badge(teamA)}<div><strong>${escapeHtml(teamA)}</strong>${teamA !== game.ta ? `<small>${escapeHtml(game.ta)}</small>` : ''}</div>${scoreInput(game, 'a')}</div>
      <div class="gi-team ${winnerB ? 'winner' : ''}">${badge(teamB)}<div><strong>${escapeHtml(teamB)}</strong>${teamB !== game.tb ? `<small>${escapeHtml(game.tb)}</small>` : ''}</div>${scoreInput(game, 'b')}</div>
      ${tie.length > 1 ? `<div class="gi-agg"><span>Agregado</span><b>${escapeHtml(result.a)} ${result.sa} × ${result.sb} ${escapeHtml(result.b)}</b></div>` : ''}
      ${game.note ? `<p>${escapeHtml(game.note)}</p>` : ''}
      ${adminActive() ? `<footer><button data-edit="${escapeHtml(game.id)}">${editing ? 'Fechar' : 'Editar tudo'}</button><button class="danger" data-del="${escapeHtml(game.id)}">Excluir</button></footer>` : ''}
      ${editing ? editorOptions(game) : ''}
    </article>`;
  }

  function gamesView(list, grouped) {
    if (!list.length) {
      return `<div class="gi-empty"><b>Nenhum jogo criado</b><span>Adicione o primeiro confronto.</span>${adminActive() ? '<button class="primary" data-add>Adicionar jogo</button>' : ''}</div>`;
    }

    const phases = new Map();
    list.forEach(game => {
      if (!phases.has(game.phase)) phases.set(game.phase, []);
      phases.get(game.phase).push(game);
    });

    return [...phases]
      .sort(([a], [b]) => phaseOrder(a) - phaseOrder(b))
      .map(([phase, phaseGames]) => `<section class="gi-phase"><div><h3>${escapeHtml(phase)}</h3><span>${new Set(phaseGames.map(game => game.tieId)).size} confrontos</span>${adminActive() ? `<button data-add-phase="${escapeHtml(phase)}">+ Jogo</button>` : ''}</div><main>${phaseGames.map(game => gameCard(game, grouped)).join('')}</main></section>`)
      .join('');
  }

  function bracketView(list, grouped) {
    const columns = new Map();
    grouped.forEach(tie => {
      const phase = tie[0]?.phase || 'Confrontos';
      if (!columns.has(phase)) columns.set(phase, []);
      columns.get(phase).push(tie);
    });

    const phaseSummary = [...columns]
      .sort(([a], [b]) => phaseOrder(a) - phaseOrder(b))
      .map(([phase, ties]) => {
        const decided = ties.filter(tie => summary(tie, grouped).done).length;
        return `<span class="${decided === ties.length ? 'done' : ''}"><b>${escapeHtml(phase)}</b><small>${decided}/${ties.length} definidos</small></span>`;
      }).join('');

    return `<div class="gi-bracket-progress">${phaseSummary}</div><div class="gi-bracket-scroll"><div class="gi-bracket">${[...columns]
      .sort(([a], [b]) => phaseOrder(a) - phaseOrder(b))
      .map(([phase, ties]) => `<section><h3>${escapeHtml(phase)}</h3>${ties
        .sort((a, b) => a[0].pos - b[0].pos)
        .map(tie => {
          const result = summary(tie, grouped);
          return `<article data-open="${escapeHtml(tie[0].id)}"><div class="${normalize(result.w) === normalize(result.a) ? 'winner' : ''}">${badge(result.a, true)}<span>${escapeHtml(result.a)}</span><b>${result.done ? result.sa : '–'}</b></div><div class="${normalize(result.w) === normalize(result.b) ? 'winner' : ''}">${badge(result.b, true)}<span>${escapeHtml(result.b)}</span><b>${result.done ? result.sb : '–'}</b></div><small>${tie.length > 1 ? 'Ida e volta' : 'Jogo único'}</small></article>`;
        }).join('')}</section>`)
      .join('')}</div></div>`;
  }

  function configView(config, list) {
    if (!adminActive()) {
      return `<div class="gi-public-config"><div><span>Mata-mata</span><b>${config.legs === 2 ? 'Ida e volta' : 'Jogo único'}</b></div><div><span>Final</span><b>${(config.final || config.legs) === 2 ? 'Ida e volta' : 'Jogo único'}</b></div><div><span>Avanço</span><b>${config.advance ? 'Automático' : 'Manual'}</b></div></div>`;
    }

    return `<div class="gi-config">
      <section><span class="eyebrow">Sistema de disputa</span><h3>Mata-mata</h3><div class="gi-choices"><label class="${config.legs === 1 ? 'active' : ''}"><input type="radio" name="legs" value="1" ${config.legs === 1 ? 'checked' : ''}><b>Jogo único</b><small>Uma partida decide a vaga.</small></label><label class="${config.legs === 2 ? 'active' : ''}"><input type="radio" name="legs" value="2" ${config.legs === 2 ? 'checked' : ''}><b>Ida e volta</b><small>Cria o segundo jogo e soma o agregado.</small></label></div></section>
      <section><label>Regra da final<select id="finalLegs"><option value="0" ${config.final === 0 ? 'selected' : ''}>Seguir padrão</option><option value="1" ${config.final === 1 ? 'selected' : ''}>Jogo único</option><option value="2" ${config.final === 2 ? 'selected' : ''}>Ida e volta</option></select></label></section>
      <section class="gi-switch-row"><div><b>Avanço automático</b><small>Resolve “Vencedor J1” assim que o classificado for definido.</small></div><input id="advance" type="checkbox" ${config.advance ? 'checked' : ''}></section>
      <button class="primary" data-apply>Aplicar formato aos ${list.length} jogos</button>
    </div>`;
  }

  function view() {
    const list = games();
    const grouped = groups(list);
    const config = settings();
    const completed = list.filter(finished).length;
    const progress = list.length ? Math.round((completed / list.length) * 100) : 0;
    const goals = list.reduce((total, game) => total + (score(game, 'a') ?? 0) + (score(game, 'b') ?? 0), 0);
    const content = activeTab === 'bracket'
      ? bracketView(list, grouped)
      : activeTab === 'config'
        ? configView(config, list)
        : gamesView(list, grouped);

    return `<section id="giManager" data-tid="${escapeHtml(tournamentId)}">
      <div class="gi-head"><div><span class="eyebrow">Central inteligente</span><h2>${escapeHtml(tournament()?.name || 'Campeonato')}</h2><p>Edite placares no próprio jogo e controle o formato da competição.</p></div><div><span id="giCloud">${db ? 'Sincronizado' : 'Modo local'}</span>${adminActive() ? '<button class="primary" data-add>+ Novo jogo</button>' : ''}</div></div>
      <div class="gi-metrics"><div><b>${list.length}</b><span>Jogos</span></div><div><b>${completed}</b><span>Finalizados</span></div><div><b>${goals}</b><span>Gols</span></div><div><b>${progress}%</b><span>Progresso</span></div></div>
      <div class="gi-progress" aria-label="${progress}% do campeonato concluído"><span style="width:${progress}%"></span></div>
      <nav><button data-tab="games" class="${activeTab === 'games' ? 'active' : ''}">Jogos</button><button data-tab="bracket" class="${activeTab === 'bracket' ? 'active' : ''}">Chaveamento</button><button data-tab="config" class="${activeTab === 'config' ? 'active' : ''}">Configuração</button></nav>
      <div class="gi-content">${content}</div>
    </section>`;
  }

  function render() {
    if (rendering) return;
    const detail = $('#arenaDetail');
    if (!detail) return;
    inferTournament();
    const focused = document.activeElement?.matches?.('#giManager .gi-score-input')
      ? {
          id: document.activeElement.dataset.id || '',
          side: document.activeElement.dataset.score || ''
        }
      : null;
    const visibleCard = focused?.id
      ? $(`#giManager .gi-game[data-card="${CSS.escape(focused.id)}"]`)
      : $$('#giManager .gi-game').find(card => {
          const rect = card.getBoundingClientRect();
          return rect.bottom > 110 && rect.top < innerHeight;
        });
    const anchor = visibleCard ? { id: visibleCard.dataset.card || '', top: visibleCard.getBoundingClientRect().top } : null;
    const renderedTournamentId = tournamentId;
    rendering = true;
    observer?.disconnect();
    let manager = $('#giManager');
    if (!manager) {
      manager = document.createElement('div');
      const legacy = $('.arena-legacy', detail);
      legacy?.parentNode ? legacy.parentNode.insertBefore(manager, legacy) : detail.append(manager);
    }
    manager.outerHTML = view();
    $$('.arena-legacy', detail).forEach(element => { element.hidden = true; });
    observer?.observe(detail, { childList: true, subtree: true });
    rendering = false;

    const restoreViewport = (restoreFocus = false) => {
      if ($('#giManager')?.dataset.tid !== renderedTournamentId) return;
      if (anchor?.id) {
        const nextCard = $(`#giManager .gi-game[data-card="${CSS.escape(anchor.id)}"]`);
        if (nextCard) {
          const delta = nextCard.getBoundingClientRect().top - anchor.top;
          if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
        }
      }
      if (restoreFocus && focused?.id && focused?.side) {
        const nextInput = $(`#giManager .gi-score-input[data-id="${CSS.escape(focused.id)}"][data-score="${CSS.escape(focused.side)}"]`);
        nextInput?.focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(() => {
      restoreViewport();
      requestAnimationFrame(() => restoreViewport(true));
    });
  }

  function add(phase = 'Oitavas de final') {
    if (!adminActive()) return;
    const list = games();
    const now = Date.now();
    const id = `j-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const pos = Math.max(0, ...list.filter(game => normalize(game.phase) === normalize(phase) && game.leg === 1).map(game => game.pos)) + 1;
    list.push(shape({ id, tieId: id, leg: 1, phase, pos, ta: 'Time A', tb: 'Time B', status: 'Agendado', created: now, updated: now }));
    openEditorId = id;
    activeTab = 'games';
    saveGames(list);
    setTimeout(() => $(`[data-card="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  function saveEditor(id) {
    const editor = $(`[data-editor="${CSS.escape(id)}"]`);
    if (!editor) return;
    const patch = {};
    $$('[data-f]', editor).forEach(input => {
      let value = input.value;
      if (['pos', 'leg'].includes(input.dataset.f)) value = Number(value) || 1;
      if (['pa', 'pb'].includes(input.dataset.f)) value = value === '' ? '' : Number(value);
      patch[input.dataset.f] = value;
    });
    update(id, patch);
    openEditorId = '';
    render();
    notify('Confronto atualizado');
  }

  function applyFormat() {
    const config = {
      legs: Number($('input[name="legs"]:checked')?.value || 1) === 2 ? 2 : 1,
      final: Number($('#finalLegs')?.value || 0),
      advance: Boolean($('#advance')?.checked)
    };
    const list = games();
    const grouped = groups(list);
    const output = [];
    let playedReturn = false;

    grouped.forEach(tie => {
      const first = tie.find(game => game.leg === 1) || tie[0];
      const second = tie.find(game => game.leg === 2);
      const twoLegs = phaseLegs(first.phase, config) === 2;
      output.push({ ...first, leg: 1, tieId: first.tieId || first.id });
      if (twoLegs) {
        output.push(second ? { ...second, leg: 2, tieId: first.tieId || first.id } : shape({
          ...first,
          id: `${first.tieId || first.id}-volta`,
          tieId: first.tieId || first.id,
          leg: 2,
          ta: first.tb,
          tb: first.ta,
          a: '', b: '', pa: '', pb: '', wo: 'none', status: 'Agendado', date: '', time: '', place: '', note: '',
          created: Date.now() + output.length
        }));
      } else if (second && finished(second)) {
        playedReturn = true;
      }
    });

    if (playedReturn && !confirm('Há jogos de volta com resultado. Removê-los?')) return;
    saveSettings({ knockoutLegs: config.legs, finalLegs: config.final, autoAdvance: config.advance });
    saveGames(output);
    activeTab = 'games';
    notify(config.legs === 2 ? 'Ida e volta ativado' : 'Jogo único ativado');
  }

  function handleClicks(event) {
    const tournamentButton = event.target.closest('[data-open-tournament],[data-home-tournament]');
    if (tournamentButton) {
      tournamentId = tournamentButton.dataset.openTournament || tournamentButton.dataset.homeTournament || tournamentId;
      activeTab = 'games';
      openEditorId = '';
      setTimeout(() => { inferTournament(); listen(); render(); }, 60);
    }

    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      activeTab = tabButton.dataset.tab;
      openEditorId = '';
      render();
      return;
    }
    if (event.target.closest('[data-add]')) { add(); return; }
    const phaseButton = event.target.closest('[data-add-phase]');
    if (phaseButton) { add(phaseButton.dataset.addPhase); return; }
    const editButton = event.target.closest('[data-edit]');
    if (editButton) {
      openEditorId = openEditorId === editButton.dataset.edit ? '' : editButton.dataset.edit;
      render();
      return;
    }
    const saveButton = event.target.closest('[data-save]');
    if (saveButton) { saveEditor(saveButton.dataset.save); return; }
    const clearButton = event.target.closest('[data-clear]');
    if (clearButton) {
      update(clearButton.dataset.clear, { a: '', b: '', pa: '', pb: '', wo: 'none', status: 'Agendado' });
      return;
    }
    const deleteButton = event.target.closest('[data-del]');
    if (deleteButton) {
      const game = games().find(item => item.id === deleteButton.dataset.del);
      if (game && confirm(`Excluir ${game.ta} × ${game.tb}?`)) {
        saveGames(games().filter(item => item.id !== game.id));
        openEditorId = '';
      }
      return;
    }
    if (event.target.closest('[data-apply]')) { applyFormat(); return; }
    const openButton = event.target.closest('[data-open]');
    if (openButton) {
      activeTab = 'games';
      openEditorId = adminActive() ? openButton.dataset.open : '';
      render();
      setTimeout(() => $(`[data-card="${CSS.escape(openButton.dataset.open)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }

  const scoreTimers = new Map();
  function handleInputs(event) {
    const scoreField = event.target.closest('[data-score]');
    if (scoreField) {
      const key = scoreField.dataset.id + scoreField.dataset.score;
      clearTimeout(scoreTimers.get(key));
      scoreTimers.set(key, setTimeout(() => {
        update(scoreField.dataset.id, { [scoreField.dataset.score]: scoreField.value === '' ? '' : Number(scoreField.value) });
        notify('Placar salvo');
      }, 400));
    }
    const radio = event.target.closest('input[name="legs"]');
    if (radio) {
      $$('.gi-choices label').forEach(label => label.classList.toggle('active', label.contains(radio) && radio.checked));
    }
  }

  function installStyles() {
    if ($('#gestorInteligenteStyles')) return;
    const style = document.createElement('style');
    style.id = 'gestorInteligenteStyles';
    style.textContent = `
      #giManager{margin-top:22px;text-align:left}.gi-head{display:flex;justify-content:space-between;gap:15px;padding:18px;border:1px solid var(--line-strong);border-radius:23px;background:linear-gradient(145deg,#183a26ee,#06100bee);box-shadow:var(--shadow)}.gi-head h2{margin:5px 0;font-size:clamp(30px,7vw,50px);line-height:.9;text-transform:uppercase}.gi-head p{margin:0;color:#cbd7ce;font-size:10px}.gi-head>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.gi-head>div:last-child span{display:flex;align-items:center;min-height:38px;padding:0 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.gi-head>div:last-child span[data-state=ok]{color:var(--green)}.gi-head>div:last-child span[data-state=error]{color:#ff9aa4}
      .gi-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.gi-metrics div,.gi-public-config div{padding:12px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.gi-metrics b{display:block;color:var(--gold-soft);font:900 19px "Barlow Condensed",sans-serif;text-transform:uppercase}.gi-metrics span,.gi-public-config span{color:var(--muted);font-size:8px;text-transform:uppercase}
      .gi-progress{overflow:hidden;height:6px;margin:-3px 0 10px;border-radius:999px;background:#ffffff0c}.gi-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--green),var(--gold-soft));transition:width .35s ease}
      #giManager>nav{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px;border:1px solid var(--line);border-radius:15px;background:#03080680}#giManager>nav button{min-height:39px;border:0;border-radius:10px;color:var(--muted);background:none;font-size:9px;font-weight:900;text-transform:uppercase}#giManager>nav button.active{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.gi-content{margin-top:12px}
      .gi-phase{margin-top:15px}.gi-phase>div{display:flex;align-items:center;gap:9px;margin-bottom:8px}.gi-phase h3{margin:0;color:var(--gold-soft);font:900 20px "Barlow Condensed",sans-serif;text-transform:uppercase}.gi-phase>div span{color:var(--muted);font-size:8px;text-transform:uppercase}.gi-phase>div button{margin-left:auto;padding:8px;border:1px solid var(--line);border-radius:9px;color:var(--gold-soft);background:#ffffff06;font-size:8px;font-weight:900}.gi-phase>main{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
      .gi-game{overflow:hidden;padding:12px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.gi-game.editing{grid-column:1/-1;border-color:var(--gold)}.gi-game header{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}.gi-game header span{padding:6px 8px;border-radius:999px;color:var(--green);background:rgba(79,223,143,.1);font-size:7px;font-weight:900;text-transform:uppercase}.gi-game header small{color:var(--muted);font-size:8px;text-align:right}
      .gi-team{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:9px;min-height:48px;padding:7px;border-top:1px solid var(--line);border-radius:10px}.gi-team.winner{color:var(--green);background:rgba(79,223,143,.06)}.gi-team>div{min-width:0}.gi-team strong,.gi-team small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gi-team strong{font-size:11px}.gi-team small{color:var(--muted);font-size:7px}.gi-badge{overflow:hidden;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;color:#171107;background:linear-gradient(145deg,#f4dfa0,#c79a2e);font-size:8px;font-weight:900}.gi-badge.small{width:25px;height:25px}.gi-badge img{width:100%;height:100%;object-fit:cover}
      .gi-score{min-width:30px;text-align:center;font:900 24px "Barlow Condensed",sans-serif}.gi-score-input{width:44px!important;height:38px!important;margin:0!important;padding:0!important;border:1px solid var(--line-strong)!important;border-radius:10px!important;color:var(--gold-soft)!important;background:#030806!important;font:900 20px "Barlow Condensed",sans-serif!important;text-align:center!important}.gi-agg{display:flex;justify-content:space-between;gap:8px;margin-top:7px;padding:8px;border:1px solid rgba(216,178,72,.18);border-radius:9px;background:rgba(216,178,72,.06)}.gi-agg span{color:var(--muted);font-size:8px;text-transform:uppercase}.gi-agg b{color:var(--gold-soft);font-size:8px;text-align:right}.gi-game p{padding:8px;border-radius:9px;color:var(--muted);background:#ffffff06;font-size:8px}.gi-game footer{display:flex;justify-content:flex-end;gap:12px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}.gi-game footer button{padding:0;border:0;color:var(--gold-soft);background:none;font-size:8px;font-weight:900;text-transform:uppercase}.gi-game footer button.danger{color:#ff9aa4}
      .gi-editor{margin-top:10px;padding:12px;border:1px solid var(--line-strong);border-radius:13px;background:#03080690}.gi-form{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.gi-editor label,.gi-config label{display:block;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.gi-editor input,.gi-editor select,.gi-editor textarea,.gi-config select{width:100%;margin-top:5px;padding:10px;border:1px solid var(--line);border-radius:10px;color:var(--text);background:#07100c;font-size:10px;text-transform:none}.gi-editor label>span{display:flex;margin-top:5px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#07100c}.gi-editor label>span input{margin:0;padding:0;border:0}.gi-editor textarea{min-height:70px}.gi-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      .gi-empty{display:grid;place-items:center;gap:7px;min-height:210px;padding:22px;border:1px dashed var(--line-strong);border-radius:17px;color:var(--muted);text-align:center}.gi-bracket-progress{display:flex;gap:7px;margin-bottom:10px;overflow-x:auto;scrollbar-width:thin}.gi-bracket-progress>span{min-width:130px;padding:9px;border:1px solid var(--line);border-radius:11px;background:#ffffff05}.gi-bracket-progress>span.done{border-color:rgba(79,223,143,.3);background:rgba(79,223,143,.07)}.gi-bracket-progress b,.gi-bracket-progress small{display:block}.gi-bracket-progress b{font-size:9px}.gi-bracket-progress small{margin-top:3px;color:var(--muted);font-size:7px}.gi-bracket-scroll{overflow-x:auto;scroll-snap-type:x proximity}.gi-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:220px;gap:11px;min-width:max-content}.gi-bracket section{scroll-snap-align:start}.gi-bracket section>h3{position:sticky;left:0;color:var(--gold-soft);font:900 18px "Barlow Condensed",sans-serif;text-transform:uppercase}.gi-bracket article{margin-bottom:8px;padding:9px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(150deg,var(--surface-2),var(--surface));cursor:pointer}.gi-bracket article>div{display:grid;grid-template-columns:25px 1fr auto;align-items:center;gap:7px;padding:4px;border-radius:8px}.gi-bracket article>div.winner{color:var(--green);background:rgba(79,223,143,.06)}.gi-bracket article span{overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.gi-bracket article>small{display:block;color:var(--muted);font-size:7px;text-align:center}
      .gi-config{display:grid;gap:9px}.gi-config section{padding:14px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.gi-config h3{margin:5px 0;font-size:20px;text-transform:uppercase}.gi-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gi-choices label{position:relative;padding:12px;border:1px solid var(--line);border-radius:12px;background:#ffffff05}.gi-choices label.active{border-color:var(--gold);background:rgba(216,178,72,.08)}.gi-choices input{position:absolute;opacity:0}.gi-choices b,.gi-choices small{display:block}.gi-choices b{color:var(--text);font-size:11px}.gi-choices small{margin-top:4px;color:var(--muted);font-size:8px;text-transform:none}.gi-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.gi-switch-row b,.gi-switch-row small{display:block}.gi-switch-row small{max-width:500px;color:var(--muted);font-size:8px}.gi-switch-row input{width:22px;height:22px}.gi-public-config{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.gi-public-config b{display:block;margin-top:5px;color:var(--gold-soft);font-size:11px}
      @media(max-width:700px){.gi-head{display:grid}.gi-head>div:last-child{justify-content:flex-start}.gi-metrics{grid-template-columns:repeat(2,1fr)}.gi-phase>main{grid-template-columns:1fr}.gi-game.editing{grid-column:auto}.gi-form,.gi-choices,.gi-public-config{grid-template-columns:1fr}}
      @media(max-width:430px){.gi-head{padding:14px}.gi-head>div:last-child{display:grid;grid-template-columns:1fr 1fr}.gi-head>div:last-child>*{width:100%;justify-content:center}.gi-actions{display:grid}.gi-actions button{width:100%}}
    `;
    document.head.append(style);
  }

  installStyles();
  document.addEventListener('click', handleClicks);
  document.addEventListener('input', handleInputs);

  observer = new MutationObserver(() => {
    if (rendering || $('#giManager') || !$('#arenaDetail')) return;
    render();
  });

  const observerRoot = $('#arenaDetail') || $('[data-page="tournament"]') || document.body;
  observer.observe(observerRoot, { childList: true, subtree: true });

  if (window.firebase && typeof firebase.firestore === 'function') {
    db = firebase.firestore();
    listen();
  }

  if (authCore?.subscribe) {
    authCore.subscribe(state => {
      currentUser = state.user;
      if (!state.isAdmin) openEditorId = '';
      render();
    });
  } else if (window.firebase?.auth) {
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      if (!adminActive()) openEditorId = '';
      render();
    });
  }

  window.addEventListener('arena:permissions-updated', render);
  window.ArenaBDAMatchManager = Object.freeze({
    render,
    open: id => {
      activeTab = 'games';
      openEditorId = adminActive() ? String(id || '') : '';
      render();
    },
    tournamentId: () => tournamentId,
    isAdmin: adminActive
  });

  render();
})();
