(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueRuntimeFix?.version >= 4) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';
  const CONFIG_VERSION = 2;
  const DEFAULT_QUALIFIERS = 2;

  const DEFAULT_GROUPS = Object.freeze([
    Object.freeze({ name:'Grupo A', teams:Object.freeze(['CV Cruz BDA','Hellyeah BDA','Imortais FC BDA','BDA Golden FC','CR Flamengo','Vera Cruz Do Oeste PR BDA']) }),
    Object.freeze({ name:'Grupo B', teams:Object.freeze(['Zombie FC BDA','Sport Recife BDA','São Paulo BDA','Nacional AC BDA','Imperial São Paulo BDA']) }),
    Object.freeze({ name:'Grupo C', teams:Object.freeze(['Red Bull BDA','Independente FC BDA','Vasco Da Gama BDA','Esperança BDA','Florence Real BDA']) }),
    Object.freeze({ name:'Grupo D', teams:Object.freeze(['Boca Juniors','Praia Grande Jogobugado BDA','Flamestre BDA','BDA URDLS','Isaías 55-6-7']) })
  ]);

  const ALIASES = Object.freeze({
    'CV Cruz BDA':['CV CRUZ BDA'],
    'Hellyeah BDA':['HELLYEAH BDA'],
    'Imortais FC BDA':['IMORTAIS FC BDA'],
    'BDA Golden FC':['BDA GOLDEN','BDA GOLDEN FC'],
    'CR Flamengo':['CR FLAMENGO','CR FLAMENGO BDA'],
    'Vera Cruz Do Oeste PR BDA':['VERA CRUZ DO OESTE PR BDA'],
    'Zombie FC BDA':['ZOMBIE FC BDA','Zombie FC BDA','ZOMBIE BDA','Zombie BDA'],
    'Sport Recife BDA':['SPORT RECIFE BDA'],
    'São Paulo BDA':['SAO PAULO BDA','SÃO PAULO FC BDA','SAO PAULO FC BDA'],
    'Nacional AC BDA':['NACIONAL AC BDA','NACIONAL FC BDA'],
    'Imperial São Paulo BDA':['IMPERIAL SÃO PAULO BDA','IMPERIAL SAO PAULO BDA'],
    'Red Bull BDA':['RED BULL BDA'],
    'Independente FC BDA':['INDEPENDENTE FC BDA','INDEPENDENTE FC APOSENTADO BDA'],
    'Vasco Da Gama BDA':['VASCO DA GAMA BDA'],
    'Esperança BDA':['ESPERANÇA BDA','ESPERANCA BDA'],
    'Florence Real BDA':['FLORENCE REAL BDA','FLORENCE REAL FC BDA'],
    'Boca Juniors':['BOCA JUNIORS','BOCA JUNIORS BDA'],
    'Praia Grande Jogobugado BDA':['PRAIA GRANDE JOGOBUGADO BDA','JOGOBUGADO BDA','JOGO BUGADO BDA'],
    'Flamestre BDA':['FLAMESTRE BDA','FLAMESTRE FC DF BDA'],
    'BDA URDLS':['BDA URDLS'],
    'Isaías 55-6-7':['ISAIAS 55-6-7','ISAÍAS 55-6-7']
  });

  const clone = value => JSON.parse(JSON.stringify(value));
  const token = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'');

  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');

  function readTournamentList() {
    try {
      const value = JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function readTournament() {
    return readTournamentList().find(item => String(item?.id || '') === SUPER_LEAGUE_ID) || null;
  }

  function cleanGroups(source) {
    const groups = Array.isArray(source) ? source : [];
    const cleaned = groups
      .map((group,index) => ({
        name: String(group?.name || `Grupo ${String.fromCharCode(65 + index)}`).trim() || `Grupo ${String.fromCharCode(65 + index)}`,
        teams: [...new Set((Array.isArray(group?.teams) ? group.teams : [])
          .map(name => String(name || '').trim())
          .filter(Boolean))]
      }))
      .filter(group => group.teams.length);
    return cleaned.length ? cleaned : DEFAULT_GROUPS.map(group => ({ name:group.name, teams:[...group.teams] }));
  }

  function tournamentGroups(tournament = readTournament()) {
    return cleanGroups(
      tournament?.groupSettings?.groups
      || tournament?.groupGenerator?.groups
      || tournament?.settings?.groups
      || DEFAULT_GROUPS
    );
  }

  function qualifiers() {
    return DEFAULT_QUALIFIERS;
  }

  function configStamp(tournament) {
    return Number(tournament?.superLeagueConfigUpdatedAt || 0);
  }

  function hasUserConfig(tournament) {
    return Number(tournament?.superLeagueUserConfigVersion || 0) >= CONFIG_VERSION;
  }

  function buildTournament(base, groups, _q, stamp = 0) {
    const normalizedGroups = cleanGroups(groups);
    const participants = normalizedGroups.flatMap(group => group.teams);
    const safeQ = DEFAULT_QUALIFIERS;
    const description = `Full Razz • ${participants.length} clubes • ${safeQ} classificados por grupo. Campeão: R$ 20 • Vice: R$ 10.`;
    const next = {
      ...(base || {}),
      id: SUPER_LEAGUE_ID,
      name: 'BDA Super League',
      format: 'Grupos + mata-mata',
      maxTeams: participants.length,
      participants,
      description,
      qualifiersPerGroup: safeQ,
      rankingMode: 'efficiency',
      rankingTieBreakers: ['goalDifference','goalsFor'],
      superLeagueUserConfigVersion: CONFIG_VERSION,
      superLeagueConfigUpdatedAt: stamp,
      groupSettings: {
        ...((base || {}).groupSettings || {}),
        qualifiersPerGroup: safeQ,
        rankingMode: 'efficiency',
        tieBreakers: ['goalDifference','goalsFor'],
        groups: normalizedGroups
      },
      groupGenerator: {
        ...((base || {}).groupGenerator || {}),
        mode: 'groups',
        groupCount: normalizedGroups.length,
        qualifiers: safeQ,
        legs: 1,
        groups: normalizedGroups
      }
    };
    delete next.groupGenerator.repechageQualifiers;
    delete next.groupGenerator.directQuarterfinalSeconds;
    delete next.groupGenerator.playInQualifiers;
    delete next.groupGenerator.repechageGeneratedAt;
    if (next.groupGenerator.knockoutMode && next.groupGenerator.knockoutMode !== 'direct-top-2') {
      next.groupGenerator.knockoutMode = 'direct-top-2';
      next.groupGenerator.knockoutGenerated = false;
    }
    return next;
  }

  function chooseConfigSource(remote) {
    const local = readTournament();
    if (hasUserConfig(remote) && hasUserConfig(local)) return configStamp(remote) >= configStamp(local) ? remote : local;
    if (hasUserConfig(remote)) return remote;
    if (hasUserConfig(local)) return local;
    return null;
  }

  function canonicalizeTournament(remote = {}) {
    const source = chooseConfigSource(remote);
    if (source) return buildTournament(remote, tournamentGroups(source), DEFAULT_QUALIFIERS, configStamp(source));
    return buildTournament(remote, DEFAULT_GROUPS, DEFAULT_QUALIFIERS, 1);
  }

  function replaceGuardFacade() {
    const previous = window.ArenaBDASuperLeagueGuard || {};
    const current = readTournament();
    const nextGroups = tournamentGroups(current);
    const nextParticipants = nextGroups.flatMap(group => group.teams);
    window.ArenaBDASuperLeagueGuard = Object.freeze({
      ...previous,
      version: Math.max(Number(previous.version || 0), 6),
      groups: Object.freeze(nextGroups.map(group => Object.freeze({ name:group.name, teams:Object.freeze([...group.teams]) }))),
      participants: Object.freeze([...nextParticipants]),
      canonicalize: value => clone(canonicalizeTournament(value)),
      tournament: () => clone(canonicalizeTournament(readTournament() || {}))
    });
  }

  function ensureDefaultConfiguration() {
    const list = readTournamentList();
    const index = list.findIndex(item => String(item?.id || '') === SUPER_LEAGUE_ID);
    if (index < 0) return false;
    const current = list[index];
    const configuredQualifiers = Number(
      current?.qualifiersPerGroup
      ?? current?.groupSettings?.qualifiersPerGroup
      ?? current?.groupGenerator?.qualifiers
      ?? 0
    );
    if (hasUserConfig(current) && configuredQualifiers === DEFAULT_QUALIFIERS) {
      replaceGuardFacade();
      return false;
    }
    const next = [...list];
    next[index] = buildTournament(current, tournamentGroups(current), DEFAULT_QUALIFIERS, Math.max(1, configStamp(current)));
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(next));
    replaceGuardFacade();
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated', {
      detail:{ tournamentId:SUPER_LEAGUE_ID, reason:'super-league-direct-top2-default' }
    }));
    return true;
  }

  function aliasMap(groups = tournamentGroups()) {
    const map = new Map();
    groups.flatMap(group => group.teams).forEach(name => {
      map.set(token(name), name);
      (ALIASES[name] || []).forEach(alias => map.set(token(alias), name));
    });
    Object.entries(ALIASES).forEach(([canonical,aliases]) => {
      if (!map.has(token(canonical))) return;
      aliases.forEach(alias => map.set(token(alias), map.get(token(canonical))));
    });
    return map;
  }

  function canonicalName(name, groups = tournamentGroups()) {
    return aliasMap(groups).get(token(name)) || '';
  }

  function groupFor(name, groups = tournamentGroups()) {
    const canonical = canonicalName(name, groups) || name;
    return groups.find(group => group.teams.some(team => token(team) === token(canonical)))?.name || '';
  }

  function withConfiguredGroups(tournament) {
    if (!tournament || String(tournament.id || '') !== SUPER_LEAGUE_ID) return tournament;
    return canonicalizeTournament(tournament);
  }

  function patchValidMatches() {
    const current = window.ArenaBDAValidMatches;
    if (!current?.forTournament || current.__superLeagueRuntimeFixV4) return;
    const originalForTournament = current.forTournament.bind(current);
    const patchedForTournament = (tournament, games) => originalForTournament(withConfiguredGroups(tournament), games);
    const patched = {
      ...current,
      forTournament: patchedForTournament,
      forTournamentId(tournamentId, games, tournaments) {
        const tournament = (Array.isArray(tournaments) ? tournaments : []).find(item => String(item?.id) === String(tournamentId)) || null;
        return patchedForTournament(tournament, games);
      }
    };
    Object.defineProperty(patched,'__superLeagueRuntimeFixV4',{value:true});
    window.ArenaBDAValidMatches = Object.freeze(patched);
  }

  function isConfiguredGroupGame(game) {
    const groups = tournamentGroups();
    const homeGroup = groupFor(game?.ta, groups);
    const awayGroup = groupFor(game?.tb, groups);
    return Boolean(homeGroup && homeGroup === awayGroup);
  }

  function installMatchStorageGuard() {
    const previous = Storage.prototype.setItem;
    if (previous.__arenaSuperLeagueMatchGuardV3) return;
    const guarded = function(key,value) {
      let nextValue = value;
      if (this === localStorage && key === MATCH_KEY) {
        try {
          const nextStore = JSON.parse(String(value || '{}'));
          const oldStore = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
          const incoming = Array.isArray(nextStore?.[SUPER_LEAGUE_ID]) ? nextStore[SUPER_LEAGUE_ID] : null;
          const existing = Array.isArray(oldStore?.[SUPER_LEAGUE_ID]) ? oldStore[SUPER_LEAGUE_ID] : [];
          if (incoming && existing.length) {
            const incomingHasGroups = incoming.some(isConfiguredGroupGame);
            const existingGroups = existing.filter(isConfiguredGroupGame);
            if (!incomingHasGroups && existingGroups.length) {
              const incomingIds = new Set(incoming.map(game => String(game?.id || '')));
              nextStore[SUPER_LEAGUE_ID] = [
                ...existingGroups.filter(game => !incomingIds.has(String(game?.id || ''))),
                ...incoming
              ];
              nextValue = JSON.stringify(nextStore);
            }
          }
        } catch (error) {
          console.warn('[Arena BDA] Falha ao proteger jogos da Super League', error);
        }
      }
      return previous.call(this,key,nextValue);
    };
    Object.defineProperty(guarded,'__arenaSuperLeagueMatchGuardV3',{value:true});
    Storage.prototype.setItem = guarded;
  }

  let editProtectionUntil = 0;
  let scoreSyncPatched = false;
  function patchScoreSync() {
    const sync = window.ArenaBDAScoreSync;
    if (!sync?.isPending || scoreSyncPatched || sync.__arenaSuperLeagueScoreGuard) return;
    const original = sync.isPending.bind(sync);
    sync.isPending = tournamentId => original(tournamentId)
      || (String(tournamentId) === SUPER_LEAGUE_ID && Date.now() < editProtectionUntil);
    Object.defineProperty(sync,'__arenaSuperLeagueScoreGuard',{value:true});
    scoreSyncPatched = true;
  }

  function protectScoreEdit(event) {
    const target = event.target instanceof Element ? event.target.closest('#giManager .gi-score-input') : null;
    if (!target) return;
    if (target.closest('#giManager')?.dataset?.tid !== SUPER_LEAGUE_ID) return;
    editProtectionUntil = Date.now() + 4500;
    patchScoreSync();
  }

  function rawGames() {
    try {
      const store = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return Array.isArray(store?.[SUPER_LEAGUE_ID]) ? store[SUPER_LEAGUE_ID] : [];
    } catch {
      return [];
    }
  }

  function teams() {
    try {
      const value = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function teamMeta(name) {
    const key = token(name);
    const aliases = aliasMap();
    return teams().find(team => token(aliases.get(token(team?.name)) || team?.name) === key) || null;
  }

  const finished = game => ['a','b'].includes(game?.wo)
    || (game?.a !== '' && game?.a != null && game?.b !== '' && game?.b != null);
  const knockout = game => /quartas|oitavas|repescagem|preliminar|semifinal|semi-final|\bfinal\b|mata-super-league|qf\d|sf\d/i
    .test(`${game?.phase||''} ${game?.note||''} ${game?.id||''}`);
  const score = game => game?.wo === 'a' ? [3,0] : game?.wo === 'b' ? [0,3] : [Number(game?.a)||0,Number(game?.b)||0];
  const pairKey = (a,b) => [token(a),token(b)].sort().join('|');
  const blank = name => ({name,pts:0,j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,last:[]});

  function groupMatches() {
    const groups = tournamentGroups();
    const map = aliasMap(groups);
    const chosen = new Map();
    rawGames().forEach(game => {
      if (!finished(game) || knockout(game)) return;
      const home = map.get(token(game?.ta)) || '';
      const away = map.get(token(game?.tb)) || '';
      if (!home || !away) return;
      const homeGroup = groupFor(home, groups);
      if (!homeGroup || homeGroup !== groupFor(away, groups)) return;
      const key = pairKey(home,away);
      const stamp = Number(game?.updated || game?.created || 0);
      const current = chosen.get(key);
      if (!current || stamp >= current.stamp) chosen.set(key,{game,home,away,group:homeGroup,stamp});
    });
    return [...chosen.values()];
  }

  function sortRows(a,b) {
    return b.pts-a.pts || b.v-a.v || b.sg-a.sg || b.gp-a.gp || a.name.localeCompare(b.name,'pt-BR');
  }

  function calculate() {
    const groups = tournamentGroups();
    const result = groups.map(group => ({name:group.name,rows:group.teams.map(blank)}));
    const rowByTeam = new Map();
    result.forEach(group => group.rows.forEach(row => rowByTeam.set(token(row.name),row)));
    groupMatches().sort((a,b)=>a.stamp-b.stamp).forEach(item => {
      const home = rowByTeam.get(token(item.home));
      const away = rowByTeam.get(token(item.away));
      if (!home || !away) return;
      const [sa,sb] = score(item.game);
      home.j++; away.j++;
      home.gp+=sa; home.gc+=sb; away.gp+=sb; away.gc+=sa;
      if (sa>sb) { home.v++; away.d++; home.pts+=3; home.last.push('V'); away.last.push('D'); }
      else if (sb>sa) { away.v++; home.d++; away.pts+=3; away.last.push('V'); home.last.push('D'); }
      else { home.e++; away.e++; home.pts++; away.pts++; home.last.push('E'); away.last.push('E'); }
    });
    result.forEach(group => {
      group.rows = group.rows.map(row => ({...row,sg:row.gp-row.gc,last:row.last.slice(-5)})).sort(sortRows);
    });
    return result;
  }

  const efficiency = row => row.j ? Math.round((row.pts/(row.j*3))*100) : 0;
  const form = last => last.length ? last.map(value=>`<i data-result="${value}">${value}</i>`).join('') : '<span>–</span>';
  function badge(name) {
    const meta = teamMeta(name);
    if (meta?.badge) return `<span class="stand-badge"><img src="${esc(meta.badge)}" alt="Escudo de ${esc(name)}"></span>`;
    const code = meta?.code || name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    return `<span class="stand-badge">${esc(code)}</span>`;
  }

  function renderStandings() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
    const panel = document.getElementById('autoStandings');
    if (!panel || panel.hidden) return;

    const q = qualifiers();
    const data = calculate();
    const signature = JSON.stringify({
      groups:tournamentGroups(),
      q,
      games:groupMatches().map(item=>[item.home,item.away,item.game?.a,item.game?.b,item.game?.wo,item.stamp])
    });
    if (panel.dataset.superLeagueDynamicSignature === signature && panel.querySelector('[data-dynamic-super-league-standings]')) return;

    const highlights = (() => {
      const played = data.flatMap(group=>group.rows).filter(row=>row.j>0);
      if (!played.length) return '';
      const leader=[...played].sort(sortRows)[0];
      const attack=[...played].sort((a,b)=>b.gp-a.gp||b.pts-a.pts)[0];
      const defense=[...played].sort((a,b)=>a.gc-b.gc||b.j-a.j)[0];
      return `<div class="stand-highlights">
        <article><span>👑 Líder</span><b>${esc(leader.name)}</b><small>${leader.pts} pontos</small></article>
        <article><span>⚽ Melhor ataque</span><b>${esc(attack.name)}</b><small>${attack.gp} gols</small></article>
        <article><span>🛡 Melhor defesa</span><b>${esc(defense.name)}</b><small>${defense.gc} sofridos</small></article>
      </div>`;
    })();

    const tables = data.map(group => `<section class="stand-group" data-canonical-group="${esc(group.name)}">
      <header><div><span class="eyebrow">Tabela oficial</span><h3>${esc(group.name)}</h3></div><span>${q} classificam • ${group.rows.length} clubes</span></header>
      <div class="stand-scroll"><table>
        <thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>APR</th><th>Últimos</th></tr></thead>
        <tbody>${group.rows.map((row,index)=>{
          const meta=teamMeta(row.name);
          return `<tr class="${index<q?'qualified':''}">
            <td><b class="stand-pos">${index+1}</b></td>
            <td><div class="stand-club">${badge(row.name)}<span><b>${esc(row.name)}</b><small>${esc(meta?.master?`Mestre ${meta.master}`:'Clã BDA')}</small></span></div></td>
            <td class="stand-points">${row.pts}</td><td>${row.j}</td><td>${row.v}</td><td>${row.e}</td><td>${row.d}</td><td>${row.gp}</td><td>${row.gc}</td>
            <td class="${row.sg>0?'positive':row.sg<0?'negative':''}">${row.sg>0?'+':''}${row.sg}</td>
            <td>${efficiency(row)}%</td><td><div class="stand-form">${form(row.last)}</div></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`).join('');

    const canonicalSignature = panel.dataset.superLeagueCanonical || '';
    panel.innerHTML = `<div data-dynamic-super-league-standings>
      <div class="stand-head">
        <div><span class="eyebrow">Atualização instantânea</span><h2>Classificação oficial</h2>
        <div class="stand-rule">Ordem: pontos, vitórias, saldo de gols e gols marcados. Os ${q} primeiros de cada grupo avançam.</div></div>
        <button class="primary" id="standPhoto">📸 Foto da tabela</button>
      </div>${highlights}<div id="standCapture">${tables}</div>
    </div>`;
    panel.dataset.superLeagueDynamicSignature = signature;
    if (canonicalSignature) panel.dataset.superLeagueCanonical = canonicalSignature;
  }

  function renderGroupOverview() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
    const groups = tournamentGroups();
    const q = qualifiers();
    const total = groups.reduce((sum,group)=>sum+group.teams.length,0);
    let overview = document.getElementById('superLeagueGroupsOverview');
    if (!overview) {
      overview = document.createElement('section');
      overview.id = 'superLeagueGroupsOverview';
      const head = manager.querySelector('.gi-head');
      if (head?.parentNode) head.insertAdjacentElement('afterend',overview);
      else manager.prepend(overview);
    }
    const signature = JSON.stringify({groups,q});
    if (overview.dataset.dynamicSignature === signature && overview.querySelector('[data-super-league-dynamic-overview]')) return;
    const runtimeStaticSignature = overview.dataset.signature || JSON.stringify(window.ArenaBDASuperLeagueGuard?.groups || []);
    overview.innerHTML = `<div data-super-league-dynamic-overview>
      <div class="slg-overview-head">
        <div><span class="eyebrow">Fase de grupos</span><h3>Grupos da BDA Super League</h3>
        <p>${total} clubes em ${groups.length} grupos. Os ${q} melhores de cada grupo avançam às eliminatórias.</p></div>
        <div class="slg-actions">
          ${window.ArenaBDAAuth?.isAdmin?.()?'<button type="button" class="ghost" data-super-league-settings>⚙ Configurar</button>':''}
          <button type="button" class="primary" data-super-league-open-standings>Ver classificação</button>
        </div>
      </div>
      <div class="slg-grid">${groups.map(group=>`<article class="slg-card">
        <header><div><span>⚜️</span><strong>${esc(group.name)}</strong></div><small>${q} avançam</small></header>
        <ol>${group.teams.map((team,index)=>`<li><span>${index+1}</span><b>${esc(team)}</b></li>`).join('')}</ol>
      </article>`).join('')}</div>
    </div>`;
    overview.dataset.dynamicSignature = signature;
    overview.dataset.signature = runtimeStaticSignature;
  }

  function ensureStyles() {
    if (document.getElementById('superLeagueRuntimeFixStylesV3')) return;
    const style = document.createElement('style');
    style.id = 'superLeagueRuntimeFixStylesV3';
    style.textContent = `
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gip-card,
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gi-game,
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gi-score-input{transition:none!important;animation:none!important}
      #giManager[data-tid="${SUPER_LEAGUE_ID}"] #autoStandings:not([hidden]){display:block}
      #superLeagueGroupsOverview{margin:14px 0 12px;padding:16px;border:1px solid rgba(242,215,125,.18);border-radius:20px;background:linear-gradient(145deg,rgba(16,34,23,.96),rgba(4,11,7,.96));box-shadow:0 16px 42px rgba(0,0,0,.26)}
      #superLeagueGroupsOverview .slg-overview-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:13px}
      #superLeagueGroupsOverview .slg-overview-head h3{margin:4px 0 3px;color:var(--text);font:900 clamp(24px,5vw,34px)/.95 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.02em}
      #superLeagueGroupsOverview .slg-overview-head p{max-width:690px;margin:0;color:var(--muted);font-size:9px;line-height:1.5}
      #superLeagueGroupsOverview .slg-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      #superLeagueGroupsOverview .slg-actions button{min-height:40px;padding:0 13px}
      #superLeagueGroupsOverview .slg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #superLeagueGroupsOverview .slg-card{overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018))}
      #superLeagueGroupsOverview .slg-card header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(135deg,rgba(216,178,72,.11),rgba(79,223,143,.045))}
      #superLeagueGroupsOverview .slg-card header div{display:flex;align-items:center;gap:7px}
      #superLeagueGroupsOverview .slg-card header strong{color:var(--gold-soft);font:900 18px "Barlow Condensed",sans-serif;text-transform:uppercase}
      #superLeagueGroupsOverview .slg-card header small{padding:5px 7px;border:1px solid rgba(79,223,143,.18);border-radius:999px;color:var(--green);background:rgba(79,223,143,.07);font-size:7px;font-weight:900;text-transform:uppercase;white-space:nowrap}
      #superLeagueGroupsOverview .slg-card ol{list-style:none;margin:0;padding:6px 10px 9px}
      #superLeagueGroupsOverview .slg-card li{display:grid;grid-template-columns:27px minmax(0,1fr);align-items:center;gap:8px;min-height:38px;padding:5px 2px;border-bottom:1px solid rgba(255,255,255,.055)}
      #superLeagueGroupsOverview .slg-card li:last-child{border-bottom:0}
      #superLeagueGroupsOverview .slg-card li>span{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;color:#161006;background:linear-gradient(145deg,#f4dfa0,#c79a2e);font-size:8px;font-weight:900}
      #superLeagueGroupsOverview .slg-card li>b{overflow:hidden;color:#eaf1ec;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
      .sl-settings-modal{width:min(100%,640px)}
      .sl-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:14px}
      .sl-settings-grid textarea{min-height:132px;line-height:1.45;text-transform:none}
      .sl-settings-summary{margin-top:12px;padding:11px 12px;border:1px solid var(--line);border-radius:14px;color:var(--muted);background:rgba(255,255,255,.035);font-size:10px;line-height:1.5}
      .sl-settings-actions{display:flex;gap:9px;margin-top:14px}.sl-settings-actions button{flex:1}
      .cloud-panel-shortcuts [data-super-league-panel-settings]{border-color:rgba(242,215,125,.26);background:rgba(242,215,125,.07)}
      @media(max-width:680px){
        #superLeagueGroupsOverview{padding:13px}
        #superLeagueGroupsOverview .slg-overview-head{display:grid}
        #superLeagueGroupsOverview .slg-actions{display:grid;grid-template-columns:1fr 1fr}
        #superLeagueGroupsOverview .slg-actions button{width:100%}
        #superLeagueGroupsOverview .slg-grid,.sl-settings-grid{grid-template-columns:1fr}
      }
    `;
    document.head.append(style);
  }

  function ensureSettingsModal() {
    if (document.getElementById('superLeagueSettingsModal')) return;
    const modal = document.createElement('div');
    modal.id = 'superLeagueSettingsModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML = `<div class="modal sl-settings-modal">
      <div class="cloud-panel-head">
        <div><span class="eyebrow">Configurações da competição</span><h2>BDA Super League</h2></div>
        <button class="cloud-panel-close" type="button" data-sl-close aria-label="Fechar">×</button>
      </div>
      <p>Edite os participantes de cada grupo. A regra oficial mantém 2 classificados por grupo, com avanço direto às quartas de final.</p>
      <div class="sl-settings-grid" id="slGroupEditors"></div>
      <div class="sl-settings-summary" id="slSettingsSummary"></div>
      <div class="sl-settings-actions">
        <button class="ghost" type="button" data-sl-close>Cancelar</button>
        <button class="primary" type="button" id="slSaveSettings">Salvar configurações</button>
      </div>
    </div>`;
    document.body.append(modal);
    modal.addEventListener('click',event=>{ if (event.target === modal || event.target.closest('[data-sl-close]')) closeSettings(); });
    document.getElementById('slSaveSettings')?.addEventListener('click',saveSettings);
    modal.addEventListener('input',event=>{ if (event.target instanceof HTMLTextAreaElement) updateSettingsSummary(); });
  }

  function editorsData() {
    return [...document.querySelectorAll('#slGroupEditors textarea')].map((textarea,index)=>({
      name:textarea.dataset.groupName || `Grupo ${String.fromCharCode(65+index)}`,
      teams:textarea.value.split(/\n+/).map(value=>value.trim()).filter(Boolean)
    }));
  }

  function updateSettingsSummary() {
    const groups = editorsData();
    const q = DEFAULT_QUALIFIERS;
    const total = groups.reduce((sum,group)=>sum+group.teams.length,0);
    const element = document.getElementById('slSettingsSummary');
    if (element) element.textContent = `${total} participantes • ${groups.length} grupos • ${q} classificados por grupo • ${groups.length*q} vagas nas eliminatórias`;
  }

  function openSettings() {
    if (!window.ArenaBDAAuth?.isAdmin?.()) return;
    ensureSettingsModal();
    const groups = tournamentGroups();
    const editor = document.getElementById('slGroupEditors');
    editor.innerHTML = groups.map((group,index)=>`<label>${esc(group.name)}
      <textarea data-group-name="${esc(group.name)}" data-group-index="${index}" spellcheck="false">${esc(group.teams.join('\n'))}</textarea>
    </label>`).join('');
    updateSettingsSummary();
    document.getElementById('superLeagueSettingsModal')?.classList.add('show');
  }

  function closeSettings() {
    document.getElementById('superLeagueSettingsModal')?.classList.remove('show');
  }

  function validateSettings(groups) {
    if (groups.length !== 4) return 'A Super League precisa manter os quatro grupos.';
    if (groups.some(group=>group.teams.length < 2)) return 'Cada grupo precisa ter pelo menos 2 times.';
    const seen = new Set();
    for (const group of groups) {
      for (const team of group.teams) {
        const key = token(team);
        if (!key) return 'Há um nome de time inválido.';
        if (seen.has(key)) return `O time "${team}" aparece em mais de um grupo.`;
        seen.add(key);
      }
    }
    return '';
  }

  function saveSettings() {
    if (!window.ArenaBDAAuth?.isAdmin?.()) return;
    const groups = editorsData();
    const q = DEFAULT_QUALIFIERS;
    const error = validateSettings(groups);
    if (error) {
      if (typeof toast === 'function') toast(error); else alert(error);
      return;
    }
    const list = readTournamentList();
    const index = list.findIndex(item=>String(item?.id||'')===SUPER_LEAGUE_ID);
    if (index < 0) return;
    const next = [...list];
    next[index] = buildTournament(list[index],groups,q,Date.now());
    next[index].phase = 'Fase de grupos';
    next[index].groupGenerator.knockoutGenerated = false;
    localStorage.setItem(TOURNAMENT_KEY,JSON.stringify(next));
    window.ArenaBDASuperLeagueRule?.resetKnockout?.('super-league-groups-changed');
    replaceGuardFacade();
    closeSettings();
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated',{
      detail:{ tournamentId:SUPER_LEAGUE_ID, reason:'super-league-admin-settings' }
    }));
    refresh();
    if (typeof toast === 'function') toast('Configurações da Super League salvas');
  }

  function injectAdminShortcut() {
    if (!window.ArenaBDAAuth?.isAdmin?.()) return;
    const shortcuts = document.querySelector('#cloudAdminModal .cloud-panel-shortcuts');
    if (!shortcuts || shortcuts.querySelector('[data-super-league-panel-settings]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.superLeaguePanelSettings = 'true';
    button.innerHTML = '<i>⚜️</i><span>Configurar Super League</span>';
    button.addEventListener('click',()=>{
      document.getElementById('cloudAdminModal')?.classList.remove('show');
      openSettings();
    });
    shortcuts.append(button);
  }

  function nudgeStandings() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
    const panel = document.getElementById('autoStandings');
    const standingsButton = manager.querySelector('[data-standings-tab],[data-tab="standings"]');
    if (!panel || !standingsButton || panel.hidden || panel.querySelectorAll('.stand-group').length >= 4) return;
    if (panel.dataset.superLeagueRetry === 'true') return;
    panel.dataset.superLeagueRetry = 'true';
    setTimeout(()=>standingsButton.click(),0);
  }

  let refreshFrame = 0;
  function refresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(()=>{
      refreshFrame = 0;
      replaceGuardFacade();
      patchValidMatches();
      patchScoreSync();
      ensureStyles();
      ensureSettingsModal();
      injectAdminShortcut();
      renderGroupOverview();
      renderStandings();
      nudgeStandings();
    });
  }

  ensureDefaultConfiguration();
  replaceGuardFacade();
  installMatchStorageGuard();
  patchValidMatches();
  patchScoreSync();
  ensureStyles();
  ensureSettingsModal();

  document.addEventListener('focusin',protectScoreEdit,true);
  document.addEventListener('input',protectScoreEdit,true);
  document.addEventListener('change',protectScoreEdit,true);
  document.addEventListener('click',event=>{
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-super-league-open-standings]')) {
      event.preventDefault();
      event.target.closest('#giManager')?.querySelector('[data-standings-tab],[data-tab="standings"]')?.click();
      return;
    }
    if (event.target.closest('[data-super-league-settings]')) {
      event.preventDefault();
      openSettings();
      return;
    }
    if (event.target.closest('#standPhoto')) {
      const target = document.getElementById('standCapture');
      window.ArenaBDACapture?.element?.(target,'Classificação oficial','classificacao-super-league');
    }
  },true);

  ['arena:quick-score-saved','arena:bundle-loaded','arena:cloud-ready','arena:matches-updated','arena:tournaments-updated','arena:auth-changed']
    .forEach(type=>window.addEventListener(type,refresh));
  window.addEventListener('storage',event=>{ if ([TOURNAMENT_KEY,MATCH_KEY,TEAM_KEY].includes(event.key)) refresh(); });

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.ArenaBDASuperLeagueRuntimeFix = Object.freeze({
    version:4,
    refresh,
    groups:()=>clone(tournamentGroups()),
    qualifiers,
    openSettings,
    calculate
  });

  refresh();
})();
