(() => {
  'use strict';

  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const PHASES = ['Preliminar', 'Fase de grupos', '16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
  const STATUSES = ['Agendado', 'Em andamento', 'Finalizado', 'Adiado', 'Cancelado'];
  const authCore = window.ArenaBDAAuth;

  let modal = null;
  let currentTournamentId = '';
  let currentGameId = '';
  let returnFocus = null;
  let scrollY = 0;
  let saving = false;
  let allowGeneratorAction = false;
  let observerTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const notify = message => typeof window.toast === 'function' ? window.toast(message) : console.info(message);

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function isAdmin() {
    if (authCore?.isAdmin) return Boolean(authCore.isAdmin());
    const user = window.firebase?.auth?.()?.currentUser;
    const email = String(user?.email || '').toLowerCase();
    return Boolean(user && (window.ARENA_ADMIN_EMAILS || []).includes(email));
  }

  function currentEmail() {
    if (authCore?.currentEmail) return authCore.currentEmail();
    return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
  }

  function tournamentId() {
    return $('#giManager')?.dataset?.tid || window.ArenaBDAMatchManager?.tournamentId?.() || 'copa-grifo';
  }

  function tournaments() {
    const list = read(TOURNAMENT_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function tournament() {
    const id = tournamentId();
    return tournaments().find(item => item?.id === id) || null;
  }

  function isSupercopa() {
    const item = tournament();
    const id = norm(item?.id).replace(/[^a-z0-9]/g, '');
    const name = norm(item?.name).replace(/[^a-z0-9]/g, '');
    return id === 'supercopa' || name.includes('supercopabda');
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function games(tid = tournamentId()) {
    const list = matchStore()[tid];
    return Array.isArray(list) ? list : [];
  }

  function gameById(tid, id) {
    return games(tid).find(game => String(game?.id) === String(id)) || null;
  }

  function teamNames(tid) {
    const names = new Set();
    (read(TEAM_KEY, []) || []).forEach(team => team?.name && names.add(String(team.name)));
    const event = tournaments().find(item => item?.id === tid);
    (event?.participants || []).forEach(name => name && names.add(String(name)));
    games(tid).forEach(game => {
      if (game?.ta) names.add(String(game.ta));
      if (game?.tb) names.add(String(game.tb));
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function numberOrEmpty(value) {
    return value === '' || value == null ? '' : Number(value);
  }

  function options(values, selected) {
    const list = values.includes(selected) ? values : [selected, ...values].filter(Boolean);
    return list.map(value => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(value)}</option>`).join('');
  }

  async function persistCloud(tid, list) {
    if (!window.firebase || typeof firebase.firestore !== 'function' || !isAdmin()) return;
    await firebase.firestore().collection('arenaData').doc(`confrontos-${tid}`).set({
      dataset: 'confrontos',
      tournamentId: tid,
      games: list,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentEmail()
    });
  }

  async function persistGames(tid, list) {
    const store = matchStore();
    store[tid] = list;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    await persistCloud(tid, list);
    window.ArenaBDAMatchManager?.render?.();
    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail: { tournamentId: tid, count: list.length }
    }));
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.id = 'arenaSimpleMatchEditor';
    modal.className = 'asm-backdrop';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '<section class="asm-dialog" role="dialog" aria-modal="true" aria-labelledby="asmTitle"></section>';
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    document.body.append(modal);
    return modal;
  }

  function render(game) {
    const dialog = $('.asm-dialog', ensureModal());
    const datalist = teamNames(currentTournamentId).map(name => `<option value="${esc(name)}"></option>`).join('');
    dialog.innerHTML = `
      <header class="asm-head">
        <div><span>RESULTADO</span><h2 id="asmTitle">${esc(game.ta)} × ${esc(game.tb)}</h2><p>Para um jogo normal, informe somente o placar e salve.</p></div>
        <button type="button" class="asm-close" data-asm-close aria-label="Fechar editor">×</button>
      </header>
      <form class="asm-form" data-asm-form>
        <datalist id="asmTeams">${datalist}</datalist>
        <section class="asm-score" aria-label="Placar da partida">
          <label><span>${esc(game.ta)}</span><input name="a" type="number" min="0" max="99" inputmode="numeric" value="${game.a === '' || game.a == null ? '' : Number(game.a)}" aria-label="Placar de ${esc(game.ta)}"></label>
          <b aria-hidden="true">×</b>
          <label><span>${esc(game.tb)}</span><input name="b" type="number" min="0" max="99" inputmode="numeric" value="${game.b === '' || game.b == null ? '' : Number(game.b)}" aria-label="Placar de ${esc(game.tb)}"></label>
        </section>
        <p class="asm-hint">Você não precisa mexer nas opções abaixo para lançar um resultado comum.</p>

        <details class="asm-advanced">
          <summary>Opções avançadas do jogo</summary>
          <div class="asm-grid">
            <label>Time A<input name="ta" list="asmTeams" value="${esc(game.ta || '')}" required></label>
            <label>Time B<input name="tb" list="asmTeams" value="${esc(game.tb || '')}" required></label>
            <label>Fase<select name="phase">${options(PHASES, game.phase || 'Oitavas de final')}</select></label>
            <label>Status<select name="status">${options(STATUSES, game.status || 'Agendado')}</select></label>
            <label>Data<input name="date" type="date" value="${esc(game.date || '')}"></label>
            <label>Horário<input name="time" type="time" value="${esc(game.time || '')}"></label>
            <label>Local<input name="place" value="${esc(game.place || '')}" placeholder="Opcional"></label>
            <label>Ordem<input name="pos" type="number" min="1" value="${Number(game.pos) || 1}"></label>
            <label>Pênaltis A<input name="pa" type="number" min="0" max="99" value="${game.pa === '' || game.pa == null ? '' : Number(game.pa)}"></label>
            <label>Pênaltis B<input name="pb" type="number" min="0" max="99" value="${game.pb === '' || game.pb == null ? '' : Number(game.pb)}"></label>
            <label>W.O.<select name="wo"><option value="none" ${game.wo === 'none' || !game.wo ? 'selected' : ''}>Sem W.O.</option><option value="a" ${game.wo === 'a' ? 'selected' : ''}>Vitória Time A</option><option value="b" ${game.wo === 'b' ? 'selected' : ''}>Vitória Time B</option></select></label>
            <label>Jogo<select name="leg"><option value="1" ${Number(game.leg) !== 2 ? 'selected' : ''}>Único / ida</option><option value="2" ${Number(game.leg) === 2 ? 'selected' : ''}>Volta</option></select></label>
          </div>
          <label class="asm-note">Observação<textarea name="note" placeholder="Opcional">${esc(game.note || '')}</textarea></label>
          <button type="button" class="danger asm-delete" data-asm-delete>Excluir este jogo</button>
        </details>

        <footer class="asm-actions">
          <button type="button" class="secondary" data-asm-clear>Limpar placar</button>
          <button type="button" class="ghost" data-asm-cancel>Cancelar</button>
          <button type="submit" class="primary" data-asm-save>Salvar resultado</button>
        </footer>
      </form>`;

    $('[data-asm-close]', dialog)?.addEventListener('click', close);
    $('[data-asm-cancel]', dialog)?.addEventListener('click', close);
    $('[data-asm-clear]', dialog)?.addEventListener('click', () => {
      const form = $('[data-asm-form]', dialog);
      ['a', 'b', 'pa', 'pb'].forEach(name => { form.elements[name].value = ''; });
      form.elements.wo.value = 'none';
      form.elements.status.value = 'Agendado';
    });
    $('[data-asm-delete]', dialog)?.addEventListener('click', async () => {
      const current = gameById(currentTournamentId, currentGameId);
      if (!current || !confirm(`Excluir ${current.ta} × ${current.tb}?`)) return;
      try {
        await persistGames(currentTournamentId, games(currentTournamentId).filter(item => String(item?.id) !== String(currentGameId)));
        notify('Jogo excluído');
        close();
      } catch (error) {
        console.error(error);
        notify('Não foi possível excluir o jogo');
      }
    });
    $('[data-asm-form]', dialog)?.addEventListener('submit', save);
  }

  function open(id, trigger) {
    if (!isAdmin()) return;
    const tid = tournamentId();
    const game = gameById(tid, id);
    if (!game) return notify('Não foi possível localizar este jogo');
    currentTournamentId = tid;
    currentGameId = String(id);
    returnFocus = trigger || null;
    scrollY = window.scrollY;
    render(game);
    ensureModal().classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asm-open');
    requestAnimationFrame(() => $('.asm-score input', modal)?.focus({ preventScroll: true }));
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('asm-open');
    window.scrollTo({ top: scrollY, behavior: 'auto' });
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
    currentTournamentId = '';
    currentGameId = '';
  }

  async function save(event) {
    event.preventDefault();
    if (saving || !isAdmin()) return;
    const form = event.currentTarget;
    const editingTournamentId = currentTournamentId;
    const list = [...games(editingTournamentId)];
    const index = list.findIndex(game => String(game?.id) === currentGameId);
    if (index < 0) return notify('Jogo não encontrado');

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

    if (norm(next.ta) === norm(next.tb)) return notify('Escolha dois times diferentes');
    if ((next.a === '') !== (next.b === '')) return notify('Informe os dois lados do placar');
    if ((next.pa === '') !== (next.pb === '')) return notify('Informe os dois lados dos pênaltis');
    if (next.pa !== '' && next.pa === next.pb) return notify('Os pênaltis precisam ter um vencedor');
    if (next.wo !== 'none') {
      next.a = ''; next.b = ''; next.pa = ''; next.pb = ''; next.status = 'Finalizado';
    } else if (next.a !== '' && next.b !== '') {
      next.status = 'Finalizado';
    }

    list[index] = next;
    const saveButton = $('[data-asm-save]', form);
    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';
    try {
      window.ArenaBDAScoreSync?.begin?.(editingTournamentId);
      await persistGames(editingTournamentId, list);
      notify('Resultado salvo');
      close();
    } catch (error) {
      console.error(error);
      notify(String(error?.code || '').includes('permission-denied')
        ? 'A conta atual não tem permissão para sincronizar'
        : 'Resultado salvo neste aparelho; sincronização pendente');
      window.ArenaBDAMatchManager?.render?.();
    } finally {
      window.ArenaBDAScoreSync?.end?.(editingTournamentId);
      saving = false;
      if (saveButton?.isConnected) {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar resultado';
      }
    }
  }

  function generatorSummary() {
    const mode = $('#leagueMode')?.value || 'groups';
    const participants = tournament()?.participants?.length || 0;
    if (mode === 'league') {
      const turns = $('#leagueLegs')?.value === '2' ? 'turno e returno' : 'turno único';
      return `${participants} times • pontos corridos • ${turns}`;
    }
    const groups = Number($('#leagueGroupCount')?.value || 4);
    const qualifiers = Number($('#leagueQualifiers')?.value || 2);
    const turns = $('#leagueLegs')?.value === '2' ? 'turno e returno' : 'turno único';
    return `${participants} times • ${groups} grupos • ${qualifiers} classificados por grupo • ${turns}`;
  }

  function applySupercopaPreset() {
    const mode = $('#leagueMode');
    const groups = $('#leagueGroupCount');
    const qualifiers = $('#leagueQualifiers');
    const legs = $('#leagueLegs');
    const distribution = $('#leagueDistribution');
    if (!mode || !groups || !qualifiers || !legs || !distribution) return;
    const count = tournament()?.participants?.length || 0;
    mode.value = 'groups';
    groups.value = count >= 16 ? '4' : '2';
    qualifiers.value = '2';
    legs.value = '1';
    distribution.value = 'random';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    notify('Formato recomendado da Supercopa aplicado');
  }

  function moveAdvancedGeneratorFields(panel) {
    const config = $('.league-config-card', panel);
    const grid = $('.league-config-grid', panel);
    if (!config || !grid || $('#simpleGeneratorAdvanced', config)) return;
    const advancedLabels = [$('#leagueLegs', grid)?.closest('label'), $('#leagueDistribution', grid)?.closest('label')].filter(Boolean);
    if (!advancedLabels.length) return;
    const details = document.createElement('details');
    details.id = 'simpleGeneratorAdvanced';
    details.className = 'cge-advanced';
    details.innerHTML = '<summary>Opções avançadas</summary><div class="cge-advanced-grid"></div>';
    const holder = $('.cge-advanced-grid', details);
    advancedLabels.forEach(label => holder.append(label));
    const actions = $('.league-config-actions', config);
    if (actions) config.insertBefore(details, actions);
    else config.append(details);
  }

  function decorateGenerator() {
    const panel = $('#leagueGeneratorPanel');
    if (!panel || panel.hidden) return;
    const heading = $('.league-generator-head h2', panel);
    const intro = $('.league-generator-head p', panel);
    if (heading) heading.textContent = 'Criar tabela';
    if (intro) intro.textContent = 'Escolha o formato, confira a prévia e gere os jogos. O sistema calcula as rodadas e a classificação.';

    if (!$('.cge-steps', panel)) {
      const guide = document.createElement('div');
      guide.className = 'cge-steps';
      guide.innerHTML = '<span><b>1</b> Escolha o formato</span><span><b>2</b> Confira os grupos</span><span><b>3</b> Gere a tabela</span>';
      $('.league-generator-head', panel)?.after(guide);
    }

    if (isSupercopa() && !$('.cge-supercopa', panel)) {
      const recommendation = document.createElement('section');
      recommendation.className = 'cge-supercopa';
      recommendation.innerHTML = '<div><b>🏆 Formato recomendado para a Supercopa</b><span>4 grupos de 4, 2 classificados por grupo e depois quartas de final, semifinal e final.</span></div><button type="button" class="secondary" data-cge-supercopa>Usar recomendado</button>';
      $('.league-config-card', panel)?.before(recommendation);
    }

    moveAdvancedGeneratorFields(panel);

    const generate = $('[data-generate-schedule]', panel);
    if (generate) {
      generate.textContent = 'Revisar e gerar tabela';
      generate.setAttribute('aria-label', 'Revisar configuração e gerar tabela do campeonato');
    }
    const shuffle = $('[data-preview-groups]', panel);
    if (shuffle) shuffle.textContent = 'Sortear novamente';
    const knockout = $('[data-generate-knockout]', panel);
    if (knockout) knockout.textContent = knockout.disabled ? 'Finalize os grupos primeiro' : 'Avançar para mata-mata';

    if (!$('.cge-safe-note', panel)) {
      const actions = $('.league-config-actions', panel);
      if (actions) {
        const note = document.createElement('p');
        note.className = 'cge-safe-note';
        note.textContent = 'Nada será substituído sem confirmação. A Arena cria um backup antes da nova tabela.';
        actions.after(note);
      }
    }
  }

  function decorateManager() {
    const manager = $('#giManager');
    if (!manager) return;
    const head = $('.gi-head', manager);
    const eyebrow = $('.eyebrow', head || document);
    const intro = $('p', head || document);
    if (eyebrow) eyebrow.textContent = 'Gerenciamento do campeonato';
    if (intro) intro.textContent = 'Digite os placares diretamente nos jogos. Eles são salvos automaticamente.';
    $('#giCloud', manager)?.setAttribute('aria-live', 'polite');

    const nav = $(':scope > nav', manager);
    if (nav) {
      const gamesTab = $('[data-tab="games"]', nav);
      const bracketTab = $('[data-tab="bracket"]', nav);
      const configTab = $('[data-tab="config"]', nav);
      const generatorTab = $('[data-league-generator]', nav);
      if (gamesTab) gamesTab.textContent = 'Resultados';
      if (bracketTab) bracketTab.textContent = 'Mata-mata';
      if (configTab) {
        configTab.textContent = 'Regras avançadas';
        configTab.classList.add('cge-advanced-tab');
      }
      if (generatorTab) generatorTab.textContent = 'Gerenciar';
    }

    $$('.gi-score-input', manager).forEach(input => {
      const team = input.closest('.gi-team')?.querySelector('strong')?.textContent?.trim() || 'time';
      input.setAttribute('aria-label', `Placar de ${team}`);
      input.setAttribute('inputmode', 'numeric');
    });
    $$('.gi-game [data-edit]', manager).forEach(button => {
      button.textContent = 'Ajustes';
      button.setAttribute('aria-label', 'Abrir ajustes deste jogo');
    });
    $$('.gi-game footer .danger[data-del]', manager).forEach(button => {
      button.classList.add('cge-direct-delete');
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
    });
    decorateGenerator();
  }

  document.addEventListener('click', event => {
    const edit = event.target.closest('#giManager [data-edit]');
    if (edit && isAdmin()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      open(edit.dataset.edit, edit);
      return;
    }

    const preset = event.target.closest('[data-cge-supercopa]');
    if (preset) {
      event.preventDefault();
      event.stopPropagation();
      applySupercopaPreset();
      return;
    }

    const generate = event.target.closest('[data-generate-schedule]');
    if (generate && isAdmin() && !allowGeneratorAction) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const summary = generatorSummary();
      if (!confirm(`Gerar esta tabela?\n\n${summary}\n\nA Arena fará um backup antes de substituir jogos gerados anteriormente.`)) return;
      allowGeneratorAction = true;
      generate.click();
      queueMicrotask(() => { allowGeneratorAction = false; });
      return;
    }

    const knockout = event.target.closest('[data-generate-knockout]');
    if (knockout && isAdmin() && !allowGeneratorAction && !knockout.disabled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!confirm('Avançar para o mata-mata?\n\nA Arena usará a classificação dos grupos para criar os confrontos automaticamente.')) return;
      allowGeneratorAction = true;
      knockout.click();
      queueMicrotask(() => { allowGeneratorAction = false; });
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal?.classList.contains('show')) {
      event.preventDefault();
      close();
    }
  });

  const style = document.createElement('style');
  style.id = 'championshipGuidedEditorStyles';
  style.textContent = `
    #giManager>nav{overflow-x:auto;scrollbar-width:none}#giManager>nav::-webkit-scrollbar{display:none}
    #giManager>nav button{min-height:44px!important;min-width:102px}
    #giManager .cge-advanced-tab{opacity:.58}
    #giManager .cge-direct-delete{display:none!important}
    #giManager .gi-score-input{min-width:54px;min-height:48px!important;text-align:center;font-size:18px!important}
    #giManager .gi-game footer button{min-height:44px}
    #leagueGeneratorPanel button,#leagueGeneratorPanel select,#leagueGeneratorPanel input{min-height:44px!important}
    .cge-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:11px 0}.cge-steps span{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--line);border-radius:13px;color:var(--muted);background:#ffffff06;font-size:9px}.cge-steps b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;color:#171107;background:var(--gold-soft);font-size:10px}
    .cge-supercopa{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin:11px 0;padding:14px;border:1px solid rgba(242,215,125,.38);border-radius:17px;background:rgba(216,178,72,.08)}.cge-supercopa b,.cge-supercopa span{display:block}.cge-supercopa b{color:var(--gold-soft);font-size:12px}.cge-supercopa span{margin-top:4px;color:var(--muted);font-size:9px}.cge-supercopa button{min-height:44px}
    .cge-advanced{margin-top:10px;border:1px solid var(--line);border-radius:14px;background:#03080655}.cge-advanced summary{display:flex;align-items:center;min-height:48px;padding:0 12px;cursor:pointer;color:var(--gold-soft);font-size:10px;font-weight:900}.cge-advanced[open] summary{border-bottom:1px solid var(--line)}.cge-advanced-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px}.cge-safe-note{margin:9px 2px 0;color:var(--muted);font-size:9px;line-height:1.45}
    .asm-backdrop{display:none;position:fixed;inset:0;z-index:10000;place-items:end center;padding:10px;background:rgba(0,0,0,.76);backdrop-filter:blur(6px)}.asm-backdrop.show{display:grid}.asm-dialog{width:min(100%,560px);max-height:92vh;overflow:auto;border:1px solid var(--line-strong);border-radius:24px 24px 0 0;background:#0c1811;box-shadow:0 24px 80px #000b}.asm-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:12px;padding:17px;border-bottom:1px solid var(--line);background:#0c1811}.asm-head span{color:var(--gold-soft);font-size:9px;font-weight:900}.asm-head h2{margin:4px 0;font-size:25px}.asm-head p{margin:0;color:var(--muted);font-size:9px}.asm-close{min-width:48px;min-height:48px;border:1px solid var(--line);border-radius:14px;color:var(--text);background:#ffffff08;font-size:24px}.asm-form{padding:16px}.asm-score{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end;padding:16px;border:1px solid var(--line-strong);border-radius:18px;background:#07100c}.asm-score label{display:grid;gap:7px;text-align:center}.asm-score label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:11px;font-weight:800}.asm-score input{width:100%;min-height:60px!important;text-align:center;font-size:28px!important;font-weight:900}.asm-score>b{align-self:center;color:var(--muted);font-size:22px}.asm-hint{margin:9px 2px;color:var(--muted);font-size:9px;text-align:center}.asm-advanced{margin-top:13px;border:1px solid var(--line);border-radius:15px;background:#03080655}.asm-advanced summary{display:flex;align-items:center;min-height:50px;padding:0 13px;cursor:pointer;color:var(--gold-soft);font-size:10px;font-weight:900}.asm-advanced[open] summary{border-bottom:1px solid var(--line)}.asm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:12px}.asm-grid label,.asm-note{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.asm-grid input,.asm-grid select,.asm-note textarea{min-height:44px!important;font-size:16px!important}.asm-note{padding:0 12px 12px}.asm-delete{width:calc(100% - 24px);min-height:44px;margin:0 12px 12px}.asm-actions{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8px;margin-top:14px}.asm-actions button{min-height:48px}.asm-open{overflow:hidden}
    @media(max-width:650px){.cge-steps{grid-template-columns:1fr}.cge-supercopa{grid-template-columns:1fr}.cge-supercopa button{width:100%}.cge-advanced-grid,.asm-grid{grid-template-columns:1fr}.asm-actions{grid-template-columns:1fr}.league-config-grid{grid-template-columns:1fr!important}.asm-dialog{border-radius:20px 20px 0 0}}
    @media(min-width:740px){.asm-backdrop{place-items:center}.asm-dialog{border-radius:24px}}
    @media(prefers-reduced-motion:reduce){.asm-backdrop{backdrop-filter:none}}
  `;
  document.head.appendChild(style);

  function ensure() {
    clearTimeout(observerTimer);
    observerTimer = window.setTimeout(decorateManager, 45);
  }

  if (window.ArenaDOMEvents?.subscribe) {
    window.ArenaDOMEvents.subscribe(ensure, { selector: '#giManager,#leagueGeneratorPanel,.gi-game' });
  } else if (document.body) {
    new MutationObserver(ensure).observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('arena:matches-updated', ensure);
  ensure();
})();
