(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueRule?.version >= 1) return;

  const TID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const BACKUP_KEY = 'bda-v114-super-league-legacy-knockout-backup';
  const STYLE_ID = 'superLeagueDirectRuleStyles';
  const DIRECT_QUALIFIERS = 2;
  let refreshFrame = 0;

  const clone = value => JSON.parse(JSON.stringify(value));
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const signature = value => JSON.stringify(value);
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };

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

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function localGames() {
    const value = matchStore()[TID];
    return Array.isArray(value) ? value : [];
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function isKnockout(game) {
    const id = String(game?.id || '');
    const phase = norm(game?.phase);
    return id.startsWith('mata-super-league-')
      || /repesc|play-in|play in|prelim|quart|semi|\bfinal\b/.test(phase);
  }

  function hasLegacyPhase(game) {
    return /repesc|play-in|play in|prelim/.test(norm([
      game?.id,
      game?.phase,
      game?.note,
      game?.ta,
      game?.tb
    ].join(' ')));
  }

  function baseGame(id, phase, pos, home, away, note) {
    const created = 1760000000000 + pos;
    return {
      id,
      tieId: id,
      leg: 1,
      phase,
      pos,
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
      created,
      updated: created
    };
  }

  function directTemplate() {
    return [
      baseGame('mata-super-league-qf1', 'Quartas de final', 1, '1º Grupo A', '2º Grupo B', 'QF1'),
      baseGame('mata-super-league-qf2', 'Quartas de final', 2, '1º Grupo B', '2º Grupo A', 'QF2'),
      baseGame('mata-super-league-qf3', 'Quartas de final', 3, '1º Grupo C', '2º Grupo D', 'QF3'),
      baseGame('mata-super-league-qf4', 'Quartas de final', 4, '1º Grupo D', '2º Grupo C', 'QF4'),
      baseGame('mata-super-league-sf1', 'Semifinal', 1, 'Vencedor mata-super-league-qf1', 'Vencedor mata-super-league-qf3', 'SF1'),
      baseGame('mata-super-league-sf2', 'Semifinal', 2, 'Vencedor mata-super-league-qf2', 'Vencedor mata-super-league-qf4', 'SF2'),
      baseGame('mata-super-league-final', 'Final', 1, 'Vencedor mata-super-league-sf1', 'Vencedor mata-super-league-sf2', 'Final')
    ];
  }

  function reuseDirectGame(template, existing) {
    const current = existing.find(game => String(game?.id || '') === template.id);
    if (!current || hasLegacyPhase(current)) return template;
    return {
      ...template,
      ...current,
      id: template.id,
      tieId: template.id,
      phase: template.phase,
      pos: template.pos,
      note: current.note || template.note
    };
  }

  function normalizeGames(games) {
    const list = Array.isArray(games) ? games : [];
    const groupGames = list.filter(game => !isKnockout(game));
    const legacyStructure = list.some(game => isKnockout(game) && hasLegacyPhase(game));
    const direct = legacyStructure
      ? directTemplate()
      : directTemplate().map(game => reuseDirectGame(game, list));
    return [...groupGames, ...direct];
  }

  function migrateLegacyKnockout() {
    const current = localGames();
    if (!current.length) return false;
    const next = normalizeGames(current);
    if (signature(next) === signature(current)) return false;

    try {
      const legacy = current.filter(isKnockout);
      if (legacy.length) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: Date.now(), games: legacy }));
      }
    } catch {}

    const store = matchStore();
    store[TID] = next;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail: { tournamentId: TID, reason: 'super-league-direct-top2-migration', count: next.length }
    }));
    return true;
  }

  function resetKnockout(reason = 'super-league-groups-changed') {
    const current = localGames();
    const legacy = current.filter(isKnockout);
    const now = Date.now();
    const next = [
      ...current.filter(game => !isKnockout(game)),
      ...directTemplate().map((game, index) => ({ ...game, updated: now + index }))
    ];
    if (signature(next) === signature(current)) return false;

    try {
      if (legacy.length) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: now, reason, games: legacy }));
      }
    } catch {}

    const store = matchStore();
    store[TID] = next;
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail: { tournamentId: TID, reason, count: next.length }
    }));
    return true;
  }

  function sortedGroups() {
    const data = runtime()?.calculate?.();
    if (!Array.isArray(data) || data.length !== 4) return [];
    return data.map(group => ({
      ...group,
      rows: [...(group.rows || [])].sort((a, b) =>
        Number(b?.pts || 0) - Number(a?.pts || 0)
        || Number(b?.v || 0) - Number(a?.v || 0)
        || Number(b?.sg || 0) - Number(a?.sg || 0)
        || Number(b?.gp || 0) - Number(a?.gp || 0)
        || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'))
    }));
  }

  function groupsComplete() {
    const groups = sortedGroups();
    return groups.length === 4 && groups.every(group => {
      const expected = Math.max(0, group.rows.length - 1);
      return group.rows.length >= 2 && group.rows.every(row => Number(row?.j || 0) >= expected);
    });
  }

  function slices() {
    const groups = sortedGroups();
    if (groups.length !== 4) return null;
    return {
      groups,
      qualifiers: groups.flatMap(group => group.rows.slice(0, DIRECT_QUALIFIERS).map((row, index) => ({
        ...row,
        group: group.name,
        groupRank: index + 1
      })))
    };
  }

  function isPlaceholder(value) {
    return /^[12][ºo]\s+grupo\s+[a-d]$/i.test(String(value || '').trim());
  }

  function finalStructureExists(games = localGames()) {
    const knockout = (Array.isArray(games) ? games : []).filter(isKnockout);
    const quarters = knockout.filter(game => norm(game?.phase).includes('quart'));
    const semis = knockout.filter(game => norm(game?.phase).includes('semi'));
    const finals = knockout.filter(game => norm(game?.phase) === 'final');
    return quarters.length === 4
      && semis.length === 2
      && finals.length === 1
      && quarters.every(game => !isPlaceholder(game?.ta) && !isPlaceholder(game?.tb));
  }

  function samePair(game, home, away) {
    const current = [norm(game?.ta), norm(game?.tb)].sort().join('|');
    const expected = [norm(home), norm(away)].sort().join('|');
    return Boolean(current && current === expected);
  }

  function preserveResult(template, existing) {
    const current = existing.find(game => String(game?.id || '') === template.id && samePair(game, template.ta, template.tb));
    if (!current) return template;
    return {
      ...template,
      ...current,
      id: template.id,
      tieId: template.id,
      phase: template.phase,
      pos: template.pos,
      ta: template.ta,
      tb: template.tb,
      note: template.note
    };
  }

  function buildFinal(existing = localGames()) {
    const data = slices();
    if (!data || data.groups.some(group => group.rows.length < 2)) return [];
    const [a, b, c, d] = data.groups;
    const games = [
      baseGame('mata-super-league-qf1', 'Quartas de final', 1, a.rows[0].name, b.rows[1].name, '1º Grupo A x 2º Grupo B'),
      baseGame('mata-super-league-qf2', 'Quartas de final', 2, b.rows[0].name, a.rows[1].name, '1º Grupo B x 2º Grupo A'),
      baseGame('mata-super-league-qf3', 'Quartas de final', 3, c.rows[0].name, d.rows[1].name, '1º Grupo C x 2º Grupo D'),
      baseGame('mata-super-league-qf4', 'Quartas de final', 4, d.rows[0].name, c.rows[1].name, '1º Grupo D x 2º Grupo C'),
      baseGame('mata-super-league-sf1', 'Semifinal', 1, 'Vencedor mata-super-league-qf1', 'Vencedor mata-super-league-qf3', 'SF1'),
      baseGame('mata-super-league-sf2', 'Semifinal', 2, 'Vencedor mata-super-league-qf2', 'Vencedor mata-super-league-qf4', 'SF2'),
      baseGame('mata-super-league-final', 'Final', 1, 'Vencedor mata-super-league-sf1', 'Vencedor mata-super-league-sf2', 'Final')
    ];
    return games.map(game => preserveResult(game, existing));
  }

  function updateTournamentAfterGeneration() {
    const list = tournaments();
    const index = list.findIndex(item => String(item?.id || '') === TID);
    if (index < 0) return;
    const current = list[index] || {};
    const generator = {
      ...(current.groupGenerator || {}),
      qualifiers: DIRECT_QUALIFIERS,
      knockoutGenerated: true,
      knockoutMode: 'direct-top-2',
      knockoutGames: 7,
      knockoutGeneratedAt: Date.now()
    };
    delete generator.repechageQualifiers;
    delete generator.directQuarterfinalSeconds;
    delete generator.playInQualifiers;
    delete generator.repechageGeneratedAt;
    list[index] = {
      ...current,
      phase: 'Quartas de final',
      qualifiersPerGroup: DIRECT_QUALIFIERS,
      groupSettings: { ...(current.groupSettings || {}), qualifiersPerGroup: DIRECT_QUALIFIERS },
      groupGenerator: generator
    };
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
  }

  function generate() {
    if (!isAdmin()) return notify('Apenas o administrador pode gerar a fase final');
    if (!groupsComplete()) return notify('Finalize todos os jogos da fase de grupos primeiro');

    const current = localGames();
    const knockout = buildFinal(current);
    if (knockout.length !== 7) return notify('Não foi possível montar as quartas de final');

    const store = matchStore();
    store[TID] = [...current.filter(game => !isKnockout(game)), ...knockout];
    localStorage.setItem(MATCH_KEY, JSON.stringify(store));
    updateTournamentAfterGeneration();
    window.dispatchEvent(new CustomEvent('arena:matches-updated', {
      detail: { tournamentId: TID, reason: 'super-league-direct-quarterfinals-generated', count: knockout.length }
    }));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
      detail: { tournamentId: TID, reason: 'super-league-direct-top2' }
    }));
    notify('Quartas de final criadas com os 2 melhores de cada grupo');
    refresh();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #giManager[data-tid="${TID}"] #autoStandings>.arena-zone-legend:not(#superLeagueRuleLegend){display:none!important}
      #superLeagueRuleLegend{display:flex!important}
      #giManager[data-tid="${TID}"] #autoStandings .stand-group tbody>tr:nth-child(-n+2) .stand-pos{color:#041108!important;background:#4fdf8f!important}
      #giManager[data-tid="${TID}"] #autoStandings .stand-group tbody>tr:nth-child(n+3) .stand-pos{color:#728178!important;background:#111b15!important}
      #giManager[data-tid="${TID}"] #autoStandings .stand-group tbody>tr .stand-club small{display:none!important}
      #giManager[data-tid="${TID}"] #autoStandings .stand-group tbody>tr:nth-child(-n+2) .stand-club span::after{content:'Classificado';display:block!important;margin-top:3px;color:#69e69b!important;font-size:7px;font-weight:800}
    `;
    document.head.append(style);
  }

  function patchUi() {
    const manager = document.querySelector(`#giManager[data-tid="${TID}"]`);
    if (!manager) return;
    installStyles();
    document.getElementById('superLeagueSecondPlaceRanking')?.remove();
    document.getElementById('superLeagueThirdPlaceRanking')?.remove();

    const panel = manager.querySelector('#autoStandings');
    panel?.querySelectorAll('.stand-group').forEach(section => {
      const meta = section.querySelector(':scope > header > span');
      if (meta) {
        const clubs = (meta.textContent.match(/(\d+)\s*club/i) || [])[1];
        meta.textContent = `2 classificados${clubs ? ` • ${clubs} clubes` : ''}`;
      }
      [...section.querySelectorAll('tbody > tr:not(.arena-mobile-stat-detail)')]
        .forEach((row, index) => { row.dataset.zone = index < DIRECT_QUALIFIERS ? 'direct' : 'out'; });
    });

    if (panel) {
      let legend = panel.querySelector('#superLeagueRuleLegend');
      if (!legend) {
        legend = document.createElement('div');
        legend.id = 'superLeagueRuleLegend';
        legend.className = 'arena-zone-legend';
        (panel.querySelector('#standCapture') || panel.firstChild)?.before?.(legend);
      }
      legend.innerHTML = '<span class="qualified"><i></i>1º e 2º classificados</span><span><i></i>Demais eliminados</span>';
      const rule = panel.querySelector('.stand-rule');
      if (rule) rule.textContent = 'Os 2 melhores de cada grupo avançam diretamente às quartas de final. Desempate: pontos, vitórias, saldo de gols e gols marcados.';
    }

    const overview = manager.querySelector('#superLeagueGroupsOverview .slg-overview-head p');
    const total = runtime()?.groups?.()?.reduce?.((sum, group) => sum + (group.teams?.length || 0), 0) || 21;
    if (overview) overview.textContent = `${total} clubes em 4 grupos. Os 2 melhores de cada grupo avançam diretamente às quartas de final.`;
    manager.querySelectorAll('#superLeagueGroupsOverview .slg-card header small')
      .forEach(label => { label.textContent = '2 classificados'; });

    const card = manager.querySelector('.league-knockout-card');
    if (card) {
      const title = card.querySelector('h3');
      const description = card.querySelector('p');
      const footer = card.querySelector('footer span');
      const button = card.querySelector('[data-generate-knockout]');
      if (title) title.textContent = 'Quartas de final da Super League';
      if (description) description.textContent = 'Os 2 melhores de cada grupo avançam diretamente. Cruzamentos: A1 x B2, B1 x A2, C1 x D2 e D1 x C2.';
      if (footer) footer.textContent = '4 quartas • 2 semifinais • final';
      if (button) {
        button.hidden = !isAdmin();
        button.disabled = !groupsComplete() || finalStructureExists();
        button.textContent = finalStructureExists()
          ? 'Quartas geradas'
          : groupsComplete() ? 'Gerar quartas' : 'Aguardando fase de grupos';
      }
    }
  }

  function refresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      migrateLegacyKnockout();
      patchUi();
    });
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-generate-knockout],.arena-v4-generate-final');
    if (!button || button.closest('#giManager')?.dataset?.tid !== TID) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    generate();
  }, true);

  ['arena:bundle-loaded', 'arena:matches-updated', 'arena:quick-score-saved', 'arena:tournaments-updated', 'arena:cloud-ready', 'arena:auth-changed']
    .forEach(type => window.addEventListener(type, refresh));
  window.addEventListener('storage', event => {
    if ([MATCH_KEY, TOURNAMENT_KEY].includes(event.key)) refresh();
  });

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDASuperLeagueRule = Object.freeze({
    version: 1,
    qualifiers: DIRECT_QUALIFIERS,
    refresh,
    slices: () => clone(slices()),
    buildKnockout: () => clone(buildFinal()),
    generate,
    groupsComplete,
    finalStructureExists,
    normalizeGames,
    resetKnockout
  });

  migrateLegacyKnockout();
  refresh();
})();
