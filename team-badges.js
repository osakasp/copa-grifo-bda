(() => {
  'use strict';

  const MAX_FILE_BYTES = 6 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 360;
  let pendingBadge = '';
  let editingTeamIndex = null;

  const styles = document.createElement('style');
  styles.textContent = `
    .team-mini-badge{overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,#f4dfa0,#c79a2e);color:#171107}
    .team-mini-badge img{width:100%;height:100%;object-fit:contain;padding:4px;display:block}
    .badge-upload-field{grid-column:1/-1}
    .badge-upload-field input[type=file]{width:100%;margin-top:7px;padding:10px;border:1px dashed var(--line-strong);border-radius:13px;color:var(--muted);background:rgba(255,255,255,.025)}
    .badge-upload-preview{display:flex;align-items:center;gap:12px;margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025)}
    .badge-upload-preview .team-mini-badge{width:54px;height:54px;flex:0 0 auto;border-radius:16px;font-size:12px;font-weight:900}
    .badge-upload-preview span{color:var(--muted);font-size:12px;line-height:1.4}
    .team-admin-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
    .team-admin-actions button{min-height:36px;padding:0 11px;border-radius:11px;font-size:11px}
    .team-card .team-meta{margin-top:12px}
  `;
  document.head.appendChild(styles);

  function safeImageSource(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function badgeMarkup(team, extraClass = '') {
    if (team.badge) {
      return `<div class="team-mini-badge ${extraClass}"><img src="${safeImageSource(team.badge)}" alt="Escudo de ${escapeHtml(team.name)}"></div>`;
    }
    return `<div class="team-mini-badge ${extraClass}">${escapeHtml((team.code || 'BDA').toUpperCase())}</div>`;
  }

  function persistTeams(previousValue) {
    try {
      save(STORAGE.teams, teams);
      return true;
    } catch (error) {
      teams = previousValue;
      toast('A imagem ficou grande demais para este navegador');
      return false;
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  async function prepareBadge(file) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Escolha uma imagem PNG, JPG ou WebP');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('A imagem deve ter no máximo 6 MB');
    }

    const source = await fileToDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = source;
    });

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem');
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let output = canvas.toDataURL('image/webp', 0.88);
    if (!output.startsWith('data:image/webp')) output = canvas.toDataURL('image/png');
    return output;
  }

  renderTeams = function renderTeamsWithBadges() {
    const grid = document.getElementById('teamGrid');
    document.getElementById('teamCount').textContent = `${teams.length} equipes cadastradas`;
    grid.innerHTML = teams.length
      ? teams.map((team, index) => `
          <article class="card team-card">
            <div class="team-card-head">
              ${badgeMarkup(team)}
              <div><h3>${escapeHtml(team.name)}</h3><small>Mestre ${escapeHtml(team.master)}</small></div>
            </div>
            <div class="team-meta"><span>${escapeHtml(team.status)}</span><span>Clã BDA</span></div>
            ${isAdmin ? `
              <div class="team-admin-actions">
                <button class="ghost" type="button" data-change-badge="${index}">Trocar escudo</button>
                ${team.badge ? `<button class="secondary" type="button" data-remove-badge="${index}">Remover escudo</button>` : ''}
                <button class="danger" type="button" data-remove-team="${index}">Excluir time</button>
              </div>` : ''}
          </article>`).join('')
      : '<div class="empty">Nenhum time cadastrado.</div>';
  };

  function updateFormPreview() {
    const preview = document.getElementById('teamBadgePreview');
    if (!preview) return;
    preview.innerHTML = pendingBadge
      ? `<div class="team-mini-badge"><img src="${safeImageSource(pendingBadge)}" alt="Prévia do escudo"></div><span>Escudo pronto para ser salvo.</span>`
      : '<div class="team-mini-badge">IMG</div><span>Nenhuma imagem selecionada. PNG com fundo transparente fica melhor.</span>';
  }

  function enhanceTeamForm() {
    const originalForm = document.getElementById('teamForm');
    if (!originalForm) return;

    const form = originalForm.cloneNode(true);
    originalForm.replaceWith(form);
    const formGrid = form.querySelector('.form-grid');
    const uploadField = document.createElement('label');
    uploadField.className = 'badge-upload-field';
    uploadField.innerHTML = `Escudo do time
      <input id="teamBadgeFile" type="file" accept="image/png,image/jpeg,image/webp">
      <div class="badge-upload-preview" id="teamBadgePreview"></div>`;
    formGrid.appendChild(uploadField);
    updateFormPreview();

    const fileInput = document.getElementById('teamBadgeFile');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        pendingBadge = '';
        updateFormPreview();
        return;
      }
      try {
        toast('Preparando o escudo...');
        pendingBadge = await prepareBadge(file);
        updateFormPreview();
        toast('Escudo carregado');
      } catch (error) {
        pendingBadge = '';
        fileInput.value = '';
        updateFormPreview();
        toast(error.message || 'Não foi possível carregar o escudo');
      }
    });

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        pendingBadge = '';
        updateFormPreview();
      }, 0);
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      const team = {
        name: document.getElementById('teamName').value.trim(),
        master: document.getElementById('teamMaster').value.trim(),
        code: document.getElementById('teamCode').value.trim().slice(0, 4),
        status: document.getElementById('teamStatus').value,
        badge: pendingBadge
      };
      if (!team.name || !team.master || !team.code) return;
      const previous = clone(teams);
      teams.unshift(team);
      if (!persistTeams(previous)) return;
      form.reset();
      renderTeams();
      toast('Time registrado com escudo');
    });
  }

  const editorInput = document.createElement('input');
  editorInput.type = 'file';
  editorInput.accept = 'image/png,image/jpeg,image/webp';
  editorInput.hidden = true;
  document.body.appendChild(editorInput);

  editorInput.addEventListener('change', async () => {
    const file = editorInput.files?.[0];
    const index = editingTeamIndex;
    editorInput.value = '';
    editingTeamIndex = null;
    if (!file || !Number.isInteger(index) || !teams[index]) return;

    try {
      toast('Atualizando o escudo...');
      const badge = await prepareBadge(file);
      const previous = clone(teams);
      teams[index] = { ...teams[index], badge };
      if (!persistTeams(previous)) return;
      renderTeams();
      toast('Escudo atualizado');
    } catch (error) {
      toast(error.message || 'Não foi possível atualizar o escudo');
    }
  });

  document.addEventListener('click', event => {
    const changeButton = event.target.closest('[data-change-badge]');
    if (changeButton && isAdmin) {
      editingTeamIndex = Number(changeButton.dataset.changeBadge);
      editorInput.click();
      return;
    }

    const removeButton = event.target.closest('[data-remove-badge]');
    if (removeButton && isAdmin) {
      const index = Number(removeButton.dataset.removeBadge);
      if (!teams[index]) return;
      const previous = clone(teams);
      teams[index] = { ...teams[index], badge: '' };
      if (!persistTeams(previous)) return;
      renderTeams();
      toast('Escudo removido');
    }
  });

  enhanceTeamForm();
  renderTeams();
})();