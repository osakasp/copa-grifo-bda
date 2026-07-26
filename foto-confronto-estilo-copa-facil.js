(() => {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const PREF_KEY = 'arena-bda-match-photo-studio-v1';
  const FORMATS = {
    square: { label: 'Quadrado 1:1', width: 1080, height: 1080 },
    portrait: { label: 'Post 4:5', width: 1080, height: 1350 },
    story: { label: 'Story 9:16', width: 1080, height: 1920 }
  };
  const THEMES = {
    automatic: { label: 'Automático', a: '#0b3149', b: '#02070d', accent: '#20c8f3', glow: '#177dff' },
    blue: { label: 'Azul', a: '#123b74', b: '#030814', accent: '#5db4ff', glow: '#1c69ff' },
    green: { label: 'Verde BDA', a: '#16472d', b: '#030906', accent: '#f0cf66', glow: '#42db8a' },
    red: { label: 'Vermelho', a: '#621b2a', b: '#0b0205', accent: '#ffb0ba', glow: '#f03f58' },
    black: { label: 'Preto e prata', a: '#242a32', b: '#030405', accent: '#e3edf5', glow: '#8797a6' }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const slug = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'confronto-bda';
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let activeGame = null;
  let customBackground = '';
  let busy = false;
  let generatedUrl = '';

  function preferences() {
    try {
      return { format: 'portrait', template: 'score', theme: 'automatic', quality: 'hd', showMeta: true, showCompetitionLogo: true, showArenaLogo: true, sponsor: '', ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
    } catch {
      return { format: 'portrait', template: 'score', theme: 'automatic', quality: 'hd', showMeta: true, showCompetitionLogo: true, showArenaLogo: true, sponsor: '' };
    }
  }

  function savePreferences(value) {
    const compact = {
      format: value.format,
      template: value.template,
      theme: value.theme,
      quality: value.quality,
      showMeta: value.showMeta,
      showCompetitionLogo: value.showCompetitionLogo,
      showArenaLogo: value.showArenaLogo,
      sponsor: value.sponsor
    };
    localStorage.setItem(PREF_KEY, JSON.stringify(compact));
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
      script.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('Captura indisponível'));
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  function currentCompetition() {
    const name = $('#giManager .gi-head h2')?.textContent?.trim()
      || $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim()
      || 'Arena BDA';
    const api = window.ArenaBDALeagueLogo?.get?.(name);
    if (api) return { name, logo: api.logo || '', badge: api.badge || '🏆', edition: api.edition || '' };
    try {
      const items = JSON.parse(localStorage.getItem('bda-v3-tournaments') || '[]');
      const item = items.find(entry => norm(entry?.name) === norm(name));
      return { name, logo: item?.logo || '', badge: item?.badge || '🏆', edition: item?.edition || '' };
    } catch {
      return { name, logo: '', badge: '🏆', edition: '' };
    }
  }

  function arenaLogo() {
    return $('link[rel~="icon"]')?.href || './favicon.svg';
  }

  function scoreFromTeam(team) {
    const input = $('input[type="number"]', team);
    if (input) return input.value === '' ? '–' : input.value;
    return $('.gi-score', team)?.textContent?.trim() || '–';
  }

  function teamInfo(team) {
    const name = $('strong', team)?.textContent?.trim() || 'A definir';
    const image = $('img', team)?.currentSrc || $('img', team)?.src || '';
    const badge = $('.gi-badge', team)?.textContent?.trim() || name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    return {
      name,
      image,
      badge,
      score: scoreFromTeam(team),
      winner: team.classList.contains('winner')
    };
  }

  function gameInfo(game) {
    const teams = $$('.gi-team', game).slice(0, 2).map(teamInfo);
    const phase = game.closest('.gi-phase')?.querySelector('h3')?.textContent?.trim() || 'Confronto';
    const header = $(':scope > header', game);
    return {
      competition: currentCompetition(),
      phase,
      status: $('span', header)?.textContent?.trim() || 'Agendado',
      meta: $('small', header)?.textContent?.trim() || 'Data a definir',
      aggregate: $('.gi-agg b', game)?.textContent?.trim() || '',
      note: $(':scope > p', game)?.textContent?.trim() || '',
      teams: teams.length === 2 ? teams : [teamInfo(document.createElement('div')), teamInfo(document.createElement('div'))]
    };
  }

  function logoHtml(source, fallback, className, alt) {
    return source
      ? `<span class="${className}"><img src="${esc(source)}" alt="${esc(alt)}"></span>`
      : `<span class="${className} fallback">${esc(fallback)}</span>`;
  }

  function teamHtml(team, side) {
    return `<article class="cfp-team cfp-${side} ${team.winner ? 'winner' : ''}">
      ${logoHtml(team.image, team.badge, 'cfp-team-badge', `Escudo de ${team.name}`)}
      <h2>${esc(team.name)}</h2>
      <span>${team.winner ? 'VENCEDOR' : 'CLUBE'}</span>
    </article>`;
  }

  function formSettings() {
    const modal = $('#cfpStudio');
    const base = preferences();
    if (!modal) return base;
    return {
      format: $('#cfpFormat', modal)?.value || base.format,
      template: $('#cfpTemplate', modal)?.value || base.template,
      theme: $('#cfpTheme', modal)?.value || base.theme,
      quality: $('#cfpQuality', modal)?.value || base.quality,
      headline: $('#cfpHeadline', modal)?.value.trim() || '',
      sponsor: $('#cfpSponsor', modal)?.value.trim() || '',
      showMeta: Boolean($('#cfpShowMeta', modal)?.checked),
      showCompetitionLogo: Boolean($('#cfpShowCompetitionLogo', modal)?.checked),
      showArenaLogo: Boolean($('#cfpShowArenaLogo', modal)?.checked)
    };
  }

  function resolvedTheme(settings, data) {
    if (settings.theme !== 'automatic') return THEMES[settings.theme] || THEMES.blue;
    return norm(data.competition.name).includes('francos') ? THEMES.automatic : THEMES.green;
  }

  function buildStage(data, settings, forExport = false) {
    const format = FORMATS[settings.format] || FORMATS.portrait;
    const theme = resolvedTheme(settings, data);
    const [home, away] = data.teams;
    const stage = document.createElement('section');
    stage.className = `cfp-card cfp-template-${settings.template}`;
    stage.dataset.format = settings.format;
    stage.style.setProperty('--cfp-a', theme.a);
    stage.style.setProperty('--cfp-b', theme.b);
    stage.style.setProperty('--cfp-accent', theme.accent);
    stage.style.setProperty('--cfp-glow', theme.glow);
    stage.style.width = `${format.width}px`;
    stage.style.height = `${format.height}px`;
    if (forExport) stage.classList.add('cfp-export-stage');
    if (customBackground) stage.style.setProperty('--cfp-background-image', `url("${customBackground.replace(/"/g, '%22')}")`);

    const headline = settings.headline || (data.status.toLowerCase().includes('final') ? 'RESULTADO OFICIAL' : 'CONFRONTO OFICIAL');
    const competitionLogo = settings.showCompetitionLogo
      ? logoHtml(data.competition.logo, data.competition.badge || '🏆', 'cfp-competition-logo', `Logo de ${data.competition.name}`)
      : '';
    const platformLogo = settings.showArenaLogo
      ? logoHtml(arenaLogo(), 'BDA', 'cfp-arena-logo', 'Logo Arena BDA')
      : '';

    stage.innerHTML = `
      <div class="cfp-bg-noise"></div>
      <header class="cfp-header">
        <div class="cfp-brand">${competitionLogo}<div><small>${esc(data.competition.edition || 'COMPETIÇÃO OFICIAL')}</small><b>${esc(data.competition.name)}</b></div></div>
        ${platformLogo}
      </header>
      <main class="cfp-main">
        <div class="cfp-kicker"><span>${esc(data.phase)}</span><b>${esc(headline)}</b></div>
        <section class="cfp-versus">
          ${teamHtml(home, 'home')}
          <div class="cfp-score">
            <small>${esc(data.status)}</small>
            <div><strong>${esc(home.score)}</strong><i>×</i><strong>${esc(away.score)}</strong></div>
            ${settings.showMeta ? `<p>${esc(data.meta)}</p>` : ''}
          </div>
          ${teamHtml(away, 'away')}
        </section>
        ${data.aggregate ? `<div class="cfp-aggregate"><span>PLACAR AGREGADO</span><b>${esc(data.aggregate)}</b></div>` : ''}
        ${data.note ? `<p class="cfp-note">${esc(data.note)}</p>` : ''}
      </main>
      <footer class="cfp-footer"><div><b>ARENA BDA</b><span>BOLEIROS DE ATITUDE</span></div>${settings.sponsor ? `<div class="cfp-sponsor"><small>APOIO</small><b>${esc(settings.sponsor)}</b></div>` : '<span class="cfp-site">arenabda.com.br</span>'}</footer>`;
    return stage;
  }

  function fitPreview() {
    const viewport = $('#cfpPreviewViewport');
    const card = $('.cfp-card', viewport);
    if (!viewport || !card) return;
    const format = FORMATS[formSettings().format] || FORMATS.portrait;
    const available = Math.max(260, viewport.clientWidth - 10);
    const scale = Math.min(0.54, available / format.width);
    card.style.transform = `scale(${scale})`;
    card.style.transformOrigin = 'top center';
    viewport.style.height = `${Math.ceil(format.height * scale)}px`;
  }

  function renderPreview() {
    if (!activeGame) return;
    const viewport = $('#cfpPreviewViewport');
    if (!viewport) return;
    const settings = formSettings();
    viewport.innerHTML = '';
    viewport.append(buildStage(gameInfo(activeGame), settings));
    savePreferences(settings);
    requestAnimationFrame(fitPreview);
  }

  function closeReady() {
    $('#cfpReady')?.remove();
    if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    generatedUrl = '';
  }

  function closeStudio() {
    closeReady();
    $('#cfpStudio')?.remove();
    document.body.classList.remove('cfp-studio-open');
    activeGame = null;
    customBackground = '';
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

  function showReady(blob, filename, canvas, shareNow = false) {
    closeReady();
    generatedUrl = URL.createObjectURL(blob);
    const modal = document.createElement('div');
    modal.id = 'cfpReady';
    modal.className = 'cfp-ready';
    modal.innerHTML = `<section><header><div><span>IMAGEM PRONTA</span><h2>Foto do confronto</h2><p>${canvas.width} × ${canvas.height}px</p></div><button type="button" data-cfp-ready-close>×</button></header><main><img src="${generatedUrl}" alt="Foto do confronto pronta"></main><footer><button class="secondary" type="button" data-cfp-ready-close>Voltar</button><button class="ghost" type="button" data-cfp-download>⬇ Baixar PNG</button><button class="primary" type="button" data-cfp-share>↗ Compartilhar</button></footer></section>`;
    document.body.append(modal);

    const share = async () => {
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'Arena BDA', text: 'Foto oficial do confronto', files: [file] });
        else if (navigator.share) await navigator.share({ title: 'Arena BDA', text: 'Foto oficial do confronto', url: location.href });
        else downloadBlob(blob, filename);
      } catch (error) {
        if (error?.name !== 'AbortError') notify('Não foi possível compartilhar a imagem');
      }
    };

    $$('[data-cfp-ready-close]', modal).forEach(button => button.addEventListener('click', closeReady));
    $('[data-cfp-download]', modal)?.addEventListener('click', () => downloadBlob(blob, filename));
    $('[data-cfp-share]', modal)?.addEventListener('click', share);
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
    if (!activeGame || busy) return;
    busy = true;
    const settings = formSettings();
    const data = gameInfo(activeGame);
    const format = FORMATS[settings.format] || FORMATS.portrait;
    const stage = buildStage(data, settings, true);
    stage.style.cssText += `position:fixed;left:-14000px;top:0;z-index:-10;width:${format.width}px;height:${format.height}px;`;
    document.body.append(stage);
    notify('Gerando a foto do confronto...');
    try {
      const html2canvas = await loadCapture();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(stage);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const scale = settings.quality === 'twoK' ? 1.5 : 1;
      const canvas = await html2canvas(stage, {
        backgroundColor: '#02070d',
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 10000,
        width: format.width,
        height: format.height,
        windowWidth: format.width,
        windowHeight: format.height,
        scrollX: 0,
        scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG')), 'image/png', 1));
      const filename = `${slug(`${data.teams[0].name}-x-${data.teams[1].name}`)}-arena-bda.png`;
      showReady(blob, filename, canvas, shareNow);
      notify('Foto pronta');
    } catch (error) {
      console.error(error);
      notify('Não foi possível gerar a foto do confronto');
    } finally {
      stage.remove();
      busy = false;
    }
  }

  function openStudio(game) {
    if (!game) return;
    closeStudio();
    activeGame = game;
    const saved = preferences();
    const data = gameInfo(game);
    const modal = document.createElement('div');
    modal.id = 'cfpStudio';
    modal.className = 'cfp-studio';
    modal.innerHTML = `<section>
      <header class="cfp-studio-head"><div><span class="eyebrow">Foto do confronto</span><h2>Editor de imagem</h2><p>Monte a arte, confira a prévia e compartilhe. Fluxo simples, no estilo dos gerenciadores esportivos.</p></div><button type="button" data-cfp-close>×</button></header>
      <div class="cfp-studio-body">
        <form id="cfpForm">
          <div class="cfp-fields">
            <label>Formato<select id="cfpFormat">${Object.entries(FORMATS).map(([key, item]) => `<option value="${key}" ${saved.format === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
            <label>Modelo<select id="cfpTemplate"><option value="score" ${saved.template === 'score' ? 'selected' : ''}>Placar em destaque</option><option value="versus" ${saved.template === 'versus' ? 'selected' : ''}>Pré-jogo</option><option value="minimal" ${saved.template === 'minimal' ? 'selected' : ''}>Minimalista</option></select></label>
            <label>Cores<select id="cfpTheme">${Object.entries(THEMES).map(([key, item]) => `<option value="${key}" ${saved.theme === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
            <label>Qualidade<select id="cfpQuality"><option value="hd" ${saved.quality === 'hd' ? 'selected' : ''}>HD</option><option value="twoK" ${saved.quality === 'twoK' ? 'selected' : ''}>2K</option></select></label>
            <label class="wide">Título da arte<input id="cfpHeadline" maxlength="45" placeholder="Automático: Resultado oficial"></label>
            <label class="wide">Patrocinador ou apoio<input id="cfpSponsor" maxlength="45" value="${esc(saved.sponsor)}" placeholder="Opcional"></label>
            <label class="wide">Imagem de fundo<input id="cfpBackground" type="file" accept="image/png,image/jpeg,image/webp"><small>Opcional. A imagem fica somente nesta edição.</small></label>
          </div>
          <div class="cfp-checks">
            <label><input id="cfpShowMeta" type="checkbox" ${saved.showMeta ? 'checked' : ''}><span>Mostrar data e horário</span></label>
            <label><input id="cfpShowCompetitionLogo" type="checkbox" ${saved.showCompetitionLogo ? 'checked' : ''}><span>Logo da competição</span></label>
            <label><input id="cfpShowArenaLogo" type="checkbox" ${saved.showArenaLogo ? 'checked' : ''}><span>Logo Arena BDA</span></label>
          </div>
          <div class="cfp-match-summary"><span>${esc(data.phase)}</span><b>${esc(data.teams[0].name)} <strong>${esc(data.teams[0].score)} × ${esc(data.teams[1].score)}</strong> ${esc(data.teams[1].name)}</b></div>
        </form>
        <section class="cfp-preview-panel"><div class="cfp-preview-title"><div><span>PRÉVIA EM TEMPO REAL</span><b>Veja antes de publicar</b></div><button type="button" data-cfp-reset-bg>Limpar fundo</button></div><div id="cfpPreviewViewport"></div></section>
      </div>
      <footer class="cfp-studio-actions"><button class="secondary" type="button" data-cfp-close>Cancelar</button><button class="ghost" type="button" data-cfp-download-action>⬇ Gerar PNG</button><button class="primary" type="button" data-cfp-share-action>↗ Gerar e compartilhar</button></footer>
    </section>`;
    document.body.append(modal);
    document.body.classList.add('cfp-studio-open');

    $('#cfpForm', modal)?.addEventListener('input', renderPreview);
    $('#cfpForm', modal)?.addEventListener('change', renderPreview);
    $('#cfpBackground', modal)?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        event.target.value = '';
        return notify('Use uma imagem de até 8 MB');
      }
      try {
        customBackground = await readFile(file);
        renderPreview();
      } catch (error) {
        notify(error.message || 'Não foi possível carregar o fundo');
      }
    });
    $('[data-cfp-reset-bg]', modal)?.addEventListener('click', () => {
      customBackground = '';
      $('#cfpBackground', modal).value = '';
      renderPreview();
    });
    $$('[data-cfp-close]', modal).forEach(button => button.addEventListener('click', closeStudio));
    $('[data-cfp-download-action]', modal)?.addEventListener('click', () => generate(false));
    $('[data-cfp-share-action]', modal)?.addEventListener('click', () => generate(true));
    modal.addEventListener('click', event => event.target === modal && closeStudio());
    renderPreview();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-old-match-photo],.pro-game-photo');
    if (!button) return;
    const game = button.closest('.gi-game');
    if (!game) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openStudio(game);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('#cfpReady')) closeReady();
    else closeStudio();
  });

  window.addEventListener('resize', () => requestAnimationFrame(fitPreview));

  const style = document.createElement('style');
  style.textContent = `
    .cfp-studio,.cfp-ready{position:fixed;inset:0;z-index:275;display:grid;place-items:center;overflow:auto;padding:14px;background:rgba(0,0,0,.91);backdrop-filter:blur(16px)}.cfp-studio-open{overflow:hidden}.cfp-studio>section{width:min(1240px,100%);max-height:96vh;overflow:auto;border:1px solid rgba(95,218,255,.38);border-radius:28px;background:radial-gradient(circle at 100% 0,rgba(32,200,243,.12),transparent 30%),linear-gradient(150deg,#0c2939,#03080d);box-shadow:0 38px 120px #000d}.cfp-studio-head{display:flex;align-items:start;justify-content:space-between;gap:14px;padding:19px 21px;border-bottom:1px solid rgba(82,184,220,.18)}.cfp-studio-head h2{margin:5px 0 3px;font-size:35px;text-transform:uppercase}.cfp-studio-head p{margin:0;color:#9fb7c3;font-size:9px}.cfp-studio-head>button,.cfp-ready header>button{width:43px;height:43px;border:1px solid rgba(91,206,245,.25);border-radius:13px;color:#fff;background:#ffffff08;font-size:25px}.cfp-studio-body{display:grid;grid-template-columns:minmax(330px,.75fr) minmax(400px,1.25fr);gap:14px;padding:15px}.cfp-studio form,.cfp-preview-panel{padding:14px;border:1px solid rgba(73,184,222,.18);border-radius:20px;background:rgba(1,8,13,.50)}.cfp-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cfp-fields .wide{grid-column:1/-1}.cfp-fields label small{display:block;margin-top:5px;color:#7893a0;font-size:7px;text-transform:none;letter-spacing:0}.cfp-checks{display:grid;gap:7px;margin-top:11px}.cfp-checks label{display:flex!important;align-items:center;gap:8px;padding:9px;border:1px solid rgba(73,184,222,.16);border-radius:12px;background:#ffffff04;text-transform:none;letter-spacing:0}.cfp-checks input{width:auto;min-height:0}.cfp-checks span{color:#c5d8e1;font-size:9px}.cfp-match-summary{margin-top:11px;padding:11px;border:1px solid rgba(77,196,237,.18);border-radius:14px;background:rgba(32,200,243,.055)}.cfp-match-summary span,.cfp-match-summary b{display:block}.cfp-match-summary span{color:#7fe4fa;font-size:7px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.cfp-match-summary b{margin-top:5px;color:#dcebf1;font-size:9px;line-height:1.45}.cfp-match-summary strong{color:#9defff;font-size:12px}.cfp-preview-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.cfp-preview-title span,.cfp-preview-title b{display:block}.cfp-preview-title span{color:#74e4fb;font-size:7px;font-weight:900;letter-spacing:.14em}.cfp-preview-title b{margin-top:4px;font-size:12px}.cfp-preview-title button{min-height:32px;padding:0 9px;border:1px solid rgba(76,193,232,.20);border-radius:10px;color:#91eaff;background:#ffffff05;font-size:7px}.cfp-preview-panel{overflow:hidden}.cfp-preview-panel #cfpPreviewViewport{position:relative;overflow:hidden;display:grid;justify-content:center;width:100%;min-height:320px;border:1px solid rgba(78,194,233,.16);border-radius:15px;background:#010407}.cfp-studio-actions{display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid rgba(82,184,220,.18)}

    .cfp-card{--cfp-background-image:none;position:relative;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:58px;color:#f8fcff;background:linear-gradient(180deg,rgba(2,7,13,.20),rgba(2,7,13,.86)),var(--cfp-background-image),radial-gradient(circle at 86% 5%,var(--cfp-glow),transparent 27%),radial-gradient(circle at 8% 72%,rgba(255,255,255,.055),transparent 27%),linear-gradient(145deg,var(--cfp-a),var(--cfp-b) 70%);background-size:cover;background-position:center;font-family:Inter,Arial,sans-serif;isolation:isolate}.cfp-card:before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(115deg,transparent 0 48%,rgba(255,255,255,.035) 49%,transparent 50% 100%);background-size:165px 165px}.cfp-bg-noise{position:absolute;inset:0;z-index:-1;opacity:.28;background:radial-gradient(circle at 50% 50%,transparent 0 45%,rgba(0,0,0,.36) 100%)}.cfp-header{display:grid;grid-template-columns:1fr auto;align-items:center;gap:20px;padding-bottom:26px;border-bottom:2px solid rgba(255,255,255,.14)}.cfp-brand{display:flex;align-items:center;gap:18px}.cfp-brand small,.cfp-brand b{display:block}.cfp-brand small{color:var(--cfp-accent);font-size:13px;font-weight:900;letter-spacing:.17em}.cfp-brand b{margin-top:5px;color:#fff;font:900 34px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.cfp-competition-logo,.cfp-arena-logo{overflow:hidden;display:grid;place-items:center;width:102px;height:102px;border:3px solid rgba(255,255,255,.30);border-radius:50%;color:#041019;background:linear-gradient(145deg,#effcff,var(--cfp-accent));font-size:42px;font-weight:900;box-shadow:0 18px 40px #0007,0 0 25px var(--cfp-glow)}.cfp-competition-logo img,.cfp-arena-logo img{width:100%;height:100%;object-fit:contain}.cfp-arena-logo{width:78px;height:78px;border-radius:22px}.cfp-main{display:grid;align-content:center;padding:34px 0}.cfp-kicker{text-align:center}.cfp-kicker span,.cfp-kicker b{display:block}.cfp-kicker span{color:var(--cfp-accent);font-size:17px;font-weight:900;letter-spacing:.22em;text-transform:uppercase}.cfp-kicker b{margin-top:11px;color:#fff;font:900 61px/.92 "Barlow Condensed",Arial,sans-serif;letter-spacing:.025em;text-transform:uppercase;text-shadow:0 8px 30px #000}.cfp-versus{display:grid;grid-template-columns:1fr 300px 1fr;align-items:center;gap:28px;margin-top:54px}.cfp-team{display:grid;justify-items:center;min-width:0;text-align:center}.cfp-team-badge{overflow:hidden;display:grid;place-items:center;width:205px;height:205px;border:5px solid rgba(255,255,255,.34);border-radius:50%;color:#061019;background:linear-gradient(145deg,#f2fcff,var(--cfp-accent));font-size:43px;font-weight:900;box-shadow:0 27px 55px #0008,0 0 32px var(--cfp-glow)}.cfp-team-badge img{width:100%;height:100%;object-fit:cover}.cfp-team h2{max-width:320px;margin:23px 0 7px;color:#fff;font:900 38px/.92 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase;text-shadow:0 6px 20px #000}.cfp-team>span{padding:7px 11px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#a9c5d2;background:rgba(0,0,0,.22);font-size:10px;font-weight:900;letter-spacing:.12em}.cfp-team.winner>span{color:#051017;background:var(--cfp-accent)}.cfp-team.winner h2{color:var(--cfp-accent)}.cfp-score{text-align:center}.cfp-score>small{display:inline-block;padding:10px 16px;border:1px solid rgba(255,255,255,.21);border-radius:999px;color:#d9f7ff;background:rgba(0,0,0,.32);font-size:12px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.cfp-score>div{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;margin-top:16px}.cfp-score strong{display:grid;place-items:center;min-height:142px;border:2px solid rgba(255,255,255,.20);border-radius:27px;color:#fff;background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(0,0,0,.42));font:900 92px/1 "Barlow Condensed",Arial,sans-serif;box-shadow:0 20px 40px #0007,inset 0 1px rgba(255,255,255,.08)}.cfp-score i{color:var(--cfp-accent);font:900 38px Arial,sans-serif}.cfp-score p{margin:15px 0 0;color:#b6ced9;font-size:14px}.cfp-aggregate{display:flex;align-items:center;justify-content:center;gap:18px;margin:35px auto 0;padding:14px 23px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:rgba(0,0,0,.25)}.cfp-aggregate span{color:#9bb8c6;font-size:11px;font-weight:900;letter-spacing:.13em}.cfp-aggregate b{color:var(--cfp-accent);font-size:19px}.cfp-note{margin:18px auto 0;color:#b9ced8;font-size:14px;text-align:center}.cfp-footer{display:flex;align-items:end;justify-content:space-between;gap:20px;padding-top:24px;border-top:2px solid rgba(255,255,255,.14)}.cfp-footer>div b,.cfp-footer>div span,.cfp-sponsor small,.cfp-sponsor b{display:block}.cfp-footer>div b{color:var(--cfp-accent);font-size:18px}.cfp-footer>div span{margin-top:5px;color:#9ab1bd;font-size:10px;letter-spacing:.15em}.cfp-site{color:#b8d1dc;font-size:13px;font-weight:900}.cfp-sponsor{text-align:right}.cfp-sponsor small{color:#8ba4b0;font-size:9px;letter-spacing:.15em}.cfp-sponsor b{margin-top:5px;color:#fff;font-size:18px;text-transform:uppercase}

    .cfp-card[data-format="square"]{padding:43px}.cfp-card[data-format="square"] .cfp-competition-logo{width:82px;height:82px}.cfp-card[data-format="square"] .cfp-arena-logo{width:65px;height:65px}.cfp-card[data-format="square"] .cfp-kicker b{font-size:48px}.cfp-card[data-format="square"] .cfp-versus{grid-template-columns:1fr 255px 1fr;gap:18px;margin-top:36px}.cfp-card[data-format="square"] .cfp-team-badge{width:157px;height:157px}.cfp-card[data-format="square"] .cfp-team h2{font-size:30px}.cfp-card[data-format="square"] .cfp-score strong{min-height:108px;font-size:70px}.cfp-card[data-format="story"] .cfp-main{align-content:center}.cfp-card[data-format="story"] .cfp-kicker b{font-size:72px}.cfp-card[data-format="story"] .cfp-versus{grid-template-columns:1fr;gap:38px;margin-top:70px}.cfp-card[data-format="story"] .cfp-score{order:2}.cfp-card[data-format="story"] .cfp-home{order:1}.cfp-card[data-format="story"] .cfp-away{order:3}.cfp-card[data-format="story"] .cfp-team{grid-template-columns:auto 1fr;align-items:center;justify-items:start;gap:25px;text-align:left}.cfp-card[data-format="story"] .cfp-team-badge{width:175px;height:175px}.cfp-card[data-format="story"] .cfp-team h2{margin:0;font-size:43px}.cfp-card[data-format="story"] .cfp-team>span{grid-column:2}.cfp-card[data-format="story"] .cfp-score>div{width:430px;margin-inline:auto}.cfp-template-versus .cfp-score strong{color:var(--cfp-accent)}.cfp-template-versus .cfp-score>small{background:var(--cfp-accent);color:#041019}.cfp-template-minimal{background:linear-gradient(150deg,var(--cfp-a),var(--cfp-b))}.cfp-template-minimal:before,.cfp-template-minimal .cfp-bg-noise{display:none}.cfp-template-minimal .cfp-team-badge{box-shadow:0 22px 42px #0008}.cfp-export-stage{transform:none!important}

    .cfp-ready{z-index:290}.cfp-ready>section{overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(920px,100%);max-height:95vh;border:1px solid rgba(83,207,247,.35);border-radius:25px;background:linear-gradient(150deg,#0b2a3a,#02070c);box-shadow:0 35px 110px #000d}.cfp-ready header{display:flex;align-items:start;justify-content:space-between;gap:12px;padding:17px 19px;border-bottom:1px solid rgba(74,184,220,.18)}.cfp-ready header span{color:#74e4fb;font-size:7px;font-weight:900;letter-spacing:.15em}.cfp-ready header h2{margin:5px 0 2px;font-size:30px;text-transform:uppercase}.cfp-ready header p{margin:0;color:#829ba7;font-size:8px}.cfp-ready main{overflow:auto;display:grid;place-items:center;min-height:260px;padding:12px;background:#010305}.cfp-ready main img{display:block;max-width:100%;max-height:67vh;object-fit:contain;box-shadow:0 17px 48px #000b}.cfp-ready footer{display:flex;justify-content:flex-end;gap:8px;padding:13px 16px;border-top:1px solid rgba(74,184,220,.18)}

    @media(max-width:850px){.cfp-studio-body{grid-template-columns:1fr}.cfp-preview-panel{order:-1}.cfp-preview-panel #cfpPreviewViewport{min-height:280px}.cfp-studio>section{border-radius:22px}.cfp-studio-actions{display:grid;grid-template-columns:1fr 1fr}.cfp-studio-actions .primary{grid-column:1/-1}.cfp-studio-actions button{width:100%}}
    @media(max-width:500px){.cfp-studio{padding:5px}.cfp-studio-head{padding:14px}.cfp-studio-head h2{font-size:28px}.cfp-studio-body{padding:8px}.cfp-fields{grid-template-columns:1fr}.cfp-fields .wide{grid-column:auto}.cfp-preview-title{align-items:start}.cfp-ready{padding:5px}.cfp-ready footer{display:grid;grid-template-columns:1fr 1fr}.cfp-ready footer .primary{grid-column:1/-1}.cfp-ready footer button{width:100%}}
  `;
  document.head.append(style);

  window.ArenaBDAMatchPhotoStudio = { open: openStudio };
})();
