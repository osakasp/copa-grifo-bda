(() => {
'use strict';

const ADMIN='miniamikaren@gmail.com';
const TK='bda-v3-tournaments',TEAMK='bda-v2-teams',LOCAL='bda-v4-registration-receipts';
const COLLECTION='arenaData';
let user=null,db=null,unsubscribe=null,requests=[],filter='pendente',busy=false,renderTimer=0;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const admin=()=>user&&String(user.email||'').toLowerCase()===ADMIN;
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function tournaments(){const x=read(TK,[]);return Array.isArray(x)?x:[]}
function teams(){const x=read(TEAMK,[]);return Array.isArray(x)?x:[]}
function openTournaments(){return tournaments().filter(t=>norm(t.status)==='inscricoes abertas')}
function initials(name){return String(name||'BDA').split(/\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join('').toUpperCase()}
function notify(m){typeof toast==='function'?toast(m):console.info(m)}
function dateLabel(value){if(!value)return'Agora';const d=value.toDate?value.toDate():new Date(value);return Number.isNaN(d.getTime())?'Agora':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)}
function receipt(id,tournament,team){const list=read(LOCAL,[]);list.unshift({id,tournament,team,createdAt:Date.now()});localStorage.setItem(LOCAL,JSON.stringify(list.slice(0,20)))}
function badge(team){const found=teams().find(t=>norm(t.name)===norm(team));return found?.badge?`<span class="signup-badge"><img src="${esc(found.badge)}" alt="Escudo de ${esc(team)}"></span>`:`<span class="signup-badge">${esc(found?.code||initials(team))}</span>`}

function installNavigation(){
  let page=$('[data-page="registrations"]');
  if(!page){page=document.createElement('section');page.className='page';page.dataset.page='registrations';$('main')?.append(page)}
  const nav=$('.bottom-nav');
  if(nav&&!$('[data-go="registrations"]',nav)){
    const btn=document.createElement('button');btn.className='nav-btn';btn.dataset.go='registrations';btn.innerHTML='<i>✍️</i><span>Inscrições</span>';
    const tournament=$('[data-go="tournament"]',nav);tournament?.after(btn);
    btn.addEventListener('click',()=>{navigate('registrations');render()});
  }
  const hero=$('[data-page="home"] .hero-actions');
  if(hero&&!$('[data-go="registrations"]',hero)){
    const btn=document.createElement('button');btn.className='secondary';btn.dataset.go='registrations';btn.textContent='Fazer inscrição';btn.addEventListener('click',()=>{navigate('registrations');render()});hero.append(btn)
  }
  const tools=$('#adminPanel .admin-tools');
  if(tools&&!$('[data-go="registrations"]',tools)){
    const btn=document.createElement('button');btn.className='ghost';btn.dataset.go='registrations';btn.textContent='Aprovar inscrições';btn.addEventListener('click',()=>{navigate('registrations');render()});tools.append(btn)
  }
}

function tournamentCards(){
  const list=openTournaments();
  if(!list.length)return'<div class="signup-empty"><b>Nenhuma inscrição aberta</b><span>Quando o administrador abrir uma competição, ela aparecerá aqui.</span></div>';
  return`<div class="signup-open-grid">${list.map(t=>{
    const used=Array.isArray(t.participants)?t.participants.length:0,max=Number(t.maxTeams)||0,left=max?Math.max(0,max-used):'∞';
    return`<article class="signup-open-card"><span>${esc(t.badge||'🏆')}</span><div><small>${esc(t.edition||'Nova edição')}</small><h3>${esc(t.name)}</h3><p>${esc(t.format||'Formato a definir')} • ${used}/${max||'∞'} inscritos</p></div><b>${left}<small> vagas</small></b><button data-pick-tournament="${esc(t.id)}">Inscrever meu time</button></article>`
  }).join('')}</div>`;
}

function publicForm(){
  const opens=openTournaments(),clubOptions=teams().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')).map(t=>`<option value="${esc(t.name)}">`).join('');
  return`<section class="signup-form-card"><div class="signup-form-copy"><span class="eyebrow">Entrada oficial na arena</span><h2>Solicitar inscrição</h2><p>O envio entra na fila. O clube só participa depois da aprovação do administrador.</p><ol><li>Envie os dados</li><li>O administrador analisa</li><li>O time entra no campeonato</li></ol></div><form id="publicRegistrationForm"><div class="form-grid two"><label>Campeonato<select id="signupTournament" required><option value="">Escolha a competição</option>${opens.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} • ${esc(t.edition||'')}</option>`).join('')}</select></label><label>Nome do time<input id="signupTeam" list="signupTeamList" maxlength="60" required placeholder="Ex.: JOGOBUGADO BDA"><datalist id="signupTeamList">${clubOptions}</datalist></label><label>Mestre / responsável<input id="signupOwner" maxlength="60" required placeholder="Nome do responsável"></label><label>WhatsApp / contato<input id="signupContact" maxlength="60" required inputmode="tel" placeholder="DDD + número"></label><label>ID ou nome no jogo<input id="signupGame" maxlength="60" placeholder="Opcional"></label><label class="signup-honey" aria-hidden="true">Site<input id="signupWebsite" tabindex="-1" autocomplete="off"></label></div><label>Observação<textarea id="signupNote" maxlength="300" placeholder="Informações importantes para o administrador"></textarea></label><label class="signup-consent"><input id="signupAccept" type="checkbox" required><span>Confirmo que os dados estão corretos e aceito o regulamento do campeonato.</span></label><button class="primary signup-submit" type="submit" ${opens.length?'':'disabled'}>Enviar para aprovação</button><small class="signup-security">🛡️ O contato fica visível apenas para a administração.</small></form></section>`;
}

function statusClass(status){return status==='aprovado'?'approved':status==='recusado'?'rejected':'pending'}
function queue(){
  if(!admin())return'';
  const counts={pendente:0,aprovado:0,recusado:0};requests.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
  const list=requests.filter(r=>filter==='todos'||r.status===filter);
  return`<section class="signup-admin"><div class="section-head"><div><span class="eyebrow">Área administrativa</span><h2>Fila de aprovação</h2><p>Analise cada pedido antes de incluir o clube na competição.</p></div><span class="signup-admin-total">${requests.length} pedidos</span></div><div class="signup-tabs"><button data-signup-filter="pendente" class="${filter==='pendente'?'active':''}">Pendentes <b>${counts.pendente}</b></button><button data-signup-filter="aprovado" class="${filter==='aprovado'?'active':''}">Aprovados <b>${counts.aprovado}</b></button><button data-signup-filter="recusado" class="${filter==='recusado'?'active':''}">Recusados <b>${counts.recusado}</b></button><button data-signup-filter="todos" class="${filter==='todos'?'active':''}">Todos</button></div><div class="signup-queue">${list.length?list.map(r=>`<article class="signup-request"><header><div>${badge(r.team)}<span><b>${esc(r.team)}</b><small>${esc(r.tournamentName)}</small></span></div><em class="${statusClass(r.status)}">${esc(r.status)}</em></header><dl><div><dt>Responsável</dt><dd>${esc(r.owner)}</dd></div><div><dt>Contato</dt><dd>${esc(r.contact)}</dd></div><div><dt>Jogo</dt><dd>${esc(r.game||'Não informado')}</dd></div><div><dt>Enviado</dt><dd>${esc(dateLabel(r.createdAt))}</dd></div></dl>${r.note?`<p>${esc(r.note)}</p>`:''}<footer>${r.status==='pendente'?`<button class="primary" data-signup-approve="${esc(r.id)}">Aprovar</button><button class="danger" data-signup-reject="${esc(r.id)}">Recusar</button>`:''}<button class="ghost" data-signup-delete="${esc(r.id)}">Excluir</button></footer></article>`).join(''):'<div class="signup-empty"><b>Nenhum pedido neste filtro</b><span>A fila está limpa.</span></div>'}</div></section>`;
}

function render(){
  installNavigation();const page=$('[data-page="registrations"]');if(!page)return;
  page.innerHTML=`<div class="signup-hero"><div><span class="eyebrow">Central de inscrições BDA</span><h1>Entre na competição</h1><p>Uma porta única para inscrições, análise administrativa e confirmação dos participantes.</p></div><aside><b>${openTournaments().length}</b><span>campeonatos abertos</span><small>A aprovação é feita pela administração.</small></aside></div><div class="section-head"><div><span class="eyebrow">Vagas disponíveis</span><h2>Competições abertas</h2><p>Escolha a arena em que seu clube deseja competir.</p></div></div>${tournamentCards()}${publicForm()}${queue()}`;
  $('#publicRegistrationForm')?.addEventListener('submit',submit);
  $('[data-page="registrations"]')?.scrollTo?.(0,0);
}

async function submit(event){
  event.preventDefault();if(busy)return;
  if($('#signupWebsite')?.value)return;
  const last=Number(localStorage.getItem('bda-registration-last')||0);if(Date.now()-last<60000){notify('Aguarde um minuto antes de enviar outra inscrição');return}
  const tournamentId=$('#signupTournament').value,selected=tournaments().find(t=>t.id===tournamentId);
  const data={tournamentId,tournamentName:selected?.name||'',team:$('#signupTeam').value.trim(),owner:$('#signupOwner').value.trim(),contact:$('#signupContact').value.trim(),game:$('#signupGame').value.trim(),note:$('#signupNote').value.trim(),accepted:$('#signupAccept').checked};
  if(!selected||!data.team||!data.owner||!data.contact||!data.accepted){notify('Preencha os campos obrigatórios');return}
  if((selected.participants||[]).some(n=>norm(n)===norm(data.team))){notify('Este time já está inscrito no campeonato');return}
  if(!db){notify('A conexão com a nuvem ainda está carregando');return}
  busy=true;const button=$('.signup-submit');if(button){button.disabled=true;button.textContent='Enviando...'}
  try{
    const id=`registration-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    await db.collection(COLLECTION).doc(id).set({dataset:'registration',...data,status:'pendente',createdAt:firebase.firestore.FieldValue.serverTimestamp(),source:'arenabda.com.br'});
    localStorage.setItem('bda-registration-last',String(Date.now()));receipt(id,data.tournamentName,data.team);event.target.reset();notify('Inscrição enviada para aprovação');
    const box=document.createElement('div');box.className='signup-success';box.innerHTML=`<b>✅ Pedido recebido</b><span>${esc(data.team)} entrou na fila de ${esc(data.tournamentName)}.</span>`;event.target.prepend(box);setTimeout(()=>box.remove(),7000)
  }catch(error){console.error(error);notify(String(error?.code||'').includes('permission-denied')?'Publique as novas regras do Firestore':'Não foi possível enviar a inscrição')}
  finally{busy=false;if(button){button.disabled=false;button.textContent='Enviar para aprovação'}}
}

