(() => {
  'use strict';

  if (window.ArenaBDAArtStudio?.version >= 1) return;

  const VERSION = 1;
  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';
  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const FORMATS = Object.freeze({
    square: { label: '1:1 • Feed / WhatsApp', width: 1080, height: 1080, phasePage: 4 },
    story: { label: '9:16 • Status / Stories', width: 1080, height: 1920, phasePage: 7 },
    wide: { label: '16:9 • Banner', width: 1920, height: 1080, phasePage: 6 }
  });

  let busy = false;
  let injectTimer = 0;

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
    .replace(/^-|-$/g, '') || 'arena-bda';
  const notify = text => typeof window.toast === 'function' ? window.toast(text) : console.info(text);

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function adminActive() {
    return Boolean(
      window.ArenaBDAAuth?.isAdmin?.()
      || document.documentElement.classList.contains('arena-admin-authenticated')
    );
  }

  function tournaments() {
    const value = read(TOURNAMENT_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function currentTournament() {
    const managerId = $('#giManager')?.dataset?.tid || '';
    if (managerId) return tournaments().find(item => String(item?.id) === String(managerId)) || null;
    const heading = $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim() || '';
    if (heading) return tournaments().find(item => norm(item?.name) === norm(heading)) || null;
    return null;
  }

  function gamesFor(tournament) {
    if (!tournament?.id) return [];
    const store = read(MATCH_KEY, {});
    const value = store && typeof store === 'object' ? store[tournament.id] : [];
    return Array.isArray(value) ? value : [];
  }

  function catalog() {
    const value = read(TEAM_KEY, []);
    const map = new Map();
    (Array.isArray(value) ? value : []).forEach(team => {
      if (team?.name) map.set(norm(team.name), team);
    });
    return map;
  }

  function teamVisual(name) {
    const team = catalog().get(norm(name));
    const initials = String(name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    return team?.badge
      ? `<span class="bda-art-shield"><img src="${esc(team.badge)}" alt="Escudo de ${esc(name)}"></span>`
      : `<span class="bda-art-shield bda-art-initials">${esc(initials)}</span>`;
  }

  function score(game, side) {
    if (game?.wo === 'a') return side === 'a' ? 3 : 0;
    if (game?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game?.a : game?.b;
    return value === '' || value == null || Number.isNaN(Number(value)) ? null : Number(value);
  }

  function isFinished(game) {
    return game?.wo === 'a' || game?.wo === 'b' || (score(game, 'a') != null && score(game, 'b') != null);
  }

  function legLabel(game, tieSize = 1) {
    if (tieSize > 1) return Number(game?.leg) === 2 ? 'Jogo de volta' : 'Jogo de ida';
    return 'Resultado';
  }

  function groupedTies(games) {
    const map = new Map();
    games.forEach((game, index) => {
      const key = String(game?.tieId || game?.id || `jogo-${index}`);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(game);
    });
    return [...map.entries()].map(([tieId, list]) => ({
      tieId,
      games: list.sort((a, b) => Number(a?.leg || 1) - Number(b?.leg || 1))
    }));
  }

  function aggregate(tie) {
    const first = tie?.games?.[0];
    if (!first) return null;
    const a = first.ta;
    const b = first.tb;
    let ga = 0;
    let gb = 0;
    let complete = true;
    tie.games.forEach(game => {
      const sa = score(game, 'a');
      const sb = score(game, 'b');
      if (sa == null || sb == null) {
        complete = false;
        return;
      }
      if (norm(game.ta) === norm(a)) {
        ga += sa;
        gb += sb;
      } else {
        ga += sb;
        gb += sa;
      }
    });
    return { a, b, ga, gb, complete };
  }

  function formatFromModal() {
    const key = $('#bdaArtFormat')?.value || 'square';
    return { key, ...(FORMATS[key] || FORMATS.square) };
  }

  function frame({ format, tournament, kicker, title, subtitle = '' }) {
    const stage = document.createElement('section');
    stage.className = `bda-art-stage bda-art-${format.key}`;
    stage.style.width = `${format.width}px`;
    stage.style.height = `${format.height}px`;
    stage.innerHTML = `
      <div class="bda-art-glow"></div>
      <header>
        <div><span>${esc(kicker)}</span><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <aside><b>BDA</b><small>ARENA</small></aside>
      </header>
      <main></main>
      <footer><b>arenabda.com.br</b><span>${esc(tournament?.name || 'Arena BDA')} • Clã BDA</span></footer>`;
    document.body.append(stage);
    return stage;
  }

  function resultContent(stage, tie) {
    const data = aggregate(tie);
    if (!data) return;
    const main = $('main', stage);
    const legs = tie.games;
    const legRows = legs.map(game => {
      const sa = score(game, 'a');
      const sb = score(game, 'b');
      return `<div class="bda-art-leg"><span>${esc(legLabel(game, legs.length))}</span><b>${esc(game.ta)} ${sa == null ? '–' : sa} × ${sb == null ? '–' : sb} ${esc(game.tb)}</b></div>`;
    }).join('');
    const aggregateLine = legs.length > 1
      ? `<div class="bda-art-aggregate"><span>PLACAR AGREGADO</span><b>${data.complete ? `${data.ga} × ${data.gb}` : 'Aguardando os dois jogos'}</b></div>`
      : '';
    main.innerHTML = `
      <section class="bda-art-result">
        <div class="bda-art-team">${teamVisual(data.a)}<h2>${esc(data.a)}</h2></div>
        <div class="bda-art-score"><small>${legs.length > 1 ? 'IDA E VOLTA' : 'PLACAR FINAL'}</small><b>${data.complete || legs.length === 1 ? `${data.ga} × ${data.gb}` : '×'}</b><span>${esc(legs[0]?.phase || '')}</span></div>
        <div class="bda-art-team">${teamVisual(data.b)}<h2>${esc(data.b)}</h2></div>
      </section>
      <section class="bda-art-leg-list">${legRows}${aggregateLine}</section>`;
  }

  function phaseContent(stage, pageGames, pageIndex, pageCount) {
    const main = $('main', stage);
    main.innerHTML = `<section class="bda-art-games-grid">${pageGames.map(game => {
      const sa = score(game, 'a');
      const sb = score(game, 'b');
      return `<article>
        <header><span>${esc(game.phase || 'Fase')}</span><small>${Number(game.leg) === 2 ? 'VOLTA' : Number(game.leg) === 1 && groupedTies(pageGames).some(t => t.games.length > 1 && t.games.includes(game)) ? 'IDA' : ''}</small></header>
        <div class="bda-art-mini-team">${teamVisual(game.ta)}<b>${esc(game.ta)}</b><strong>${sa == null ? '–' : sa}</strong></div>
        <div class="bda-art-mini-team">${teamVisual(game.tb)}<b>${esc(game.tb)}</b><strong>${sb == null ? '–' : sb}</strong></div>
      </article>`;
    }).join('')}</section>${pageCount > 1 ? `<div class="bda-art-page">Página ${pageIndex + 1}/${pageCount}</div>` : ''}`;
  }

  function classificationContent(stage) {
    const source = $('#standCapture') || $('#autoStandings') || $('.auto-standings') || $('.standings-wrap');
    if (!source) throw new Error('A classificação ainda não está disponível');
    const clone = source.cloneNode(true);
    $$('button,input,select,textarea,.admin-only', clone).forEach(element => element.remove());
    clone.querySelectorAll('[hidden]').forEach(element => element.removeAttribute('hidden'));
    clone.classList.add('bda-art-standings-clone');
    $('main', stage).append(clone);
  }

  function chunks(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
    return result;
  }

  async function loadCanvas() {
    if (window.html2canvas) return window.html2canvas;
    return new Promise((resolve, reject) => {
      const old = [...document.scripts].find(script => String(script.src).includes('html2canvas'));
      if (old) {
        old.addEventListener('load', () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('Captura indisponível')), { once: true });
        old.addEventListener('error', reject, { once: true });
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

  async function waitImages(root) {
    await Promise.all($$('img', root).map(img => img.complete
      ? (img.decode?.().catch(() => {}) || Promise.resolve())
      : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 2500);
        })));
  }

  async function captureStage(stage) {
    const html2canvas = await loadCanvas();
    if (document.fonts?.ready) await document.fonts.ready;
    await waitImages(stage);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await html2canvas(stage, {
      backgroundColor: '#07100c',
      scale: 1,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 5000,
      width: stage.offsetWidth,
      height: stage.offsetHeight,
      windowWidth: stage.offsetWidth,
      windowHeight: stage.offsetHeight,
      scrollX: 0,
      scrollY: 0
    });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG indisponível')), 'image/png', 1));
  }

  function objectUrl(blob) {
    return URL.createObjectURL(blob);
  }

  function download(blob, fileName) {
    const url = objectUrl(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function showResults(items, title) {
    $('#bdaArtResult')?.remove();
    const modal = document.createElement('div');
    modal.id = 'bdaArtResult';
    modal.className = 'bda-art-result-modal';
    const mapped = items.map((item, index) => ({ ...item, url: objectUrl(item.blob), index }));
    modal._artItems = mapped;
    modal.innerHTML = `<section role="dialog" aria-modal="true"><header><div><span>ARTE PRONTA</span><b>${esc(title)}</b></div><button type="button" data-art-result-close>×</button></header><main>${mapped.map(item => `<article><img src="${item.url}" alt="${esc(title)}"><footer><span>${item.label}</span><div><button data-art-download="${item.index}">Baixar</button>${navigator.share && typeof File === 'function' ? `<button class="primary" data-art-share="${item.index}">Compartilhar</button>` : ''}</div></footer></article>`).join('')}</main>${mapped.length > 1 ? '<footer><button class="primary" data-art-download-all>Baixar todas</button></footer>' : ''}</section>`;
    document.body.append(modal);
  }

  function closeResults(modal) {
    (modal?._artItems || []).forEach(item => URL.revokeObjectURL(item.url));
    modal?.remove();
  }

  async function generate() {
    if (busy) return;
    const tournament = currentTournament();
    if (!tournament) return notify('Abra um campeonato antes de gerar uma arte');
    const type = $('#bdaArtType')?.value || 'result';
    const format = formatFromModal();
    const allGames = gamesFor(tournament);
    const button = $('#bdaArtGenerate');
    busy = true;
    if (button) { button.disabled = true; button.textContent = '⏳ Gerando...'; }

    try {
      const items = [];
      if (type === 'result') {
        const ties = groupedTies(allGames);
        const tieIndex = Number($('#bdaArtResultGame')?.value || 0);
        const tie = ties[tieIndex];
        if (!tie) throw new Error('Nenhum confronto disponível');
        const stage = frame({ format, tournament, kicker: 'RESULTADO OFICIAL', title: tournament.name, subtitle: tie.games[0]?.phase || '' });
        try { resultContent(stage, tie); items.push({ blob: await captureStage(stage), label: FORMATS[format.key].label, fileName: `${slug(tournament.name)}-${slug(tie.tieId)}-${format.key}.png` }); }
        finally { stage.remove(); }
      } else if (type === 'phase') {
        const phases = [...new Set(allGames.map(game => String(game?.phase || '').trim()).filter(Boolean))];
        const phase = phases[Number($('#bdaArtPhase')?.value || 0)];
        const selected = allGames.filter(game => String(game?.phase || '').trim() === phase);
        if (!selected.length) throw new Error('Essa fase ainda não possui jogos');
        const pages = chunks(selected, format.phasePage);
        for (let index = 0; index < pages.length; index += 1) {
          const stage = frame({ format, tournament, kicker: 'JOGOS DA FASE', title: phase, subtitle: `${selected.length} jogos` });
          try {
            phaseContent(stage, pages[index], index, pages.length);
            items.push({ blob: await captureStage(stage), label: pages.length > 1 ? `Página ${index + 1}/${pages.length}` : FORMATS[format.key].label, fileName: `${slug(tournament.name)}-${slug(phase)}-${String(index + 1).padStart(2, '0')}-${format.key}.png` });
          } finally { stage.remove(); }
        }
      } else {
        const stage = frame({ format, tournament, kicker: 'CLASSIFICAÇÃO', title: tournament.name, subtitle: tournament.phase || '' });
        try { classificationContent(stage); items.push({ blob: await captureStage(stage), label: FORMATS[format.key].label, fileName: `${slug(tournament.name)}-classificacao-${format.key}.png` }); }
        finally { stage.remove(); }
      }
      showResults(items, type === 'result' ? 'Resultado' : type === 'phase' ? 'Fase completa' : 'Classificação');
      notify('Arte gerada com sucesso');
    } catch (error) {
      console.error(error);
      notify(error.message || 'Não foi possível gerar a arte');
    } finally {
      busy = false;
      if (button?.isConnected) { button.disabled = false; button.textContent = '🎨 Gerar arte'; }
    }
  }

  function populateStudio() {
    const tournament = currentTournament();
    const games = gamesFor(tournament);
    const ties = groupedTies(games);
    const phases = [...new Set(games.map(game => String(game?.phase || '').trim()).filter(Boolean))];
    const resultSelect = $('#bdaArtResultGame');
    const phaseSelect = $('#bdaArtPhase');
    if (resultSelect) resultSelect.innerHTML = ties.map((tie, index) => {
      const first = tie.games[0];
      return `<option value="${index}">${esc(first?.ta || 'Time A')} × ${esc(first?.tb || 'Time B')} • ${esc(first?.phase || '')}</option>`;
    }).join('');
    if (phaseSelect) phaseSelect.innerHTML = phases.map((phase, index) => `<option value="${index}">${esc(phase)}</option>`).join('');
    updateStudioVisibility();
  }

  function updateStudioVisibility() {
    const type = $('#bdaArtType')?.value || 'result';
    $('#bdaArtResultLabel')?.toggleAttribute('hidden', type !== 'result');
    $('#bdaArtPhaseLabel')?.toggleAttribute('hidden', type !== 'phase');
    const help = $('#bdaArtHelp');
    if (help) help.textContent = type === 'result'
      ? 'Em confrontos de ida e volta, a arte mostra os dois jogos e o agregado.'
      : type === 'phase'
        ? 'Se houver muitos jogos, a fase é dividida automaticamente em várias artes.'
        : 'A classificação atual do campeonato será encaixada no formato escolhido.';
  }

  function openStudio() {
    if (!adminActive()) return notify('Entre como administrador para gerar artes');
    if (!currentTournament()) return notify('Abra um campeonato primeiro');
    buildStudio();
    populateStudio();
    $('#bdaArtStudio')?.classList.add('show');
  }

  function closeStudio() {
    $('#bdaArtStudio')?.classList.remove('show');
  }

  function buildStudio() {
    if ($('#bdaArtStudio')) return;
    const modal = document.createElement('div');
    modal.id = 'bdaArtStudio';
    modal.className = 'bda-art-modal';
    modal.innerHTML = `<section role="dialog" aria-modal="true"><header><div><span>CENTRAL DE ARTES BDA</span><h2>Gerar imagem profissional</h2><p id="bdaArtHelp"></p></div><button type="button" data-art-close>×</button></header><main><label>Tipo<select id="bdaArtType"><option value="result">Resultado</option><option value="phase">Fase completa</option><option value="standings">Classificação</option></select></label><label>Formato<select id="bdaArtFormat">${Object.entries(FORMATS).map(([key, item]) => `<option value="${key}">${item.label}</option>`).join('')}</select></label><label id="bdaArtResultLabel">Confronto<select id="bdaArtResultGame"></select></label><label id="bdaArtPhaseLabel" hidden>Fase<select id="bdaArtPhase"></select></label></main><footer><button type="button" data-art-close>Cancelar</button><button type="button" class="primary" id="bdaArtGenerate">🎨 Gerar arte</button></footer></section>`;
    document.body.append(modal);
  }

  function injectButton() {
    const tournament = currentTournament();
    if (!tournament || !adminActive()) {
      $('#arenaArtButton')?.remove();
      return false;
    }
    const actions = $('#arenaDetail .arena-actions') || $('#giManager .gi-head > div:last-child');
    if (!actions) return false;
    if (!$('#arenaArtButton')) {
      const button = document.createElement('button');
      button.id = 'arenaArtButton';
      button.type = 'button';
      button.className = 'primary bda-art-open';
      button.textContent = '🎨 Artes';
      actions.append(button);
    }
    return true;
  }

  function scheduleInject(delay = 80) {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(injectButton, delay);
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#arenaArtButton')) {
      event.preventDefault();
      openStudio();
      return;
    }
    if (event.target.closest('[data-art-close]') || event.target === $('#bdaArtStudio')) {
      closeStudio();
      return;
    }
    if (event.target.closest('#bdaArtGenerate')) {
      generate();
      return;
    }
    const resultModal = event.target.closest('#bdaArtResult');
    if (resultModal) {
      if (event.target.closest('[data-art-result-close]') || event.target === resultModal) return closeResults(resultModal);
      const items = resultModal._artItems || [];
      const downloadButton = event.target.closest('[data-art-download]');
      if (downloadButton) {
        const item = items[Number(downloadButton.dataset.artDownload)];
        if (item) download(item.blob, item.fileName);
        return;
      }
      const shareButton = event.target.closest('[data-art-share]');
      if (shareButton) {
        const item = items[Number(shareButton.dataset.artShare)];
        if (!item || !navigator.share || typeof File !== 'function') return;
        const file = new File([item.blob], item.fileName, { type: 'image/png' });
        navigator.share({ title: item.fileName.replace(/\.png$/i, ''), text: 'Arena BDA', files: [file] }).catch(error => {
          if (error?.name !== 'AbortError') notify('Compartilhamento indisponível neste navegador');
        });
        return;
      }
      if (event.target.closest('[data-art-download-all]')) items.forEach((item, index) => setTimeout(() => download(item.blob, item.fileName), index * 180));
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target instanceof Element && event.target.id === 'bdaArtType') updateStudioVisibility();
  });

  ['arena:bundle-loaded', 'arena:matches-updated', 'arena:tournaments-updated', 'arena:permissions-updated', 'arena:cloud-ready']
    .forEach(name => window.addEventListener(name, () => scheduleInject(100)));

  if (window.ArenaDOMEvents?.subscribe) {
    window.ArenaDOMEvents.subscribe(mutations => {
      if (mutations.some(mutation => [...mutation.addedNodes].some(node => node instanceof Element && (node.matches?.('#arenaDetail,#giManager') || node.querySelector?.('#arenaDetail,#giManager'))))) scheduleInject(60);
    }, { selector: '#arenaDetail,#giManager' });
  }

  [300, 1000, 2200].forEach(delay => setTimeout(injectButton, delay));

  const style = document.createElement('style');
  style.id = 'arenaArtStudioStyles';
  style.textContent = `
    .bda-art-open{white-space:nowrap}.bda-art-modal,.bda-art-result-modal{position:fixed;inset:0;z-index:99500;display:none;place-items:center;padding:14px;background:rgba(0,0,0,.88);backdrop-filter:blur(14px)}.bda-art-modal.show{display:grid}.bda-art-modal>section,.bda-art-result-modal>section{width:min(760px,100%);max-height:94dvh;overflow:auto;border:1px solid rgba(242,215,125,.32);border-radius:22px;background:#08110d;box-shadow:0 30px 100px #000}.bda-art-modal header,.bda-art-result-modal header{display:flex;justify-content:space-between;gap:14px;padding:17px;border-bottom:1px solid var(--line)}.bda-art-modal header span,.bda-art-result-modal header span{color:var(--gold-soft);font-size:8px;font-weight:900;letter-spacing:.14em}.bda-art-modal h2{margin:4px 0;font:900 26px "Barlow Condensed",sans-serif;text-transform:uppercase}.bda-art-modal header p{margin:0;color:var(--muted);font-size:9px}.bda-art-modal header button,.bda-art-result-modal header button{width:40px;height:40px;padding:0;border:1px solid var(--line);border-radius:11px;color:#fff;background:#ffffff08;font-size:22px}.bda-art-modal>section>main{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:17px}.bda-art-modal label{font-size:9px;font-weight:900;text-transform:uppercase}.bda-art-modal select{margin-top:6px}.bda-art-modal>section>footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 17px;border-top:1px solid var(--line)}.bda-art-result-modal{display:grid}.bda-art-result-modal>section>main{display:grid;gap:14px;padding:14px}.bda-art-result-modal article{overflow:hidden;border:1px solid var(--line);border-radius:15px;background:#030806}.bda-art-result-modal article img{display:block;width:100%;max-height:64dvh;object-fit:contain;background:#000}.bda-art-result-modal article footer,.bda-art-result-modal>section>footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px}.bda-art-result-modal article footer div{display:flex;gap:7px}.bda-art-stage{position:fixed;left:-30000px;top:0;z-index:-20;box-sizing:border-box;overflow:hidden;padding:64px 70px;color:#f7fbf8;background:radial-gradient(circle at 85% 6%,rgba(216,178,72,.24),transparent 25%),radial-gradient(circle at 5% 90%,rgba(46,175,105,.16),transparent 30%),linear-gradient(145deg,#143824,#050a07 72%);font-family:Inter,Arial,sans-serif}.bda-art-stage>.bda-art-glow{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.025),transparent 65%)}.bda-art-stage>header{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:26px;border-bottom:2px solid rgba(242,215,125,.28)}.bda-art-stage>header span{color:#f0ce67;font-size:13px;font-weight:900;letter-spacing:.18em}.bda-art-stage>header h1{margin:8px 0 5px;font:900 50px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.bda-art-stage>header p{margin:0;color:#b9c8bf;font-size:14px}.bda-art-stage>header aside{display:grid;place-items:center;width:92px;height:92px;border:2px solid #d8b248;border-radius:24px;background:#08110d}.bda-art-stage>header aside b{font-size:28px}.bda-art-stage>header aside small{color:#d8b248;font-size:10px;font-weight:900}.bda-art-stage>main{position:relative;z-index:1;display:flex;min-height:0;flex:1;flex-direction:column;justify-content:center;padding:34px 0}.bda-art-stage>footer{position:absolute;right:70px;bottom:34px;left:70px;z-index:1;display:flex;justify-content:space-between;gap:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,.12);color:#b6c4bb;font-size:12px}.bda-art-stage>footer b{color:#f0ce67}.bda-art-result{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:38px}.bda-art-team{display:grid;place-items:center;text-align:center}.bda-art-team h2{max-width:360px;margin:22px 0 0;font:900 38px/1.05 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.bda-art-shield{display:grid;place-items:center;width:128px;height:128px}.bda-art-shield img{display:block;max-width:100%;max-height:100%;object-fit:contain}.bda-art-initials{border:2px solid #d8b248;border-radius:50%;color:#f0ce67;background:#0b1811;font-size:32px;font-weight:900}.bda-art-score{text-align:center}.bda-art-score small{display:block;color:#d8b248;font-size:12px;font-weight:900;letter-spacing:.13em}.bda-art-score>b{display:block;margin:13px 0;font:900 76px/1 "Barlow Condensed",Arial,sans-serif}.bda-art-score span{color:#b9c8bf;font-size:13px}.bda-art-leg-list{display:grid;gap:8px;margin-top:35px}.bda-art-leg,.bda-art-aggregate{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 17px;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:rgba(2,8,5,.62)}.bda-art-leg span,.bda-art-aggregate span{color:#d8b248;font-size:11px;font-weight:900;text-transform:uppercase}.bda-art-leg b{font-size:13px}.bda-art-aggregate b{font-size:20px}.bda-art-games-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.bda-art-games-grid article{padding:16px;border:1px solid rgba(242,215,125,.2);border-radius:18px;background:rgba(3,9,6,.72)}.bda-art-games-grid article>header{display:flex;justify-content:space-between;margin-bottom:12px;color:#d8b248;font-size:10px;font-weight:900;text-transform:uppercase}.bda-art-mini-team{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}.bda-art-mini-team:first-of-type{border-top:0}.bda-art-mini-team .bda-art-shield{width:44px;height:44px}.bda-art-mini-team .bda-art-initials{font-size:12px}.bda-art-mini-team b{font-size:13px}.bda-art-mini-team strong{font-size:26px}.bda-art-page{margin-top:14px;color:#b9c8bf;font-size:12px;text-align:center}.bda-art-standings-clone{width:100%!important;max-width:none!important;overflow:visible!important;transform-origin:top left}.bda-art-standings-clone table{width:100%!important;font-size:13px!important}.bda-art-story .bda-art-games-grid{grid-template-columns:1fr}.bda-art-story .bda-art-result{grid-template-columns:1fr;gap:22px}.bda-art-story .bda-art-team h2{font-size:34px}.bda-art-story .bda-art-score>b{font-size:64px}.bda-art-wide .bda-art-result{gap:75px}.bda-art-wide .bda-art-games-grid{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:620px){.bda-art-modal>section>main{grid-template-columns:1fr}.bda-art-modal h2{font-size:22px}.bda-art-modal>section>footer{display:grid;grid-template-columns:1fr 1fr}.bda-art-result-modal article footer{align-items:flex-start;flex-direction:column}.bda-art-result-modal article footer div{width:100%}.bda-art-result-modal article footer button{flex:1}}
  `;
  document.head.append(style);

  window.ArenaBDAArtStudio = Object.freeze({ version: VERSION, open: openStudio, refresh: injectButton, formats: FORMATS });
})();
