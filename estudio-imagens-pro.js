(() => {
  'use strict';

  const STORAGE_TOURNAMENTS = 'bda-v3-tournaments';
  const STORAGE_SETTINGS = 'bda-art-settings-v2';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  const MODELS = {
    automatic: { label: 'Automático do campeonato', hint: 'Usa as cores oficiais da competição' },
    classic: { label: 'Clássico premium', hint: 'Dourado, molduras fortes e visual solene' },
    neon: { label: 'Noite neon', hint: 'Brilho intenso para jogos e anúncios' },
    final: { label: 'Grande final', hint: 'Mais impacto, título maior e clima decisivo' },
    minimal: { label: 'Minimalista', hint: 'Limpo, direto e com menos efeitos' }
  };

  let editingTournamentId = null;
  let pendingTournamentMedia = { logo: null, banner: null };
  let batchBusy = false;
  let scheduled = false;
  let activeModel = 'automatic';

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function championshipName() {
    return $('#giManager .gi-head h2')?.textContent?.trim()
      || $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim()
      || $('#tName')?.value?.trim()
      || 'Arena BDA';
  }

  function settingsKey(name = championshipName()) {
    return norm(name) || 'arena-bda';
  }

  function allSavedSettings() {
    const value = readJSON(STORAGE_SETTINGS, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function savedSettings(name = championshipName()) {
    return allSavedSettings()[settingsKey(name)] || {};
  }

  function persistSettings(settings, name = championshipName()) {
    const all = allSavedSettings();
    all[settingsKey(name)] = { ...all[settingsKey(name)], ...settings, updatedAt: Date.now() };
    writeJSON(STORAGE_SETTINGS, all);
  }

  function inputValue(selector, fallback = '') {
    const element = $(selector);
    return element ? element.value : fallback;
  }

  function currentStudioSettings() {
    return {
      scope: inputValue('#artScope', 'phase'),
      phaseIndex: inputValue('#artPhase', '0'),
      format: inputValue('#artFormat', 'story'),
      quality: inputValue('#artQuality', 'twoK'),
      zoom: inputValue('#artZoom', 'close'),
      model: inputValue('#artModel', activeModel || 'automatic'),
      showLeagueLogo: Boolean($('#artShowLeagueLogo')?.checked),
      showArenaLogo: Boolean($('#artShowArenaLogo')?.checked),
      saveDefaults: Boolean($('#artSaveDefaults')?.checked),
      batch: inputValue('#artBatchMode', 'none')
    };
  }

  function applySavedSettings(modal) {
    if (!modal || modal.dataset.proSettingsApplied === 'true') return;
    modal.dataset.proSettingsApplied = 'true';
    const saved = savedSettings();
    const map = {
      '#artFormat': saved.format,
      '#artQuality': saved.quality,
      '#artZoom': saved.zoom,
      '#artModel': saved.model
    };
    Object.entries(map).forEach(([selector, value]) => {
      const element = $(selector, modal);
      if (element && value && [...element.options].some(option => option.value === value)) element.value = value;
    });
    if ($('#artShowLeagueLogo', modal) && typeof saved.showLeagueLogo === 'boolean') $('#artShowLeagueLogo', modal).checked = saved.showLeagueLogo;
    if ($('#artShowArenaLogo', modal) && typeof saved.showArenaLogo === 'boolean') $('#artShowArenaLogo', modal).checked = saved.showArenaLogo;
    if ($('#artSaveDefaults', modal)) $('#artSaveDefaults', modal).checked = saved.saveDefaults !== false;
    activeModel = saved.model || 'automatic';
  }

  function modelOptions() {
    return Object.entries(MODELS).map(([key, item]) => `<option value="${key}">${item.label}</option>`).join('');
  }

  function injectStudioControls(modal) {
    if (!modal || $('#artModel', modal)) return;
    const grid = $('.art-config-grid', modal);
    if (!grid) return;

    const modelField = document.createElement('label');
    modelField.innerHTML = `Modelo visual<select id="artModel">${modelOptions()}</select>`;
    grid.append(modelField);

    const saveCard = document.createElement('label');
    saveCard.className = 'art-save-defaults';
    saveCard.innerHTML = '<input id="artSaveDefaults" type="checkbox" checked><span><b>Salvar estas configurações</b><small>O próximo banner deste campeonato abrirá com o mesmo formato, qualidade, zoom e modelo.</small></span>';
    grid.insertAdjacentElement('afterend', saveCard);

    const oldPackage = $('#artPhasePackageWrap', modal);
    if (oldPackage) {
      oldPackage.hidden = true;
      const oldInput = $('#artPhasePackage', oldPackage);
      if (oldInput) oldInput.checked = false;
    }

    const batch = document.createElement('label');
    batch.className = 'art-batch-mode';
    batch.innerHTML = `Exportação em lote<select id="artBatchMode"><option value="none">Uma imagem</option><option value="phases">Todas as fases separadas</option><option value="games">Todos os jogos separados</option></select><small>Disponível quando o conteúdo está em “Todas as fases”.</small>`;
    saveCard.insertAdjacentElement('afterend', batch);

    applySavedSettings(modal);
    updateStudioPreview(modal);

    $$('select,input', modal).forEach(element => {
      if (element.dataset.proStudioHook === 'true') return;
      element.dataset.proStudioHook = 'true';
      element.addEventListener('input', () => updateStudioPreview(modal));
      element.addEventListener('change', () => {
        updateStudioPreview(modal);
        const settings = currentStudioSettings();
        activeModel = settings.model;
        if (settings.saveDefaults) persistSettings(settings);
      });
    });
  }

  function previewTeams() {
    const phaseIndex = Number(inputValue('#artPhase', '0'));
    const phase = $$('.gi-phase')[phaseIndex] || $('.gi-phase');
    const cards = $$('.gi-game', phase).slice(0, 2);
    if (!cards.length) return [{ a: 'Time A', b: 'Time B', sa: '–', sb: '–' }];
    return cards.map(card => {
      const teams = $$('.gi-team', card);
      const name = team => $('strong', team)?.textContent?.trim() || 'A definir';
      const score = team => $('input[type="number"]', team)?.value || $('.gi-score', team)?.textContent?.trim() || '–';
      return { a: name(teams[0]), b: name(teams[1]), sa: score(teams[0]), sb: score(teams[1]) };
    });
  }

  function competitionTheme() {
    return window.ArenaBDACompetitionThemes?.get?.(championshipName()) || {
      primary: '#d3a93a', soft: '#f5dc86', secondary: '#58e59a', bg: '#020503', bg2: '#07140d', text: '#f7faf6', muted: '#a8bbb0'
    };
  }

  function updateStudioPreview(modal = $('#artConfigurator')) {
    if (!modal) return;
    const mock = $('#artFormatMock', modal);
    if (!mock) return;
    const settings = currentStudioSettings();
    const theme = competitionTheme();
    const phaseName = $('#artPhase option:checked', modal)?.textContent?.split('•')[0]?.trim() || 'Fase oficial';
    const logo = window.ArenaBDALeagueLogo?.get?.(championshipName())?.logo || '';
    const games = previewTeams();
    activeModel = settings.model;

    mock.dataset.model = settings.model;
    mock.dataset.zoom = settings.zoom;
    mock.style.setProperty('--preview-primary', theme.primary || '#d3a93a');
    mock.style.setProperty('--preview-soft', theme.soft || '#f5dc86');
    mock.style.setProperty('--preview-secondary', theme.secondary || '#58e59a');
    mock.style.setProperty('--preview-bg', theme.bg || '#020503');
    mock.style.setProperty('--preview-bg2', theme.bg2 || '#07140d');
    mock.innerHTML = `<header>${settings.showLeagueLogo ? `<span>${logo ? `<img src="${esc(logo)}" alt="Logo">` : '🏆'}</span>` : ''}<div><small>${esc(championshipName())}</small><b>${esc(phaseName)}</b></div>${settings.showArenaLogo ? '<i>🦅</i>' : ''}</header><main>${games.map(game => `<article><div><b>${esc(game.a)}</b><strong>${esc(game.sa)}</strong></div><div><b>${esc(game.b)}</b><strong>${esc(game.sb)}</strong></div></article>`).join('')}</main><footer>Prévia em tempo real</footer>`;

    const batch = $('#artBatchMode', modal);
    if (batch) {
      const enabled = settings.scope === 'all';
      batch.disabled = !enabled;
      if (!enabled) batch.value = 'none';
      batch.closest('.art-batch-mode')?.classList.toggle('disabled', !enabled);
    }
  }

  function applyModelToStage(stage) {
    if (!stage || stage.dataset.proModelApplied === 'true') return;
    const saved = savedSettings();
    const model = activeModel || saved.model || 'automatic';
    stage.dataset.proModelApplied = 'true';
    stage.dataset.artModel = model;
  }

  function waitForElement(selector, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const existing = $(selector);
      if (existing) return resolve(existing);
      const observer = new MutationObserver(() => {
        const element = $(selector);
        if (!element) return;
        clearTimeout(timer);
        observer.disconnect();
        resolve(element);
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Tempo esgotado para ${selector}`));
      }, timeout);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  async function waitUntilGone(selector, timeout = 15000) {
    const start = Date.now();
    while ($(selector)) {
      if (Date.now() - start > timeout) break;
      await wait(120);
    }
  }

  function configureBatchModal(modal, settings, mode) {
    const values = {
      '#artScope': mode,
      '#artFormat': settings.format,
      '#artQuality': settings.quality,
      '#artZoom': settings.zoom,
      '#artModel': settings.model
    };
    Object.entries(values).forEach(([selector, value]) => {
      const element = $(selector, modal);
      if (element && value) {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    if ($('#artShowLeagueLogo', modal)) $('#artShowLeagueLogo', modal).checked = settings.showLeagueLogo;
    if ($('#artShowArenaLogo', modal)) $('#artShowArenaLogo', modal).checked = settings.showArenaLogo;
    if ($('#artBatchMode', modal)) $('#artBatchMode', modal).value = 'none';
  }

  async function exportBatch(type, settings) {
    if (batchBusy) return;
    const buttons = type === 'games' ? $$('.pro-game-photo') : $$('.pro-phase-photo');
    const usable = buttons.filter(button => button.closest('.gi-game,.gi-phase'));
    if (!usable.length) return notify('Nenhum item disponível para exportar');
    batchBusy = true;
    $('#artConfigurator [data-art-config-close]')?.click();
    notify(`Preparando ${usable.length} imagens...`);
    try {
      for (const [index, button] of usable.entries()) {
        notify(`Gerando ${index + 1} de ${usable.length}`);
        button.click();
        const modal = await waitForElement('#artConfigurator', 12000);
        await wait(80);
        configureBatchModal(modal, settings, type === 'games' ? 'single' : 'phase');
        $('#artConfigForm', modal)?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        const preview = await waitForElement('#artCapturePreview', 60000);
        await wait(500);
        $('[data-art-download]', preview)?.click();
        await wait(700);
        $('[data-art-preview-close]', preview)?.click();
        await waitUntilGone('#artCapturePreview');
        await wait(300);
      }
      notify('Exportação em lote concluída');
    } catch (error) {
      console.error(error);
      notify('Não foi possível concluir todas as imagens');
    } finally {
      batchBusy = false;
    }
  }

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('#artConfigForm');
    if (!form || batchBusy) return;
    const settings = currentStudioSettings();
    activeModel = settings.model;
    if (settings.saveDefaults) persistSettings(settings);
    if (settings.scope === 'all' && ['phases', 'games'].includes(settings.batch)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportBatch(settings.batch, settings);
    }
  }, true);

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

  function backgroundReference(image) {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const samples = [];
    for (let x = 0; x < size; x += 4) {
      samples.push((x * 4), ((size - 1) * size + x) * 4);
    }
    for (let y = 0; y < size; y += 4) {
      samples.push((y * size) * 4, (y * size + size - 1) * 4);
    }
    let r = 0, g = 0, b = 0;
    samples.forEach(index => { r += data[index]; g += data[index + 1]; b += data[index + 2]; });
    const count = Math.max(1, samples.length);
    return [r / count, g / count, b / count];
  }

  function openImageEditor(type, file) {
    return new Promise(async (resolve, reject) => {
      try {
        const source = await readFile(file);
        const image = await loadImage(source);
        const isLogo = type === 'logo';
        const initialRatio = isLogo ? '1:1' : '16:9';
        const state = {
          type,
          source,
          image,
          zoom: 1,
          rotation: 0,
          x: 0,
          y: 0,
          ratio: initialRatio,
          shape: isLogo ? 'square' : 'rectangle',
          removeBackground: false,
          threshold: 55,
          reference: backgroundReference(image),
          dragging: false,
          pointerX: 0,
          pointerY: 0
        };

        const modal = document.createElement('div');
        modal.className = 'media-editor-modal';
        modal.innerHTML = `<section><header><div><span class="eyebrow">Editor visual</span><h2>${isLogo ? 'Ajustar logo' : 'Ajustar banner'}</h2><p>Arraste a imagem, aproxime, gire e recorte antes de salvar.</p></div><button type="button" data-media-close>×</button></header><main><div class="media-editor-stage"><canvas id="mediaEditorCanvas" width="760" height="760"></canvas><span class="media-safe-area">Área segura</span></div><aside><label>Zoom<input id="mediaZoom" type="range" min="0.35" max="3" step="0.01" value="1"></label><label>Giro<input id="mediaRotation" type="range" min="-180" max="180" step="1" value="0"></label><label>Recorte<select id="mediaRatio">${isLogo ? '<option value="1:1">Quadrado 1:1</option><option value="4:5">Vertical 4:5</option>' : '<option value="16:9">Horizontal 16:9</option><option value="4:5">Post 4:5</option><option value="1:1">Quadrado 1:1</option><option value="9:16">Story 9:16</option>'}</select></label>${isLogo ? '<label>Formato<select id="mediaShape"><option value="square">Quadrado transparente</option><option value="circle">Circular</option></select></label>' : ''}<label class="media-remove-bg"><input id="mediaRemoveBg" type="checkbox"><span><b>Remover fundo simples</b><small>Funciona melhor em fundos lisos. Ajuste a tolerância abaixo.</small></span></label><label id="mediaThresholdWrap" hidden>Tolerância<input id="mediaThreshold" type="range" min="10" max="180" step="1" value="55"></label><div class="media-editor-actions"><button type="button" class="ghost" id="mediaCenter">Centralizar</button><button type="button" class="ghost" id="mediaReset">Restaurar</button></div></aside></main><footer><button class="secondary" type="button" data-media-close>Cancelar</button><button class="primary" type="button" id="mediaApply">Aplicar imagem</button></footer></section>`;
        document.body.append(modal);
        document.body.classList.add('media-editor-open');

        const canvas = $('#mediaEditorCanvas', modal);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        function dimensions(ratio) {
          const [w, h] = ratio.split(':').map(Number);
          const max = 760;
          return w >= h ? [max, Math.round(max * h / w)] : [Math.round(max * w / h), max];
        }

        function processedImage() {
          if (!state.removeBackground) return state.image;
          const max = 1000;
          const scale = Math.min(1, max / Math.max(state.image.width, state.image.height));
          const temp = document.createElement('canvas');
          temp.width = Math.max(1, Math.round(state.image.width * scale));
          temp.height = Math.max(1, Math.round(state.image.height * scale));
          const tctx = temp.getContext('2d', { willReadFrequently: true });
          tctx.drawImage(state.image, 0, 0, temp.width, temp.height);
          const imageData = tctx.getImageData(0, 0, temp.width, temp.height);
          const data = imageData.data;
          const [rr, rg, rb] = state.reference;
          for (let i = 0; i < data.length; i += 4) {
            const distance = Math.hypot(data[i] - rr, data[i + 1] - rg, data[i + 2] - rb);
            const alpha = Math.max(0, Math.min(255, (distance - state.threshold + 25) * 10.2));
            if (distance < state.threshold + 25) data[i + 3] = Math.min(data[i + 3], alpha);
          }
          tctx.putImageData(imageData, 0, 0);
          return temp;
        }

        function draw() {
          const [width, height] = dimensions(state.ratio);
          canvas.width = width;
          canvas.height = height;
          const sourceImage = processedImage();
          ctx.clearRect(0, 0, width, height);
          ctx.save();
          if (state.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 2, 0, Math.PI * 2);
            ctx.clip();
          }
          ctx.translate(width / 2 + state.x, height / 2 + state.y);
          ctx.rotate(state.rotation * Math.PI / 180);
          const cover = Math.max(width / sourceImage.width, height / sourceImage.height);
          const scale = cover * state.zoom;
          ctx.drawImage(sourceImage, -sourceImage.width * scale / 2, -sourceImage.height * scale / 2, sourceImage.width * scale, sourceImage.height * scale);
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = 'rgba(245,220,134,.75)';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 8]);
          const pad = Math.max(16, Math.min(width, height) * .06);
          if (state.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - pad, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
          }
          ctx.restore();
          $('.media-editor-stage', modal).style.aspectRatio = `${width}/${height}`;
        }

        function reset() {
          state.zoom = 1;
          state.rotation = 0;
          state.x = 0;
          state.y = 0;
          state.removeBackground = false;
          state.threshold = 55;
          $('#mediaZoom', modal).value = '1';
          $('#mediaRotation', modal).value = '0';
          $('#mediaRemoveBg', modal).checked = false;
          $('#mediaThreshold', modal).value = '55';
          $('#mediaThresholdWrap', modal).hidden = true;
          draw();
        }

        function close(value, error) {
          modal.remove();
          document.body.classList.remove('media-editor-open');
          if (error) reject(error);
          else resolve(value);
        }

        canvas.addEventListener('pointerdown', event => {
          state.dragging = true;
          state.pointerX = event.clientX;
          state.pointerY = event.clientY;
          canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointermove', event => {
          if (!state.dragging) return;
          const rect = canvas.getBoundingClientRect();
          state.x += (event.clientX - state.pointerX) * canvas.width / rect.width;
          state.y += (event.clientY - state.pointerY) * canvas.height / rect.height;
          state.pointerX = event.clientX;
          state.pointerY = event.clientY;
          draw();
        });
        canvas.addEventListener('pointerup', () => { state.dragging = false; });
        canvas.addEventListener('pointercancel', () => { state.dragging = false; });
        canvas.addEventListener('wheel', event => {
          event.preventDefault();
          state.zoom = Math.max(.35, Math.min(3, state.zoom + (event.deltaY < 0 ? .08 : -.08)));
          $('#mediaZoom', modal).value = String(state.zoom);
          draw();
        }, { passive: false });

        $('#mediaZoom', modal).addEventListener('input', event => { state.zoom = Number(event.target.value); draw(); });
        $('#mediaRotation', modal).addEventListener('input', event => { state.rotation = Number(event.target.value); draw(); });
        $('#mediaRatio', modal).addEventListener('change', event => { state.ratio = event.target.value; state.x = 0; state.y = 0; draw(); });
        $('#mediaShape', modal)?.addEventListener('change', event => { state.shape = event.target.value; draw(); });
        $('#mediaRemoveBg', modal).addEventListener('change', event => { state.removeBackground = event.target.checked; $('#mediaThresholdWrap', modal).hidden = !state.removeBackground; draw(); });
        $('#mediaThreshold', modal).addEventListener('input', event => { state.threshold = Number(event.target.value); draw(); });
        $('#mediaCenter', modal).addEventListener('click', () => { state.x = 0; state.y = 0; draw(); });
        $('#mediaReset', modal).addEventListener('click', reset);
        $$('[data-media-close]', modal).forEach(button => button.addEventListener('click', () => close(null)));
        modal.addEventListener('click', event => { if (event.target === modal) close(null); });
        $('#mediaApply', modal).addEventListener('click', () => {
          const [rw, rh] = state.ratio.split(':').map(Number);
          const outputWidth = isLogo ? 720 : (rw >= rh ? 1600 : Math.round(1600 * rw / rh));
          const outputHeight = isLogo ? Math.round(outputWidth * rh / rw) : (rw >= rh ? Math.round(1600 * rh / rw) : 1600);
          const output = document.createElement('canvas');
          output.width = outputWidth;
          output.height = outputHeight;
          const octx = output.getContext('2d');
          const sourceImage = processedImage();
          if (state.shape === 'circle') {
            octx.beginPath();
            octx.arc(outputWidth / 2, outputHeight / 2, Math.min(outputWidth, outputHeight) / 2, 0, Math.PI * 2);
            octx.clip();
          }
          octx.translate(outputWidth / 2 + state.x * outputWidth / canvas.width, outputHeight / 2 + state.y * outputHeight / canvas.height);
          octx.rotate(state.rotation * Math.PI / 180);
          const cover = Math.max(outputWidth / sourceImage.width, outputHeight / sourceImage.height);
          const scale = cover * state.zoom;
          octx.drawImage(sourceImage, -sourceImage.width * scale / 2, -sourceImage.height * scale / 2, sourceImage.width * scale, sourceImage.height * scale);
          close(output.toDataURL('image/webp', .92));
        });

        draw();
      } catch (error) {
        reject(error);
      }
    });
  }

  function updateMediaPreview(type, dataUrl) {
    const root = type === 'logo' ? $('#tLeagueLogoPreview') : $('#tBannerPreview');
    if (!root) return;
    if (type === 'logo') {
      root.innerHTML = `<div><img src="${esc(dataUrl)}" alt="Logo ajustado"></div><span>Logo ajustado no editor visual e pronto para salvar.</span><button type="button" class="danger" data-pro-clear-media="logo">Remover logo</button>`;
    } else {
      root.innerHTML = `<div><img src="${esc(dataUrl)}" alt="Banner ajustado"></div><span>Banner recortado e pronto para aparecer no campeonato.</span><button type="button" class="danger" data-pro-clear-media="banner">Remover banner</button>`;
    }
  }

  document.addEventListener('change', async event => {
    const input = event.target.closest?.('#tLeagueLogo,#tBanner');
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const type = input.id === 'tLeagueLogo' ? 'logo' : 'banner';
    try {
      const edited = await openImageEditor(type, file);
      if (!edited) {
        input.value = '';
        return;
      }
      pendingTournamentMedia[type] = edited;
      updateMediaPreview(type, edited);
      notify(type === 'logo' ? 'Logo ajustado' : 'Banner ajustado');
    } catch (error) {
      console.error(error);
      input.value = '';
      notify(error.message || 'Não foi possível editar a imagem');
    }
  }, true);

  document.addEventListener('click', event => {
    const edit = event.target.closest?.('[data-edit-tournament]');
    if (edit) {
      editingTournamentId = edit.dataset.editTournament;
      pendingTournamentMedia = { logo: null, banner: null };
    }
    if (event.target.closest?.('#createTournamentBtn,#adminCreateTournamentBtn,#panelCreateTournament')) {
      editingTournamentId = null;
      pendingTournamentMedia = { logo: null, banner: null };
    }
    const clear = event.target.closest?.('[data-pro-clear-media]');
    if (clear) {
      const type = clear.dataset.proClearMedia;
      pendingTournamentMedia[type] = '';
      const root = type === 'logo' ? $('#tLeagueLogoPreview') : $('#tBannerPreview');
      if (root) root.innerHTML = `<div>${type === 'logo' ? 'LOGO' : 'Prévia do banner'}</div><span>A imagem será removida ao salvar.</span>`;
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('#tournamentForm');
    if (!form) return;
    const name = $('#tName')?.value?.trim() || '';
    const media = { ...pendingTournamentMedia };
    const id = editingTournamentId;
    setTimeout(() => {
      const items = readJSON(STORAGE_TOURNAMENTS, []);
      if (!Array.isArray(items)) return;
      let item = id ? items.find(entry => entry.id === id) : null;
      if (!item) item = items.find(entry => norm(entry.name) === norm(name));
      if (!item) return;
      if (media.logo !== null) item.logo = media.logo;
      if (media.banner !== null) item.banner = media.banner;
      writeJSON(STORAGE_TOURNAMENTS, items);
      window.dispatchEvent(new CustomEvent('arena:tournament-logo-updated'));
      pendingTournamentMedia = { logo: null, banner: null };
      editingTournamentId = null;
    }, 140);
  }, true);

  function enhance() {
    scheduled = false;
    const modal = $('#artConfigurator');
    if (modal) injectStudioControls(modal);
    $$('.art-shot-stage').forEach(applyModelToStage);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  const style = document.createElement('style');
  style.textContent = `
    .art-save-defaults,.art-batch-mode{display:flex!important;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.045);text-transform:none!important;letter-spacing:0!important}.art-save-defaults input{width:auto;min-height:0}.art-save-defaults b,.art-save-defaults small{display:block}.art-save-defaults b{color:var(--gold-soft);font-size:11px}.art-save-defaults small,.art-batch-mode small{margin-top:4px;color:var(--muted);font-size:8px;line-height:1.45}.art-batch-mode{display:grid!important;grid-template-columns:1fr 220px;align-items:end}.art-batch-mode.disabled{opacity:.55}.art-batch-mode select{min-height:40px}
    .art-config-preview>div{padding:12px!important;align-content:stretch!important;gap:8px!important}.art-config-preview>div>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.12)}.art-config-preview>div>header>span,.art-config-preview>div>header>i{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--preview-soft);border-radius:12px;background:var(--preview-bg);font-style:normal;font-size:22px}.art-config-preview>div>header img{max-width:34px!important;max-height:34px!important}.art-config-preview>div>header small,.art-config-preview>div>header b{display:block}.art-config-preview>div>header small{color:var(--preview-soft);font-size:7px;text-transform:uppercase}.art-config-preview>div>header b{color:#fff;font-size:12px;text-transform:uppercase}.art-config-preview>div>main{display:grid;gap:7px}.art-config-preview>div>main article{overflow:hidden;border:1px solid color-mix(in srgb,var(--preview-soft) 26%,transparent);border-radius:11px;background:linear-gradient(145deg,var(--preview-bg2),var(--preview-bg))}.art-config-preview>div>main article>div{display:grid;grid-template-columns:1fr 34px;align-items:center;gap:6px;min-height:36px;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.07)}.art-config-preview>div>main article>div:last-child{border-bottom:0}.art-config-preview>div>main b{overflow:hidden;color:#eef5f0;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.art-config-preview>div>main strong{display:grid;place-items:center;width:32px;height:28px;border-radius:8px;color:var(--preview-soft);background:#010301;font-size:13px}.art-config-preview>div>footer{color:var(--preview-soft);font-size:7px;text-align:center;text-transform:uppercase;letter-spacing:.12em}
    .art-config-preview>div[data-model=classic]{border-width:2px!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--preview-soft) 9%,transparent),0 18px 42px #0008!important}.art-config-preview>div[data-model=neon]{filter:saturate(1.25);box-shadow:0 0 34px color-mix(in srgb,var(--preview-primary) 55%,transparent),0 18px 42px #0008!important}.art-config-preview>div[data-model=final]:after{content:"FINAL";position:absolute;right:-6px;bottom:-22px;color:rgba(255,255,255,.08);font:900 70px/1 "Barlow Condensed",sans-serif}.art-config-preview>div[data-model=minimal]{background:var(--preview-bg)!important;box-shadow:none!important}.art-config-preview>div[data-model=minimal] main article{background:transparent!important}
    .art-shot-stage[data-art-model=classic] .art-shot-header{border-width:3px!important}.art-shot-stage[data-art-model=classic] .art-phase-block,.art-shot-stage[data-art-model=classic] .art-single-game{border-width:2px!important}.art-shot-stage[data-art-model=neon]{filter:saturate(1.17)}.art-shot-stage[data-art-model=neon] .art-shot-header,.art-shot-stage[data-art-model=neon] .art-team-badge,.art-shot-stage[data-art-model=neon] .art-main-score>span{box-shadow:0 0 34px var(--art-glow)!important}.art-shot-stage[data-art-model=final] .art-shot-title h1{font-size:1.15em!important}.art-shot-stage[data-art-model=final] .art-shot-header:before{content:"🏆";position:absolute;right:25px;top:25px;font-size:82px;opacity:.13}.art-shot-stage[data-art-model=minimal]{background:var(--art-bg)!important}.art-shot-stage[data-art-model=minimal] .art-shot-header,.art-shot-stage[data-art-model=minimal] .art-phase-block,.art-shot-stage[data-art-model=minimal] .art-single-game,.art-shot-stage[data-art-model=minimal] .art-game-card{box-shadow:none!important;background:var(--art-surface-2)!important}
    .media-editor-modal{position:fixed;inset:0;z-index:230;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.90);backdrop-filter:blur(15px)}.media-editor-modal>section{overflow:auto;width:min(1050px,100%);max-height:96vh;border:1px solid rgba(245,220,134,.40);border-radius:26px;background:radial-gradient(circle at 100% 0,rgba(245,220,134,.13),transparent 30%),linear-gradient(150deg,#153421,#050c08);box-shadow:0 35px 110px #000d}.media-editor-modal>section>header{display:flex;align-items:start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid var(--line)}.media-editor-modal h2{margin:5px 0 2px;font-size:32px;text-transform:uppercase}.media-editor-modal header p{margin:0;color:var(--muted);font-size:9px}.media-editor-modal header>button{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;color:#fff;background:#ffffff08;font-size:24px}.media-editor-modal main{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:15px;padding:16px}.media-editor-stage{position:relative;overflow:hidden;display:grid;place-items:center;min-height:320px;border:1px solid rgba(245,220,134,.32);border-radius:20px;background:repeating-conic-gradient(#17241c 0 25%,#0f1b14 0 50%) 50%/24px 24px;touch-action:none}.media-editor-stage canvas{display:block;max-width:100%;max-height:68vh;cursor:grab;touch-action:none}.media-editor-stage canvas:active{cursor:grabbing}.media-safe-area{position:absolute;left:12px;bottom:10px;padding:5px 8px;border-radius:999px;color:#f5dc86;background:#020503c9;font-size:8px;font-weight:900;text-transform:uppercase}.media-editor-modal aside{display:grid;align-content:start;gap:11px}.media-editor-modal aside label{display:grid;gap:6px}.media-remove-bg{display:flex!important;align-items:flex-start;gap:9px;padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff05;text-transform:none!important;letter-spacing:0!important}.media-remove-bg input{width:auto;min-height:0}.media-remove-bg b,.media-remove-bg small{display:block}.media-remove-bg b{color:var(--gold-soft);font-size:10px}.media-remove-bg small{margin-top:4px;color:var(--muted);font-size:8px;line-height:1.4}.media-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.media-editor-modal>section>footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 17px;border-top:1px solid var(--line)}.media-editor-open,.art-preview-open,.art-config-open{overflow:hidden}
    @media(max-width:760px){.art-batch-mode{grid-template-columns:1fr}.media-editor-modal main{grid-template-columns:1fr}.media-editor-stage canvas{max-height:48vh}.media-editor-modal>section>footer{display:grid;grid-template-columns:1fr 1fr}.media-editor-modal>section>footer button{width:100%}}
  `;
  document.head.append(style);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();
})();
