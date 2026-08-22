(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueRuleV3?.version >= 3) return;

  const TID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const BACKUP_KEY = 'bda-v7-super-league-final-bracket-backup';
  let refreshFrame = 0;
  let db = null;
  let unsubscribe = null;
  let retryTimer = 0;
  let retryCount = 0;

  const clone = value => JSON.parse(JSON.stringify(value));
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const stable = value => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key) => (out[key] = stable(value[key]), out), {});
    return value;
  };
  const signature = value => JSON.stringify(stable(value));

  function runtime(){ return window.ArenaBDASuperLeagueRuntimeFix || null; }
  function isAdmin(){ return Boolean(window.ArenaBDAAuth?.isAdmin?.()); }
  function pending(){ return Boolean(window.ArenaBDAScoreSync?.isPending?.(TID)); }
  function notify(message){ if(typeof window.toast === 'function') window.toast(message); else console.info(message); }
  function matchStore(){ const value = read(MATCH_KEY, {}); return value && typeof value === 'object' ? value : {}; }
  function localGames(){ const value = matchStore()[TID]; return Array.isArray(value) ? value : []; }
  function tournaments(){ const value = read(TOURNAMENT_KEY, []); return Array.isArray(value) ? value : []; }

  function groupSort(a,b){
    return b.pts-a.pts || b.v-a.v || b.sg-a.sg || b.gp-a.gp || a.name.localeCompare(b.name,'pt-BR');
  }
  function rate(row, field){
    const games = Math.max(1, Number(row?.j || 0));
    if(field === 'pts') return Number(row?.pts || 0) / (games * 3);
    return Number(row?.[field] || 0) / games;
  }
  function crossSort(a,b){
    return rate(b,'pts')-rate(a,'pts')
      || rate(b,'v')-rate(a,'v')
      || rate(b,'sg')-rate(a,'sg')
      || rate(b,'gp')-rate(a,'gp')
      || b.pts-a.pts
      || a.name.localeCompare(b.name,'pt-BR');
  }
  function slices(){
    const data = runtime()?.calculate?.();
    if(!Array.isArray(data) || data.length !== 4) return null;
    const leaders = [], seconds = [], thirds = [];
    data.forEach(group => {
      const rows = [...(group.rows || [])].sort(groupSort);
      if(rows[0]) leaders.push({...rows[0],group:group.name,groupRank:1});
      if(rows[1]) seconds.push({...rows[1],group:group.name,groupRank:2});
      if(rows[2]) thirds.push({...rows[2],group:group.name,groupRank:3});
    });
    const seed = list => [...list].sort(crossSort).map((row,index) => ({...row,seed:index+1}));
    return {groups:data,leaders:seed(leaders),seconds:seed(seconds),thirds:seed(thirds)};
  }
  function mode(){
    const groups = runtime()?.groups?.();
    return Number(runtime()?.qualifiers?.() || 0) === 3 && Array.isArray(groups) && groups.length === 4;
  }
  function groupsComplete(){
    const data = runtime()?.calculate?.();
    if(!Array.isArray(data) || data.length !== 4) return false;
    return data.every(group => {
      const rows = Array.isArray(group.rows) ? group.rows : [];
      const expected = Math.max(0, rows.length - 1);
      return rows.length >= 3 && rows.every(row => Number(row.j || 0) >= expected);
    });
  }

  function permutations(list){
    if(list.length <= 1) return [list];
    const output = [];
    list.forEach((item,index) => {
      const rest = [...list.slice(0,index),...list.slice(index+1)];
      permutations(rest).forEach(tail => output.push([item,...tail]));
    });
    return output;
  }
  function bestOrder(left, right, desiredSeed){
    let best = null;
    permutations(right).forEach(order => {
      let score = 0;
      order.forEach((entry,index) => {
        const groups = entry.possibleGroups || (entry.group ? [entry.group] : []);
        if(groups.includes(left[index]?.group)) score += 10000;
        score += Math.abs(Number(entry.seed || 0) - desiredSeed(index));
      });
      if(!best || score < best.score) best = {score,order};
    });
    return best?.order || right;
  }

  function baseGame(id, phase, pos, home, away, note){
    const now = Date.now();
    return {id,tieId:id,leg:1,phase,pos,status:'Agendado',ta:home,tb:away,a:'',b:'',pa:'',pb:'',wo:'none',date:'',time:'',place:'',note,created:now+pos,updated:now+pos};
  }
  function samePair(game, home, away){
    const current = [norm(game?.ta),norm(game?.tb)].sort().join('|');
    const expected = [norm(home),norm(away)].sort().join('|');
    return current && current === expected;
  }
  function reuseRepechage(candidate, existing){
    const old = existing.find(game => norm(game?.phase).includes('repesc') && samePair(game,candidate.ta,candidate.tb));
    if(!old) return candidate;
    return {...candidate,...old,phase:'Repescagem',pos:candidate.pos,ta:candidate.ta,tb:candidate.tb,note:candidate.note};
  }

  function buildFinal(existing = localGames()){
    const data = slices();
    if(!data || data.leaders.length !== 4 || data.seconds.length !== 4 || data.thirds.length !== 4) return [];

    const stamp = Date.now().toString(36);
    const prefix = `mata-super-league-${stamp}`;
    const games = [];
    const thirds = data.thirds;

    const rawRep = [
      baseGame(`${prefix}-rep-1`,'Repescagem',1,thirds[0].name,thirds[3].name,`Repescagem • 1º melhor 3º x 4º melhor 3º`),
      baseGame(`${prefix}-rep-2`,'Repescagem',2,thirds[1].name,thirds[2].name,`Repescagem • 2º melhor 3º x 3º melhor 3º`)
    ];
    const rep = rawRep.map(game => reuseRepechage(game, existing));
    games.push(...rep);

    const repSlots = [
      {gameId:rep[0].id,seed:2,possibleGroups:[thirds[0].group,thirds[3].group]},
      {gameId:rep[1].id,seed:1,possibleGroups:[thirds[1].group,thirds[2].group]}
    ];
    const lowerSeconds = data.seconds.slice(2);
    const assignedRep = bestOrder(lowerSeconds,repSlots,index => index + 1);
    const playIns = lowerSeconds.map((second,index) => {
      const repSlot = assignedRep[index];
      const id = `${prefix}-playin-${index+1}`;
      const game = baseGame(id,'Play-in',index+1,second.name,`Vencedor ${repSlot.gameId}`,`${second.seed}º melhor 2º x vencedor da repescagem`);
      game._possibleGroups = [second.group,...repSlot.possibleGroups];
      game._seed = second.seed;
      games.push(game);
      return game;
    });

    const directSeconds = data.seconds.slice(0,2);
    const quarterSlots = [
      {label:directSeconds[0].name,seed:1,possibleGroups:[directSeconds[0].group]},
      {label:directSeconds[1].name,seed:2,possibleGroups:[directSeconds[1].group]},
      {label:`Vencedor ${playIns[0].id}`,seed:3,possibleGroups:playIns[0]._possibleGroups},
      {label:`Vencedor ${playIns[1].id}`,seed:4,possibleGroups:playIns[1]._possibleGroups}
    ];
    const assignedQuarterSlots = bestOrder(data.leaders,quarterSlots,index => 4-index);
    const qfIds = [];
    data.leaders.forEach((leader,index) => {
      const slot = assignedQuarterSlots[index];
      const id = `${prefix}-qf-${index+1}`;
      qfIds.push(id);
      games.push(baseGame(id,'Quartas de final',index+1,leader.name,slot.label,`Líder ${leader.group} • cabeça de chave ${leader.seed}`));
    });

    const semiPairs = [[qfIds[0],qfIds[3]],[qfIds[1],qfIds[2]]];
    const sfIds = [];
    semiPairs.forEach((pair,index) => {
      const id = `${prefix}-sf-${index+1}`;
      sfIds.push(id);
      games.push(baseGame(id,'Semifinal',index+1,`Vencedor ${pair[0]}`,`Vencedor ${pair[1]}`,'Semifinal da BDA Super League'));
    });
    games.push(baseGame(`${prefix}-final`,'Final',1,`Vencedor ${sfIds[0]}`,`Vencedor ${sfIds[1]}`,'Final da BDA Super League'));

    return games.map(game => {
      const clean = {...game};
      delete clean._possibleGroups;
      delete clean._seed;
      return clean;
    });
  }

  function finalStructureExists(){
    const games = localGames().filter(game => String(game?.id || '').startsWith('mata-'));
    return games.some(game => norm(game?.phase).includes('play-in')) && games.some(game => norm(game?.phase).includes('quart')) && games.some(game => norm(game?.phase) === 'final');
  }

  async function cloudWrite(list){
    ensureCloud();
    if(!db || !isAdmin()) return false;
    try{
      await db.collection('arenaData').doc(`confrontos-${TID}`).set({dataset:'confrontos',tournamentId:TID,games:list,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:window.ArenaBDAAuth?.currentEmail?.()||''});
      return true;
    }catch(error){ console.warn('[Arena BDA] Falha ao sincronizar a fase final',error); return false; }
  }

  async function generate(){
    if(!isAdmin()) return notify('Apenas o administrador pode gerar a fase final');
    if(!mode()) return notify('A Super League precisa estar com 3 posições por grupo');
    if(!groupsComplete()) return notify('Finalize todos os jogos da fase de grupos primeiro');
    if(finalStructureExists()) return notify('A fase final completa já foi gerada');

    const current = localGames();
    const knockout = buildFinal(current);
    if(knockout.length !== 11) return notify('Não foi possível montar a fase final');

    try{ localStorage.setItem(BACKUP_KEY,JSON.stringify({savedAt:Date.now(),games:clone(current),tournaments:clone(tournaments())})); }catch{}
    const store = matchStore();
    const groupGames = current.filter(game => !String(game?.id || '').startsWith('mata-'));
    store[TID] = [...groupGames,...knockout];
    localStorage.setItem(MATCH_KEY,JSON.stringify(store));

    const list = tournaments();
    const index = list.findIndex(item => String(item?.id || '') === TID);
    if(index >= 0){
      list[index] = {...list[index],status:'Em andamento',phase:'Repescagem',groupGenerator:{...(list[index].groupGenerator||{}),qualifiers:3,knockoutGenerated:true,knockoutMode:'third-place-repechage-playin',repechageQualifiers:2,directQuarterfinalSeconds:2,playInQualifiers:2,knockoutGames:11,repechageGeneratedAt:Date.now()}};
      localStorage.setItem(TOURNAMENT_KEY,JSON.stringify(list));
    }

    window.dispatchEvent(new CustomEvent('arena:matches-updated',{detail:{tournamentId:TID,reason:'super-league-complete-final-bracket',count:knockout.length}}));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated',{detail:{tournamentId:TID,reason:'super-league-complete-final-bracket'}}));
    const synced = await cloudWrite(store[TID]);
    notify(synced?'Fase final criada: repescagem, play-in, quartas, semifinal e final':'Fase final criada; a nuvem será atualizada quando reconectar');
    setTimeout(() => location.reload(),650);
  }

  function efficiency(row){ return row.j ? Math.round((row.pts/(row.j*3))*100) : 0; }
  function rankingSection(id, title, eyebrow, meta, note, rows, statusFor){
    const manager = document.querySelector(`#giManager[data-tid="${TID}"]`);
    const panel = manager?.querySelector('#autoStandings');
    const capture = panel?.querySelector('#standCapture');
    if(!panel || panel.hidden || !capture || !rows?.length) return;
    const sig = JSON.stringify(rows.map(row => [row.name,row.group,row.pts,row.j,row.v,row.sg,row.gp]));
    let section = document.getElementById(id);
    if(section?.dataset.signature === sig) return;
    if(!section){ section=document.createElement('section'); section.id=id; section.className='stand-group sl-special-ranking'; capture.append(section); }
    section.dataset.signature = sig;
    section.innerHTML = `<header><div><span class="eyebrow">${esc(eyebrow)}</span><h3>${esc(title)}</h3></div><span>${esc(meta)}</span></header><p class="sl-special-note">${esc(note)}</p><div class="stand-scroll"><table><thead><tr><th>#</th><th>Clube</th><th>Grupo</th><th>PTS</th><th>J</th><th>V</th><th>SG</th><th>GP</th><th>APR</th></tr></thead><tbody>${rows.map((row,index)=>{const status=statusFor(index,row);return `<tr data-zone="${esc(status.zone)}"><td><b class="stand-pos">${index+1}</b></td><td><div class="stand-club"><span><b>${esc(row.name)}</b><small>${esc(status.label)}</small></span></div></td><td>${esc(row.group)}</td><td class="stand-points">${row.pts}</td><td>${row.j}</td><td>${row.v}</td><td>${row.sg>0?'+':''}${row.sg}</td><td>${row.gp}</td><td>${efficiency(row)}%</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function renderRankings(){
    if(!mode()){
      document.getElementById('superLeagueSecondPlaceRanking')?.remove();
      document.getElementById('superLeagueThirdPlaceRanking')?.remove();
      return;
    }
    const data = slices();
    if(!data) return;
    rankingSection('superLeagueSecondPlaceRanking','Ranking dos 2º colocados','Fase final','2 direto às quartas • 2 no play-in','Os segundos são comparados por aproveitamento, taxa de vitórias, saldo por jogo e gols por jogo. Os dois melhores vão direto às quartas.',data.seconds,(index)=>index<2?{zone:'qualified',label:'Direto às quartas'}:{zone:'playin',label:'Play-in'});
    rankingSection('superLeagueThirdPlaceRanking','Classificação dos 3º colocados','Repescagem','4 clubes • 2 vencedores avançam','Os quatro terceiros jogam 1º x 4º e 2º x 3º. Os dois vencedores seguem ao play-in.',data.thirds,()=>({zone:'repechage',label:'Repescagem'}));
  }

  function patchUi(){
    if(!mode()) return;
    const manager = document.querySelector(`#giManager[data-tid="${TID}"]`);
    const panel = manager?.querySelector('#autoStandings');
    if(!manager || !panel) return;

    panel.querySelectorAll('.stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking)').forEach(section => {
      const meta = section.querySelector(':scope > header > span');
      if(meta){ const clubs=(meta.textContent.match(/(\d+)\s*club/i)||[])[1]; meta.textContent=`2 classificam + 1 repescagem${clubs?` • ${clubs} clubes`:''}`; }
      [...section.querySelectorAll('tbody > tr:not(.arena-mobile-stat-detail)')].forEach((row,index) => { row.dataset.zone = index<2?'qualified':index===2?'repechage':'out'; });
    });

    let legend = panel.querySelector('#superLeagueRuleLegend');
    if(!legend){ legend=document.createElement('div'); legend.id='superLeagueRuleLegend'; legend.className='arena-zone-legend sl-rule-legend'; (panel.querySelector('#standCapture') || panel.firstChild)?.before?.(legend); }
    if(legend) legend.innerHTML='<span class="qualified"><i></i>1º e 2º classificados</span><span class="repechage"><i></i>3º repescagem</span><span><i></i>Demais eliminados</span>';

    const rule = panel.querySelector('.stand-rule');
    if(rule) rule.textContent='1º e 2º se classificam. Os quatro 3º colocados disputam 2 jogos de repescagem. Os 2 vencedores seguem ao play-in.';
    const overview = manager.querySelector('#superLeagueGroupsOverview .slg-overview-head p');
    const total = runtime()?.groups?.()?.reduce?.((sum,g)=>sum+(g.teams?.length||0),0)||0;
    if(overview) overview.textContent=`${total} clubes em 4 grupos. 1º e 2º se classificam; os 3º colocados disputam a repescagem por duas vagas no play-in.`;
    manager.querySelectorAll('#superLeagueGroupsOverview .slg-card header small').forEach(label => { label.textContent='2 classificados + 1 repescagem'; });

    const card = manager.querySelector('.league-knockout-card');
    if(card){
      const title=card.querySelector('h3'), desc=card.querySelector('p'), foot=card.querySelector('footer span'), button=card.querySelector('[data-generate-knockout]');
      if(title) title.textContent='Fase final da Super League';
      if(desc) desc.textContent='4 líderes + 2 melhores segundos vão direto às quartas. Os outros 2 segundos enfrentam os 2 vencedores da repescagem no play-in.';
      if(foot) foot.textContent='2 repescagens • 2 play-ins • 4 quartas • 2 semifinais • final';
      if(button){ button.disabled=!groupsComplete()||finalStructureExists(); button.textContent=finalStructureExists()?'Fase final gerada':groupsComplete()?'Gerar fase final':'Aguardando fase de grupos'; }
    }
  }

  function refresh(){
    if(refreshFrame) return;
    refreshFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{refreshFrame=0;renderRankings();patchUi();}));
  }

  function freshness(game){ return Number(game?.updated||game?.created||0); }
  function mergeAdmin(local,remote){
    const map=new Map(remote.map(game=>[String(game?.id||''),game]));
    local.forEach(game=>{const id=String(game?.id||'');if(!id)return;const old=map.get(id);if(!old||freshness(game)>freshness(old))map.set(id,game);});
    return [...map.values()];
  }
  function applyRemote(remote){
    if(!Array.isArray(remote)||pending()) return false;
    const local=localGames();
    const next=isAdmin()?mergeAdmin(local,remote):remote;
    if(signature(next)===signature(local)) return false;
    const store=matchStore();store[TID]=next;localStorage.setItem(MATCH_KEY,JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:matches-updated',{detail:{tournamentId:TID,reason:'super-league-cloud-received',count:next.length}}));
    runtime()?.refresh?.();refresh();return true;
  }
  async function uploadNewer(remote){
    if(!db||!isAdmin()||pending()) return;
    const merged=mergeAdmin(localGames(),Array.isArray(remote)?remote:[]);
    if(signature(merged)===signature(remote||[])) return;
    try{await db.collection('arenaData').doc(`confrontos-${TID}`).set({dataset:'confrontos',tournamentId:TID,games:merged,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:window.ArenaBDAAuth?.currentEmail?.()||''});}catch{}
  }
  function subscribe(){
    if(!db||unsubscribe) return;
    unsubscribe=db.collection('arenaData').doc(`confrontos-${TID}`).onSnapshot(snapshot=>{
      if(!snapshot.exists){uploadNewer([]);return;}
      const remote=snapshot.data()?.games;if(!Array.isArray(remote))return;
      if(!applyRemote(remote))uploadNewer(remote);
    },()=>{unsubscribe=null;scheduleCloud();});
  }
  function ensureCloud(){
    if(db&&unsubscribe) return true;
    if(!window.firebase||typeof firebase.firestore!=='function'){scheduleCloud();return false;}
    try{db=firebase.firestore();subscribe();retryCount=0;return true;}catch{scheduleCloud();return false;}
  }
  function scheduleCloud(){
    if(retryTimer||retryCount>=60) return;
    retryTimer=setTimeout(()=>{retryTimer=0;retryCount+=1;ensureCloud();},Math.min(1500,250+retryCount*50));
  }

  if(!document.getElementById('superLeagueRuleV3Styles')){
    const style=document.createElement('style');
    style.id='superLeagueRuleV3Styles';
    style.textContent=`
      #giManager[data-tid="bda-super-league"] #autoStandings>.arena-zone-legend:not(#superLeagueRuleLegend){display:none!important}
      #superLeagueRuleLegend{display:flex!important}
      .sl-special-ranking{margin-top:14px!important;border-color:rgba(242,215,125,.26)!important}
      .sl-special-note{margin:0;padding:0 14px 12px;color:var(--muted);font-size:9px;line-height:1.5}
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(1) .stand-pos,
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(2) .stand-pos{color:#041108!important;background:#4fdf8f!important}
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(3) .stand-pos{color:#171207!important;background:#d8b248!important}
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(n+4) .stand-pos{color:#728178!important;background:#111b15!important}
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr .stand-club small{display:none!important}
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(1) .stand-club span::after,
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(2) .stand-club span::after{content:'Classificado';display:block!important;margin-top:3px;color:#69e69b!important;font-size:7px;font-weight:800}
      #giManager[data-tid="bda-super-league"] #autoStandings .stand-group:not(#superLeagueSecondPlaceRanking):not(#superLeagueThirdPlaceRanking) tbody>tr:nth-child(3) .stand-club span::after{content:'Repescagem';display:block!important;margin-top:3px;color:#e3c45f!important;font-size:7px;font-weight:800}
      #superLeagueSecondPlaceRanking tr[data-zone="playin"] .stand-pos{color:#171207!important;background:#f0ce70!important}
      @media(max-width:720px){.sl-special-ranking table{min-width:720px}}
    `;
    document.head.append(style);
  }

  document.addEventListener('click',event=>{
    if(!(event.target instanceof Element)) return;
    const button=event.target.closest('[data-generate-knockout],.arena-v4-generate-final');
    if(!button) return;
    const manager=button.closest('#giManager');
    if(manager?.dataset?.tid!==TID||!mode()) return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();generate();
  },true);

  ['arena:bundle-loaded','arena:matches-updated','arena:quick-score-saved','arena:tournaments-updated','arena:cloud-ready','arena:auth-changed'].forEach(type=>window.addEventListener(type,event=>{
    if(type==='arena:matches-updated'&&event.detail?.reason==='super-league-cloud-received'){refresh();return;}
    refresh();ensureCloud();
    if((type==='arena:matches-updated'||type==='arena:quick-score-saved')&&db&&isAdmin()&&!pending())db.collection('arenaData').doc(`confrontos-${TID}`).get().then(snapshot=>uploadNewer(snapshot.data()?.games||[])).catch(()=>{});
  }));
  window.addEventListener('online',ensureCloud,{passive:true});
  window.addEventListener('storage',event=>{if([MATCH_KEY,TOURNAMENT_KEY].includes(event.key)){refresh();ensureCloud();}});
  const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{childList:true,subtree:true});

  const api=Object.freeze({version:3,refresh,slices:()=>clone(slices()),buildKnockout:()=>clone(buildFinal()),generate,groupsComplete,finalStructureExists});
  window.ArenaBDASuperLeagueRuleV3=api;
  window.ArenaBDASuperLeagueRuleV2=api;
  window.ArenaBDASuperLeagueRepechage=api;
  ensureCloud();refresh();
})();
