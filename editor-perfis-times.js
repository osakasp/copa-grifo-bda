(() => {
  'use strict';

  const KEYS = {
    teams: 'bda-v2-teams',
    champions: 'bda-v2-champions',
    tournaments: 'bda-v3-tournaments',
    matches: 'bda-v3-confrontos'
  };
  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let editingIndex = -1;
  let pendingBadgeSource = null;
  let pendingCoverSource = null;
  let removeBadge = false;
  let removeCover = false;
  let observerTimer = 0;

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
    const value = read(KEYS.teams, []);
    return Array.isArray(value) ? value : [];
  }

  function currentEmail() {
    return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
  }

  function adminActive() {
    return (typeof isAdmin !== 'undefined' && Boolean(isAdmin)) || ADMIN_EMAILS.has(currentEmail());
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

  async function makeBadge(source, zoom = 1) {
    const image = await loadImage(source);
    const size = 640;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Falha ao preparar o escudo');
    ctx.clearRect(0, 0, size, size);
    const fit = Math.min((size - 48) / image.width, (size - 48) / image.height) * zoom;
    const width = image.width * fit;
    const height = image.height * fit;
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL('image/webp', 0.92);
  }

  async function makeCover(source, zoom = 1, xPercent = 50, yPercent = 50) {
    const image = await loadImage(source);
    const width = 1400;
    const height = 620;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Falha ao preparar a capa');
    const scale = Math.max(width / image.width, height / image.height) * zoom;
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (width - drawWidth) * (Number(xPercent) / 100);
    const y = (height - drawHeight) * (Number(yPercent) / 100);
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    return canvas.toDataURL('image/webp', 0.86);
  }

  function modal() {
    let root = $('#teamProfileFullEditor');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'teamProfileFullEditor';
    root.className = 'team-profile-edit-modal';
    root.innerHTML = `<section>
      <header><div><span class="eyebrow">Administração dos clubes</span><h2>Editar perfil do time</h2><p>Altere identidade, responsável, história, escudo e capa.</p></div><button type="button" data-team-editor-close aria-label="Fechar">×</button></header>
      <form id="teamProfileFullForm">
        <div class="team-edit-grid">
          <label>Nome do time<input id="teamEditName" required maxlength="55"></label>
          <label>Sigla<input id="teamEditCode" required maxlength="4" style="text-transform:uppercase"></label>
          <label>Mestre responsável<input id="teamEditMaster" required maxlength="55"></label>
          <label>Status<select id="teamEditStatus"><option>Inscrito</option><option>Confirmado</option><option>Lista de espera</option><option>Inativo</option></select></label>
          <label>Entrada no clã<input id="teamEditJoinedAt" type="date"></label>
          <label>Cidade<input id="teamEditCity" maxlength="60" placeholder="Ex.: Praia Grande - SP"></label>
          <label>Fundação<input id="teamEditFounded" maxlength="30" placeholder="Ex.: 2024"></label>
          <label>Jogador favorito<input id="teamEditFavoritePlayer" maxlength="60"></label>
          <label class="wide">Frase oficial<input id="teamEditPhrase" maxlength="140" placeholder="Frase que representa o clube"></label>
          <label class="wide">História do clube<textarea id="teamEditDescription" maxlength="1200" placeholder="Conte a origem, trajetória e identidade do clube."></textarea></label>
        </div>

        <div class="team-edit-media">
          <section><div class="team-edit-media-head"><div><span>Escudo</span><b>Imagem principal do clube</b></div><button type="button" class="danger" data-remove-team-edit-badge>Remover</button></div>
            <div class="team-edit-badge-preview" id="teamEditBadgePreview"></div>
            <label>Trocar escudo<input id="teamEditBadgeFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
            <label>Tamanho do escudo<input id="teamEditBadgeZoom" type="range" min="0.65" max="1.55" step="0.01" value="1"></label>
          </section>
          <section><div class="team-edit-media-head"><div><span>Capa</span><b>Fundo do perfil completo</b></div><button type="button" class="danger" data-remove-team-edit-cover>Remover</button></div>
            <div class="team-edit-cover-preview" id="teamEditCoverPreview"></div>
            <label>Trocar capa<input id="teamEditCoverFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
            <div class="team-edit-range-grid"><label>Zoom<input id="teamEditCoverZoom" type="range" min="1" max="2" step="0.01" value="1"></label><label>Horizontal<input id="teamEditCoverX" type="range" min="0" max="100" step="1" value="50"></label><label>Vertical<input id="teamEditCoverY" type="range" min="0" max="100" step="1" value="50"></label></div>
          </section>
        </div>

        <footer><button class="secondary" type="button" data-team-editor-close>Cancelar</button><button class="primary" type="submit">Salvar alterações</button></footer>
      </form>
    </section>`;
    document.body.append(root);

    root.addEventListener('click', event => {
      if (event.target === root || event.target.closest('[data-team-editor-close]')) closeEditor();
      if (event.target.closest('[data-remove-team-edit-badge]')) {
        pendingBadgeSource = null;
        removeBadge = true;
        updateMediaPreviews();
      }
      if (event.target.closest('[data-remove-team-edit-cover]')) {
        pendingCoverSource = null;
        removeCover = true;
        updateMediaPreviews();
      }
    });
    $('#teamProfileFullForm', root).addEventListener('submit', saveProfile);
    $('#teamEditBadgeFile', root).addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) return notify('Use uma imagem de até 8 MB');
      pendingBadgeSource = await readFile(file);
      removeBadge = false;
      updateMediaPreviews();
    });
    $('#teamEditCoverFile', root).addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) return notify('Use uma imagem de até 8 MB');
      pendingCoverSource = await readFile(file);
      removeCover = false;
      updateMediaPreviews();
    });
    $$('#teamEditBadgeZoom,#teamEditCoverZoom,#teamEditCoverX,#teamEditCoverY', root).forEach(input => input.addEventListener('input', updateMediaPreviews));
    return root;
  }

  function updateMediaPreviews() {
    const team = teamList()[editingIndex] || {};
    const badge = removeBadge ? '' : pendingBadgeSource || team.badge || '';
    const cover = removeCover ? '' : pendingCoverSource || team.profileBanner || '';
    const badgeZoom = Number($('#teamEditBadgeZoom')?.value || 1);
    const coverZoom = Number($('#teamEditCoverZoom')?.value || 1);
    const coverX = Number($('#teamEditCoverX')?.value || 50);
    const coverY = Number($('#teamEditCoverY')?.value || 50);
    const badgeRoot = $('#teamEditBadgePreview');
    const coverRoot = $('#teamEditCoverPreview');
    if (badgeRoot) badgeRoot.innerHTML = badge
      ? `<img src="${esc(badge)}" alt="Prévia do escudo" style="transform:scale(${badgeZoom})">`
      : `<span>${esc((team.code || 'BDA').toUpperCase())}</span>`;
    if (coverRoot) coverRoot.innerHTML = cover
      ? `<img src="${esc(cover)}" alt="Prévia da capa" style="transform:scale(${coverZoom});object-position:${coverX}% ${coverY}%">`
      : '<span>CAPA DO CLUBE</span>';
  }

  function openEditor(index) {
    if (!adminActive()) return notify('Entre com uma conta administradora para editar os times');
    const team = teamList()[index];
    if (!team) return;
    editingIndex = index;
    pendingBadgeSource = null;
    pendingCoverSource = null;
    removeBadge = false;
    removeCover = false;
    const root = modal();
    $('#teamEditName', root).value = team.name || '';
    $('#teamEditCode', root).value = team.code || '';
    $('#teamEditMaster', root).value = team.master || '';
    $('#teamEditStatus', root).value = team.status || 'Inscrito';
    $('#teamEditJoinedAt', root).value = team.joinedAt || '';
    $('#teamEditCity', root).value = team.city || '';
    $('#teamEditFounded', root).value = team.founded || '';
    $('#teamEditFavoritePlayer', root).value = team.favoritePlayer || '';
    $('#teamEditPhrase', root).value = team.phrase || '';
    $('#teamEditDescription', root).value = team.description || '';
    $('#teamEditBadgeFile', root).value = '';
    $('#teamEditCoverFile', root).value = '';
    $('#teamEditBadgeZoom', root).value = '1';
    $('#teamEditCoverZoom', root).value = '1';
    $('#teamEditCoverX', root).value = '50';
    $('#teamEditCoverY', root).value = '50';
    updateMediaPreviews();
    root.classList.add('show');
    document.body.classList.add('team-profile-edit-open');
    $('#teamEditName', root).focus();
  }

  function closeEditor() {
    $('#teamProfileFullEditor')?.classList.remove('show');
    document.body.classList.remove('team-profile-edit-open');
    editingIndex = -1;
  }

  function renameReferences(oldName, newName) {
    if (norm(oldName) === norm(newName)) return;

    const championsData = read(KEYS.champions, []);
    if (Array.isArray(championsData)) {
      championsData.forEach(item => { if (norm(item?.name) === norm(oldName)) item.name = newName; });
      write(KEYS.champions, championsData);
      if (typeof champions !== 'undefined' && Array.isArray(champions)) champions.splice(0, champions.length, ...championsData);
    }

    const tournamentsData = read(KEYS.tournaments, []);
    if (Array.isArray(tournamentsData)) {
      tournamentsData.forEach(item => {
        if (Array.isArray(item?.participants)) item.participants = item.participants.map(name => norm(name) === norm(oldName) ? newName : name);
      });
      write(KEYS.tournaments, tournamentsData);
    }

    const matchesData = read(KEYS.matches, {});
    if (matchesData && typeof matchesData === 'object') {
      Object.values(matchesData).forEach(list => {
        if (!Array.isArray(list)) return;
        list.forEach(game => {
          if (norm(game?.ta) === norm(oldName)) game.ta = newName;
          if (norm(game?.tb) === norm(oldName)) game.tb = newName;
        });
      });
      write(KEYS.matches, matchesData);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!adminActive() || editingIndex < 0) return;
    const list = teamList();
    const current = list[editingIndex];
    if (!current) return;

    const name = $('#teamEditName').value.trim();
    const code = $('#teamEditCode').value.trim().toUpperCase().slice(0, 4);
    const master = $('#teamEditMaster').value.trim();
    if (!name || !code || !master) return notify('Preencha nome, sigla e mestre');
    if (list.some((team, index) => index !== editingIndex && norm(team.name) === norm(name))) return notify('Já existe um time com esse nome');

    const button = $('#teamProfileFullForm button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    try {
      const oldName = current.name;
      const updated = {
        ...current,
        name,
        code,
        master,
        status: $('#teamEditStatus').value,
        joinedAt: $('#teamEditJoinedAt').value,
        city: $('#teamEditCity').value.trim(),
        founded: $('#teamEditFounded').value.trim(),
        favoritePlayer: $('#teamEditFavoritePlayer').value.trim(),
        phrase: $('#teamEditPhrase').value.trim(),
        description: $('#teamEditDescription').value.trim(),
        profileUpdatedAt: Date.now(),
        profileUpdatedBy: currentEmail() || 'admin-bda'
      };

      if (removeBadge) updated.badge = '';
      else if (pendingBadgeSource) updated.badge = await makeBadge(pendingBadgeSource, Number($('#teamEditBadgeZoom').value || 1));
      if (removeCover) updated.profileBanner = '';
      else if (pendingCoverSource) updated.profileBanner = await makeCover(
        pendingCoverSource,
        Number($('#teamEditCoverZoom').value || 1),
        Number($('#teamEditCoverX').value || 50),
        Number($('#teamEditCoverY').value || 50)
      );

      const next = list.map((team, index) => index === editingIndex ? updated : team);
      renameReferences(oldName, name);
      write(KEYS.teams, next);
      if (typeof teams !== 'undefined' && Array.isArray(teams)) teams.splice(0, teams.length, ...next);
      window.dispatchEvent(new CustomEvent('arena:team-profile-updated', { detail: { oldName, name } }));
      if (typeof renderTeams === 'function') renderTeams();
      window.ArenaBDAClubProfiles?.refresh?.();
      closeEditor();
      setTimeout(() => window.ArenaBDAClubProfiles?.open?.(name), 80);
      notify('Perfil do time atualizado');
    } catch (error) {
      console.error(error);
      notify(error.message || 'Não foi possível salvar o perfil');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Salvar alterações'; }
    }
  }

  function decorateCards() {
    const list = teamList();
    $$('#teamGrid .team-card').forEach(card => {
      const name = $('h3', card)?.textContent?.trim();
      const index = list.findIndex(team => norm(team.name) === norm(name));
      if (index < 0) return;
      let button = $('[data-edit-team-profile]', card);
      if (!adminActive()) {
        button?.remove();
        return;
      }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary team-profile-direct-edit';
        button.dataset.editTeamProfile = String(index);
        button.textContent = '✎ Editar perfil';
        const actions = $('.team-admin-actions', card);
        if (actions) actions.prepend(button);
        else $('.club-profile-card-summary', card)?.append(button);
      } else button.dataset.editTeamProfile = String(index);
    });
  }

  document.addEventListener('click', event => {
    const direct = event.target.closest('[data-edit-team-profile]');
    if (direct) {
      event.preventDefault();
      openEditor(Number(direct.dataset.editTeamProfile));
    }
  });

  document.addEventListener('click', event => {
    const existing = event.target.closest('[data-edit-club-profile]');
    if (!existing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const name = $('#clubProfileModal .club-profile-identity h1')?.textContent?.trim();
    const index = teamList().findIndex(team => norm(team.name) === norm(name));
    if (index >= 0) openEditor(index);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#teamProfileFullEditor')?.classList.contains('show')) closeEditor();
  });

  const style = document.createElement('style');
  style.textContent = `
    .team-profile-direct-edit{min-height:36px!important;padding:0 11px!important;font-size:10px!important}
    .team-profile-edit-modal{display:none;position:fixed;inset:0;z-index:245;place-items:center;overflow:auto;padding:15px;background:rgba(0,0,0,.90);backdrop-filter:blur(16px)}.team-profile-edit-modal.show{display:grid}.team-profile-edit-open{overflow:hidden}
    .team-profile-edit-modal>section{width:min(1080px,100%);max-height:96vh;overflow:auto;border:1px solid rgba(245,220,134,.40);border-radius:28px;background:radial-gradient(circle at 100% 0,rgba(245,220,134,.13),transparent 30%),linear-gradient(150deg,#153421,#050c08);box-shadow:0 40px 120px #000d}
    .team-profile-edit-modal>section>header{display:flex;align-items:start;justify-content:space-between;gap:14px;padding:19px 21px;border-bottom:1px solid var(--line)}.team-profile-edit-modal h2{margin:5px 0 3px;font-size:34px;text-transform:uppercase}.team-profile-edit-modal header p{margin:0;color:var(--muted);font-size:9px}.team-profile-edit-modal header>button{width:43px;height:43px;border:1px solid var(--line);border-radius:13px;color:#fff;background:#ffffff08;font-size:25px}
    .team-profile-edit-modal form{padding:17px}.team-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.team-edit-grid .wide{grid-column:1/-1}.team-edit-grid textarea{min-height:120px}
    .team-edit-media{display:grid;grid-template-columns:1fr 1.35fr;gap:12px;margin-top:14px}.team-edit-media>section{display:grid;align-content:start;gap:10px;padding:13px;border:1px solid var(--line);border-radius:18px;background:#ffffff04}.team-edit-media-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.team-edit-media-head span,.team-edit-media-head b{display:block}.team-edit-media-head span{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.team-edit-media-head b{margin-top:4px;font-size:12px}.team-edit-media-head button{min-height:34px;padding-inline:9px;font-size:8px}
    .team-edit-badge-preview{overflow:hidden;display:grid;place-items:center;width:150px;height:150px;margin:auto;border:2px solid rgba(245,220,134,.42);border-radius:50%;background:repeating-conic-gradient(#17241c 0 25%,#0f1b14 0 50%) 50%/24px 24px}.team-edit-badge-preview img{display:block;max-width:100%;max-height:100%;object-fit:contain;transition:.15s}.team-edit-badge-preview span{color:var(--gold-soft);font:900 25px "Barlow Condensed",sans-serif}
    .team-edit-cover-preview{overflow:hidden;display:grid;place-items:center;aspect-ratio:16/7;border:1px solid var(--line);border-radius:14px;background:linear-gradient(145deg,#173d28,#06100a)}.team-edit-cover-preview img{width:100%;height:100%;object-fit:cover;transition:.15s}.team-edit-cover-preview span{color:var(--gold-soft);font-size:11px;font-weight:900;letter-spacing:.12em}.team-edit-range-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .team-profile-edit-modal form>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:15px;padding-top:14px;border-top:1px solid var(--line)}
    @media(max-width:780px){.team-edit-grid,.team-edit-media{grid-template-columns:1fr}.team-edit-range-grid{grid-template-columns:1fr}.team-profile-edit-modal form>footer{display:grid;grid-template-columns:1fr 1fr}.team-profile-edit-modal form>footer button{width:100%}}
    @media(max-width:480px){.team-profile-edit-modal{padding:5px}.team-profile-edit-modal>section{border-radius:21px}.team-profile-edit-modal form{padding:10px}.team-profile-edit-modal>section>header{padding:15px}.team-profile-edit-modal h2{font-size:28px}.team-edit-badge-preview{width:125px;height:125px}}
  `;
  document.head.append(style);

  window.ArenaDOMEvents.subscribe(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(decorateCards, 50);
  }, { selector: '.team-card,.club-card,[data-team]' });
  window.firebase?.auth?.().onAuthStateChanged?.(() => setTimeout(decorateCards, 80));
  decorateCards();

  window.ArenaBDATeamEditor = {
    open(name) {
      const index = teamList().findIndex(team => norm(team.name) === norm(name));
      if (index >= 0) openEditor(index);
    },
    refresh: decorateCards
  };
})();
