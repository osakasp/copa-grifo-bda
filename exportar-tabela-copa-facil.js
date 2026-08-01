(() => {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const PREF_KEY = 'arena-bda-table-export-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const slug = value => norm(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'classificacao-arena-bda';
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let observer = null;
  let timer = 0;
  let busy = false;
  let previewTimer = 0;
  let generatedUrl = '';

  function defaults() {
    return {
      type: 'classic',
      width: 'dynamic',
      theme: 'automatic',
      accent: '#167329',
      title: '',
      showTitle: true,
      compact: false,
      showCover: true,
      showGroups: true,
      showBadges: true
    };
  }

  function preferences() {
    try {
      return { ...defaults(), ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
    } catch {
      return defaults();
    }
  }

  function savePreferences(settings) {
    localStorage.setItem(PREF_KEY, JSON.stringify(settings));
  }

  function tournamentData() {
    const manager = $('#giManager');
    const id = manager?.dataset.tid || '';
    const name = $('.gi-head h2', manager)?.textContent?.trim() || 'Campeonato BDA';
    try {
      const list = JSON.parse(localStorage.getItem('bda-v3-tournaments') || '[]');
      const item = Array.isArray(list)
        ? list.find(entry => entry?.id === id || norm(entry?.name) === norm(name))
        : null;
      const league = window.ArenaBDALeagueLogo?.get?.(name);
      return {
        id,
        name,
        edition: item?.edition || league?.edition || '',
        banner: item?.banner || '',
        logo: league?.logo || item?.logo || '',
        badge: league?.badge || item?.badge || '🏆'
      };
    } catch {
      return { id, name, edition: '', banner: '', logo: '', badge: '🏆' };
    }
  }

  function loadCapture() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === CDN);
      if (existing) {
        if (window.html2canvas) return resolve(window.html2canvas);
        existing.addEventListener('load', () => resolve(window.html2canvas), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.onload = () => window.html2canvas
        ? resolve(window.html2canvas)
        : reject(new Error('Captura indisponível'));
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function settingsFromForm() {
    const modal = $('#tableExportStudio');
    const saved = preferences();
    if (!modal) return saved;
    return {
      type: $('#tableExportType', modal)?.value || saved.type,
      width: $('#tableExportWidth', modal)?.value || saved.width,
      theme: $('#tableExportTheme', modal)?.value || saved.theme,
      accent: $('#tableExportAccent', modal)?.value || saved.accent,
      title: $('#tableExportTitle', modal)?.value.trim() || '',
      showTitle: Boolean($('#tableExportShowTitle', modal)?.checked),
      compact: Boolean($('#tableExportCompact', modal)?.checked),
      showCover: Boolean($('#tableExportShowCover', modal)?.checked),
      showGroups: Boolean($('#tableExportShowGroups', modal)?.checked),
      showBadges: Boolean($('#tableExportShowBadges', modal)?.checked)
    };
  }

  function colors(settings, data) {
    if (settings.theme === 'custom') {
      return { main: settings.accent || '#167329', dark: '#06150b', soft: '#dff7e4', ink: '#172119' };
    }
    if (settings.theme === 'blue' || (settings.theme === 'automatic' && norm(data.name).includes('francos'))) {
      return { main: '#075dca', dark: '#041226', soft: '#e8f3ff', ink: '#122033' };
    }
    if (settings.theme === 'black') {
      return { main: '#1f2630', dark: '#050607', soft: '#f0f3f6', ink: '#11151a' };
    }
    return { main: '#167329', dark: '#06150b', soft: '#eaf8ed', ink: '#172119' };
  }

  function outputWidth(settings) {
    if (settings.width === 'wide') return 1350;
    if (settings.width === 'social') return 1080;
    const groupCount = $$('#standCapture .stand-group').length;
    return groupCount > 1 ? 1180 : 1020;
  }

  function prepareClone(settings) {
    const source = $('#standCapture');
    if (!source) return null;
    const clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('table-export-content');

    const groups = $$('.stand-group', clone);
    if (!settings.showGroups && groups.length > 1) groups.slice(1).forEach(group => group.remove());
    if (!settings.showBadges) $$('.stand-badge', clone).forEach(badge => badge.remove());
    if (settings.compact) clone.classList.add('is-compact');
    return clone;
  }

  function logoHtml(data) {
    if (data.logo) return `<span class="table-export-logo"><img src="${esc(data.logo)}" alt="Logo de ${esc(data.name)}"></span>`;
    return `<span class="table-export-logo fallback">${esc(data.badge || '🏆')}</span>`;
  }

  function buildStage(settings, exportMode = false) {
    const data = tournamentData();
    const palette = colors(settings, data);
    const width = outputWidth(settings);
    const clone = prepareClone(settings);
    if (!clone) return null;

    const stage = document.createElement('section');
    stage.className = `table-export-stage type-${settings.type}`;
    if (exportMode) stage.classList.add('is-export');
    stage.style.width = `${width}px`;
    stage.style.setProperty('--table-main', palette.main);
    stage.style.setProperty('--table-dark', palette.dark);
    stage.style.setProperty('--table-soft', palette.soft);
    stage.style.setProperty('--table-ink', palette.ink);
    if (settings.showCover && data.banner) {
      stage.style.setProperty('--table-cover', `url("${String(data.banner).replace(/"/g, '%22')}")`);
      stage.classList.add('has-cover');
    }

    const title = settings.title || data.name;
    stage.innerHTML = `
      <header class="table-export-header">
        <div class="table-export-brand">${logoHtml(data)}<div><small>${esc(data.edition || 'CLASSIFICAÇÃO OFICIAL')}</small><h1>${esc(title)}</h1></div></div>
        <span class="table-export-platform">ARENA BDA</span>
      </header>
      <main class="table-export-main"></main>
      <footer class="table-export-footer"><b>BOLEIROS DE ATITUDE</b><span>Atualização automática da competição</span></footer>`;

    if (!settings.showTitle) $('.table-export-brand>div', stage)?.remove();
    $('.table-export-main', stage).append(clone);
    return stage;
  }

  function fitPreview() {
    const viewport = $('#tableExportPreview');
    const stage = $('.table-export-stage', viewport);
    if (!viewport || !stage) return;
    const naturalWidth = Number.parseFloat(stage.style.width) || 1080;
    const available = Math.max(260, viewport.clientWidth - 14);
    const scale = Math.min(0.68, available / naturalWidth);
    stage.style.transform = `scale(${scale})`;
    stage.style.transformOrigin = 'top center';
    viewport.style.height = `${Math.ceil(stage.scrollHeight * scale + 12)}px`;
  }

  function renderPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const viewport = $('#tableExportPreview');
      if (!viewport) return;
      const settings = settingsFromForm();
      savePreferences(settings);
      viewport.innerHTML = '';
      const stage = buildStage(settings);
      if (stage) viewport.append(stage);
      requestAnimationFrame(fitPreview);
    }, 40);
  }

  function closeReady() {
    $('#tableExportReady')?.remove();
    if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    generatedUrl = '';
  }

  function closeStudio() {
    closeReady();
    $('#tableExportStudio')?.remove();
    document.body.classList.remove('table-export-open');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function showReady(blob, filename, shareNow = false) {
    closeReady();
    generatedUrl = URL.createObjectURL(blob);
    const ready = document.createElement('div');
    ready.id = 'tableExportReady';
    ready.className = 'table-export-ready';
    ready.innerHTML = `<section><header><div><small>IMAGEM PRONTA</small><h2>Tabela da classificação</h2></div><button type="button" data-table-ready-close>×</button></header><main><img src="${generatedUrl}" alt="Tabela da classificação pronta"></main><footer><button type="button" class="secondary" data-table-ready-close>Voltar</button><button type="button" class="ghost" data-table-download>⬇ Baixar PNG</button><button type="button" class="primary" data-table-share>↗ Compartilhar</button></footer></section>`;
    document.body.append(ready);

    const share = async () => {
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'Classificação Arena BDA', text: 'Tabela oficial da competição', files: [file] });
        } else if (navigator.share) {
          await navigator.share({ title: 'Classificação Arena BDA', text: 'Tabela oficial da competição', url: location.href });
        } else {
          downloadBlob(blob, filename);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') notify('Não foi possível compartilhar a tabela');
      }
    };

    $$('[data-table-ready-close]', ready).forEach(button => button.addEventListener('click', closeReady));
    $('[data-table-download]', ready)?.addEventListener('click', () => downloadBlob(blob, filename));
    $('[data-table-share]', ready)?.addEventListener('click', share);
    if (shareNow) setTimeout(share, 80);
  }

  async function waitForImages(root) {
    await Promise.all($$('img', root).map(image => {
      if (image.complete && image.naturalWidth) return image.decode?.().catch(() => {}) || Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 3500);
      });
    }));
  }

  async function generate(shareNow = false) {
    if (busy) return;
    const settings = settingsFromForm();
    const stage = buildStage(settings, true);
    if (!stage) return notify('Abra a classificação antes de exportar');
    busy = true;
    stage.style.cssText += 'position:fixed;left:-16000px;top:0;z-index:-20;transform:none!important;';
    document.body.append(stage);
    notify('Preparando a imagem da tabela...');

    try {
      const html2canvas = await loadCapture();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(stage);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await html2canvas(stage, {
        backgroundColor: '#ffffff',
        scale: 1.35,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 10000,
        width: stage.scrollWidth,
        height: stage.scrollHeight,
        windowWidth: stage.scrollWidth,
        windowHeight: stage.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG')), 'image/png', 1));
      const filename = `${slug(`classificacao-${tournamentData().name}`)}-arena-bda.png`;
      showReady(blob, filename, shareNow);
      notify('Tabela pronta');
    } catch (error) {
      console.error(error);
      notify('Não foi possível gerar a imagem da tabela');
    } finally {
      stage.remove();
      busy = false;
    }
  }

  function openStudio() {
    if (!$('#standCapture .stand-group')) {
      notify('Abra a aba Classificação e aguarde a tabela aparecer');
      return;
    }
    closeStudio();
    const saved = preferences();
    const data = tournamentData();
    const modal = document.createElement('div');
    modal.id = 'tableExportStudio';
    modal.className = 'table-export-studio';
    modal.innerHTML = `<section>
      <header class="table-export-toolbar"><button type="button" data-table-close aria-label="Voltar">‹</button><h2>Tabela</h2><button type="button" data-table-share-now aria-label="Compartilhar">↗</button></header>
      <main class="table-export-layout">
        <section class="table-export-preview-panel"><div id="tableExportPreview"></div></section>
        <form id="tableExportForm">
          <label>Tipo<select id="tableExportType"><option value="classic" ${saved.type === 'classic' ? 'selected' : ''}>Opção 1</option><option value="premium" ${saved.type === 'premium' ? 'selected' : ''}>Opção 2</option><option value="minimal" ${saved.type === 'minimal' ? 'selected' : ''}>Minimalista</option></select></label>
          <label>Largura<select id="tableExportWidth"><option value="dynamic" ${saved.width === 'dynamic' ? 'selected' : ''}>Dinâmica</option><option value="social" ${saved.width === 'social' ? 'selected' : ''}>1080 px</option><option value="wide" ${saved.width === 'wide' ? 'selected' : ''}>1350 px</option></select></label>
          <label>Tema<select id="tableExportTheme"><option value="automatic" ${saved.theme === 'automatic' ? 'selected' : ''}>Automático</option><option value="green" ${saved.theme === 'green' ? 'selected' : ''}>Verde BDA</option><option value="blue" ${saved.theme === 'blue' ? 'selected' : ''}>Azul</option><option value="black" ${saved.theme === 'black' ? 'selected' : ''}>Preto e prata</option><option value="custom" ${saved.theme === 'custom' ? 'selected' : ''}>Cor personalizada</option></select></label>
          <label>Cor principal<input id="tableExportAccent" type="color" value="${esc(saved.accent || '#167329')}"></label>
          <label class="table-export-check"><input id="tableExportShowTitle" type="checkbox" ${saved.showTitle ? 'checked' : ''}><span>Título</span></label>
          <label class="wide">Texto do título<input id="tableExportTitle" maxlength="60" value="${esc(saved.title || data.name)}"></label>
          <label class="table-export-check"><input id="tableExportCompact" type="checkbox" ${saved.compact ? 'checked' : ''}><span>Compacto</span></label>
          <label class="table-export-check"><input id="tableExportShowCover" type="checkbox" ${saved.showCover ? 'checked' : ''}><span>Imagem de capa</span></label>
          <label class="table-export-check"><input id="tableExportShowGroups" type="checkbox" ${saved.showGroups ? 'checked' : ''}><span>Grupos</span></label>
          <label class="table-export-check"><input id="tableExportShowBadges" type="checkbox" ${saved.showBadges ? 'checked' : ''}><span>Escudos</span></label>
        </form>
      </main>
      <footer class="table-export-actions"><button class="secondary" type="button" data-table-close>Cancelar</button><button class="ghost" type="button" data-table-download-action>⬇ Baixar PNG</button><button class="primary" type="button" data-table-share-action>↗ Compartilhar</button></footer>
    </section>`;
    document.body.append(modal);
    document.body.classList.add('table-export-open');

    $('#tableExportForm', modal)?.addEventListener('input', renderPreview);
    $('#tableExportForm', modal)?.addEventListener('change', renderPreview);
    $$('[data-table-close]', modal).forEach(button => button.addEventListener('click', closeStudio));
    $('[data-table-download-action]', modal)?.addEventListener('click', () => generate(false));
    $('[data-table-share-action]', modal)?.addEventListener('click', () => generate(true));
    $('[data-table-share-now]', modal)?.addEventListener('click', () => generate(true));
    modal.addEventListener('click', event => event.target === modal && closeStudio());
    renderPreview();
  }

  function decorateButton() {
    const button = $('#standPhoto');
    if (!button || button.dataset.tableExporterReady === 'true') return;
    button.dataset.tableExporterReady = 'true';
    button.textContent = '⇩ Exportar tabela';
    button.title = 'Abrir editor de imagem da classificação';
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      decorateButton();
    }, 70);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#standPhoto');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openStudio();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('#tableExportReady')) closeReady();
    else if ($('#tableExportStudio')) closeStudio();
  });

  window.addEventListener('resize', () => requestAnimationFrame(fitPreview));

  const style = document.createElement('style');
  style.textContent = `
    #standPhoto{min-width:150px}
    .table-export-open{overflow:hidden!important}
    .table-export-studio,.table-export-ready{position:fixed;inset:0;z-index:65000;display:grid;place-items:center;overflow:auto;padding:10px;background:rgba(0,0,0,.86);backdrop-filter:blur(12px)}
    .table-export-studio>section{width:min(1040px,100%);max-height:96vh;overflow:auto;border-radius:5px;background:#f3f3f3;color:#1f2522;box-shadow:0 35px 100px #000c;text-align:left}
    .table-export-toolbar{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;min-height:52px;padding:0 8px;background:#167329;color:#fff}.table-export-toolbar h2{margin:0;font-size:15px}.table-export-toolbar button{display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:50%;color:#fff;background:transparent;font-size:22px;cursor:pointer}.table-export-toolbar button:last-child{justify-self:end}
    .table-export-layout{display:grid;grid-template-columns:minmax(430px,1.25fr) minmax(280px,.75fr);gap:0}.table-export-preview-panel{overflow:auto;display:grid;justify-content:center;min-height:570px;padding:28px 18px;background:#ededed}.table-export-preview-panel #tableExportPreview{overflow:hidden;display:grid;justify-content:center;width:100%;min-height:480px}.table-export-layout form{align-content:start;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:17px;background:#fff}.table-export-layout form label{display:grid;gap:5px;color:#353b37;font-size:9px;font-weight:700}.table-export-layout form label.wide{grid-column:1/-1}.table-export-layout form input,.table-export-layout form select{min-height:38px;padding:8px;border:1px solid #cfd5d1;border-radius:3px;color:#202622;background:#fff;font:inherit}.table-export-layout form input[type=color]{width:100%;padding:3px}.table-export-check{display:flex!important;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #ecefec}.table-export-check input{width:auto!important;min-height:0!important}.table-export-check span{font-size:9px}.table-export-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 15px;border-top:1px solid #d7dcd9;background:#fff}.table-export-actions button{min-height:39px}
    .table-export-stage{--table-cover:none;position:relative;overflow:hidden;box-sizing:border-box;padding:35px;background:#fff;color:var(--table-ink);font-family:Arial,sans-serif;box-shadow:0 12px 38px #0003}.table-export-stage *{box-sizing:border-box}.table-export-stage.has-cover:before{content:"";position:absolute;inset:0 0 auto;height:230px;background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.78)),var(--table-cover);background-size:cover;background-position:center;z-index:0}.table-export-header,.table-export-main,.table-export-footer{position:relative;z-index:1}.table-export-header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:105px;padding:18px 22px;border-radius:4px 4px 0 0;background:var(--table-main);color:#fff}.has-cover .table-export-header{min-height:165px;align-items:end;background:transparent}.table-export-brand{display:flex;align-items:center;gap:15px}.table-export-logo{overflow:hidden;display:grid;place-items:center;width:66px;height:66px;flex:0 0 auto;border:3px solid rgba(255,255,255,.55);border-radius:9px;background:#fff;color:var(--table-main);font-size:28px;font-weight:900}.table-export-logo img{width:100%;height:100%;object-fit:contain}.table-export-brand small,.table-export-brand h1{display:block}.table-export-brand small{font-size:9px;font-weight:900;letter-spacing:.12em}.table-export-brand h1{margin:5px 0 0;font-size:29px;line-height:1;text-transform:uppercase}.table-export-platform{font-size:10px;font-weight:900;letter-spacing:.14em}
    .table-export-main{padding:18px;background:#fff}.table-export-content{display:grid;gap:17px}.table-export-content .stand-group{overflow:hidden;margin:0!important;border:1px solid #dfe5e1!important;border-radius:3px!important;background:#fff!important;box-shadow:none!important}.table-export-content .stand-group>header{display:flex!important;align-items:center!important;justify-content:center!important;min-height:38px!important;padding:8px!important;border:0!important;background:#f7f8f8!important;color:#2a302c!important}.table-export-content .stand-group>header .eyebrow,.table-export-content .stand-group>header>span{display:none!important}.table-export-content .stand-group h3{margin:0!important;color:#2c342f!important;font-size:11px!important;text-transform:uppercase!important}.table-export-content .stand-scroll{overflow:visible!important}.table-export-content table{width:100%!important;min-width:0!important;border-collapse:collapse!important;table-layout:auto!important}.table-export-content th,.table-export-content td{height:auto!important;padding:7px 5px!important;border:1px solid #e2e6e3!important;color:#344038!important;background:#fff!important;font-size:8px!important;text-align:center!important}.table-export-content th{color:#243028!important;background:#f1f4f2!important;font-size:7px!important}.table-export-content th:nth-child(11),.table-export-content td:nth-child(11){display:none!important}.table-export-content tr.qualified{box-shadow:inset 4px 0 var(--table-main)!important}.table-export-content .stand-club{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;text-align:left!important}.table-export-content .stand-club>span{min-width:0}.table-export-content .stand-club b{overflow:hidden;display:block!important;color:#28332c!important;font-size:8px!important;text-overflow:ellipsis;white-space:nowrap}.table-export-content .stand-club small{display:none!important}.table-export-content .stand-badge{width:23px!important;height:23px!important;border:1px solid #d7dfda!important;border-radius:3px!important;background:#f5f7f6!important;color:#27342c!important;font-size:6px!important}.table-export-content .stand-pos{display:grid!important;place-items:center!important;width:20px!important;height:20px!important;border-radius:2px!important;color:#fff!important;background:var(--table-main)!important;font-size:8px!important}.table-export-content .stand-points{color:#172119!important;font-size:9px!important}.table-export-content .stand-form{display:none!important}.table-export-content.is-compact th,.table-export-content.is-compact td{padding:4px 3px!important;font-size:7px!important}.table-export-content.is-compact .stand-badge{width:18px!important;height:18px!important}.table-export-content.is-compact .stand-pos{width:17px!important;height:17px!important}
    .table-export-stage.type-premium{background:linear-gradient(150deg,var(--table-soft),#fff)}.table-export-stage.type-premium .table-export-main{background:transparent}.table-export-stage.type-premium .stand-group{box-shadow:0 10px 25px #0001!important}.table-export-stage.type-minimal{padding:22px;box-shadow:none}.table-export-stage.type-minimal .table-export-header{min-height:72px;padding:12px 16px}.table-export-stage.type-minimal .table-export-logo,.table-export-stage.type-minimal .table-export-platform{display:none}.table-export-stage.type-minimal .table-export-brand h1{font-size:22px}.table-export-stage.type-minimal .table-export-main{padding:10px 0}.table-export-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 20px;border-top:1px solid #e1e6e3;background:#f7f8f8;color:#657069;font-size:8px}.table-export-footer b{color:var(--table-main);font-size:9px}.table-export-stage.is-export{transform:none!important}
    .table-export-ready{z-index:65100}.table-export-ready>section{overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(900px,100%);max-height:95vh;border-radius:9px;background:#fff;color:#222;text-align:left}.table-export-ready header{display:flex;align-items:center;justify-content:space-between;padding:15px 17px;background:#167329;color:#fff}.table-export-ready header small{font-size:7px;letter-spacing:.14em}.table-export-ready header h2{margin:4px 0 0;font-size:18px}.table-export-ready header button{width:38px;height:38px;border:0;border-radius:50%;color:#fff;background:transparent;font-size:24px}.table-export-ready main{overflow:auto;display:grid;place-items:center;min-height:260px;padding:13px;background:#eceeed}.table-export-ready main img{display:block;max-width:100%;max-height:68vh;box-shadow:0 14px 40px #0004}.table-export-ready footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 14px;background:#fff}
    @media(max-width:820px){.table-export-studio{padding:4px}.table-export-studio>section{border-radius:4px}.table-export-layout{grid-template-columns:1fr}.table-export-preview-panel{min-height:390px;padding:15px 8px}.table-export-preview-panel #tableExportPreview{min-height:340px}.table-export-layout form{grid-template-columns:1fr 1fr}.table-export-actions{display:grid;grid-template-columns:1fr 1fr}.table-export-actions .primary{grid-column:1/-1}.table-export-actions button{width:100%}}
    @media(max-width:480px){.table-export-layout form{grid-template-columns:1fr}.table-export-layout form label.wide{grid-column:auto}.table-export-ready{padding:4px}.table-export-ready footer{display:grid;grid-template-columns:1fr 1fr}.table-export-ready footer .primary{grid-column:1/-1}.table-export-ready footer button{width:100%}}
  `;
  document.head.append(style);

  window.ArenaDOMEvents.subscribe(schedule, { selector: '#standPhoto,#autoStandings,.stand-group' });
  schedule();

  window.ArenaBDATableExporter = { open: openStudio, refresh: schedule, generate };
})();
