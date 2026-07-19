<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Copa Grifo BDA — Chaveamento</title>
<meta name="theme-color" content="#0E0F13">
<meta name="description" content="Chaveamento oficial da Copa Grifo BDA — sorteio, resultados e classificação do torneio do Clã BDA.">
<meta property="og:title" content="Copa Grifo BDA — Chaveamento">
<meta property="og:description" content="🦅 Onde somente os mais fortes chegam ao topo! Acompanhe o mata-mata do Clã BDA.">
<meta property="og:type" content="website">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A6%85%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0E0F13; --panel:#171922; --panel2:#1E2130;
  --gold:#D4A62A; --gold-hi:#F0D37A; --red:#B3342E;
  --ink:#E8E6DC; --ink-dim:#8B8A80; --line:#2A2D3D;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;min-height:100vh;padding-bottom:96px}
.wrap{max-width:520px;margin:0 auto;padding:0 14px}

header{text-align:center;padding:26px 14px 18px;border-bottom:1px solid var(--line);position:relative;overflow:hidden}
header::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 90% at 50% -20%,rgba(212,166,42,.14),transparent 65%);pointer-events:none}
.crest{font-size:44px;line-height:1;filter:drop-shadow(0 0 14px rgba(212,166,42,.45))}
h1{font-family:'Cinzel',serif;font-weight:800;font-size:26px;letter-spacing:.06em;color:var(--gold-hi);margin-top:6px}
.tagline{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--ink-dim);margin-top:6px}
#progress{max-width:220px;margin:14px auto 0;height:4px;background:var(--panel2);border-radius:2px;overflow:hidden}
#progressFill{height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-hi));border-radius:2px;transition:width .4s}
#progressLbl{font-size:10px;color:var(--ink-dim);letter-spacing:.15em;margin-top:6px;text-transform:uppercase}

