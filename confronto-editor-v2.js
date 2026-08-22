(() => {
  'use strict';

  const MATCH_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const authCore = window.ArenaBDAAuth;

  let modal = null;
  let managerSheet = null;
  let currentTournamentId = '';
  let currentGameId = '';
  let returnFocus = null;
  let scrollY = 0;
  let saving = false;
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
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
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
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function tournament(tid = tournamentId()) {
    return tournaments().find(item => String(item?.id) === String(tid)) || null;
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function games(tid = tournamentId()) {
    const list = matchStore()[tid];
    const raw = Array.isArray(list) ? list : [];
    return window.ArenaBDAValidMatches?.forTournament(tournament(tid), raw) || raw;
  }

  function gameById(tid, id) {
    return games(tid).find(game => String(game?.id) === String(id)) || null;
  }

  function numberOrEmpty(value) {
    if (value === '' || value == null) return '';
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 99 ? number : NaN;
  }

  async function persistGames(tid, list) {
    const store = matchStore();
    store[tid] = list;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));

    window.ArenaBDAMatchManager?.render?.();
    window.dispatchEvent(new CustomEvent('arena:matches-updated', { detail: { tournamentId: tid } }));

    if (window.firebase && typeof firebase.firestore === 'function' && isAdmin()) {
      await firebase.firestore().collection('arenaData').doc(`confrontos-${tid}`).set({
        dataset: 'confrontos',
        tournamentId: tid,
        games: list,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentEmail()
      });
    }
  }

  function ensureModal() {
    if (modal?.isConnected) return modal;
    modal = document.createElement('div');
    modal.id = 'arenaQuickScore';
    modal.className = 'aqs-backdrop';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '<section class="aqs-dialog" role="dialog" aria-modal="true" aria-labelledby="aqsTitle"></section>';
    modal.addEventListener('click', event => { if (event.target === modal) closeScore(); });
    document.body.append(modal);
    return modal;
  }

  function renderScore(game) {
    const dialog = $('.aqs-dialog', ensureModal());
    dialog.innerHTML = `
      <header class="aqs-head">
        <span>RESULTADO</span>
        <button type="button" data-aqs-close aria-label="Fechar">×</button>
      </header>
      <h2 id="aqsTitle">${esc(game.ta)} <small>×</small> ${esc(game.tb)}</h2>
      <p>Digite o placar. Só isso.</p>
      <form data-aqs-form>
        <div class="aqs-score">
          <label><span>${esc(game.ta)}</span><input name="a" type="number" min="0" max="99" inputmode="numeric" value="${game.a === '' || game.a == null ? '' : Number(game.a)}" aria-label="Placar de ${esc(game.ta)}"></label>
          <b>×</b>
          <label><span>${esc(game.tb)}</span><input name="b" type="number" min="0" max="99" inputmode="numeric" value="${game.b === '' || game.b == null ? '' : Number(game.b)}" aria-label="Placar de ${esc(game.tb)}"></label>
        </div>
        <footer>
          <button type="button" class="ghost" data-aqs-clear>Limpar</button>
          <button type="submit" class="primary" data-aqs-save>Salvar resultado</button>
        </footer>
      </form>`;

    $('[data-aqs-close]', dialog)?.addEventListener('click', closeScore);
    const form = $('[data-aqs-form]', dialog);
    $('[data-aqs-clear]', dialog)?.addEventListener('click', () => {
      form.dataset.clearResult = 'true';
      form.elements.a.value = '';
      form.elements.b.value = '';
      form.elements.a.focus();
    });
    $$('.aqs-score input', dialog).forEach(input => {
      input.addEventListener('input', () => { delete form.dataset.clearResult; });
    });
    form?.addEventListener('submit', saveScore);
  }

  function openScore(id, trigger) {
    if (!isAdmin()) return;
    const tid = tournamentId();
    const game = gameById(tid, id);
    if (!game) return notify('Jogo não encontrado');

    currentTournamentId = tid;
    currentGameId = String(id);
    returnFocus = trigger || null;
    scrollY = window.scrollY;
    renderScore(game);
    ensureModal().classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('aqs-open');
    requestAnimationFrame(() => $('.aqs-score input', modal)?.focus({ preventScroll: true }));
  }

  function closeScore() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('aqs-open');
    window.scrollTo({ top: scrollY, behavior: 'auto' });
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
    currentTournamentId = '';
    currentGameId = '';
  }

  async function saveScore(event) {
    event.preventDefault();
    if (saving || !isAdmin()) return;

    const tid = currentTournamentId;
    const id = currentGameId;
    const form = event.currentTarget;
    const a = numberOrEmpty(form.elements.a.value);
    const b = numberOrEmpty(form.elements.b.value);

    if (Number.isNaN(a) || Number.isNaN(b)) return notify('Use números entre 0 e 99');
    if ((a === '') !== (b === '')) return notify('Informe os dois lados do placar');

    const list = [...games(tid)];
    const index = list.findIndex(game => String(game?.id) === id);
    if (index < 0) return notify('Jogo não encontrado');

    const previous = list[index];
    const previousA = numberOrEmpty(previous.a);
    const previousB = numberOrEmpty(previous.b);
    const explicitlyCleared = form.dataset.clearResult === 'true';
    const scoreChanged = a !== previousA || b !== previousB;
    const next = { ...previous, a, b, updated: Date.now() };

    if (explicitlyCleared) {
      Object.assign(next, { a: '', b: '', pa: '', pb: '', wo: 'none', status: 'Agendado' });
    } else if (scoreChanged) {
      next.wo = 'none';
      next.status = a === '' ? 'Agendado' : 'Finalizado';
      if (a === '' || a !== b) {
        next.pa = '';
        next.pb = '';
      }
    }

    list[index] = next;

    const button = $('[data-aqs-save]', form);
    saving = true;
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }

    try {
      window.ArenaBDAScoreSync?.begin?.(tid);
      await persistGames(tid, list);
      notify(explicitlyCleared ? 'Placar limpo' : scoreChanged ? 'Resultado salvo' : 'Nenhuma alteração no placar');
      closeScore();
    } catch (error) {
      console.error(error);
      notify('O resultado ficou salvo neste aparelho, mas a nuvem falhou');
    } finally {
      window.ArenaBDAScoreSync?.end?.(tid);
      saving = false;
      if (button?.isConnected) { button.disabled = false; button.textContent = 'Salvar resultado'; }
    }
  }

  function ensureManagerSheet() {
    if (managerSheet?.isConnected) return managerSheet;
    managerSheet = document.createElement('div');
    managerSheet.id = 'arenaSimpleManager';
    managerSheet.className = 'asmgr-backdrop';
    managerSheet.setAttribute('aria-hidden', 'true');
    managerSheet.innerHTML = '<section class="asmgr-sheet" role="dialog" aria-modal="true" aria-labelledby="asmgrTitle"></section>';
    managerSheet.addEventListener('click', event => { if (event.target === managerSheet) closeManager(); });
    document.body.append(managerSheet);
    return managerSheet;
  }

  function renderManager() {
    const tid = tournamentId();
    const item = tournament(tid);
    const participants = Array.isArray(item?.participants) ? item.participants.length : 0;
    const sheet = $('.asmgr-sheet', ensureManagerSheet());

    sheet.innerHTML = `
      <header>
        <div><span>ORGANIZAR</span><h2 id="asmgrTitle">${esc(item?.name || 'Campeonato')}</h2></div>
        <button type="button" data-asmgr-close aria-label="Fechar">×</button>
      </header>
      <section class="asmgr-card">
        <strong>Formato</strong>
        <h3>Escolha uma opção</h3>
        <p>${participants ? `${participants} participantes cadastrados.` : 'Adicione os participantes antes de gerar os jogos.'}</p>
        <div class="asmgr-options">
          <button type="button" data-asmgr-format="groups">Grupos + mata-mata</button>
          <button type="button" data-asmgr-format="league">Pontos corridos</button>
        </div>
      </section>
      <button type="button" class="asmgr-link" data-asmgr-advanced>Opções avançadas</button>`;

    $('[data-asmgr-close]', sheet)?.addEventListener('click', closeManager);
    $$('[data-asmgr-format]', sheet).forEach(button => button.addEventListener('click', () => openGenerator(button.dataset.asmgrFormat)));
    $('[data-asmgr-advanced]', sheet)?.addEventListener('click', () => openGenerator(''));
  }

  function openManager(trigger) {
    if (!isAdmin()) return;
    returnFocus = trigger || null;
    renderManager();
    ensureManagerSheet().classList.add('show');
    managerSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asmgr-open');
  }

  function closeManager() {
    if (!managerSheet) return;
    managerSheet.classList.remove('show');
    managerSheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('asmgr-open');
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
  }

  function activateGenerator() {
    const button = $('#giManager [data-league-generator]');
    if (!button) {
      notify('O gerador ainda está carregando');
      return false;
    }
    button.click();
    return true;
  }

  function openGenerator(mode) {
    closeManager();
    if (!activateGenerator()) return;
    requestAnimationFrame(() => {
      if (mode && $('#leagueMode')) {
        $('#leagueMode').value = mode;
        $('#leagueMode').dispatchEvent(new Event('change', { bubbles: true }));
      }
      $('#leagueGeneratorPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function simplifyManager() {
    const manager = $('#giManager');
    if (!manager) return;

    const nav = $(':scope > nav', manager);
    if (nav) {
      const buttons = $$(':scope > button', nav);
      buttons.forEach(button => {
        const tab = button.dataset.tab || '';
        const label = tab === 'games' ? 'Jogos' : tab === 'bracket' ? 'Tabela' : '';
        if (label) {
          if (button.textContent !== label) button.textContent = label;
          if (button.hidden) button.hidden = false;
        } else if (!button.hidden) {
          button.hidden = true;
        }
      });
    }

    $$('#giManager [data-del]').forEach(button => {
      if (!button.hidden) button.hidden = true;
    });
    $$('#giManager [data-edit]').forEach(button => {
      if (button.textContent !== 'Resultado') button.textContent = 'Resultado';
      if (button.getAttribute('aria-label') !== 'Lançar resultado deste jogo') {
        button.setAttribute('aria-label', 'Lançar resultado deste jogo');
      }
    });

    const head = $('.gi-head', manager);
    if (isAdmin() && head && !head.querySelector('[data-simple-manage]')) {
      const actions = head.lastElementChild || head;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.dataset.simpleManage = 'true';
      button.textContent = 'Organizar';
      button.setAttribute('aria-label', 'Organizar formato do campeonato');
      actions.append(button);
    }
  }

  document.addEventListener('click', event => {
    const scoreButton = event.target.closest('#giManager [data-edit]');
    if (scoreButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openScore(scoreButton.dataset.edit, scoreButton);
      return;
    }

    const manageButton = event.target.closest('[data-simple-manage]');
    if (manageButton) {
      event.preventDefault();
      openManager(manageButton);
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (modal?.classList.contains('show')) closeScore();
    else if (managerSheet?.classList.contains('show')) closeManager();
  });

  const style = document.createElement('style');
  style.textContent = `
    #giManager>nav{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    #giManager>nav button[hidden]{display:none!important}
    #giManager .gi-game footer{grid-template-columns:1fr!important}
    #giManager [data-del]{display:none!important}
    #giManager [data-edit],#giManager [data-simple-manage]{min-height:44px!important}
    body.aqs-open,body.asmgr-open{overflow:hidden}
    .aqs-backdrop,.asmgr-backdrop{position:fixed;inset:0;z-index:100500;display:none;align-items:flex-end;justify-content:center;padding:14px;background:#000b;backdrop-filter:blur(8px)}
    .aqs-backdrop.show,.asmgr-backdrop.show{display:flex}
    .aqs-dialog,.asmgr-sheet{width:min(520px,100%);max-height:92vh;overflow:auto;border:1px solid var(--line-strong);border-radius:24px;background:#08110c;box-shadow:0 24px 80px #000c}
    .aqs-dialog{padding:18px}.aqs-head,.asmgr-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.aqs-head>span,.asmgr-sheet>header span{color:var(--gold-soft);font-size:10px;font-weight:900;letter-spacing:.12em}.aqs-head button,.asmgr-sheet>header button{width:44px;height:44px;border:1px solid var(--line);border-radius:14px;color:var(--text);background:#ffffff08;font-size:24px}.aqs-dialog h2{margin:18px 0 4px;font-size:clamp(25px,7vw,38px);line-height:1;text-align:center}.aqs-dialog h2 small{color:var(--muted);font-size:.7em}.aqs-dialog>p{margin:0 0 18px;color:var(--muted);text-align:center;font-size:11px}.aqs-score{display:grid;grid-template-columns:1fr 34px 1fr;gap:8px;align-items:end}.aqs-score label{display:grid;gap:8px;text-align:center}.aqs-score label span{min-height:34px;display:grid;place-items:end center;color:var(--text);font-size:11px;font-weight:800}.aqs-score input{width:100%;height:72px;padding:0 6px;border:1px solid var(--line-strong);border-radius:18px;color:var(--gold-soft);background:#030806;text-align:center;font:900 34px/1 "Barlow Condensed",system-ui}.aqs-score>b{display:grid;place-items:center;height:72px;color:var(--muted);font-size:24px}.aqs-dialog footer{display:grid;grid-template-columns:.7fr 1.3fr;gap:8px;margin-top:18px}.aqs-dialog footer button{min-height:48px}
    .asmgr-sheet{padding:18px}.asmgr-sheet>header h2{margin:3px 0 0;font-size:25px}.asmgr-card{margin-top:15px;padding:16px;border:1px solid var(--line);border-radius:18px;background:#ffffff06}.asmgr-card.recommended{border-color:#f2d77d55;background:linear-gradient(145deg,#173a26,#08110c)}.asmgr-card strong{color:var(--gold-soft);font-size:9px;text-transform:uppercase;letter-spacing:.1em}.asmgr-card h3{margin:7px 0 5px;font-size:22px;line-height:1.05}.asmgr-card p{margin:0 0 14px;color:var(--muted);font-size:10px;line-height:1.5}.asmgr-card>button{width:100%;min-height:48px}.asmgr-options{display:grid;gap:8px;margin-top:12px}.asmgr-options button{min-height:48px;border:1px solid var(--line);border-radius:14px;color:var(--text);background:#ffffff08;font-weight:800}.asmgr-link{width:100%;min-height:44px;margin-top:8px;border:0;color:var(--muted);background:transparent;text-decoration:underline}
    @media(min-width:700px){.aqs-backdrop,.asmgr-backdrop{align-items:center}.aqs-dialog,.asmgr-sheet{border-radius:22px}}
  `;
  document.head.append(style);

  function ensure() {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(simplifyManager, 40);
  }

  document.addEventListener('arena:bundle-loaded', ensure);
  window.ArenaDOMEvents?.subscribe?.(ensure, { selector: '#giManager,.gi-game,.gi-head' });
  const observer = new MutationObserver(ensure);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  simplifyManager();
})();
