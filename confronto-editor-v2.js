(() => {
  'use strict';

  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const PHASES = ['Preliminar', 'Fase de grupos', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
  const STATUSES = ['Agendado', 'Em andamento', 'Finalizado', 'Adiado', 'Cancelado'];
  const authCore = window.ArenaBDAAuth;

  let modal = null;
  let currentTournamentId = '';
  let currentGameId = '';
  let returnFocus = null;
  let scrollY = 0;
  let saving = false;

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

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function matchStore() {
    const value = readJson(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function tournamentId() {
    return $('#giManager')?.dataset?.tid || window.ArenaBDAMatchManager?.tournamentId?.() || 'copa-grifo';
  }

  function gameById(tid, id) {
    const list = matchStore()[tid];
    return Array.isArray(list) ? list.find(game => String(game?.id) === String(id)) || null : null;
  }

  function teamNames(tid) {
    const names = new Set();
    const teams = readJson(TEAM_KEY, []);
    const tournaments = readJson(TOURNAMENT_KEY, []);
    const games = matchStore()[tid] || [];

    if (Array.isArray(teams)) teams.forEach(team => team?.name && names.add(String(team.name)));
    if (Array.isArray(tournaments)) {
      const tournament = tournaments.find(item => item?.id === tid);
      if (Array.isArray(tournament?.participants)) tournament.participants.forEach(name => name && names.add(String(name)));
    }
    if (Array.isArray(games)) games.forEach(game => {
      if (game?.ta) names.add(String(game.ta));
      if (game?.tb) names.add(String(game.tb));
    });

    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function numberOrEmpty(value) {
    return value === '' || value == null ? '' : Number(value);
  }

  function buildOptions(values, selected) {
    return values.map(value => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;

    modal = document.createElement('div');
    modal.id = 'arenaMatchEditorV2';
    modal.className = 'ame2-backdrop';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '<section class="ame2-dialog" role="dialog" aria-modal="true" aria-labelledby="ame2Title"></section>';
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    document.body.append(modal);
    return modal;
  }

  function render(game) {
    const dialog = $('.ame2-dialog', ensureModal());
    const names = teamNames(currentTournamentId);
    const datalist = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');

    dialog.innerHTML = `
      <header class="ame2-head">
        <div>
          <span>Administração do confronto</span>
          <h2 id="ame2Title">Editar jogo</h2>
          <p>${escapeHtml(game.ta || 'Time A')} × ${escapeHtml(game.tb || 'Time B')}</p>
        </div>
        <button type="button" class="ame2-close" data-ame2-close aria-label="Fechar editor">×</button>
      </header>
      <form class="ame2-form" data-ame2-form>
        <datalist id="ame2Teams">${datalist}</datalist>
        <div class="ame2-grid">
          <label>Time A<input name="ta" list="ame2Teams" value="${escapeHtml(game.ta || '')}" required></label>
          <label>Time B<input name="tb" list="ame2Teams" value="${escapeHtml(game.tb || '')}" required></label>
          <label>Fase<select name="phase">${buildOptions(PHASES, game.phase || 'Oitavas de final')}</select></label>
          <label>Status<select name="status">${buildOptions(STATUSES, game.status || 'Agendado')}</select></label>
          <label>Data<input name="date" type="date" value="${escapeHtml(game.date || '')}"></label>
          <label>Horário<input name="time" type="time" value="${escapeHtml(game.time || '')}"></label>
          <label>Local<input name="place" value="${escapeHtml(game.place || '')}" placeholder="Ex.: Arena BDA"></label>
          <label>Ordem<input name="pos" type="number" min="1" value="${Number(game.pos) || 1}"></label>
          <label>Pênaltis A<input name="pa" type="number" min="0" value="${game.pa === '' || game.pa == null ? '' : Number(game.pa)}"></label>
          <label>Pênaltis B<input name="pb" type="number" min="0" value="${game.pb === '' || game.pb == null ? '' : Number(game.pb)}"></label>
          <label>W.O.<select name="wo">
            <option value="none" ${game.wo === 'none' || !game.wo ? 'selected' : ''}>Sem W.O.</option>
            <option value="a" ${game.wo === 'a' ? 'selected' : ''}>Vitória A</option>
            <option value="b" ${game.wo === 'b' ? 'selected' : ''}>Vitória B</option>
          </select></label>
          <label>Jogo<select name="leg">
            <option value="1" ${Number(game.leg) !== 2 ? 'selected' : ''}>Ida / único</option>
            <option value="2" ${Number(game.leg) === 2 ? 'selected' : ''}>Volta</option>
          </select></label>
          <label>Placar A<input name="a" type="number" min="0" max="99" value="${game.a === '' || game.a == null ? '' : Number(game.a)}"></label>
          <label>Placar B<input name="b" type="number" min="0" max="99" value="${game.b === '' || game.b == null ? '' : Number(game.b)}"></label>
        </div>
        <label class="ame2-note">Observação<textarea name="note" placeholder="Informações adicionais">${escapeHtml(game.note || '')}</textarea></label>
        <footer class="ame2-actions">
          <button type="button" class="secondary" data-ame2-clear>Limpar resultado</button>
          <button type="button" class="ghost" data-ame2-cancel>Cancelar</button>
          <button type="submit" class="primary" data-ame2-save>Salvar alterações</button>
        </footer>
      </form>`;

    $('[data-ame2-close]', dialog)?.addEventListener('click', close);
    $('[data-ame2-cancel]', dialog)?.addEventListener('click', close);
    $('[data-ame2-clear]', dialog)?.addEventListener('click', () => {
      const form = $('[data-ame2-form]', dialog);
      ['a', 'b', 'pa', 'pb'].forEach(name => { form.elements[name].value = ''; });
      form.elements.wo.value = 'none';
      form.elements.status.value = 'Agendado';
    });
    $('[data-ame2-form]', dialog)?.addEventListener('submit', save);
  }

  function open(id, trigger) {
    if (!isAdmin()) return;
    const tid = tournamentId();
    const game = gameById(tid, id);
    if (!game) {
      notify('Não foi possível localizar este confronto');
      return;
    }

    currentTournamentId = tid;
    currentGameId = String(id);
    returnFocus = trigger || null;
    scrollY = window.scrollY;
    render(game);
    ensureModal().classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ame2-open');
    requestAnimationFrame(() => $('.ame2-form input', modal)?.focus({ preventScroll: true }));
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ame2-open');
    window.scrollTo(0, scrollY);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    currentTournamentId = '';
    currentGameId = '';
  }

  async function persistCloud(tid, games) {
    if (!window.firebase || typeof firebase.firestore !== 'function' || !isAdmin()) return;
    await firebase.firestore().collection('arenaData').doc(`confrontos-${tid}`).set({
      dataset: 'confrontos',
      tournamentId: tid,
      games,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentEmail()
    });
  }

  async function save(event) {
    event.preventDefault();
    if (saving || !isAdmin()) return;

    const form = event.currentTarget;
    const store = matchStore();
    const list = Array.isArray(store[currentTournamentId]) ? [...store[currentTournamentId]] : [];
    const index = list.findIndex(game => String(game?.id) === currentGameId);
    if (index < 0) return notify('Confronto não encontrado');

    const previous = list[index];
    const next = {
      ...previous,
      ta: form.elements.ta.value.trim() || 'Time A',
      tb: form.elements.tb.value.trim() || 'Time B',
      phase: form.elements.phase.value,
      status: form.elements.status.value,
      date: form.elements.date.value,
      time: form.elements.time.value,
      place: form.elements.place.value.trim(),
      pos: Math.max(1, Number(form.elements.pos.value) || 1),
      pa: numberOrEmpty(form.elements.pa.value),
      pb: numberOrEmpty(form.elements.pb.value),
      wo: ['a', 'b'].includes(form.elements.wo.value) ? form.elements.wo.value : 'none',
      leg: Number(form.elements.leg.value) === 2 ? 2 : 1,
      a: numberOrEmpty(form.elements.a.value),
      b: numberOrEmpty(form.elements.b.value),
      note: form.elements.note.value.trim(),
      updated: Date.now()
    };

    if (normalize(next.ta) === normalize(next.tb)) {
      return notify('Escolha dois clubes diferentes para o confronto');
    }
    const scoreASet = next.a !== '';
    const scoreBSet = next.b !== '';
    if (scoreASet !== scoreBSet) {
      return notify('Informe os dois lados do placar');
    }
    const penaltyASet = next.pa !== '';
    const penaltyBSet = next.pb !== '';
    if (penaltyASet !== penaltyBSet) {
      return notify('Informe os dois lados da disputa por pênaltis');
    }
    if (penaltyASet && next.pa === next.pb) {
      return notify('A disputa por pênaltis precisa ter um vencedor');
    }
    if ([next.a, next.b, next.pa, next.pb].some(value =>
      value !== '' && (!Number.isInteger(value) || value < 0 || value > 99)
    )) {
      return notify('Use placares inteiros entre 0 e 99');
    }
    if (next.wo !== 'none') {
      next.a = '';
      next.b = '';
      next.pa = '';
      next.pb = '';
      next.status = 'Finalizado';
    }

    if (next.status === 'Agendado' && (next.wo !== 'none' || (next.a !== '' && next.b !== ''))) {
      next.status = 'Finalizado';
    }

    list[index] = next;

    if (next.leg === 1 && (normalize(previous.ta) !== normalize(next.ta) || normalize(previous.tb) !== normalize(next.tb))) {
      const secondLegIndex = list.findIndex(game =>
        game !== next &&
        String(game?.tieId || '') === String(next.tieId || '') &&
        Number(game?.leg) === 2 &&
        normalize(game?.ta) === normalize(previous.tb) &&
        normalize(game?.tb) === normalize(previous.ta)
      );
      if (secondLegIndex >= 0) {
        list[secondLegIndex] = {
          ...list[secondLegIndex],
          ta: next.tb,
          tb: next.ta,
          updated: Date.now()
        };
      }
    }

    const saveButton = $('[data-ame2-save]', form);
    saving = true;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
    }

    try {
      store[currentTournamentId] = list;
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));
      await persistCloud(currentTournamentId, list);
      window.ArenaBDAMatchManager?.render?.();
      window.dispatchEvent(new CustomEvent('arena:matches-updated', {
        detail: { tournamentId: currentTournamentId, gameId: currentGameId }
      }));
      notify('Confronto atualizado e sincronizado');
      close();
    } catch (error) {
      console.error(error);
      notify(String(error?.code || '').includes('permission-denied')
        ? 'As regras do Firestore não liberaram esta conta'
        : 'O confronto foi salvo neste aparelho, mas a nuvem falhou');
      window.ArenaBDAMatchManager?.render?.();
    } finally {
      saving = false;
      if (saveButton?.isConnected) {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar alterações';
      }
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#giManager [data-edit]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    open(button.dataset.edit, button);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal?.classList.contains('show')) {
      event.preventDefault();
      close();
    }
  });

  if (authCore?.subscribe) {
    authCore.subscribe(state => {
      if (!state.isAdmin && modal?.classList.contains('show')) close();
    }, false);
  }

  const style = document.createElement('style');
  style.id = 'arenaMatchEditorV2Styles';
  style.textContent = `
    .ame2-backdrop{position:fixed;inset:0;z-index:91000;display:none;align-items:center;justify-content:center;padding:12px;background:rgba(0,0,0,.86);backdrop-filter:blur(12px)}
    .ame2-backdrop.show{display:flex}
    body.ame2-open{overflow:hidden!important}
    .ame2-dialog{overflow:auto;width:min(1000px,100%);max-height:calc(100dvh - 24px);border:1px solid rgba(245,220,134,.45);border-radius:24px;background:radial-gradient(circle at 100% 0,rgba(245,220,134,.12),transparent 30%),linear-gradient(150deg,#153421,#050c08);box-shadow:0 40px 120px rgba(0,0,0,.88);text-align:left;overscroll-behavior:contain}
    .ame2-head{position:sticky;top:0;z-index:4;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.10);background:rgba(5,13,8,.96);backdrop-filter:blur(14px)}
    .ame2-head span{color:var(--gold-soft,#f5dc86);font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .ame2-head h2{margin:5px 0 3px;color:#fff;font:900 32px/1 "Barlow Condensed",sans-serif;text-transform:uppercase}
    .ame2-head p{margin:0;color:var(--muted,#9fb0a5);font-size:10px}
    .ame2-close{flex:0 0 auto;width:44px;height:44px;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:13px;color:#fff;background:rgba(255,255,255,.05);font-size:26px;cursor:pointer}
    .ame2-form{padding:18px}.ame2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
    .ame2-form label{display:block;color:var(--muted,#9fb0a5);font-size:8px;font-weight:900;text-transform:uppercase}
    .ame2-form input,.ame2-form select,.ame2-form textarea{box-sizing:border-box;width:100%;min-height:46px;margin-top:5px;padding:10px;border:1px solid var(--line,rgba(255,255,255,.12));border-radius:10px;color:var(--text,#f4f7f2);background:#07100c;font-size:12px;text-transform:none;outline:none}
    .ame2-form input:focus,.ame2-form select:focus,.ame2-form textarea:focus{border-color:var(--gold,#d8b248);box-shadow:0 0 0 3px rgba(216,178,72,.12)}
    .ame2-note{margin-top:11px}.ame2-form textarea{min-height:100px;resize:vertical}
    .ame2-actions{position:sticky;bottom:-18px;z-index:4;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin:16px -18px -18px;padding:14px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.10);background:rgba(5,13,8,.97);backdrop-filter:blur(14px)}
    .ame2-actions button{min-height:44px}
    @media(max-width:680px){
      .ame2-backdrop{padding:6px}.ame2-dialog{max-height:calc(100dvh - 12px);border-radius:19px}
      .ame2-head{padding:15px 14px}.ame2-head h2{font-size:28px}.ame2-form{padding:13px}
      .ame2-grid{grid-template-columns:1fr;gap:9px}.ame2-actions{bottom:-13px;margin:14px -13px -13px;padding:12px 13px calc(12px + env(safe-area-inset-bottom))}
      .ame2-actions button{flex:1 1 140px}
    }
    @media(prefers-reduced-motion:reduce){.ame2-backdrop,.ame2-head,.ame2-actions{backdrop-filter:none}}
  `;
  document.head.append(style);

  window.ArenaBDAMatchEditorV2 = Object.freeze({ open, close, isOpen: () => Boolean(modal?.classList.contains('show')) });
})();
