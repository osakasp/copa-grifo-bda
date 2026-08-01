(() => {
  'use strict';

  const COLLECTION = 'teamEditRequests';
  const LOCAL_KEY = 'bda-team-edit-requests-local';
  const TEAM_KEY = 'bda-v2-teams';
  const CHAMPION_KEY = 'bda-v2-champions';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);
  const FIELD_LABELS = {
    name: 'Nome do time',
    code: 'Sigla',
    master: 'Mestre responsável',
    status: 'Status',
    joinedAt: 'Entrada no clã',
    city: 'Cidade',
    founded: 'Fundação',
    favoritePlayer: 'Jogador favorito',
    phrase: 'Frase oficial',
    description: 'História do clube'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let activeTeamName = '';
  let badgeSource = '';
  let coverSource = '';
  let removeBadge = false;
  let removeCover = false;
  let observerTimer = 0;
  let cloudUnsubscribe = null;
  let cloudRequests = [];
  let submitting = false;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function teamList() {
    if (typeof teams !== 'undefined' && Array.isArray(teams)) return teams;
    const value = read(TEAM_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function currentUser() {
    try {
      return window.firebase?.auth?.()?.currentUser || null;
    } catch {
      return null;
    }
  }

  function currentEmail() {
    return String(currentUser()?.email || '').toLowerCase();
  }

  function adminActive() {
    return (typeof isAdmin !== 'undefined' && Boolean(isAdmin)) || ADMIN_EMAILS.has(currentEmail());
  }

  function db() {
    try {
      return window.firebase?.firestore?.() || null;
    } catch {
      return null;
    }
  }

  function localRequests() {
    const value = read(LOCAL_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveLocalRequest(request) {
    const list = localRequests();
    list.unshift(request);
    write(LOCAL_KEY, list.slice(0, 100));
    window.dispatchEvent(new CustomEvent('arena:team-edit-request-updated'));
  }

  function removeLocalRequest(id) {
    write(LOCAL_KEY, localRequests().filter(item => item.id !== id));
    window.dispatchEvent(new CustomEvent('arena:team-edit-request-updated'));
  }

  function requestTeamName(button) {
    const explicit = button?.dataset?.teamEditRequestName?.trim();
    if (explicit) return explicit;
    const card = button?.closest?.('.team-card');
    const cardName = $('h3', card)?.textContent?.trim();
    if (cardName) return cardName;
    return $('#bdaStandaloneProfile .bda-sp-identity h1')?.textContent?.trim()
      || $('#clubProfileModal .club-profile-identity h1')?.textContent?.trim()
      || '';
  }

  function findTeam(name) {
    return teamList().find(team => norm(team?.name) === norm(name)) || null;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = source;
    });
  }

  async function makeBadge(source) {
    const image = await loadImage(source);
    const size = 480;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao preparar o escudo');
    context.clearRect(0, 0, size, size);
    const scale = Math.min((size - 34) / image.width, (size - 34) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL('image/webp', 0.82);
  }

  async function makeCover(source) {
    const image = await loadImage(source);
    const width = 1200;
    const height = 530;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao preparar a capa');
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    return canvas.toDataURL('image/webp', 0.74);
  }

  function ensureVisitorModal() {
    let modal = $('#visitorTeamEditModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'visitorTeamEditModal';
    modal.className = 'visitor-team-edit-modal';
    modal.innerHTML = `<section>
      <header>
        <div><span class="eyebrow">Solicitação pública</span><h2>Sugerir alteração do time</h2><p>As mudanças serão analisadas antes de aparecerem no perfil oficial.</p></div>
        <button type="button" data-visitor-team-close aria-label="Fechar">×</button>
      </header>
      <div class="visitor-team-approval-note"><span>🛡️</span><div><b>Sujeito à aprovação da administração</b><small>O cadastro atual continuará intacto até um administrador aprovar a solicitação.</small></div></div>
      <form id="visitorTeamEditForm">
        <div class="visitor-team-requester">
          <label>Seu nome<input id="visitorEditRequester" required maxlength="60" placeholder="Quem está enviando a solicitação"></label>
          <label>WhatsApp ou e-mail<input id="visitorEditContact" required maxlength="90" placeholder="Contato para confirmação"></label>
        </div>
        <div class="visitor-team-edit-grid">
          <label>Nome do time<input id="visitorEditName" required maxlength="55"></label>
          <label>Sigla<input id="visitorEditCode" required maxlength="4" style="text-transform:uppercase"></label>
          <label>Mestre responsável<input id="visitorEditMaster" required maxlength="55"></label>
          <label>Status<select id="visitorEditStatus"><option>Inscrito</option><option>Confirmado</option><option>Lista de espera</option><option>Inativo</option></select></label>
          <label>Entrada no clã<input id="visitorEditJoinedAt" type="date"></label>
          <label>Cidade<input id="visitorEditCity" maxlength="60" placeholder="Ex.: Praia Grande - SP"></label>
          <label>Fundação<input id="visitorEditFounded" maxlength="30" placeholder="Ex.: 2024"></label>
          <label>Jogador favorito<input id="visitorEditFavoritePlayer" maxlength="60"></label>
          <label class="wide">Frase oficial<input id="visitorEditPhrase" maxlength="140"></label>
          <label class="wide">História do clube<textarea id="visitorEditDescription" maxlength="1200"></textarea></label>
        </div>
        <div class="visitor-team-media-grid">
          <section><div><span>Escudo</span><b>Imagem principal</b></div><div class="visitor-team-badge-preview" id="visitorBadgePreview"></div><label>Novo escudo<input id="visitorEditBadgeFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="visitor-team-remove"><input id="visitorRemoveBadge" type="checkbox"><span>Solicitar remoção do escudo atual</span></label></section>
          <section><div><span>Capa</span><b>Fundo do perfil</b></div><div class="visitor-team-cover-preview" id="visitorCoverPreview"></div><label>Nova capa<input id="visitorEditCoverFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="visitor-team-remove"><input id="visitorRemoveCover" type="checkbox"><span>Solicitar remoção da capa atual</span></label></section>
        </div>
        <label class="visitor-team-confirm"><input id="visitorEditConfirm" type="checkbox" required><span>Confirmo que represento este time ou tenho autorização para solicitar estas alterações.</span></label>
        <footer><button class="secondary" type="button" data-visitor-team-close>Cancelar</button><button class="primary" type="submit">Enviar para aprovação</button></footer>
      </form>
    </section>`;
    document.body.append(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-visitor-team-close]')) closeVisitorModal();
    });
    $('#visitorTeamEditForm', modal)?.addEventListener('submit', submitRequest);
    $('#visitorEditBadgeFile', modal)?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        event.target.value = '';
        return notify('Use um escudo de até 8 MB');
      }
      badgeSource = await readFile(file);
      $('#visitorRemoveBadge', modal).checked = false;
      updateVisitorPreviews();
    });
    $('#visitorEditCoverFile', modal)?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        event.target.value = '';
        return notify('Use uma capa de até 8 MB');
      }
      coverSource = await readFile(file);
      $('#visitorRemoveCover', modal).checked = false;
      updateVisitorPreviews();
    });
    $('#visitorRemoveBadge', modal)?.addEventListener('change', event => {
      removeBadge = event.target.checked;
      if (removeBadge) {
        badgeSource = '';
        $('#visitorEditBadgeFile', modal).value = '';
      }
      updateVisitorPreviews();
    });
    $('#visitorRemoveCover', modal)?.addEventListener('change', event => {
      removeCover = event.target.checked;
      if (removeCover) {
        coverSource = '';
        $('#visitorEditCoverFile', modal).value = '';
      }
      updateVisitorPreviews();
    });
    return modal;
  }

  function updateVisitorPreviews() {
    const team = findTeam(activeTeamName) || {};
    const badge = removeBadge ? '' : badgeSource || team.badge || '';
    const cover = removeCover ? '' : coverSource || team.profileBanner || '';
    const badgeRoot = $('#visitorBadgePreview');
    const coverRoot = $('#visitorCoverPreview');
    if (badgeRoot) badgeRoot.innerHTML = badge
      ? `<img src="${esc(badge)}" alt="Prévia do escudo">`
      : `<span>${esc((team.code || 'BDA').toUpperCase())}</span>`;
    if (coverRoot) coverRoot.innerHTML = cover
      ? `<img src="${esc(cover)}" alt="Prévia da capa">`
      : '<span>CAPA DO CLUBE</span>';
  }

  function openVisitorEditor(name) {
    const team = findTeam(name);
    if (!team) return notify('Não foi possível localizar este time');
    activeTeamName = team.name;
    badgeSource = '';
    coverSource = '';
    removeBadge = false;
    removeCover = false;
    const modal = ensureVisitorModal();
    $('#visitorEditRequester', modal).value = localStorage.getItem('bda-requester-name') || '';
    $('#visitorEditContact', modal).value = localStorage.getItem('bda-requester-contact') || '';
    $('#visitorEditName', modal).value = team.name || '';
    $('#visitorEditCode', modal).value = team.code || '';
    $('#visitorEditMaster', modal).value = team.master || '';
    $('#visitorEditStatus', modal).value = team.status || 'Inscrito';
    $('#visitorEditJoinedAt', modal).value = team.joinedAt || '';
    $('#visitorEditCity', modal).value = team.city || '';
    $('#visitorEditFounded', modal).value = team.founded || '';
    $('#visitorEditFavoritePlayer', modal).value = team.favoritePlayer || '';
    $('#visitorEditPhrase', modal).value = team.phrase || '';
    $('#visitorEditDescription', modal).value = team.description || '';
    $('#visitorEditBadgeFile', modal).value = '';
    $('#visitorEditCoverFile', modal).value = '';
    $('#visitorRemoveBadge', modal).checked = false;
    $('#visitorRemoveCover', modal).checked = false;
    $('#visitorEditConfirm', modal).checked = false;
    updateVisitorPreviews();
    modal.classList.add('show');
    document.body.classList.add('visitor-team-edit-open');
    ($('#visitorEditRequester', modal).value ? $('#visitorEditName', modal) : $('#visitorEditRequester', modal))?.focus();
  }

  function closeVisitorModal() {
    $('#visitorTeamEditModal')?.classList.remove('show');
    document.body.classList.remove('visitor-team-edit-open');
    activeTeamName = '';
    badgeSource = '';
    coverSource = '';
    removeBadge = false;
    removeCover = false;
  }

  function formChanges(team) {
    const values = {
      name: $('#visitorEditName').value.trim(),
      code: $('#visitorEditCode').value.trim().toUpperCase().slice(0, 4),
      master: $('#visitorEditMaster').value.trim(),
      status: $('#visitorEditStatus').value,
      joinedAt: $('#visitorEditJoinedAt').value,
      city: $('#visitorEditCity').value.trim(),
      founded: $('#visitorEditFounded').value.trim(),
      favoritePlayer: $('#visitorEditFavoritePlayer').value.trim(),
      phrase: $('#visitorEditPhrase').value.trim(),
      description: $('#visitorEditDescription').value.trim()
    };
    const changes = {};
    Object.entries(values).forEach(([key, value]) => {
      const current = key === 'code' ? String(team?.[key] || '').toUpperCase() : String(team?.[key] || '');
      if (value !== current) changes[key] = value;
    });
    return changes;
  }

  async function storeRequest(payload) {
    const firestore = db();
    if (firestore) {
      try {
        const cloudPayload = {
          ...payload,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        const reference = await firestore.collection(COLLECTION).add(cloudPayload);
        return { id: reference.id, cloud: true };
      } catch (error) {
        console.warn('Solicitação não pôde ser enviada ao Firestore', error);
      }
    }

    const local = {
      ...payload,
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      localOnly: true
    };
    saveLocalRequest(local);
    return { id: local.id, cloud: false };
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (submitting) return;
    const team = findTeam(activeTeamName);
    if (!team) return notify('O time não foi encontrado');

    const requesterName = $('#visitorEditRequester').value.trim();
    const requesterContact = $('#visitorEditContact').value.trim();
    const changes = formChanges(team);
    if (!requesterName || !requesterContact) return notify('Informe seu nome e um contato');
    if (!changes.name && !($('#visitorEditName').value.trim())) return notify('Informe o nome do time');
    if (!$('#visitorEditCode').value.trim() || !$('#visitorEditMaster').value.trim()) return notify('Preencha sigla e mestre responsável');
    if (!Object.keys(changes).length && !badgeSource && !coverSource && !removeBadge && !removeCover) return notify('Nenhuma alteração foi informada');

    const submit = $('#visitorTeamEditForm button[type="submit"]');
    submitting = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Enviando...';
    }

    try {
      if (badgeSource) changes.badge = await makeBadge(badgeSource);
      if (coverSource) changes.profileBanner = await makeCover(coverSource);
      const payload = {
        schemaVersion: 1,
        status: 'pending',
        teamName: team.name,
        teamCode: team.code || '',
        original: Object.fromEntries(Object.keys(FIELD_LABELS).map(key => [key, team[key] || ''])),
        changes,
        removeBadge,
        removeCover,
        requesterName,
        requesterContact,
        requesterEmail: currentEmail(),
        createdAtClient: Date.now(),
        source: 'arena-bda-public'
      };
      const size = new Blob([JSON.stringify(payload)]).size;
      if (size > 850 * 1024) throw new Error('As imagens ficaram grandes demais. Use arquivos mais leves.');

      localStorage.setItem('bda-requester-name', requesterName);
      localStorage.setItem('bda-requester-contact', requesterContact);
      const result = await storeRequest(payload);
      closeVisitorModal();
      notify(result.cloud
        ? 'Solicitação enviada para aprovação da administração'
        : 'Solicitação salva neste aparelho para análise administrativa');
    } catch (error) {
      console.error(error);
      notify(error.message || 'Não foi possível enviar a solicitação');
    } finally {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Enviar para aprovação';
      }
    }
  }

  function decorateVisitorButtons() {
    const admin = adminActive();
    $$('#teamGrid .team-card').forEach(card => {
      const name = $('h3', card)?.textContent?.trim();
      if (!name) return;
      let button = $('[data-request-team-edit]', card);
      if (admin) {
        button?.remove();
        return;
      }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary visitor-team-edit-button';
        button.dataset.requestTeamEdit = 'true';
        const summary = $('.club-profile-card-summary', card);
        const actions = $('.team-admin-actions', card);
        if (summary) summary.append(button);
        else if (actions) actions.prepend(button);
        else card.append(button);
      }
      button.dataset.teamEditRequestName = name;
      button.innerHTML = '<span>✎</span><b>Solicitar edição</b><small>Sujeito à aprovação</small>';
    });

    $$('[data-bda-sp-edit]').forEach(button => {
      if (admin) {
        button.textContent = '✎ Editar perfil';
        button.removeAttribute('data-request-team-edit-profile');
      } else {
        button.textContent = '✎ Solicitar edição';
        button.dataset.requestTeamEditProfile = 'true';
      }
    });
  }

  function requestDate(request) {
    const value = request.createdAt?.toDate?.() || new Date(Number(request.createdAtClient || Date.now()));
    if (Number.isNaN(value.getTime())) return 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value);
  }

  function pendingRequests() {
    const local = localRequests().filter(item => item.status === 'pending');
    const cloud = cloudRequests.filter(item => item.status === 'pending');
    const ids = new Set(cloud.map(item => item.id));
    return [...cloud, ...local.filter(item => !ids.has(item.id))]
      .sort((a, b) => Number(b.createdAtClient || 0) - Number(a.createdAtClient || 0));
  }

  function changedFieldsHtml(request) {
    const entries = Object.entries(request.changes || {}).filter(([key]) => key in FIELD_LABELS);
    const rows = entries.map(([key, value]) => `<div><span>${esc(FIELD_LABELS[key])}</span><del>${esc(request.original?.[key] || 'Não informado')}</del><b>${esc(value || 'Não informado')}</b></div>`).join('');
    const media = [
      request.changes?.badge ? '<div><span>Escudo</span><del>Imagem atual</del><b>Novo escudo enviado</b></div>' : '',
      request.changes?.profileBanner ? '<div><span>Capa</span><del>Imagem atual</del><b>Nova capa enviada</b></div>' : '',
      request.removeBadge ? '<div><span>Escudo</span><del>Imagem atual</del><b>Solicitação de remoção</b></div>' : '',
      request.removeCover ? '<div><span>Capa</span><del>Imagem atual</del><b>Solicitação de remoção</b></div>' : ''
    ].join('');
    return rows || media ? `${rows}${media}` : '<p>Nenhuma diferença de texto identificada.</p>';
  }

  function ensureAdminQueueModal() {
    let modal = $('#teamEditRequestsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'teamEditRequestsModal';
    modal.className = 'team-edit-requests-modal';
    modal.innerHTML = `<section><header><div><span class="eyebrow">Moderação dos clubes</span><h2>Solicitações de edição</h2><p>Compare os dados antes de aprovar qualquer mudança.</p></div><button type="button" data-team-requests-close>×</button></header><main id="teamEditRequestsList"></main></section>`;
    document.body.append(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-team-requests-close]')) closeAdminQueue();
      const approve = event.target.closest('[data-approve-team-request]');
      const reject = event.target.closest('[data-reject-team-request]');
      if (approve) approveRequest(approve.dataset.approveTeamRequest);
      if (reject) rejectRequest(reject.dataset.rejectTeamRequest);
    });
    return modal;
  }

  function renderAdminQueue() {
    ensureAdminShortcut();
    const requests = pendingRequests();
    const count = $('#teamEditRequestCount');
    if (count) count.textContent = String(requests.length);
    const list = $('#teamEditRequestsList');
    if (!list) return;
    list.innerHTML = requests.length ? requests.map(request => `<article class="team-edit-request-card">
      <header><div><span>${esc(request.teamName || 'Time BDA')}</span><h3>${esc(request.requesterName || 'Visitante')}</h3><p>${esc(request.requesterContact || 'Contato não informado')} • ${esc(requestDate(request))}</p></div>${request.localOnly ? '<i>LOCAL</i>' : '<i>NUVEM</i>'}</header>
      <details><summary>Ver alterações solicitadas</summary><div class="team-request-diff">${changedFieldsHtml(request)}</div>${request.changes?.badge ? `<div class="team-request-image"><span>Novo escudo</span><img src="${esc(request.changes.badge)}" alt="Novo escudo solicitado"></div>` : ''}${request.changes?.profileBanner ? `<div class="team-request-image cover"><span>Nova capa</span><img src="${esc(request.changes.profileBanner)}" alt="Nova capa solicitada"></div>` : ''}</details>
      <footer><button class="danger" type="button" data-reject-team-request="${esc(request.id)}">Rejeitar</button><button class="primary" type="button" data-approve-team-request="${esc(request.id)}">Aprovar alterações</button></footer>
    </article>`).join('') : '<div class="team-requests-empty"><span>✅</span><b>Nenhuma solicitação pendente</b><p>Novos pedidos enviados pelos visitantes aparecerão aqui.</p></div>';
  }

  function ensureAdminShortcut() {
    const shortcuts = $('#cloudAdminModal .cloud-panel-shortcuts');
    let button = $('#panelTeamEditRequests');
    if (!button && shortcuts) {
      button = document.createElement('button');
      button.id = 'panelTeamEditRequests';
      button.type = 'button';
      button.innerHTML = '<i>📥</i><span>Solicitações de clubes <b id="teamEditRequestCount">0</b></span>';
      shortcuts.append(button);
      button.addEventListener('click', openAdminQueue);
    }
    if (button) button.hidden = !adminActive();
  }

  function openAdminQueue() {
    if (!adminActive()) return;
    $('#cloudAdminModal')?.classList.remove('show');
    const modal = ensureAdminQueueModal();
    renderAdminQueue();
    modal.classList.add('show');
    document.body.classList.add('team-edit-requests-open');
  }

  function closeAdminQueue() {
    $('#teamEditRequestsModal')?.classList.remove('show');
    document.body.classList.remove('team-edit-requests-open');
  }

  function requestById(id) {
    return pendingRequests().find(item => item.id === id) || null;
  }

  function renameReferences(oldName, newName) {
    if (norm(oldName) === norm(newName)) return;
    const champions = read(CHAMPION_KEY, []);
    if (Array.isArray(champions)) {
      champions.forEach(item => { if (norm(item?.name) === norm(oldName)) item.name = newName; });
      write(CHAMPION_KEY, champions);
      if (typeof window.champions !== 'undefined' && Array.isArray(window.champions)) window.champions.splice(0, window.champions.length, ...champions);
    }
    const tournaments = read(TOURNAMENT_KEY, []);
    if (Array.isArray(tournaments)) {
      tournaments.forEach(item => {
        if (Array.isArray(item?.participants)) item.participants = item.participants.map(name => norm(name) === norm(oldName) ? newName : name);
      });
      write(TOURNAMENT_KEY, tournaments);
    }
    const matches = read(MATCH_KEY, {});
    if (matches && typeof matches === 'object') {
      Object.values(matches).forEach(list => {
        if (!Array.isArray(list)) return;
        list.forEach(game => {
          if (norm(game?.ta) === norm(oldName)) game.ta = newName;
          if (norm(game?.tb) === norm(oldName)) game.tb = newName;
        });
      });
      write(MATCH_KEY, matches);
    }
  }

  async function setRequestStatus(request, status) {
    if (request.localOnly || String(request.id).startsWith('local-')) {
      removeLocalRequest(request.id);
      return;
    }
    const firestore = db();
    if (!firestore) throw new Error('Firestore indisponível');
    await firestore.collection(COLLECTION).doc(request.id).update({
      status,
      reviewedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      reviewedAtClient: Date.now(),
      reviewedBy: currentEmail() || 'admin-bda'
    });
  }

  async function approveRequest(id) {
    const request = requestById(id);
    if (!request || !adminActive()) return;
    if (!confirm(`Aprovar as alterações solicitadas para ${request.teamName}?`)) return;
    const list = teamList();
    const index = list.findIndex(team => norm(team?.name) === norm(request.teamName) || (request.teamCode && norm(team?.code) === norm(request.teamCode)));
    if (index < 0) return notify('O time original não foi encontrado');
    const current = list[index];
    const changes = request.changes || {};
    const updated = {
      ...current,
      ...Object.fromEntries(Object.keys(FIELD_LABELS).filter(key => key in changes).map(key => [key, changes[key]])),
      code: String(changes.code ?? current.code ?? '').toUpperCase().slice(0, 4),
      profileUpdatedAt: Date.now(),
      profileUpdatedBy: currentEmail() || 'admin-bda',
      profileApprovalRequestId: request.id
    };
    if (request.removeBadge) updated.badge = '';
    else if (changes.badge) updated.badge = changes.badge;
    if (request.removeCover) updated.profileBanner = '';
    else if (changes.profileBanner) updated.profileBanner = changes.profileBanner;

    const newName = updated.name || current.name;
    if (list.some((team, position) => position !== index && norm(team?.name) === norm(newName))) return notify('Já existe outro time com o nome solicitado');

    const next = list.map((team, position) => position === index ? updated : team);
    renameReferences(current.name, newName);
    write(TEAM_KEY, next);
    if (typeof teams !== 'undefined' && Array.isArray(teams)) teams.splice(0, teams.length, ...next);
    window.dispatchEvent(new CustomEvent('arena:team-profile-updated', { detail: { oldName: current.name, name: newName, approved: true } }));
    if (typeof renderTeams === 'function') renderTeams();
    window.ArenaBDAClubProfiles?.refresh?.();

    try {
      await setRequestStatus(request, 'approved');
      notify('Alterações aprovadas e publicadas');
    } catch (error) {
      console.error(error);
      notify('O time foi atualizado, mas não foi possível arquivar a solicitação');
    }
    renderAdminQueue();
  }

  async function rejectRequest(id) {
    const request = requestById(id);
    if (!request || !adminActive()) return;
    if (!confirm(`Rejeitar a solicitação de ${request.requesterName || 'visitante'}?`)) return;
    try {
      await setRequestStatus(request, 'rejected');
      notify('Solicitação rejeitada');
    } catch (error) {
      console.error(error);
      notify('Não foi possível rejeitar a solicitação');
    }
    renderAdminQueue();
  }

  function subscribeCloudRequests() {
    cloudUnsubscribe?.();
    cloudUnsubscribe = null;
    cloudRequests = [];
    if (!adminActive() || !db()) {
      renderAdminQueue();
      return;
    }
    cloudUnsubscribe = db().collection(COLLECTION).onSnapshot(snapshot => {
      cloudRequests = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      renderAdminQueue();
    }, error => {
      console.warn('Não foi possível ler solicitações na nuvem', error);
      cloudRequests = [];
      renderAdminQueue();
    });
  }

  function scheduleDecorate() {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      decorateVisitorButtons();
      ensureAdminShortcut();
    }, 70);
  }

  document.addEventListener('click', event => {
    const cardButton = event.target.closest('[data-request-team-edit]');
    const profileButton = event.target.closest('[data-request-team-edit-profile]');
    if (!cardButton && !profileButton) return;
    if (adminActive()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openVisitorEditor(requestTeamName(cardButton || profileButton));
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('#visitorTeamEditModal')?.classList.contains('show')) closeVisitorModal();
    else if ($('#teamEditRequestsModal')?.classList.contains('show')) closeAdminQueue();
  });

  const style = document.createElement('style');
  style.textContent = `
    .visitor-team-edit-button{display:grid!important;grid-template-columns:auto 1fr!important;align-items:center!important;column-gap:7px!important;width:100%!important;min-height:45px!important;margin-top:6px!important;text-align:left!important}.visitor-team-edit-button>span{grid-row:1/3;font-size:17px}.visitor-team-edit-button b,.visitor-team-edit-button small{display:block}.visitor-team-edit-button b{font-size:9px}.visitor-team-edit-button small{color:var(--muted);font-size:7px}
    .visitor-team-edit-open,.team-edit-requests-open{overflow:hidden!important}.visitor-team-edit-modal,.team-edit-requests-modal{display:none;position:fixed;inset:0;z-index:70000;place-items:center;overflow:auto;padding:12px;background:rgba(0,0,0,.91);backdrop-filter:blur(15px)}.visitor-team-edit-modal.show,.team-edit-requests-modal.show{display:grid}.visitor-team-edit-modal>section,.team-edit-requests-modal>section{width:min(1050px,100%);max-height:96vh;overflow:auto;border:1px solid rgba(245,220,134,.38);border-radius:27px;background:radial-gradient(circle at 100% 0,rgba(245,220,134,.12),transparent 28%),linear-gradient(150deg,#153421,#050c08);box-shadow:0 40px 120px #000d;text-align:left}.visitor-team-edit-modal>section>header,.team-edit-requests-modal>section>header{display:flex;align-items:start;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}.visitor-team-edit-modal h2,.team-edit-requests-modal h2{margin:5px 0 3px;font-size:32px;text-transform:uppercase}.visitor-team-edit-modal header p,.team-edit-requests-modal header p{margin:0;color:var(--muted);font-size:9px}.visitor-team-edit-modal header>button,.team-edit-requests-modal header>button{width:42px;height:42px;padding:0;border:1px solid var(--line);border-radius:13px;color:#fff;background:#ffffff08;font-size:24px}
    .visitor-team-approval-note{display:flex;align-items:center;gap:11px;margin:14px 17px 0;padding:12px;border:1px solid rgba(245,220,134,.28);border-radius:15px;background:rgba(245,220,134,.075)}.visitor-team-approval-note>span{font-size:23px}.visitor-team-approval-note b,.visitor-team-approval-note small{display:block}.visitor-team-approval-note b{color:var(--gold-soft);font-size:10px}.visitor-team-approval-note small{margin-top:4px;color:var(--muted);font-size:8px}.visitor-team-edit-modal form{padding:16px}.visitor-team-requester,.visitor-team-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.visitor-team-requester{margin-bottom:13px;padding:12px;border:1px solid rgba(79,223,143,.20);border-radius:16px;background:rgba(79,223,143,.045)}.visitor-team-edit-grid .wide{grid-column:1/-1}.visitor-team-edit-grid textarea{min-height:110px}.visitor-team-media-grid{display:grid;grid-template-columns:1fr 1.35fr;gap:11px;margin-top:13px}.visitor-team-media-grid>section{display:grid;align-content:start;gap:9px;padding:12px;border:1px solid var(--line);border-radius:17px;background:#ffffff04}.visitor-team-media-grid>section>div:first-child span,.visitor-team-media-grid>section>div:first-child b{display:block}.visitor-team-media-grid>section>div:first-child span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}.visitor-team-media-grid>section>div:first-child b{margin-top:3px;font-size:11px}.visitor-team-badge-preview{overflow:hidden;display:grid;place-items:center;width:135px;height:135px;margin:auto;border:2px solid rgba(245,220,134,.40);border-radius:50%;background:#07100c}.visitor-team-badge-preview img{max-width:100%;max-height:100%;object-fit:contain}.visitor-team-badge-preview span{color:var(--gold-soft);font-size:22px;font-weight:900}.visitor-team-cover-preview{overflow:hidden;display:grid;place-items:center;aspect-ratio:16/7;border:1px solid var(--line);border-radius:13px;background:#07100c}.visitor-team-cover-preview img{width:100%;height:100%;object-fit:cover}.visitor-team-cover-preview span{color:var(--gold-soft);font-size:10px;font-weight:900}.visitor-team-remove,.visitor-team-confirm{display:flex!important;align-items:center;gap:8px;padding:9px;border:1px solid var(--line);border-radius:12px;background:#ffffff03;text-transform:none!important;letter-spacing:0!important}.visitor-team-remove input,.visitor-team-confirm input{width:auto!important;min-height:0!important}.visitor-team-remove span,.visitor-team-confirm span{color:#d4dfd8;font-size:8px}.visitor-team-confirm{margin-top:13px}.visitor-team-edit-modal form>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;padding-top:13px;border-top:1px solid var(--line)}
    #panelTeamEditRequests{position:relative}.cloud-panel-shortcuts #teamEditRequestCount{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:5px;padding:0 5px;border-radius:999px;color:#07100c;background:var(--gold-soft);font-size:8px}.team-edit-requests-modal>section{width:min(900px,100%)}#teamEditRequestsList{display:grid;gap:10px;padding:14px}.team-edit-request-card{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:linear-gradient(150deg,var(--surface-2),var(--surface))}.team-edit-request-card>header{display:flex;align-items:start;justify-content:space-between;gap:10px;padding:13px;border-bottom:1px solid var(--line)}.team-edit-request-card>header span,.team-edit-request-card>header h3,.team-edit-request-card>header p{display:block}.team-edit-request-card>header span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}.team-edit-request-card>header h3{margin:4px 0;font-size:16px}.team-edit-request-card>header p{margin:0;color:var(--muted);font-size:8px}.team-edit-request-card>header i{padding:5px 7px;border-radius:999px;color:#07100c;background:var(--gold-soft);font-size:6px;font-style:normal;font-weight:900}.team-edit-request-card details{padding:12px}.team-edit-request-card summary{cursor:pointer;color:#dce7df;font-size:9px;font-weight:900}.team-request-diff{display:grid;gap:6px;margin-top:11px}.team-request-diff>div{display:grid;grid-template-columns:135px 1fr 1fr;gap:7px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:11px;background:#ffffff03}.team-request-diff span{color:var(--gold-soft);font-size:7px;font-weight:900;text-transform:uppercase}.team-request-diff del{color:#9a7479;font-size:8px}.team-request-diff b{color:#dce7df;font-size:8px}.team-request-image{display:grid;gap:6px;margin-top:9px}.team-request-image span{color:var(--gold-soft);font-size:8px;font-weight:900}.team-request-image img{display:block;max-width:145px;max-height:145px;object-fit:contain;border-radius:12px;background:#07100c}.team-request-image.cover img{max-width:100%;width:360px;max-height:170px;object-fit:cover}.team-edit-request-card>footer{display:flex;justify-content:flex-end;gap:8px;padding:11px 13px;border-top:1px solid var(--line)}.team-requests-empty{display:grid;place-items:center;gap:6px;min-height:220px;padding:25px;border:1px dashed var(--line-strong);border-radius:17px;color:var(--muted);text-align:center}.team-requests-empty span{font-size:32px}.team-requests-empty b{color:var(--text);font-size:12px}.team-requests-empty p{margin:0;font-size:9px}
    @media(max-width:760px){.visitor-team-requester,.visitor-team-edit-grid,.visitor-team-media-grid{grid-template-columns:1fr}.visitor-team-edit-grid .wide{grid-column:auto}.visitor-team-edit-modal form>footer{display:grid;grid-template-columns:1fr 1fr}.visitor-team-edit-modal form>footer button{width:100%}.team-request-diff>div{grid-template-columns:1fr}.team-edit-request-card>footer{display:grid;grid-template-columns:1fr 1fr}.team-edit-request-card>footer button{width:100%}}
    @media(max-width:480px){.visitor-team-edit-modal,.team-edit-requests-modal{padding:5px}.visitor-team-edit-modal>section,.team-edit-requests-modal>section{border-radius:20px}.visitor-team-edit-modal h2,.team-edit-requests-modal h2{font-size:27px}.visitor-team-edit-modal form{padding:9px}}
  `;
  document.head.append(style);

  window.ArenaDOMEvents.subscribe(scheduleDecorate, { selector: '.team-card,.club-card,[data-team],#adminPanel' });
  window.addEventListener('arena:team-edit-request-updated', renderAdminQueue);
  window.addEventListener('arena:team-profile-updated', scheduleDecorate);
  window.addEventListener('storage', event => {
    if ([LOCAL_KEY, TEAM_KEY].includes(event.key)) {
      scheduleDecorate();
      renderAdminQueue();
    }
  });

  try {
    window.firebase?.auth?.()?.onAuthStateChanged?.(() => {
      scheduleDecorate();
      ensureAdminShortcut();
      subscribeCloudRequests();
    });
  } catch {}

  scheduleDecorate();
  ensureAdminShortcut();
  subscribeCloudRequests();

  window.ArenaBDATeamEditRequests = {
    open: openVisitorEditor,
    openQueue: openAdminQueue,
    refresh: scheduleDecorate
  };
})();
