(() => {
  'use strict';
  const C = window.ArenaPortalCore, seeds = window.ArenaPortalData;
  const storage = {getItem:key => localStorage.getItem(key),setItem:(key,value) => localStorage.setItem(key,value)};
  const repo = C.createRepository(storage,seeds,navigator.locks);
  let tournaments = repo.state, currentId = null, view = 'matches', roundChoice = '0', teamFilter = '', statusFilter = 'all', catalogFilter = 'Todos', catalogSearch = '', visibleRounds = 2;
  let draft = {}, draftRevision = null, busy = false, preview = null, lastHash = '', sync = null, cloud = null, cloudTournamentId = null, sdkPromise = null;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const current = () => cloud?.tournament && cloudTournamentId === currentId ? {...tournaments.find(t => t.id === currentId),results:cloud.tournament.results} : tournaments.find(t => t.id === currentId);
  const cloudEnabled = () => window.ArenaPortalConfig?.enabled === true;
  const dirty = () => Object.keys(draft).length > 0;
  const editable = () => !repo.errors.length && (!cloudEnabled() || cloud?.canWrite);
  const notify = message => { $('notice').hidden = false; $('notice').textContent = message; };
  const reportError = error => notify(error.message || 'Não foi possível concluir a operação.');
  const download = (payload, name) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  const backupState = () => tournaments.map(t => t.id === currentId && cloud?.tournament ? {...t,results:C.clone(cloud.tournament.results)} : t);
  const firstPending = t => Math.max(0,(t.matches || []).findIndex((round,r) => round.some((_,m) => !C.validScore(t.results?.[C.keyFor(r,m)]))));
  function badge(t,name) {
    const image = t.teamProfiles?.[name]?.badge;
    return '<span class="team-badge" aria-hidden="true">' + (image && C.validBadge(image) ? '<img src="'+esc(image)+'" width="28" height="28" loading="lazy" decoding="async" alt="">' : esc(name.split(/\s+/).slice(0,2).map(n => n[0]).join(''))) + '</span>';
  }
  const club = (t,name,away=false) => '<span class="club-name '+(away?'away':'')+'">'+badge(t,name)+'<span>'+esc(name)+'</span></span>';
  function renderHome() {
    $('summary').innerHTML = '<div><b>'+tournaments.filter(t => t.status==='Em andamento').length+'</b><span>Em andamento</span></div><div><b>'+new Set(tournaments.flatMap(t => t.participants)).size+'</b><span>Clubes nos registros</span></div><div><b>'+tournaments.reduce((n,t) => n+C.matchKeys(t).length,0)+'</b><span>Jogos cadastrados</span></div>';
    const list = tournaments.filter(t => (catalogFilter==='Todos'||t.status===catalogFilter) && C.normalizeName(t.name).includes(C.normalizeName(catalogSearch)));
    $('competitionCount').textContent = list.length+' competições';
    $('grid').innerHTML = list.map(t => '<article class="competition-card" data-id="'+esc(t.id)+'"><div class="card-top"><span class="status-pill">'+esc(t.status)+'</span><span class="edition">'+esc(t.edition||'Temporada atual')+'</span></div><h3>'+esc(t.name)+'</h3><p>'+esc(t.description||'Competição do Clã BDA.')+'</p><div class="card-meta"><span>'+esc(t.format||'Formato a definir')+'</span><span>·</span><span>'+t.participants.length+' clubes</span><span>·</span><span>'+C.matchKeys(t).length+' jogos</span></div><button class="open" data-open="'+esc(t.id)+'" aria-label="Abrir '+esc(t.name)+'">Acompanhar campeonato <span aria-hidden="true">→</span></button></article>').join('') || '<p class="empty">Nenhum campeonato encontrado.</p>';
  }
  function roundSelect(t,admin=false) {
    return '<label>Rodada<select id="roundChoice">'+(!admin?'<option value="all"'+(roundChoice==='all'?' selected':'')+'>Todas as rodadas</option>':'')+(t.matches||[]).map((_,r) => '<option value="'+r+'"'+(String(r)===roundChoice?' selected':'')+'>Rodada '+(r+1)+'</option>').join('')+'</select></label>';
  }
  function matchesPanel(t) {
    if (!(t.matches||[]).length) return '<div class="empty">Confrontos ainda não cadastrados nesta edição. Consulte as ferramentas da Arena para os registros das demais competições.</div>';
    const selected = t.matches.map((games,r) => ({r,games:games.map((pair,m) => ({pair,m,res:t.results?.[C.keyFor(r,m)]})).filter(g => (!teamFilter||g.pair.includes(teamFilter)) && (statusFilter==='all'||(statusFilter==='played')===C.validScore(g.res)))})).filter(x => (roundChoice==='all'||x.r===Number(roundChoice)) && x.games.length);
    const rounds = roundChoice==='all' ? selected.slice(0,visibleRounds) : selected;
    return '<div class="match-filters">'+roundSelect(t)+'<label>Clube<select id="teamFilter"><option value="">Todos os clubes</option>'+t.participants.map(n => '<option'+(n===teamFilter?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label><label>Resultados<select id="statusFilter"><option value="all"'+(statusFilter==='all'?' selected':'')+'>Todos</option><option value="played"'+(statusFilter==='played'?' selected':'')+'>Com placar</option><option value="pending"'+(statusFilter==='pending'?' selected':'')+'>Pendentes</option></select></label></div><div class="round-navigation"><button data-round-step="-1" '+(roundChoice==='all'||Number(roundChoice)===0?'disabled':'')+' aria-label="Rodada anterior">←</button><p>'+selected.reduce((n,x) => n+x.games.length,0)+' jogos no filtro<br>'+Object.values(t.results).filter(C.validScore).length+'/'+C.matchKeys(t).length+' com placar</p><button data-round-step="1" '+(roundChoice==='all'||Number(roundChoice)>=t.matches.length-1?'disabled':'')+' aria-label="Próxima rodada">→</button></div>'+(rounds.map(({r,games}) => '<section class="round"><h3>Rodada '+(r+1)+(t.byes?.[r]?'<span class="bye">Folga: '+esc(t.byes[r])+'</span>':'')+'</h3>'+games.map(({pair,res}) => '<div class="match">'+club(t,pair[0])+(C.validScore(res)?'<span class="score">'+C.score(res.home)+' × '+C.score(res.away)+'</span>':'<span class="pending-score">Aguardando<br>placar</span>')+club(t,pair[1],true)+'</div>').join('')+'</section>').join('') || '<p class="empty">Nenhum jogo para estes filtros.</p>')+(selected.length>rounds.length?'<button data-more>Carregar mais rodadas</button>':'');
  }
  function tablePanel(t) {
    if (t.format!=='Pontos corridos') return '<p class="empty">Este formato não utiliza classificação por pontos corridos. Consulte os confrontos da competição.</p>';
    const rows = C.standings(t);
    return '<p class="note">'+(cloudEnabled()?'Resultados recebidos do servidor.':'Classificação deste navegador. Resultados locais não são oficiais nem compartilhados.')+'</p><div class="standing-wrap" tabindex="0" role="region" aria-label="Tabela completa, deslize horizontalmente"><table class="standing"><caption>Desempate: pontos, saldo de gols e gols marcados. Empates completos aparecem em ordem alfabética.</caption><thead><tr>'+['Pos.','Clube','J','V','E','D','GP','GC','SG','%','Pts'].map(n => '<th scope="col">'+n+'</th>').join('')+'</tr></thead><tbody>'+rows.map((row,i) => '<tr><td>'+(i+1)+'</td><th scope="row">'+club(t,row.name)+'</th>'+[row.played,row.won,row.draw,row.lost,row.goalsFor,row.goalsAgainst,row.goalsFor-row.goalsAgainst,row.played?Math.round(row.points/(row.played*3)*100):0,row.points].map(n => '<td>'+n+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="legend">J: jogos · V/E/D: vitórias, empates e derrotas · GP/GC: gols pró/contra · SG: saldo · %: aproveitamento. As zonas de acesso e queda dependem do regulamento da edição.</p>';
  }
  function clubsPanel(t) {
    return '<div class="team-grid">'+t.participants.map(n => '<div class="team-card">'+badge(t,n)+'<span>'+esc(n)+'</span></div>').join('')+'</div>'+(!(t.participants||[]).length?'<p class="empty">Nenhum clube confirmado nesta edição.</p>':'')+pendingPanel(t,false);
  }
  function pendingPanel(t,admin) {
    const canApprove = admin && !cloudEnabled() && !(t.matches||[]).length && t.status!=='Finalizado';
    return (t.pendingTeams||[]).length?'<h3>Solicitações locais</h3>'+(t.pendingTeams||[]).map((n,i) => '<div class="pending-item"><span>'+esc(n)+'<br><small class="muted">Pendente de aprovação</small></span>'+(canApprove?'<button data-approve="'+i+'">Aprovar clube</button>':'')+'</div>').join(''):'';
  }
  function adminPanel(t) {
    if (repo.errors.length) return '<p class="note">Gravação bloqueada: '+esc(repo.errors.join(' · '))+'. Exporte o armazenamento bruto na central de backups.</p><a href="#backups">Abrir backups</a>';
    if (cloudEnabled() && !cloud?.canWrite) return '<p class="note">'+esc(cloud?.message||'Conectando ao servidor…')+'</p><h3>Acesso administrativo</h3><form data-login><div class="form-grid"><label>E-mail<input type="email" name="email" autocomplete="username" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" required></label></div><div class="admin-actions"><button class="primary" type="submit">Entrar</button></div></form><p class="muted">A conta precisa ter e-mail verificado e permissão administrativa no servidor.</p>';
    const r = roundChoice==='all'?0:Number(roundChoice), round = t.matches?.[r]||[];
    return '<p class="note">'+(cloudEnabled()?'Administração autenticada. O salvamento aguarda confirmação do servidor.':'Modo local. As alterações ficam somente neste navegador e não publicam resultados oficiais.')+'</p>'+(cloudEnabled()?'<button data-logout>Sair da administração</button>':'')+(round.length?'<div class="admin-section"><h3>Editar placares</h3>'+roundSelect(t,true)+'<p class="muted">Use gols de 0 a 99. Para retirar um resultado, apague os dois campos.</p><form data-results-form>'+round.map((pair,m) => { const key=C.keyFor(r,m),value=draft[key]||t.results?.[key]||{}; return '<div class="admin-match" data-match="'+key+'"><div class="score-fields"><label>'+esc(pair[0])+'<input class="score-input" inputmode="numeric" type="text" pattern="[0-9]{1,2}" maxlength="2" name="home-'+m+'" data-score="home" data-key="'+key+'" value="'+esc(value.home??'')+'" aria-label="Gols de '+esc(pair[0])+'"></label><label>'+esc(pair[1])+'<input class="score-input" inputmode="numeric" type="text" pattern="[0-9]{1,2}" maxlength="2" name="away-'+m+'" data-score="away" data-key="'+key+'" value="'+esc(value.away??'')+'" aria-label="Gols de '+esc(pair[1])+'"></label></div></div>'; }).join('')+'<p id="draftCount" class="muted" role="status">'+Object.keys(draft).length+' jogos em edição</p><div class="admin-actions"><button class="primary" type="submit" '+(busy?'disabled':'')+'>'+(cloudEnabled()?'Salvar no servidor':'Salvar neste navegador')+'</button><button type="button" data-discard>Descartar edição</button><button type="button" data-draft-export>Exportar rascunho</button></div></form>'+(!cloudEnabled()&&t.resultHistory?.length?'<div class="admin-actions"><button data-undo>Desfazer último salvamento</button></div>':'')+'</div>':'<p class="empty">Não há jogos cadastrados para editar.</p>')+(!cloudEnabled()?'<div class="admin-section"><h3>Cadastro de clubes</h3><p class="muted">A solicitação fica pendente. Competições com calendário definido não recebem novos participantes automaticamente.</p><form data-team-form class="form-grid"><label>Nome do clube<input name="team" maxlength="80" minlength="2" required autocomplete="off"></label><button type="submit">Solicitar cadastro</button></form>'+pendingPanel(t,true)+'</div><div class="admin-section"><h3>Escudos locais</h3><p class="muted">PNG, JPEG ou WebP, até 2 MB. O escudo será reduzido para 160 pixels.</p><form data-badge-form><label>Clube<select name="club">'+[...t.participants,...(t.pendingTeams||[])].map(n => '<option>'+esc(n)+'</option>').join('')+'</select></label><label>Arquivo do escudo<input name="badge" type="file" accept="image/png,image/jpeg,image/webp" required></label><div class="admin-actions"><button type="submit">Salvar escudo</button></div></form></div>':'<p class="muted">Cadastro e escudos permanecem locais até uma migração específica aprovada.</p>');
  }
  function renderDetail(focus=false) {
    const t=current(); if (!t) return;
    const titles={matches:'Jogos e rodadas',table:'Classificação',clubs:'Clubes participantes',admin:'Gerenciar campeonato'};
    $('detail').innerHTML='<button class="back" data-close>← Campeonatos</button><div class="detail-head"><div><p class="eyebrow">'+esc(t.edition||'Temporada atual')+'</p><h1 id="detailTitle" tabindex="-1">'+esc(t.name)+'</h1><p>'+esc(t.description||'')+'</p></div><span class="status-pill">'+esc(t.status)+'</span></div><div class="stats"><span><b>'+t.participants.length+'</b> clubes</span><span><b>'+(t.matches||[]).length+'</b> rodadas</span><span><b>'+Object.values(t.results).filter(C.validScore).length+'/'+C.matchKeys(t).length+'</b> jogos com placar</span></div><nav class="detail-tools" aria-label="Seções do campeonato">'+[['matches','Jogos'],['table','Classificação'],['clubs','Clubes'],['admin','Gerenciar']].map(([key,name])=>'<button data-view="'+key+'"'+(view===key?' aria-current="page"':'')+'>'+name+'</button>').join('')+'</nav><div class="panel"><h2 id="panelTitle" tabindex="-1">'+titles[view]+'</h2>'+({matches:matchesPanel,table:tablePanel,clubs:clubsPanel,admin:adminPanel}[view])(t)+'</div>';
    if(focus) $('panelTitle').focus({preventScroll:true});
  }
  function discardCheck() { if (!dirty()) return true; if (!confirm('Há placares não salvos. Descartar a edição?')) return false; draft={};draftRevision=null;return true; }
  async function commitTournament(next) {
    if (cloudEnabled()) throw new Error('Esta operação local fica bloqueada no modo oficial.');
    if (dirty()) throw new Error('Salve ou descarte os placares em edição antes desta operação.');
    const nextState=tournaments.map(t=>t.id===next.id?next:t);
    tournaments=await repo.save(nextState); renderHome();renderDetail();
  }
  function updateDataStatus() {
    $('dataStatus').textContent=cloudEnabled()?(cloud?.message||'Conectando aos resultados oficiais…'):'Dados deste navegador • sincronização oficial desativada';
  }
  function route() {
    const hash=location.hash||'#inicio';
    if(hash!==lastHash && !discardCheck()){history.replaceState(null,'',lastHash||'#inicio');return;}
    lastHash=hash;
    const parts=hash.slice(1).split('/');
    currentId=tournaments.some(t=>t.id===parts[0])?parts[0]:null;
    $('home').hidden=!!currentId||parts[0]==='backups';$('detail').hidden=!currentId;$('backups').hidden=parts[0]!=='backups';
    document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===(parts[0]==='backups'?'backups':'inicio'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(currentId){view=['matches','table','clubs','admin'].includes(parts[1])?parts[1]:'matches';roundChoice=String(firstPending(current()));teamFilter='';statusFilter='all';visibleRounds=2;renderDetail();$('detailTitle').focus({preventScroll:true});startSync().catch(reportError);}
    else {sync?.stop();sync=null;cloud=null;cloudTournamentId=null;if(parts[0]==='backups'){renderRecovery();$('backupTitle').focus({preventScroll:true});}else renderHome();}
    document.title=currentId?current().name+' | Arena BDA':'Arena BDA | Campeonatos';updateDataStatus();
  }
  async function startSync() {
    if (!cloudEnabled() || !currentId || cloudTournamentId===currentId) return;
    sync?.stop(); cloud=null;const id=currentId;cloudTournamentId=id;
    const config=window.ArenaPortalConfig;
    if(!config.firebase?.projectId||config.firebase.projectId!==config.expectedProjectId)throw new Error('Configuração Firebase não verificada. Sincronização bloqueada.');
    if(!sdkPromise) sdkPromise=(async()=>{
      for(const name of ['app','auth','firestore']) await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://www.gstatic.com/firebasejs/13.0.0/firebase-'+name+'-compat.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o Firebase.'));document.head.appendChild(s);});
      return window.firebase.apps.find(a=>a.name==='arena-portal-v2')||window.firebase.initializeApp(config.firebase,'arena-portal-v2');
    })();
    const app=await sdkPromise;if(id!==currentId)return;
    sync=window.ArenaPortalSync.createSync({transport:window.ArenaPortalSync.firebaseTransport(window.firebase,app),tournament:tournaments.find(t=>t.id===id),onState:state=>{
      if(id!==currentId)return;const wasWritable=cloud?.canWrite,previousRevision=cloud?.revision;cloud=state;updateDataStatus();
      if(dirty()){if(!busy&&draftRevision!==null&&state.revision!==draftRevision)notify('Os resultados oficiais mudaram. Seu rascunho foi preservado; exporte e recarregue antes de salvar.');return;}
      if(view!=='admin'||wasWritable!==state.canWrite||previousRevision!==state.revision)renderDetail();
    }});sync.start();
  }
  function renderRecovery() {
    try{$('recoveryList').innerHTML=repo.recovery().map((item,i)=>'<div class="pending-item"><span>'+esc(new Date(item.at).toLocaleString('pt-BR'))+'</span><button data-recovery="'+i+'">Baixar cópia '+(i+1)+'</button></div>').join('')||'<p class="muted">Ainda não há cópias anteriores neste navegador.</p>';}catch(error){reportError(error);}
  }
  async function resizeBadge(file) {
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw new Error('Envie PNG, JPEG ou WebP de até 2 MB.');
    let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('Imagem inválida ou danificada. Escolha outro escudo.');}
    try{if(bitmap.width>8000||bitmap.height>8000)throw new Error('Dimensões excessivas para um escudo.');const scale=Math.min(1,160/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/webp',.8);if(!C.validBadge(data))throw new Error('Escudo não pôde ser compactado.');return data;}finally{bitmap.close();}
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b||busy)return;
    try{
      if(b.hasAttribute('data-open'))location.hash=b.dataset.open+'/matches';
      if(b.hasAttribute('data-close'))location.hash='inicio';
      if(b.hasAttribute('data-view')){if(!discardCheck())return;view=b.dataset.view;if(view==='admin'&&roundChoice==='all')roundChoice='0';history.replaceState(null,'','#'+currentId+'/'+view);lastHash=location.hash;renderDetail(true);}
      if(b.hasAttribute('data-filter')){catalogFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderHome();}
      if(b.hasAttribute('data-round-step')){roundChoice=String(Number(roundChoice)+Number(b.dataset.roundStep));renderDetail();}
      if(b.hasAttribute('data-more')){visibleRounds+=2;renderDetail();}
      if(b.hasAttribute('data-discard')){if(!discardCheck())return;renderDetail();}
      if(b.hasAttribute('data-draft-export'))download({source:'arena-bda-draft',championship:currentId,calendar:C.calendar(current()),revision:draftRevision,changes:draft},'arena-bda-rascunho.json');
      if(b.hasAttribute('data-undo')){if(dirty())throw new Error('Salve ou descarte o rascunho primeiro.');const t=current(),previous=t.resultHistory?.at(-1);if(previous&&confirm('Restaurar os placares anteriores ao último salvamento local?')){await commitTournament({...t,results:previous.results,resultHistory:t.resultHistory.slice(0,-1),lastResultUpdate:Date.now()});notify('Último salvamento desfeito neste navegador.');}}
      if(b.hasAttribute('data-approve')){if(confirm('Confirmar este clube na competição sem calendário?'))await commitTournament(C.approveTeam(current(),current().pendingTeams[Number(b.dataset.approve)]));}
      if(b.hasAttribute('data-export'))download(C.exportBackup(backupState()),'arena-bda-backup-'+new Date().toISOString().slice(0,10)+'.json');
      if(b.hasAttribute('data-raw')){const raw={};for(const key of [C.KEY,C.RECOVERY_KEY,'bda-v3-tournaments','bda-v3-confrontos','bda-v2-teams','bda-v2-champions','bda-champion-ranking'])raw[key]=storage.getItem(key);download({source:'arena-bda-raw',exportedAt:new Date().toISOString(),raw},'arena-bda-armazenamento-bruto.json');}
      if(b.hasAttribute('data-recovery')){const item=repo.recovery()[Number(b.dataset.recovery)];download({schemaVersion:2,source:'arena-bda-local',tournaments:JSON.parse(item.raw)},'arena-bda-recuperacao-'+item.at+'.json');}
      if(b.hasAttribute('data-restore')){if(cloudEnabled())throw new Error('Restauração local bloqueada no modo oficial.');if(dirty())throw new Error('Há placares em edição.');if(!preview)throw new Error('Selecione um backup.');if(confirm('Substituir os placares e cadastros locais pelo backup revisado? Uma cópia do estado atual será guardada.')){tournaments=await repo.save(preview);preview=null;$('backupPreview').textContent='Backup restaurado. Calendários preservados.';renderHome();renderRecovery();}}
      if(b.hasAttribute('data-audit')){$('auditReport').innerHTML='<h2>Auditoria de integridade</h2>'+tournaments.map(t=>{const warnings=C.audit(t);return '<div class="audit-item"><strong>'+esc(t.name)+'</strong><p>'+t.participants.length+' clubes · '+(t.matches||[]).length+' rodadas · '+C.matchKeys(t).length+' jogos · '+Object.keys(t.results).length+' placares</p><p>'+esc(warnings.length?warnings.join('; '):(t.matches||[]).length?'Estrutura consistente.':'Sem calendário cadastrado nesta base. Não é possível validar confrontos.')+'</p></div>';}).join('')+'<p class="muted">Esta verificação não confirma resultados oficiais nem consulta outros aparelhos.</p>';}
      if(b.hasAttribute('data-logout')){if(discardCheck())await sync?.signOut();}
    }catch(error){reportError(error);}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='competitionSearch'){catalogSearch=event.target.value;renderHome();}
    if(event.target.hasAttribute('data-score')){
      const key=event.target.dataset.key,row=event.target.closest('[data-match]'),value={home:row.querySelector('[data-score=home]').value,away:row.querySelector('[data-score=away]').value},old=current().results?.[key]||{};
      if(value.home===String(old.home??'')&&value.away===String(old.away??''))delete draft[key];else draft[key]=value;
      if(draftRevision===null)draftRevision=cloud?.revision??null;
      $('draftCount').textContent=Object.keys(draft).length+' jogos em edição';
    }
  });
  document.addEventListener('change',async event=>{
    try{
      if(event.target.id==='roundChoice'){const next=event.target.value;if(dirty()&&!discardCheck()){event.target.value=roundChoice;return;}roundChoice=next;visibleRounds=2;renderDetail();}
      if(event.target.id==='teamFilter'){teamFilter=event.target.value;visibleRounds=2;renderDetail();}
      if(event.target.id==='statusFilter'){statusFilter=event.target.value;visibleRounds=2;renderDetail();}
      if(event.target.id==='backupInput'){
        preview=null;$('backupPreview').textContent='';const file=event.target.files?.[0];if(!file)return;
        if(file.size>10*1024*1024)throw new Error('Backup excede o limite de 10 MB.');
        preview=C.restoreBackup(tournaments,JSON.parse(await file.text()));
        $('backupPreview').innerHTML='<h2>Revisar restauração</h2><p>'+preview.length+' competições · '+preview.reduce((n,t)=>n+Object.keys(t.results).length,0)+' placares. Calendários compatíveis e preservados.</p><p class="muted">A confirmação substitui placares, histórico, solicitações e escudos presentes no arquivo.</p><button class="primary" data-restore>Confirmar restauração</button>';
        event.target.value='';
      }
    }catch(error){reportError(error);}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!form.matches('[data-results-form],[data-team-form],[data-badge-form],[data-login]'))return;event.preventDefault();if(busy)return;
    try{
      if(form.matches('[data-login]')){if(!sync)throw new Error('Conexão Firebase indisponível.');const values=new FormData(form);await sync.signIn(String(values.get('email')),String(values.get('password')));form.reset();return;}
      if(!editable())throw new Error('Gravação bloqueada. Verifique os dados e as permissões.');
      if(form.matches('[data-results-form]')){
        if(!dirty())throw new Error('Nenhuma alteração detectada.');
        const patch=Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,value.home===''&&value.away===''?null:value]));
        const next=C.patchResults(current(),patch);if(!next)return;
        if(!confirm(cloudEnabled()?'Publicar estes placares no servidor?':'Salvar os placares neste navegador?'))return;
        busy=true;
        if(cloudEnabled()){download(C.exportBackup(backupState()),'arena-bda-antes-publicacao.json');await sync.save(patch,draftRevision);}
        else tournaments=await repo.save(tournaments.map(t=>t.id===next.id?next:t));
        draft={};draftRevision=null;renderDetail();renderHome();notify(cloudEnabled()?'Resultados confirmados pelo servidor.':'Resultados salvos neste navegador. Classificação recalculada.');
      }
      if(form.matches('[data-team-form]')){await commitTournament(C.addTeam(current(),new FormData(form).get('team')));notify('Solicitação de clube salva neste navegador.');}
      if(form.matches('[data-badge-form]')){if(dirty())throw new Error('Salve ou descarte os placares em edição.');const values=new FormData(form),id=currentId,name=String(values.get('club')),data=await resizeBadge(values.get('badge'));if(id!==currentId)throw new Error('Campeonato mudou durante o envio. Tente novamente.');const next=C.clone(current());next.teamProfiles={...(next.teamProfiles||{}),[name]:{badge:data}};await commitTournament(next);notify('Escudo salvo neste navegador.');}
    }catch(error){reportError(error);}finally{busy=false;document.querySelector('[data-results-form] button[type=submit]')?.removeAttribute('disabled');}
  });
  window.addEventListener('hashchange',route);
  window.addEventListener('beforeunload',event=>{if(dirty()||busy){event.preventDefault();event.returnValue='';}});
  window.addEventListener('storage',event=>{
    if(event.key!==C.KEY)return;
    if(dirty()||busy){notify('Dados alterados em outra aba. Seu rascunho foi preservado. Exporte e recarregue antes de salvar.');return;}
    try{tournaments=repo.accept(event.newValue);renderHome();if(currentId)renderDetail();}catch(error){reportError(error);}
  });
  window.addEventListener('offline',()=>notify('Sem internet. Alterações locais continuam disponíveis; publicações oficiais exigem conexão.'));
  if(repo.errors.length)notify('Dados locais preservados, mas gravação bloqueada: '+repo.errors.join(' · ')+'. Exporte o armazenamento bruto em Backups.');
  if ('serviceWorker' in navigator && ['http:','https:'].includes(location.protocol)) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>notify('Modo offline indisponível. O portal continua funcionando online.')));
  }
  renderHome();route();
})();
