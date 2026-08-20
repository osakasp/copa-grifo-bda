(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueScheduleRepair?.version >= 4) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';

  const FALLBACK_GROUPS = Object.freeze([
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

  const token = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'');

  function tournament() {
    try {
      const list = JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || '[]');
      return Array.isArray(list) ? list.find(item => String(item?.id || '') === SUPER_LEAGUE_ID) || null : null;
    } catch {
      return null;
    }
  }

  function groups() {
    const current = tournament();
    const source = current?.groupSettings?.groups || current?.groupGenerator?.groups;
    if (Array.isArray(source) && source.some(group=>Array.isArray(group?.teams)&&group.teams.length)) {
      return source.map((group,index)=>({
        name:String(group?.name || `Grupo ${String.fromCharCode(65+index)}`),
        teams:(Array.isArray(group?.teams)?group.teams:[]).map(name=>String(name||'').trim()).filter(Boolean)
      }));
    }
    return FALLBACK_GROUPS.map(group=>({name:group.name,teams:[...group.teams]}));
  }

  function qualifiers() {
    const current = tournament();
    const value = Number(current?.qualifiersPerGroup ?? current?.groupSettings?.qualifiersPerGroup ?? current?.groupGenerator?.qualifiers ?? 3);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 3;
  }

  function aliases(currentGroups = groups()) {
    const map = new Map();
    currentGroups.flatMap(group=>group.teams).forEach(name=>{
      map.set(token(name),name);
      (ALIASES[name]||[]).forEach(alias=>map.set(token(alias),name));
    });
    return map;
  }

  function roundRobin(teams) {
    const source=[...teams];
    if (source.length%2) source.push(null);
    const size=source.length;
    const matches=[];
    let rotation=[...source];
    for (let round=1;round<size;round+=1) {
      for (let index=0;index<size/2;index+=1) {
        let home=rotation[index],away=rotation[size-1-index];
        if (!home||!away) continue;
        if ((round+index)%2===0) [home,away]=[away,home];
        matches.push({home,away,round});
      }
      rotation=[rotation[0],rotation[size-1],...rotation.slice(1,size-1)];
    }
    return matches;
  }

  const pairKey=(a,b)=>[token(a),token(b)].sort().join('|');

  function expectedGames() {
    const output=[];
    let pos=0;
    groups().forEach((group,groupIndex)=>{
      roundRobin(group.teams).forEach((match,matchIndex)=>{
        pos+=1;
        const id=`grupo-super-league-config-v3-${groupIndex+1}-${match.round}-${matchIndex+1}`;
        output.push({
          id,tieId:id,leg:1,phase:`${group.name} • Rodada ${match.round}`,group:group.name,pos,
          status:'Agendado',ta:match.home,tb:match.away,a:'',b:'',pa:'',pb:'',wo:'none',date:'',time:'',place:'',
          note:`${group.name} • Jogo único`,created:Date.now()+pos,updated:Date.now()+pos,__pair:pairKey(match.home,match.away)
        });
      });
    });
    return output;
  }

  const isKnockout=game=>/quartas|oitavas|repescagem|preliminar|semifinal|semi-final|\bfinal\b|mata-super-league|qf\d|sf\d/i
    .test(`${game?.phase||''} ${game?.note||''} ${game?.id||''}`);

  const finished=game=>['a','b'].includes(game?.wo)
    || (game?.a!==''&&game?.a!=null&&game?.b!==''&&game?.b!=null);

  const gameScore=game=>game?.wo==='a'?[3,0]:game?.wo==='b'?[0,3]:[Number(game?.a)||0,Number(game?.b)||0];

  function chooseBetter(current,candidate) {
    if (!current) return candidate;
    if (finished(candidate)!==finished(current)) return finished(candidate)?candidate:current;
    return Number(candidate?.updated||candidate?.created||0)>=Number(current?.updated||current?.created||0)?candidate:current;
  }

  function readStore() {
    try {
      const value=JSON.parse(localStorage.getItem(MATCH_KEY)||'{}');
      return value&&typeof value==='object'?value:{};
    } catch { return {}; }
  }

  let repairing=false;
  let frame=0;

  function repair() {
    if (repairing) return {changed:false,busy:true};
    const currentGroups=groups();
    const aliasMap=aliases(currentGroups);
    const store=readStore();
    const current=Array.isArray(store[SUPER_LEAGUE_ID])?store[SUPER_LEAGUE_ID]:[];
    const expected=expectedGames();
    const expectedPairs=new Set(expected.map(game=>game.__pair));
    const existingByPair=new Map();
    const passthrough=[];

    current.forEach(game=>{
      if (isKnockout(game)) { passthrough.push(game); return; }
      const home=aliasMap.get(token(game?.ta))||'';
      const away=aliasMap.get(token(game?.tb))||'';
      if (!home||!away) { passthrough.push(game); return; }
      const key=pairKey(home,away);
      if (!expectedPairs.has(key)) { passthrough.push(game); return; }
      existingByPair.set(key,chooseBetter(existingByPair.get(key),{...game,__home:home,__away:away}));
    });

    let added=0,migrated=0;
    const configured=expected.map(template=>{
      const existing=existingByPair.get(template.__pair);
      if (!existing) {
        added+=1;
        const {__pair,...fresh}=template;
        return fresh;
      }
      const source={...existing};
      delete source.__home; delete source.__away;
      const sameOrientation=token(existing.__home)===token(template.ta);
      const oriented=sameOrientation?source:{
        ...source,
        a:source.b,b:source.a,pa:source.pb,pb:source.pa,
        wo:source.wo==='a'?'b':source.wo==='b'?'a':source.wo
      };
      if (source.phase!==template.phase||source.group!==template.group||token(source.ta)!==token(template.ta)||token(source.tb)!==token(template.tb)) migrated+=1;
      return {
        ...oriented,
        id:source.id||template.id,
        tieId:source.tieId||source.id||template.tieId,
        leg:source.leg||1,
        phase:template.phase,group:template.group,pos:template.pos,
        ta:template.ta,tb:template.tb,note:template.note,status:source.status||'Agendado'
      };
    });

    const repaired=[...configured,...passthrough];
    const signature=games=>JSON.stringify(games.map(game=>[
      game.id,game.phase,game.group,game.ta,game.tb,game.a,game.b,game.pa,game.pb,game.wo,game.date,game.time,game.place,game.note
    ]));
    if (signature(current)===signature(repaired)) {
      return {changed:false,added:0,migrated:0,totalGroups:configured.length};
    }

    store[SUPER_LEAGUE_ID]=repaired;
    repairing=true;
    try {
      localStorage.setItem(MATCH_KEY,JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('arena:matches-updated',{
        detail:{tournamentId:SUPER_LEAGUE_ID,reason:'super-league-schedule-repair-v4',added,migrated,totalGroups:configured.length}
      }));
      requestAnimationFrame(()=>window.ArenaBDAMatchManager?.render?.());
      return {changed:true,added,migrated,totalGroups:configured.length};
    } catch(error) {
      console.warn('[Arena BDA] Não foi possível ajustar a tabela da Super League',error);
      return {changed:false,error:true,totalGroups:configured.length};
    } finally {
      repairing=false;
    }
  }

  function groupStandings() {
    const currentGroups=groups();
    const aliasMap=aliases(currentGroups);
    const expected=expectedGames();
    const expectedPairs=new Set(expected.map(game=>game.__pair));
    const chosen=new Map();
    const games=readStore()[SUPER_LEAGUE_ID]||[];

    games.forEach(game=>{
      if (isKnockout(game)) return;
      const home=aliasMap.get(token(game?.ta))||'';
      const away=aliasMap.get(token(game?.tb))||'';
      if (!home||!away) return;
      const key=pairKey(home,away);
      if (!expectedPairs.has(key)) return;
      chosen.set(key,chooseBetter(chosen.get(key),{...game,__home:home,__away:away}));
    });

    const result=currentGroups.map(group=>({
      name:group.name,
      rows:group.teams.map(name=>({name,pts:0,j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0}))
    }));
    const rows=new Map();
    result.forEach(group=>group.rows.forEach(row=>rows.set(token(row.name),row)));

    chosen.forEach(game=>{
      if (!finished(game)) return;
      const home=rows.get(token(game.__home));
      const away=rows.get(token(game.__away));
      if (!home||!away) return;
      const [a,b]=gameScore(game);
      home.j++; away.j++; home.gp+=a; home.gc+=b; away.gp+=b; away.gc+=a;
      if (a>b) { home.v++; away.d++; home.pts+=3; }
      else if (b>a) { away.v++; home.d++; away.pts+=3; }
      else { home.e++; away.e++; home.pts++; away.pts++; }
    });

    result.forEach(group=>{
      group.rows=group.rows.map(row=>({...row,sg:row.gp-row.gc}))
        .sort((a,b)=>b.pts-a.pts||b.v-a.v||b.sg-a.sg||b.gp-a.gp||a.name.localeCompare(b.name,'pt-BR'));
    });

    return {
      groups:result,
      expected:expected.length,
      finished:[...chosen.values()].filter(finished).length,
      complete:expected.length>0&&[...chosen.values()].filter(finished).length===expected.length
    };
  }

  function pairCrossGroup(entries) {
    const source=[...entries].sort((a,b)=>a.rank-b.rank||a.group.localeCompare(b.group,'pt-BR'));
    function solve(pool,output) {
      if (!pool.length) return output;
      const first=pool[0];
      const candidates=pool.slice(1).map((entry,index)=>({entry,index:index+1}))
        .filter(candidate=>candidate.entry.group!==first.group)
        .sort((a,b)=>b.entry.rank-a.entry.rank||a.entry.group.localeCompare(b.entry.group,'pt-BR'));
      for (const candidate of candidates) {
        const next=pool.filter((_,index)=>index!==0&&index!==candidate.index);
        const result=solve(next,[...output,[first,candidate.entry]]);
        if (result) return result;
      }
      return null;
    }
    return solve(source,[])||[];
  }

  function assignByes(byes,pairs) {
    const ordered=[...byes].sort((a,b)=>a.group.localeCompare(b.group,'pt-BR'));
    function solve(index,used,output) {
      if (index>=ordered.length) return output;
      const bye=ordered[index];
      const candidates=pairs.map((pair,pairIndex)=>({pair,pairIndex}))
        .filter(({pair,pairIndex})=>!used.has(pairIndex)&&pair.every(entry=>entry.group!==bye.group));
      for (const candidate of candidates) {
        const nextUsed=new Set(used); nextUsed.add(candidate.pairIndex);
        const result=solve(index+1,nextUsed,[...output,{bye,pair:candidate.pair,pairIndex:candidate.pairIndex}]);
        if (result) return result;
      }
      return null;
    }
    return solve(0,new Set(),[])||[];
  }

  function knockoutGame(id,phase,pos,home,away,note) {
    const now=Date.now();
    return {id,tieId:id,leg:1,phase,pos,status:'Agendado',ta:home,tb:away,a:'',b:'',pa:'',pb:'',wo:'none',date:'',time:'',place:'',note,created:now+pos,updated:now+pos};
  }

  function buildTwelveTeamKnockout(entries) {
    if (entries.length!==12) return [];
    const byes=entries.filter(entry=>entry.rank===1);
    const prelimEntries=entries.filter(entry=>entry.rank>1);
    if (byes.length!==4||prelimEntries.length!==8) return [];
    const prelimPairs=pairCrossGroup(prelimEntries);
    if (prelimPairs.length!==4) return [];
    const assignments=assignByes(byes,prelimPairs);
    if (assignments.length!==4) return [];

    const stamp=Date.now().toString(36);
    const prelimIds=[];
    const output=[];
    let pos=0;
    prelimPairs.forEach((pair,index)=>{
      pos+=1;
      const id=`mata-super-league-${stamp}-pre-${index+1}`;
      prelimIds[index]=id;
      output.push(knockoutGame(id,'Preliminar',index+1,pair[0].name,pair[1].name,'2º e 3º colocados • vencedor avança às quartas'));
    });

    const quarterIds=[];
    assignments.forEach((assignment,index)=>{
      pos+=1;
      const id=`mata-super-league-${stamp}-qf-${index+1}`;
      quarterIds.push(id);
      output.push(knockoutGame(id,'Quartas de final',index+1,assignment.bye.name,`Vencedor ${prelimIds[assignment.pairIndex]}`,'Líder do grupo entra direto nas quartas'));
    });

    const semiIds=[];
    for (let index=0;index<quarterIds.length;index+=2) {
      pos+=1;
      const id=`mata-super-league-${stamp}-sf-${index/2+1}`;
      semiIds.push(id);
      output.push(knockoutGame(id,'Semifinal',index/2+1,`Vencedor ${quarterIds[index]}`,`Vencedor ${quarterIds[index+1]}`,'Mata-mata automático'));
    }

    pos+=1;
    output.push(knockoutGame(`mata-super-league-${stamp}-final-1`,'Final',1,`Vencedor ${semiIds[0]}`,`Vencedor ${semiIds[1]}`,'Final da BDA Super League'));
    return output;
  }

  async function cloudSaveKnockout(games) {
    if (!window.ArenaBDAAuth?.isAdmin?.() || !window.firebase || typeof firebase.firestore!=='function') return;
    try {
      await firebase.firestore().collection('arenaData').doc(`confrontos-${SUPER_LEAGUE_ID}`).set({
        dataset:'confrontos',tournamentId:SUPER_LEAGUE_ID,games,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy:window.ArenaBDAAuth.currentEmail?.()||''
      });
    } catch(error) {
      console.error('[Arena BDA] Falha ao sincronizar eliminatórias',error);
      if (typeof toast==='function') toast('Eliminatórias salvas neste aparelho; a nuvem será atualizada quando possível');
    }
  }

  async function generateTwelveTeamKnockout() {
    if (!window.ArenaBDAAuth?.isAdmin?.()) return;
    if (qualifiers()!==3||groups().length!==4) return;
    const table=groupStandings();
    if (!table.complete) {
      if (typeof toast==='function') toast('Finalize todos os jogos da fase de grupos primeiro');
      return;
    }
    const entries=table.groups.flatMap(group=>group.rows.slice(0,3).map((row,index)=>({name:row.name,group:group.name,rank:index+1})));
    if (entries.length!==12) return;
    const knockout=buildTwelveTeamKnockout(entries);
    if (knockout.length!==11) {
      if (typeof toast==='function') toast('Não foi possível montar as eliminatórias de 12 times');
      return;
    }

    const store=readStore();
    const current=Array.isArray(store[SUPER_LEAGUE_ID])?store[SUPER_LEAGUE_ID]:[];
    const existingKnockout=current.filter(isKnockout);
    if (existingKnockout.some(finished)&&!confirm('Já existem jogos eliminatórios com resultado. Deseja recriar a chave de 12 times?')) return;
    store[SUPER_LEAGUE_ID]=[...current.filter(game=>!isKnockout(game)),...knockout];
    localStorage.setItem(MATCH_KEY,JSON.stringify(store));

    try {
      const list=JSON.parse(localStorage.getItem(TOURNAMENT_KEY)||'[]');
      if (Array.isArray(list)) {
        const index=list.findIndex(item=>String(item?.id||'')===SUPER_LEAGUE_ID);
        if (index>=0) {
          list[index]={...list[index],status:'Em andamento',phase:'Preliminar',groupGenerator:{...(list[index].groupGenerator||{}),knockoutGenerated:true,knockoutGeneratedAt:Date.now()}};
          localStorage.setItem(TOURNAMENT_KEY,JSON.stringify(list));
        }
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('arena:matches-updated',{detail:{tournamentId:SUPER_LEAGUE_ID,reason:'super-league-knockout-12',games:11}}));
    window.ArenaBDAMatchManager?.render?.();
    await cloudSaveKnockout(store[SUPER_LEAGUE_ID]);
    if (typeof toast==='function') toast('Eliminatórias criadas: 4 preliminares, quartas, semifinais e final');
  }

  function invalidateKnockoutIfConfigChanged(event) {
    if (!['super-league-admin-settings','super-league-3-qualifiers-default'].includes(String(event?.detail?.reason||''))) return;
    try {
      const list=JSON.parse(localStorage.getItem(TOURNAMENT_KEY)||'[]');
      if (!Array.isArray(list)) return;
      const index=list.findIndex(item=>String(item?.id||'')===SUPER_LEAGUE_ID);
      if (index<0||!list[index]?.groupGenerator?.knockoutGenerated) return;
      const generator={...(list[index].groupGenerator||{}),knockoutGenerated:false};
      delete generator.knockoutGeneratedAt;
      list[index]={...list[index],groupGenerator:generator};
      localStorage.setItem(TOURNAMENT_KEY,JSON.stringify(list));
    } catch {}
  }

  function patchTwelveTeamKnockoutCard() {
    const manager=document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    if (!manager||qualifiers()!==3||groups().length!==4) return;
    const card=manager.querySelector('.league-knockout-card');
    const button=card?.querySelector('[data-generate-knockout]');
    const status=card?.querySelector('footer span');
    const description=card?.querySelector('p');
    if (!card||!button||!status) return;
    const table=groupStandings();
    status.textContent='12 classificados • 4 líderes direto às quartas';
    if (description) description.textContent='Os 2º e 3º colocados disputam uma preliminar. Os quatro líderes de grupo entram direto nas quartas de final.';
    button.disabled=!table.complete;
    button.textContent='Gerar eliminatórias';
  }

  function scheduleRepair() {
    if (frame) return;
    frame=requestAnimationFrame(()=>{ frame=0; repair(); patchTwelveTeamKnockoutCard(); });
  }

  function installStorageGuard() {
    const previous=Storage.prototype.setItem;
    if (previous.__arenaSuperLeagueDynamicSchedule) return;
    const guarded=function(key,value) {
      const result=previous.call(this,key,value);
      if (this===localStorage&&!repairing&&(key===MATCH_KEY||key===TOURNAMENT_KEY)) queueMicrotask(scheduleRepair);
      return result;
    };
    Object.defineProperty(guarded,'__arenaSuperLeagueDynamicSchedule',{value:true});
    Storage.prototype.setItem=guarded;
  }

  ['arena:cloud-ready','arena:bundle-loaded'].forEach(type=>window.addEventListener(type,scheduleRepair));
  window.addEventListener('arena:tournaments-updated',event=>{
    invalidateKnockoutIfConfigChanged(event);
    scheduleRepair();
  });
  window.addEventListener('arena:matches-updated',event=>{
    if (String(event.detail?.tournamentId||'')!==SUPER_LEAGUE_ID) return;
    if (event.detail?.reason==='super-league-schedule-repair-v4') return;
    scheduleRepair();
  });
  window.addEventListener('storage',event=>{ if (event.key===MATCH_KEY||event.key===TOURNAMENT_KEY) scheduleRepair(); });

  document.addEventListener('click',event=>{
    if (!(event.target instanceof Element)) return;
    const button=event.target.closest(`#giManager[data-tid="${SUPER_LEAGUE_ID}"] [data-generate-knockout]`);
    if (!button||qualifiers()!==3||groups().length!==4) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    generateTwelveTeamKnockout();
  },true);

  const observer=new MutationObserver(patchTwelveTeamKnockoutCard);
  observer.observe(document.documentElement,{childList:true,subtree:true});

  installStorageGuard();

  const currentExpected=expectedGames();
  const byGroup={};
  currentExpected.forEach(game=>{ byGroup[game.group]=(byGroup[game.group]||0)+1; });

  window.ArenaBDASuperLeagueScheduleRepair=Object.freeze({
    version:4,
    repair,
    expectedGroupGames:currentExpected.length,
    expectedByGroup:Object.freeze({...byGroup}),
    groups:()=>groups().map(group=>({name:group.name,teams:[...group.teams]})),
    generateKnockout12:generateTwelveTeamKnockout,
    standings:groupStandings
  });

  scheduleRepair();
})();