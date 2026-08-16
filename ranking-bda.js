(() => {
'use strict';

const KEYS={teams:'bda-v2-teams',champions:'bda-v2-champions',tournaments:'bda-v3-tournaments',matches:'bda-v3-confrontos'};
const POINTS={win:3,draw:1,participation:10,finalWin:50,runnerUp:25,title:100};
const watched=new Set(Object.values(KEYS));
const nativeSet=Storage.prototype.setItem;
const nativeRemove=Storage.prototype.removeItem;
let mode='history',month='',timer=0;

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const placeholder=v=>/^vencedor\s+/i.test(String(v||''));
const number=v=>v!==''&&v!=null&&!Number.isNaN(Number(v));

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function teams(){const x=read(KEYS.teams,[]);return Array.isArray(x)?x:[]}
function champions(){const x=read(KEYS.champions,[]);return Array.isArray(x)?x:[]}
function tournaments(){const x=read(KEYS.tournaments,[]);return Array.isArray(x)?x:[]}
function matchStore(){const x=read(KEYS.matches,{});return x&&typeof x==='object'?x:{}}

function canonicalMap(){
  const map=new Map();
  const add=(name,extra={})=>{
    if(!name||placeholder(name))return;
    const key=norm(name),old=map.get(key)||{};
    map.set(key,{name:old.name||String(name).trim(),...old,...extra});
  };
  teams().forEach(t=>add(t?.name,{badge:t?.badge||'',code:t?.code||'',master:t?.master||''}));
  champions().forEach(c=>add(c?.name));
  tournaments().forEach(t=>(t?.participants||[]).forEach(add));
  Object.values(matchStore()).forEach(list=>(Array.isArray(list)?list:[]).forEach(g=>{add(g?.ta);add(g?.tb)}));
  return map;
}

function monthKey(game){return /^\d{4}-\d{2}/.test(String(game?.date||''))?String(game.date).slice(0,7):''}
function gameTime(game){
  if(game?.date){const value=Date.parse(`${game.date}T${game.time||'00:00'}:00`);if(!Number.isNaN(value))return value}
  return Number(game?.updated||game?.created||0);
}
function finished(game){return ['a','b'].includes(game?.wo)||(number(game?.a)&&number(game?.b))}
function sideScore(game,side){
  if(game?.wo==='a')return side==='a'?3:0;
  if(game?.wo==='b')return side==='b'?3:0;
  const value=side==='a'?game?.a:game?.b;
  return number(value)?Number(value):null;
}
function phaseIsFinal(value){const p=norm(value);return p==='final'||p.includes('grande final')}
function tieCode(value){return norm(value).replace(/\s+/g,'').replace(/-(ida|volta|v)$/,'')}
function refCode(value){const match=String(value||'').match(/^Vencedor\s+(.+)$/i);return match?tieCode(match[1]):''}

function resolver(rawGames){
  const groups=new Map();
  rawGames.forEach((game,index)=>{
    const tie=String(game?.tieId||game?.id||`j-${index}`);
    if(!groups.has(tie))groups.set(tie,[]);
    groups.get(tie).push({...game,_index:index});
  });
  groups.forEach(list=>list.sort((a,b)=>Number(a.leg||1)-Number(b.leg||1)||gameTime(a)-gameTime(b)));
  const byCode=new Map([...groups].map(([key,list])=>[tieCode(key),list]));
  const cache=new Map();
  function resolveName(name,seen=new Set()){
    const code=refCode(name);
    if(!code||seen.has(code))return String(name||'');
    seen.add(code);
    return winner(byCode.get(code),seen)?.team||String(name||'');
  }
  function winner(list,seen=new Set()){
    if(!list?.length)return null;
    const cacheKey=String(list[0]?.tieId||list[0]?.id||'');
    if(cache.has(cacheKey))return cache.get(cacheKey);
    const totals=new Map();
    let complete=true,last=list[list.length-1];
    list.forEach(game=>{
      const a=resolveName(game.ta,new Set(seen)),b=resolveName(game.tb,new Set(seen));
      const sa=sideScore(game,'a'),sb=sideScore(game,'b');
      if(sa==null||sb==null)complete=false;
      if(!placeholder(a))totals.set(a,(totals.get(a)||0)+(sa||0));
      if(!placeholder(b))totals.set(b,(totals.get(b)||0)+(sb||0));
    });
    const entries=[...totals.entries()];
    let team='';
    if(complete&&entries.length>=2){
      entries.sort((a,b)=>b[1]-a[1]);
      if(entries[0][1]!==entries[1][1])team=entries[0][0];
      else if(number(last?.pa)&&number(last?.pb)&&Number(last.pa)!==Number(last.pb)){
        team=Number(last.pa)>Number(last.pb)?resolveName(last.ta,new Set(seen)):resolveName(last.tb,new Set(seen));
      }
    }
    const result={team,totals,complete};cache.set(cacheKey,result);return result;
  }
  return{groups,resolveName,winner};
}

function blank(name,meta={}){return{name,code:meta.code||'',badge:meta.badge||'',master:meta.master||'',points:0,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,sg:0,titles:0,runnerUps:0,participations:0,streak:0,lastGames:[]}}

function calculate(filterMonth=''){
  const canon=canonicalMap(),stats=new Map();
  const get=name=>{
    if(!name||placeholder(name))return null;
    const key=norm(name),meta=canon.get(key)||{name:String(name).trim()};
    if(!stats.has(key))stats.set(key,blank(meta.name,meta));
    return stats.get(key);
  };
  const allMatches=[];

  tournaments().forEach(tournament=>{
    const stored=Array.isArray(matchStore()[tournament.id])?matchStore()[tournament.id]:[];
    const raw=window.ArenaBDAValidMatches?.forTournament(tournament,stored)||stored;
    const solve=resolver(raw);
    const historical=!filterMonth;
    if(historical)(tournament.participants||[]).forEach(name=>{const s=get(name);if(s){s.points+=POINTS.participation;s.participations++}});

    raw.forEach(game=>{
      if(!finished(game))return;
      if(filterMonth&&monthKey(game)!==filterMonth)return;
      const aName=solve.resolveName(game.ta),bName=solve.resolveName(game.tb);
      const a=get(aName),b=get(bName);if(!a||!b)return;
      const sa=sideScore(game,'a'),sb=sideScore(game,'b');if(sa==null||sb==null)return;
      a.played++;b.played++;a.gf+=sa;a.ga+=sb;b.gf+=sb;b.ga+=sa;
      if(sa>sb){a.wins++;b.losses++;a.points+=POINTS.win}
      else if(sb>sa){b.wins++;a.losses++;b.points+=POINTS.win}
      else{a.draws++;b.draws++;a.points+=POINTS.draw;b.points+=POINTS.draw}
      allMatches.push({time:gameTime(game),a:aName,b:bName,sa,sb});
    });

    if(!filterMonth){
      solve.groups.forEach(list=>{
        if(!phaseIsFinal(list[0]?.phase))return;
        const result=solve.winner(list);if(!result?.team)return;
        const names=[...result.totals.keys()];
        const champion=get(result.team);if(champion)champion.points+=POINTS.finalWin;
        const runnerName=names.find(name=>norm(name)!==norm(result.team));
        const runner=get(runnerName);if(runner){runner.points+=POINTS.runnerUp;runner.runnerUps++}
      });
    }
  });

  if(!filterMonth){
    champions().forEach(champion=>{const s=get(champion?.name);if(s){s.points+=POINTS.title;s.titles++}});
  }

  allMatches.sort((a,b)=>b.time-a.time);
  stats.forEach(s=>{
    s.sg=s.gf-s.ga;
    const recent=allMatches.filter(g=>norm(g.a)===norm(s.name)||norm(g.b)===norm(s.name));
    let streak=0;
    for(const game of recent){const isA=norm(game.a)===norm(s.name),won=isA?game.sa>game.sb:game.sb>game.sa;if(!won)break;streak++}
    s.streak=streak;
    s.lastGames=recent.slice(0,5).map(game=>{const isA=norm(game.a)===norm(s.name),own=isA?game.sa:game.sb,opp=isA?game.sb:game.sa;return own>opp?'V':own===opp?'E':'D'});
  });
  return[...stats.values()];
}

function rankingData(){
  const base=calculate(mode==='monthly'?month:'');
  return base.sort((a,b)=>{
    if(mode==='titles')return b.titles-a.titles||b.runnerUps-a.runnerUps||b.points-a.points||a.name.localeCompare(b.name,'pt-BR');
    return b.points-a.points||b.titles-a.titles||b.sg-a.sg||b.gf-a.gf||a.name.localeCompare(b.name,'pt-BR');
  });
}
function availableMonths(){
  const set=new Set();Object.values(matchStore()).forEach(list=>(Array.isArray(list)?list:[]).forEach(g=>{const m=monthKey(g);if(m)set.add(m)}));
  return[...set].sort().reverse();
}
function monthLabel(value){if(!value)return'Sem mês';const[y,m]=value.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1))}
function badge(row,large=false){const c=`rank-badge${large?' large':''}`;return row.badge?`<span class="${c}"><img src="${esc(row.badge)}" alt="Escudo de ${esc(row.name)}"></span>`:`<span class="${c}">${esc(row.code||row.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</span>`}
function form(row){return row.lastGames.length?row.lastGames.map(v=>`<i data-result="${v}">${v}</i>`).join(''):'<span>Sem jogos</span>'}
function positionClass(index){return index===0?'gold':index===1?'silver':index===2?'bronze':''}