function updateLocalApproval(request){
  const ts=tournaments(),index=ts.findIndex(t=>t.id===request.tournamentId);if(index<0)throw new Error('Campeonato não encontrado');
  const participants=Array.isArray(ts[index].participants)?[...ts[index].participants]:[];
  if(participants.some(n=>norm(n)===norm(request.team)))throw new Error('Time já inscrito');
  const limit=Number(ts[index].maxTeams)||0;if(limit&&participants.length>=limit)throw new Error('Não há vagas disponíveis');
  participants.push(request.team);ts[index]={...ts[index],participants,updatedAt:Date.now()};localStorage.setItem(TK,JSON.stringify(ts));
  const clubList=teams();if(!clubList.some(t=>norm(t.name)===norm(request.team))){clubList.push({name:request.team,master:request.owner,code:initials(request.team),status:'Confirmado'});localStorage.setItem(TEAMK,JSON.stringify(clubList))}
}
async function approve(id){
  if(!admin()||busy)return;const request=requests.find(r=>r.id===id);if(!request)return;busy=true;
  try{updateLocalApproval(request);await db.collection(COLLECTION).doc(id).update({status:'aprovado',reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),reviewedBy:user.email.toLowerCase()});notify('Inscrição aprovada e time adicionado');setTimeout(()=>location.reload(),1400)}catch(error){console.error(error);notify(error.message||'Não foi possível aprovar')}finally{busy=false}
}
async function reject(id){if(!admin()||busy)return;busy=true;try{await db.collection(COLLECTION).doc(id).update({status:'recusado',reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),reviewedBy:user.email.toLowerCase()});notify('Inscrição recusada')}catch(error){console.error(error);notify('Não foi possível recusar')}finally{busy=false}}
async function remove(id){if(!admin()||busy||!confirm('Excluir este pedido de inscrição?'))return;busy=true;try{await db.collection(COLLECTION).doc(id).delete();notify('Pedido excluído')}catch(error){console.error(error);notify('Não foi possível excluir')}finally{busy=false}}

