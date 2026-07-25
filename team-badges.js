(() => {
  'use strict';

  const MAX_FILE_BYTES = 6 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 360;
  let pendingBadge = '';

  const styles = document.createElement('style');

  styles.textContent = `
    .team-mini-badge {
      overflow: hidden;
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, #f4dfa0, #c79a2e);
      color: #171107;
      border-radius: 50%;
    }

    .team-mini-badge img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      padding: 0;
      display: block;
      border-radius: inherit;
    }

    .badge-upload-field {
      grid-column: 1 / -1;
    }

    .badge-upload-field input[type="file"] {
      width: 100%;
      margin-top: 7px;
      padding: 10px;
      border: 1px dashed var(--line-strong);
      border-radius: 13px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.025);
    }

    .badge-upload-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.025);
    }

    .badge-upload-preview .team-mini-badge {
      width: 54px;
      height: 54px;
      flex: 0 0 auto;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 900;
    }

    .badge-upload-preview span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .team-admin-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
    }

    .team-admin-actions button {
      min-height: 36px;
      padding: 0 11px;
      border-radius: 11px;
      font-size: 11px;
    }

    .team-card .team-meta {
      margin-top: 12px;
    }
  `;

  document.head.appendChild(styles);

  function safeImageSource(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  function badgeMarkup(team, extraClass = '') {
    if (team.badge) {
      return `
        <div class="team-mini-badge ${extraClass}">
          <img
            src="${safeImageSource(team.badge)}"
            alt="Escudo de ${escapeHtml(team.name)}"
          >
        </div>
      `;
    }

    return `
      <div class="team-mini-badge ${extraClass}">
        ${escapeHtml((team.code || 'BDA').toUpperCase())}
      </div>
    `;
  }

  function persistTeams(previousValue) {
    try {
      save(STORAGE.teams, teams);
      return true;
    } catch (error) {
      teams = previousValue;
      renderTeams();
      toast('Não foi possível salvar o escudo neste navegador');
      return false;
    }
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        new Error('Falha ao ler a imagem')
      );

      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(
        new Error('Imagem inválida')
      );

      image.src = src;
    });
  }

  async function prepareBadge(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Escolha uma imagem válida');
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new Error('A imagem deve ter no máximo 6 MB');
    }

    const dataUrl = await fileToDataURL(file);
    const image = await loadImage(dataUrl);

    /*
     * Transforma a imagem em um quadrado.
     * A imagem é recortada pelo centro para preencher
     * completamente o círculo do escudo.
     */
    const sourceSize = Math.min(
      image.width,
      image.height
    );

    const sourceX = Math.max(
      0,
      (image.width - sourceSize) / 2
    );

    const sourceY = Math.max(
      0,
      (image.height - sourceSize) / 2
    );

    const outputSize = Math.min(
      MAX_IMAGE_SIDE,
      sourceSize
    );

    const canvas = document.createElement('canvas');

    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error(
        'O navegador não conseguiu processar a imagem'
      );
    }

    ctx.clearRect(
      0,
      0,
      outputSize,
      outputSize
    );

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    const preferredType =
      file.type === 'image/png'
        ? 'image/png'
        : 'image/webp';

    const preferredQuality =
      preferredType === 'image/png'
        ? undefined
        : 0.9;

    return canvas.toDataURL(
      preferredType,
      preferredQuality
    );
  }

  function openBadgePicker(index) {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];

      if (!file) return;

      try {
        toast('Preparando o escudo...');

        const badge = await prepareBadge(file);
        const previousValue = clone(teams);

        teams[index].badge = badge;

        if (!persistTeams(previousValue)) {
          return;
        }

        renderTeams();
        toast('Escudo atualizado');
      } catch (error) {
        toast(
          error.message ||
          'Não foi possível atualizar o escudo'
        );
      }
    });

    input.click();
  }

  function removeBadge(index) {
    const previousValue = clone(teams);

    delete teams[index].badge;

    if (!persistTeams(previousValue)) {
      return;
    }

    renderTeams();
    toast('Escudo removido');
  }

  document.addEventListener('click', event => {
    const changeBadge = event.target.closest(
      '[data-change-badge]'
    );

    if (changeBadge && isAdmin) {
      openBadgePicker(
        Number(changeBadge.dataset.changeBadge)
      );

      return;
    }

    const removeBadgeButton = event.target.closest(
      '[data-remove-badge]'
    );

    if (removeBadgeButton && isAdmin) {
      removeBadge(
        Number(removeBadgeButton.dataset.removeBadge)
      );
    }
  });

  renderTeams = function renderTeamsWithBadges() {
    const grid = document.getElementById('teamGrid');

    document.getElementById('teamCount').textContent =
      `${teams.length} equipes cadastradas`;

    grid.innerHTML = teams.length
      ? teams.map((team, index) => `
          <article class="card team-card">
            <div class="team-card-head">
              ${badgeMarkup(team)}

              <div>
                <h3>${escapeHtml(team.name)}</h3>
                <small>
                  Mestre ${escapeHtml(team.master)}
                </small>
              </div>
            </div>

            <div class="team-meta">
              <span>
                ${escapeHtml(team.status)}
              </span>

              <span>Clã BDA</span>
            </div>

            ${isAdmin ? `
              <div class="team-admin-actions">
                <button
                  class="ghost"
                  type="button"
                  data-change-badge="${index}"
                >
                  Trocar escudo
                </button>

                ${team.badge ? `
                  <button
                    class="secondary"
                    type="button"
                    data-remove-badge="${index}"
                  >
                    Remover escudo
                  </button>
                ` : ''}

                <button
                  class="danger"
                  type="button"
                  data-remove-team="${index}"
                >
                  Excluir time
                </button>
              </div>
            ` : ''}
          </article>
        `).join('')
      : `
        <div class="empty">
          Nenhum time cadastrado.
        </div>
      `;
  };

  function updateFormPreview() {
    const preview = document.getElementById(
      'teamBadgePreview'
    );

    if (!preview) return;

    preview.innerHTML = pendingBadge
      ? `
        <div class="team-mini-badge">
          <img
            src="${safeImageSource(pendingBadge)}"
            alt="Prévia do escudo"
          >
        </div>

        <span>
          Escudo pronto para ser salvo.
        </span>
      `
      : `
        <div class="team-mini-badge">
          IMG
        </div>

        <span>
          Nenhuma imagem selecionada.
          O escudo será ajustado para preencher
          o círculo.
        </span>
      `;
  }

  function enhanceTeamForm() {
    const originalForm = document.getElementById(
      'teamForm'
    );

    if (!originalForm) return;

    const form = originalForm.cloneNode(true);

    originalForm.replaceWith(form);

    const formGrid = form.querySelector(
      '.form-grid'
    );

    const uploadField = document.createElement(
      'label'
    );

    uploadField.className = 'badge-upload-field';

    uploadField.innerHTML = `
      Escudo do time

      <input
        id="teamBadgeFile"
        type="file"
        accept="image/png,image/jpeg,image/webp"
      >

      <div
        class="badge-upload-preview"
        id="teamBadgePreview"
      ></div>
    `;

    formGrid.appendChild(uploadField);

    updateFormPreview();

    const fileInput = document.getElementById(
      'teamBadgeFile'
    );

    fileInput.addEventListener(
      'change',
      async () => {
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

          toast(
            error.message ||
            'Não foi possível carregar o escudo'
          );
        }
      }
    );

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        pendingBadge = '';
        updateFormPreview();
      }, 0);
    });

    form.addEventListener('submit', event => {
      event.preventDefault();

      const name = document
        .getElementById('teamName')
        .value
        .trim();

      const master = document
        .getElementById('teamMaster')
        .value
        .trim();

      const code = document
        .getElementById('teamCode')
        .value
        .trim()
        .slice(0, 4);

      const status = document
        .getElementById('teamStatus')
        .value;

      if (!name || !master || !code) {
        return;
      }

      const previousValue = clone(teams);

      const team = {
        name,
        master,
        code,
        status
      };

      if (pendingBadge) {
        team.badge = pendingBadge;
      }

      teams.unshift(team);

      if (!persistTeams(previousValue)) {
        return;
      }

      form.reset();
      pendingBadge = '';

      updateFormPreview();
      renderTeams();

      toast('Time registrado com escudo');
    });
  }

  enhanceTeamForm();
  renderTeams();
})();
