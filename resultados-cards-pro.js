(() => {
  'use strict';

  const MATCH_KEY = 'bda-v3-confrontos';
  const authCore = window.ArenaBDAAuth;
  const pendingScores = new Map();
  const cloudTimers = new Map();
  const cloudCards = new Map();
  const scoreSync = window.ArenaBDAScoreSync;

  let observer = null;
  let enhanceFrame = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const hasNumber = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function isAdmin() {
    if (authCore?.isAdmin) return authCore.isAdmin();
    const user = window.firebase?.auth?.()?.currentUser;
    const email = String(user?.email || '').toLowerCase();
    return Boolean(user && (window.ARENA_ADMIN_EMAILS || []).includes(email));
  }

  function currentEmail() {
    if (authCore?.currentEmail) return authCore.currentEmail();
    return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
  }

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function tournamentId() {
    return $('#giManager')?.dataset?.tid || window.ArenaBDAMatchManager?.tournamentId?.() || 'copa-grifo';
  }

  function gameFinished(game) {
    return game?.wo === 'a' || game?.wo === 'b' || (hasNumber(game?.a) && hasNumber(game?.b));
  }

  function gameScore(game, side) {
    if (game?.wo === 'a') return side === 'a' ? 3 : 0;
    if (game?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game?.a : game?.b;
    return hasNumber(value) ? Number(value) : null;
  }

  function statusClass(text) {
    const value = normalize(text);
    if (value.includes('final')) return 'is-finished';
    if (value.includes('andamento')) return 'is-live';
    if (value.includes('adiado') || value.includes('cancelado')) return 'is-alert';
    return 'is-scheduled';
  }

  function markCard(card, text, state = '') {
    if (!card) return;
    let indicator = $('.gip-save-state', card);
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'gip-save-state';
      $(':scope > header', card)?.append(indicator);
    }
    indicator.textContent = text;
    indicator.dataset.state = state;
    indicator.hidden = !text;
  }

  function enhanceCard(card) {
    if (!card || card.dataset.resultsProReady === 'true') return;

    const header = $(':scope > header', card);
    const teams = $$(':scope > .gi-team', card).slice(0, 2);
    if (!header || teams.length !== 2) return;

    card.dataset.resultsProReady = 'true';
    card.classList.add('gip-card');
    header.classList.add('gip-card-head');

    const status = $(':scope > span', header);
    if (status) {
      status.classList.add('gip-status');
      status.classList.add(statusClass(status.textContent));
    }

    const meta = $(':scope > small', header);
    meta?.classList.add('gip-meta');

    const body = document.createElement('div');
    body.className = 'gip-match-body';

    const scoreBoard = document.createElement('div');
    scoreBoard.className = 'gip-scoreboard';
    scoreBoard.setAttribute('aria-label', 'Placar do confronto');

    teams.forEach((team, index) => {
      team.classList.add('gip-team', index === 0 ? 'gip-team-home' : 'gip-team-away');
      const score = $('.gi-score-input,.gi-score', team);
      if (score) {
        if (score.matches?.('.gi-score-input')) {
          score.dataset.quickSavedValue = score.value;
          const teamName = $('strong', team)?.textContent?.trim() || (index === 0 ? 'Time A' : 'Time B');
          score.setAttribute('aria-label', `Placar de ${teamName}`);
          score.setAttribute('inputmode', 'numeric');
        }
        scoreBoard.append(score);
      }
      if (index === 0) {
        const separator = document.createElement('span');
        separator.className = 'gip-score-separator';
        separator.textContent = '×';
        scoreBoard.append(separator);
      }
    });

    const firstScore = scoreBoard.children[0];
    const separator = scoreBoard.querySelector('.gip-score-separator');
    const secondScore = [...scoreBoard.children].find(node => node !== firstScore && node !== separator);
    if (firstScore && separator && secondScore) scoreBoard.replaceChildren(firstScore, separator, secondScore);

    body.append(teams[0], scoreBoard, teams[1]);
    header.after(body);

    const aggregate = $(':scope > .gi-agg', card);
    aggregate?.classList.add('gip-aggregate');
    const note = $(':scope > p', card);
    note?.classList.add('gip-note');

    const footer = $(':scope > footer', card);
    if (footer) {
      footer.classList.add('gip-actions');
      const edit = $('[data-edit]', footer);
      if (edit) edit.textContent = 'Editar jogo';
      const remove = $('[data-del]', footer);
      if (remove) remove.setAttribute('aria-label', 'Excluir confronto');
    }

    markCard(card, '', '');
  }

  function enhanceAll() {
    enhanceFrame = 0;
    $$('#giManager .gi-game').forEach(enhanceCard);
  }

  function scheduleEnhance() {
    if (enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(enhanceAll);
  }

  function tieSummary(list, tieId) {
    const related = list.filter(game => String(game?.tieId || game?.id) === String(tieId));
    const totals = new Map();
    let done = related.length > 0;

    related.forEach(game => {
      const scoreA = gameScore(game, 'a');
      const scoreB = gameScore(game, 'b');
      if (scoreA == null || scoreB == null) done = false;
      const teamA = String(game?.ta || 'Time A');
      const teamB = String(game?.tb || 'Time B');
      if (!totals.has(normalize(teamA))) totals.set(normalize(teamA), { name: teamA, score: 0 });
      if (!totals.has(normalize(teamB))) totals.set(normalize(teamB), { name: teamB, score: 0 });
      if (scoreA != null) totals.get(normalize(teamA)).score += scoreA;
      if (scoreB != null) totals.get(normalize(teamB)).score += scoreB;
    });

    const values = [...totals.values()];
    let winner = '';
    if (done && values.length >= 2 && values[0].score !== values[1].score) {
      winner = values[0].score > values[1].score ? values[0].name : values[1].name;
    } else if (done) {
      const last = related[related.length - 1];
      if (hasNumber(last?.pa) && hasNumber(last?.pb) && Number(last.pa) !== Number(last.pb)) {
        winner = Number(last.pa) > Number(last.pb) ? last.ta : last.tb;
      }
    }

    return { related, values, done, winner };
  }

  function updateMetrics(list) {
    const metrics = $$('#giManager .gi-metrics > div > b');
    if (metrics[0]) metrics[0].textContent = String(list.length);
    if (metrics[1]) metrics[1].textContent = String(list.filter(gameFinished).length);
    if (metrics[2]) {
      const goals = list.reduce((total, game) => total + (gameScore(game, 'a') ?? 0) + (gameScore(game, 'b') ?? 0), 0);
      metrics[2].textContent = String(goals);
    }
  }

  function updateCards(list, tieId) {
    const result = tieSummary(list, tieId);
    const winnerKey = normalize(result.winner);

    result.related.forEach(game => {
      const card = $(`#giManager .gi-game[data-card="${CSS.escape(String(game.id))}"]`);
      if (!card) return;

      const status = $('.gip-status', card);
      if (status) {
        status.className = `gip-status ${statusClass(gameFinished(game) ? 'Finalizado' : game.status)}`;
        status.textContent = gameFinished(game) ? 'Finalizado' : String(game.status || 'Agendado');
      }

      $$('.gip-team', card).forEach(team => {
        const name = $('strong', team)?.textContent || '';
        team.classList.toggle('winner', Boolean(winnerKey && normalize(name) === winnerKey));
      });

      const aggregate = $('.gip-aggregate b', card);
      if (aggregate && result.values.length >= 2) {
        aggregate.textContent = `${result.values[0].name} ${result.values[0].score} × ${result.values[1].score} ${result.values[1].name}`;
      }
    });
  }

  function queueCloudSave(tid, cardId) {
    if (!cloudCards.has(tid)) cloudCards.set(tid, new Set());
    const startsBatch = cloudCards.get(tid).size === 0;
    cloudCards.get(tid).add(String(cardId));
    if (startsBatch) scoreSync?.begin?.(tid);
    clearTimeout(cloudTimers.get(tid));

    cloudTimers.set(tid, setTimeout(async () => {
      const ids = cloudCards.get(tid) || new Set();
      const cards = [...ids].map(id => $(`#giManager .gi-game[data-card="${CSS.escape(id)}"]`)).filter(Boolean);
      cards.forEach(card => markCard(card, 'Salvando...', 'saving'));

      try {
        const store = readStore();
        const list = Array.isArray(store[tid]) ? store[tid] : [];
        if (!window.firebase || typeof firebase.firestore !== 'function' || !isAdmin()) {
          cards.forEach(card => markCard(card, 'Salvo neste aparelho', 'local'));
          return;
        }

        await firebase.firestore().collection('arenaData').doc(`confrontos-${tid}`).set({
          dataset: 'confrontos',
          tournamentId: tid,
          games: list,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: currentEmail()
        });
        cards.forEach(card => markCard(card, 'Salvo', 'ok'));
        window.dispatchEvent(new CustomEvent('arena:quick-score-saved', { detail: { tournamentId: tid, gameIds: [...ids] } }));
      } catch (error) {
        console.error(error);
        cards.forEach(card => markCard(card, 'Salvo no aparelho', 'error'));
        notify('O placar foi salvo neste aparelho, mas a nuvem não respondeu');
      } finally {
        cloudCards.set(tid, new Set());
        scoreSync?.end?.(tid);
        setTimeout(() => cards.forEach(card => markCard(card, '', '')), 2200);
      }
    }, 850));
  }

  function saveQuickScore(input) {
    if (!input?.isConnected || !isAdmin()) return;
    const tid = tournamentId();
    const gameId = String(input.dataset.id || '');
    const side = input.dataset.score;
    if (!gameId || !['a', 'b'].includes(side)) return;
    if (input.dataset.quickSavedValue === input.value) {
      markCard(input.closest('.gi-game'), '', '');
      return;
    }

    const store = readStore();
    const list = Array.isArray(store[tid]) ? [...store[tid]] : [];
    const index = list.findIndex(game => String(game?.id) === gameId);
    if (index < 0) return;

    const game = { ...list[index] };
    game[side] = input.value === '' ? '' : Math.max(0, Math.min(99, Number(input.value) || 0));
    game.updated = Date.now();
    if ((game.wo === 'a' || game.wo === 'b') || (hasNumber(game.a) && hasNumber(game.b))) game.status = 'Finalizado';
    list[index] = game;
    store[tid] = list;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    input.dataset.quickSavedValue = input.value;

    const card = input.closest('.gi-game');
    markCard(card, 'Aguardando...', 'pending');
    updateMetrics(list);
    updateCards(list, game.tieId || game.id);
    queueCloudSave(tid, gameId);
  }

  function scheduleQuickScore(input, delay = 560) {
    const key = `${input.dataset.id}:${input.dataset.score}`;
    const existing = pendingScores.get(key);
    if (existing?.timer) clearTimeout(existing.timer);
    const item = { input, timer: setTimeout(() => {
      pendingScores.delete(key);
      saveQuickScore(input);
    }, delay) };
    pendingScores.set(key, item);
  }

  function flushQuickScore(input) {
    const key = `${input.dataset.id}:${input.dataset.score}`;
    const existing = pendingScores.get(key);
    if (existing?.timer) clearTimeout(existing.timer);
    pendingScores.delete(key);
    saveQuickScore(input);
  }

  document.addEventListener('input', event => {
    const input = event.target.closest?.('#giManager .gi-score-input');
    if (!input) return;
    event.stopPropagation();
    const card = input.closest('.gi-game');
    markCard(card, 'Editando...', 'pending');
    scheduleQuickScore(input);
  }, true);

  document.addEventListener('blur', event => {
    const input = event.target.closest?.('#giManager .gi-score-input');
    if (!input) return;
    flushQuickScore(input);
  }, true);

  document.addEventListener('keydown', event => {
    const input = event.target.closest?.('#giManager .gi-score-input');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    flushQuickScore(input);
    input.blur();
  }, true);

  document.addEventListener('click', event => {
    const bracketGame = event.target.closest('#giManager [data-open]');
    if (bracketGame && isAdmin() && window.ArenaBDAMatchEditorV2?.open) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.ArenaBDAMatchEditorV2.open(bracketGame.dataset.open, bracketGame);
      return;
    }

    const addButton = event.target.closest('#giManager [data-add],#giManager [data-add-phase]');
    if (!addButton || !isAdmin()) return;
    setTimeout(() => {
      const editing = $('#giManager .gi-game.editing');
      const id = editing?.dataset?.card;
      if (!id || !window.ArenaBDAMatchEditorV2?.open) return;
      window.ArenaBDAMatchManager?.open?.('');
      setTimeout(() => window.ArenaBDAMatchEditorV2.open(id, addButton), 0);
    }, 80);
  }, true);

  const style = document.createElement('style');
  style.id = 'resultadosCardsProStyles';
  style.textContent = `
    #giManager .gi-phase{margin-top:20px}
    #giManager .gi-phase>div{margin-bottom:10px;padding:0 2px}
    #giManager .gi-phase>div h3{font-size:23px;letter-spacing:.02em}
    #giManager .gi-phase>main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
    #giManager .gip-card{position:relative;overflow:hidden;padding:0!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(16,31,23,.98),rgba(5,12,8,.98))!important;box-shadow:0 12px 32px rgba(0,0,0,.26)!important;contain:layout paint;transform:translateZ(0)}
    #giManager .gip-card:before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,var(--gold-soft,#f5dc86),transparent);opacity:.62}
    #giManager .gip-card-head{display:flex!important;align-items:center;justify-content:space-between;gap:8px;margin:0!important;padding:9px 11px 8px!important;border-bottom:1px solid rgba(255,255,255,.075)}
    #giManager .gip-status{display:inline-flex;align-items:center;min-height:22px;padding:0 8px!important;border:1px solid rgba(255,255,255,.10);border-radius:999px;color:#bdd0c2!important;background:rgba(255,255,255,.055)!important;font-size:7px!important;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    #giManager .gip-status.is-finished{border-color:rgba(77,225,139,.24);color:#8ff0b5!important;background:rgba(77,225,139,.10)!important}
    #giManager .gip-status.is-live{border-color:rgba(255,206,85,.28);color:#ffe08b!important;background:rgba(255,206,85,.10)!important}
    #giManager .gip-status.is-alert{border-color:rgba(255,118,130,.28);color:#ffadb5!important;background:rgba(255,118,130,.10)!important}
    #giManager .gip-meta{overflow:hidden;margin-left:auto;color:#9fb0a5!important;font-size:7px!important;font-weight:750;text-align:right;text-overflow:ellipsis;white-space:nowrap}
    #giManager .gip-save-state{flex:0 0 auto;padding:5px 7px;border-radius:999px;color:#a9b8ae;background:rgba(255,255,255,.055);font-size:7px;font-weight:900;text-transform:uppercase}
    #giManager .gip-save-state[data-state="saving"]{color:#ffe08b;background:rgba(255,206,85,.10)}
    #giManager .gip-save-state[data-state="ok"]{color:#8ff0b5;background:rgba(77,225,139,.10)}
    #giManager .gip-save-state[data-state="error"]{color:#ffadb5;background:rgba(255,118,130,.10)}
    #giManager .gip-match-body{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px;padding:10px 11px}
    #giManager .gip-team{display:flex!important;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;min-width:0;min-height:78px;padding:8px!important;border:1px solid rgba(255,255,255,.07)!important;border-radius:13px!important;background:rgba(255,255,255,.028)!important}
    #giManager .gip-team-away{align-items:flex-end;text-align:right}
    #giManager .gip-team.winner{color:#fff!important;border-color:rgba(245,220,134,.32)!important;background:linear-gradient(145deg,rgba(245,220,134,.11),rgba(255,255,255,.025))!important;box-shadow:inset 0 0 0 1px rgba(245,220,134,.04)}
    #giManager .gip-team .gi-badge{width:40px!important;height:40px!important;border:1px solid rgba(255,255,255,.13);box-shadow:0 7px 16px rgba(0,0,0,.22)}
    #giManager .gip-team>div{width:100%;min-width:0}
    #giManager .gip-team strong{display:-webkit-box!important;overflow:hidden!important;white-space:normal!important;font-size:10px!important;line-height:1.18;-webkit-box-orient:vertical;-webkit-line-clamp:2}
    #giManager .gip-team small{margin-top:3px;font-size:7px!important}
    #giManager .gip-scoreboard{display:grid;grid-template-columns:42px 13px 42px;align-items:center;justify-items:center;gap:3px;padding:7px 6px;border:1px solid rgba(245,220,134,.20);border-radius:14px;background:linear-gradient(180deg,rgba(2,7,4,.96),rgba(10,20,14,.96));box-shadow:0 8px 20px rgba(0,0,0,.26)}
    #giManager .gip-score-separator{color:#708078;font:900 17px/1 "Barlow Condensed",sans-serif}
    #giManager .gip-scoreboard .gi-score{min-width:0!important;color:#fff;font:900 31px/1 "Barlow Condensed",sans-serif!important}
    #giManager .gip-scoreboard .gi-score-input{box-sizing:border-box;width:42px!important;height:40px!important;margin:0!important;padding:0!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:10px!important;color:#fff!important;background:#030806!important;font:900 24px/1 "Barlow Condensed",sans-serif!important;text-align:center!important;outline:none}
    #giManager .gip-scoreboard .gi-score-input:focus{border-color:var(--gold,#d8b248)!important;box-shadow:0 0 0 3px rgba(216,178,72,.13)}
    #giManager .gip-aggregate{margin:0 14px 11px!important;padding:9px 10px!important;border:1px solid rgba(245,220,134,.13)!important;border-radius:11px!important;background:rgba(245,220,134,.045)!important}
    #giManager .gip-aggregate span{font-size:7px!important}.gip-aggregate b{font-size:8px!important}
    #giManager .gip-note{margin:0 14px 11px!important;padding:9px 10px!important;border:1px solid rgba(255,255,255,.06);border-radius:11px!important;color:#afbeb4!important;background:rgba(255,255,255,.025)!important;font-size:8px!important;line-height:1.45}
    #giManager .gip-actions{display:flex!important;align-items:center;justify-content:flex-end;gap:6px;margin:0!important;padding:8px 11px 10px!important;border-top:1px solid rgba(255,255,255,.075)!important}
    #giManager .gip-actions button{min-height:33px;padding:0 9px!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:9px!important;color:#dce7df!important;background:rgba(255,255,255,.045)!important;font-size:7px!important;font-weight:900!important;text-transform:uppercase}
    #giManager .gip-actions button:hover{border-color:rgba(245,220,134,.32)!important;background:rgba(245,220,134,.08)!important}
    #giManager .gip-actions button.danger{margin-left:auto;color:#ffadb5!important;border-color:rgba(255,118,130,.16)!important;background:rgba(255,118,130,.055)!important}
    #giManager .gip-card>.gi-editor{display:none!important}
    #giManager .gip-card>.old-match-photo-bar{margin:0 14px 10px!important;padding:0!important;border:0!important}
    #giManager .gip-card .old-match-photo-button{min-height:36px!important;padding:5px 8px!important;border-color:rgba(255,255,255,.10)!important;border-radius:10px!important;background:rgba(255,255,255,.035)!important;box-shadow:none!important}
    #giManager .gip-card .old-match-photo-button>span:first-child{width:30px!important;height:30px!important}
    #giManager .gip-card .old-match-photo-copy b{font-size:8px!important}.gip-card .old-match-photo-copy small{font-size:7px!important}
    #giManager .gip-card .old-match-photo-button i{display:none!important}
    @media(max-width:720px){
      #giManager .gi-phase>main{grid-template-columns:1fr}
      #giManager .gip-card{contain:layout paint}
    }
    @media(max-width:430px){
      #giManager .gip-card-head{align-items:flex-start;flex-wrap:wrap}
      #giManager .gip-meta{order:3;width:100%;margin-left:0;text-align:left}
      #giManager .gip-match-body{grid-template-columns:minmax(0,1fr) 91px minmax(0,1fr);gap:5px;padding:9px 7px}
      #giManager .gip-team{min-height:74px;padding:7px!important}
      #giManager .gip-team .gi-badge{width:36px!important;height:36px!important}
      #giManager .gip-team strong{font-size:9px!important}
      #giManager .gip-scoreboard{grid-template-columns:35px 11px 35px;padding:6px 4px}
      #giManager .gip-scoreboard .gi-score-input{width:35px!important;height:38px!important;font-size:22px!important}
      #giManager .gip-scoreboard .gi-score{font-size:27px!important}
      #giManager .gip-actions{flex-wrap:wrap}
      #giManager .gip-actions button{flex:1 1 120px}
      #giManager .gip-actions button.danger{margin-left:0}
    }
    @media(prefers-reduced-motion:reduce){#giManager .gip-card{transform:none}}
  `;
  document.head.append(style);

  const root = $('#arenaDetail') || $('[data-page="tournament"]') || document.body;
  observer = new MutationObserver(mutations => {
    const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node =>
      node.nodeType === 1 && (node.matches?.('#giManager,.gi-game,.old-match-photo-bar') || node.querySelector?.('.gi-game'))
    ));
    if (relevant) scheduleEnhance();
  });
  observer.observe(root, { childList: true, subtree: true });

  window.addEventListener('arena:permissions-updated', scheduleEnhance);
  window.addEventListener('arena:matches-updated', scheduleEnhance);
  window.ArenaBDAResultsCardsPro = Object.freeze({ refresh: scheduleEnhance, saveQuickScore: flushQuickScore });
  scheduleEnhance();
})();
