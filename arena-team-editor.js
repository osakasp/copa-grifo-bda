(() => {
  'use strict';

  if (window.ArenaBDATeamEditor?.version >= 1) return;

  const TEAM_KEY = 'bda-v2-teams';
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const STYLE_ID = 'arenaTeamEditorStyles';
  const MODAL_ID = 'arenaTeamEditorModal';
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  let currentName = '';
  let pendingBadge = null;
  let removeBadge = false;
  let frame = 0;

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

  const clone = value => JSON.parse(JSON.stringify(value));

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function teams() {
    const value = read(TEAM_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function isAdmin() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.());
  }

  function notify(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else console.info(message);
  }

  function initials(name) {
    const parts = String(name || 'BDA').split(/\s+/).filter(Boolean);
    const text = parts.slice(0, 3).map(part => part[0]).join('').toUpperCase();
    return text.slice(0, 4) || 'BDA';
  }

  function validTeamName(name) {
    const value = String(name || '').trim();
    if (!value || value.length < 2) return false;
    return !/^(vencedor|aguardando|time\s+[ab]|a definir|bye)\b/i.test(value);
  }

  function findTeam(name, list = teams()) {
    const key = norm(name);
    return list.find(team => norm(team?.name) === key) || null;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .arena-team-editable{cursor:pointer!important}
      .arena-team-editable:hover{outline:1px solid rgba(216,178,72,.22);outline-offset:3px}
      .arena-team-editable[title]{}
      .arena-team-editor-backdrop{
        position:fixed;inset:0;z-index:120;display:none;place-items:end center;
        padding:14px;background:rgba(0,0,0,.72);backdrop-filter:blur(7px)
      }
      .arena-team-editor-backdrop.show{display:grid}
      .arena-team-editor{
        width:min(100%,520px);max-height:min(88vh,760px);overflow:auto;
        border:1px solid rgba(216,178,72,.28);border-radius:22px 22px 14px 14px;
        background:#07110b;color:#f4f7f2;box-shadow:0 22px 70px rgba(0,0,0,.48)
      }
      .arena-team-editor>header{
        position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
        padding:15px 16px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(7,17,11,.97)
      }
      .arena-team-editor>header span{display:block;color:#d8b248;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
      .arena-team-editor>header h2{margin:3px 0 0;font-size:25px;line-height:1}
      .arena-team-editor-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.09);border-radius:10px;color:#f4f7f2;background:#0b1a11;font-size:20px}
      .arena-team-editor form{padding:15px 16px 18px}
      .arena-team-editor-status{
        margin:0 0 12px;padding:9px 10px;border:1px solid rgba(79,223,143,.17);border-radius:10px;
        color:#9fb0a5;background:rgba(79,223,143,.045);font-size:9px;line-height:1.4
      }
      .arena-team-editor-badge-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:13px;align-items:center;margin-bottom:14px}
      .arena-team-editor-preview{
        width:92px;height:92px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(216,178,72,.28);
        border-radius:18px;color:#161309;background:#d8b248;font:900 22px 'Barlow Condensed',sans-serif
      }
      .arena-team-editor-preview img{width:100%;height:100%;object-fit:contain;background:#030805}
      .arena-team-editor-badge-actions{display:grid;gap:7px}
      .arena-team-editor-badge-actions label,.arena-team-editor-badge-actions button{
        min-height:40px;border-radius:10px;font-size:10px;font-weight:800
      }
      .arena-team-editor-badge-actions label{
        display:flex;align-items:center;justify-content:center;padding:0 10px;border:1px solid rgba(216,178,72,.25);
        color:#f1d97f;background:#0b1a11;cursor:pointer;text-transform:none;letter-spacing:0
      }
      .arena-team-editor-badge-actions input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
      .arena-team-editor-remove-badge{border:1px solid rgba(255,105,120,.22);color:#ff9aa4;background:rgba(255,105,120,.06)}
      .arena-team-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .arena-team-editor-grid label{display:grid;gap:6px;color:#91a197;font-size:9px;font-weight:800;text-transform:none;letter-spacing:0}
      .arena-team-editor-grid label:first-child{grid-column:1/-1}
      .arena-team-editor-grid input,.arena-team-editor-grid select{
        min-height:44px;padding:0 11px;border:1px solid rgba(255,255,255,.09);border-radius:10px;color:#f4f7f2;background:#040b07;font-size:13px
      }
      .arena-team-editor-footer{display:flex;gap:8px;margin-top:15px}
      .arena-team-editor-footer button{flex:1;min-height:44px;border-radius:10px;font-weight:850}
      .arena-team-editor-cancel{border:1px solid rgba(255,255,255,.09);color:#f4f7f2;background:#0b1710}
      .arena-team-editor-save{border:1px solid #d8b248;color:#171207;background:#d8b248}
      #teamGrid .team-mini-badge{overflow:hidden}
      #teamGrid .team-mini-badge img{width:100%;height:100%;object-fit:contain;background:#030805}
      #teamGrid .team-card[data-team-editor-name]{cursor:pointer}
      @media(max-width:560px){
        .arena-team-editor-backdrop{padding:8px;align-items:end}
        .arena-team-editor{max-height:91vh;border-radius:18px 18px 9px 9px}
        .arena-team-editor-grid{grid-template-columns:1fr}
        .arena-team-editor-grid label:first-child{grid-column:auto}
        .arena-team-editor-badge-row{grid-template-columns:78px minmax(0,1fr)}
        .arena-team-editor-preview{width:78px;height:78px;border-radius:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = MODAL_ID;
    backdrop.className = 'arena-team-editor-backdrop';
    backdrop.setAttribute('role', 'presentation');
    backdrop.innerHTML = `
      <section class="arena-team-editor" role="dialog" aria-modal="true" aria-labelledby="arenaTeamEditorTitle">
        <header>
          <div><span>Administração de clubes</span><h2 id="arenaTeamEditorTitle">Editar time</h2></div>
          <button type="button" class="arena-team-editor-close" aria-label="Fechar">×</button>
        </header>
        <form id="arenaTeamEditorForm">
          <p class="arena-team-editor-status" id="arenaTeamEditorStatus"></p>
          <div class="arena-team-editor-badge-row">
            <div class="arena-team-editor-preview" id="arenaTeamEditorPreview">BDA</div>
            <div class="arena-team-editor-badge-actions">
              <label>Trocar escudo<input id="arenaTeamEditorBadge" type="file" accept="image/*"></label>
              <button type="button" class="arena-team-editor-remove-badge" id="arenaTeamEditorRemoveBadge">Remover escudo</button>
            </div>
          </div>
          <div class="arena-team-editor-grid">
            <label>Nome do time<input id="arenaTeamEditorName" maxlength="80" required></label>
            <label>Mestre<input id="arenaTeamEditorMaster" maxlength="80" placeholder="Nome do mestre"></label>
            <label>Sigla<input id="arenaTeamEditorCode" maxlength="4" placeholder="BDA"></label>
            <label>Status<select id="arenaTeamEditorTeamStatus"><option>Confirmado</option><option>Inscrito</option><option>Ativo</option><option>Inativo</option></select></label>
          </div>
          <div class="arena-team-editor-footer">
            <button type="button" class="arena-team-editor-cancel">Cancelar</button>
            <button type="submit" class="arena-team-editor-save">Salvar time</button>
          </div>
        </form>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.querySelector('.arena-team-editor-close')?.addEventListener('click', close);
    backdrop.querySelector('.arena-team-editor-cancel')?.addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    backdrop.querySelector('#arenaTeamEditorBadge')?.addEventListener('change', handleBadgeFile);
    backdrop.querySelector('#arenaTeamEditorRemoveBadge')?.addEventListener('click', () => {
      pendingBadge = null;
      removeBadge = true;
      renderPreview(null, currentName);
    });
    backdrop.querySelector('#arenaTeamEditorForm')?.addEventListener('submit', saveTeam);
    return backdrop;
  }

  function renderPreview(src, name) {
    const preview = document.getElementById('arenaTeamEditorPreview');
    if (!preview) return;
    preview.innerHTML = src
      ? `<img src="${esc(src)}" alt="Prévia do escudo de ${esc(name)}">`
      : esc(initials(name));
  }

  function open(name) {
    if (!isAdmin()) return;
    const cleanName = String(name || '').trim();
    if (!validTeamName(cleanName)) return;
    currentName = cleanName;
    pendingBadge = null;
    removeBadge = false;
    const list = teams();
    const team = findTeam(cleanName, list);
    const modal = ensureModal();
    const value = team || { name: cleanName, master: '', code: initials(cleanName), status: 'Confirmado', badge: '' };

    modal.querySelector('#arenaTeamEditorTitle').textContent = team ? 'Editar time' : 'Cadastrar time';
    modal.querySelector('#arenaTeamEditorStatus').textContent = team
      ? 'Este clube já está cadastrado. Ao salvar, o cadastro existente será atualizado.'
      : 'Este clube ainda não está no cadastro de times. Ao salvar, ele será adicionado automaticamente.';
    modal.querySelector('#arenaTeamEditorName').value = value.name || cleanName;
    modal.querySelector('#arenaTeamEditorMaster').value = value.master || '';
    modal.querySelector('#arenaTeamEditorCode').value = value.code || initials(cleanName);
    modal.querySelector('#arenaTeamEditorTeamStatus').value = value.status || 'Confirmado';
    modal.querySelector('#arenaTeamEditorBadge').value = '';
    renderPreview(value.badge || '', value.name || cleanName);
    modal.classList.add('show');
    setTimeout(() => modal.querySelector('#arenaTeamEditorName')?.focus(), 30);
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    modal?.classList.remove('show');
    currentName = '';
    pendingBadge = null;
    removeBadge = false;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = src;
    });
  }

  function fileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  async function prepareBadge(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > MAX_FILE_BYTES) throw new Error('O escudo deve ter no máximo 8 MB');
    const source = await fileData(file);
    const image = await loadImage(source);
    let size = 512;
    let quality = .86;
    let output = '';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar o escudo');
      context.clearRect(0, 0, size, size);
      const scale = Math.min(size / image.width, size / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
      output = canvas.toDataURL('image/webp', quality);
      if (output.length < 620000) break;
      size = Math.max(320, Math.round(size * .82));
      quality = Math.max(.58, quality - .08);
    }
    return output;
  }

  async function handleBadgeFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const input = event.target;
    input.disabled = true;
    try {
      pendingBadge = await prepareBadge(file);
      removeBadge = false;
      renderPreview(pendingBadge, document.getElementById('arenaTeamEditorName')?.value || currentName);
      notify('Escudo pronto para salvar');
    } catch (error) {
      input.value = '';
      notify(error.message || 'Não foi possível processar o escudo');
    } finally {
      input.disabled = false;
    }
  }

  function updateNameInGroups(groupContainer, oldName, newName) {
    if (!Array.isArray(groupContainer?.groups)) return false;
    let changed = false;
    groupContainer.groups = groupContainer.groups.map(group => {
      if (!Array.isArray(group?.teams)) return group;
      const nextTeams = group.teams.map(name => {
        if (norm(name) !== norm(oldName)) return name;
        changed = true;
        return newName;
      });
      return { ...group, teams: nextTeams };
    });
    return changed;
  }

  function renameReferences(oldName, newName) {
    if (norm(oldName) === norm(newName)) return { tournaments: false, matches: false };
    let tournamentChanged = false;
    let matchChanged = false;

    const tournamentList = read(TOURNAMENT_KEY, []);
    if (Array.isArray(tournamentList)) {
      const next = tournamentList.map(tournament => {
        let changed = false;
        const copyTournament = clone(tournament);
        if (Array.isArray(copyTournament.participants)) {
          copyTournament.participants = copyTournament.participants.map(name => {
            if (norm(name) !== norm(oldName)) return name;
            changed = true;
            return newName;
          });
        }
        if (copyTournament.groupSettings && updateNameInGroups(copyTournament.groupSettings, oldName, newName)) changed = true;
        if (copyTournament.groupGenerator && updateNameInGroups(copyTournament.groupGenerator, oldName, newName)) changed = true;
        if (changed) tournamentChanged = true;
        return copyTournament;
      });
      if (tournamentChanged) localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(next));
    }

    const store = read(MATCH_KEY, {});
    if (store && typeof store === 'object') {
      const nextStore = { ...store };
      Object.keys(nextStore).forEach(tournamentId => {
        const list = Array.isArray(nextStore[tournamentId]) ? nextStore[tournamentId] : null;
        if (!list) return;
        nextStore[tournamentId] = list.map(game => {
          let changed = false;
          const next = { ...game };
          if (norm(next.ta) === norm(oldName)) { next.ta = newName; changed = true; }
          if (norm(next.tb) === norm(oldName)) { next.tb = newName; changed = true; }
          if (changed) {
            next.updated = Date.now();
            matchChanged = true;
          }
          return next;
        });
      });
      if (matchChanged) localStorage.setItem(MATCH_KEY, JSON.stringify(nextStore));
    }

    return { tournaments: tournamentChanged, matches: matchChanged };
  }

  function dispatchUpdates(detail) {
    window.dispatchEvent(new CustomEvent('arena:teams-updated', { detail }));
    window.dispatchEvent(new CustomEvent('arena:tournaments-updated', { detail: { ...detail, reason: 'team-editor' } }));
    window.dispatchEvent(new CustomEvent('arena:matches-updated', { detail: { ...detail, reason: 'team-editor' } }));
    try { window.ArenaBDAMatchManager?.render?.(); } catch {}
    try { window.ArenaBDASuperLeagueRuntimeFix?.refresh?.(); } catch {}
    schedule();
  }

  function saveTeam(event) {
    event.preventDefault();
    if (!isAdmin()) return notify('Apenas administradores podem editar times');

    const oldName = currentName;
    const name = String(document.getElementById('arenaTeamEditorName')?.value || '').trim();
    const master = String(document.getElementById('arenaTeamEditorMaster')?.value || '').trim();
    const code = String(document.getElementById('arenaTeamEditorCode')?.value || '').trim().toUpperCase().slice(0, 4) || initials(name);
    const status = String(document.getElementById('arenaTeamEditorTeamStatus')?.value || 'Confirmado').trim();
    if (!validTeamName(name)) return notify('Digite um nome válido para o time');

    const list = teams();
    const index = list.findIndex(team => norm(team?.name) === norm(oldName));
    const duplicateIndex = list.findIndex((team, teamIndex) => teamIndex !== index && norm(team?.name) === norm(name));
    if (duplicateIndex >= 0) return notify('Já existe outro time cadastrado com esse nome');

    const previous = index >= 0 ? list[index] : {};
    const badge = removeBadge ? '' : (pendingBadge ?? previous.badge ?? '');
    const nextTeam = {
      ...previous,
      name,
      master,
      code,
      status,
      badge,
      updatedAt: Date.now()
    };

    if (index >= 0) list[index] = nextTeam;
    else list.push(nextTeam);

    localStorage.setItem(TEAM_KEY, JSON.stringify(list));
    const renamed = renameReferences(oldName, name);
    dispatchUpdates({ oldName, name, created: index < 0, renamed: renamed.tournaments || renamed.matches });
    notify(index >= 0 ? 'Time atualizado' : 'Time cadastrado');
    close();
  }

  function teamFromElement(target) {
    if (!(target instanceof Element)) return '';
    const explicit = target.closest('[data-team-editor-name]');
    if (explicit?.dataset?.teamEditorName) return explicit.dataset.teamEditorName;

    const card = target.closest('.team-card');
    if (card) return card.querySelector('h3')?.textContent?.trim() || '';

    const standings = target.closest('.stand-club');
    if (standings) return standings.querySelector('b')?.textContent?.trim() || '';

    const gameTeam = target.closest('.gi-team');
    if (gameTeam) return gameTeam.querySelector('strong')?.textContent?.trim() || '';

    const newBracket = target.closest('.arena-v3-bracket-card > div');
    if (newBracket) return newBracket.querySelector('b')?.textContent?.trim() || '';

    const oldBracket = target.closest('.gi-bracket article > div');
    if (oldBracket) return oldBracket.querySelector('span')?.textContent?.trim() || '';

    const nowClub = target.closest('.now-club');
    if (nowClub) return nowClub.querySelector('strong')?.textContent?.trim() || '';

    const participant = target.closest('.arena-club');
    if (participant) return participant.textContent?.trim() || '';

    const groupTeam = target.closest('.slg-team,.slg-club,[data-team]');
    if (groupTeam) return groupTeam.dataset.team || groupTeam.querySelector('b,strong')?.textContent?.trim() || groupTeam.textContent?.trim() || '';

    return '';
  }

  function decorateTargets() {
    const admin = isAdmin();
    const selectors = [
      '.team-card', '.stand-club', '.gi-team', '.arena-v3-bracket-card > div',
      '.gi-bracket article > div', '.now-club', '.arena-club', '.slg-team', '.slg-club', '[data-team]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(node => {
      const name = teamFromElement(node);
      if (!validTeamName(name)) return;
      node.classList.toggle('arena-team-editable', admin);
      if (admin) {
        node.dataset.teamEditorName = name;
        node.title = 'Clique para editar este time';
      } else {
        delete node.dataset.teamEditorName;
        if (node.title === 'Clique para editar este time') node.removeAttribute('title');
      }
    });
  }

  function teamCardHtml(team, index, admin) {
    const badge = team?.badge
      ? `<img src="${esc(team.badge)}" alt="Escudo de ${esc(team.name)}">`
      : esc(String(team?.code || initials(team?.name)).toUpperCase());
    return `<article class="card team-card${admin ? ' arena-team-editable' : ''}" data-team-editor-name="${esc(team.name)}">
      <div class="team-card-head"><div class="team-mini-badge">${badge}</div><div><h3>${esc(team.name)}</h3><small>Mestre ${esc(team.master || 'não informado')}</small></div></div>
      <div class="team-meta"><span>${esc(team.status || 'Confirmado')}</span>${admin ? `<button class="danger" type="button" data-arena-remove-team="${index}">Excluir</button>` : '<span>Clã BDA</span>'}</div>
    </article>`;
  }

  function syncTeamsPage() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    const list = teams();
    const admin = isAdmin();
    const desiredNames = list.map(team => norm(team?.name)).join('|');
    const currentNames = [...grid.querySelectorAll('.team-card h3')].map(node => norm(node.textContent)).join('|');
    const desiredState = `${desiredNames}::${admin ? 'admin' : 'public'}::${list.map(team => String(team?.badge || '').length).join(',')}`;
    if (grid.dataset.arenaTeamEditorState === desiredState && currentNames === desiredNames) return;
    grid.dataset.arenaTeamEditorState = desiredState;
    grid.innerHTML = list.length
      ? list.map((team, index) => teamCardHtml(team, index, admin)).join('')
      : '<div class="empty">Nenhum time cadastrado.</div>';
    const count = document.getElementById('teamCount');
    if (count) count.textContent = `${list.length} equipes cadastradas`;
  }

  function refresh() {
    frame = 0;
    installStyles();
    syncTeamsPage();
    decorateTargets();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(refresh);
  }

  document.addEventListener('click', event => {
    const remove = event.target.closest?.('[data-arena-remove-team]');
    if (remove) {
      if (!isAdmin()) return;
      event.preventDefault();
      event.stopPropagation();
      const list = teams();
      const index = Number(remove.dataset.arenaRemoveTeam);
      const team = list[index];
      if (!team) return;
      if (!confirm(`Excluir ${team.name} do cadastro de times?`)) return;
      list.splice(index, 1);
      localStorage.setItem(TEAM_KEY, JSON.stringify(list));
      dispatchUpdates({ name: team.name, removed: true });
      notify('Time removido do cadastro');
      return;
    }

    if (!isAdmin() || event.target.closest?.('button,a,input,select,textarea,label')) return;
    const name = teamFromElement(event.target);
    if (!validTeamName(name)) return;
    event.preventDefault();
    open(name);
  }, true);

  document.addEventListener('keydown', event => {
    if (!isAdmin() || !['Enter', ' '].includes(event.key)) return;
    const node = event.target.closest?.('.arena-team-editable');
    if (!node || event.target.closest('button,a,input,select,textarea,label')) return;
    const name = teamFromElement(node);
    if (!validTeamName(name)) return;
    event.preventDefault();
    open(name);
  });

  ['arena:bundle-loaded','arena:auth-changed','arena:cloud-ready','arena:teams-updated','arena:tournaments-updated','arena:matches-updated','arena:quick-score-saved']
    .forEach(type => window.addEventListener(type, schedule));

  window.addEventListener('storage', event => {
    if ([TEAM_KEY, TOURNAMENT_KEY, MATCH_KEY].includes(event.key)) schedule();
  });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDATeamEditor = Object.freeze({
    version: 1,
    open,
    refresh,
    teams: () => clone(teams())
  });

  refresh();
})();
