(() => {
'use strict';

const TK='bda-v3-tournaments',MK='bda-v3-confrontos',TEAMK='bda-v2-teams';
let active=false,currentId='',timer=0,lastSignature='';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const has=v=>v!==''&&v!=null&&!Number.isNaN(Number(v));
const placeholder=v=>/^vencedor\s+/i.test(String(v||''));
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function tournaments(){const x=read(TK,[]);return Array.isArray(x)?x:[]}
function store(){const x=read(MK,{});return x&&typeof x==='object'?x:{}}
function games(id){const x=store()[id];return Array.isArray(x)?x:[]}
function clubs(){const x=read(TEAMK,[]);return Array.isArray(x)?x:[]}
function tournament(){return tournaments().find(t=>t.id===currentId)||null}
function finished(g){return ['a','b'].includes(g?.wo)||(has(g?.a)&&has(g?.b))}
function scores(g){if(g.wo==='a')return[3,0];if(g.wo==='b')return[0,3];return[Number(g.a),Number(g.b)]}
function groupName(game,format){
  if(game?.group)return String(game.group).trim();
  const phase=String(game?.phase||'');
  const match=phase.match(/grupo\s*([a-z0-9]+)/i);
  if(match)return`Grupo ${match[1].toUpperCase()}`;
  return norm(format).includes('pontos corridos')?'Classificação geral':'Grupo único';
}
function eligible(game,format,hasGroups){
  if(!finished(game))return false;
  if(norm(format).includes('pontos corridos'))return true;
  if(hasGroups)return norm(game.phase).includes('grupo')||Boolean(game.group);
  return false;
}
function teamMeta(name){return clubs().find(t=>norm(t.name)===norm(name))||null}
function badge(name){const t=teamMeta(name);return t?.badge?`<span class="stand-badge"><img src="${esc(t.badge)}" alt="Escudo de ${esc(name)}"></span>`:`<span class="stand-badge">${esc(t?.code||String(name).split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</span>`}
function blank(name){return{name,pts:0,j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,last:[]}}
function calculate(){
  const t=tournament(),raw=games(currentId),format=t?.format||'',hasGroups=raw.some(g=>norm(g.phase).includes('grupo')||g.group);
  const groups=new Map();
  const ensure=(group,name)=>{if(!name||placeholder(name))return null;if(!groups.has(group))groups.set(group,new Map());const map=groups.get(group),key=norm(name);if(!map.has(key))map.set(key,blank(name));return map.get(key)};
  const participantGroup=new Map();
  raw.forEach(g=>{const group=groupName(g,format);[g.ta,g.tb].forEach(name=>{if(name&&!placeholder(name)&&!participantGroup.has(norm(name)))participantGroup.set(norm(name),group)})});
  if(norm(format).includes('pontos corridos'))(t?.participants||[]).forEach(name=>ensure('Classificação geral',name));
  else if(hasGroups)(t?.participants||[]).forEach(name=>ensure(participantGroup.get(norm(name))||'Grupo único',name));
  raw.filter(g=>eligible(g,format,hasGroups)).sort((a,b)=>Number(a.updated||a.created||0)-Number(b.updated||b.created||0)).forEach(g=>{
    const group=groupName(g,format),a=ensure(group,g.ta),b=ensure(group,g.tb);if(!a||!b)return;const[sa,sb]=scores(g);
    a.j++;b.j++;a.gp+=sa;a.gc+=sb;b.gp+=sb;b.gc+=sa;
    if(sa>sb){a.v++;b.d++;a.pts+=3;a.last.push('V');b.last.push('D')}
    else if(sb>sa){b.v++;a.d++;b.pts+=3;b.last.push('V');a.last.push('D')}
    else{a.e++;b.e++;a.pts++;b.pts++;a.last.push('E');b.last.push('E')}
  });
  const result=[];groups.forEach((map,name)=>{const rows=[...map.values()].map(r=>({...r,sg:r.gp-r.gc,last:r.last.slice(-5)})).sort((a,b)=>b.pts-a.pts||b.v-a.v||b.sg-a.sg||b.gp-a.gp||a.name.localeCompare(b.name,'pt-BR'));result.push({name,rows})});
  return result.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
function form(list){return list.length?list.map(v=>`<i data-result="${v}">${v}</i>`).join(''):'<span>–</span>'}
function qualifierLimit(group){
  const t=tournament();
  const configured=Number(t?.groupSettings?.qualifiersPerGroup??t?.qualifiersPerGroup??t?.settings?.qualifiersPerGroup??2);
  return Math.min(group.rows.length,Math.max(1,Number.isFinite(configured)?Math.floor(configured):2));
}
function efficiency(row){return row.j?Math.round((row.pts/(row.j*3))*100):0}
function table(group){
  const limit=qualifierLimit(group);
  return`<section class="stand-group"><header><div><span class="eyebrow">Tabela oficial</span><h3>${esc(group.name)}</h3></div><span>${limit} classifica${limit===1?'':'m'} • ${group.rows.length} clubes</span></header><div class="stand-scroll"><table><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>APR</th><th>Últimos</th></tr></thead><tbody>${group.rows.map((r,i)=>`<tr class="${i<limit?'qualified':''}"><td><b class="stand-pos">${i+1}</b></td><td><div class="stand-club">${badge(r.name)}<span><b>${esc(r.name)}</b><small>${esc(teamMeta(r.name)?.master?`Mestre ${teamMeta(r.name).master}`:'Clã BDA')}</small></span></div></td><td class="stand-points">${r.pts}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp}</td><td>${r.gc}</td><td class="${r.sg>0?'positive':r.sg<0?'negative':''}">${r.sg>0?'+':''}${r.sg}</td><td>${efficiency(r)}%</td><td><div class="stand-form">${form(r.last)}</div></td></tr>`).join('')}</tbody></table></div></section>`
}
function highlights(groups){const all=groups.flatMap(g=>g.rows);if(!all.length)return'';const attack=[...all].sort((a,b)=>b.gp-a.gp)[0],defense=[...all].sort((a,b)=>a.gc-b.gc||b.j-a.j)[0],leader=[...all].sort((a,b)=>b.pts-a.pts||b.sg-a.sg)[0];return`<div class="stand-highlights"><article><span>👑 Líder</span><b>${esc(leader.name)}</b><small>${leader.pts} pontos</small></article><article><span>⚽ Melhor ataque</span><b>${esc(attack.name)}</b><small>${attack.gp} gols</small></article><article><span>🛡 Melhor defesa</span><b>${esc(defense.name)}</b><small>${defense.gc} sofridos</small></article></div>`}
function content(){const t=tournament(),groups=calculate();if(!t)return'';const compatible=norm(t.format).includes('pontos corridos')||games(currentId).some(g=>norm(g.phase).includes('grupo')||g.group);if(!compatible)return`<div class="stand-empty"><b>Classificação disponível para ligas e grupos</b><span>Este campeonato está configurado apenas como mata-mata. Acesse o chaveamento para acompanhar os classificados.</span></div>`;return`<div class="stand-head"><div><span class="eyebrow">Atualização instantânea</span><h2>Classificação automática</h2><p>3 pontos por vitória, 1 por empate. Desempate por vitórias, saldo de gols e gols marcados.</p></div><button class="primary" id="standPhoto">📸 Foto da tabela</button></div>${groups.length?`${highlights(groups)}<div id="standCapture">${groups.map(table).join('')}</div>`:'<div class="stand-empty"><b>Aguardando resultados</b><span>Quando os placares de liga ou grupos forem salvos, a tabela será montada automaticamente.</span></div>'}`}
function ensure(){
  const manager=$('#giManager');if(!manager)return;const id=manager.dataset.tid||'';if(id!==currentId){currentId=id;active=false;lastSignature=''}
  const nav=$(':scope>nav',manager);if(nav&&!$('[data-standings-tab]',nav)){const b=document.createElement('button');b.dataset.standingsTab='true';b.textContent='Classificação';nav.append(b)}
  let panel=$('#autoStandings');if(!panel){panel=document.createElement('section');panel.id='autoStandings';panel.hidden=true;manager.append(panel)}
  const signature=JSON.stringify([currentId,tournament()?.format,tournament()?.groupSettings,tournament()?.qualifiersPerGroup,games(currentId),clubs().map(t=>[t.name,t.badge,t.master])]);
  if(active&&signature!==lastSignature){panel.innerHTML=content();lastSignature=signature;bindPhoto()}
  manager.classList.toggle('stand-active',active);const giContent=$('.gi-content',manager);if(giContent)giContent.hidden=active;panel.hidden=!active;
}
function bindPhoto(){$('#standPhoto')?.addEventListener('click',()=>{if(window.ArenaBDACapture?.element)window.ArenaBDACapture.element($('#standCapture')||$('#autoStandings'),'Classificação automática',`classificacao-${tournament()?.name||'arena-bda'}`);else if(typeof toast==='function')toast('A ferramenta de imagem ainda está carregando')})}
document.addEventListener('click',event=>{
  const stand=event.target.closest('[data-standings-tab]');if(stand){active=true;$$('#giManager>nav button').forEach(b=>b.classList.toggle('active',b===stand));ensure();const panel=$('#autoStandings');if(panel){panel.innerHTML=content();lastSignature=JSON.stringify([currentId,tournament()?.format,tournament()?.groupSettings,tournament()?.qualifiersPerGroup,games(currentId),clubs().map(t=>[t.name,t.badge,t.master])]);bindPhoto()}return}
  const other=event.target.closest('#giManager>nav button[data-tab]');if(other){active=false;setTimeout(ensure)}
});
const style=document.createElement('style');style.textContent=`#giManager>nav{grid-template-columns:repeat(4,1fr)!important}.stand-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:13px 0}.stand-head h2{margin:4px 0;font-size:29px;text-transform:uppercase}.stand-head p{margin:0;color:var(--muted);font-size:9px}.stand-head button{white-space:nowrap}.stand-highlights{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.stand-highlights article{padding:12px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.stand-highlights span,.stand-highlights b,.stand-highlights small{display:block}.stand-highlights span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}.stand-highlights b{overflow:hidden;margin:5px 0;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.stand-highlights small{color:var(--muted);font-size:8px}.stand-group{overflow:hidden;margin-bottom:12px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.stand-group>header{display:flex;align-items:end;justify-content:space-between;gap:10px;padding:13px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#17402a,#07100c)}.stand-group h3{margin:3px 0 0;color:var(--gold-soft);font-size:22px;text-transform:uppercase}.stand-group>header>span{color:var(--muted);font-size:8px;text-transform:uppercase}.stand-scroll{overflow:auto}.stand-group table{width:100%;min-width:820px;border-collapse:collapse}.stand-group th,.stand-group td{padding:10px 8px;border-bottom:1px solid var(--line);font-size:9px;text-align:center}.stand-group th{color:var(--gold-soft);background:#050c08;font-size:8px;text-transform:uppercase}.stand-group tbody tr:last-child td{border-bottom:0}.stand-group tbody tr.qualified{box-shadow:inset 3px 0 var(--green)}.stand-group tbody tr:hover{background:#ffffff05}.stand-pos{display:grid;place-items:center;width:25px;height:25px;margin:auto;border-radius:8px;color:#171107;background:var(--gold-soft)}.stand-club{display:flex;align-items:center;gap:8px;min-width:190px;text-align:left}.stand-club span span,.stand-club b,.stand-club small{display:block}.stand-club b{font-size:10px}.stand-club small{margin-top:3px;color:var(--muted);font-size:7px}.stand-badge{overflow:hidden;display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border:1px solid #f2d77d4f;border-radius:11px;color:#171107;background:linear-gradient(145deg,#f5df93,#be9021);font-size:8px;font-weight:900}.stand-badge img{width:100%;height:100%;object-fit:cover}.stand-points{color:var(--gold-soft);font-size:13px!important;font-weight:900}.positive{color:var(--green)}.negative{color:#ff9aa4}.stand-form{display:flex;justify-content:center;gap:3px}.stand-form i{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;font-style:normal;font-size:7px;font-weight:900}.stand-form i[data-result="V"]{color:#07100c;background:var(--green)}.stand-form i[data-result="E"]{color:#171107;background:var(--gold-soft)}.stand-form i[data-result="D"]{color:#fff;background:var(--red)}.stand-form span{color:var(--muted)}.stand-empty{display:grid;place-items:center;gap:6px;min-height:180px;padding:25px;border:1px dashed var(--line-strong);border-radius:18px;color:var(--muted);text-align:center}.stand-empty b{color:var(--text);font-size:12px}.stand-empty span{max-width:520px;font-size:9px;line-height:1.5}@media(max-width:650px){#giManager>nav{grid-template-columns:repeat(4,minmax(92px,1fr))!important;overflow-x:auto}.stand-head{display:grid}.stand-head button{width:100%}.stand-highlights{grid-template-columns:1fr}}`;document.head.append(style);
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(ensure,80)}).observe(document.body,{childList:true,subtree:true});
ensure();
})();