function listenAdmin(){
  unsubscribe?.();unsubscribe=null;requests=[];
  if(!admin()||!db){render();return}
  unsubscribe=db.collection(COLLECTION).where('dataset','==','registration').onSnapshot(snapshot=>{requests=snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>{const ta=a.createdAt?.toMillis?.()||0,tb=b.createdAt?.toMillis?.()||0;return tb-ta});render()},error=>{console.error(error);notify('Não foi possível carregar a fila de inscrições')})
}

document.addEventListener('click',event=>{
  const pick=event.target.closest('[data-pick-tournament]');if(pick){$('#signupTournament').value=pick.dataset.pickTournament;$('#signupTeam')?.focus();$('.signup-form-card')?.scrollIntoView({behavior:'smooth',block:'start'})}
  const tab=event.target.closest('[data-signup-filter]');if(tab){filter=tab.dataset.signupFilter;render()}
  const approveButton=event.target.closest('[data-signup-approve]');if(approveButton)approve(approveButton.dataset.signupApprove);
  const rejectButton=event.target.closest('[data-signup-reject]');if(rejectButton)reject(rejectButton.dataset.signupReject);
  const deleteButton=event.target.closest('[data-signup-delete]');if(deleteButton)remove(deleteButton.dataset.signupDelete);
});