function renderPodium(data){
  const top=data.slice(0,3);if(!top.length)return'<div class="rank-empty">O ranking será preenchido quando houver clubes e resultados.</div>';
  const order=top.length>=3?[top[1],top[0],top[2]]:top;
  return`<div class="rank-podium">${order.map(row=>{const original=top.indexOf(row),pos=original+1;return`<article class="rank-podium-card ${positionClass(original)}" data-place="${pos}"><span class="rank-place">${pos}º</span>${badge(row,true)}<h3>${esc(row.name)}</h3><b>${mode==='titles'?`${row.titles} título${row.titles===1?'':'s'}`:`${row.points} pts`}</b><small>${row.wins} vitórias • ${row.titles} 🏆</small></article>`}).join('')}</div>`;
}
function renderTable(data){
  if(!data.length)return'<div class="rank-empty">Nenhum resultado disponível para este período.</div>';
  return`<div class="rank-table-wrap"><table class="rank-table"><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>🏆</th><th>Sequência</th><th>Forma</th></tr></thead><tbody>${data.map((row,index)=>`<tr><td><span class="rank-pos ${positionClass(index)}">${index+1}</span></td><td><div class="rank-club">${badge(row)}<span><b>${esc(row.name)}</b><small>${row.master?`Mestre ${esc(row.master)}`:`${row.participations} participações`}</small></span></div></td><td class="rank-points">${row.points}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td class="${row.sg>0?'positive':row.sg<0?'negative':''}">${row.sg>0?'+':''}${row.sg}</td><td>${row.titles}</td><td>${row.streak?`${row.streak} V`:'–'}</td><td><div class="rank-form">${form(row)}</div></td></tr>`).join('')}</tbody></table></div>`;
}
function renderHall(data){
  const hall=[...data].filter(x=>x.titles||x.runnerUps).sort((a,b)=>b.titles-a.titles||b.runnerUps-a.runnerUps||b.points-a.points).slice(0,6);
  if(!hall.length)return'<div class="rank-empty">A Galeria de Campeões alimentará automaticamente o Hall da Fama.</div>';
  return`<div class="rank-hall">${hall.map((row,index)=>`<article><span>${index<3?['👑','🥈','🥉'][index]:'🏅'}</span>${badge(row,true)}<div><h3>${esc(row.name)}</h3><p><b>${row.titles}</b> títulos • <b>${row.runnerUps}</b> vices</p></div></article>`).join('')}</div>`;
}

