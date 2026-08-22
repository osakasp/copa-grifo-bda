(() => {
  'use strict';

  if (window.ArenaBDAMobileBracketV3?.version >= 1) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const STYLE_ID = 'arenaMobileBracketV3Styles';
  const mobile = matchMedia('(max-width: 760px)');
  const phases = ['Repescagem', 'Quartas de final', 'Semifinal', 'Final'];
  let activePhase = 'Repescagem';
  let frame = 0;

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
  const has = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };

  function tournament() {
    const list = read(TOURNAMENT_KEY, []);
    return Array.isArray(list) ? list.find(item => String(item?.id || '') === SUPER_LEAGUE_ID) || null : null;
  }

  function games() {
    const store = read(MATCH_KEY, {});
    const list = store && typeof store === 'object' ? store[SUPER_LEAGUE_ID] : [];
    return Array.isArray(list) ? list : [];
  }

  function qualifiers() {
    const rt = window.ArenaBDASuperLeagueRuntimeFix;
    const value = Number(rt?.qualifiers?.() ?? tournament()?.qualifiersPerGroup ?? tournament()?.groupSettings?.qualifiersPerGroup ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function repechageMode() {
    return qualifiers() === 3;
  }

  function groupComplete() {
    const schedule = window.ArenaBDASuperLeagueScheduleRepair?.standings?.();
    if (schedule && typeof schedule.complete === 'boolean') return schedule.complete;
    const data = window.ArenaBDASuperLeagueRuntimeFix?.calculate?.();
    if (!Array.isArray(data) || data.length !== 4) return false;
    return data.every(group => {
      const rows = Array.isArray(group?.rows) ? group.rows : [];
      const expected = Math.max(0, rows.length - 1);
      return rows.length >= 3 && rows.every(row => Number(row.j || 0) >= expected);
    });
  }

  function knockoutGames() {
    return games().filter(game => /repescagem|quartas|semifinal|semi-final|\bfinal\b|mata-super-league/i
      .test(`${game?.phase || ''} ${game?.id || ''} ${game?.note || ''}`));
  }

  function actualRepechageExists() {
    return knockoutGames().some(game => norm(game?.phase).includes('repescagem'));
  }

  function phaseFor(game) {
    const phase = norm(game?.phase);
    if (phase.includes('repesc')) return 'Repescagem';
    if (phase.includes('quart')) return 'Quartas de final';
    if (phase.includes('semi')) return 'Semifinal';
    if (phase === 'final' || phase.includes('grande final')) return 'Final';
    return '';
  }

  function byId(reference) {
    const needle = norm(reference).replace(/\s+/g, '');
    return knockoutGames().find(game => {
      const id = norm(game?.id).replace(/-(volta|ida|v)$/i, '').replace(/\s+/g, '');
      const tie = norm(game?.tieId).replace(/\s+/g, '');
      return id === needle || tie === needle;
    }) || null;
  }

  function score(game, side) {
    if (game?.wo === 'a') return side === 'a' ? 3 : 0;
    if (game?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game?.a : game?.b;
    return has(value) ? Number(value) : null;
  }

  function winner(game, seen = new Set()) {
    if (!game || seen.has(String(game.id))) return '';
    seen.add(String(game.id));
    const home = resolve(game.ta, seen);
    const away = resolve(game.tb, seen);
    const a = score(game, 'a');
    const b = score(game, 'b');
    if (a == null || b == null) return '';
    if (a > b) return home;
    if (b > a) return away;
    if (has(game.pa) && has(game.pb) && Number(game.pa) !== Number(game.pb)) {
      return Number(game.pa) > Number(game.pb) ? home : away;
    }
    return '';
  }

  function resolve(slot, seen = new Set()) {
    const value = String(slot || '');
    const match = value.match(/^Vencedor\s+(.+)$/i);
    if (!match) return value;
    const source = byId(match[1]);
    return winner(source, new Set(seen)) || 'Aguardando vencedor';
  }

  function done(game) {
    return ['a', 'b'].includes(game?.wo) || (has(game?.a) && has(game?.b));
  }

  function phaseGames(phase) {
    return knockoutGames()
      .filter(game => phaseFor(game) === phase)
      .sort((a, b) => Number(a?.pos || 0) - Number(b?.pos || 0) || Number(a?.created || 0) - Number(b?.created || 0));
  }

  function badgeLabel(game, side) {
    const raw = side === 'a' ? game?.ta : game?.tb;
    const resolved = resolve(raw);
    if (/aguardando vencedor/i.test(resolved)) return 'AG';
    return String(resolved || 'BDA').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function scoreText(game, side) {
    const value = score(game, side);
    return value == null ? '–' : String(value);
  }

  function matchCard(game) {
    const home = resolve(game.ta);
    const away = resolve(game.tb);
    const decided = winner(game);
    return `<article class="arena-v3-bracket-card" data-game-id="${esc(game.id)}">
      <span class="arena-v3-match-note">${esc(game.note || 'Jogo único')}</span>
      <div class="${decided && norm(decided) === norm(home) ? 'winner' : ''}"><i>${esc(badgeLabel(game, 'a'))}</i><b>${esc(home)}</b><strong>${esc(scoreText(game, 'a'))}</strong></div>
      <div class="${decided && norm(decided) === norm(away) ? 'winner' : ''}"><i>${esc(badgeLabel(game, 'b'))}</i><b>${esc(away)}</b><strong>${esc(scoreText(game, 'b'))}</strong></div>
      <small>${done(game) ? 'Resultado definido' : 'Jogo único'}</small>
    </article>`;
  }

  function pendingCopy(phase) {
    if (phase === 'Repescagem') {
      return groupComplete()
        ? { title: 'Repescagem pronta para gerar', text: 'A fase de grupos terminou. Gere os quatro confrontos entre 2º e 3º colocados.' }
        : { title: 'Repescagem aguardando os grupos', text: 'Finalize a fase de grupos. Os líderes vão direto às quartas e 2º/3º colocados disputam a repescagem.' };
    }
    return { title: `${phase} ainda não definida`, text: 'Esta fase será preenchida automaticamente conforme os vencedores avançarem.' };
  }

  function phasePanel(phase) {
    const list = actualRepechageExists() ? phaseGames(phase) : [];
    if (list.length) return `<div class="arena-v3-bracket-list">${list.map(matchCard).join('')}</div>`;
    const copy = pendingCopy(phase);
    const generate = phase === 'Repescagem' && groupComplete() && window.ArenaBDASuperLeagueRepechage?.generate
      ? '<button type="button" class="primary arena-v3-generate-repechage">Gerar repescagem</button>' : '';
    return `<div class="arena-v3-bracket-empty"><span>🏆</span><b>${esc(copy.title)}</b><p>${esc(copy.text)}</p>${generate}</div>`;
  }

  function preferredPhase() {
    if (!actualRepechageExists()) return 'Repescagem';
    for (const phase of phases) {
      const list = phaseGames(phase);
      if (list.length && list.some(game => !done(game))) return phase;
    }
    return 'Final';
  }

  function renderBracket() {
    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    if (!manager || !repechageMode()) return;
    manager.classList.add('arena-sl-repechage-mode');

    const oldScroll = manager.querySelector('.gi-bracket-scroll');
    const oldProgress = manager.querySelector('.gi-bracket-progress');
    if (!oldScroll && !oldProgress) return;

    let shell = manager.querySelector('.arena-v3-bracket-shell');
    if (!shell) {
      shell = document.createElement('section');
      shell.className = 'arena-v3-bracket-shell';
      (oldProgress || oldScroll).before(shell);
      activePhase = preferredPhase();
    }

    if (!phases.includes(activePhase)) activePhase = preferredPhase();
    const phaseData = actualRepechageExists() ? phaseGames(activePhase) : [];
    const signature = JSON.stringify([
      activePhase,
      groupComplete(),
      actualRepechageExists(),
      phaseData.map(game => [game.id, game.ta, game.tb, game.a, game.b, game.pa, game.pb, game.wo, game.status, game.updated])
    ]);
    if (shell.dataset.signature === signature) return;
    shell.dataset.signature = signature;
    shell.innerHTML = `
      <header class="arena-v3-bracket-head">
        <div><span class="eyebrow">Mata-mata</span><h2>Fase final</h2></div>
        <small>1º direto às quartas • 2º e 3º na repescagem</small>
      </header>
      <nav class="arena-v3-bracket-tabs" aria-label="Fases do mata-mata">
        ${phases.map(phase => `<button type="button" data-arena-bracket-phase="${esc(phase)}" class="${phase === activePhase ? 'active' : ''}">${esc(phase === 'Quartas de final' ? 'Quartas' : phase)}</button>`).join('')}
      </nav>
      <div class="arena-v3-bracket-stage" data-phase="${esc(activePhase)}">${phasePanel(activePhase)}</div>`;
  }

  function patchGeneratorButton() {
    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    if (!manager || !repechageMode()) return;
    const card = manager.querySelector('.league-knockout-card');
    const legacy = card?.querySelector('[data-generate-knockout]');
    if (!card || !legacy) return;
    legacy.hidden = true;
    legacy.setAttribute('aria-hidden', 'true');
    let button = card.querySelector('.arena-v3-generate-repechage');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = `${legacy.className || 'primary'} arena-v3-generate-repechage`;
      legacy.after(button);
    }
    button.disabled = !groupComplete();
    button.textContent = groupComplete() ? 'Gerar repescagem' : 'Aguardando fase de grupos';
  }

  function customGenerate() {
    window.ArenaBDASuperLeagueRepechage?.generate?.();
  }

  async function syncRepechageToCloud(event) {
    if (String(event?.detail?.reason || '') !== 'super-league-third-place-repechage') return;
    if (!window.ArenaBDAAuth?.isAdmin?.() || !window.firebase || typeof firebase.firestore !== 'function') return;
    const store = read(MATCH_KEY, {});
    const list = Array.isArray(store?.[SUPER_LEAGUE_ID]) ? store[SUPER_LEAGUE_ID] : [];
    try {
      await firebase.firestore().collection('arenaData').doc(`confrontos-${SUPER_LEAGUE_ID}`).set({
        dataset: 'confrontos',
        tournamentId: SUPER_LEAGUE_ID,
        games: list,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: window.ArenaBDAAuth.currentEmail?.() || ''
      });
    } catch (error) {
      console.warn('[Arena BDA] Repescagem ficou local; sincronização da nuvem falhou', error);
    }
  }

  function findAdminPanel() {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,strong,b')]
      .filter(node => norm(node.textContent).includes('central de edicao rapida'));
    for (const heading of headings) {
      let node = heading.parentElement;
      for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
        const text = norm(node.textContent);
        if (text.includes('jogo') && text.includes('sortear') && text.includes('configurar')) return node;
      }
    }
    return null;
  }

  function compactAdminPanel() {
    if (!mobile.matches) return;
    const panel = findAdminPanel();
    if (!panel) return;
    panel.classList.add('arena-v3-admin-quick');
    if (!panel.querySelector('.arena-v3-admin-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'arena-v3-admin-toggle';
      button.innerHTML = '<span>⚙</span><b>Gerenciar campeonato</b><i>›</i>';
      panel.prepend(button);
    }
  }

  function compactTopActions() {
    if (!mobile.matches) return;
    document.querySelectorAll('#arenaCommandTrigger').forEach(node => { node.hidden = true; });
    document.querySelectorAll('kbd').forEach(node => {
      if (/ctrl\s*k/i.test(node.textContent || '')) node.style.display = 'none';
    });

    const actionGroups = [...document.querySelectorAll('.top-actions,.arena-top-actions,.arena-page-actions,.topbar-actions')];
    actionGroups.forEach(group => {
      const buttons = [...group.querySelectorAll(':scope > button,:scope > a')];
      if (buttons.length < 4) return;
      const gear = buttons.find(button => /config|ajuste|engren/i.test(`${button.id} ${button.getAttribute('aria-label') || ''}`) || /⚙/.test(button.textContent || ''));
      const admin = buttons.find(button => /^admin$/i.test(String(button.textContent || '').trim()));
      if (gear && admin && gear !== admin) admin.classList.add('arena-v3-mobile-hidden-action');
      buttons.forEach(button => {
        const hint = norm(`${button.id} ${button.getAttribute('aria-label') || ''} ${button.title || ''} ${button.textContent || ''}`);
        if (hint.includes('compartilh') || hint.includes('notifica') || hint.includes('buscar') || hint.includes('pesquis')) {
          button.classList.add('arena-v3-mobile-hidden-action');
        }
      });
    });
  }

  function syncBottomSpace() {
    if (!mobile.matches) return;
    const navs = [...document.querySelectorAll('.bottom-nav:not([hidden]),.arena-mobile-nav:not([hidden])')];
    const height = navs.reduce((max, nav) => Math.max(max, nav.getBoundingClientRect?.().height || 0), 0);
    document.documentElement.style.setProperty('--arena-mobile-nav-space', `${Math.ceil((height || 72) + 54)}px`);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .arena-sl-repechage-mode .gi-bracket-progress,
      .arena-sl-repechage-mode .gi-bracket-scroll{display:none!important}
      .arena-v3-bracket-shell{margin-top:10px}
      .arena-v3-bracket-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}
      .arena-v3-bracket-head h2{margin:3px 0 0;font-size:26px;text-transform:none}
      .arena-v3-bracket-head small{max-width:300px;color:var(--muted);font-size:8px;text-align:right}
      .arena-v3-bracket-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:5px;border:1px solid var(--line);border-radius:12px;background:#06100a}
      .arena-v3-bracket-tabs button{min-height:38px;padding:0 8px;border:0;border-radius:8px;color:#84958b;background:transparent;font-size:9px;font-weight:850}
      .arena-v3-bracket-tabs button.active{color:#14130c;background:#d8b248}
      .arena-v3-bracket-stage{margin-top:8px}
      .arena-v3-bracket-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .arena-v3-bracket-card{padding:10px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:#09150d}
      .arena-v3-match-note{display:block;margin-bottom:7px;color:#82958a;font-size:7px}
      .arena-v3-bracket-card>div{display:grid;grid-template-columns:28px minmax(0,1fr) 26px;align-items:center;gap:7px;min-height:42px;padding:5px;border-top:1px solid rgba(255,255,255,.055)}
      .arena-v3-bracket-card>div.winner{color:#69e69b;background:rgba(79,223,143,.045)}
      .arena-v3-bracket-card i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:#171207;background:#d8b248;font-size:7px;font-style:normal;font-weight:900}
      .arena-v3-bracket-card b{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
      .arena-v3-bracket-card strong{text-align:center;font:900 19px 'Barlow Condensed',sans-serif}
      .arena-v3-bracket-card>small{display:block;margin-top:6px;color:#718279;font-size:7px;text-align:center}
      .arena-v3-bracket-empty{display:grid;place-items:center;min-height:180px;padding:22px;border:1px dashed rgba(216,178,72,.26);border-radius:14px;color:#91a197;background:#06100a;text-align:center}
      .arena-v3-bracket-empty>span{font-size:26px}.arena-v3-bracket-empty>b{margin-top:7px;color:#eef4ef;font-size:15px}.arena-v3-bracket-empty>p{max-width:460px;margin:6px 0 12px;font-size:9px;line-height:1.5}
      .arena-v3-admin-toggle{display:none}
      @media(max-width:760px){
        #arenaCommandTrigger{display:none!important}
        .arena-v3-mobile-hidden-action{display:none!important}
        .arena-v3-admin-quick{padding:10px!important;min-height:0!important}
        .arena-v3-admin-quick .arena-v3-admin-toggle{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;min-height:44px;padding:0 10px;border:1px solid rgba(216,178,72,.22);border-radius:10px;color:#eef4ef;background:#08150d;text-align:left}
        .arena-v3-admin-toggle span{color:#d8b248;font-size:16px}.arena-v3-admin-toggle b{font-size:10px}.arena-v3-admin-toggle i{color:#8b9c92;font-size:18px;font-style:normal;transition:transform .15s ease}
        .arena-v3-admin-quick:not(.expanded)>:not(.arena-v3-admin-toggle){display:none!important}
        .arena-v3-admin-quick.expanded .arena-v3-admin-toggle i{transform:rotate(90deg)}
        .arena-v3-bracket-head{display:block}.arena-v3-bracket-head small{display:block;max-width:none;margin-top:5px;text-align:left}
        .arena-v3-bracket-tabs{position:sticky;top:66px;z-index:22;grid-template-columns:repeat(4,max-content);overflow-x:auto;justify-content:start;scrollbar-width:none}
        .arena-v3-bracket-tabs::-webkit-scrollbar{display:none}.arena-v3-bracket-tabs button{min-width:86px}
        .arena-v3-bracket-list{grid-template-columns:1fr}
        .arena-v3-bracket-card{padding:9px}
        .bottom-nav,.arena-mobile-nav{min-height:66px!important}
        .bottom-nav .nav-btn,.arena-mobile-nav button{min-height:50px!important;height:50px!important;padding:4px 2px!important;border-radius:9px!important}
        .bottom-nav .nav-btn.active,.arena-mobile-nav button.active{transform:none!important;box-shadow:inset 0 2px 0 #d8b248!important}
        body.arena-visual-system{padding-bottom:var(--arena-mobile-nav-space,126px)!important}
        body.arena-visual-system main{padding-bottom:var(--arena-mobile-nav-space,126px)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function refresh() {
    frame = 0;
    installStyles();
    compactTopActions();
    compactAdminPanel();
    patchGeneratorButton();
    renderBracket();
    syncBottomSpace();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(refresh);
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest?.('.arena-v3-admin-toggle');
    if (toggle) {
      toggle.closest('.arena-v3-admin-quick')?.classList.toggle('expanded');
      return;
    }
    const phase = event.target.closest?.('[data-arena-bracket-phase]');
    if (phase) {
      activePhase = phase.dataset.arenaBracketPhase || 'Repescagem';
      renderBracket();
      return;
    }
    if (event.target.closest?.('.arena-v3-generate-repechage')) {
      event.preventDefault();
      event.stopPropagation();
      customGenerate();
    }
  });

  ['arena:bundle-loaded','arena:matches-updated','arena:tournaments-updated','arena:auth-changed','arena:cloud-ready','arena:quick-score-saved']
    .forEach(type => window.addEventListener(type, event => {
      if (type === 'arena:matches-updated') syncRepechageToCloud(event);
      schedule();
    }));
  window.addEventListener('resize', schedule, { passive: true });
  mobile.addEventListener?.('change', schedule);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDAMobileBracketV3 = Object.freeze({
    version: 1,
    refresh,
    renderBracket,
    syncBottomSpace
  });

  refresh();
})();