const style=document.createElement('style');style.textContent=`.bottom-nav{grid-template-columns:repeat(7,minmax(62px,1fr))!important;overflow-x:auto}.signup-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.35fr .65fr;gap:18px;align-items:end;padding:25px;border:1px solid var(--line-strong);border-radius:28px;background:radial-gradient(circle at 86% 4%,rgba(242,215,125,.3),transparent 34%),linear-gradient(135deg,#17432b,#07130d 62%,#030806);box-shadow:var(--shadow)}.signup-hero:after{content:"BDA";position:absolute;right:-13px;bottom:-41px;color:#fff1;font:900 155px/1 "Barlow Condensed",sans-serif}.signup-hero>div,.signup-hero aside{position:relative;z-index:1}.signup-hero h1{margin:8px 0;font-size:clamp(42px,9vw,72px)}.signup-hero p{max-width:600px;margin:0;color:#cad6ce;font-size:12px}.signup-hero aside{padding:16px;border:1px solid #f2d77d45;border-radius:19px;background:#03080692}.signup-hero aside b,.signup-hero aside span,.signup-hero aside small{display:block}.signup-hero aside b{color:var(--gold-soft);font:900 42px/1 "Barlow Condensed",sans-serif}.signup-hero aside span{margin-top:4px;font-size:10px;font-weight:900;text-transform:uppercase}.signup-hero aside small{margin-top:8px;color:var(--muted);font-size:8px}.signup-open-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.signup-open-card{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:11px;padding:14px;border:1px solid var(--line);border-radius:19px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.signup-open-card>span{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:#ffffff08;font-size:28px}.signup-open-card h3{margin:3px 0;font-size:20px;text-transform:uppercase}.signup-open-card p,.signup-open-card small{margin:0;color:var(--muted);font-size:8px}.signup-open-card>b{color:var(--gold-soft);font:900 25px "Barlow Condensed",sans-serif;text-align:center}.signup-open-card>b small{display:block;font:800 7px Inter,sans-serif;text-transform:uppercase}.signup-open-card button{grid-column:2/-1;min-height:37px;border:1px solid var(--line-strong);border-radius:11px;color:var(--gold-soft);background:#f2d77d0d;font-size:9px;font-weight:900}.signup-form-card{display:grid;grid-template-columns:.75fr 1.25fr;gap:20px;margin-top:18px;padding:20px;border:1px solid var(--line-strong);border-radius:24px;background:radial-gradient(circle at 0 0,rgba(216,178,72,.13),transparent 30%),linear-gradient(145deg,#112a1c,#050c08)}.signup-form-copy h2{margin:7px 0;font-size:32px;text-transform:uppercase}.signup-form-copy p{color:var(--muted);font-size:10px;line-height:1.55}.signup-form-copy ol{display:grid;gap:8px;margin:16px 0 0;padding:0;counter-reset:step;list-style:none}.signup-form-copy li{display:flex;align-items:center;gap:8px;color:#dce7df;font-size:9px}.signup-form-copy li:before{counter-increment:step;content:counter(step);display:grid;place-items:center;width:26px;height:26px;border:1px solid #f2d77d55;border-radius:9px;color:var(--gold-soft);font-weight:900}.signup-consent{grid-template-columns:auto 1fr;align-items:start;margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px;background:#ffffff05;text-transform:none;letter-spacing:0}.signup-consent input{width:19px;height:19px;margin:0}.signup-consent span{font-size:9px;line-height:1.45}.signup-submit{width:100%;margin-top:10px}.signup-security{display:block;margin-top:8px;color:var(--muted);font-size:8px;text-align:center}.signup-honey{position:absolute!important;left:-9999px!important}.signup-success{display:grid;gap:4px;margin-bottom:10px;padding:11px;border:1px solid rgba(79,223,143,.3);border-radius:12px;color:var(--green);background:rgba(79,223,143,.08)}.signup-success span{color:#cfe4d6;font-size:9px}.signup-admin{margin-top:20px}.signup-admin-total{padding:7px 9px;border-radius:999px;color:var(--gold-soft);background:#f2d77d10;font-size:8px;font-weight:900;text-transform:uppercase}.signup-tabs{display:flex;gap:6px;overflow:auto;margin-bottom:10px;padding-bottom:3px}.signup-tabs button{min-height:37px;padding:0 11px;white-space:nowrap;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:#ffffff05;font-size:8px;font-weight:900;text-transform:uppercase}.signup-tabs button.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.signup-tabs b{margin-left:4px}.signup-queue{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.signup-request{padding:13px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.signup-request header{display:flex;justify-content:space-between;gap:10px}.signup-request header>div{display:flex;align-items:center;gap:9px;min-width:0}.signup-request header b,.signup-request header small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.signup-request header b{font-size:11px}.signup-request header small{margin-top:3px;color:var(--muted);font-size:8px}.signup-badge{overflow:hidden;display:grid;place-items:center;width:42px;height:42px;flex:0 0 auto;border:1px solid #f2d77d54;border-radius:13px;color:#171107;background:linear-gradient(145deg,#f5df93,#bd8f20);font-size:9px;font-weight:900}.signup-badge img{width:100%;height:100%;object-fit:cover}.signup-request em{align-self:start;padding:6px 8px;border-radius:999px;font-size:7px;font-style:normal;font-weight:900;text-transform:uppercase}.signup-request em.pending{color:var(--gold-soft);background:#f2d77d12}.signup-request em.approved{color:var(--green);background:rgba(79,223,143,.1)}.signup-request em.rejected{color:#ff9aa4;background:rgba(255,105,120,.1)}.signup-request dl{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:11px 0}.signup-request dl div{padding:8px;border:1px solid var(--line);border-radius:10px;background:#ffffff04}.signup-request dt{color:var(--muted);font-size:7px;text-transform:uppercase}.signup-request dd{overflow:hidden;margin:4px 0 0;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.signup-request>p{padding:9px;border-radius:10px;color:#d6e1da;background:#ffffff05;font-size:9px;line-height:1.45}.signup-request footer{display:flex;gap:7px;margin-top:10px}.signup-request footer button{flex:1;min-height:37px;padding:0 9px;font-size:8px}.signup-empty{display:grid;place-items:center;gap:5px;min-height:150px;padding:22px;border:1px dashed var(--line-strong);border-radius:18px;color:var(--muted);text-align:center}.signup-empty b{color:var(--text)}.signup-empty span{font-size:9px}@media(max-width:760px){.signup-hero,.signup-form-card{grid-template-columns:1fr}.signup-open-grid,.signup-queue{grid-template-columns:1fr}.bottom-nav{grid-template-columns:repeat(7,minmax(64px,1fr))!important}.signup-request dl{grid-template-columns:1fr}.signup-request footer{display:grid}.signup-open-card{grid-template-columns:44px 1fr auto}}`;document.head.append(style);

installNavigation();render();
if(window.firebase&&firebase.firestore&&firebase.auth){db=firebase.firestore();firebase.auth().onAuthStateChanged(current=>{user=current;listenAdmin()})}
new MutationObserver(()=>{clearTimeout(renderTimer);renderTimer=setTimeout(installNavigation,100)}).observe(document.body,{childList:true,subtree:true});
})();