function pageHtml(){
  const months=availableMonths();if(!month)month=months[0]||new Date().toISOString().slice(0,7);
  const data=rankingData(),leader=data[0];
  return`<div class="rank-hero"><div><span class="eyebrow">Disputa permanente do Clã BDA</span><h1>Ranking Geral BDA</h1><p>Títulos, campanhas, resultados e regularidade reunidos em uma classificação viva.</p></div><aside><span>Líder atual</span><b>${esc(leader?.name||'A definir')}</b><small>${leader?`${leader.points} pontos • ${leader.titles} títulos`:'Cadastre resultados para começar'}</small></aside></div>
  <div class="rank-toolbar"><nav><button data-rank-mode="history" class="${mode==='history'?'active':''}">Histórico</button><button data-rank-mode="monthly" class="${mode==='monthly'?'active':''}">Mensal</button><button data-rank-mode="titles" class="${mode==='titles'?'active':''}">Títulos</button></nav><label class="rank-month ${mode==='monthly'?'show':''}">Mês<select id="rankMonth">${months.length?months.map(m=>`<option value="${m}" ${m===month?'selected':''}>${esc(monthLabel(m))}</option>`).join(''):`<option value="${month}">${esc(monthLabel(month))}</option>`}</select></label><div class="rank-actions"><button class="ghost" id="rankRefresh">↻ Atualizar</button><button class="primary" id="rankPhoto">📸 Foto</button></div></div>
  <section id="rankCapture"><div class="section-head"><div><span class="eyebrow">Pódio da arena</span><h2>${mode==='monthly'?`Ranking de ${esc(monthLabel(month))}`:mode==='titles'?'Maiores campeões':'Classificação histórica'}</h2><p>${mode==='monthly'?'Somente partidas com data no mês escolhido.':'Atualização automática a partir dos campeonatos.'}</p></div></div>${renderPodium(data)}<div class="section-head"><div><h2>Classificação completa</h2><p>Desempate por títulos, saldo de gols e gols marcados.</p></div></div>${renderTable(data)}</section>
  <div class="rank-lower"><section><div class="section-head"><div><span class="eyebrow">Imortais da arena</span><h2>Hall da Fama</h2><p>Clubes registrados na Galeria de Campeões.</p></div></div>${renderHall(calculate())}</section><section><div class="section-head"><div><span class="eyebrow">Pontuação transparente</span><h2>Regras do ranking</h2><p>Cada evento soma automaticamente.</p></div></div><div class="rank-rules"><article><b>+${POINTS.title}</b><span>Título na galeria</span></article><article><b>+${POINTS.finalWin}</b><span>Vitória na final</span></article><article><b>+${POINTS.runnerUp}</b><span>Vice-campeonato</span></article><article><b>+${POINTS.participation}</b><span>Participação</span></article><article><b>+${POINTS.win}</b><span>Vitória</span></article><article><b>+${POINTS.draw}</b><span>Empate</span></article></div></section></div>`;
}

