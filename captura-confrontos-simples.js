(() => {
  'use strict';

  if (window.ArenaBDASimpleCapture) return;

  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const slug = value => String(value || 'arena-bda')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'arena-bda';
  const notify = message => typeof window.toast === 'function' ? window.toast(message) : console.info(message);

  let busy = false;
  let managerObserver = null;
  let attachObserver = null;
  let scheduled = false;

  function loadCapture() {
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => String(script.src || '').includes('html2canvas'));
      if (existing) {
        existing.addEventListener('load', () => typeof window.html2canvas === 'function' ? resolve(window.html2canvas) : reject(new Error('Captura indisponível')), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.onload = () => typeof window.html2canvas === 'function' ? resolve(window.html2canvas) : reject(new Error('Captura indisponível'));
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function championshipName() {
    return $('#giManager .gi-head h2')?.textContent?.trim()
      || $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim()
      || 'Arena BDA';
  }

  function initials(name) {
    return String(name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

  function scoreValues(card) {
    const central = $$('.gip-scoreboard > .gi-score-input, .gip-scoreboard > .gi-score', card)
      .slice(0, 2)
      .map(element => {
        const raw = 'value' in element ? element.value : element.textContent;
        return String(raw ?? '').trim() || '–';
      });
    if (central.length === 2) return central;

    return $$('.gi-team', card).slice(0, 2).map(team => {
      const input = $('input[type="number"]', team);
      const raw = input ? input.value : $('.gi-score', team)?.textContent;
      return String(raw ?? '').trim() || '–';
    });
  }

  function teamData(team, score = '–') {
    const name = $('strong', team)?.textContent?.trim() || 'A definir';
    const image = $('img', team)?.currentSrc || $('img', team)?.src || '';
    return { name, image, badge: $('.gi-badge', team)?.textContent?.trim() || initials(name), score };
  }

  function gameData(card) {
    const teams = $$('.gi-team', card).slice(0, 2);
    const scores = scoreValues(card);
    const header = $(':scope > header', card);
    return {
      a: teamData(teams[0], scores[0] || '–'),
      b: teamData(teams[1], scores[1] || '–'),
      status: $('span', header)?.textContent?.trim() || 'Confronto',
      meta: $('small', header)?.textContent?.trim() || '',
      aggregate: $('.gi-agg b', card)?.textContent?.trim() || ''
    };
  }

  function badgeHtml(team) {
    return team.image
      ? `<span class="bda-print-badge"><img crossorigin="anonymous" src="${esc(team.image)}" alt="Escudo de ${esc(team.name)}"></span>`
      : `<span class="bda-print-badge fallback">${esc(team.badge)}</span>`;
  }

  function gameRowHtml(game) {
    return `<article class="bda-print-game-row">
      <div class="bda-print-team">${badgeHtml(game.a)}<b>${esc(game.a.name)}</b></div>
      <div class="bda-print-score"><small>${esc(game.status)}</small><strong>${esc(game.a.score)} <i>×</i> ${esc(game.b.score)}</strong>${game.meta ? `<span>${esc(game.meta)}</span>` : ''}</div>
      <div class="bda-print-team away"><b>${esc(game.b.name)}</b>${badgeHtml(game.b)}</div>
      ${game.aggregate ? `<footer>Agregado: <b>${esc(game.aggregate)}</b></footer>` : ''}
    </article>`;
  }

  function createStage(type, source) {
    const stage = document.createElement('section');
    stage.className = `bda-simple-capture-stage ${type}`;
    const competition = championshipName();

    if (type === 'phase') {
      const title = $('h3', source)?.textContent?.trim() || 'Fase';
      const games = $$('.gi-game', source).map(gameData);
      stage.innerHTML = `
        <header class="bda-print-head"><div><span>ARENA BDA • FASE OFICIAL</span><h1>${esc(title)}</h1><p>${esc(competition)} • ${games.length} ${games.length === 1 ? 'confronto' : 'confrontos'}</p></div><b>BDA</b></header>
        <main class="bda-print-phase-grid">${games.map(gameRowHtml).join('')}</main>
        <footer class="bda-print-footer"><b>arenabda.com.br</b><span>Clã BDA • Boleiros de Atitude</span></footer>`;
      stage.dataset.filename = `${competition}-${title}`;
      stage.dataset.title = title;
    } else {
      const game = gameData(source);
      const phase = source.closest('.gi-phase')?.querySelector('h3')?.textContent?.trim() || 'Confronto';
      stage.innerHTML = `
        <header class="bda-print-head"><div><span>ARENA BDA • ${esc(phase)}</span><h1>CONFRONTO OFICIAL</h1><p>${esc(competition)}</p></div><b>BDA</b></header>
        <main class="bda-print-single">
          <article>${badgeHtml(game.a)}<h2>${esc(game.a.name)}</h2></article>
          <div class="bda-print-single-score"><small>${esc(game.status)}</small><strong>${esc(game.a.score)} <i>×</i> ${esc(game.b.score)}</strong>${game.meta ? `<span>${esc(game.meta)}</span>` : ''}${game.aggregate ? `<em>Agregado: ${esc(game.aggregate)}</em>` : ''}</div>
          <article>${badgeHtml(game.b)}<h2>${esc(game.b.name)}</h2></article>
        </main>
        <footer class="bda-print-footer"><b>arenabda.com.br</b><span>Clã BDA • Boleiros de Atitude</span></footer>`;
      stage.dataset.filename = `${game.a.name}-x-${game.b.name}`;
      stage.dataset.title = `${game.a.name} × ${game.b.name}`;
    }

    document.body.append(stage);
    return stage;
  }

  async function waitForImages(root) {
    await Promise.all($$('img', root).map(image => {
      if (image.complete) return image.decode?.().catch(() => {}) || Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 3500);
      });
    }));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug(filename)}-arena-bda.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function capture(type, source, button) {
    if (!source || busy) return;
    busy = true;
    const original = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Gerando...';
    }
    notify(type === 'phase' ? 'Gerando print da fase...' : 'Gerando print do jogo...');

    const stage = createStage(type, source);
    try {
      const html2canvas = await loadCapture();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(stage);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await html2canvas(stage, {
        backgroundColor: '#07100c',
        scale: 1,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 6000,
        width: 1080,
        windowWidth: 1080,
        scrollX: 0,
        scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG')), 'image/png', 1));
      downloadBlob(blob, stage.dataset.filename || stage.dataset.title || 'arena-bda');
      notify('Print salvo em PNG');
    } catch (error) {
      console.error(error);
      notify('Não foi possível gerar o print');
    } finally {
      stage.remove();
      busy = false;
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  function removeOldCaptureControls(root = document) {
    $$('[data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo,[data-old-match-photo]', root).forEach(element => element.remove());
    $('#artConfigurator')?.remove();
    $('#artCapturePreview')?.remove();
    $('#cfpStudio')?.remove();
    $('#cfpReady')?.remove();
    document.body.classList.remove('art-config-open', 'art-preview-open', 'cfp-studio-open');
  }

  function addPhaseButton(phase) {
    if (phase.querySelector(':scope > .bda-simple-phase-actions, :scope > header .bda-simple-phase-print')) return;
    const header = $(':scope > header', phase) || $('h3', phase)?.parentElement || phase;
    const wrap = document.createElement('div');
    wrap.className = 'bda-simple-phase-actions';
    wrap.innerHTML = '<button type="button" class="bda-simple-print-button bda-simple-phase-print">📸 Print da fase</button>';
    header.append(wrap);
  }

  function addGameButton(game) {
    if ($('.bda-simple-game-print', game)) return;
    const footer = $('.gip-footer, .gi-game-actions, :scope > footer', game) || game;
    const wrap = document.createElement('div');
    wrap.className = 'bda-simple-game-actions';
    wrap.innerHTML = '<button type="button" class="bda-simple-print-button bda-simple-game-print">📸 Print do jogo</button>';
    footer.append(wrap);
  }

  function apply() {
    scheduled = false;
    const manager = $('#giManager');
    if (!manager) return;
    removeOldCaptureControls(manager);
    $$('.gi-phase', manager).forEach(addPhaseButton);
    $$('.gi-game', manager).forEach(addGameButton);
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function observeManager() {
    const manager = $('#giManager');
    if (!manager) return false;
    attachObserver?.disconnect();
    attachObserver = null;
    managerObserver?.disconnect();
    managerObserver = new MutationObserver(scheduleApply);
    managerObserver.observe(manager, { childList: true, subtree: true });
    scheduleApply();
    return true;
  }

  function start() {
    if (observeManager()) return;
    attachObserver = new MutationObserver(() => observeManager());
    attachObserver.observe(document.body, { childList: true, subtree: true });
    [300, 900, 1800, 3200].forEach(delay => setTimeout(observeManager, delay));
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('.bda-simple-print-button') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (button.classList.contains('bda-simple-phase-print')) capture('phase', button.closest('.gi-phase'), button);
    else capture('game', button.closest('.gi-game'), button);
  }, true);

  window.addEventListener('arena:matches-updated', scheduleApply);
  window.addEventListener('arena:quick-score-saved', scheduleApply);

  const style = document.createElement('style');
  style.id = 'arenaSimpleCaptureStyles';
  style.textContent = `
    [data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo,[data-old-match-photo]{display:none!important}
    .bda-simple-phase-actions,.bda-simple-game-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:8px}
    .bda-simple-print-button{min-height:36px;padding:0 11px;border:1px solid rgba(242,215,125,.28);border-radius:11px;color:#f5df91;background:rgba(242,215,125,.08);font-size:9px;font-weight:900;letter-spacing:.02em;white-space:nowrap}
    .bda-simple-print-button:disabled{opacity:.55}
    .bda-simple-capture-stage{position:fixed;left:-20000px;top:0;z-index:-20;box-sizing:border-box;width:1080px;min-height:1080px;padding:54px;color:#f8fbf8;background:radial-gradient(circle at 82% 0,rgba(226,187,65,.18),transparent 28%),linear-gradient(150deg,#12321f,#040a06 72%);font-family:Inter,Arial,sans-serif}
    .bda-simple-capture-stage.phase{min-height:0}
    .bda-print-head{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:28px;border-bottom:2px solid rgba(242,215,125,.28)}
    .bda-print-head span{color:#f0ce67;font-size:13px;font-weight:900;letter-spacing:.18em}
    .bda-print-head h1{margin:8px 0 5px;color:#fff;font:900 48px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}
    .bda-print-head p{margin:0;color:#a9b9ae;font-size:14px}
    .bda-print-head>b{display:grid;place-items:center;width:78px;height:78px;border:2px solid rgba(242,215,125,.45);border-radius:22px;color:#07100c;background:linear-gradient(145deg,#fff2b3,#d4a92d);font-size:25px;box-shadow:0 14px 34px #0008}
    .bda-print-phase-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:30px 0}
    .bda-print-game-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 180px minmax(0,1fr);align-items:center;gap:12px;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(0,0,0,.25);box-shadow:0 12px 28px #0004}
    .bda-print-team{display:flex;align-items:center;gap:10px;min-width:0}.bda-print-team.away{justify-content:flex-end;text-align:right}
    .bda-print-team b{overflow:hidden;color:#fff;font-size:13px;text-overflow:ellipsis;white-space:nowrap}
    .bda-print-badge{overflow:hidden;display:grid;place-items:center;flex:0 0 54px;width:54px;height:54px;border:2px solid rgba(242,215,125,.30);border-radius:50%;color:#07100c;background:#f2d77d;font-size:15px;font-weight:900}
    .bda-print-badge img{width:100%;height:100%;object-fit:contain}.bda-print-badge.fallback{background:linear-gradient(145deg,#fff1ac,#c89519)}
    .bda-print-score{text-align:center}.bda-print-score small,.bda-print-score span{display:block;color:#94aa9b;font-size:9px}.bda-print-score strong{display:block;margin:6px 0;color:#fff;font:900 31px/1 "Barlow Condensed",Arial,sans-serif}.bda-print-score i,.bda-print-single-score i{color:#f0ce67;font-style:normal}
    .bda-print-game-row>footer{grid-column:1/-1;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);color:#9eb0a3;font-size:10px;text-align:center}.bda-print-game-row>footer b{color:#f0ce67}
    .bda-print-single{display:grid;grid-template-columns:1fr 280px 1fr;align-items:center;gap:34px;min-height:700px;padding:42px 0;text-align:center}
    .bda-print-single article{display:grid;justify-items:center}.bda-print-single .bda-print-badge{width:220px;height:220px;flex-basis:220px;border-width:5px;box-shadow:0 24px 60px #0009}
    .bda-print-single h2{max-width:300px;margin:24px 0 0;color:#fff;font:900 42px/.95 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}
    .bda-print-single-score small,.bda-print-single-score span,.bda-print-single-score em{display:block}.bda-print-single-score small{color:#f0ce67;font-size:13px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.bda-print-single-score strong{display:block;margin:18px 0;color:#fff;font:900 94px/1 "Barlow Condensed",Arial,sans-serif}.bda-print-single-score span{color:#a9b9ae;font-size:14px}.bda-print-single-score em{margin-top:16px;color:#f0ce67;font-size:16px;font-style:normal;font-weight:900}
    .bda-print-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:24px;border-top:2px solid rgba(242,215,125,.24);color:#9fb0a5;font-size:12px}.bda-print-footer b{color:#f0ce67;font-size:15px}
    @media(max-width:720px){.bda-simple-phase-actions,.bda-simple-game-actions{justify-content:stretch}.bda-simple-print-button{width:100%}}
  `;
  document.head.append(style);

  window.ArenaBDASimpleCapture = Object.freeze({ refresh: scheduleApply, captureGame: game => capture('game', game), capturePhase: phase => capture('phase', phase) });
  start();
})();