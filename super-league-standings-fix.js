(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueStandingsFix) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';

  const FALLBACK_GROUPS = Object.freeze([
    Object.freeze({ name: 'Grupo A', teams: Object.freeze(['CV Cruz BDA','Hellyeah BDA','Imortais FC BDA','BDA Golden FC','CR Flamengo','Vera Cruz Do Oeste PR BDA']) }),
    Object.freeze({ name: 'Grupo B', teams: Object.freeze(['Zombie BDA','Sport Recife BDA','São Paulo BDA','Nacional AC BDA','Imperial São Paulo BDA']) }),
    Object.freeze({ name: 'Grupo C', teams: Object.freeze(['Red Bull BDA','Independente FC BDA','Vasco Da Gama BDA','Esperança BDA','Florence Real BDA']) }),
    Object.freeze({ name: 'Grupo D', teams: Object.freeze(['Boca Juniors','Praia Grande Jogobugado BDA','Flamestre BDA','BDA URDLS','Isaías 55-6-7']) })
  ]);

  const ALIASES = Object.freeze({
    'CV Cruz BDA': ['CV CRUZ BDA'],
    'Hellyeah BDA': ['HELLYEAH BDA'],
    'Imortais FC BDA': ['IMORTAIS FC BDA'],
    'BDA Golden FC': ['BDA GOLDEN','BDA GOLDEN FC'],
    'CR Flamengo': ['CR FLAMENGO','CR FLAMENGO BDA'],
    'Vera Cruz Do Oeste PR BDA': ['VERA CRUZ DO OESTE PR BDA'],
    'Zombie BDA': ['ZOMBIE BDA','ZOMBIE FC BDA','Zombie FC BDA'],
    'Sport Recife BDA': ['SPORT RECIFE BDA'],
    'São Paulo BDA': ['SAO PAULO BDA','SÃO PAULO FC BDA','SAO PAULO FC BDA'],
    'Nacional AC BDA': ['NACIONAL AC BDA','NACIONAL FC BDA'],
    'Imperial São Paulo BDA': ['IMPERIAL SÃO PAULO BDA','IMPERIAL SAO PAULO BDA'],
    'Red Bull BDA': ['RED BULL BDA'],
    'Independente FC BDA': ['INDEPENDENTE FC BDA','INDEPENDENTE FC APOSENTADO BDA'],
    'Vasco Da Gama BDA': ['VASCO DA GAMA BDA'],
    'Esperança BDA': ['ESPERANÇA BDA','ESPERANCA BDA'],
    'Florence Real BDA': ['FLORENCE REAL BDA','FLORENCE REAL FC BDA'],
    'Boca Juniors': ['BOCA JUNIORS','BOCA JUNIORS BDA'],
    'Praia Grande Jogobugado BDA': ['PRAIA GRANDE JOGOBUGADO BDA','JOGOBUGADO BDA','JOGO BUGADO BDA'],
    'Flamestre BDA': ['FLAMESTRE BDA','FLAMESTRE FC DF BDA'],
    'BDA URDLS': ['BDA URDLS'],
    'Isaías 55-6-7': ['ISAIAS 55-6-7','ISAÍAS 55-6-7']
  });

  const token = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const aliasToCanonical = new Map();
  Object.entries(ALIASES).forEach(([canonical, aliases]) => {
    [canonical, ...aliases].forEach(name => aliasToCanonical.set(token(name), canonical));
  });

  function groups() {
    const source = window.ArenaBDASuperLeagueGuard?.groups;
    return Array.isArray(source) && source.length === 4 ? source : FALLBACK_GROUPS;
  }

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function canonicalName(name) {
    return aliasToCanonical.get(token(name)) || '';
  }

  function groupFor(name) {
    const canonical = canonicalName(name);
    if (!canonical) return '';
    for (const group of groups()) {
      if (group.teams.some(team => token(team) === token(canonical))) return group.name;
    }
    return '';
  }

  function rawGames() {
    const store = read(MATCH_KEY, {});
    const list = store && typeof store === 'object' ? store[SUPER_LEAGUE_ID] : [];
    return Array.isArray(list) ? list : [];
  }

  function teamList() {
    const value = read(TEAM_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function teamMeta(name) {
    const canonical = canonicalName(name) || name;
    return teamList().find(team => {
      const resolved = canonicalName(team?.name);
      return resolved ? token(resolved) === token(canonical) : token(team?.name) === token(canonical);
    }) || null;
  }

  function finished(game) {
    if (game?.wo === 'a' || game?.wo === 'b') return true;
    return game?.a !== '' && game?.a != null && !Number.isNaN(Number(game.a))
      && game?.b !== '' && game?.b != null && !Number.isNaN(Number(game.b));
  }

  function knockout(game) {
    const phase = token(game?.phase);
    return /(quart|semi|final|oitav|matamata|knockout|playoff)/.test(phase);
  }

  function score(game) {
    if (game?.wo === 'a') return [3, 0];
    if (game?.wo === 'b') return [0, 3];
    return [Number(game.a), Number(game.b)];
  }

  function blank(name) {
    return { name, pts:0, j:0, v:0, e:0, d:0, gp:0, gc:0, sg:0, last:[] };
  }

  function groupMatches() {
    const latestByPair = new Map();
    rawGames().forEach(game => {
      if (!finished(game) || knockout(game)) return;
      const home = canonicalName(game?.ta);
      const away = canonicalName(game?.tb);
      if (!home || !away) return;
      const homeGroup = groupFor(home);
      const awayGroup = groupFor(away);
      if (!homeGroup || homeGroup !== awayGroup) return;
      const pair = [token(home), token(away)].sort().join('|');
      const stamp = Number(game?.updated || game?.created || 0);
      const previous = latestByPair.get(pair);
      if (!previous || stamp >= previous.stamp) latestByPair.set(pair, { game, home, away, group: homeGroup, stamp });
    });
    return [...latestByPair.values()];
  }

  function calculate() {
    const result = groups().map(group => ({
      name: group.name,
      rows: group.teams.map(team => blank(team))
    }));
    const rowByTeam = new Map();
    const groupByName = new Map(result.map(group => [group.name, group]));
    result.forEach(group => group.rows.forEach(row => rowByTeam.set(token(row.name), row)));

    groupMatches()
      .sort((a,b) => a.stamp - b.stamp)
      .forEach(item => {
        const group = groupByName.get(item.group);
        const home = rowByTeam.get(token(item.home));
        const away = rowByTeam.get(token(item.away));
        if (!group || !home || !away) return;
        const [sa, sb] = score(item.game);
        home.j++; away.j++;
        home.gp += sa; home.gc += sb;
        away.gp += sb; away.gc += sa;
        if (sa > sb) {
          home.v++; away.d++; home.pts += 3;
          home.last.push('V'); away.last.push('D');
        } else if (sb > sa) {
          away.v++; home.d++; away.pts += 3;
          away.last.push('V'); home.last.push('D');
        } else {
          home.e++; away.e++; home.pts++; away.pts++;
          home.last.push('E'); away.last.push('E');
        }
      });

    result.forEach(group => {
      group.rows = group.rows
        .map(row => ({ ...row, sg: row.gp - row.gc, last: row.last.slice(-5) }))
        .sort((a,b) => b.pts-a.pts || b.v-a.v || b.sg-a.sg || b.gp-a.gp || a.name.localeCompare(b.name,'pt-BR'));
    });
    return result;
  }

  function badge(name) {
    const meta = teamMeta(name);
    if (meta?.badge) return `<span class="stand-badge"><img src="${esc(meta.badge)}" alt="Escudo de ${esc(name)}"></span>`;
    const code = meta?.code || name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
    return `<span class="stand-badge">${esc(code)}</span>`;
  }

  function form(last) {
    return last.length
      ? last.map(value => `<i data-result="${value}">${value}</i>`).join('')
      : '<span>–</span>';
  }

  function efficiency(row) {
    return row.j ? Math.round((row.pts / (row.j * 3)) * 100) : 0;
  }

  function table(group) {
    return `<section class="stand-group" data-canonical-group="${esc(group.name)}">
      <header><div><span class="eyebrow">Tabela oficial</span><h3>${esc(group.name)}</h3></div><span>2 classificam • ${group.rows.length} clubes</span></header>
      <div class="stand-scroll"><table><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>APR</th><th>Últimos</th></tr></thead><tbody>
      ${group.rows.map((row,index) => {
        const meta = teamMeta(row.name);
        return `<tr class="${index < 2 ? 'qualified' : ''}"><td><b class="stand-pos">${index+1}</b></td><td><div class="stand-club">${badge(row.name)}<span><b>${esc(row.name)}</b><small>${esc(meta?.master ? `Mestre ${meta.master}` : 'Clã BDA')}</small></span></div></td><td class="stand-points">${row.pts}</td><td>${row.j}</td><td>${row.v}</td><td>${row.e}</td><td>${row.d}</td><td>${row.gp}</td><td>${row.gc}</td><td class="${row.sg>0?'positive':row.sg<0?'negative':''}">${row.sg>0?'+':''}${row.sg}</td><td>${efficiency(row)}%</td><td><div class="stand-form">${form(row.last)}</div></td></tr>`;
      }).join('')}
      </tbody></table></div></section>`;
  }

  function highlights(groupData) {
    const played = groupData.flatMap(group => group.rows).filter(row => row.j > 0);
    if (!played.length) return '';
    const leader = [...played].sort((a,b) => b.pts-a.pts || b.sg-a.sg || b.gp-a.gp)[0];
    const attack = [...played].sort((a,b) => b.gp-a.gp || b.pts-a.pts)[0];
    const defense = [...played].sort((a,b) => a.gc-b.gc || b.j-a.j)[0];
    return `<div class="stand-highlights"><article><span>👑 Líder</span><b>${esc(leader.name)}</b><small>${leader.pts} pontos</small></article><article><span>⚽ Melhor ataque</span><b>${esc(attack.name)}</b><small>${attack.gp} gols</small></article><article><span>🛡 Melhor defesa</span><b>${esc(defense.name)}</b><small>${defense.gc} sofridos</small></article></div>`;
  }

  function canonicalContent() {
    const data = calculate();
    return `<div class="stand-head"><div><span class="eyebrow">Atualização instantânea</span><h2>Classificação oficial</h2><p>Somente os 4 grupos oficiais da BDA Super League. Os 2 melhores de cada grupo avançam.</p></div><button class="primary" id="standPhoto">📸 Foto da tabela</button></div>${highlights(data)}<div id="standCapture">${data.map(table).join('')}</div>`;
  }

  let frame = 0;
  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const manager = document.getElementById('giManager');
      if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
      const panel = document.getElementById('autoStandings');
      if (!panel || panel.hidden) return;
      const signature = JSON.stringify(groupMatches().map(item => [item.home,item.away,item.game?.a,item.game?.b,item.game?.wo,item.stamp]));
      const expected = `v1:${signature}`;
      if (panel.dataset.superLeagueCanonical === expected && panel.querySelectorAll('[data-canonical-group]').length === 4) return;
      panel.dataset.superLeagueCanonical = expected;
      panel.innerHTML = canonicalContent();
    });
  }

  function ensureStyles() {
    if (document.getElementById('superLeagueStandingsFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'superLeagueStandingsFixStyles';
    style.textContent = `
      #giManager[data-tid="${SUPER_LEAGUE_ID}"].stand-active #superLeagueGroupsOverview{display:none!important}
      #giManager[data-tid="${SUPER_LEAGUE_ID}"] #autoStandings .stand-group[data-canonical-group]{scroll-margin-top:92px}
      #giManager[data-tid="${SUPER_LEAGUE_ID}"] #autoStandings .stand-head p{max-width:620px}
    `;
    document.head.append(style);
  }

  ensureStyles();
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#giManager[data-tid="bda-super-league"] [data-standings-tab],#giManager[data-tid="bda-super-league"] [data-tab="standings"]')) {
      requestAnimationFrame(refresh);
    }
  }, true);

  ['arena:quick-score-saved','arena:matches-updated','arena:bundle-loaded','arena:cloud-ready','arena:tournaments-updated'].forEach(type => window.addEventListener(type, refresh));
  window.addEventListener('storage', event => { if (event.key === MATCH_KEY || event.key === TEAM_KEY) refresh(); });

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDASuperLeagueStandingsFix = Object.freeze({ version:1, refresh, calculate });
  refresh();
})();