function buildPage(){
  let page=$('[data-page="ranking"]');
  if(!page){page=document.createElement('section');page.className='page';page.dataset.page='ranking';$('main')?.append(page)}
  page.innerHTML=pageHtml();
  $('#rankMonth')?.addEventListener('change',e=>{month=e.target.value;render()});
  $('#rankRefresh')?.addEventListener('click',()=>{render();notify('Ranking atualizado')});
  $('#rankPhoto')?.addEventListener('click',()=>{
    if(window.ArenaBDACapture?.element)window.ArenaBDACapture.element($('#rankCapture'),'Ranking Geral BDA','ranking-geral-bda');
    else notify('A ferramenta de imagem ainda está carregando');
  });
}
function notify(message){typeof toast==='function'?toast(message):console.info(message)}
function installNavigation(){
  const nav=$('.bottom-nav');
  if(nav&&!$('[data-go="ranking"]',nav)){
    const btn=document.createElement('button');btn.className='nav-btn';btn.dataset.go='ranking';btn.innerHTML='<i>📊</i><span>Ranking</span>';
    const championsBtn=$('[data-go="champions"]',nav);championsBtn?.after(btn);
    btn.addEventListener('click',()=>{if(typeof navigate==='function')navigate('ranking');else{$$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page==='ranking'))}render()});
  }
  const hero=$('[data-page="home"] .hero-actions');
  if(hero&&!$('[data-go="ranking"]',hero)){const b=document.createElement('button');b.className='ghost';b.dataset.go='ranking';b.textContent='Ver ranking BDA';b.addEventListener('click',()=>{navigate('ranking');render()});hero.append(b)}
  const adminTools=$('#adminPanel .admin-tools');
  if(adminTools&&!$('[data-go="ranking"]',adminTools)){const b=document.createElement('button');b.className='ghost';b.dataset.go='ranking';b.textContent='Ranking geral';b.addEventListener('click',()=>{navigate('ranking');render()});adminTools.append(b)}
}
function render(){buildPage();installNavigation()}
function later(){clearTimeout(timer);timer=setTimeout(render,100)}

