(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueStandingsFix?.version >= 2) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';
  const GROUPS = Object.freeze([
    Object.freeze({ name:'Grupo A', teams:Object.freeze(['CV Cruz BDA','Hellyeah BDA','Imortais FC BDA','BDA Golden FC','CR Flamengo','Vera Cruz Do Oeste PR BDA']) }),
    Object.freeze({ name:'Grupo B', teams:Object.freeze(['Zombie BDA','Sport Recife BDA','São Paulo BDA','Nacional AC BDA','Imperial São Paulo BDA']) }),
    Object.freeze({ name:'Grupo C', teams:Object.freeze(['Red Bull BDA','Independente FC BDA','Vasco Da Gama BDA','Esperança BDA','Florence Real BDA']) }),
    Object.freeze({ name:'Grupo D', teams:Object.freeze(['Boca Juniors','Praia Grande Jogobugado BDA','Flamestre BDA','BDA URDLS','Isaías 55-6-7']) })
  ]);

  const ALIASES = Object.freeze({
    'CV Cruz BDA':['CV CRUZ BDA'], 'Hellyeah BDA':['HELLYEAH BDA'], 'Imortais FC BDA':['IMORTAIS FC BDA'],
    'BDA Golden FC':['BDA GOLDEN','BDA GOLDEN FC'], 'CR Flamengo':['CR FLAMENGO','CR FLAMENGO BDA'],
    'Vera Cruz Do Oeste PR BDA':['VERA CRUZ DO OESTE PR BDA'], 'Zombie BDA':['ZOMBIE BDA','ZOMBIE FC BDA','Zombie FC BDA'],
    'Sport Recife BDA':['SPORT RECIFE BDA'], 'São Paulo BDA':['SAO PAULO BDA','SÃO PAULO FC BDA','SAO PAULO FC BDA'],
    'Nacional AC BDA':['NACIONAL AC BDA','NACIONAL FC BDA'], 'Imperial São Paulo BDA':['IMPERIAL SÃO PAULO BDA','IMPERIAL SAO PAULO BDA'],
    'Red Bull BDA':['RED BULL BDA'], 'Independente FC BDA':['INDEPENDENTE FC BDA','INDEPENDENTE FC APOSENTADO BDA'],
    'Vasco Da Gama BDA':['VASCO DA GAMA BDA'], 'Esperança BDA':['ESPERANÇA BDA','ESPERANCA BDA'],
    'Florence Real BDA':['FLORENCE REAL BDA','FLORENCE REAL FC BDA'], 'Boca Juniors':['BOCA JUNIORS','BOCA JUNIORS BDA'],
    'Praia Grande Jogobugado BDA':['PRAIA GRANDE JOGOBUGADO BDA','JOGOBUGADO BDA','JOGO BUGADO BDA'],
    'Flamestre BDA':['FLAMESTRE BDA','FLAMESTRE FC DF BDA'], 'BDA URDLS':['BDA URDLS'],
    'Isaías 55-6-7':['ISAIAS 55-6-7','ISAÍAS 55-6-7']
  });

  const token = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const aliasMap = new Map();
  GROUPS.flatMap(group => group.teams).forEach(name => {
    aliasMap.set(token(name), name);
    (ALIASES[name] || []).forEach(alias => aliasMap.set(token(alias), name));
  });
  const canonicalName = name => aliasMap.get(token(name)) || '';
  const pairKey = (a,b) => [token(a),token(b)].sort().join('|');

  function loadRepair() {
    if (window.ArenaBDASuperLeagueScheduleRepair) {
      window.ArenaBDASuperLeagueScheduleRepair.repair?.();
      return;
    }
    if (document.querySelector('script[data-super-league-schedule-repair]')) return;
    const script = document.createElement('script');
    script.src = './super-league-schedule-repair.js?v=20260819-1';
    script.async = true;
    script.dataset.superLeagueScheduleRepair = 'true';
    script.addEventListener('load', () => {
      window.ArenaBDASuperLeagueScheduleRepair?.repair?.();
      refresh();
    }, { once:true });
    script.addEventListener('error', () => console.warn('[Arena BDA] Não foi possível completar a tabela de jogos da Super League'), { once:true });
    (document.body || document.head || document.documentElement).appendChild(script);
  }

  function rawGames() {
    try {
      const store = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
      return Array.isArray(store?.[SUPER_LEAGUE_ID]) ? store[SUPER_LEAGUE_ID] : [];
    } catch { return []; }
  }

  function teams() {
    try {
      const value = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function teamMeta(name) {
    const key = token(name);
    return teams().find(team => token(canonicalName(team?.name) || team?.name) === key) || null;
  }

  function groupFor(name) {
    const canonical = canonicalName(name) || name;
    return GROUPS.find(group => group.teams.some(team => token(team) === token(canonical)))?.name || '';
  }

  const finished = game => ['a','b'].includes(game?.wo) || (game?.a !== '' && game?.a != null && game?.b !== '' && game?.b != null);
  const score = game => game?.wo === 'a' ? [3,0] : game?.wo === 'b' ? [0,3] : [Number(game?.a)||0, Number(game?.b)||0];
  const knockout = game => /quartas|semifinal|semi-final|\bfinal\b|mata-super-league|qf\d|sf\d/i.test(`${game?.phase||''} ${game?.note||''} ${game?.id||''}`);
  const blank = name => ({ name,pts:0,j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,last:[] });

  function groupMatches() {
    const chosen = new Map();
    rawGames().forEach(game => {
      if (!finished(game) || knockout(game)) return;
      const home = canonicalName(game?.ta);
      const away = canonicalName(game?.tb);
      if (!home || !away) return;
      const group = groupFor(home);
      if (!group || group !== groupFor(away)) return;
      const key = pairKey(home,away);
      const stamp = Number(game?.updated || game?.created || 0);
      const current = chosen.get(key);
      if (!current || stamp >= current.stamp) chosen.set(key,{ game,home,away,group,stamp });
    });
    return [...chosen.values()];
  }

  function calculate() {
    const result = GROUPS.map(group => ({ name:group.name, rows:group.teams.map(blank) }));
    const rowByTeam = new Map();
    result.forEach(group => group.rows.forEach(row => rowByTeam.set(token(row.name),row)));
    groupMatches().sort((a,b)=>a.stamp-b.stamp).forEach(item => {
      const home = rowByTeam.get(token(item.home));
      const away = rowByTeam.get(token(item.away));
      if (!home || !away) return;
      const [sa,sb] = score(item.game);
      home.j++; away.j++; home.gp+=sa; home.gc+=sb; away.gp+=sb; away.gc+=sa;
      if (sa>sb) { home.v++; away.d++; home.pts+=3; home.last.push('V'); away.last.push('D'); }
      else if (sb>sa) { away.v++; home.d++; away.pts+=3; away.last.push('V'); home.last.push('D'); }
      else { home.e++; away.e++; home.pts++; away.pts++; home.last.push('E'); away.last.push('E'); }
    });
    result.forEach(group => {
      group.rows = group.rows.map(row => ({...row,sg:row.gp-row.gc,last:row.last.slice(-5)}))
        .sort((a,b)=>b.pts-a.pts||b.v-a.v||b.sg-a.sg||b.gp-a.gp||a.name.localeCompare(b.name,'pt-BR'));
    });
    return result;
  }

  function badge(name) {
    const meta = teamMeta(name);
    if (meta?.badge) return `<span class="stand-badge"><img src="${esc(meta.badge)}" alt="Escudo de ${esc(name)}"></span>`;
    const code = meta?.code || name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    return `<span class="stand-badge">${esc(code)}</span>`;
  }
  const efficiency = row => row.j ? Math.round((row.pts/(row.j*3))*100) : 0;
  const form = last => last.length ? last.map(value=>`<i data-result="${value}">${value}</i>`).join('') : '<span>–</span>';

  function table(group) {
    return `<section class="stand-group" data-canonical-group="${esc(group.name)}"><header><div><span class="eyebrow">Tabela oficial</span><h3>${esc(group.name)}</h3></div><span>2 classificam • ${group.rows.length} clubes</span></header><div class="stand-scroll"><table><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>APR</th><th>Últimos</th></tr></thead><tbody>${group.rows.map((row,index)=>{const meta=teamMeta(row.name);return `<tr class="${index<2?'qualified':''}"><td><b class="stand-pos">${index+1}</b></td><td><div class="stand-club">${badge(row.name)}<span><b>${esc(row.name)}</b><small>${esc(meta?.master?`Mestre ${meta.master}`:'Clã BDA')}</small></span></div></td><td class="stand-points">${row.pts}</td><td>${row.j}</td><td>${row.v}</td><td>${row.e}</td><td>${row.d}</td><td>${row.gp}</td><td>${row.gc}</td><td class="${row.sg>0?'positive':row.sg<0?'negative':''}">${row.sg>0?'+':''}${row.sg}</td><td>${efficiency(row)}%</td><td><div class="stand-form">${form(row.last)}</div></td></tr>`}).join('')}</tbody></table></div></section>`;
  }

  function highlights(data) {
    const played = data.flatMap(group=>group.rows).filter(row=>row.j>0);
    if (!played.length) return '';
    const leader=[...played].sort((a,b)=>b.pts-a.pts||b.sg-a.sg||b.gp-a.gp)[0];
    const attack=[...played].sort((a,b)=>b.gp-a.gp||b.pts-a.pts)[0];
    const defense=[...played].sort((a,b)=>a.gc-b.gc||b.j-a.j)[0];
    return `<div class="stand-highlights"><article><span>👑 Líder</span><b>${esc(leader.name)}</b><small>${leader.pts} pontos</small></article><article><span>⚽ Melhor ataque</span><b>${esc(attack.name)}</b><small>${attack.gp} gols</small></article><article><span>🛡 Melhor defesa</span><b>${esc(defense.name)}</b><small>${defense.gc} sofridos</small></article></div>`;
  }

  function content() {
    const data=calculate();
    return `<div class="stand-head"><div><span class="eyebrow">Atualização instantânea</span><h2>Classificação oficial</h2><p>45 jogos de grupos previstos. Os 2 melhores de cada grupo avançam.</p></div><button class="primary" id="standPhoto">📸 Foto da tabela</button></div>${highlights(data)}<div id="standCapture">${data.map(table).join('')}</div>`;
  }

  let frame=0;
  function refresh() {
    if (frame) return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      const manager=document.getElementById('giManager');
      if (!manager || manager.dataset.tid!==SUPER_LEAGUE_ID) return;
      const panel=document.getElementById('autoStandings');
      if (!panel || panel.hidden) return;
      const signature=JSON.stringify(groupMatches().map(item=>[item.home,item.away,item.game?.a,item.game?.b,item.game?.wo,item.stamp]));
      const expected=`v2:${signature}`;
      if (panel.dataset.superLeagueCanonical===expected && panel.querySelectorAll('[data-canonical-group]').length===4) return;
      panel.dataset.superLeagueCanonical=expected;
      panel.innerHTML=content();
    });
  }

  function ensureStyles() {
    if (document.getElementById('superLeagueStandingsFixStyles')) return;
    const style=document.createElement('style');
    style.id='superLeagueStandingsFixStyles';
    style.textContent=`#giManager[data-tid="${SUPER_LEAGUE_ID}"].stand-active #superLeagueGroupsOverview{display:none!important}#giManager[data-tid="${SUPER_LEAGUE_ID}"] #autoStandings .stand-group[data-canonical-group]{scroll-margin-top:92px}`;
    document.head.appendChild(style);
  }

  ensureStyles();
  loadRepair();
  document.addEventListener('click',event=>{
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#giManager[data-tid="bda-super-league"] [data-standings-tab],#giManager[data-tid="bda-super-league"] [data-tab="standings"]')) requestAnimationFrame(refresh);
  },true);
  ['arena:quick-score-saved','arena:matches-updated','arena:bundle-loaded','arena:cloud-ready','arena:tournaments-updated'].forEach(type=>window.addEventListener(type,()=>{loadRepair();refresh()}));
  window.addEventListener('storage',event=>{if(event.key===MATCH_KEY||event.key===TEAM_KEY){loadRepair();refresh()}});
  const observer=new MutationObserver(refresh); observer.observe(document.documentElement,{childList:true,subtree:true});

  window.ArenaBDASuperLeagueStandingsFix=Object.freeze({version:2,refresh,calculate,expectedGroupGames:45});
  refresh();
})();
