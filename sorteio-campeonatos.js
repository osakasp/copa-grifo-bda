(() => {
  'use strict';

  const ADMIN_EMAIL = 'miniamikaren@gmail.com';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const DRAW_BACKUP_KEY = 'bda-v3-sorteio-backup';
  const PHASES = ['Preliminar', '32 avos de final', '16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

  let currentUser = null;
  let db = null;
  let activeTournamentId = '';
  let preview = null;
  let renderTimer = 0;

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

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const values = read(TOURNAMENT_KEY, []);
    return Array.isArray(values) ? values : [];
  }

  function tournamentById(id = activeTournamentId) {
    return tournaments().find(item => item.id === id) || null;
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function matches(id = activeTournamentId) {
    const values = matchStore()[id];
    return Array.isArray(values) ? values : [];
  }

  function isAdmin() {
    return Boolean(
      currentUser && String(currentUser.email || '').toLowerCase() === ADMIN_EMAIL
    );
  }

  function notify(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  function secureRandom() {
    if (window.crypto?.getRandomValues) {
      const data = new Uint32Array(1);
      window.crypto.getRandomValues(data);
      return data[0] / 4294967296;
    }
    return Math.random();
  }

  function randomSeed() {
    if (window.crypto?.getRandomValues) {
      const data = new Uint32Array(3);
      window.crypto.getRandomValues(data);
      return [...data].map(value => value.toString(16).padStart(8, '0')).join('-');
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(secureRandom() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function uniqueNames(values) {
    const seen = new Set();
    return values.filter(value => {
      const key = norm(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function phaseForSize(size) {
    if (size <= 2) return 'Final';
    if (size <= 4) return 'Semifinal';
    if (size <= 8) return 'Quartas de final';
    if (size <= 16) return 'Oitavas de final';
    if (size <= 32) return '16 avos de final';
    return '32 avos de final';
  }

  function codeForPhase(phase) {
    const value = norm(phase);
    if (value.includes('prelim')) return 'P';
    if (value.includes('32 avos')) return 'R';
    if (value.includes('16 avos')) return 'D';
    if (value.includes('oitav')) return 'J';
    if (value.includes('quart')) return 'Q';
    if (value.includes('semi')) return 'S';
    if (value.includes('final')) return 'F';
    return 'C';
  }

  function largestPowerOfTwoAtMost(number) {
    let power = 1;
    while (power * 2 <= number) power *= 2;
    return power;
  }

  function pairPool(pool, seededNames = new Set()) {
    const seedEntries = [];
    const ordinaryEntries = [];

    pool.forEach(entry => {
      const name = typeof entry === 'string' ? entry : entry.name;
      if (seededNames.has(norm(name))) seedEntries.push(entry);
      else ordinaryEntries.push(entry);
    });

    const seeds = shuffle(seedEntries);
    const ordinary = shuffle(ordinaryEntries);
    const pairs = [];

    while (seeds.length && ordinary.length) {
      const a = seeds.shift();
      const b = ordinary.shift();
      pairs.push(secureRandom() < 0.5 ? [a, b] : [b, a]);
    }

    const rest = shuffle([...seeds, ...ordinary]);
    while (rest.length >= 2) pairs.push([rest.shift(), rest.shift()]);

    return { pairs, bye: rest[0] || null };
  }

  function matchObject({ id, tieId, phase, pos, ta, tb, leg = 1, created }) {
    return {
      id, tieId, leg, phase, status: 'Agendado', ta, tb,
      a: '', b: '', pa: '', pb: '', wo: 'none', pos,
      date: '', time: '', place: '', note: '', created, updated: created
    };
  }

  function addTie(target, { code, number, phase, ta, tb, legs, finalLegs, created }) {
    const tieId = `${code}${number}`;
    const normalizedPhase = norm(phase);
    const isFinal = normalizedPhase === 'final' || normalizedPhase === 'grande final';
    const numberOfLegs = isFinal ? finalLegs : legs;

    target.push(matchObject({
      id: tieId, tieId, phase, pos: number, ta, tb, leg: 1, created
    }));

    if (numberOfLegs === 2) {
      target.push(matchObject({
        id: `${tieId}-volta`, tieId, phase, pos: number,
        ta: tb, tb: ta, leg: 2, created: created + 1
      }));
    }

    return tieId;
  }

  function buildKnockout(options) {
    const selected = uniqueNames(options.teams);
    const seeded = new Set(options.seeded.map(norm));
    const generated = [];
    const byes = [];
    const now = Date.now();
    const legs = options.legs;
    const finalLegs = options.finalLegs || legs;

    if (options.scope === 'phase') {
      const draw = pairPool(selected, options.protectSeeds ? seeded : new Set());
      const phase = options.phase || phaseForSize(selected.length);
      const code = codeForPhase(phase);

      draw.pairs.forEach(([a, b], index) => {
        addTie(generated, {
          code, number: index + 1, phase, ta: a, tb: b,
          legs, finalLegs, created: now + index * 4
        });
      });

      if (draw.bye) byes.push(draw.bye);

      return {
        games: generated,
        byes,
        summary: `${draw.pairs.length} confronto${draw.pairs.length === 1 ? '' : 's'} em ${phase}`,
        startPhase: phase
      };
    }

    const teamCount = selected.length;
    const mainSize = largestPowerOfTwoAtMost(teamCount);
    const preliminaryMatches = teamCount - mainSize;
    let mainPool = [];

    if (preliminaryMatches > 0) {
      const seedTeams = shuffle(selected.filter(name => seeded.has(norm(name))));
      const nonSeeds = shuffle(selected.filter(name => !seeded.has(norm(name))));
      const byeCount = teamCount - preliminaryMatches * 2;
      const byeTeams = [];

      if (options.protectSeeds) {
        while (seedTeams.length && byeTeams.length < byeCount) byeTeams.push(seedTeams.shift());
      }

      const remaining = shuffle([...seedTeams, ...nonSeeds]);
      while (byeTeams.length < byeCount && remaining.length) byeTeams.push(remaining.shift());

      const preliminaryPool = shuffle(remaining);
      const winnerReferences = [];

      for (let index = 0; index < preliminaryMatches; index += 1) {
        const tieId = addTie(generated, {
          code: 'P', number: index + 1, phase: 'Preliminar',
          ta: preliminaryPool[index * 2], tb: preliminaryPool[index * 2 + 1],
          legs, finalLegs, created: now + index * 4
        });
        winnerReferences.push(`Vencedor ${tieId}`);
      }

      byes.push(...byeTeams);
      mainPool = [...byeTeams, ...winnerReferences];
    } else {
      mainPool = selected;
    }

    let phaseSize = mainSize;
    let pool = mainPool;
    let createdOffset = generated.length * 4;

    while (phaseSize >= 2) {
      const phase = phaseForSize(phaseSize);
      const code = codeForPhase(phase);
      const pairing = pairPool(
        pool,
        phaseSize === mainSize && options.protectSeeds ? seeded : new Set()
      );
      const nextPool = [];

      pairing.pairs.forEach(([a, b], index) => {
        const tieId = addTie(generated, {
          code, number: index + 1, phase,
          ta: typeof a === 'string' ? a : a.name,
          tb: typeof b === 'string' ? b : b.name,
          legs, finalLegs, created: now + createdOffset + index * 4
        });
        nextPool.push(`Vencedor ${tieId}`);
      });

      pool = nextPool;
      createdOffset += pairing.pairs.length * 4;
      phaseSize /= 2;
    }

    return {
      games: generated,
      byes,
      summary: `${generated.filter(game => game.leg === 1).length} confrontos até a final`,
      startPhase: preliminaryMatches > 0 ? 'Preliminar' : phaseForSize(mainSize)
    };
  }

  function roundRobinOrder(values) {
    const list = shuffle(values);
    if (list.length % 2 === 1) list.push(null);
    const rounds = [];
    const fixed = list[0];
    let rotating = list.slice(1);

    for (let round = 0; round < list.length - 1; round += 1) {
      const current = [fixed, ...rotating];
      const pairs = [];

      for (let index = 0; index < current.length / 2; index += 1) {
        const left = current[index];
        const right = current[current.length - 1 - index];
        if (!left || !right) continue;
        const reverse = (round + index) % 2 === 1;
        pairs.push(reverse ? [right, left] : [left, right]);
      }

      rounds.push(pairs);
      rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
    }

    return rounds;
  }

  function buildLeague(options) {
    const selected = uniqueNames(options.teams);
    const firstTurn = roundRobinOrder(selected);
    const generated = [];
    const now = Date.now();
    let sequence = 0;

    firstTurn.forEach((pairs, roundIndex) => {
      pairs.forEach(([a, b], matchIndex) => {
        sequence += 1;
        generated.push(matchObject({
          id: `L${sequence}`, tieId: `L${sequence}`,
          phase: `Rodada ${roundIndex + 1}`, pos: matchIndex + 1,
          ta: a, tb: b, leg: 1, created: now + sequence * 3
        }));
      });
    });

    if (options.turns === 2) {
      firstTurn.forEach((pairs, roundIndex) => {
        pairs.forEach(([a, b], matchIndex) => {
          sequence += 1;
          generated.push(matchObject({
            id: `L${sequence}`, tieId: `L${sequence}`,
            phase: `Rodada ${firstTurn.length + roundIndex + 1}`,
            pos: matchIndex + 1, ta: b, tb: a, leg: 2,
            created: now + sequence * 3
          }));
        });
      });
    }

    return {
      games: generated,
      byes: selected.length % 2 === 1 ? ['Uma folga por rodada'] : [],
      summary: `${firstTurn.length * options.turns} rodadas e ${generated.length} jogos`,
      startPhase: 'Rodada 1'
    };
  }

  function currentTournamentFromPage() {
    const managerId = $('#giManager')?.dataset.tid;
    if (managerId) return managerId;

    const title = $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim();
    if (title) {
      const found = tournaments().find(item => norm(item.name) === norm(title));
      if (found) return found.id;
    }

    return activeTournamentId || tournaments()[0]?.id || '';
  }

  function selectedTeams() {
    return $$('#drawTeamList input[data-draw-team]:checked').map(input => input.value);
  }

  function selectedSeeds() {
    return $$('#drawTeamList input[data-draw-seed]:checked').map(input => input.value);
  }

  function activeType() {
    return $('#drawType')?.value || 'knockout';
  }

  function updateOptionVisibility() {
    const knockout = activeType() === 'knockout';
    $$('.draw-knockout-only').forEach(element => element.hidden = !knockout);
    $$('.draw-league-only').forEach(element => element.hidden = knockout);
    $('#drawSeedHelp').hidden = !knockout;
    const phaseLabel = $('#drawPhase')?.closest('label');
    if (phaseLabel) phaseLabel.hidden = !knockout || $('#drawScope').value !== 'phase';
  }

  function renderTeamList() {
    const root = $('#drawTeamList');
    const tournament = tournamentById();
    if (!root || !tournament) return;

    const participants = uniqueNames(
      Array.isArray(tournament.participants) ? tournament.participants : []
    );

    root.innerHTML = participants.length
      ? participants.map((name, index) => `
          <div class="draw-team-row">
            <label>
              <input type="checkbox" data-draw-team value="${esc(name)}" checked>
              <span class="draw-team-number">${index + 1}</span>
              <b>${esc(name)}</b>
            </label>
            <label class="draw-seed-control" title="Marcar como cabeça de chave">
              <input type="checkbox" data-draw-seed value="${esc(name)}">
              <span>★</span>
            </label>
          </div>
        `).join('')
      : '<div class="draw-empty">Adicione clubes participantes ao campeonato antes de realizar o sorteio.</div>';

    $('#drawTeamCount').textContent = `${participants.length} participantes disponíveis`;
  }

  function drawOptionsFromForm() {
    const type = activeType();
    const teams = selectedTeams();
    const seeded = selectedSeeds().filter(name => teams.some(team => norm(team) === norm(name)));

    if (teams.length < 2) throw new Error('Selecione pelo menos dois times');

    if (type === 'league') {
      return { type, teams, turns: Number($('#drawTurns').value) === 2 ? 2 : 1 };
    }

    const legs = Number($('#drawLegs').value) === 2 ? 2 : 1;
    const finalValue = Number($('#drawFinalLegs').value);

    return {
      type, teams, seeded,
      protectSeeds: $('#drawProtectSeeds').checked,
      scope: $('#drawScope').value,
      phase: $('#drawPhase').value,
      legs,
      finalLegs: finalValue === 0 ? legs : finalValue
    };
  }

  function previewCard(game) {
    return `
      <article class="draw-preview-match">
        <header><span>${esc(game.phase)}</span><small>${Number(game.leg) === 2 ? 'Volta' : 'Ida / único'}</small></header>
        <div><b>${esc(game.ta)}</b><span>×</span><b>${esc(game.tb)}</b></div>
      </article>
    `;
  }

  function renderPreview() {
    const root = $('#drawPreview');
    const publishButton = $('#drawPublish');
    if (!root || !publishButton) return;

    if (!preview) {
      root.innerHTML = `
        <div class="draw-preview-placeholder">
          <span>🎲</span><b>O resultado do sorteio aparecerá aqui</b>
          <small>Você poderá sortear novamente antes de publicar.</small>
        </div>`;
      publishButton.disabled = true;
      return;
    }

    const firstLegGames = preview.result.games.filter(game => Number(game.leg) === 1);
    const visible = firstLegGames.slice(0, 30);
    const hiddenCount = Math.max(0, firstLegGames.length - visible.length);
    const uniqueTeams = new Set(preview.options.teams.map(norm));
    const validation = [
      uniqueTeams.size === preview.options.teams.length ? '✓ Sem duplicados' : '⚠ Participantes duplicados',
      `✓ ${preview.options.teams.length} clubes`,
      `✓ ${firstLegGames.length} confrontos`,
      preview.result.byes.length ? `✓ ${preview.result.byes.length} folga(s)` : '✓ Sem folgas'
    ];

    root.innerHTML = `
      <div class="draw-certificate">
        <span>Sorteio auditável</span><b>${esc(preview.result.summary)}</b>
        <small>Código ${esc(preview.seed)} • ${esc(preview.timeLabel)}</small>
        <div class="draw-validation">${validation.map(item => `<i>${esc(item)}</i>`).join('')}</div>
        <button type="button" data-draw-copy>Copiar certificado</button>
      </div>
      ${preview.result.byes.length ? `<div class="draw-byes"><b>Folgas / avanço direto</b><span>${preview.result.byes.map(esc).join(' • ')}</span></div>` : ''}
      <div class="draw-preview-grid">${visible.map(previewCard).join('')}</div>
      ${hiddenCount ? `<p class="draw-more">+ ${hiddenCount} jogos serão criados automaticamente.</p>` : ''}`;

    publishButton.disabled = false;
  }

  async function copyCertificate() {
    if (!preview) return;
    const text = [
      'ARENA BDA — CERTIFICADO DE SORTEIO',
      preview.result.summary,
      `Código: ${preview.seed}`,
      `Data: ${preview.timeLabel}`,
      `Clubes: ${preview.options.teams.join(', ')}`,
      preview.result.byes.length ? `Folgas: ${preview.result.byes.join(', ')}` : 'Folgas: nenhuma'
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify('Certificado copiado');
    } catch {
      notify('Não foi possível copiar o certificado');
    }
  }

  function runDraw() {
    try {
      const options = drawOptionsFromForm();
      const seed = randomSeed();
      const result = options.type === 'league' ? buildLeague(options) : buildKnockout(options);

      preview = {
        options, result, seed, createdAt: Date.now(),
        timeLabel: new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short', timeStyle: 'medium'
        }).format(new Date())
      };

      renderPreview();
      $('#drawPreview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      notify('Sorteio realizado. Confira antes de publicar.');
    } catch (error) {
      notify(error.message || 'Não foi possível realizar o sorteio');
    }
  }

  function saveBackup(tournament, currentMatches) {
    localStorage.setItem(DRAW_BACKUP_KEY, JSON.stringify({
      tournamentId: tournament.id, tournament,
      matches: currentMatches, savedAt: Date.now()
    }));
  }

  async function publishDraw() {
    if (!preview || !isAdmin()) return;
    const tournament = tournamentById();
    if (!tournament) return;

    const oldMatches = matches(tournament.id);
    if (oldMatches.length && !confirm(`Este campeonato já possui ${oldMatches.length} jogos. Substituir pelo novo sorteio?`)) return;

    saveBackup(tournament, oldMatches);

    const store = matchStore();
    store[tournament.id] = preview.result.games;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));

    const values = tournaments();
    const index = values.findIndex(item => item.id === tournament.id);
    const drawData = {
      seed: preview.seed,
      type: preview.options.type,
      createdAt: preview.createdAt,
      createdBy: String(currentUser.email || '').toLowerCase(),
      teams: preview.options.teams,
      byes: preview.result.byes,
      summary: preview.result.summary
    };

    const matchSettings = preview.options.type === 'knockout'
      ? {
          ...(tournament.matchSettings || {}),
          knockoutLegs: preview.options.legs,
          finalLegs: preview.options.finalLegs,
          autoAdvance: true
        }
      : {
          ...(tournament.matchSettings || {}),
          leagueTurns: preview.options.turns,
          autoAdvance: false
        };

    values[index] = {
      ...tournament,
      status: 'Em andamento',
      phase: preview.result.startPhase,
      format: preview.options.type === 'league'
        ? (preview.options.turns === 2 ? 'Turno e returno' : 'Pontos corridos')
        : tournament.format,
      matchSettings,
      lastDraw: drawData,
      updatedAt: Date.now()
    };

    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(values));
    $('#drawPublish').disabled = true;
    $('#drawPublish').textContent = 'Publicando...';

    try {
      if (db) {
        await db.collection('arenaData').doc(`confrontos-${tournament.id}`).set({
          dataset: 'confrontos', tournamentId: tournament.id,
          games: preview.result.games, draw: drawData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: String(currentUser.email || '').toLowerCase()
        });
      }
      notify('Sorteio publicado e chaveamento criado');
      closeModal();
      window.setTimeout(() => location.reload(), 550);
    } catch (error) {
      console.error('Falha ao publicar o sorteio', error);
      notify('Sorteio salvo no aparelho. A nuvem tentará sincronizar novamente.');
      closeModal();
      window.setTimeout(() => location.reload(), 850);
    }
  }

  function restoreLastDraw() {
    if (!isAdmin()) return;
    const backup = read(DRAW_BACKUP_KEY, null);
    if (!backup?.tournamentId) {
      notify('Nenhum sorteio anterior disponível para restaurar');
      return;
    }
    if (!confirm('Restaurar os jogos existentes antes do último sorteio?')) return;

    const store = matchStore();
    store[backup.tournamentId] = Array.isArray(backup.matches) ? backup.matches : [];
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));

    const values = tournaments();
    const index = values.findIndex(item => item.id === backup.tournamentId);
    if (index >= 0 && backup.tournament) values[index] = backup.tournament;
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(values));
    localStorage.removeItem(DRAW_BACKUP_KEY);

    notify('Sorteio anterior restaurado');
    window.setTimeout(() => location.reload(), 500);
  }

  function openModal(tournamentId = currentTournamentFromPage()) {
    if (!isAdmin()) {
      notify('Entre como administrador para realizar o sorteio');
      return;
    }

    activeTournamentId = tournamentId;
    const tournament = tournamentById();
    if (!tournament) {
      notify('Campeonato não encontrado');
      return;
    }

    preview = null;
    $('#drawModalTitle').textContent = `Sorteio • ${tournament.name}`;
    $('#drawType').value = norm(tournament.format).includes('pontos') || norm(tournament.format).includes('turno') ? 'league' : 'knockout';
    $('#drawScope').value = 'complete';
    $('#drawPhase').value = phaseForSize(Math.max(2, tournament.participants?.length || 2));
    $('#drawLegs').value = String(Number(tournament.matchSettings?.knockoutLegs) === 2 ? 2 : 1);
    $('#drawFinalLegs').value = String(Number(tournament.matchSettings?.finalLegs) || 0);
    $('#drawTurns').value = String(Number(tournament.matchSettings?.leagueTurns) === 2 ? 2 : 1);
    $('#drawProtectSeeds').checked = true;

    renderTeamList();
    updateOptionVisibility();
    renderPreview();
    $('#drawRestore').hidden = !read(DRAW_BACKUP_KEY, null);
    $('#drawModal').classList.add('show');
  }

  function closeModal() {
    $('#drawModal')?.classList.remove('show');
    preview = null;
    const publish = $('#drawPublish');
    if (publish) {
      publish.disabled = true;
      publish.textContent = 'Publicar sorteio';
    }
  }

  function injectButtons() {
    const authorized = isAdmin();
    const tournamentId = currentTournamentFromPage();

    const managerActions = $('#giManager .gi-head > div:last-child');
    if (managerActions && !$('#smartDrawButton', managerActions)) {
      const button = document.createElement('button');
      button.id = 'smartDrawButton';
      button.className = 'primary draw-open-button';
      button.type = 'button';
      button.textContent = '🎲 Sortear';
      button.hidden = !authorized;
      button.addEventListener('click', () => openModal(tournamentId));
      managerActions.appendChild(button);
    }
    const managerButton = $('#smartDrawButton');
    if (managerButton) managerButton.hidden = !authorized;

    const arenaActions = $('#arenaDetail .arena-actions');
    if (arenaActions && !$('#arenaDrawButton', arenaActions)) {
      const button = document.createElement('button');
      button.id = 'arenaDrawButton';
      button.className = 'primary draw-open-button';
      button.type = 'button';
      button.textContent = '🎲 Realizar sorteio';
      button.hidden = !authorized;
      button.addEventListener('click', () => openModal(currentTournamentFromPage()));
      arenaActions.prepend(button);
    }
    const arenaButton = $('#arenaDrawButton');
    if (arenaButton) arenaButton.hidden = !authorized;

    const shortcuts = $('.cloud-panel-shortcuts');
    if (shortcuts && !$('#panelDrawTournament', shortcuts)) {
      const button = document.createElement('button');
      button.id = 'panelDrawTournament';
      button.type = 'button';
      button.innerHTML = '<i>🎲</i><span>Sortear campeonato</span>';
      button.addEventListener('click', () => {
        $('#cloudAdminModal')?.classList.remove('show');
        if (typeof navigate === 'function') navigate('tournament');
        window.setTimeout(() => openModal(currentTournamentFromPage()), 120);
      });
      shortcuts.appendChild(button);
    }
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'drawModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'drawModalTitle');
    modal.innerHTML = `
      <div class="modal draw-modal">
        <div class="draw-modal-head">
          <div><span class="eyebrow">Central de sorteios BDA</span><h2 id="drawModalTitle">Sorteio do campeonato</h2><p>Configure, faça uma prévia e publique somente depois de conferir.</p></div>
          <button id="drawClose" class="draw-close" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="draw-steps"><span><b>1</b> Configurar</span><span><b>2</b> Sortear</span><span><b>3</b> Publicar</span></div>
        <section class="draw-section">
          <div class="draw-section-title"><div><b>Formato do sorteio</b><small>Escolha o sistema da competição</small></div></div>
          <div class="draw-form-grid">
            <label>Modelo<select id="drawType"><option value="knockout">Mata-mata</option><option value="league">Pontos corridos</option></select></label>
            <label class="draw-knockout-only">Alcance<select id="drawScope"><option value="complete">Chaveamento completo até a final</option><option value="phase">Somente uma fase</option></select></label>
            <label class="draw-knockout-only">Fase inicial<select id="drawPhase">${PHASES.map(phase => `<option>${phase}</option>`).join('')}</select></label>
            <label class="draw-knockout-only">Partidas<select id="drawLegs"><option value="1">Jogo único</option><option value="2">Ida e volta</option></select></label>
            <label class="draw-knockout-only">Final<select id="drawFinalLegs"><option value="0">Seguir o padrão</option><option value="1">Jogo único</option><option value="2">Ida e volta</option></select></label>
            <label class="draw-league-only">Temporada<select id="drawTurns"><option value="1">Turno único</option><option value="2">Turno e returno</option></select></label>
          </div>
          <label class="draw-switch draw-knockout-only"><input id="drawProtectSeeds" type="checkbox" checked><span><b>Proteger cabeças de chave</b><small>Evita que os marcados com ★ se enfrentem logo na primeira fase, quando possível.</small></span></label>
        </section>
        <section class="draw-section">
          <div class="draw-section-title"><div><b>Participantes</b><small id="drawTeamCount"></small></div><div class="draw-mini-actions"><button id="drawSelectAll" type="button">Todos</button><button id="drawClearSeeds" type="button">Limpar ★</button></div></div>
          <p class="draw-seed-help" id="drawSeedHelp">Marque a estrela para definir cabeças de chave.</p>
          <div id="drawTeamList" class="draw-team-list"></div>
        </section>
        <section class="draw-section draw-result-section">
          <div class="draw-section-title"><div><b>Prévia do sorteio</b><small>Nada será alterado até você publicar</small></div><button id="drawRun" class="primary" type="button">🎲 Sortear agora</button></div>
          <div id="drawPreview"></div>
        </section>
        <div class="draw-footer-actions"><button id="drawRestore" class="danger" type="button">Desfazer último sorteio</button><button id="drawCancel" class="secondary" type="button">Cancelar</button><button id="drawPublish" class="primary" type="button" disabled>Publicar sorteio</button></div>
      </div>`;
    document.body.appendChild(modal);
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `.draw-open-button{white-space:nowrap}.draw-modal{width:min(100%,920px);max-height:92vh;padding:0;overflow:auto;text-align:left}.draw-modal-head{position:sticky;top:0;z-index:4;display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:18px 20px;border-bottom:1px solid var(--line);background:rgba(16,29,22,.96);backdrop-filter:blur(16px)}.draw-modal-head h2{margin:5px 0 4px;font-size:30px;text-transform:uppercase}.draw-modal-head p{margin:0;color:var(--muted);font-size:10px}.draw-close{width:42px;min-width:42px;height:42px;padding:0;border:1px solid var(--line);border-radius:13px;color:var(--text);background:#ffffff08;font-size:22px}.draw-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:14px 20px 0}.draw-steps span{display:flex;align-items:center;gap:7px;padding:8px;border:1px solid var(--line);border-radius:11px;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.draw-steps b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;color:#171107;background:var(--gold-soft)}.draw-section{margin:14px 20px 0;padding:15px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.draw-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.draw-section-title b,.draw-section-title small{display:block}.draw-section-title b{font:900 17px "Barlow Condensed",sans-serif;text-transform:uppercase}.draw-section-title small{margin-top:2px;color:var(--muted);font-size:8px}.draw-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.draw-form-grid label{display:block}.draw-form-grid select{margin-top:6px}.draw-switch{display:flex!important;grid-template-columns:auto 1fr!important;align-items:flex-start;gap:10px;margin-top:11px;padding:11px;border:1px solid var(--line);border-radius:12px;background:#03080670;text-transform:none}.draw-switch input{width:20px;height:20px;margin:0}.draw-switch b,.draw-switch small{display:block}.draw-switch b{color:var(--text);font-size:10px}.draw-switch small{margin-top:3px;color:var(--muted);font-size:8px;font-weight:500;letter-spacing:0;text-transform:none}.draw-mini-actions{display:flex;gap:6px}.draw-mini-actions button{padding:7px 9px;border:1px solid var(--line);border-radius:9px;color:var(--gold-soft);background:#ffffff06;font-size:8px;font-weight:900}.draw-seed-help{margin:0 0 8px;color:var(--muted);font-size:8px}.draw-team-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:290px;overflow:auto}.draw-team-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px;padding:8px;border:1px solid var(--line);border-radius:11px;background:#03080666}.draw-team-row>label:first-child{display:flex;align-items:center;gap:8px;min-width:0;color:var(--text);text-transform:none}.draw-team-row input{width:18px;height:18px;margin:0}.draw-team-row b{overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.draw-team-number{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;color:var(--gold-soft);background:rgba(216,178,72,.09);font-size:8px;font-weight:900}.draw-seed-control{display:grid!important;place-items:center!important;width:34px;height:34px;border:1px solid var(--line);border-radius:9px;color:var(--muted);background:#ffffff05}.draw-seed-control input{position:absolute;opacity:0}.draw-seed-control:has(input:checked){color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.draw-seed-control span{font-size:17px}.draw-empty{grid-column:1/-1;padding:25px;color:var(--muted);text-align:center}.draw-result-section{margin-bottom:14px}.draw-preview-placeholder{display:grid;place-items:center;gap:5px;min-height:180px;padding:22px;border:1px dashed var(--line-strong);border-radius:14px;color:var(--muted);text-align:center}.draw-preview-placeholder>span{font-size:38px}.draw-preview-placeholder b{color:var(--text);font-size:11px}.draw-preview-placeholder small{font-size:8px}.draw-certificate{padding:12px;border:1px solid rgba(79,223,143,.22);border-radius:12px;background:rgba(79,223,143,.07)}.draw-certificate span,.draw-certificate b,.draw-certificate small{display:block}.draw-certificate span{color:var(--green);font-size:8px;font-weight:900;text-transform:uppercase}.draw-certificate b{margin-top:4px;font-size:12px}.draw-certificate small{margin-top:4px;color:var(--muted);font-size:7px;overflow-wrap:anywhere}.draw-byes{margin-top:8px;padding:10px;border:1px solid rgba(216,178,72,.2);border-radius:11px;background:rgba(216,178,72,.07)}.draw-byes b,.draw-byes span{display:block}.draw-byes b{color:var(--gold-soft);font-size:9px}.draw-byes span{margin-top:4px;color:var(--muted);font-size:8px}.draw-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px}.draw-preview-match{padding:9px;border:1px solid var(--line);border-radius:11px;background:#03080666}.draw-preview-match header{display:flex;justify-content:space-between;gap:8px;margin-bottom:7px}.draw-preview-match header span{color:var(--gold-soft);font-size:7px;font-weight:900;text-transform:uppercase}.draw-preview-match header small{color:var(--muted);font-size:7px}.draw-preview-match>div{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:7px}.draw-preview-match b{font-size:9px}.draw-preview-match b:last-child{text-align:right}.draw-preview-match>div span{color:var(--gold-soft);font-weight:900}.draw-more{margin:9px 0 0;color:var(--muted);font-size:8px;text-align:center}.draw-footer-actions{position:sticky;bottom:0;z-index:4;display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--line);background:rgba(16,29,22,.96);backdrop-filter:blur(16px)}.draw-footer-actions button:disabled{cursor:not-allowed;opacity:.45}.draw-footer-actions .danger{margin-right:auto}@media(max-width:720px){.draw-form-grid{grid-template-columns:1fr 1fr}.draw-team-list,.draw-preview-grid{grid-template-columns:1fr}.draw-modal{max-height:94vh}}@media(max-width:480px){.draw-modal-head{padding:15px}.draw-modal-head h2{font-size:24px}.draw-steps{padding-inline:15px}.draw-steps span{justify-content:center}.draw-steps span:not(:first-child){font-size:0}.draw-section{margin-inline:15px}.draw-form-grid{grid-template-columns:1fr}.draw-section-title{align-items:flex-start}.draw-section-title #drawRun{min-height:38px;padding:0 10px;font-size:9px}.draw-footer-actions{display:grid;grid-template-columns:1fr 1fr;padding:12px 15px}.draw-footer-actions .danger{grid-column:1/-1;width:100%;margin:0}.draw-footer-actions button{width:100%}}`;
    style.textContent += `.draw-validation{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.draw-validation i{padding:5px 7px;border-radius:999px;color:var(--green);background:rgba(79,223,143,.09);font-size:7px;font-style:normal;font-weight:900}.draw-certificate [data-draw-copy]{margin-top:9px;padding:7px 9px;border:1px solid rgba(79,223,143,.28);border-radius:9px;color:var(--green);background:transparent;font-size:8px;font-weight:900}`;
    document.head.appendChild(style);
  }

  function bindEvents() {
    $('#drawClose').addEventListener('click', closeModal);
    $('#drawCancel').addEventListener('click', closeModal);
    $('#drawRun').addEventListener('click', runDraw);
    $('#drawPublish').addEventListener('click', publishDraw);
    $('#drawPreview').addEventListener('click', event => {
      if (event.target.closest('[data-draw-copy]')) copyCertificate();
    });
    $('#drawRestore').addEventListener('click', restoreLastDraw);
    $('#drawType').addEventListener('change', () => { preview = null; updateOptionVisibility(); renderPreview(); });
    $('#drawScope').addEventListener('change', () => { updateOptionVisibility(); preview = null; renderPreview(); });
    $('#drawSelectAll').addEventListener('click', () => {
      const inputs = $$('#drawTeamList input[data-draw-team]');
      const shouldSelect = inputs.some(input => !input.checked);
      inputs.forEach(input => input.checked = shouldSelect);
      preview = null; renderPreview();
    });
    $('#drawClearSeeds').addEventListener('click', () => {
      $$('#drawTeamList input[data-draw-seed]').forEach(input => input.checked = false);
      preview = null; renderPreview();
    });
    $('#drawTeamList').addEventListener('change', event => {
      const teamInput = event.target.closest('[data-draw-team]');
      if (teamInput && !teamInput.checked) {
        const seed = $('[data-draw-seed]', teamInput.closest('.draw-team-row'));
        if (seed) seed.checked = false;
      }
      preview = null; renderPreview();
    });
    $('#drawModal').addEventListener('click', event => { if (event.target.id === 'drawModal') closeModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#drawModal')?.classList.contains('show')) closeModal(); });
  }

  function scheduleButtons() {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(injectButtons, 80);
  }

  addStyles();
  buildModal();
  bindEvents();

  if (window.firebase && typeof firebase.auth === 'function') {
    if (typeof firebase.firestore === 'function') db = firebase.firestore();
    firebase.auth().onAuthStateChanged(user => { currentUser = user; scheduleButtons(); });
  }

  const observer = new MutationObserver(scheduleButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleButtons();
})();
