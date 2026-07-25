(() => {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const FORMATS = {
    square: { label: '1:1 Quadrado', width: 1080, height: 1080 },
    portrait: { label: '4:5 Post', width: 1080, height: 1350 },
    story: { label: '9:16 Story', width: 1080, height: 1920 },
    landscape: { label: '16:9 Horizontal', width: 1920, height: 1080 }
  };
  const QUALITIES = {
    hd: { label: 'HD', scale: 1 },
    twoK: { label: '2K', scale: 1.34 },
    fourK: { label: '4K', scale: 2 }
  };
  const ZOOMS = {
    wide: { label: 'Distante', scale: 0.86 },
    normal: { label: 'Médio', scale: 1 },
    close: { label: 'Próximo', scale: 1.13 },
    extreme: { label: 'Muito próximo', scale: 1.26 }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = value => String(value || 'jogos-bda').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jogos-bda';
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let busy = false;
  let previewUrl = '';
  let context = { mode: 'all', game: null, phase: null };
  let observerTimer = 0;

  function loadCapture() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === CDN);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.html2canvas), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('Captura indisponível'));
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function championshipName() {
    return $('#giManager .gi-head h2')?.textContent?.trim()
      || $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim()
      || 'Arena BDA';
  }

  function leagueInfo() {
    const name = championshipName();
    const api = window.ArenaBDALeagueLogo?.get?.(name);
    if (api) return { name, ...api };
    try {
      const items = JSON.parse(localStorage.getItem('bda-v3-tournaments')) || [];
      const item = items.find(entry => norm(entry.name) === norm(name));
      return { name, logo: item?.logo || '', banner: item?.banner || '', badge: item?.badge || '🏆', edition: item?.edition || '' };
    } catch {
      return { name, logo: '', banner: '', badge: '🏆', edition: '' };
    }
  }

  function arenaLogo() {
    return $('link[rel~="icon"]')?.href || './favicon.svg';
  }

  function initials(name) {
    return String(name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

  function teamData(element) {
    if (!element) return { name: 'A definir', detail: '', score: '–', image: '', badge: 'BDA', winner: false };
    const name = $('strong', element)?.textContent?.trim() || 'A definir';
    const detail = $('small', element)?.textContent?.trim() || '';
    const image = $('img', element)?.currentSrc || $('img', element)?.src || '';
    const badgeText = $('.gi-badge', element)?.textContent?.trim() || initials(name);
    const input = $('input[type="number"]', element);
    const visibleScore = $('.gi-score', element)?.textContent?.trim();
    const score = input ? (input.value === '' ? '–' : input.value) : (visibleScore || '–');
    return { name, detail, score, image, badge: badgeText, winner: element.classList.contains('winner') };
  }

  function gameData(card, phaseName = '') {
    const teams = $$('.gi-team', card).slice(0, 2).map(teamData);
    const header = $(':scope > header', card);
    return {
      phase: phaseName || card.closest('.gi-phase')?.querySelector('h3')?.textContent?.trim() || 'Confronto',
      status: $('span', header)?.textContent?.trim() || 'Agendado',
      meta: $('small', header)?.textContent?.trim() || 'Data a definir',
      aggregate: $('.gi-agg b', card)?.textContent?.trim() || '',
      note: $(':scope > p', card)?.textContent?.trim() || '',
      teams: teams.length === 2 ? teams : [teamData(), teamData()]
    };
  }

  function badgeHtml(team, large = false) {
    const className = `art-team-badge${large ? ' large' : ''}`;
    return team.image
      ? `<span class="${className}"><img src="${esc(team.image)}" alt="Escudo de ${esc(team.name)}"></span>`
      : `<span class="${className}">${esc(team.badge || initials(team.name))}</span>`;
  }

  function singleGameHtml(game) {
    const [a, b] = game.teams;
    return `<section class="art-single-game">
      <div class="art-status-row"><span>${esc(game.phase)}</span><b>${esc(game.status)}</b></div>
      <div class="art-single-versus">
        <article class="${a.winner ? 'winner' : ''}">${badgeHtml(a, true)}<h2>${esc(a.name)}</h2>${a.detail ? `<small>${esc(a.detail)}</small>` : ''}</article>
        <div class="art-main-score"><span>${esc(a.score)}</span><i>×</i><span>${esc(b.score)}</span><small>${esc(game.meta)}</small></div>
        <article class="${b.winner ? 'winner' : ''}">${badgeHtml(b, true)}<h2>${esc(b.name)}</h2>${b.detail ? `<small>${esc(b.detail)}</small>` : ''}</article>
      </div>
      ${game.aggregate ? `<div class="art-aggregate"><span>Placar agregado</span><b>${esc(game.aggregate)}</b></div>` : ''}
      ${game.note ? `<p class="art-game-note">${esc(game.note)}</p>` : ''}
    </section>`;
  }

  function compactGameHtml(game) {
    const [a, b] = game.teams;
    return `<article class="art-game-card">
      <header><span>${esc(game.status)}</span><small>${esc(game.meta)}</small></header>
      <div class="art-card-team ${a.winner ? 'winner' : ''}">${badgeHtml(a)}<b>${esc(a.name)}</b><strong>${esc(a.score)}</strong></div>
      <div class="art-card-team ${b.winner ? 'winner' : ''}">${badgeHtml(b)}<b>${esc(b.name)}</b><strong>${esc(b.score)}</strong></div>
      ${game.aggregate ? `<footer><span>Agregado</span><b>${esc(game.aggregate)}</b></footer>` : ''}
    </article>`;
  }

  function phaseHtml(name, games) {
    return `<section class="art-phase-block"><header><div><span>FASE OFICIAL</span><h2>${esc(name)}</h2></div><b>${games.length} ${games.length === 1 ? 'jogo' : 'jogos'}</b></header><main>${games.map(compactGameHtml).join('')}</main></section>`;
  }

  function phases() {
    return $$('.gi-phase').map((element, index) => ({
      element,
      index,
      name: $('h3', element)?.textContent?.trim() || `Fase ${index + 1}`,
      games: $$('.gi-game', element)
    })).filter(item => item.games.length);
  }

  function logoSlot(image, fallback, className, alt) {
    return image
      ? `<span class="${className}"><img src="${esc(image)}" alt="${esc(alt)}"></span>`
      : `<span class="${className} fallback">${esc(fallback)}</span>`;
  }

  function headerHtml(title, subtitle, settings) {
    const league = leagueInfo();
    const leagueSlot = settings.showLeagueLogo ? logoSlot(league.logo, league.badge || '🏆', 'art-league-logo', `Logo de ${league.name}`) : '';
    const arenaSlot = settings.showArenaLogo ? logoSlot(arenaLogo(), 'BDA', 'art-arena-logo', 'Logo Arena BDA') : '';
    return `<header class="art-shot-header">
      <div class="art-logos">${leagueSlot}<div><small>${esc(league.edition || 'COMPETIÇÃO OFICIAL')}</small><b>${esc(league.name)}</b></div>${arenaSlot}</div>
      <div class="art-shot-title"><span>ARENA BDA • BOLEIROS DE ATITUDE</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
    </header>`;
  }

  function createStage(title, subtitle, content, settings, kind) {
    const format = FORMATS[settings.format];
    const stage = document.createElement('section');
    stage.className = `art-shot-stage art-${kind}`;
    stage.dataset.format = settings.format;
    stage.dataset.zoom = settings.zoom;
    stage.style.cssText = `position:fixed;left:-18000px;top:0;width:${format.width}px;height:${format.height}px;z-index:-5;`;
    stage.innerHTML = `${headerHtml(title, subtitle, settings)}<div class="art-fit-viewport"><div class="art-fit-inner">${content}</div></div><footer class="art-shot-footer"><b>arenabda.com.br</b><span>Clã BDA • Competição oficial</span><small>${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}</small></footer>`;
    document.body.append(stage);
    return stage;
  }

  async function waitForImages(root) {
    await Promise.all($$('img', root).map(image => {
      if (image.complete && image.naturalWidth) return image.decode?.().catch(() => {}) || Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }));
  }

  function fitStage(stage, zoomName) {
    const viewport = $('.art-fit-viewport', stage);
    const inner = $('.art-fit-inner', stage);
    if (!viewport || !inner) return;
    inner.style.transform = 'none';
    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;
    const naturalWidth = inner.scrollWidth || availableWidth;
    const naturalHeight = inner.scrollHeight || availableHeight;
    const fit = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    const requested = ZOOMS[zoomName]?.scale || 1;
    const finalScale = Math.min(1.28, fit * requested);
    inner.style.transform = `scale(${finalScale})`;
    inner.style.transformOrigin = 'center top';
    inner.style.width = `${100 / finalScale}%`;
  }

  function closePreview() {
    $('#artCapturePreview')?.remove();
    document.body.classList.remove('art-preview-open');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
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

  function showPreview(blob, filename, title, canvas) {
    closePreview();
    previewUrl = URL.createObjectURL(blob);
    const modal = document.createElement('div');
    modal.id = 'artCapturePreview';
    modal.className = 'art-capture-preview';
    modal.innerHTML = `<section><header><div><span class="eyebrow">Arte pronta</span><h2>Prévia da imagem</h2><p>${canvas.width} × ${canvas.height}px • PNG</p></div><button type="button" data-art-preview-close>×</button></header><div class="art-preview-media"><img src="${previewUrl}" alt="Prévia de ${esc(title)}"></div><footer><button class="secondary" type="button" data-art-preview-close>Voltar</button><button class="ghost" type="button" data-art-download>⬇ Baixar PNG</button><button class="primary" type="button" data-art-share>↗ Compartilhar</button></footer></section>`;
    document.body.append(modal);
    document.body.classList.add('art-preview-open');
    $$('[data-art-preview-close]', modal).forEach(button => button.addEventListener('click', closePreview));
    $('[data-art-download]', modal)?.addEventListener('click', () => downloadBlob(blob, filename));
    $('[data-art-share]', modal)?.addEventListener('click', async () => {
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'Arena BDA', text: title, files: [file] });
        else if (navigator.share) await navigator.share({ title: 'Arena BDA', text: title, url: location.href });
        else downloadBlob(blob, filename);
      } catch (error) {
        if (error?.name !== 'AbortError') notify('Não foi possível compartilhar a imagem');
      }
    });
    modal.addEventListener('click', event => event.target === modal && closePreview());
  }

  async function renderStage(stage, title, filename, settings) {
    if (busy) return;
    busy = true;
    notify('Montando a arte...');
    try {
      const html2canvas = await loadCapture();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(stage);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      fitStage(stage, settings.zoom);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const format = FORMATS[settings.format];
      const quality = QUALITIES[settings.quality];
      const canvas = await html2canvas(stage, {
        backgroundColor: '#030805',
        scale: quality.scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        windowWidth: format.width,
        windowHeight: format.height,
        width: format.width,
        height: format.height,
        scrollX: 0,
        scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG')), 'image/png', 1));
      showPreview(blob, `${slug(filename)}-arena-bda.png`, title, canvas);
      closeConfigurator();
      notify('Arte pronta');
    } catch (error) {
      console.error(error);
      notify('Não foi possível gerar a arte dos jogos');
    } finally {
      stage.remove();
      busy = false;
    }
  }

  function settingsFromForm() {
    return {
      mode: $('#artScope')?.value || context.mode,
      phaseIndex: Number($('#artPhase')?.value || 0),
      format: $('#artFormat')?.value || 'square',
      quality: $('#artQuality')?.value || 'hd',
      zoom: $('#artZoom')?.value || 'normal',
      showLeagueLogo: Boolean($('#artShowLeagueLogo')?.checked),
      showArenaLogo: Boolean($('#artShowArenaLogo')?.checked)
    };
  }

  async function generateConfigured(event) {
    event?.preventDefault();
    const settings = settingsFromForm();
    const phaseList = phases();
    let title = 'Jogos oficiais';
    let subtitle = '';
    let content = '';
    let kind = settings.mode;

    if (settings.mode === 'single') {
      const card = context.game || phaseList[settings.phaseIndex]?.games[0];
      if (!card) return notify('Nenhum jogo disponível');
      const game = gameData(card);
      title = `${game.teams[0].name} × ${game.teams[1].name}`;
      subtitle = `${game.phase} • ${game.status}`;
      content = singleGameHtml(game);
    } else if (settings.mode === 'phase') {
      const phase = context.phase || phaseList[settings.phaseIndex]?.element;
      if (!phase) return notify('Escolha uma fase disponível');
      const name = $('h3', phase)?.textContent?.trim() || 'Fase';
      const games = $$('.gi-game', phase).map(card => gameData(card, name));
      title = name;
      subtitle = `${games.length} ${games.length === 1 ? 'confronto' : 'confrontos'} • ${championshipName()}`;
      content = phaseHtml(name, games);
    } else if (settings.mode === 'bracket') {
      const source = $('#giManager .gi-bracket-scroll') || $('#giManager .gi-content');
      if (!source) return notify('Chaveamento indisponível');
      const clone = source.cloneNode(true);
      $$('button,.gi-editor,[data-pro-ignore]', clone).forEach(element => element.remove());
      clone.classList.add('art-bracket-clone');
      title = 'Chaveamento oficial';
      subtitle = `Caminho até a grande final • ${championshipName()}`;
      content = clone.outerHTML;
    } else {
      const blocks = phaseList.map(phase => phaseHtml(phase.name, phase.games.map(card => gameData(card, phase.name)))).join('');
      if (!blocks) return notify('Nenhum confronto disponível');
      const total = phaseList.reduce((sum, phase) => sum + phase.games.length, 0);
      title = 'Jogos oficiais';
      subtitle = `${total} ${total === 1 ? 'confronto registrado' : 'confrontos registrados'} • ${championshipName()}`;
      content = blocks;
    }

    const stage = createStage(title, subtitle, content, settings, kind);
    await renderStage(stage, `${title} • ${championshipName()}`, `${championshipName()}-${title}`, settings);
  }

  function formatOptions() {
    return Object.entries(FORMATS).map(([key, item]) => `<option value="${key}">${item.label} • ${item.width}×${item.height}</option>`).join('');
  }

  function phaseOptions(selectedPhase) {
    const list = phases();
    return list.map((phase, index) => `<option value="${index}" ${phase.element === selectedPhase ? 'selected' : ''}>${esc(phase.name)} • ${phase.games.length} jogos</option>`).join('');
  }

  function scopeOptions(mode) {
    const options = [
      ['single', 'Somente um jogo'],
      ['phase', 'Somente uma fase'],
      ['all', 'Todas as fases'],
      ['bracket', 'Chaveamento']
    ];
    return options.map(([key, label]) => `<option value="${key}" ${key === mode ? 'selected' : ''}>${label}</option>`).join('');
  }

  function updateConfigHelp() {
    const settings = settingsFromForm();
    const format = FORMATS[settings.format];
    const quality = QUALITIES[settings.quality];
    const output = $('#artOutputSize');
    if (output) output.textContent = `${Math.round(format.width * quality.scale)} × ${Math.round(format.height * quality.scale)} px`;
    const phaseField = $('#artPhaseField');
    if (phaseField) phaseField.hidden = !['phase'].includes(settings.mode);
    const mock = $('#artFormatMock');
    if (mock) {
      mock.style.aspectRatio = `${format.width}/${format.height}`;
      mock.dataset.zoom = settings.zoom;
    }
  }

  function openConfigurator(nextContext) {
    context = { mode: 'all', game: null, phase: null, ...nextContext };
    closeConfigurator();
    const league = leagueInfo();
    const modal = document.createElement('div');
    modal.id = 'artConfigurator';
    modal.className = 'art-configurator';
    modal.innerHTML = `<section><header><div><span class="eyebrow">Estúdio de imagens</span><h2>Configurar arte dos jogos</h2><p>Escolha exatamente a fase, o formato e a distância visual.</p></div><button type="button" data-art-config-close>×</button></header>
      <form id="artConfigForm"><div class="art-config-grid">
        <label>Conteúdo<select id="artScope">${scopeOptions(context.mode)}</select></label>
        <label id="artPhaseField">Fase<select id="artPhase">${phaseOptions(context.phase)}</select></label>
        <label>Formato<select id="artFormat">${formatOptions()}</select></label>
        <label>Qualidade<select id="artQuality"><option value="hd">HD</option><option value="twoK">2K</option><option value="fourK">4K</option></select></label>
        <label>Proximidade<select id="artZoom">${Object.entries(ZOOMS).map(([key, item]) => `<option value="${key}">${item.label}</option>`).join('')}</select></label>
        <div class="art-output-card"><span>Resolução final</span><b id="artOutputSize">1080 × 1080 px</b></div>
      </div>
      <div class="art-brand-options"><label><input id="artShowLeagueLogo" type="checkbox" checked><span><b>Logo da liga</b><small>${league.logo ? 'Logo cadastrado e pronto para a arte.' : 'Cadastre o logo ao editar o campeonato.'}</small></span></label><label><input id="artShowArenaLogo" type="checkbox" checked><span><b>Logo Arena BDA</b><small>Identificação oficial da plataforma.</small></span></label></div>
      <div class="art-config-preview"><div id="artFormatMock"><span>${league.logo ? `<img src="${esc(league.logo)}" alt="Logo da liga">` : esc(league.badge || '🏆')}</span><b>PRÉVIA</b><small>O zoom altera a proximidade dos escudos e placares.</small></div></div>
      <footer><button class="secondary" type="button" data-art-config-close>Cancelar</button><button class="primary" type="submit">📸 Gerar prévia</button></footer></form></section>`;
    document.body.append(modal);
    document.body.classList.add('art-config-open');
    $$('select,input', modal).forEach(input => input.addEventListener('change', updateConfigHelp));
    $$('[data-art-config-close]', modal).forEach(button => button.addEventListener('click', closeConfigurator));
    $('#artConfigForm', modal)?.addEventListener('submit', generateConfigured);
    modal.addEventListener('click', event => event.target === modal && closeConfigurator());
    updateConfigHelp();
  }

  function closeConfigurator() {
    $('#artConfigurator')?.remove();
    document.body.classList.remove('art-config-open');
  }

  function improveButtons() {
    const all = $('[data-pro-photo]');
    if (all) { all.textContent = '📸 Criar arte'; all.title = 'Configurar arte dos jogos'; }
    const bracket = $('[data-pro-bracket]');
    if (bracket) { bracket.textContent = '📸 Arte da chave'; bracket.title = 'Configurar arte do chaveamento'; }
    $$('.pro-phase-photo').forEach(button => { button.textContent = '📸 Arte da fase'; button.title = 'Salvar somente esta fase'; });
    $$('.pro-game-photo').forEach(button => { button.textContent = '📸 Arte do jogo'; button.title = 'Criar arte deste confronto'; });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.matches('[data-pro-photo]')) openConfigurator({ mode: 'all' });
    else if (button.matches('[data-pro-bracket]')) openConfigurator({ mode: 'bracket' });
    else if (button.matches('.pro-phase-photo')) openConfigurator({ mode: 'phase', phase: button.closest('.gi-phase') });
    else openConfigurator({ mode: 'single', game: button.closest('.gi-game'), phase: button.closest('.gi-phase') });
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeConfigurator();
      closePreview();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .art-configurator,.art-capture-preview{position:fixed;inset:0;z-index:190;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.86);backdrop-filter:blur(14px)}.art-configurator>section,.art-capture-preview>section{overflow:auto;width:min(900px,100%);max-height:94vh;border:1px solid rgba(245,220,134,.40);border-radius:26px;background:radial-gradient(circle at 100% 0,rgba(245,220,134,.13),transparent 30%),linear-gradient(150deg,#153421,#050c08);box-shadow:0 35px 110px #000c}.art-configurator>section>header,.art-capture-preview>section>header{display:flex;align-items:start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid var(--line)}.art-configurator h2,.art-capture-preview h2{margin:5px 0 2px;font-size:32px;text-transform:uppercase}.art-configurator header p,.art-capture-preview header p{margin:0;color:var(--muted);font-size:9px}.art-configurator header>button,.art-capture-preview header>button{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;color:#fff;background:#ffffff08;font-size:24px}.art-configurator form{display:grid;gap:14px;padding:17px}.art-config-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.art-output-card{display:grid;align-content:center;gap:5px;padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff06}.art-output-card span{color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.art-output-card b{color:var(--gold-soft);font-size:14px}.art-brand-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}.art-brand-options label{display:flex!important;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:15px;background:#ffffff05;text-transform:none;letter-spacing:0}.art-brand-options input{width:auto;min-height:0}.art-brand-options b,.art-brand-options small{display:block}.art-brand-options b{color:var(--text);font-size:10px}.art-brand-options small{margin-top:4px;color:var(--muted);font-size:8px}.art-config-preview{display:grid;place-items:center;min-height:240px;padding:18px;border:1px dashed var(--line-strong);border-radius:20px;background:#020503}.art-config-preview>div{position:relative;overflow:hidden;display:grid;place-items:center;align-content:center;gap:5px;width:min(330px,100%);max-height:330px;border:1px solid rgba(245,220,134,.35);border-radius:18px;background:radial-gradient(circle at 80% 0,#f5dc8638,transparent 35%),linear-gradient(145deg,#19482e,#06100a);box-shadow:0 18px 42px #0008;transition:.2s}.art-config-preview>div[data-zoom=wide]{transform:scale(.86)}.art-config-preview>div[data-zoom=close]{transform:scale(1.08)}.art-config-preview>div[data-zoom=extreme]{transform:scale(1.16)}.art-config-preview img{max-width:74px;max-height:74px;object-fit:contain}.art-config-preview>div>span{font-size:46px}.art-config-preview>div>b{color:var(--gold-soft);font:900 29px "Barlow Condensed",sans-serif}.art-config-preview>div>small{color:#b7c7bd;font-size:8px}.art-configurator form>footer,.art-capture-preview footer{display:flex;justify-content:flex-end;gap:8px;padding-top:14px;border-top:1px solid var(--line)}.art-config-open,.art-preview-open{overflow:hidden}
    .art-shot-stage{box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:20px;padding:42px;color:#f7faf6;background:radial-gradient(circle at 88% 0,rgba(245,220,134,.18),transparent 25%),radial-gradient(circle at 4% 55%,rgba(88,229,154,.07),transparent 25%),linear-gradient(180deg,#08140d,#030805 58%,#020503);font-family:Inter,Arial,sans-serif}.art-shot-stage *{box-sizing:border-box}.art-shot-header{overflow:hidden;position:relative;padding:24px 27px;border:1px solid rgba(245,220,134,.38);border-radius:28px;background:radial-gradient(circle at 90% 0,rgba(245,220,134,.28),transparent 34%),linear-gradient(135deg,#1a492f,#07130d 65%,#030806);box-shadow:0 25px 65px #0006}.art-shot-header:after{content:"BDA";position:absolute;right:-10px;bottom:-48px;color:#fff1;font:900 160px/1 Arial}.art-logos,.art-shot-title{position:relative;z-index:1}.art-logos{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:15px}.art-league-logo,.art-arena-logo{overflow:hidden;display:grid;place-items:center;width:76px;height:76px;border:2px solid rgba(245,220,134,.55);border-radius:22px;background:#020503;font-size:36px}.art-league-logo img,.art-arena-logo img{max-width:66px;max-height:66px;object-fit:contain}.art-logos small,.art-logos b{display:block}.art-logos small{color:#f5dc86;font-size:12px;font-weight:900;letter-spacing:.18em}.art-logos b{margin-top:4px;font-size:24px;text-transform:uppercase}.art-shot-title{margin-top:20px}.art-shot-title>span{color:#f5dc86;font-size:11px;font-weight:900;letter-spacing:.16em}.art-shot-title h1{max-width:930px;margin:7px 0 5px;color:#fff;font:900 51px/.96 "Barlow Condensed",Arial;text-transform:uppercase}.art-shot-title p{margin:0;color:#bfd0c5;font-size:14px}.art-fit-viewport{overflow:hidden;display:grid;place-items:start center;min-height:0}.art-fit-inner{width:100%;padding:2px 3%;transition:none}.art-single-game{display:grid;align-content:center;min-height:610px;padding:28px;border:1px solid rgba(219,241,226,.14);border-radius:28px;background:radial-gradient(circle at 50% 45%,rgba(245,220,134,.09),transparent 30%),linear-gradient(150deg,#183623,#06100a);box-shadow:0 22px 60px #0005}.art-status-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:19px;border-bottom:1px solid #ffffff1c}.art-status-row span{color:#f5dc86;font-size:14px;font-weight:900;text-transform:uppercase}.art-status-row b{padding:9px 13px;border:1px solid #58e59a4d;border-radius:999px;color:#8cf0b8;background:#58e59a14;font-size:12px;text-transform:uppercase}.art-single-versus{display:grid;grid-template-columns:1fr 245px 1fr;align-items:center;gap:19px;padding:43px 0 34px}.art-single-versus article{display:grid;justify-items:center;text-align:center}.art-single-versus article.winner h2{color:#f5dc86}.art-team-badge{overflow:hidden;display:grid;place-items:center;width:54px;height:54px;flex:0 0 auto;border:2px solid #f5dc867a;border-radius:50%;color:#171107;background:linear-gradient(145deg,#f8e59b,#bd8d20);font-size:12px;font-weight:900}.art-team-badge.large{width:148px;height:148px;border-width:4px;font-size:28px;box-shadow:0 20px 45px #0007}.art-team-badge img{width:100%;height:100%;object-fit:cover}.art-single-versus h2{max-width:300px;margin:18px 0 4px;color:#fff;font:900 35px/.95 "Barlow Condensed",Arial;text-transform:uppercase}.art-single-versus small{color:#9fb2a6;font-size:12px}.art-main-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;text-align:center}.art-main-score>span{display:grid;place-items:center;min-height:103px;border:1px solid #f5dc8638;border-radius:22px;color:#f5dc86;background:#020503;font:900 68px/1 "Barlow Condensed",Arial}.art-main-score i{color:#8e9d94;font:700 32px Arial}.art-main-score small{grid-column:1/-1;margin-top:8px;color:#aec0b5;font-size:12px}.art-aggregate{display:flex;align-items:center;justify-content:center;gap:13px;padding:14px;border:1px solid #f5dc8638;border-radius:16px;background:#f5dc860e}.art-aggregate span{color:#a9bbb0;font-size:12px;text-transform:uppercase}.art-aggregate b{color:#f5dc86;font-size:18px}.art-game-note{margin:13px 0 0;color:#b9c9bf;font-size:13px;text-align:center}.art-phase-block{margin-bottom:18px;padding:19px;border:1px solid #ffffff1d;border-radius:25px;background:linear-gradient(150deg,#142c1d,#050e09)}.art-phase-block>header{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:4px 3px 16px;border-bottom:1px solid #ffffff1b}.art-phase-block>header span{color:#f5dc86;font-size:10px;font-weight:900;letter-spacing:.17em}.art-phase-block>header h2{margin:5px 0 0;font:900 33px/1 "Barlow Condensed",Arial;text-transform:uppercase}.art-phase-block>header>b{color:#a9bbb0;font-size:12px;text-transform:uppercase}.art-phase-block>main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:13px}.art-game-card{overflow:hidden;border:1px solid #ffffff1c;border-radius:18px;background:linear-gradient(150deg,#112c1d,#06100a);box-shadow:0 12px 28px #0004}.art-game-card>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-bottom:1px solid #ffffff17;background:#ffffff06}.art-game-card>header span{color:#77e8a7;font-size:9px;font-weight:900;text-transform:uppercase}.art-game-card>header small{overflow:hidden;color:#9fb2a6;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.art-card-team{display:grid;grid-template-columns:50px 1fr 55px;align-items:center;gap:9px;min-height:66px;padding:8px 11px;border-bottom:1px solid #ffffff14}.art-card-team.winner b{color:#f5dc86}.art-card-team>b{overflow:hidden;color:#eef5f0;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.art-card-team>strong{display:grid;place-items:center;width:51px;height:44px;border-radius:12px;color:#f5dc86;background:#020503;font:900 25px "Barlow Condensed",Arial}.art-game-card>footer{display:flex;justify-content:space-between;padding:8px 11px;color:#9fb2a6;font-size:8px;text-transform:uppercase}.art-game-card>footer b{color:#f5dc86}.art-shot-footer{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:20px;padding:15px 4px 0;border-top:1px solid #f5dc8647;color:#90a298;font-size:11px}.art-shot-footer b{color:#f5dc86;font-size:14px}.art-bracket-clone{width:100%!important;overflow:visible!important}.art-bracket-clone .gi-bracket{display:grid!important;grid-auto-flow:column!important;grid-auto-columns:minmax(250px,1fr)!important;gap:13px!important;width:max-content!important;min-width:100%!important}.art-bracket-clone button{display:none!important}.art-shot-stage[data-format=story] .art-shot-title h1{font-size:62px}.art-shot-stage[data-format=story] .art-phase-block>main{grid-template-columns:1fr}.art-shot-stage[data-format=landscape]{padding:34px}.art-shot-stage[data-format=landscape] .art-shot-header{display:grid;grid-template-columns:1fr 1.2fr;align-items:center}.art-shot-stage[data-format=landscape] .art-shot-title{margin-top:0}.art-shot-stage[data-format=landscape] .art-shot-title h1{font-size:47px}.art-shot-stage[data-format=landscape] .art-single-game{min-height:500px}.art-shot-stage[data-format=landscape] .art-single-versus{padding-block:28px}.art-shot-stage[data-zoom=wide] .art-team-badge.large{width:122px;height:122px}.art-shot-stage[data-zoom=wide] .art-main-score>span{font-size:58px}.art-shot-stage[data-zoom=close] .art-team-badge.large{width:166px;height:166px}.art-shot-stage[data-zoom=close] .art-main-score>span{font-size:76px}.art-shot-stage[data-zoom=extreme] .art-team-badge.large{width:184px;height:184px}.art-shot-stage[data-zoom=extreme] .art-main-score>span{font-size:82px}.art-shot-stage[data-zoom=extreme] .art-single-versus h2{font-size:40px}
    .art-capture-preview>section{display:grid;grid-template-rows:auto minmax(0,1fr) auto}.art-preview-media{overflow:auto;display:grid;place-items:center;min-height:260px;padding:13px;background:#020503}.art-preview-media img{display:block;max-width:100%;max-height:65vh;object-fit:contain;box-shadow:0 16px 45px #0007}.art-capture-preview footer{padding:13px 16px}
    @media(max-width:720px){.art-config-grid{grid-template-columns:1fr 1fr}.art-brand-options{grid-template-columns:1fr}.art-configurator>section,.art-capture-preview>section{border-radius:21px}.art-configurator h2,.art-capture-preview h2{font-size:26px}.art-capture-preview footer{display:grid;grid-template-columns:1fr 1fr}.art-capture-preview footer .primary{grid-column:1/-1}.art-capture-preview footer button{width:100%}}
    @media(max-width:460px){.art-configurator,.art-capture-preview{padding:7px}.art-config-grid{grid-template-columns:1fr}.art-configurator form>footer{display:grid}.art-configurator form>footer button{width:100%}}
  `;
  document.head.append(style);

  improveButtons();
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(improveButtons, 90);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