const style=document.createElement('style');style.textContent=`.bottom-nav{grid-template-columns:repeat(6,1fr)!important}.rank-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.35fr .65fr;gap:18px;align-items:end;padding:25px;border:1px solid var(--line-strong);border-radius:28px;background:radial-gradient(circle at 85% 0,rgba(242,215,125,.30),transparent 34%),linear-gradient(135deg,#173e29,#07130d 63%,#030806);box-shadow:var(--shadow)}.rank-hero:after{content:"BDA";position:absolute;right:-12px;bottom:-35px;color:#fff1;font:900 150px/1 "Barlow Condensed",sans-serif}.rank-hero>div,.rank-hero aside{position:relative;z-index:1}.rank-hero h1{margin:7px 0;font-size:clamp(42px,9vw,72px)}.rank-hero p{max-width:590px;margin:0;color:#cad6ce;font-size:12px}.rank-hero aside{padding:15px;border:1px solid #f2d77d42;border-radius:18px;background:#0308068c}.rank-hero aside span,.rank-hero aside b,.rank-hero aside small{display:block}.rank-hero aside span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}.rank-hero aside b{margin:6px 0;font:900 25px "Barlow Condensed",sans-serif;text-transform:uppercase}.rank-hero aside small{color:var(--muted);font-size:9px}.rank-toolbar{position:sticky;top:72px;z-index:24;display:flex;align-items:end;gap:10px;margin:11px 0;padding:8px;border:1px solid var(--line);border-radius:18px;background:#050c08eb;box-shadow:0 13px 34px #0006;backdrop-filter:blur(16px)}.rank-toolbar nav{display:flex;gap:5px}.rank-toolbar nav button{min-height:38px;padding:0 12px;border:0;border-radius:11px;color:var(--muted);background:transparent;font-size:9px;font-weight:900;text-transform:uppercase}.rank-toolbar nav button.active{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.rank-month{display:none;min-width:180px}.rank-month.show{display:grid}.rank-month select{padding:9px}.rank-actions{display:flex;gap:7px;margin-left:auto}.rank-actions button{min-height:38px;padding:0 11px;font-size:9px}.rank-podium{display:grid;grid-template-columns:repeat(3,1fr);align-items:end;gap:10px}.rank-podium-card{position:relative;overflow:hidden;display:grid;justify-items:center;min-height:210px;padding:17px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(150deg,var(--surface-2),var(--surface));text-align:center}.rank-podium-card[data-place="1"]{min-height:245px;border-color:#f2d77d70;background:radial-gradient(circle at 50% 0,#f2d77d35,transparent 38%),linear-gradient(150deg,#23452f,#07100c)}.rank-podium-card:after{content:attr(data-place);position:absolute;right:-4px;bottom:-33px;color:#fff0;font:900 130px "Barlow Condensed",sans-serif}.rank-podium-card.gold:after{color:#f2d77d13}.rank-podium-card.silver:after{color:#dce5e512}.rank-podium-card.bronze:after{color:#d38b5315}.rank-place{position:absolute;left:11px;top:11px;padding:6px 8px;border-radius:999px;color:#171107;background:var(--gold-soft);font-size:9px;font-weight:900}.rank-podium-card h3{position:relative;margin:10px 0 4px;font-size:21px;text-transform:uppercase}.rank-podium-card>b{position:relative;color:var(--gold-soft);font-size:14px}.rank-podium-card small{position:relative;margin-top:6px;color:var(--muted);font-size:8px}.rank-badge{overflow:hidden;display:grid;place-items:center;width:36px;height:36px;flex:0 0 auto;border:1px solid #f2d77d62;border-radius:50%;color:#171107;background:linear-gradient(145deg,#f7e49d,#bd8e20);font-size:8px;font-weight:900}.rank-badge.large{position:relative;width:72px;height:72px;margin-top:16px;border-width:3px;font-size:15px;box-shadow:0 10px 25px #0007}.rank-badge img{width:100%;height:100%;object-fit:cover}.rank-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:20px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.rank-table{width:100%;min-width:900px;border-collapse:collapse}.rank-table th,.rank-table td{padding:11px 9px;border-bottom:1px solid var(--line);font-size:9px;text-align:center}.rank-table th{position:sticky;top:0;color:var(--gold-soft);background:#07100cf5;font-size:8px;text-transform:uppercase}.rank-table tr:last-child td{border-bottom:0}.rank-table tbody tr:hover{background:#ffffff05}.rank-club{display:flex;align-items:center;gap:9px;text-align:left}.rank-club span span{display:block}.rank-club b,.rank-club small{display:block}.rank-club b{font-size:10px}.rank-club small{margin-top:3px;color:var(--muted);font-size:7px}.rank-pos{display:grid;place-items:center;width:26px;height:26px;margin:auto;border-radius:8px;color:var(--muted);background:#ffffff08;font-weight:900}.rank-pos.gold{color:#171107;background:#f2d77d}.rank-pos.silver{color:#171107;background:#cbd4d0}.rank-pos.bronze{color:#171107;background:#bf8050}.rank-points{color:var(--gold-soft);font-size:13px!important;font-weight:900}.positive{color:var(--green)}.negative{color:#ff9aa4}.rank-form{display:flex;justify-content:center;gap:3px}.rank-form i{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;font-style:normal;font-size:7px;font-weight:900}.rank-form i[data-result="V"]{color:#07100c;background:var(--green)}.rank-form i[data-result="E"]{color:#171107;background:var(--gold-soft)}.rank-form i[data-result="D"]{color:#fff;background:var(--red)}.rank-form span{color:var(--muted);font-size:7px}.rank-lower{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rank-hall{display:grid;gap:8px}.rank-hall article{display:grid;grid-template-columns:34px 54px 1fr;align-items:center;gap:9px;padding:10px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.rank-hall article>span{font-size:22px;text-align:center}.rank-hall .rank-badge{width:48px;height:48px}.rank-hall h3{margin:0;font-size:16px;text-transform:uppercase}.rank-hall p{margin:3px 0 0;color:var(--muted);font-size:8px}.rank-hall p b{color:var(--gold-soft)}.rank-rules{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.rank-rules article{padding:14px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.rank-rules b,.rank-rules span{display:block}.rank-rules b{color:var(--gold-soft);font:900 25px "Barlow Condensed",sans-serif}.rank-rules span{color:var(--muted);font-size:8px;text-transform:uppercase}.rank-empty{padding:28px;border:1px dashed var(--line-strong);border-radius:18px;color:var(--muted);text-align:center;font-size:10px}@media(max-width:760px){.rank-hero{grid-template-columns:1fr}.rank-toolbar{top:64px;display:grid;grid-template-columns:1fr}.rank-toolbar nav{display:grid;grid-template-columns:repeat(3,1fr)}.rank-toolbar nav button{padding:0 5px}.rank-month{min-width:0}.rank-actions{width:100%;margin:0}.rank-actions button{flex:1}.rank-podium{grid-template-columns:1fr}.rank-podium-card,.rank-podium-card[data-place="1"]{min-height:175px}.rank-podium-card[data-place="1"]{order:-1}.rank-lower{grid-template-columns:1fr}.bottom-nav{overflow-x:auto;grid-template-columns:repeat(6,minmax(62px,1fr))!important}.nav-btn{font-size:8px}}`;document.head.append(style);

document.addEventListener('click',event=>{const tab=event.target.closest('[data-rank-mode]');if(tab){mode=tab.dataset.rankMode;render()}});
Storage.prototype.setItem=function(key,value){nativeSet.call(this,key,value);if(this===localStorage&&watched.has(key))later()};
Storage.prototype.removeItem=function(key){nativeRemove.call(this,key);if(this===localStorage&&watched.has(key))later()};
window.addEventListener('storage',event=>{if(watched.has(event.key))later()});

installNavigation();render();
})();
