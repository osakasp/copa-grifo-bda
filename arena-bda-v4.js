(() => {
  'use strict';

  const KEY = 'bda-v3-tournaments';
  const seeds = [
    {id:'copa-grifo',name:'Copa Grifo BDA',edition:'8ª edição',format:'Mata-mata',status:'Finalizado',phase:'Campeão definido',maxTeams:19,badge:'🦅',participants:['Zombie FC BDA','JOGOBUGADO BDA','Inter Brasil BDA','Vasco da Gama BDA'],description:'Competição tradicional do Clã BDA em formato eliminatório e jogo único.',legacy:true,locked:true},
    {id:'copa-francos',name:'Copa Francos',edition:'Próxima edição',format:'Mata-mata',status:'Planejado',phase:'Preparação',maxTeams:16,badge:'🕊️',participants:[],description:'Competição especial em homenagem à história do Francos FC BDA.'},
    {id:'supercopa',name:'SuperCopa BDA',edition:'Temporada atual',format:'Mata-mata',status:'Em andamento',phase:'Semifinais',maxTeams:4,badge:'⚡',participants:['São Paulo BDA','Flamestre BDA','CR Flamengo BDA','CV Cruz BDA'],description:'Confronto entre grandes campeões das ligas e copas do Clã BDA.'},
    {id:'liga-a',name:'Liga A BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Inter Brasil BDA',maxTeams:20,badge:'🥇',participants:['Inter Brasil BDA'],description:'A divisão de elite do Clã BDA.'},
    {id:'liga-b',name:'Liga B BDA',edition:'Temporada encerrada',format:'Pontos corridos',status:'Finalizado',phase:'Campeão: Vasco da Gama BDA',maxTeams:20,badge:'🛡️',participants:['Vasco da Gama BDA'],description:'A divisão de acesso para a Liga A BDA.'},
    {id:'copa-aguia',name:'Copa Águia BDA',edition:'Projeto futuro',format:'Mata-mata',status:'Planejado',phase:'Aguardando lançamento',maxTeams:16,badge:'🦅',participants:[],description:'Nova competição preparada para futuras temporadas do Clã BDA.'}
  ];

  const page = document.querySelector('[data-page="tournament"]');
  if (!page) return;

  const oldBracket = page.innerHTML;
  let tournaments = load();
  let selectedId = tournaments[0]?.id || '';
  let editingId = null;
  let pendingBanner = '';
  let pendingBannerPath = '';
  let filter = 'Todos';

  const style = document.createElement('style');
  style.id = 'arenaTournamentV4Styles';
  style.textContent = `
    .arena-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
    .arena-card{overflow:hidden;padding:0;min-height:218px;text-align:left}
    .arena-cover{position:relative;height:116px;overflow:hidden;background:radial-gradient(circle at 75% 18%,rgba(242,215,125,.38),transparent 25%),linear-gradient(145deg,#183a26,#08110c)}
    .arena-cover img{width:100%;height:100%;display:block;object-fit:cover}
    .arena-cover:after{content:"";position:absolute;inset:auto 0 0;height:60%;background:linear-gradient(transparent,rgba(5,10,8,.9))}
    .arena-symbol{position:absolute;right:11px;top:8px;z-index:2;font-size:48px;filter:drop-shadow(0 8px 14px #0008)}
    .arena-status{position:absolute;left:9px;top:9px;z-index:2;padding:6px 8px;border:1px solid #ffffff2b;border-radius:999px;color:#fff;background:#050a08b8;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
    .arena-body{padding:13px}.arena-body h3{margin:5px 0 0;font-size:22px;line-height:.95;text-transform:uppercase}
    .arena-edition{color:var(--gold-soft);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.11em}
    .arena-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:11px}.arena-meta span{padding:7px;border:1px solid var(--line);border-radius:10px;color:var(--muted);font-size:9px}
    .arena-open{width:100%;min-height:37px;margin-top:9px}
    .arena-toolbar{display:flex;gap:7px;overflow-x:auto;margin:0 0 13px;padding-bottom:5px;scrollbar-width:none}.arena-toolbar::-webkit-scrollbar{display:none}
    .arena-filter{min-height:35px;padding:0 12px;white-space:nowrap;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:#ffffff08;font-size:9px;font-weight:800;text-transform:uppercase}
    .arena-filter.active{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold))}
    .arena-detail{margin-top:18px}.arena-hero{position:relative;overflow:hidden;min-height:245px;display:grid;align-content:end;padding:20px;border:1px solid var(--line-strong);border-radius:25px;background:radial-gradient(circle at 82% 18%,rgba(242,215,125,.36),transparent 24%),linear-gradient(145deg,#173b26,#08110c);box-shadow:var(--shadow)}
    .arena-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.arena-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0000,#030806ee)}
    .arena-hero-copy{position:relative;z-index:2}.arena-hero-copy h2{margin:7px 0 6px;font-size:clamp(34px,8vw,58px);line-height:.88;text-transform:uppercase}.arena-hero-copy p{margin:0;color:#d8e1db;font-size:12px;line-height:1.55}
    .arena-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.arena-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:10px}.arena-stat{padding:13px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.arena-stat b{display:block;color:var(--gold-soft);font:800 18px "Barlow Condensed",sans-serif;text-transform:uppercase}.arena-stat span{color:var(--muted);font-size:8px;text-transform:uppercase}
    .arena-clubs{display:flex;flex-wrap:wrap;gap:7px}.arena-club{padding:8px 10px;border:1px solid var(--line);border-radius:999px;color:#dce6df;background:#ffffff08;font-size:10px}
    .arena-placeholder{margin-top:12px;padding:23px 15px;border:1px dashed var(--line-strong);border-radius:18px;color:var(--muted);text-align:center;font-size:11px;line-height:1.55}.arena-legacy{margin-top:17px;border-top:1px solid var(--line)}
    .arena-home-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(210px,72%);gap:10px;overflow-x:auto;padding:2px 2px 8px}.arena-home-card{position:relative;overflow:hidden;min-height:140px;padding:14px;display:grid;align-content:end}.arena-home-card:before{content:attr(data-icon);position:absolute;right:8px;top:3px;font-size:62px;opacity:.18}.arena-home-card h3{position:relative;margin:5px 0;font-size:23px;text-transform:uppercase}.arena-home-card p,.arena-home-card button,.arena-home-card .eyebrow{position:relative}.arena-home-card p{margin:0;color:var(--muted);font-size:10px}.arena-home-card button{justify-self:start;min-height:34px;margin-top:9px;padding:0 11px;font-size:10px}
    .arena-team-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:185px;overflow:auto;padding:8px;border:1px solid var(--line);border-radius:13px;background:#03080670}.arena-team-option{display:flex;align-items:center;gap:7px;padding:8px;border:1px solid var(--line);border-radius:9px;color:#dce6df;background:#ffffff08;font-size:9px;text-transform:none;letter-spacing:0}.arena-team-option input{width:auto;margin:0}
    .arena-banner-preview{margin-top:8px;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#07100c}.arena-banner-preview div{aspect-ratio:16/9;display:grid;place-items:center;color:var(--muted);font-size:10px}.arena-banner-preview img{width:100%;height:100%;object-fit:cover}.arena-banner-preview span{display:block;padding:8px 10px;color:var(--muted);font-size:9px;text-transform:none;letter-spacing:0}
    @media(min-width:760px){.arena-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.arena-stats{grid-template-columns:repeat(4,1fr)}.arena-home-scroll{grid-auto-columns:minmax(235px,31%)}.arena-team-options{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `;
  document.head.append(style);

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(value) && value.length ? value : copy(seeds);
    } catch {
      return copy(seeds);
    }
  }
  function persist(previous) {
    try {
      localStorage.setItem(KEY, JSON.stringify(tournaments));
      return true;
    } catch {
      if (previous) tournaments = previous;
      toast('Não foi possível salvar os campeonatos');
      return false;
    }
  }
  function safe(value) { return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
  function slug(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `campeonato-${Date.now()}`;
  }
  function fileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(file);
    });
  }
  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = src;
    });
  }
  async function localBanner(file) {
    if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > 8 * 1024 * 1024) throw new Error('O banner deve ter no máximo 8 MB');
    const src = await fileData(file);
    const image = await imageFrom(src);
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao processar a imagem');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { url: canvas.toDataURL('image/webp', 0.76), path: '' };
  }
  async function prepareBanner(file) {
    const targetId = editingId || `novo-${Date.now().toString(36)}`;
    if (navigator.onLine && window.ArenaBDAMedia?.ready?.() && window.ArenaBDAAuth?.isAdmin?.()) {
      try {
        return await window.ArenaBDAMedia.uploadTournamentBanner(file, targetId);
      } catch (error) {
        console.warn('Firebase Storage indisponível; usando banner local comprimido', error);
        toast('A nuvem de imagens falhou. O banner será salvo apenas neste aparelho.');
      }
    }
    return localBanner(file);
  }

  function list() {
    if (filter === 'Todos') return tournaments;
    if (filter === 'Abertos') return tournaments.filter(item => ['Inscrições abertas', 'Em andamento'].includes(item.status));
    return tournaments.filter(item => item.status === filter);
  }
  function card(item) {
    return `<article class="card arena-card"><div class="arena-cover">${item.banner ? `<img src="${safe(item.banner)}" alt="Banner de ${escapeHtml(item.name)}" loading="lazy" decoding="async">` : ''}<span class="arena-status">${escapeHtml(item.status)}</span><span class="arena-symbol">${escapeHtml(item.badge || '🏆')}</span></div><div class="arena-body"><span class="arena-edition">${escapeHtml(item.edition || 'Nova edição')}</span><h3>${escapeHtml(item.name)}</h3><div class="arena-meta"><span>${escapeHtml(item.format || 'A definir')}</span><span>${Number(item.maxTeams) || 0} times</span></div><button class="ghost arena-open" type="button" data-open-tournament="${escapeHtml(item.id)}">Abrir campeonato</button></div></article>`;
  }
  function renderCards() {
    const grid = document.getElementById('arenaGrid');
    if (!grid) return;
    const items = list();
    grid.innerHTML = items.length ? items.map(card).join('') : '<div class="empty" style="grid-column:1/-1">Nenhum campeonato neste filtro.</div>';
  }
  function renderFilters() {
    document.querySelectorAll('[data-arena-filter]').forEach(button => button.classList.toggle('active', button.dataset.arenaFilter === filter));
  }
  function renderDetail() {
    const root = document.getElementById('arenaDetail');
    if (!root) return;
    const item = tournaments.find(entry => entry.id === selectedId) || tournaments[0];
    if (!item) {
      root.innerHTML = '<div class="empty">Crie o primeiro campeonato.</div>';
      return;
    }
    selectedId = item.id;
    const clubs = Array.isArray(item.participants) ? item.participants : [];
    root.innerHTML = `<div class="arena-hero">${item.banner ? `<img src="${safe(item.banner)}" alt="Banner de ${escapeHtml(item.name)}" decoding="async">` : ''}<div class="arena-hero-copy"><span class="eyebrow">${escapeHtml(item.status)} • ${escapeHtml(item.edition || 'Nova edição')}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description || 'Campeonato oficial do Clã BDA.')}</p>${isAdmin ? `<div class="arena-actions"><button class="secondary" type="button" data-edit-tournament="${escapeHtml(item.id)}">Editar campeonato</button>${item.locked ? '' : `<button class="danger" type="button" data-delete-tournament="${escapeHtml(item.id)}">Excluir campeonato</button>`}</div>` : ''}</div></div><div class="arena-stats"><div class="arena-stat"><b>${escapeHtml(item.format || 'A definir')}</b><span>Formato</span></div><div class="arena-stat"><b>${Number(item.maxTeams) || 0}</b><span>Limite</span></div><div class="arena-stat"><b>${clubs.length}</b><span>Participantes</span></div><div class="arena-stat"><b>${escapeHtml(item.phase || 'Preparação')}</b><span>Fase atual</span></div></div><div class="section-head"><div><h2>Clubes participantes</h2><p>Times selecionados para a competição</p></div></div>${clubs.length ? `<div class="arena-clubs">${clubs.map(name => `<span class="arena-club">${escapeHtml(name)}</span>`).join('')}</div>` : '<div class="arena-placeholder">Nenhum clube selecionado. Edite o campeonato para escolher os participantes.</div>'}${item.legacy ? `<div class="arena-legacy">${oldBracket}</div>` : '<div class="arena-placeholder">Área preparada para chaveamento, tabela e resultados desta competição.</div>'}`;
    window.dispatchEvent(new CustomEvent('arena:tournament-selected', { detail: { id: item.id, name: item.name, edition: item.edition } }));
  }
  function renderAll() { renderFilters(); renderCards(); renderDetail(); renderHome(); updateStats(); }

  function buildPage() {
    page.innerHTML = `<div class="section-head"><div><span class="eyebrow">Central de competições</span><h2>Campeonatos do Clã BDA</h2><p>Crie, organize e acompanhe todas as copas e ligas.</p></div><button class="primary" id="createTournamentBtn" type="button" hidden>Criar</button></div><div class="arena-toolbar"><button class="arena-filter active" type="button" data-arena-filter="Todos">Todos</button><button class="arena-filter" type="button" data-arena-filter="Abertos">Abertos</button><button class="arena-filter" type="button" data-arena-filter="Planejado">Planejados</button><button class="arena-filter" type="button" data-arena-filter="Finalizado">Finalizados</button></div><div class="arena-grid" id="arenaGrid"></div><div class="arena-detail" id="arenaDetail"></div>`;
  }
  function buildModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'tournamentModal';
    modal.innerHTML = `<div class="modal"><h2 id="tournamentModalTitle">Criar campeonato</h2><p>Monte uma copa ou liga para o Clã BDA.</p><form id="tournamentForm"><div class="form-grid two"><label>Nome<input id="tName" required maxlength="55" placeholder="Copa dos Campeões BDA"></label><label>Edição<input id="tEdition" maxlength="35" placeholder="1ª edição"></label><label>Formato<select id="tFormat"><option>Mata-mata</option><option>Pontos corridos</option><option>Grupos + mata-mata</option><option>Turno e returno</option></select></label><label>Limite de times<input id="tMax" type="number" min="2" max="64" value="16"></label><label>Status<select id="tStatus"><option>Planejado</option><option>Inscrições abertas</option><option>Em andamento</option><option>Finalizado</option></select></label><label>Fase atual<input id="tPhase" maxlength="45" placeholder="Inscrições"></label><label>Símbolo<input id="tBadge" maxlength="4" placeholder="🏆"></label><label>Prazo<input id="tDeadline" maxlength="45" placeholder="24h por fase"></label><label style="grid-column:1/-1">Descrição<textarea id="tDescription" maxlength="260"></textarea></label><label style="grid-column:1/-1">Banner<input id="tBanner" type="file" accept="image/png,image/jpeg,image/webp"><div class="arena-banner-preview" id="tBannerPreview"></div></label><div style="grid-column:1/-1"><label>Clubes participantes</label><div class="arena-team-options" id="tTeams"></div></div></div><div class="form-actions"><button type="button" class="secondary" data-close="tournamentModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form></div>`;
    document.body.append(modal);
  }
  function preview(current = '') {
    const root = document.getElementById('tBannerPreview');
    if (!root) return;
    const image = pendingBanner || current;
    root.innerHTML = image ? `<div><img src="${safe(image)}" alt="Prévia do banner"></div><span>O banner aparecerá no cartão e na página do campeonato.</span>` : '<div>Prévia do banner</div><span>Imagens horizontais em 16:9 ficam melhores.</span>';
  }
  function teamOptions(selected = []) {
    const root = document.getElementById('tTeams');
    if (!root) return;
    root.innerHTML = Array.isArray(teams) && teams.length ? teams.map((team, index) => `<label class="arena-team-option"><input type="checkbox" name="arenaTeams" value="${index}" ${selected.includes(team.name) ? 'checked' : ''}><span>${escapeHtml(team.name)}</span></label>`).join('') : '<span style="color:var(--muted);font-size:10px">Cadastre clubes na aba Times.</span>';
  }
  function openEditor(id = null) {
    if (!isAdmin) return;
    editingId = id;
    pendingBanner = '';
    pendingBannerPath = '';
    const form = document.getElementById('tournamentForm');
    form.reset();
    const item = tournaments.find(entry => entry.id === id);
    document.getElementById('tournamentModalTitle').textContent = item ? 'Editar campeonato' : 'Criar campeonato';
    if (item) {
      tName.value = item.name || '';
      tEdition.value = item.edition || '';
      tFormat.value = item.format || 'Mata-mata';
      tMax.value = Number(item.maxTeams) || 16;
      tStatus.value = item.status || 'Planejado';
      tPhase.value = item.phase || '';
      tBadge.value = item.badge || '';
      tDeadline.value = item.deadline || '';
      tDescription.value = item.description || '';
    }
    teamOptions(item?.participants || []);
    preview(item?.banner || '');
    openModal('tournamentModal');
    tName.focus();
  }
  function chosenTeams() {
    return Array.from(document.querySelectorAll('input[name="arenaTeams"]:checked')).map(input => teams[Number(input.value)]?.name).filter(Boolean);
  }
  function submitTournament(event) {
    event.preventDefault();
    if (!isAdmin) return;
    const name = tName.value.trim();
    if (!name) return;
    const before = copy(tournaments);
    const old = tournaments.find(item => item.id === editingId);
    const item = {
      ...(old || {}),
      id: old?.id || `${slug(name)}-${Date.now().toString(36)}`,
      name,
      edition: tEdition.value.trim() || 'Nova edição',
      format: tFormat.value,
      maxTeams: Number(tMax.value) || 16,
      status: tStatus.value,
      phase: tPhase.value.trim() || 'Preparação',
      badge: tBadge.value.trim() || '🏆',
      deadline: tDeadline.value.trim(),
      description: tDescription.value.trim() || 'Campeonato oficial do Clã BDA.',
      participants: chosenTeams(),
      updatedAt: Date.now()
    };
    if (pendingBanner) item.banner = pendingBanner;
    if (pendingBannerPath) item.bannerStoragePath = pendingBannerPath;
    if (old) tournaments[tournaments.findIndex(entry => entry.id === old.id)] = item;
    else tournaments.unshift(item);
    if (!persist(before)) return;
    selectedId = item.id;
    editingId = null;
    pendingBanner = '';
    pendingBannerPath = '';
    event.target.reset();
    closeModal('tournamentModal');
    renderAll();
    toast(old ? 'Campeonato atualizado' : 'Campeonato criado');
  }
  async function removeTournament(id) {
    if (!isAdmin) return;
    const item = tournaments.find(entry => entry.id === id);
    if (!item || item.locked || !confirm(`Excluir ${item.name}?`)) return;
    const before = copy(tournaments);
    tournaments = tournaments.filter(entry => entry.id !== id);
    selectedId = tournaments[0]?.id || '';
    if (!persist(before)) return;
    renderAll();
    toast('Campeonato excluído');
    if (item.bannerStoragePath) window.ArenaBDAMedia?.deletePath?.(item.bannerStoragePath).catch(error => console.warn('Não foi possível apagar o banner antigo', error));
  }

  function branding() {
    document.title = 'Arena BDA | Campeonatos do Clã';
    const name = document.querySelector('.brand-copy strong');
    const subtitle = document.querySelector('.brand-copy span');
    if (name) name.textContent = 'Arena BDA';
    if (subtitle) subtitle.textContent = 'Competições oficiais • Clã BDA';
    const hero = document.querySelector('[data-page="home"] .hero');
    if (hero) {
      hero.querySelector('.eyebrow').textContent = 'Portal oficial • Clã BDA';
      hero.querySelector('h1').textContent = 'Todos os campeonatos. Uma só arena.';
      hero.querySelector('p').textContent = 'Crie copas e ligas, registre clubes, acompanhe chaveamentos e preserve a história dos campeões do Clã BDA.';
      const buttons = hero.querySelectorAll('.hero-actions button');
      if (buttons[0]) buttons[0].textContent = 'Explorar campeonatos';
      if (buttons[1]) buttons[1].textContent = 'Ver clubes';
    }
    const stats = document.querySelector('[data-page="home"] .quick-stats');
    if (stats) stats.id = 'arenaStats';
    const nav = document.querySelector('.nav-btn[data-go="tournament"] span');
    if (nav) nav.textContent = 'Campeonatos';
    const championsTitle = document.querySelector('[data-page="champions"] h2');
    if (championsTitle) championsTitle.textContent = 'Sala de Troféus BDA';
    const teamsTitle = document.querySelector('[data-page="teams"] .section-head h2');
    if (teamsTitle) teamsTitle.textContent = 'Clubes BDA';
    const admin = document.getElementById('adminPanel');
    if (admin) {
      admin.querySelector('h3').textContent = 'Central administrativa Arena BDA';
      admin.querySelector('p').textContent = 'Gerencie campeonatos, clubes e a Sala de Troféus com sincronização em nuvem.';
      const tools = admin.querySelector('.admin-tools');
      if (tools && !document.getElementById('adminCreateTournamentBtn')) {
        const button = document.createElement('button');
        button.className = 'primary';
        button.id = 'adminCreateTournamentBtn';
        button.type = 'button';
        button.textContent = 'Criar campeonato';
        tools.prepend(button);
      }
    }
  }
  function updateStats() {
    const root = document.getElementById('arenaStats');
    if (!root) return;
    const active = tournaments.filter(item => item.status === 'Em andamento').length;
    const open = tournaments.filter(item => item.status === 'Inscrições abertas').length;
    root.innerHTML = `<div class="stat"><b>${tournaments.length}</b><span>Campeonatos</span></div><div class="stat"><b>${active}</b><span>Em andamento</span></div><div class="stat"><b>${open}</b><span>Inscrições</span></div><div class="stat"><b>${teams.length}</b><span>Clubes</span></div><div class="stat"><b>${champions.length}</b><span>Campeões</span></div><div class="stat"><b>BDA</b><span>Uma só arena</span></div>`;
  }
  function buildHome() {
    const home = document.querySelector('[data-page="home"]');
    const grid = home?.querySelector('.home-grid');
    if (!grid || document.getElementById('arenaHome')) return;
    const section = document.createElement('div');
    section.innerHTML = '<div class="section-head"><div><h2>Campeonatos em destaque</h2><p>As principais competições da Arena BDA</p></div><button data-go="tournament">Ver todos</button></div><div class="arena-home-scroll" id="arenaHome"></div>';
    grid.before(section);
  }
  function renderHome() {
    const root = document.getElementById('arenaHome');
    if (!root) return;
    root.innerHTML = tournaments.slice(0, 5).map(item => `<article class="card arena-home-card" data-icon="${escapeHtml(item.badge || '🏆')}"><span class="eyebrow">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.edition || item.phase)}</p><button class="ghost" type="button" data-home-tournament="${escapeHtml(item.id)}">Ver campeonato</button></article>`).join('');
  }
  function reloadFromStorage() {
    const current = selectedId;
    tournaments = load();
    selectedId = tournaments.some(item => item.id === current) ? current : tournaments[0]?.id || '';
    renderAll();
  }
  function select(id, options = {}) {
    if (!tournaments.some(item => item.id === id)) return false;
    selectedId = id;
    if (options.navigate !== false) navigate('tournament');
    renderAll();
    if (options.scroll !== false) document.getElementById('arenaDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  buildPage();
  buildModal();
  branding();
  buildHome();

  const oldRenderTeams = renderTeams;
  renderTeams = function renderTeamsWithStats() { oldRenderTeams(); updateStats(); };
  const oldRenderChampions = renderChampions;
  renderChampions = function renderChampionsWithStats() { oldRenderChampions(); updateStats(); };
  const oldAdminUI = updateAdminUI;
  updateAdminUI = function updateAdminUIWithTournament() {
    oldAdminUI();
    const create = document.getElementById('createTournamentBtn');
    if (create) create.hidden = !isAdmin;
    const adminCreate = document.getElementById('adminCreateTournamentBtn');
    if (adminCreate) adminCreate.hidden = !isAdmin;
    renderDetail();
  };

  document.getElementById('tBanner').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    const current = tournaments.find(item => item.id === editingId)?.banner || '';
    if (!file) {
      pendingBanner = '';
      pendingBannerPath = '';
      preview(current);
      return;
    }
    try {
      toast('Otimizando e enviando o banner...');
      const result = await prepareBanner(file);
      pendingBanner = result.url;
      pendingBannerPath = result.path || '';
      preview(current);
      toast(result.path ? 'Banner salvo na nuvem' : 'Banner salvo neste aparelho');
    } catch (error) {
      pendingBanner = '';
      pendingBannerPath = '';
      event.target.value = '';
      preview(current);
      toast(error.message || 'Falha ao carregar o banner');
    }
  });
  document.getElementById('tournamentForm').addEventListener('submit', submitTournament);
  document.getElementById('createTournamentBtn').addEventListener('click', () => openEditor());
  document.getElementById('adminCreateTournamentBtn')?.addEventListener('click', () => openEditor());
  document.addEventListener('click', event => {
    const filterButton = event.target.closest('[data-arena-filter]');
    if (filterButton) {
      filter = filterButton.dataset.arenaFilter;
      renderFilters();
      renderCards();
      return;
    }
    const open = event.target.closest('[data-open-tournament]');
    if (open) {
      select(open.dataset.openTournament);
      return;
    }
    const home = event.target.closest('[data-home-tournament]');
    if (home) {
      select(home.dataset.homeTournament);
      return;
    }
    const edit = event.target.closest('[data-edit-tournament]');
    if (edit) {
      openEditor(edit.dataset.editTournament);
      return;
    }
    const remove = event.target.closest('[data-delete-tournament]');
    if (remove) removeTournament(remove.dataset.deleteTournament);
  });
  document.getElementById('resetDemoBtn')?.addEventListener('click', () => {
    tournaments = copy(seeds);
    selectedId = tournaments[0].id;
    localStorage.removeItem(KEY);
    renderAll();
  });
  document.getElementById('tournamentModal').addEventListener('click', event => {
    if (event.target.id === 'tournamentModal') closeModal('tournamentModal');
  });
  window.addEventListener('arena:cloud-data-updated', event => {
    if (event.detail?.names?.includes('tournaments')) reloadFromStorage();
  });

  window.ArenaBDATournaments = Object.freeze({
    list: () => copy(tournaments),
    selected: () => selectedId,
    select,
    reload: reloadFromStorage,
    render: renderAll
  });

  renderAll();
  updateAdminUI();
})();