#championBanner{display:none;margin:16px auto 0;max-width:520px;padding:0 14px}
#championBanner .inner{border:1px solid var(--gold);background:linear-gradient(160deg,#241E0C,#171922);border-radius:12px;padding:18px;text-align:center;box-shadow:0 0 30px rgba(212,166,42,.25);animation:champGlow 2.4s ease-in-out infinite}
@keyframes champGlow{0%,100%{box-shadow:0 0 22px rgba(212,166,42,.2)}50%{box-shadow:0 0 42px rgba(212,166,42,.5)}}
@media (prefers-reduced-motion: reduce){#championBanner .inner{animation:none}}
#championBanner .lbl{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold)}
#championBanner .name{font-family:'Cinzel',serif;font-weight:800;font-size:22px;color:var(--gold-hi);margin-top:6px}

nav{display:flex;gap:6px;overflow-x:auto;padding:16px 14px 4px;max-width:520px;margin:0 auto;scrollbar-width:none}
nav::-webkit-scrollbar{display:none}
.tab{flex:0 0 auto;border:1px solid var(--line);background:var(--panel);color:var(--ink-dim);border-radius:20px;padding:8px 15px;font-size:13px;font-weight:600;cursor:pointer;transition:.15s}
.tab.active{border-color:var(--gold);color:var(--gold-hi);background:var(--panel2)}

.phase{display:none;padding-top:12px}
.phase.show{display:block}

.match{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden;cursor:pointer;transition:border-color .15s}
.match:active{border-color:var(--gold)}
.match .mid{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.2em;color:var(--ink-dim);padding:8px 12px 0;text-transform:uppercase}
.match .mid .dt{color:var(--gold);letter-spacing:.05em}
.row{display:flex;align-items:center;padding:9px 12px;gap:10px}
.row + .row{border-top:1px dashed var(--line)}
.badge{width:30px;height:30px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#0E0F13;border:1.5px solid rgba(255,255,255,.15);overflow:hidden;background-size:cover;background-position:center}
.badge.tbd{background:var(--panel2)!important;color:var(--ink-dim);border-style:dashed}
.tname{font-size:14px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tname.tbd{color:var(--ink-dim);font-weight:400;font-style:italic}
.tname.win{color:var(--gold-hi)}
.tname.lose{color:var(--ink-dim);text-decoration:line-through;text-decoration-color:var(--red);text-decoration-thickness:1.5px}
.score{font-size:16px;font-weight:800;min-width:26px;text-align:center;color:var(--ink)}
.score.pen{font-size:11px;color:var(--gold);font-weight:600;margin-left:5px}
.wo-flag{font-size:10px;color:var(--red);font-weight:700;letter-spacing:.1em}

#treeScroll{overflow-x:auto;padding:14px 14px 8px;-webkit-overflow-scrolling:touch}
#tree{display:flex;gap:14px;min-width:max-content}
.tcol{display:flex;flex-direction:column;justify-content:space-around;gap:8px;width:150px}
.tcol h4{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.18em;color:var(--gold);text-transform:uppercase;text-align:center;margin-bottom:2px}
.tm{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 8px;cursor:pointer}
.tm div{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;gap:6px}
.tm span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:105px}
.tm .w{color:var(--gold-hi);font-weight:700}
.tm .l{color:var(--ink-dim);text-decoration:line-through}
.tm .t{color:var(--ink-dim);font-style:italic}

.actions{position:fixed;bottom:0;left:0;right:0;background:linear-gradient(transparent,var(--bg) 30%);padding:18px 10px 16px;z-index:5}
.actions .inner{max-width:520px;margin:0 auto;display:flex;gap:8px}
button.big{flex:1;border:none;border-radius:12px;padding:14px 6px;font-size:13px;font-weight:700;cursor:pointer}
#btnShare{background:var(--gold);color:#14120A}
#btnImg{background:var(--panel2);color:var(--gold-hi);border:1px solid var(--gold)}
#btnTeams{background:var(--panel2);color:var(--ink);border:1px solid var(--line);flex:0 0 auto;padding:14px 13px}
#btnDraw,#btnLink{background:var(--panel2);color:var(--gold-hi);border:1px solid var(--line);flex:0 0 auto;padding:14px 13px}
#btnReset{background:var(--panel2);color:var(--ink-dim);border:1px solid var(--line);flex:0 0 auto;padding:14px 13px}

#overlay,#drawOverlay,#teamsOverlay{display:none;position:fixed;inset:0;background:rgba(8,9,12,.86);z-index:10;align-items:flex-end;justify-content:center}
#overlay.show,#drawOverlay.show,#teamsOverlay.show{display:flex}
#drawOverlay{align-items:center;padding:20px;z-index:15}
.sheet{background:var(--panel2);border:1px solid var(--line);border-bottom:none;border-radius:16px 16px 0 0;width:100%;max-width:520px;padding:20px 18px 26px;max-height:88vh;overflow-y:auto;display:flex;flex-direction:column}
.sheet h3{font-family:'Cinzel',serif;font-size:15px;color:var(--gold);letter-spacing:.1em;margin-bottom:14px;text-transform:uppercase;flex:0 0 auto}
.minput{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.minput label{flex:1;font-size:14px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.minput input[type=number]{width:58px;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:16px;font-weight:700;text-align:center}
input:focus{outline:2px solid var(--gold);outline-offset:1px}
.dtrow{display:flex;align-items:center;gap:10px;margin:2px 0 12px}
.dtrow label{font-size:12px;color:var(--ink-dim);flex:0 0 auto}
.dtrow input{flex:1;padding:9px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:13px;color-scheme:dark}
.wo-btn{border:1px solid var(--line);background:transparent;color:var(--ink-dim);border-radius:8px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer}
.wo-btn.on{border-color:var(--red);color:var(--red)}
#penBox{display:none;margin:6px 0 4px;padding-top:10px;border-top:1px dashed var(--line)}
#penBox .pt{font-size:11px;color:var(--gold);letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px}
.mact{display:flex;gap:10px;margin-top:16px;flex:0 0 auto}
.mact button{flex:1;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer}
.btn-gold{background:var(--gold);color:#14120A}
.btn-dim{background:var(--panel);color:var(--ink-dim);border:1px solid var(--line)}
.btn-red{background:transparent;color:var(--red);border:1px solid var(--red);flex:0 0 auto!important;padding:13px 14px!important}

#drawBox{background:var(--panel2);border:1px solid var(--gold);border-radius:14px;width:100%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;padding:18px;box-shadow:0 0 40px rgba(212,166,42,.2)}
#drawBox h3{font-family:'Cinzel',serif;color:var(--gold);font-size:16px;letter-spacing:.12em;text-align:center;margin-bottom:12px;text-transform:uppercase}
#drawList{overflow-y:auto;flex:1;min-height:120px}
.ditem{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:var(--panel);animation:dpop .35s ease}
@keyframes dpop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.ditem{animation:none}}
.ditem .dl{font-size:10px;letter-spacing:.18em;color:var(--ink-dim);text-transform:uppercase;margin-bottom:3px}
.ditem .dn{font-size:13px;font-weight:700;color:var(--gold-hi)}
#drawClose{margin-top:12px;border:none;border-radius:10px;padding:12px;font-weight:700;background:var(--gold);color:#14120A;cursor:pointer}

/* editor de times */
#teamsList{flex:1;overflow-y:auto;min-height:100px}
.trow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line)}
.trow .badge{width:38px;height:38px;font-size:13px;cursor:pointer;flex:0 0 auto}
.trow input[type=text]{flex:1;min-width:0;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:14px;font-weight:600}
.trow .rm{border:none;background:transparent;color:var(--red);font-size:18px;font-weight:700;cursor:pointer;padding:6px}
#teamsHint{font-size:11px;color:var(--ink-dim);margin:8px 0 4px;line-height:1.5}
#btnAddTeam{margin-top:10px;border:1px dashed var(--gold);background:transparent;color:var(--gold-hi);border-radius:10px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;flex:0 0 auto}

#toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:var(--gold);color:#14120A;font-weight:700;font-size:13px;padding:10px 18px;border-radius:20px;opacity:0;pointer-events:none;transition:.25s;z-index:30}
#toast.show{opacity:1}
#confetti{position:fixed;inset:0;pointer-events:none;z-index:25}

/* módulos profissionais */
.dashboard{padding:14px 0 110px}.gridStats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.statCard{background:linear-gradient(155deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:12px;padding:14px}.statCard .v{font:800 26px 'Cinzel',serif;color:var(--gold-hi)}.statCard .k{font-size:10px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.15em;margin-top:4px}.sectionTitle{font:800 15px 'Cinzel',serif;color:var(--gold);margin:18px 0 10px;letter-spacing:.08em}.rankRow{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:11px;margin-bottom:8px}.rankRow .pos{font-weight:800;color:var(--gold)}.rankRow .pts{font-weight:800;color:var(--gold-hi)}.emptyBox{padding:28px 16px;text-align:center;color:var(--ink-dim);border:1px dashed var(--line);border-radius:12px}.goalInputs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.goalInputs textarea,.extraInput{width:100%;min-height:72px;resize:vertical;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:12px}.extraInput{min-height:auto;margin-top:8px}.miniLabel{font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin:8px 0 5px}.adminBar{display:flex;gap:8px;margin-top:12px}.adminBar button{flex:1;border-radius:10px;padding:10px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font-weight:700}.lockedNote{font-size:11px;color:var(--ink-dim);margin-top:8px}.installBanner{display:none;margin:12px 14px 0;max-width:492px;padding:12px;border:1px solid var(--gold);border-radius:12px;background:#211c0d;align-items:center;gap:10px}.installBanner button{margin-left:auto;border:0;border-radius:8px;background:var(--gold);padding:9px 12px;font-weight:800;color:#14120A}

</style>
</head>
<body>

<header>
  <div class="crest">🦅</div>
  <h1>COPA GRIFO BDA</h1>
  <div class="tagline">Onde somente os mais fortes chegam ao topo</div>
  <div id="progress"><div id="progressFill"></div></div>
  <div id="progressLbl"></div>
</header>
<div class="installBanner" id="installBanner"><span>📱 Instale a Copa Grifo como aplicativo</span><button id="installBtn">Instalar</button></div>

<div id="championBanner"><div class="inner">
  <div class="lbl">🏆 Campeão</div>
  <div class="name" id="championName"></div>
</div></div>

<nav id="tabs"></nav>
<main class="wrap" id="phases"></main>
<div id="treeScroll" style="display:none"><div id="tree"></div></div>

<div class="actions"><div class="inner">
  <button class="big" id="btnShare">📋 Texto</button>
  <button class="big" id="btnImg">🖼️ Imagem</button>
  <button class="big" id="btnLink">🔗</button>
  <button class="big" id="btnTeams">👥</button>
  <button class="big" id="btnDraw">🎲</button>
  <button class="big" id="btnReset">↺</button>
</div></div>

<div id="overlay">
  <div class="sheet">
    <h3 id="mTitle"></h3>
    <div class="dtrow"><label>📅 Prazo</label><input type="date" id="mDate"></div>
    <div class="dtrow"><label>🕒 Horário</label><input type="time" id="mTime"></div>
    <input class="extraInput" id="mVenue" maxlength="60" placeholder="🏟️ Estádio ou local da partida">
    <div class="minput">
      <label id="mLabelA"></label>
      <button class="wo-btn" id="mWoA">W.O.</button>
      <input type="number" inputmode="numeric" min="0" id="mScoreA" placeholder="–">
    </div>
    <div class="minput">
      <label id="mLabelB"></label>
      <button class="wo-btn" id="mWoB">W.O.</button>
      <input type="number" inputmode="numeric" min="0" id="mScoreB" placeholder="–">
    </div>
    <div id="penBox">
      <div class="pt">⚖️ Empate — decisão por pênaltis</div>
      <div class="minput"><label id="mPenLabelA"></label><input type="number" inputmode="numeric" min="0" id="mPenA" placeholder="–"></div>
      <div class="minput"><label id="mPenLabelB"></label><input type="number" inputmode="numeric" min="0" id="mPenB" placeholder="–"></div>
    </div>
    <div class="miniLabel">⚽ Gols: um jogador por linha</div>
    <div class="goalInputs"><textarea id="mGoalsA" placeholder="Jogadores do time A"></textarea><textarea id="mGoalsB" placeholder="Jogadores do time B"></textarea></div>
    <input class="extraInput" id="mMvp" maxlength="50" placeholder="🏅 MVP da partida">
    <div class="mact">
      <button class="btn-red" id="mClear">Limpar</button>
      <button class="btn-dim" id="mCancel">Cancelar</button>
      <button class="btn-gold" id="mSave">Salvar</button>
    </div>
  </div>
</div>

<div id="teamsOverlay">
  <div class="sheet">
    <h3>👥 Times da Copa</h3>
    <div id="teamsHint">Toque no escudo para trocar a imagem do time. Adicionar ou remover times refaz o chaveamento (de 2 a 32 times).</div>
    <div id="teamsList"></div>
    <button id="btnAddTeam">＋ Adicionar time</button>
    <div class="mact">
      <button class="btn-dim" id="tCancel">Cancelar</button>
      <button class="btn-gold" id="tApply">Aplicar</button>
    </div>
  </div>
</div>

<div id="drawOverlay">
  <div id="drawBox">
    <h3>🎲 Sorteio</h3>
    <div id="drawList"></div>
    <button id="drawClose">Fechar</button>
  </div>
</div>

<input type="file" id="imgPicker" accept="image/*" style="display:none">

<canvas id="confetti"></canvas>
<div id="toast"></div>

<script>
const DEFAULT_TEAMS=['REDBULL BDA','São Paulo BDA','BDA GOLDEN FC','Cajueiro BDA','Vasco da gama bda','INDEPENDENTE FC BDA','JOGOBUGADO BDA','Zombie Fc BDA','FLAMESTRE FC BDA','HELLYEAH BDA','MACIEIRA BDA','Sport Recife BDA','IMORTAIS FC BDA','mozamigos bda','FLORENCE REAL FC BDA','BDA URDLS','CV CRUZ BDA','INTER BRASIL BDA','MILAN AC BDA'];

let teams=DEFAULT_TEAMS.map(n=>({n:n,img:null}));
let order=teams.map((_,i)=>i);
let M={};
let PH=[];

/* ---------- geração dinâmica do chaveamento ---------- */
function blank(ph,next){return {ph:ph,a:null,b:null,next:next,sa:null,sb:null,pa:null,pb:null,wo:null,dt:null,time:null,venue:null,goalsA:[],goalsB:[],mvp:null};}
function pow2ceil(n){let p=1;while(p<n)p*=2;return p;}

function roundMeta(matches){
  if(matches===1)return {name:'Final',emoji:'🏆'};
  if(matches===2)return {name:'Semis',emoji:'🔥'};
  if(matches===4)return {name:'Quartas',emoji:'🥊'};
  if(matches===8)return {name:'Oitavas',emoji:'🏟️'};
  return {name:'1ª Fase',emoji:'🎯'};
}
function matchName(phId,i,matches){
  if(phId==='PRE')return 'Preliminar '+(i+1);
  if(matches===1)return 'Grande Final';
  if(matches===2)return 'Semifinal '+(i+1);
  if(matches===4)return 'Quartas '+(i+1);
  return 'Jogo '+(i+1);
}
function shortCode(id){
  const m=M[id];
  if(!m)return id;
  if(m.ph==='PRE')return 'P'+(m.idx+1);
  if(m.total===1)return 'Final';
  if(m.total===2)return 'S'+(m.idx+1);
  if(m.total===4)return 'Q'+(m.idx+1);
  return 'J'+(m.idx+1);
}

function buildBracket(o){
  const N=o.length;
  M={};PH=[];
  if(N<2)return;
  const B=pow2ceil(N);
  const isPow=(B===N);
  const mainSize=isPow?N:B/2;
  const prelim=isPow?0:N-mainSize;
  const byes=mainSize-prelim;

  const rounds=[];
  let size=mainSize;
  let r=0;
  while(size>=2){rounds.push({r:r,matches:size/2});size/=2;r++;}

  if(prelim>0){
    PH.push({id:'PRE',name:'Preliminar',emoji:'⚔️'});
    for(let i=0;i<prelim;i++){
      const slot=byes+i;
      const m=blank('PRE',['R0_'+Math.floor(slot/2),slot%2===0?'a':'b']);
      m.idx=i;m.total=prelim;
      m.a=o[byes+2*i];m.b=o[byes+2*i+1];
      M['P'+i]=m;
    }
  }
  rounds.forEach(rd=>{
    const meta=roundMeta(rd.matches);
    const phId='R'+rd.r;
    PH.push({id:phId,name:meta.name,emoji:meta.emoji});
    for(let i=0;i<rd.matches;i++){
      const next=rd.matches===1?null:['R'+(rd.r+1)+'_'+Math.floor(i/2),i%2===0?'a':'b'];
      const m=blank(phId,next);
      m.idx=i;m.total=rd.matches;
      M[phId+'_'+i]=m;
    }
  });
  // times com bye entram direto na 1ª rodada principal
  for(let s=0;s<byes;s++){
    M['R0_'+Math.floor(s/2)][s%2===0?'a':'b']=o[s];
  }
  PH.push({id:'ALL',name:'Árvore',emoji:'🌳'});
  PH.push({id:'STATS',name:'Estatísticas',emoji:'📊'});
  PH.push({id:'SCORERS',name:'Artilharia',emoji:'⚽'});
  PH.push({id:'RANK',name:'Ranking',emoji:'🌎'});
  PH.push({id:'HALL',name:'Hall',emoji:'🏅'});
}

function finalId(){
  const keys=Object.keys(M).filter(k=>M[k].next===null&&M[k].ph!=='PRE');
  return keys[0]||null;
}
function totalMatches(){return Object.keys(M).length;}

/* ---------- persistência ---------- */
let store=null;
try{store=window.localStorage;}catch(e){store=null;}
function persist(){
  try{if(store)store.setItem('copa-grifo-bda-v3',JSON.stringify({teams:teams,order:order,M:M,PH:PH}));}catch(e){}
}
(function load(){
  try{
    const saved=store&&store.getItem('copa-grifo-bda-v3');
    if(saved){
      const d=JSON.parse(saved);
      if(d.teams&&d.M&&d.PH&&d.order){teams=d.teams;order=d.order;M=d.M;PH=d.PH;return;}
    }
  }catch(e){}
  buildBracket(order);
})();

/* ---------- utilitários ---------- */
function tn(i){return (i!=null&&teams[i])?teams[i].n:'?';}
const BADGE_COLORS=['#D4A62A','#C0682F','#5B8C5A','#4E7CB8','#9A5BA8','#B3342E','#3AA6A6','#B8B24E','#7A6FCB','#CC7A9E'];
function badgeColor(name){let h=0;for(let i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0;}return BADGE_COLORS[h%BADGE_COLORS.length];}
function initials(name){
  const w=name.replace(/bda/ig,'').trim().split(/\s+/).filter(Boolean);
  if(w.length===0)return name.slice(0,2).toUpperCase();
  if(w.length===1)return w[0].slice(0,2).toUpperCase();
  return (w[0][0]+w[1][0]).toUpperCase();
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function fmtDate(dt){if(!dt)return null;const p=dt.split('-');if(p.length!==3)return null;return p[2]+'/'+p[1];}

function winner(m){
  if(m.a==null||m.b==null)return null;
  if(m.wo==='a')return m.b;
  if(m.wo==='b')return m.a;
  if(m.sa==null||m.sb==null)return null;
  if(m.sa>m.sb)return m.a;
  if(m.sb>m.sa)return m.b;
  if(m.pa!=null&&m.pb!=null&&m.pa!==m.pb)return m.pa>m.pb?m.a:m.b;
  return null;
}
function loserSide(m){const w=winner(m);if(w==null)return null;return w===m.a?'b':'a';}
function decided(m){return winner(m)!=null;}

function clearDownstream(id){
  const m=M[id];if(!m.next)return;
  const nid=m.next[0],slot=m.next[1];const n=M[nid];
  if(n[slot]!=null){
    n[slot]=null;n.sa=null;n.sb=null;n.pa=null;n.pb=null;n.wo=null;
    clearDownstream(nid);
  }
}
function propagate(id){
  const m=M[id];if(!m.next)return;
  const w=winner(m);const nid=m.next[0],slot=m.next[1];
  if(M[nid][slot]!==w){clearDownstream(id);M[nid][slot]=w;}
}
function tbdLabel(id,side){
  for(const k in M){
    const m=M[k];
    if(m.next&&m.next[0]===id&&m.next[1]===side)return 'Vencedor '+shortCode(k);
  }
  return 'A definir';
}

/* ---------- render ---------- */
const tabsEl=document.getElementById('tabs');
const phasesEl=document.getElementById('phases');
const treeScroll=document.getElementById('treeScroll');
let activePhase=null;
let hadChampion=false;

function badgeHtml(idx,tbd,size){
  if(tbd||idx==null)return '<div class="badge tbd">?</div>';
  const t=teams[idx];
  if(t.img)return '<div class="badge" style="background-image:url('+t.img+')"></div>';
  return '<div class="badge" style="background:'+badgeColor(t.n)+'">'+esc(initials(t.n))+'</div>';
}

function render(){
  if(!activePhase||!PH.some(p=>p.id===activePhase))activePhase=PH[0]?PH[0].id:null;
  tabsEl.innerHTML='';
  PH.forEach(p=>{
    const b=document.createElement('button');
    b.className='tab'+(p.id===activePhase?' active':'');
    b.textContent=p.emoji+' '+p.name;
    b.onclick=()=>{activePhase=p.id;render();};
    tabsEl.appendChild(b);
  });
  const showTree=activePhase==='ALL';
  const special=['STATS','SCORERS','RANK','HALL'].includes(activePhase);
  phasesEl.style.display=showTree?'none':'block';
  treeScroll.style.display=showTree?'block':'none';
  if(showTree){renderTree();}
  else if(special){renderDashboard(activePhase);}
  else{
    phasesEl.innerHTML='';
    PH.filter(p=>!['ALL','STATS','SCORERS','RANK','HALL'].includes(p.id)).forEach(p=>{
      const div=document.createElement('div');
      div.className='phase'+(p.id===activePhase?' show':'');
      matchesOf(p.id).forEach(k=>div.appendChild(card(k)));
      phasesEl.appendChild(div);
    });
  }
  const total=totalMatches();
  const done=Object.keys(M).filter(k=>decided(M[k])).length;
  document.getElementById('progressFill').style.width=(total?done/total*100:0)+'%';
  document.getElementById('progressLbl').textContent=done+' de '+total+' jogos';
  const fid=finalId();
  const champ=fid?winner(M[fid]):null;
  const cb=document.getElementById('championBanner');
  if(champ!=null){
    syncHall();
    cb.style.display='block';
    document.getElementById('championName').textContent='🦅 '+tn(champ);
    if(!hadChampion){hadChampion=true;confetti();}
  }else{cb.style.display='none';hadChampion=false;}
  persist();
}
function matchesOf(phId){
  return Object.keys(M).filter(k=>M[k].ph===phId).sort((a,b)=>M[a].idx-M[b].idx);
}

function card(id){
  const m=M[id];
  const w=winner(m),ls=loserSide(m);
  const el=document.createElement('div');
  el.className='match';
  const rows=[['a',m.a],['b',m.b]].map(([side,idx])=>{
    const tbd=idx==null;
    let cls='tname'+(tbd?' tbd':'');
    if(w!=null){cls+=(side===ls?' lose':' win');}
    const sc=m.wo===side?'<span class="wo-flag">W.O.</span>':
      (m['s'+side]!=null?'<span class="score">'+m['s'+side]+'</span>':'<span class="score" style="color:var(--ink-dim)">–</span>');
    const pen=(m.pa!=null&&m.pb!=null&&m.sa===m.sb&&m.wo==null)?'<span class="score pen">('+m['p'+side]+')</span>':'';
    return '<div class="row">'+badgeHtml(idx,tbd)+'<span class="'+cls+'">'+(tbd?tbdLabel(id,side):esc(tn(idx)))+'</span><span>'+sc+pen+'</span></div>';
  }).join('');
  const dt=fmtDate(m.dt);
  el.innerHTML='<div class="mid"><span>'+matchName(m.ph,m.idx,m.total)+'</span>'+(dt?'<span class="dt">📅 até '+dt+'</span>':'')+'</div>'+rows;
  el.onclick=()=>openModal(id);
  return el;
}

function renderTree(){
  const tree=document.getElementById('tree');
  tree.innerHTML='';
  PH.filter(p=>!['ALL','STATS','SCORERS','RANK','HALL'].includes(p.id)).forEach(p=>{
    const col=document.createElement('div');
    col.className='tcol';
    col.innerHTML='<h4>'+p.emoji+' '+p.name+'</h4>';
    matchesOf(p.id).forEach(k=>{
      const m=M[k],w=winner(m),ls=loserSide(m);
      const d=document.createElement('div');
      d.className='tm';
      d.innerHTML=[['a',m.a],['b',m.b]].map(([side,idx])=>{
        const tbd=idx==null;
        let cls=tbd?'t':(w!=null?(side===ls?'l':'w'):'');
        const sc=m.wo===side?'WO':(m['s'+side]!=null?m['s'+side]:'');
        return '<div><span class="'+cls+'">'+(tbd?'—':esc(tn(idx)))+'</span><span class="'+cls+'">'+sc+'</span></div>';
      }).join('');
      d.onclick=()=>openModal(k);
      col.appendChild(d);
    });
    tree.appendChild(col);
  });
}

/* ---------- modal de resultado ---------- */
let editId=null,woState=null;
const ov=document.getElementById('overlay');
function openModal(id){
  const m=M[id];
  editId=id;
  if(m.a==null||m.b==null){toast('Aguardando definição dos times');return;}
  document.getElementById('mTitle').textContent=matchName(m.ph,m.idx,m.total);
  document.getElementById('mLabelA').textContent=tn(m.a);
  document.getElementById('mLabelB').textContent=tn(m.b);
  document.getElementById('mPenLabelA').textContent=tn(m.a);
  document.getElementById('mPenLabelB').textContent=tn(m.b);
  document.getElementById('mScoreA').value=m.sa??'';
  document.getElementById('mScoreB').value=m.sb??'';
  document.getElementById('mPenA').value=m.pa??'';
  document.getElementById('mPenB').value=m.pb??'';
  document.getElementById('mDate').value=m.dt??'';
  document.getElementById('mTime').value=m.time??'';
  document.getElementById('mVenue').value=m.venue??'';
  document.getElementById('mGoalsA').value=(m.goalsA||[]).join('\n');
  document.getElementById('mGoalsB').value=(m.goalsB||[]).join('\n');
  document.getElementById('mMvp').value=m.mvp??'';
  setWo(m.wo??null);
  syncPenBox();
  ov.classList.add('show');
}
function setWo(v){
  woState=v;
  document.getElementById('mWoA').className='wo-btn'+(v==='a'?' on':'');
  document.getElementById('mWoB').className='wo-btn'+(v==='b'?' on':'');
  syncPenBox();
}
document.getElementById('mWoA').onclick=()=>{setWo(woState==='a'?null:'a');};
document.getElementById('mWoB').onclick=()=>{setWo(woState==='b'?null:'b');};
function syncPenBox(){
  const a=document.getElementById('mScoreA').value,b=document.getElementById('mScoreB').value;
  const show=a!==''&&b!==''&&a===b&&woState==null;
  document.getElementById('penBox').style.display=show?'block':'none';
}
document.getElementById('mScoreA').oninput=syncPenBox;
document.getElementById('mScoreB').oninput=syncPenBox;
document.getElementById('mCancel').onclick=()=>ov.classList.remove('show');
ov.onclick=e=>{if(e.target===ov)ov.classList.remove('show');};

document.getElementById('mClear').onclick=()=>{
  const m=M[editId];
  m.sa=null;m.sb=null;m.pa=null;m.pb=null;m.wo=null;m.dt=null;m.time=null;m.venue=null;m.goalsA=[];m.goalsB=[];m.mvp=null;
  clearDownstream(editId);
  if(m.next){M[m.next[0]][m.next[1]]=null;}
  ov.classList.remove('show');
  render();
};
document.getElementById('mSave').onclick=()=>{
  const m=M[editId];
  m.dt=document.getElementById('mDate').value||null;
  m.time=document.getElementById('mTime').value||null;
  m.venue=document.getElementById('mVenue').value.trim()||null;
  m.goalsA=document.getElementById('mGoalsA').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
  m.goalsB=document.getElementById('mGoalsB').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
  m.mvp=document.getElementById('mMvp').value.trim()||null;
  if(woState){
    m.wo=woState;m.sa=null;m.sb=null;m.pa=null;m.pb=null;
  }else{
    const sa=document.getElementById('mScoreA').value,sb=document.getElementById('mScoreB').value;
    if(sa===''&&sb===''){
      m.wo=null;m.sa=null;m.sb=null;m.pa=null;m.pb=null;
      clearDownstream(editId);
      if(m.next){M[m.next[0]][m.next[1]]=null;}
      ov.classList.remove('show');render();return;
    }
    if(sa===''||sb===''){toast('Informe os dois placares');return;}
    m.wo=null;m.sa=+sa;m.sb=+sb;
    if(m.sa===m.sb){
      const pa=document.getElementById('mPenA').value,pb=document.getElementById('mPenB').value;
      if(pa===''||pb===''||pa===pb){toast('Empate: informe pênaltis (sem novo empate)');return;}
      m.pa=+pa;m.pb=+pb;
    }else{m.pa=null;m.pb=null;}
  }
  propagate(editId);
  ov.classList.remove('show');
  render();
};

/* ---------- editor de times ---------- */
const tOv=document.getElementById('teamsOverlay');
let tempTeams=[],structChanged=false,editingImgIdx=null;
document.getElementById('btnTeams').onclick=()=>{
  tempTeams=teams.map(t=>({n:t.n,img:t.img}));
  structChanged=false;
  renderTeamsList();
  tOv.classList.add('show');
};
function renderTeamsList(){
  const list=document.getElementById('teamsList');
  list.innerHTML='';
  tempTeams.forEach((t,i)=>{
    const row=document.createElement('div');
    row.className='trow';
    const badge=document.createElement('div');
    badge.className='badge';
    if(t.img){badge.style.backgroundImage='url('+t.img+')';}
    else{badge.style.background=badgeColor(t.n);badge.textContent=initials(t.n);}
    badge.title='Trocar escudo';
    badge.onclick=()=>{editingImgIdx=i;document.getElementById('imgPicker').click();};
    const inp=document.createElement('input');
    inp.type='text';inp.value=t.n;inp.maxLength=40;
    inp.oninput=()=>{t.n=inp.value;if(!t.img){badge.style.background=badgeColor(t.n);badge.textContent=initials(t.n);}};
    const rm=document.createElement('button');
    rm.className='rm';rm.textContent='✕';
    rm.onclick=()=>{tempTeams.splice(i,1);structChanged=true;renderTeamsList();};
    row.appendChild(badge);row.appendChild(inp);row.appendChild(rm);
    list.appendChild(row);
  });
}
document.getElementById('btnAddTeam').onclick=()=>{
  if(tempTeams.length>=32){toast('Máximo de 32 times');return;}
  tempTeams.push({n:'Novo time '+(tempTeams.length+1),img:null});
  structChanged=true;
  renderTeamsList();
  const list=document.getElementById('teamsList');
  list.scrollTop=list.scrollHeight;
};
document.getElementById('imgPicker').onchange=function(){
  const f=this.files&&this.files[0];
  this.value='';
  if(!f||editingImgIdx==null)return;
  const rd=new FileReader();
  rd.onload=()=>{
    const im=new Image();
    im.onload=()=>{
      const cv=document.createElement('canvas');cv.width=96;cv.height=96;
      const c=cv.getContext('2d');
      const s=Math.min(im.width,im.height);
      c.drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,96,96);
      tempTeams[editingImgIdx].img=cv.toDataURL('image/png');
      renderTeamsList();
      toast('Escudo atualizado');
    };
    im.onerror=()=>toast('Não foi possível ler a imagem');
    im.src=rd.result;
  };
  rd.readAsDataURL(f);
};
document.getElementById('tCancel').onclick=()=>tOv.classList.remove('show');
tOv.onclick=e=>{if(e.target===tOv)tOv.classList.remove('show');};
document.getElementById('tApply').onclick=()=>{
  const clean=tempTeams.filter(t=>t.n.trim()!=='');
  if(clean.length<2){toast('Mínimo de 2 times');return;}
  if(structChanged||clean.length!==teams.length){
    if(!confirm('A lista de times mudou. O chaveamento será refeito e os resultados apagados. Continuar?'))return;
    teams=clean.map(t=>({n:t.n.trim(),img:t.img}));
    order=teams.map((_,i)=>i);
    buildBracket(order);
    activePhase=null;
  }else{
    teams=clean.map(t=>({n:t.n.trim(),img:t.img}));
  }
  tOv.classList.remove('show');
  render();
};


/* ---------- estatísticas, artilharia, ranking e hall ---------- */
function allRealPhases(){return PH.filter(p=>!['ALL','STATS','SCORERS','RANK','HALL'].includes(p.id));}
function tournamentStats(){
  const ms=Object.values(M), played=ms.filter(decided), goals=played.reduce((n,m)=>n+(m.sa||0)+(m.sb||0),0);
  return {games:played.length,total:ms.length,goals,avg:played.length?(goals/played.length).toFixed(2):'0',wo:played.filter(m=>m.wo).length,pens:played.filter(m=>m.pa!=null).length,scheduled:ms.filter(m=>m.dt&&!decided(m)).length};
}
function scorerTable(){
  const map={}; Object.values(M).forEach(m=>{(m.goalsA||[]).forEach(n=>map[n]=(map[n]||0)+1);(m.goalsB||[]).forEach(n=>map[n]=(map[n]||0)+1);});
  return Object.entries(map).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
}
function currentRanking(){
  const pts={};teams.forEach((t,i)=>pts[i]=10);
  Object.values(M).forEach(m=>{const w=winner(m);if(w!=null)pts[w]=(pts[w]||0)+10;});
  const fid=finalId(); if(fid&&decided(M[fid])){const w=winner(M[fid]),los=w===M[fid].a?M[fid].b:M[fid].a;pts[w]+=50;pts[los]+=25;}
  getHall().forEach(h=>{const i=teams.findIndex(t=>t.n===h.champion);if(i>=0)pts[i]=(pts[i]||0)+100;});
  return Object.entries(pts).map(([i,p])=>[teams[+i].n,p]).sort((a,b)=>b[1]-a[1]);
}
function getHall(){try{return JSON.parse(localStorage.getItem('copa-grifo-hall')||'[]')}catch(e){return []}}
function saveHall(v){localStorage.setItem('copa-grifo-hall',JSON.stringify(v));}
function syncHall(){
  const fid=finalId();if(!fid)return;const c=winner(M[fid]);if(c==null)return;
  const hall=getHall(), key='grifo-'+teams.map(t=>t.n).join('|').slice(0,150);
  const rec={key,edition:'Copa Grifo BDA',champion:tn(c),date:new Date().toLocaleDateString('pt-BR')};
  const ix=hall.findIndex(x=>x.key===key);if(ix>=0)hall[ix]=rec;else hall.unshift(rec);saveHall(hall.slice(0,50));
}
function rankHtml(rows,suffix){return rows.length?rows.map((r,i)=>'<div class="rankRow"><span class="pos">'+(i+1)+'º</span><span>'+esc(r[0])+'</span><span class="pts">'+r[1]+' '+suffix+'</span></div>').join(''):'<div class="emptyBox">Nenhum dado registrado.</div>';}
function renderDashboard(type){
  phasesEl.innerHTML='';const d=document.createElement('section');d.className='dashboard';
  if(type==='STATS'){
    const x=tournamentStats();d.innerHTML='<div class="gridStats">'+[['Jogos',x.games+'/'+x.total],['Gols',x.goals],['Média',x.avg],['Pênaltis',x.pens],['W.O.',x.wo],['Agendados',x.scheduled]].map(a=>'<div class="statCard"><div class="v">'+a[1]+'</div><div class="k">'+a[0]+'</div></div>').join('')+'</div><div class="sectionTitle">🏅 MVPs registrados</div>';
    const mvps=Object.values(M).filter(m=>m.mvp).map(m=>[m.mvp,matchName(m.ph,m.idx,m.total)]);d.innerHTML+=rankHtml(mvps,'');
  }else if(type==='SCORERS'){
    d.innerHTML='<div class="sectionTitle">⚽ Artilharia da Copa</div>'+rankHtml(scorerTable(),'gol'+(scorerTable()[0]?.[1]===1?'':'s'))+'<div class="lockedNote">Os nomes são contabilizados a partir do campo “Gols” em cada partida.</div>';
  }else if(type==='RANK'){
    d.innerHTML='<div class="sectionTitle">🌎 Ranking BDA</div>'+rankHtml(currentRanking(),'pts')+'<div class="lockedNote">Pontuação: participação 10, vitória 10, vice 25, campeão 50 e título histórico 100.</div>';
  }else{
    const hall=getHall();d.innerHTML='<div class="sectionTitle">🏅 Hall da Fama</div>'+(hall.length?hall.map((h,i)=>'<div class="rankRow"><span class="pos">🏆</span><span><b>'+esc(h.champion)+'</b><br><small>'+esc(h.edition)+' • '+esc(h.date)+'</small></span><span class="pts">'+(i+1)+'ª</span></div>').join(''):'<div class="emptyBox">O campeão aparecerá aqui quando a final for concluída.</div>');
  }
  phasesEl.appendChild(d);
}

/* ---------- compartilhar texto ---------- */
function buildText(){
  let out='🦅🏆 COPA GRIFO BDA — CHAVEAMENTO 🏆🦅\n';
  PH.filter(p=>!['ALL','STATS','SCORERS','RANK','HALL'].includes(p.id)).forEach(p=>{
    out+='\n'+p.emoji+' '+p.name.toUpperCase()+'\n';
    matchesOf(p.id).forEach(k=>{
      const m=M[k];
      const a=m.a!=null?tn(m.a):tbdLabel(k,'a'),b=m.b!=null?tn(m.b):tbdLabel(k,'b');
      let line='• '+a+' × '+b;
      if(m.wo==='a')line='• '+a+' (W.O.) × '+b+' ✅';
      else if(m.wo==='b')line='• '+a+' ✅ × '+b+' (W.O.)';
      else if(m.sa!=null&&m.sb!=null){
        line='• '+a+' '+m.sa+' × '+m.sb+' '+b;
        if(m.pa!=null)line+=' (pên. '+m.pa+'–'+m.pb+')';
      }
      const dt=fmtDate(m.dt);
      if(dt&&!decided(m))line+=' — 📅 até '+dt+(m.time?' às '+m.time:'');
      if(m.venue)line+=' — 🏟️ '+m.venue;
      out+=line+'\n';
    });
  });
  const fid=finalId();
  const champ=fid?winner(M[fid]):null;
  if(champ!=null)out+='\n🏆 CAMPEÃO: '+tn(champ)+' 🦅\n';
  out+='\n🔥 Onde somente os mais fortes chegam ao topo!';
  return out;
}
document.getElementById('btnShare').onclick=()=>copy(buildText());
function copy(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(()=>toast('Copiado! Cola no grupo 🦅'),()=>fallbackCopy(t));
  }else fallbackCopy(t);
}
function fallbackCopy(t){
  const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);
  ta.select();try{document.execCommand('copy');toast('Copiado! Cola no grupo 🦅');}catch(e){toast('Não foi possível copiar');}
  document.body.removeChild(ta);
}

/* ---------- imagem canvas ---------- */
function loadImgs(){
  const idxs=[];
  for(const k in M){if(M[k].a!=null)idxs.push(M[k].a);if(M[k].b!=null)idxs.push(M[k].b);}
  const uniq=[...new Set(idxs)];
  return Promise.all(uniq.map(i=>new Promise(res=>{
    const t=teams[i];
    if(!t||!t.img)return res([i,null]);
    const im=new Image();
    im.onload=()=>res([i,im]);
    im.onerror=()=>res([i,null]);
    im.src=t.img;
  }))).then(pairs=>{
    const o={};pairs.forEach(([i,im])=>o[i]=im);return o;
  });
}
function drawBadge(c,cx,cy,r,idx,imgs){
  if(idx==null)return;
  c.save();
  c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.closePath();
  const im=imgs[idx];
  if(im){c.clip();c.drawImage(im,cx-r,cy-r,r*2,r*2);}
  else{
    c.fillStyle=badgeColor(tn(idx));c.fill();
    c.fillStyle='#0E0F13';c.font='800 '+Math.round(r*.9)+'px sans-serif';
    c.textAlign='center';c.textBaseline='middle';
    c.fillText(initials(tn(idx)),cx,cy+1);
  }
  c.restore();
  c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);
  c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=1.5;c.stroke();
  c.textBaseline='alphabetic';
}
document.getElementById('btnImg').onclick=()=>{
  loadImgs().then(imgs=>{
    const W=1080;
    const phaseList=PH.filter(p=>!['ALL','STATS','SCORERS','RANK','HALL'].includes(p.id));
    let rows=0;phaseList.forEach(p=>{rows+=matchesOf(p.id).length;});
    const fid=finalId();
    const champ=fid?winner(M[fid]):null;
    const H=250+phaseList.length*70+rows*64+(champ!=null?130:0)+90;
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const c=cv.getContext('2d');
    c.fillStyle='#0E0F13';c.fillRect(0,0,W,H);
    const grad=c.createRadialGradient(W/2,0,50,W/2,0,600);
    grad.addColorStop(0,'rgba(212,166,42,.18)');grad.addColorStop(1,'transparent');
    c.fillStyle=grad;c.fillRect(0,0,W,600);
    c.textAlign='center';
    c.font='90px serif';c.fillText('🦅',W/2,110);
    c.fillStyle='#F0D37A';c.font='800 52px Cinzel, serif';
    c.fillText('COPA GRIFO BDA',W/2,185);
    c.fillStyle='#8B8A80';c.font='20px sans-serif';
    c.fillText('O N D E   S O M E N T E   O S   M A I S   F O R T E S   C H E G A M   A O   T O P O',W/2,220);
    let y=250;
    phaseList.forEach(p=>{
      y+=48;
      c.fillStyle='#D4A62A';c.font='700 26px Cinzel, serif';c.textAlign='left';
      c.fillText(p.emoji+'  '+p.name.toUpperCase(),60,y);
      c.strokeStyle='#2A2D3D';c.beginPath();c.moveTo(60,y+12);c.lineTo(W-60,y+12);c.stroke();
      y+=22;
      matchesOf(p.id).forEach(k=>{
        const m=M[k],w=winner(m),ls=loserSide(m);
        const a=m.a!=null?tn(m.a):tbdLabel(k,'a'),b=m.b!=null?tn(m.b):tbdLabel(k,'b');
        c.font='600 26px sans-serif';
        const nameA=trunc(c,a,340),nameB=trunc(c,b,340);
        c.textAlign='right';
        c.fillStyle=m.a==null?'#555':(w!=null?(ls==='a'?'#666':'#F0D37A'):'#E8E6DC');
        c.fillText(nameA,W/2-70,y+34);
        const wA=c.measureText(nameA).width;
        drawBadge(c,W/2-70-wA-32,y+25,18,m.a,imgs);
        c.textAlign='left';
        c.fillStyle=m.b==null?'#555':(w!=null?(ls==='b'?'#666':'#F0D37A'):'#E8E6DC');
        c.fillText(nameB,W/2+70,y+34);
        const wB=c.measureText(nameB).width;
        drawBadge(c,W/2+70+wB+32,y+25,18,m.b,imgs);
        c.textAlign='center';c.fillStyle='#D4A62A';c.font='800 28px sans-serif';
        let mid='×';
        if(m.wo==='a')mid='WO ×';else if(m.wo==='b')mid='× WO';
        else if(m.sa!=null&&m.sb!=null){mid=m.sa+' × '+m.sb;}
        c.fillText(mid,W/2,y+34);
        if(m.pa!=null&&m.pb!=null&&m.sa===m.sb){
          c.font='600 18px sans-serif';c.fillStyle='#8B8A80';
          c.fillText('pên. '+m.pa+'–'+m.pb,W/2,y+56);
        }
        y+=64;
      });
    });
    if(champ!=null){
      y+=40;
      c.strokeStyle='#D4A62A';c.lineWidth=2;
      roundRect(c,W/2-380,y-10,760,96,14);c.stroke();
      c.textAlign='center';c.fillStyle='#D4A62A';c.font='700 22px Cinzel, serif';
      c.fillText('🏆  C A M P E Ã O  🏆',W/2,y+26);
      c.fillStyle='#F0D37A';c.font='800 40px Cinzel, serif';
      c.fillText(trunc(c,tn(champ),640),W/2,y+70);
      drawBadge(c,W/2-c.measureText(trunc(c,tn(champ),640)).width/2-45,y+58,24,champ,imgs);
      y+=100;
    }
    c.textAlign='center';c.fillStyle='#8B8A80';c.font='18px sans-serif';
    c.fillText('🦅 Copa Grifo BDA',W/2,H-35);
    cv.toBlob(blob=>{
      const file=new File([blob],'copa-grifo-bda.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'Copa Grifo BDA'}).catch(()=>downloadBlob(blob));
      }else downloadBlob(blob);
    },'image/png');
  });
};
function trunc(c,txt,max){
  if(c.measureText(txt).width<=max)return txt;
  while(txt.length>2&&c.measureText(txt+'…').width>max)txt=txt.slice(0,-1);
  return txt+'…';
}
function roundRect(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
function downloadBlob(blob){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='copa-grifo-bda.png';
  document.body.appendChild(a);a.click();a.remove();
  toast('Imagem gerada 🖼️');
}

/* ---------- link compartilhável (estado na URL) ---------- */
function stateToHash(){
  const lite={t:teams.map(t=>t.n),o:order,m:{}};
  for(const k in M){
    const m=M[k];
    if(m.sa!=null||m.wo||m.dt){lite.m[k]=[m.sa,m.sb,m.pa,m.pb,m.wo,m.dt,m.time,m.venue,m.goalsA,m.goalsB,m.mvp];}
  }
  const json=JSON.stringify(lite);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function loadFromHash(){
  if(!location.hash||location.hash.indexOf('#d=')!==0)return false;
  try{
    let b=location.hash.slice(3).replace(/-/g,'+').replace(/_/g,'/');
    while(b.length%4)b+='=';
    const lite=JSON.parse(decodeURIComponent(escape(atob(b))));
    if(!lite.t||!lite.o)return false;
    const oldImgs={};teams.forEach(t=>{oldImgs[t.n]=t.img;});
    teams=lite.t.map(n=>({n:n,img:oldImgs[n]||null}));
    order=lite.o;
    buildBracket(order);
    for(const k in (lite.m||{})){
      if(M[k]){
        const v=lite.m[k];
        M[k].sa=v[0]??null;M[k].sb=v[1]??null;M[k].pa=v[2]??null;M[k].pb=v[3]??null;
        M[k].wo=v[4]??null;M[k].dt=v[5]??null;M[k].time=v[6]??null;M[k].venue=v[7]??null;M[k].goalsA=v[8]??[];M[k].goalsB=v[9]??[];M[k].mvp=v[10]??null;
      }
    }
    PH.filter(p=>!['ALL','STATS','SCORERS','RANK','HALL'].includes(p.id)).forEach(p=>matchesOf(p.id).forEach(k=>propagate(k)));
    return true;
  }catch(e){return false;}
}
document.getElementById('btnLink').onclick=()=>{
  const url=location.origin+location.pathname+'#d='+stateToHash();
  if(url.indexOf('http')!==0){toast('Publique o site primeiro para gerar o link');return;}
  copy(url);
};

/* ---------- reset ---------- */
document.getElementById('btnReset').onclick=()=>{
  if(confirm('Zerar todos os resultados da copa?')){
    buildBracket(order);
    activePhase=null;
    render();
    toast('Copa zerada');
  }
};

/* ---------- sorteio ---------- */
document.getElementById('btnDraw').onclick=()=>{
  if(!confirm('Fazer novo sorteio dos '+teams.length+' times? Isso apaga todos os resultados e monta um chaveamento novo.'))return;
  const o=teams.map((_,i)=>i);
  for(let i=o.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const tmp=o[i];o[i]=o[j];o[j]=tmp;
  }
  order=o;
  buildBracket(order);
  activePhase=null;
  render();
  showDrawReveal();
};
let drawTimers=[];
function showDrawReveal(){
  const list=document.getElementById('drawList');
  list.innerHTML='';
  drawTimers.forEach(t=>clearTimeout(t));drawTimers=[];
  const items=[];
  PH.filter(p=>p.id==='PRE'||p.id==='R0').forEach(p=>{
    matchesOf(p.id).forEach(k=>{
      const m=M[k];
      const a=m.a!=null?tn(m.a):tbdLabel(k,'a');
      const b=m.b!=null?tn(m.b):tbdLabel(k,'b');
      items.push([p.emoji+' '+matchName(m.ph,m.idx,m.total),a+'  ×  '+b]);
    });
  });
  document.getElementById('drawOverlay').classList.add('show');
  items.forEach((it,i)=>{
    drawTimers.push(setTimeout(()=>{
      const d=document.createElement('div');
      d.className='ditem';
      d.innerHTML='<div class="dl">'+it[0]+'</div><div class="dn">'+esc(it[1])+'</div>';
      list.appendChild(d);
      d.scrollIntoView({block:'nearest'});
    },380*i+250));
  });
}
document.getElementById('drawClose').onclick=()=>{
  document.getElementById('drawOverlay').classList.remove('show');
  drawTimers.forEach(t=>clearTimeout(t));drawTimers=[];
};

/* ---------- confetes ---------- */
function confetti(){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cv=document.getElementById('confetti');
  cv.width=innerWidth;cv.height=innerHeight;
  const c=cv.getContext('2d');
  const parts=[];
  for(let i=0;i<120;i++){
    parts.push({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*.5,
      s:4+Math.random()*6,v:2+Math.random()*3,r:Math.random()*Math.PI,
      col:Math.random()<.7?'#D4A62A':'#F0D37A'});
  }
  let t=0;
  (function anim(){
    c.clearRect(0,0,cv.width,cv.height);
    parts.forEach(p=>{
      p.y+=p.v;p.x+=Math.sin(p.y*.02+p.r)*1.2;
      c.save();c.translate(p.x,p.y);c.rotate(p.y*.03+p.r);
      c.fillStyle=p.col;c.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);c.restore();
    });
    t++;
    if(t<240)requestAnimationFrame(anim);
    else c.clearRect(0,0,cv.width,cv.height);
  })();
}

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),2200);
}

const SPECIAL_TABS=[{id:'STATS',name:'Estatísticas',emoji:'📊'},{id:'SCORERS',name:'Artilharia',emoji:'⚽'},{id:'RANK',name:'Ranking',emoji:'🌎'},{id:'HALL',name:'Hall',emoji:'🏅'}];
SPECIAL_TABS.forEach(t=>{if(!PH.some(p=>p.id===t.id))PH.push(t);});
if(loadFromHash()){history.replaceState(null,'',location.pathname+location.search);toast('Resultados carregados do link 🔗');}
let deferredInstall=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.getElementById('installBanner').style.display='flex';});
document.getElementById('installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;document.getElementById('installBanner').style.display='none';};
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

hadChampion=(function(){const f=finalId();return f?decided(M[f]):false;})();
render();
</script>
</body>
</html>
