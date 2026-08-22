(() => {
  'use strict';

  if (window.ArenaBDASuperLeagueRuleV2?.version >= 2) return;

  const TID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const BACKUP_KEY = 'bda-v6-super-league-third-only-backup';
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
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((o,k) => (o[k]=stable(value[k]),o),{});
    return value;
  };
  const signature = value => JSON.stringify(stable(value));

  function runtime(){ return window.ArenaBDASuperLeagueRuntimeFix || null; }
  function isAdmin(){ return Boolean(window.ArenaBDAAuth?.isAdmin?.()); }
  function pending(){ return Boolean(window.ArenaBDAScoreSync?.isPending?.(TID)); }
  function notify(message){ if(typeof window.toast==='function') window.toast(message); else console.info(message); }

  function matchStore(){
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }
  function localGames(){
    const value = matchStore()[TID];
    return Array.isArray(value) ? value : [];
  }
  function tournaments(){
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function groupSort(a,b){
    return b.pts-a.pts || b.v-a.v || b.sg-a.sg || b.gp-a.gp || a.name.localeCompare(b.name,'pt-BR');
  }
  function rate(row, field){
    const j = Math.max(1, Number(row?.j || 0));
    if(field === 'pts') return Number(row?.pts || 0)/(j*3);
    return Number(row?.[field] || 0)/j;
  }
  function crossSort(a,b){
    return rate(b,'pts')-rate(a,'pts') || rate(b,'v')-rate(a,'v') || rate(b,'sg')-rate(a,'sg') || rate(b,'gp')-rate(a,'gp') || b.pts-a.pts || a.name.localeCompare(b.name,'pt-BR');
  }
  function slices(){
    const data = runtime()?.calculate?.();
    if(!Array.isArray(data) || data.length !== 4) return null;
    const leaders=[], seconds=[], thirds=[];
    data.forEach(group => {
      const rows=[...(group.rows||[])].sort(groupSort);
      if(rows[0]) leaders.push({...rows[0],group:group.name,groupRank:1});
      if(rows[1]) seconds.push({...rows[1],group:group.name,groupRank:2});
      if(rows[2]) thirds.push({...rows[2],group:group.name,groupRank:3});
    });
    const seed = list => [...list].sort(crossSort).map((row,index)=>({...row,seed:index+1}));
    return {groups:data,leaders:seed(leaders),seconds:seed(seconds),thirds:seed(thirds)};
  }
  function mode(){
    const groups=runtime()?.groups?.();
    return Number(runtime()?.qualifiers?.() || 0) === 3 && Array.isArray(groups) && groups.length === 4;
  }
  function groupsComplete(){
    const data=runtime()?.calculate?.();
    if(!Array.isArray(data)||data.length!==4) return false;
    return data.every(group => {
      const rows=Array.isArray(group.rows)?group.rows:[];
      const expected=Math.max(0,rows.length-1);
      return rows.length>=3 && rows.every(row=>Number(row.j||0)>=expected);
    });
  }

  function baseGame(id,pos,a,b,note){
    const now=Date.now();
    return {id,tieId:id,leg:1,phase:'Repescagem',pos,status:'Agendado',ta:a,tb:b,a:'',b:'',pa:'',pb:'',wo:'none',date:'',time:'',place:'',note,created:now+pos,updated:now+pos};
  }
  function buildRepechage(){
    const data=slices();
    if(!data || data.thirds.length!==4) return [];
    const t=data.thirds;
    const stamp=Date.now().toString(36);
    return [
      baseGame(`mata-super-league-${stamp}-rep-1`,1,t[0].name,t[3].name,`Repescagem dos 3º colocados • ${t[0].seed}º melhor 3º x ${t[3].seed}º melhor 3º`),
      baseGame(`mata-super-league-${stamp}-rep-2`,2,t[1].name,t[2].name,`Repescagem dos 3º colocados • ${t[1].seed}º melhor 3º x ${t[2].seed}º melhor 3º`)
    ];
  }

  async function cloudWrite(list){
    ensureCloud();
    if(!db || !isAdmin()) return false;
    try{
      await db.collection('arenaData').doc(`confrontos-${TID}`).set({dataset:'confrontos',tournamentId:TID,games:list,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:window.ArenaBDAAuth?.currentEmail?.()||''});
      return true;
    }catch(error){ console.warn('[Arena BDA] Falha ao sincronizar a repescagem',error); return false; }
  }

  async function generate(){
    if(!isAdmin()) return notify('Apenas o administrador pode gerar a repescagem');
    if(!mode()) return notify('A Super League precisa estar com 3 posições por grupo');
    if(!groupsComplete()) return notify('Finalize todos os jogos da fase de grupos primeiro');
    const rep=buildRepechage();
    if(rep.length!==2) return notify('Não foi possível montar a repescagem');

    try{ localStorage.setItem(BACKUP_KEY,JSON.stringify({savedAt:Date.now(),games:clone(localGames()),tournaments:clone(tournaments())})); }catch{}
    const store=matchStore();
    const current=Array.isArray(store[TID])?store[TID]:[];
    const groups=current.filter(game=>!String(game?.id||'').startsWith('mata-'));
    store[TID]=[...groups,...rep];
    localStorage.setItem(MATCH_KEY,JSON.stringify(store));

    const list=tournaments();
    const index=list.findIndex(item=>String(item?.id||'')===TID);
    if(index>=0){
      list[index]={...list[index],status:'Em andamento',phase:'Repescagem',groupGenerator:{...(list[index].groupGenerator||{}),qualifiers:3,knockoutGenerated:true,knockoutMode:'third-place-only-repechage',repechageQualifiers:2,repechageGeneratedAt:Date.now()}};
      localStorage.setItem(TOURNAMENT_KEY,JSON.stringify(list));
    }

    window.dispatchEvent(new CustomEvent('arena:matches-updated',{detail:{tournamentId:TID,reason:'super-league-third-place-repechage',count:rep.length}}));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated',{detail:{tournamentId:TID,reason:'super-league-third-place-repechage'}}));
    const synced=await cloudWrite(store[TID]);
    notify(synced?'Repescagem criada: 4 terceiros, 2 jogos e 2 classificados':'Repescagem criada; a nuvem será atualizada quando reconectar');
    setTimeout(()=>location.reload(),650);
  }

  function efficiency(row){ return row.j ? Math.round((row.pts/(row.j*3))*100) : 0; }
  function renderThirds(){
    if(!mode()){ document.getElementById('superLeagueThirdPlaceRanking')?.remove(); return; }
    const manager=document.querySelector(`#giManager[data-tid="${TID}"]`);
    const panel=manager?.querySelector('#autoStandings');
    const capture=panel?.querySelector('#standCapture');
    const data=slices();
    if(!panel||panel.hidden||!capture||!data||data.thirds.length!==4) return;
    const sig=JSON.stringify(data.thirds.map(r=>[r.name,r.group,r.pts,r.j,r.v,r.sg,r.gp]));
    let section=document.getElementById('superLeagueThirdPlaceRanking');
    if(section?.dataset.signature===sig) return;
    if(!section){ section=document.createElement('section'); section.id='superLeagueThirdPlaceRanking'; section.className='stand-group sl-repechage-ranking'; capture.append(section); }
    section.dataset.signature=sig;
    section.innerHTML=`<header><div><span class="eyebrow">Repescagem</span><h3>Classificação dos 3º colocados</h3></div><span>4 clubes • 2 avançam</span></header>
      <p class="sl-repechage-note">Os quatro terceiros jogam 1º x 4º e 2º x 3º. Os dois vencedores avançam. Como os grupos têm tamanhos diferentes, o ranking usa aproveitamento antes dos demais critérios.</p>
      <div class="stand-scroll"><table><thead><tr><th>#</th><th>Clube</th><th>Grupo</th><th>PTS</th><th>J</th><th>V</th><th>SG</th><th>GP</th><th>APR</th></tr></thead><tbody>${data.thirds.map((row,index)=>`<tr data-zone="repechage"><td><b class="stand-pos">${index+1}</b></td><td><div class="stand-club"><span><b>${esc(row.name)}</b><small>Repescagem</small></span></div></td><td>${esc(row.group)}</td><td class="stand-points">${row.pts}</td><td>${row.j}</td><td>${row.v}</td><td>${row.sg>0?'+':''}${row.sg}</td><td>${row.gp}</td><td>${efficiency(row)}%</td></tr>`).join('')}</tbody></table></div>`;
  }

  function patchUi(){
    if(!mode()) return;
    const manager=document.querySelector(`#giManager[data-tid="${TID}"]`);
    const panel=manager?.querySelector('#autoStandings');
    if(!manager||!panel) return;

    panel.querySelectorAll('.stand-group:not(#superLeagueThirdPlaceRanking)').forEach(section=>{
      const meta=section.querySelector(':scope > header > span');
      if(meta){ const clubs=(meta.textContent.match(/(\d+)\s*club/i)||[])[1]; meta.textContent=`2 classificam + 1 repescagem${clubs?` • ${clubs} clubes`:''}`; }
      [...section.querySelectorAll('tbody > tr:not(.arena-mobile-stat-detail)')].forEach((row,index)=>{ row.dataset.zone=index<2?'qualified':index===2?'repechage':'out'; });
    });

    const legend=panel.querySelector('.arena-zone-legend');
    if(legend){ legend.dataset.mode='super-league-v2'; legend.innerHTML='<span class="qualified"><i></i>1º e 2º classificados</span><span class="repechage"><i></i>3º repescagem</span><span><i></i>Fora da zona</span>'; }
    const rule=panel.querySelector('.stand-rule');
    if(rule) rule.textContent='1º e 2º de cada grupo se classificam. Somente os 3º colocados disputam a repescagem; 2 clubes avançam.';
    const overview=manager.querySelector('#superLeagueGroupsOverview .slg-overview-head p');
    const total=runtime()?.groups?.()?.reduce?.((sum,g)=>sum+(g.teams?.length||0),0)||0;
    if(overview) overview.textContent=`${total} clubes em 4 grupos. 1º e 2º se classificam; somente os 3º colocados vão para a repescagem, valendo 2 vagas.`;
    manager.querySelectorAll('#superLeagueGroupsOverview .slg-card header small').forEach(label=>{label.textContent='2 classificados + 1 repescagem';});

    const card=manager.querySelector('.league-knockout-card');
    if(card){
      const title=card.querySelector('h3'), desc=card.querySelector('p'), foot=card.querySelector('footer span');
      if(title) title.textContent='Repescagem dos 3º colocados';
      if(desc) desc.textContent='Os quatro terceiros colocados disputam dois jogos. Os dois vencedores avançam para a próxima etapa da fase final.';
      if(foot) foot.textContent='4 terceiros • 2 jogos • 2 classificados';
    }
    const bracketCopy=manager.querySelector('.arena-v3-bracket-head small');
    if(bracketCopy) bracketCopy.textContent='1º e 2º classificados • somente 3º na repescagem • 2 avançam';
    manager.querySelectorAll('.arena-v3-bracket-empty p').forEach(p=>{
      if(norm(p.textContent).includes('2º')||norm(p.textContent).includes('2o')) p.textContent=groupsComplete()?'Os quatro 3º colocados farão dois jogos. Os dois vencedores avançam.':'Finalize os grupos. 1º e 2º se classificam; somente os 3º vão para a repescagem.';
    });
  }

  function refresh(){
    if(refreshFrame) return;
    refreshFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{refreshFrame=0;renderThirds();patchUi();}));
  }

  function freshness(game){ return Number(game?.updated||game?.created||0); }
  function mergeAdmin(local,remote){
    const map=new Map(remote.map(game=>[String(game?.id||''),game]));
    local.forEach(game=>{const id=String(game?.id||''); if(!id)return; const old=map.get(id); if(!old||freshness(game)>freshness(old)) map.set(id,game);});
    return [...map.values()];
  }
  function applyRemote(remote){
    if(!Array.isArray(remote)||pending()) return false;
    const local=localGames();
    const next=isAdmin()?mergeAdmin(local,remote):remote;
    if(signature(next)===signature(local)) return false;
    const store=matchStore(); store[TID]=next; localStorage.setItem(MATCH_KEY,JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('arena:matches-updated',{detail:{tournamentId:TID,reason:'super-league-cloud-received',count:next.length}}));
    runtime()?.refresh?.(); refresh(); return true;
  }
  async function uploadNewer(remote){
    if(!db||!isAdmin()||pending()) return;
    const merged=mergeAdmin(localGames(),Array.isArray(remote)?remote:[]);
    if(signature(merged)===signature(remote||[])) return;
    try{ await db.collection('arenaData').doc(`confrontos-${TID}`).set({dataset:'confrontos',tournamentId:TID,games:merged,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:window.ArenaBDAAuth?.currentEmail?.()||''}); }catch{}
  }
  function subscribe(){
    if(!db||unsubscribe) return;
    unsubscribe=db.collection('arenaData').doc(`confrontos-${TID}`).onSnapshot(snapshot=>{
      if(!snapshot.exists){uploadNewer([]);return;}
      const remote=snapshot.data()?.games;
      if(!Array.isArray(remote)) return;
      if(!applyRemote(remote)) uploadNewer(remote);
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

  if(!document.getElementById('superLeagueRuleV2Styles')){
    const style=document.createElement('style'); style.id='superLeagueRuleV2Styles'; style.textContent=`
      #superLeagueThirdPlaceRanking{margin-top:14px;border-color:rgba(242,215,125,.26)!important}
      #superLeagueThirdPlaceRanking .sl-repechage-note{margin:0;padding:0 14px 12px;color:var(--muted);font-size:9px;line-height:1.5}
      #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="qualified"] .stand-club small{display:none!important}
      #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="qualified"] .stand-club span::after{content:'Classificado';display:block;margin-top:3px;color:#69e69b;font-size:7px;font-weight:800}
      #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="qualified"] .stand-pos{color:#041108!important;background:#4fdf8f!important}
      #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="repechage"] .stand-pos{color:#171207!important;background:#d8b248!important}
      @media(max-width:720px){#superLeagueThirdPlaceRanking table{min-width:720px}}
    `; document.head.append(style);
  }

  document.addEventListener('click',event=>{
    if(!(event.target instanceof Element)) return;
    const button=event.target.closest('[data-generate-knockout]');
    if(!button) return;
    const manager=button.closest('#giManager');
    if(manager?.dataset?.tid!==TID||!mode()) return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();generate();
  },true);

  ['arena:bundle-loaded','arena:matches-updated','arena:quick-score-saved','arena:tournaments-updated','arena:cloud-ready','arena:auth-changed'].forEach(type=>window.addEventListener(type,event=>{
    if(type==='arena:matches-updated'&&event.detail?.reason==='super-league-cloud-received'){refresh();return;}
    refresh();ensureCloud();
    if((type==='arena:matches-updated'||type==='arena:quick-score-saved')&&db&&isAdmin()&&!pending()) db.collection('arenaData').doc(`confrontos-${TID}`).get().then(s=>uploadNewer(s.data()?.games||[])).catch(()=>{});
  }));
  window.addEventListener('online',ensureCloud,{passive:true});
  window.addEventListener('storage',event=>{if([MATCH_KEY,TOURNAMENT_KEY].includes(event.key)){refresh();ensureCloud();}});
  const observer=new MutationObserver(refresh); observer.observe(document.documentElement,{childList:true,subtree:true});

  const api=Object.freeze({version:2,refresh,slices:()=>clone(slices()),pairs:()=>clone(buildRepechage()),buildKnockout:()=>clone(buildRepechage()),generate});
  window.ArenaBDASuperLeagueRuleV2=api;
  window.ArenaBDASuperLeagueRepechage=api;
  ensureCloud(); refresh();
})();
