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

  function groups() {
    try {
      const tournaments = JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || '[]');
      const tournament = Array.isArray(tournaments)
        ? tournaments.find(item=>String(item?.id||'')===SUPER_LEAGUE_ID)
        : null;
      const source = tournament?.groupSettings?.groups || tournament?.groupGenerator?.groups;
      if (Array.isArray(source) && source.some(group=>Array.isArray(group?.teams)&&group.teams.length)) {
        return source.map((group,index)=>({
          name:String(group?.name || `Grupo ${String.fromCharCode(65+index)}`),
          teams:(Array.isArray(group?.teams)?group.teams:[]).map(name=>String(name||'').trim()).filter(Boolean)
        }));
      }
    } catch {}
    return FALLBACK_GROUPS.map(group=>({name:group.name,teams:[...group.teams]}));
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

  function scheduleRepair() {
    if (frame) return;
    frame=requestAnimationFrame(()=>{ frame=0; repair(); });
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

  ['arena:cloud-ready','arena:bundle-loaded','arena:tournaments-updated'].forEach(type=>window.addEventListener(type,scheduleRepair));
  window.addEventListener('arena:matches-updated',event=>{
    if (String(event.detail?.tournamentId||'')!==SUPER_LEAGUE_ID) return;
    if (event.detail?.reason==='super-league-schedule-repair-v4') return;
    scheduleRepair();
  });
  window.addEventListener('storage',event=>{ if (event.key===MATCH_KEY||event.key===TOURNAMENT_KEY) scheduleRepair(); });

  installStorageGuard();

  const currentExpected=expectedGames();
  const byGroup={};
  currentExpected.forEach(game=>{ byGroup[game.group]=(byGroup[game.group]||0)+1; });

  window.ArenaBDASuperLeagueScheduleRepair=Object.freeze({
    version:4,
    repair,
    expectedGroupGames:currentExpected.length,
    expectedByGroup:Object.freeze({...byGroup}),
    groups:()=>groups().map(group=>({name:group.name,teams:[...group.teams]}))
  });

  scheduleRepair();
})();