(() => {
  'use strict';

  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_BANNER_SIDE = 1000;
  let pendingChampionBanner = '';
  let editingChampionIndex = null;

  const styles = document.createElement('style');
  styles.textContent = `
    .champion-grid{align-items:start}
    .champion-card--banner{padding:0;overflow:hidden;min-height:0}
    .champion-banner-frame{position:relative;aspect-ratio:1/1;overflow:hidden;background:#07100c}
    .champion-banner-image{width:100%;height:100%;display:block;object-fit:cover;object-position:center;transition:transform .25s ease}
    .champion-card--banner:hover .champion-banner-image{transform:scale(1.015)}
    .champion-banner-gradient{position:absolute;inset:auto 0 0;height:42%;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(3,8,6,.92))}
    .champion-banner-caption{position:absolute;left:14px;right:14px;bottom:13px;z-index:2}
    .champion-banner-caption .edition{display:block;margin-bottom:4px}
    .champion-banner-caption h3{margin:0;color:#fff;font-size:24px;line-height:.95;text-shadow:0 2px 10px rgba(0,0,0,.8)}
    .champion-banner-details{padding:12px 14px;border-top:1px solid var(--line)}
    .champion-banner-details p{margin:0;color:var(--muted);font-size:10px}
    .champion-banner-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .champion-banner-actions button{min-height:36px;padding:0 11px;border-radius:11px;font-size:11px}
    .champion-card--text .champion-banner-actions{position:relative;z-index:2;margin-top:14px}
    .champion-banner-field{grid-column:1/-1}
    .champion-banner-field input[type=file]{width:100%;margin-top:7px;padding:10px;border:1px dashed var(--line-strong);border-radius:13px;color:var(--muted);background:rgba(255,255,255,.025)}
    .champion-banner-preview{margin-top:10px;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
    .champion-banner-preview-media{aspect-ratio:1/1;display:grid;place-items:center;overflow:hidden;color:var(--muted);font-size:12px;background:#07100c}
    .champion-banner-preview-media img{width:100%;height:100%;display:block;object-fit:cover;object-position:center}
    .champion-banner-preview-copy{display:block;padding:9px 11px;color:var(--muted);font-size:10px;line-height:1.45;text-transform:none;letter-spacing:0}
    @media(min-width:760px){.champion-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `;
  document.head.appendChild(styles);

  function safeImageSource(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  function cloneChampions() {
    return clone(champions);
  }

  function persistChampions(previousValue) {
    try {
      save(STORAGE.champions, champions);
      return true;
    } catch (error) {
      champions = previousValue;
      renderChampions();
      toast('Não foi possível salvar o campeão neste navegador');
      return false;
    }
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = src;
    });
  }

  async function prepareBanner(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Escolha uma imagem válida');
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new Error('O banner deve ter no máximo 8 MB');
    }

    const dataUrl = await fileToDataURL(file);
    const image = await loadImage(dataUrl);
    const maxSide = Math.max(image.width, image.height);
    const scale = Math.min(1, MAX_BANNER_SIDE / maxSide);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu processar o banner');

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/webp', 0.86);
  }

  function renderAdminActions(champion, index) {
    if (!isAdmin) return '';

    return `
      <div class="champion-banner-actions">
        <button class="primary" type="button" data-edit-champion="${index}">
          Editar dados
        </button>
        <button class="ghost" type="button" data-change-champion-banner="${index}">
          ${champion.banner ? 'Trocar banner' : 'Adicionar banner'}
        </button>
        ${champion.banner ? `
          <button class="secondary" type="button" data-remove-champion-banner="${index}">
            Remover banner
          </button>
        ` : ''}
        <button class="danger" type="button" data-remove-champion="${index}">
          Excluir campeão
        </button>
      </div>
    `;
  }

  function renderBannerChampion(champion, index) {
    return `
      <article class="card champion-card champion-card--banner">
        <div class="champion-banner-frame">
          <img
            class="champion-banner-image"
            src="${safeImageSource(champion.banner)}"
            alt="Banner de campeão: ${escapeHtml(champion.name)}"
          >
          <div class="champion-banner-gradient"></div>
          <div class="champion-banner-caption">
            <span class="edition">${escapeHtml(champion.edition)}</span>
            <h3>${escapeHtml(champion.name)}</h3>
          </div>
        </div>
        <div class="champion-banner-details">
          <p>Mestre: <strong>${escapeHtml(champion.master)}</strong></p>
          ${renderAdminActions(champion, index)}
        </div>
      </article>
    `;
  }

  function renderTextChampion(champion, index) {
    return `
      <article class="card champion-card champion-card--text">
        <span class="edition">${escapeHtml(champion.edition)}</span>
        <h3>${escapeHtml(champion.name)}</h3>
        <p>Mestre: <strong>${escapeHtml(champion.master)}</strong></p>
        <p>Referência: ${escapeHtml(champion.player || 'Elenco campeão')}</p>
        <p class="quote">“${escapeHtml(champion.quote || 'Campeão da arena BDA.')}”</p>
        ${renderAdminActions(champion, index)}
      </article>
    `;
  }

  renderChampions = function renderChampionsWithBanners() {
    const grid = document.getElementById('championGrid');

    grid.innerHTML = champions.length
      ? champions.map((champion, index) => (
          champion.banner
            ? renderBannerChampion(champion, index)
            : renderTextChampion(champion, index)
        )).join('')
      : '<div class="empty">A galeria ainda não possui campeões.</div>';
  };

  function updateBannerPreview() {
    const preview = document.getElementById('championBannerPreview');
    if (!preview) return;

    const currentBanner = Number.isInteger(editingChampionIndex)
      ? champions[editingChampionIndex]?.banner || ''
      : '';
    const banner = pendingChampionBanner || currentBanner;

    preview.innerHTML = banner
      ? `
        <div class="champion-banner-preview-media">
          <img src="${safeImageSource(banner)}" alt="Prévia do banner de campeão">
        </div>
        <span class="champion-banner-preview-copy">
          ${pendingChampionBanner ? 'Novo banner pronto para salvar.' : 'Banner atual do campeão.'}
        </span>
      `
      : `
        <div class="champion-banner-preview-media">Prévia do banner</div>
        <span class="champion-banner-preview-copy">
          Escolha uma imagem quadrada para preencher melhor o quadro. PNG, JPG e WebP são aceitos.
        </span>
      `;
  }

  function enhanceChampionForm() {
    const originalForm = document.getElementById('championForm');
    if (!originalForm) return;

    const form = originalForm.cloneNode(true);
    originalForm.replaceWith(form);

    const submitButton = form.querySelector('button.primary');
    if (submitButton) submitButton.type = 'submit';

    const modalTitle = document.querySelector('#championModal .modal > h2');
    if (modalTitle) modalTitle.id = 'championModalTitle';

    const formGrid = form.querySelector('.form-grid');
    const bannerField = document.createElement('label');
    bannerField.className = 'champion-banner-field';
    bannerField.innerHTML = `
      Banner do campeão
      <input id="championBannerFile" type="file" accept="image/png,image/jpeg,image/webp">
      <div class="champion-banner-preview" id="championBannerPreview"></div>
    `;
    formGrid.appendChild(bannerField);
    updateBannerPreview();

    const fileInput = document.getElementById('championBannerFile');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];

      if (!file) {
        pendingChampionBanner = '';
        updateBannerPreview();
        return;
      }

      try {
        toast('Preparando o banner...');
        pendingChampionBanner = await prepareBanner(file);
        updateBannerPreview();
        toast('Banner carregado');
      } catch (error) {
        pendingChampionBanner = '';
        fileInput.value = '';
        updateBannerPreview();
        toast(error.message || 'Não foi possível carregar o banner');
      }
    });

    form.addEventListener('submit', event => {
      event.preventDefault();

      const champion = {
        ...(Number.isInteger(editingChampionIndex) ? champions[editingChampionIndex] : {}),
        edition: document.getElementById('championEdition').value.trim(),
        name: document.getElementById('championName').value.trim(),
        master: document.getElementById('championMaster').value.trim(),
        player: document.getElementById('championPlayer').value.trim(),
        quote: document.getElementById('championQuote').value.trim()
      };

      if (!champion.edition || !champion.name || !champion.master) return;
      if (pendingChampionBanner) champion.banner = pendingChampionBanner;

      const previousValue = cloneChampions();
      const isEditing = Number.isInteger(editingChampionIndex)
        && Boolean(champions[editingChampionIndex]);

      if (isEditing) champions[editingChampionIndex] = champion;
      else champions.unshift(champion);
      if (!persistChampions(previousValue)) return;

      form.reset();
      pendingChampionBanner = '';
      editingChampionIndex = null;
      updateBannerPreview();
      closeModal('championModal');
      renderChampions();
      toast(isEditing ? 'Dados do campeão atualizados' : 'Campeão adicionado à galeria');
    });

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        pendingChampionBanner = '';
        updateBannerPreview();
      }, 0);
    });

    document.getElementById('addChampionBtn')?.addEventListener('click', openChampionCreator);
  }

  function configureChampionModal(title, submitLabel) {
    const form = document.getElementById('championForm');
    const titleElement = document.getElementById('championModalTitle');
    const submitButton = form?.querySelector('button.primary');
    if (titleElement) titleElement.textContent = title;
    if (submitButton) submitButton.textContent = submitLabel;
  }

  function openChampionCreator() {
    const form = document.getElementById('championForm');
    if (!form || !isAdmin) return;
    editingChampionIndex = null;
    pendingChampionBanner = '';
    form.reset();
    configureChampionModal('Adicionar campeão', 'Salvar campeão');
    updateBannerPreview();
    openModal('championModal');
    document.getElementById('championEdition')?.focus();
  }

  function openChampionEditor(index) {
    const champion = champions[index];
    const form = document.getElementById('championForm');
    if (!isAdmin || !champion || !form) return;

    editingChampionIndex = index;
    pendingChampionBanner = '';
    form.reset();
    document.getElementById('championEdition').value = champion.edition || '';
    document.getElementById('championName').value = champion.name || '';
    document.getElementById('championMaster').value = champion.master || '';
    document.getElementById('championPlayer').value = champion.player || '';
    document.getElementById('championQuote').value = champion.quote || '';
    configureChampionModal('Editar campeão', 'Salvar alterações');
    updateBannerPreview();
    openModal('championModal');
    document.getElementById('championEdition')?.focus();
  }

  function openBannerPicker(index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        toast('Preparando o banner...');
        const banner = await prepareBanner(file);
        const previousValue = cloneChampions();
        champions[index].banner = banner;
        if (!persistChampions(previousValue)) return;
        renderChampions();
        toast('Banner do campeão atualizado');
      } catch (error) {
        toast(error.message || 'Não foi possível atualizar o banner');
      }
    });

    input.click();
  }

  function removeChampionBanner(index) {
    const previousValue = cloneChampions();
    delete champions[index].banner;
    if (!persistChampions(previousValue)) return;
    renderChampions();
    toast('Banner removido');
  }

  document.addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-champion]');
    if (editButton && isAdmin) {
      openChampionEditor(Number(editButton.dataset.editChampion));
      return;
    }

    const changeButton = event.target.closest('[data-change-champion-banner]');
    if (changeButton && isAdmin) {
      openBannerPicker(Number(changeButton.dataset.changeChampionBanner));
      return;
    }

    const removeButton = event.target.closest('[data-remove-champion-banner]');
    if (removeButton && isAdmin) {
      removeChampionBanner(Number(removeButton.dataset.removeChampionBanner));
    }
  });

  enhanceChampionForm();
  renderChampions();
})();
