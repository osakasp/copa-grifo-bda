(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueRepechage?.version >= 1) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const BACKUP_KEY = 'bda-v5-super-league-repechage-backup';

  const clone = value => JSON.parse(JSON.stringify(value));
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

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function tournament() {
    return tournaments().find(item => String(item?.id || '') === SUPER_LEAGUE_ID) || null;
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function runtime() {
    return window.ArenaBDASuperLeagueRuntimeFix || null;
  }

  function isAdmin() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.());
  }

  function notify(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else console.info(message);
  }

  function sortRows(a, b) {
    return b.pts - a.pts
      || b.v - a.v
      || b.sg - a.sg
      || b.gp - a.gp
      || a.name.localeCompare(b.name, 'pt-BR');
  }

  function slices() {
    const data = runtime()?.calculate?.();
    if (!Array.isArray(data) || data.length !== 4) return null;

    const leaders = [];
    const seconds = [];
    const thirds = [];

    data.forEach(group => {
      const rows = [...(group.rows || [])].sort(sortRows);
      if (rows[0]) leaders.push({ ...rows[0], group: group.name, groupRank: 1 });
      if (rows[1]) seconds.push({ ...rows[1], group: group.name, groupRank: 2 });
      if (rows[2]) thirds.push({ ...rows[2], group: group.name, groupRank: 3 });
    });

    return {
      groups: data,
      leaders: leaders.sort(sortRows).map((row, index) => ({ ...row, seed: index + 1 })),
      seconds: seconds.sort(sortRows).map((row, index) => ({ ...row, seed: index + 1 })),
      thirds: thirds.sort(sortRows).map((row, index) => ({ ...row, seed: index + 1 }))
    };
  }

  function isRepechageMode() {
    const rt = runtime();
    const groups = rt?.groups?.();
    return Number(rt?.qualifiers?.() || 0) === 3 && Array.isArray(groups) && groups.length === 4;
  }

  function groupStageComplete() {
    const data = runtime()?.calculate?.();
    if (!Array.isArray(data) || data.length !== 4) return false;
    return data.every(group => {
      const rows = Array.isArray(group.rows) ? group.rows : [];
      const expected = Math.max(0, rows.length - 1);
      return rows.length >= 3 && rows.every(row => Number(row.j || 0) >= expected);
    });
  }

  function permutations(list) {
    if (list.length <= 1) return [list];
    const result = [];
    list.forEach((item, index) => {
      const rest = [...list.slice(0, index), ...list.slice(index + 1)];
      permutations(rest).forEach(tail => result.push([item, ...tail]));
    });
    return result;
  }

  function bestAssignment(left, right, desiredSeed) {
    let best = null;
    permutations(right).forEach(order => {
      let score = 0;
      order.forEach((entry, index) => {
        if (entry.group === left[index].group) score += 10000;
        score += Math.abs(Number(entry.seed || 0) - desiredSeed(index));
      });
      if (!best || score < best.score) best = { score, order };
    });
    return best?.order || right;
  }

  function repechagePairs(data = slices()) {
    if (!data || data.seconds.length !== 4 || data.thirds.length !== 4) return [];
    const assignedThirds = bestAssignment(data.seconds, data.thirds, index => 4 - index);
    return data.seconds.map((second, index) => ({
      seed: index + 1,
      second,
      third: assignedThirds[index]
    }));
  }

  function quarterAssignments(data, pairs) {
    const pairEntries = pairs.map(pair => ({
      ...pair,
      group: '',
      groups: [pair.second.group, pair.third.group]
    }));
    let best = null;
    permutations(pairEntries).forEach(order => {
      let score = 0;
      order.forEach((pair, index) => {
        const leader = data.leaders[index];
        if (pair.groups.includes(leader.group)) score += 10000;
        score += Math.abs(Number(pair.seed || 0) - (4 - index));
      });
      if (!best || score < best.score) best = { score, order };
    });
    return data.leaders.map((leader, index) => ({ leader, pair: best?.order?.[index] || pairEntries[index] }));
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

  function buildKnockout() {
    const data = slices();
    if (!data) return [];
    const pairs = repechagePairs(data);
    if (pairs.length !== 4 || data.leaders.length !== 4) return [];

    const stamp = Date.now().toString(36);
    const prefix = `mata-super-league-${stamp}`;
    const games = [];

    const repGames = pairs.map((pair, index) => {
      const id = `${prefix}-rep-${index + 1}`;
      games.push(baseGame(
        id,
        'Repescagem',
        index + 1,
        pair.second.name,
        pair.third.name,
        `Repescagem • ${pair.second.seed}º melhor 2º x ${pair.third.seed}º melhor 3º`
      ));
      return { ...pair, gameId: id };
    });

    const quarters = quarterAssignments(data, repGames);
    const qfIds = [];
    quarters.forEach((entry, index) => {
      const id = `${prefix}-qf-${index + 1}`;
      qfIds.push(id);
      games.push(baseGame(
        id,
        'Quartas de final',
        index + 1,
        entry.leader.name,
        `Vencedor ${entry.pair.gameId}`,
        `Líder ${entry.leader.group} • direto às quartas`
      ));
    });

    const sfIds = [];
    [[qfIds[0], qfIds[1]], [qfIds[2], qfIds[3]]].forEach((pair, index) => {
      const id = `${prefix}-sf-${index + 1}`;
      sfIds.push(id);
      games.push(baseGame(
        id,
        'Semifinal',
        index + 1,
        `Vencedor ${pair[0]}`,
        `Vencedor ${pair[1]}`,
        'Mata-mata automático'
      ));
    });

    games.push(baseGame(
      `${prefix}-final`,
      'Final',
      1,
      `Vencedor ${sfIds[0]}`,
      `Vencedor ${sfIds[1]}`,
      'Final da BDA Super League'
    ));

    return games;
  }

  function saveBackup() {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({
        savedAt: Date.now(),
        games: clone(matchStore()[SUPER_LEAGUE_ID] || []),
        tournament: clone(tournament())
      }));
    } catch (error) {
      console.warn('[Arena BDA] Não foi possível salvar o backup da repescagem', error);
    }
  }

  function generateRepechage() {
    if (!isAdmin()) return notify('Apenas o administrador pode gerar a repescagem');
    if (!isRepechageMode()) return notify('Configure 3 classificados por grupo para usar a repescagem');
    if (!groupStageComplete()) return notify('Finalize todos os jogos da fase de grupos primeiro');

    const knockout = buildKnockout();
    if (knockout.length !== 11) return notify('Não foi possível montar a chave de repescagem');

    saveBackup();

    const store = matchStore();
    const current = Array.isArray(store[SUPER_LEAGUE_ID]) ? store[SUPER_LEAGUE_ID] : [];
    const preserved = current.filter(game => !String(game?.id || '').startsWith('mata-'));
    store[SUPER_LEAGUE_ID] = [...preserved, ...knockout];
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));

    const list = tournaments();
    const index = list.findIndex(item => String(item?.id || '') === SUPER_LEAGUE_ID);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        status: 'Em andamento',
        phase: 'Repescagem',
        groupGenerator: {
          ...(list[index].groupGenerator || {}),
          qualifiers: 3,
          knockoutGenerated: true,
          knockoutMode: 'third-place-repechage',
          repechageGeneratedAt: Date.now()
        }
      };
      localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
    }

    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail: { tournamentId: SUPER_LEAGUE_ID, reason: 'super-league-third-place-repechage' }
    }));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
      detail: { tournamentId: SUPER_LEAGUE_ID, reason: 'super-league-third-place-repechage' }
    }));

    notify('Repescagem criada: 4 jogos + quartas, semifinais e final');
    setTimeout(() => location.reload(), 650);
  }

  function efficiency(row) {
    return row.j ? Math.round((row.pts / (row.j * 3)) * 100) : 0;
  }

  function renderThirdPlaceRanking() {
    if (!isRepechageMode()) {
      document.getElementById('superLeagueThirdPlaceRanking')?.remove();
      return;
    }

    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    const panel = manager?.querySelector('#autoStandings');
    const capture = panel?.querySelector('#standCapture');
    const data = slices();
    if (!panel || panel.hidden || !capture || !data || data.thirds.length !== 4) return;

    const signature = JSON.stringify(data.thirds.map(row => [row.name, row.group, row.pts, row.j, row.v, row.sg, row.gp]));
    let section = document.getElementById('superLeagueThirdPlaceRanking');
    if (section?.dataset.signature === signature) return;
    if (!section) {
      section = document.createElement('section');
      section.id = 'superLeagueThirdPlaceRanking';
      section.className = 'stand-group sl-repechage-ranking';
      capture.appendChild(section);
    }

    section.dataset.signature = signature;
    section.innerHTML = `
      <header>
        <div><span class="eyebrow">Repescagem</span><h3>Classificação dos 3º colocados</h3></div>
        <span>4 clubes • todos na repescagem</span>
      </header>
      <p class="sl-repechage-note">Ranking para definir os cabeças de chave dos terceiros colocados. Critérios: pontos, vitórias, saldo de gols e gols marcados.</p>
      <div class="stand-scroll"><table>
        <thead><tr><th>#</th><th>Clube</th><th>Grupo</th><th>PTS</th><th>J</th><th>V</th><th>SG</th><th>GP</th><th>APR</th></tr></thead>
        <tbody>${data.thirds.map((row, index) => `<tr class="qualified">
          <td><b class="stand-pos">${index + 1}</b></td>
          <td><div class="stand-club"><span><b>${esc(row.name)}</b><small>3º colocado</small></span></div></td>
          <td>${esc(row.group)}</td><td class="stand-points">${row.pts}</td><td>${row.j}</td><td>${row.v}</td>
          <td class="${row.sg > 0 ? 'positive' : row.sg < 0 ? 'negative' : ''}">${row.sg > 0 ? '+' : ''}${row.sg}</td>
          <td>${row.gp}</td><td>${efficiency(row)}%</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  function patchCompetitionCopy() {
    if (!isRepechageMode()) return;
    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    if (!manager) return;

    const rule = manager.querySelector('#autoStandings .stand-rule');
    const ruleText = '1º de cada grupo vai direto às quartas. 2º e 3º disputam a repescagem. Ordem: pontos, vitórias, saldo de gols e gols marcados.';
    if (rule && rule.textContent !== ruleText) rule.textContent = ruleText;

    const overviewText = manager.querySelector('#superLeagueGroupsOverview .slg-overview-head p');
    const total = runtime()?.groups?.()?.reduce?.((sum, group) => sum + (group.teams?.length || 0), 0) || 0;
    const overview = `${total} clubes em 4 grupos. O líder vai direto às quartas; 2º e 3º colocados seguem para a repescagem.`;
    if (overviewText && overviewText.textContent !== overview) overviewText.textContent = overview;

    manager.querySelectorAll('#superLeagueGroupsOverview .slg-card header small').forEach(label => {
      if (label.textContent !== '1 direto + 2 repescagem') label.textContent = '1 direto + 2 repescagem';
    });
  }

  function patchGeneratorPanel() {
    if (!isRepechageMode()) return;
    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    const card = manager?.querySelector('.league-knockout-card');
    if (!card) return;

    const title = card.querySelector('h3');
    const description = card.querySelector('p');
    const footerText = card.querySelector('footer span');
    const button = card.querySelector('[data-generate-knockout]');
    const complete = groupStageComplete();

    if (title && title.textContent !== 'Repescagem + mata-mata') title.textContent = 'Repescagem + mata-mata';
    if (description) description.textContent = 'Os líderes avançam direto às quartas. Os 2º e 3º colocados disputam quatro jogos de repescagem, com cruzamento por campanha e evitando o mesmo grupo.';
    if (footerText) footerText.textContent = '12 classificados • 4 repescagens • 4 líderes direto às quartas';
    if (button) {
      button.disabled = !complete;
      if (button.textContent !== 'Gerar repescagem') button.textContent = 'Gerar repescagem';
    }
  }

  function ensureStyles() {
    if (document.getElementById('superLeagueRepechageStyles')) return;
    const style = document.createElement('style');
    style.id = 'superLeagueRepechageStyles';
    style.textContent = `
      #superLeagueThirdPlaceRanking{margin-top:14px;border-color:rgba(242,215,125,.26)!important;background:linear-gradient(145deg,rgba(31,25,8,.44),rgba(8,20,13,.96))!important}
      #superLeagueThirdPlaceRanking .sl-repechage-note{margin:0;padding:0 14px 12px;color:var(--muted);font-size:9px;line-height:1.5}
      #superLeagueThirdPlaceRanking th:nth-child(2),#superLeagueThirdPlaceRanking td:nth-child(2){min-width:190px}
      #superLeagueThirdPlaceRanking th:nth-child(3),#superLeagueThirdPlaceRanking td:nth-child(3){white-space:nowrap}
      @media(max-width:720px){#superLeagueThirdPlaceRanking table{min-width:720px}}
    `;
    document.head.append(style);
  }

  let frame = 0;
  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureStyles();
      renderThirdPlaceRanking();
      patchCompetitionCopy();
      patchGeneratorPanel();
    });
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-generate-knockout]');
    if (!button) return;
    const manager = button.closest('#giManager');
    if (manager?.dataset?.tid !== SUPER_LEAGUE_ID || !isRepechageMode()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    generateRepechage();
  }, true);

  ['arena:quick-score-saved','arena:matches-updated','arena:tournaments-updated','arena:bundle-loaded','arena:cloud-ready','arena:auth-changed']
    .forEach(type => window.addEventListener(type, refresh));
  window.addEventListener('storage', event => {
    if ([MATCH_KEY, TOURNAMENT_KEY].includes(event.key)) refresh();
  });

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDASuperLeagueRepechage = Object.freeze({
    version: 1,
    refresh,
    slices: () => clone(slices()),
    pairs: () => clone(repechagePairs()),
    buildKnockout: () => clone(buildKnockout()),
    generate: generateRepechage
  });

  refresh();
})();
