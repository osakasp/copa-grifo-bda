(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const BACKUP_KEY = 'bda-v4-generator-backups';
  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);

  let currentUser = null;
  let active = false;
  let tournamentId = '';
  let preview = null;
  let observerTimer = 0;
  let saving = false;

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
  const slug = value => String(value || 'campeonato')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'campeonato';
  const numeric = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const isAdmin = () => Boolean(currentUser && ADMIN_EMAILS.has(String(currentUser.email || '').toLowerCase()));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function tournament() {
    return tournaments().find(item => item.id === tournamentId) || null;
  }

  function participants() {
    const seen = new Set();
    return (tournament()?.participants || []).filter(name => {
      const key = norm(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function configFromUI() {
    const mode = $('#leagueMode')?.value || 'groups';
    const count = participants().length;
    const maxGroups = Math.max(2, Math.min(8, Math.floor(count / 2) || 2));
    const groupCount = mode === 'league'
      ? 1
      : Math.max(2, Math.min(maxGroups, Number($('#leagueGroupCount')?.value || 4)));
    const qualifiers = mode === 'league'
      ? 0
      : Math.max(1, Math.min(4, Number($('#leagueQualifiers')?.value || 2)));
    const legs = Number($('#leagueLegs')?.value || 1) === 2 ? 2 : 1;
    const distribution = $('#leagueDistribution')?.value || 'random';
    return { mode, groupCount, qualifiers, legs, distribution };
  }

  function storedConfig() {
    const old = tournament()?.groupGenerator || {};
    return {
      mode: old.mode === 'league' ? 'league' : 'groups',
      groupCount: Math.max(2, Number(old.groupCount) || 4),
      qualifiers: Math.max(1, Number(old.qualifiers) || 2),
      legs: Number(old.legs) === 2 ? 2 : 1,
      distribution: old.distribution === 'serpentine' ? 'serpentine' : 'random'
    };
  }

  function shuffled(list) {
    const output = [...list];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [output[index], output[target]] = [output[target], output[index]];
    }
    return output;
  }

  function distribute(list, groupCount, method) {
    const source = method === 'random' ? shuffled(list) : [...list];
    const groups = Array.from({ length: groupCount }, () => []);

    if (method === 'serpentine') {
      source.forEach((team, index) => {
        const cycle = Math.floor(index / groupCount);
        const offset = index % groupCount;
        const groupIndex = cycle % 2 === 0 ? offset : groupCount - 1 - offset;
        groups[groupIndex].push(team);
      });
    } else {
      source.forEach((team, index) => groups[index % groupCount].push(team));
    }

    return groups;
  }

  function groupLabel(index) {
    return `Grupo ${String.fromCharCode(65 + index)}`;
  }

  function buildPreview(force = false) {
    const teams = participants();
    const config = configFromUI();
    const signature = JSON.stringify([teams, config]);
    if (!force && preview?.signature === signature) return preview;

    const groups = config.mode === 'league'
      ? [teams]
      : distribute(teams, config.groupCount, config.distribution);

    preview = { signature, config, groups, generatedAt: Date.now() };
    return preview;
  }

  function roundRobin(teams, turns = 1) {
    const source = [...teams];
    if (source.length % 2) source.push(null);
    const size = source.length;
    const firstTurn = [];
    let rotation = [...source];

    for (let round = 1; round < size; round += 1) {
      const matches = [];
      for (let index = 0; index < size / 2; index += 1) {
        let home = rotation[index];
        let away = rotation[size - 1 - index];
        if (!home || !away) continue;
        if ((round + index) % 2 === 0) [home, away] = [away, home];
        matches.push({ home, away, round, turn: 1 });
      }
      firstTurn.push(...matches);
      rotation = [rotation[0], rotation[size - 1], ...rotation.slice(1, size - 1)];
    }

    if (turns === 1) return firstTurn;
    const roundOffset = size - 1;
    return [
      ...firstTurn,
      ...firstTurn.map(match => ({
        home: match.away,
        away: match.home,
        round: match.round + roundOffset,
        turn: 2
      }))
    ];
  }

  function baseGame(id, phase, position, home, away, note) {
    const now = Date.now();
    return {
      id,
      tieId: id,
      leg: 1,
      phase,
      pos: position,
      status: 'Agendado',
      ta: home,
      tb: away,
      a: '',
      b: '',
      pa: '',
      pb: '',
      wo: 'none',
      date: '',
      time: '',
      place: '',
      note,
      created: now + position,
      updated: now + position
    };
  }

  function scheduleFromPreview(data) {
    const stamp = Date.now().toString(36);
    const competitionSlug = slug(tournamentId);
    const output = [];
    let position = 0;

    data.groups.forEach((group, groupIndex) => {
      const schedule = roundRobin(group, data.config.legs);
      schedule.forEach((match, matchIndex) => {
        position += 1;
        const label = data.config.mode === 'league' ? 'Classificação geral' : groupLabel(groupIndex);
        const phase = data.config.mode === 'league'
          ? `Rodada ${match.round}`
          : `${label} • Rodada ${match.round}`;
        const turnLabel = match.turn === 2 ? 'Returno' : data.config.legs === 2 ? 'Turno' : 'Jogo único';
        const prefix = data.config.mode === 'league' ? 'liga' : 'grupo';
        const id = `${prefix}-${competitionSlug}-${stamp}-${groupIndex + 1}-${match.round}-${matchIndex + 1}`;
        output.push(baseGame(id, phase, position, match.home, match.away, `${label} • ${turnLabel}`));
      });
    });

    return output;
  }

  function isGeneratedGame(game) {
    return /^(grupo|liga|mata)-/.test(String(game?.id || ''));
  }

  function saveBackup() {
    const all = read(BACKUP_KEY, {});
    all[tournamentId] = {
      savedAt: Date.now(),
      games: matchStore()[tournamentId] || [],
      tournament: tournament()
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(all));
  }

  async function cloudSave(games) {
    if (!isAdmin() || !window.firebase || typeof firebase.firestore !== 'function') return;
    try {
      await firebase.firestore().collection('arenaData').doc(`confrontos-${tournamentId}`).set({
        dataset: 'confrontos',
        tournamentId,
        games,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: String(currentUser.email || '').toLowerCase()
      });
    } catch (error) {
      console.error(error);
      notify(String(error?.code || '').includes('permission-denied')
        ? 'Publique as regras atualizadas do Firestore'
        : 'Os jogos foram salvos localmente, mas a nuvem falhou');
    }
  }

  function saveTournamentConfig(data, extra = {}) {
    const list = tournaments();
    const index = list.findIndex(item => item.id === tournamentId);
    if (index < 0) return;

    const groups = data.groups.map((teams, groupIndex) => ({
      name: data.config.mode === 'league' ? 'Classificação geral' : groupLabel(groupIndex),
      teams
    }));

    list[index] = {
      ...list[index],
      format: data.config.mode === 'league'
        ? (data.config.legs === 2 ? 'Turno e returno' : 'Pontos corridos')
        : 'Grupos + mata-mata',
      status: list[index].status === 'Finalizado' ? 'Em andamento' : list[index].status,
      phase: data.config.mode === 'league' ? 'Liga em andamento' : 'Fase de grupos',
      groupGenerator: {
        ...list[index].groupGenerator,
        ...data.config,
        groups,
        generatedAt: Date.now(),
        knockoutGenerated: false,
        ...extra
      }
    };

    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
  }

  async function generateSchedule() {
    if (!isAdmin() || saving) return;
    const teams = participants();
    if (teams.length < 2) {
      notify('Cadastre pelo menos 2 times no campeonato');
      return;
    }

    const data = buildPreview();
    if (data.config.mode === 'groups') {
      const smallest = Math.min(...data.groups.map(group => group.length));
      if (smallest < 2) {
        notify('Cada grupo precisa ter pelo menos 2 times');
        return;
      }
      if (data.config.qualifiers >= smallest) {
        notify('O número de classificados deve ser menor que o número de times por grupo');
        return;
      }
    }

    const store = matchStore();
    const current = Array.isArray(store[tournamentId]) ? store[tournamentId] : [];
    const generatedWithResults = current.some(game => isGeneratedGame(game) && finished(game));
    if (generatedWithResults && !confirm('Existem jogos gerados com resultados. Deseja substituir a tabela?')) return;

    saving = true;
    try {
      saveBackup();
      const preserved = current.filter(game => !isGeneratedGame(game));
      const generated = scheduleFromPreview(data);
      const games = [...preserved, ...generated];
      store[tournamentId] = games;
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));
      saveTournamentConfig(data);
      await cloudSave(games);
      notify(`${generated.length} jogos gerados sem confrontos repetidos`);
      active = false;
      $('#giManager [data-tab="games"]')?.click();
      setTimeout(() => location.reload(), 650);
    } finally {
      saving = false;
    }
  }

  function finished(game) {
    return ['a', 'b'].includes(game?.wo) || (numeric(game?.a) && numeric(game?.b));
  }

  function score(game, side) {
    if (game.wo === 'a') return side === 'a' ? 3 : 0;
    if (game.wo === 'b') return side === 'b' ? 3 : 0;
    return Number(side === 'a' ? game.a : game.b);
  }

  function parseGroup(phase) {
    const match = String(phase || '').match(/Grupo\s+([A-Z0-9]+)/i);
    return match ? `Grupo ${match[1].toUpperCase()}` : '';
  }

  function standings() {
    const settings = tournament()?.groupGenerator;
    const configuredGroups = Array.isArray(settings?.groups) ? settings.groups : [];
    const groupGames = (matchStore()[tournamentId] || []).filter(game => parseGroup(game.phase));
    const result = new Map();

    configuredGroups.forEach(group => {
      const table = new Map();
      (group.teams || []).forEach(team => table.set(norm(team), {
        name: team, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0
      }));
      result.set(group.name, table);
    });

    groupGames.forEach(game => {
      const groupName = parseGroup(game.phase);
      if (!result.has(groupName)) result.set(groupName, new Map());
      const table = result.get(groupName);
      [game.ta, game.tb].forEach(team => {
        const key = norm(team);
        if (!table.has(key)) table.set(key, { name: team, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 });
      });
      if (!finished(game)) return;

      const a = table.get(norm(game.ta));
      const b = table.get(norm(game.tb));
      const sa = score(game, 'a');
      const sb = score(game, 'b');
      a.j += 1; b.j += 1; a.gp += sa; a.gc += sb; b.gp += sb; b.gc += sa;
      if (sa > sb) { a.v += 1; b.d += 1; a.pts += 3; }
      else if (sb > sa) { b.v += 1; a.d += 1; b.pts += 3; }
      else { a.e += 1; b.e += 1; a.pts += 1; b.pts += 1; }
    });

    const groups = [];
    result.forEach((table, name) => {
      const rows = [...table.values()].map(row => ({ ...row, sg: row.gp - row.gc }))
        .sort((a, b) => b.pts - a.pts || b.v - a.v || b.sg - a.sg || b.gp - a.gp || a.name.localeCompare(b.name, 'pt-BR'));
      groups.push({ name, rows });
    });

    return {
      groups,
      games: groupGames,
      complete: groupGames.length > 0 && groupGames.every(finished)
    };
  }

  function knockoutPhase(teamCount) {
    return ({ 32: '16 avos de final', 16: 'Oitavas de final', 8: 'Quartas de final', 4: 'Semifinal', 2: 'Final' })[teamCount] || '';
  }

  function pairQualifiers(entries) {
    const remaining = [...entries].sort((a, b) => a.rank - b.rank || a.group.localeCompare(b.group, 'pt-BR'));
    const pairs = [];

    function solve(pool, output) {
      if (!pool.length) return output;
      const first = pool[0];
      const candidates = pool.slice(1).map((entry, index) => ({ entry, index: index + 1 }))
        .sort((a, b) => {
          const aSame = a.entry.group === first.group ? 1 : 0;
          const bSame = b.entry.group === first.group ? 1 : 0;
          return aSame - bSame || b.entry.rank - a.entry.rank;
        });

      for (const candidate of candidates) {
        if (candidate.entry.group === first.group && pool.some(item => item.group !== first.group && item !== first)) continue;
        const next = pool.filter((_, index) => index !== 0 && index !== candidate.index);
        const result = solve(next, [...output, [first, candidate.entry]]);
        if (result) return result;
      }
      return null;
    }

    return solve(remaining, pairs) || [];
  }

  function buildKnockoutGames(pairs) {
    const competitionSlug = slug(tournamentId);
    const stamp = Date.now().toString(36);
    const output = [];
    let entrants = pairs.length * 2;
    let roundIds = [];
    let position = 0;
    const firstPhase = knockoutPhase(entrants);

    pairs.forEach((pair, index) => {
      position += 1;
      const id = `mata-${competitionSlug}-${stamp}-1-${index + 1}`;
      roundIds.push(id);
      output.push(baseGame(id, firstPhase, index + 1, pair[0].name, pair[1].name, 'Classificados da fase de grupos'));
    });

    let round = 2;
    entrants = pairs.length;
    while (entrants >= 2) {
      const phase = knockoutPhase(entrants);
      const nextIds = [];
      for (let index = 0; index < roundIds.length; index += 2) {
        position += 1;
        const id = `mata-${competitionSlug}-${stamp}-${round}-${index / 2 + 1}`;
        nextIds.push(id);
        output.push(baseGame(
          id,
          phase,
          index / 2 + 1,
          `Vencedor ${roundIds[index]}`,
          `Vencedor ${roundIds[index + 1]}`,
          'Mata-mata automático'
        ));
      }
      roundIds = nextIds;
      entrants = roundIds.length;
      round += 1;
    }

    return output;
  }

  async function generateKnockout() {
    if (!isAdmin() || saving) return;
    const settings = tournament()?.groupGenerator;
    if (settings?.mode !== 'groups') {
      notify('O mata-mata automático é exclusivo da fase de grupos');
      return;
    }

    const table = standings();
    if (!table.complete) {
      notify('Finalize todos os jogos da fase de grupos primeiro');
      return;
    }

    const qualifiers = Number(settings.qualifiers) || 2;
    const entries = table.groups.flatMap(group => group.rows.slice(0, qualifiers).map((row, index) => ({
      name: row.name,
      group: group.name,
      rank: index + 1
    })));
    const total = entries.length;
    if (![4, 8, 16, 32].includes(total)) {
      notify('O total de classificados precisa ser 4, 8, 16 ou 32');
      return;
    }

    const pairs = pairQualifiers(entries);
    if (pairs.length * 2 !== total) {
      notify('Não foi possível montar os confrontos sem repetir grupos');
      return;
    }

    saving = true;
    try {
      saveBackup();
      const store = matchStore();
      const current = Array.isArray(store[tournamentId]) ? store[tournamentId] : [];
      const preserved = current.filter(game => !String(game.id || '').startsWith('mata-'));
      const knockout = buildKnockoutGames(pairs);
      const games = [...preserved, ...knockout];
      store[tournamentId] = games;
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));

      const list = tournaments();
      const index = list.findIndex(item => item.id === tournamentId);
      if (index >= 0) {
        list[index] = {
          ...list[index],
          status: 'Em andamento',
          phase: knockout[0]?.phase || 'Mata-mata',
          groupGenerator: {
            ...list[index].groupGenerator,
            knockoutGenerated: true,
            knockoutGeneratedAt: Date.now()
          }
        };
        localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      }

      await cloudSave(games);
      notify(`${knockout.length} jogos do mata-mata criados automaticamente`);
      active = false;
      setTimeout(() => location.reload(), 650);
    } finally {
      saving = false;
    }
  }

  async function restoreBackup() {
    if (!isAdmin() || saving) return;
    const backup = read(BACKUP_KEY, {})[tournamentId];
    if (!backup || !confirm('Restaurar a tabela anterior deste campeonato?')) return;

    saving = true;
    try {
      const store = matchStore();
      store[tournamentId] = backup.games || [];
      localStorage.setItem(MATCH_KEY, JSON.stringify(store));

      const list = tournaments();
      const index = list.findIndex(item => item.id === tournamentId);
      if (index >= 0 && backup.tournament) list[index] = backup.tournament;
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      await cloudSave(store[tournamentId]);
      notify('Último backup restaurado');
      setTimeout(() => location.reload(), 650);
    } finally {
      saving = false;
    }
  }

  function gamesCount(data) {
    return data.groups.reduce((total, group) => {
      const singleTurn = group.length * (group.length - 1) / 2;
      return total + singleTurn * data.config.legs;
    }, 0);
  }

  function groupCards(data) {
    return `<div class="league-groups-preview">${data.groups.map((group, index) => {
      const name = data.config.mode === 'league' ? 'Classificação geral' : groupLabel(index);
      return `<article><header><span>${data.config.mode === 'league' ? '🏟️' : String.fromCharCode(65 + index)}</span><div><b>${esc(name)}</b><small>${group.length} times</small></div></header><ol>${group.map(team => `<li>${esc(team)}</li>`).join('')}</ol></article>`;
    }).join('')}</div>`;
  }

  function knockoutStatus() {
    const settings = tournament()?.groupGenerator;
    if (settings?.mode !== 'groups') return '';
    const table = standings();
    const qualifiers = Number(settings.qualifiers) || 2;
    const total = (settings.groups || []).length * qualifiers;
    const compatible = [4, 8, 16, 32].includes(total);
    const finishedCount = table.games.filter(finished).length;
    const percent = table.games.length ? Math.round(finishedCount / table.games.length * 100) : 0;

    return `<section class="league-knockout-card">
      <div><span class="eyebrow">Próxima fase</span><h3>Mata-mata automático</h3><p>Os classificados são ordenados pela tabela e cruzados evitando adversários do mesmo grupo na primeira fase.</p></div>
      <aside><b>${finishedCount}/${table.games.length}</b><span>jogos finalizados</span><div><i style="width:${percent}%"></i></div></aside>
      <footer>
        <span>${compatible ? `${total} classificados • ${knockoutPhase(total)}` : `${total} classificados • ajuste para 4, 8, 16 ou 32`}</span>
        <button class="primary" data-generate-knockout ${table.complete && compatible ? '' : 'disabled'}>Gerar mata-mata</button>
      </footer>
    </section>`;
  }

  function panelHtml() {
    const teams = participants();
    const old = storedConfig();
    const hasBackup = Boolean(read(BACKUP_KEY, {})[tournamentId]);
    const data = buildPreview();
    const maxGroups = Math.max(2, Math.min(8, Math.floor(teams.length / 2) || 2));

    return `<div class="league-generator-head">
      <div><span class="eyebrow">Ferramenta administrativa</span><h2>Gerador de grupos e ligas</h2><p>Distribua os times, crie todas as rodadas e transforme a classificação em mata-mata.</p></div>
      <aside><b>${teams.length}</b><span>participantes</span><small>${gamesCount(data)} jogos previstos</small></aside>
    </div>

    ${teams.length < 2 ? '<div class="league-empty"><b>Faltam participantes</b><span>Adicione pelo menos dois clubes ao campeonato.</span></div>' : `
      <section class="league-config-card">
        <div class="league-config-grid">
          <label>Formato<select id="leagueMode"><option value="groups" ${old.mode === 'groups' ? 'selected' : ''}>Grupos + mata-mata</option><option value="league" ${old.mode === 'league' ? 'selected' : ''}>Liga / pontos corridos</option></select></label>
          <label class="league-group-field">Quantidade de grupos<input id="leagueGroupCount" type="number" min="2" max="${maxGroups}" value="${Math.min(old.groupCount, maxGroups)}"></label>
          <label class="league-group-field">Classificados por grupo<select id="leagueQualifiers"><option value="1" ${old.qualifiers === 1 ? 'selected' : ''}>1</option><option value="2" ${old.qualifiers === 2 ? 'selected' : ''}>2</option><option value="3" ${old.qualifiers === 3 ? 'selected' : ''}>3</option><option value="4" ${old.qualifiers === 4 ? 'selected' : ''}>4</option></select></label>
          <label>Turnos<select id="leagueLegs"><option value="1" ${old.legs === 1 ? 'selected' : ''}>Turno único</option><option value="2" ${old.legs === 2 ? 'selected' : ''}>Turno e returno</option></select></label>
          <label>Distribuição<select id="leagueDistribution"><option value="random" ${old.distribution === 'random' ? 'selected' : ''}>Sorteio aleatório</option><option value="serpentine" ${old.distribution === 'serpentine' ? 'selected' : ''}>Serpentina equilibrada</option></select></label>
        </div>
        <div class="league-config-actions"><button class="ghost" data-preview-groups>🎲 Sortear novamente</button><button class="primary" data-generate-schedule>Gerar grupos e rodadas</button></div>
      </section>

      <div class="league-preview-head"><div><span class="eyebrow">Prévia da distribuição</span><h3>${data.config.mode === 'league' ? 'Liga completa' : `${data.groups.length} grupos`}</h3></div><span>${gamesCount(data)} partidas • ${data.config.legs === 2 ? 'turno e returno' : 'turno único'}</span></div>
      ${groupCards(data)}
      ${knockoutStatus()}
      <div class="league-safety"><span>🛡️ Um backup é criado antes de substituir a tabela.</span><button class="ghost" data-restore-generator ${hasBackup ? '' : 'disabled'}>Restaurar último backup</button></div>
    `}`;
  }

  function bindPanel() {
    const panel = $('#leagueGeneratorPanel');
    if (!panel) return;
    panel.innerHTML = panelHtml();
    toggleGroupFields();
  }

  function toggleGroupFields() {
    const groupsMode = ($('#leagueMode')?.value || 'groups') === 'groups';
    $$('.league-group-field').forEach(field => field.hidden = !groupsMode);
  }

  function activate() {
    const standingsPanel = $('#autoStandings');
    if (standingsPanel && !standingsPanel.hidden) {
      $('#giManager [data-tab="games"]')?.click();
      setTimeout(activate, 90);
      return;
    }

    active = true;
    const manager = $('#giManager');
    if (!manager) return;
    $$('#giManager > nav button').forEach(button => button.classList.toggle('active', button.hasAttribute('data-league-generator')));
    const content = $('.gi-content', manager);
    if (content) content.hidden = true;
    if (standingsPanel) standingsPanel.hidden = true;
    const panel = $('#leagueGeneratorPanel');
    if (panel) panel.hidden = false;
    preview = null;
    bindPanel();
  }

  function deactivate() {
    active = false;
    const panel = $('#leagueGeneratorPanel');
    if (panel) panel.hidden = true;
  }

  function ensure() {
    const manager = $('#giManager');
    if (!manager) return;
    const id = manager.dataset.tid || '';
    if (id !== tournamentId) {
      tournamentId = id;
      preview = null;
      active = false;
    }

    const nav = $(':scope > nav', manager);
    if (isAdmin() && nav && !$('[data-league-generator]', nav)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.leagueGenerator = 'true';
      button.textContent = 'Gerador';
      nav.append(button);
    }

    let panel = $('#leagueGeneratorPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'leagueGeneratorPanel';
      panel.hidden = true;
      manager.append(panel);
    }

    manager.classList.toggle('league-generator-active', active);
    if (active) {
      const content = $('.gi-content', manager);
      if (content) content.hidden = true;
      panel.hidden = false;
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-league-generator]')) {
      activate();
      return;
    }

    if (event.target.closest('#giManager > nav button:not([data-league-generator])')) {
      deactivate();
      return;
    }

    if (event.target.closest('[data-preview-groups]')) {
      preview = null;
      buildPreview(true);
      bindPanel();
      return;
    }

    if (event.target.closest('[data-generate-schedule]')) {
      generateSchedule();
      return;
    }

    if (event.target.closest('[data-generate-knockout]')) {
      generateKnockout();
      return;
    }

    if (event.target.closest('[data-restore-generator]')) {
      restoreBackup();
    }
  });

  document.addEventListener('change', event => {
    if (!event.target.closest('#leagueGeneratorPanel')) return;
    if (event.target.id === 'leagueMode') toggleGroupFields();
    if (['leagueMode', 'leagueGroupCount', 'leagueQualifiers', 'leagueLegs', 'leagueDistribution'].includes(event.target.id)) {
      const current = configFromUI();
      const old = tournament()?.groupGenerator || {};
      const list = tournaments();
      const index = list.findIndex(item => item.id === tournamentId);
      if (index >= 0) {
        list[index] = { ...list[index], groupGenerator: { ...old, ...current } };
        localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
      }
      preview = null;
      bindPanel();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    #giManager > nav{grid-template-columns:repeat(5,minmax(0,1fr))!important;overflow-x:auto}
    #leagueGeneratorPanel{margin-top:12px;text-align:left}
    #leagueGeneratorPanel[hidden]{display:none!important}
    .league-generator-head{position:relative;overflow:hidden;display:grid;grid-template-columns:1.35fr .65fr;gap:16px;align-items:end;padding:22px;border:1px solid var(--line-strong);border-radius:24px;background:radial-gradient(circle at 85% 0,rgba(242,215,125,.28),transparent 33%),linear-gradient(135deg,#17432b,#07130d 64%,#030806)}
    .league-generator-head:after{content:"LIGA";position:absolute;right:-12px;bottom:-35px;color:#fff1;font:900 130px/1 "Barlow Condensed",sans-serif}
    .league-generator-head>div,.league-generator-head aside{position:relative;z-index:1}.league-generator-head h2{margin:6px 0;font-size:clamp(32px,7vw,52px);text-transform:uppercase}.league-generator-head p{max-width:650px;margin:0;color:#cad6ce;font-size:10px;line-height:1.55}.league-generator-head aside{padding:14px;border:1px solid #f2d77d42;border-radius:17px;background:#0308068c}.league-generator-head aside b,.league-generator-head aside span,.league-generator-head aside small{display:block}.league-generator-head aside b{color:var(--gold-soft);font:900 38px/1 "Barlow Condensed",sans-serif}.league-generator-head aside span{font-size:8px;font-weight:900;text-transform:uppercase}.league-generator-head aside small{margin-top:6px;color:var(--muted);font-size:8px}
    .league-config-card{margin-top:11px;padding:15px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.league-config-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.league-config-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.league-config-actions button{min-height:40px}
    .league-preview-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:18px 0 9px}.league-preview-head h3{margin:4px 0 0;color:var(--gold-soft);font-size:25px;text-transform:uppercase}.league-preview-head>span{color:var(--muted);font-size:8px;text-transform:uppercase}
    .league-groups-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.league-groups-preview article{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.league-groups-preview header{display:flex;align-items:center;gap:9px;padding:11px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#173e29,#07100c)}.league-groups-preview header>span{display:grid;place-items:center;width:38px;height:38px;border:1px solid #f2d77d52;border-radius:12px;color:#171107;background:linear-gradient(145deg,var(--gold-soft),var(--gold));font-weight:900}.league-groups-preview header b,.league-groups-preview header small{display:block}.league-groups-preview header b{font-size:11px;text-transform:uppercase}.league-groups-preview header small{margin-top:3px;color:var(--muted);font-size:7px}.league-groups-preview ol{display:grid;gap:0;margin:0;padding:0;list-style:none;counter-reset:club}.league-groups-preview li{display:grid;grid-template-columns:25px 1fr;gap:8px;align-items:center;padding:9px 11px;border-bottom:1px solid var(--line);font-size:9px}.league-groups-preview li:last-child{border-bottom:0}.league-groups-preview li:before{counter-increment:club;content:counter(club);display:grid;place-items:center;width:24px;height:24px;border-radius:8px;color:var(--gold-soft);background:#ffffff08;font-size:8px;font-weight:900}
    .league-knockout-card{display:grid;grid-template-columns:1fr 190px;gap:14px;margin-top:13px;padding:16px;border:1px solid #f2d77d38;border-radius:20px;background:radial-gradient(circle at 90% 0,#f2d77d19,transparent 35%),linear-gradient(145deg,#112c1d,#050c08)}.league-knockout-card h3{margin:5px 0;font-size:26px;text-transform:uppercase}.league-knockout-card p{margin:0;color:var(--muted);font-size:9px;line-height:1.5}.league-knockout-card aside{align-self:center;padding:11px;border:1px solid var(--line);border-radius:13px;background:#03080680}.league-knockout-card aside b,.league-knockout-card aside span{display:block}.league-knockout-card aside b{color:var(--gold-soft);font:900 24px "Barlow Condensed",sans-serif}.league-knockout-card aside span{color:var(--muted);font-size:7px;text-transform:uppercase}.league-knockout-card aside div{overflow:hidden;height:6px;margin-top:8px;border-radius:999px;background:#ffffff0b}.league-knockout-card aside i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--green),var(--gold-soft))}.league-knockout-card footer{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.league-knockout-card footer span{color:var(--muted);font-size:8px;text-transform:uppercase}
    .league-safety{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px;padding:10px 12px;border:1px dashed var(--line-strong);border-radius:14px;color:var(--muted);font-size:8px}.league-safety button{min-height:36px}.league-empty{display:grid;place-items:center;gap:5px;min-height:180px;margin-top:12px;padding:24px;border:1px dashed var(--line-strong);border-radius:18px;color:var(--muted);text-align:center}.league-empty b{color:var(--text);font-size:12px}
    @media(max-width:850px){.league-config-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.league-generator-head{grid-template-columns:1fr}.league-knockout-card{grid-template-columns:1fr}.league-knockout-card footer{grid-column:auto}}
    @media(max-width:600px){#giManager>nav{grid-template-columns:repeat(5,minmax(94px,1fr))!important}.league-groups-preview{grid-template-columns:1fr}.league-config-actions,.league-knockout-card footer,.league-safety{display:grid}.league-config-actions button,.league-knockout-card footer button,.league-safety button{width:100%}.league-config-grid{grid-template-columns:1fr}.league-preview-head{display:grid}}
  `;
  document.head.append(style);

  if (window.firebase && typeof firebase.auth === 'function') {
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      ensure();
    });
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(ensure, 80);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensure();
})();
