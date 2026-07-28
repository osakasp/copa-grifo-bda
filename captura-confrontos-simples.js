(() => {
  'use strict';
  if (window.ArenaBDASimpleCapture) return;

  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = text => typeof window.toast === 'function' ? window.toast(text) : console.info(text);
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = value => String(value || 'arena-bda').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arena-bda';
  let busy = false;
  let timer = 0;

  function loadCanvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
      const old = [...document.scripts].find(s => String(s.src).includes('html2canvas'));
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

  function gameName(game) {
    const names = $$('.gi-team strong', game).slice(0, 2).map(el => el.textContent.trim());
    return names.length === 2 ? `${names[0]} × ${names[1]}` : 'Confronto';
  }

  function prepareClone(source) {
    const clone = source.cloneNode(true);
    $$('.gi-score-input', clone).forEach(input => {
      const score = document.createElement('b');
      score.className = 'gi-score';
      score.textContent = input.value.trim() || '–';
      input.replaceWith(score);
    });
    $$('button,input,select,textarea,.gi-editor,.bda-capture-toolbar,.bda-simple-print', clone).forEach(el => el.remove());
    clone.querySelectorAll('[hidden]').forEach(el => el.removeAttribute('hidden'));
    return clone;
  }

  function makeStage(source, type) {
    const competition = $('#giManager .gi-head h2')?.textContent?.trim() || 'Arena BDA';
    const title = type === 'phase'
      ? $('h3', source)?.textContent?.trim() || 'Fase'
      : gameName(source);
    const stage = document.createElement('section');
    stage.className = `bda-capture-stage bda-capture-${type}`;
    stage.innerHTML = `<header><div><span>ARENA BDA</span><h1>${esc(title)}</h1><p>${esc(competition)}</p></div><b>BDA</b></header><main></main><footer><b>arenabda.com.br</b><span>Clã BDA • Boleiros de Atitude</span></footer>`;
    $('main', stage).append(prepareClone(source));
    stage.dataset.file = title;
    document.body.append(stage);
    return stage;
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

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(name)}-arena-bda.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function capture(source, type, button) {
    if (!source || busy) return;
    busy = true;
    const oldText = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = '⏳ Gerando...'; }
    const stage = makeStage(source, type);
    toast(type === 'phase' ? 'Gerando print da fase...' : 'Gerando print do jogo...');
    try {
      const html2canvas = await loadCanvas();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitImages(stage);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const height = Math.max(1080, stage.scrollHeight);
      stage.style.height = `${height}px`;
      const canvas = await html2canvas(stage, {
        backgroundColor: '#07100c', scale: 1, useCORS: true, allowTaint: false,
        logging: false, imageTimeout: 5000, width: 1080, height,
        windowWidth: 1080, windowHeight: height, scrollX: 0, scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG indisponível')), 'image/png', 1));
      download(blob, stage.dataset.file);
      toast('Print salvo em PNG');
    } catch (error) {
      console.error(error);
      toast('Não foi possível gerar o print');
    } finally {
      stage.remove();
      busy = false;
      if (button?.isConnected) { button.disabled = false; button.textContent = oldText; }
    }
  }

  function removeOld() {
    $$('[data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo,[data-old-match-photo]').forEach(el => el.remove());
    ['#artConfigurator','#artCapturePreview','#cfpStudio','#cfpReady'].forEach(s => $(s)?.remove());
  }

  function ensureToolbar() {
    removeOld();
    const manager = $('#giManager');
    const head = $('.gi-head', manager || document);
    if (!manager || !head) return;
    let bar = $('.bda-capture-toolbar', manager);
    if (!bar) {
      bar = document.createElement('section');
      bar.className = 'bda-capture-toolbar';
      bar.innerHTML = `<header><div><span>IMAGENS</span><b>Print rápido</b></div><small>Escolha e baixe direto.</small></header><div><label>Fase<select data-cap-phase></select></label><button type="button" data-cap-phase-btn>📸 Print da fase</button><label>Jogo<select data-cap-game></select></label><button type="button" data-cap-game-btn>📸 Print do jogo</button></div>`;
      head.insertAdjacentElement('afterend', bar);
    }
    const phases = $$('.gi-phase', manager);
    const games = $$('.gi-game', manager);
    const phaseSignature = phases.map(p => $('h3', p)?.textContent || '').join('|');
    const gameSignature = games.map(gameName).join('|');
    if (bar.dataset.phaseSignature !== phaseSignature) {
      bar.dataset.phaseSignature = phaseSignature;
      $('[data-cap-phase]', bar).innerHTML = phases.map((p, i) => `<option value="${i}">${esc($('h3', p)?.textContent || `Fase ${i + 1}`)}</option>`).join('');
    }
    if (bar.dataset.gameSignature !== gameSignature) {
      bar.dataset.gameSignature = gameSignature;
      $('[data-cap-game]', bar).innerHTML = games.map((g, i) => `<option value="${i}">${esc(gameName(g))}</option>`).join('');
    }
    $('[data-cap-phase]', bar).disabled = !phases.length;
    $('[data-cap-game]', bar).disabled = !games.length;
    $('[data-cap-phase-btn]', bar).disabled = !phases.length;
    $('[data-cap-game-btn]', bar).disabled = !games.length;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(ensureToolbar, 30);
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-cap-phase-btn],[data-cap-game-btn]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const manager = $('#giManager');
    const bar = button.closest('.bda-capture-toolbar');
    if (button.hasAttribute('data-cap-phase-btn')) {
      capture($$('.gi-phase', manager)[Number($('[data-cap-phase]', bar)?.value || 0)], 'phase', button);
    } else {
      capture($$('.gi-game', manager)[Number($('[data-cap-game]', bar)?.value || 0)], 'game', button);
    }
  }, true);

  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(node => node instanceof Element && (node.id === 'giManager' || node.matches?.('.gi-content,.gi-phase,.gi-game') || node.querySelector?.('#giManager,.gi-phase,.gi-game'))))) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ['arena:matches-updated','arena:quick-score-saved','arena:permissions-updated'].forEach(name => window.addEventListener(name, schedule));

  const style = document.createElement('style');
  style.textContent = `
    [data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo,[data-old-match-photo]{display:none!important}
    .bda-capture-toolbar{display:grid;gap:10px;margin:10px 0;padding:13px;border:1px solid rgba(242,215,125,.28);border-radius:16px;background:linear-gradient(145deg,rgba(242,215,125,.11),rgba(4,12,8,.9))}.bda-capture-toolbar>header{display:flex;align-items:end;justify-content:space-between;gap:10px}.bda-capture-toolbar>header span,.bda-capture-toolbar>header b{display:block}.bda-capture-toolbar>header span{color:var(--gold-soft);font-size:7px;font-weight:900;letter-spacing:.15em}.bda-capture-toolbar>header b{margin-top:3px;font-size:15px;text-transform:uppercase}.bda-capture-toolbar>header small{color:var(--muted);font-size:8px}.bda-capture-toolbar>div{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto;gap:8px;align-items:end}.bda-capture-toolbar select{min-height:40px;padding:8px;font-size:9px}.bda-capture-toolbar button{min-height:40px;padding:0 12px;border:1px solid var(--gold);border-radius:11px;color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold));font-size:9px;font-weight:900;white-space:nowrap}.bda-capture-toolbar button:disabled{opacity:.45}
    .bda-capture-stage{position:fixed;left:-20000px;top:0;z-index:-10;box-sizing:border-box;width:1080px;min-height:1080px;padding:52px;color:#f7faf7;background:radial-gradient(circle at 85% 0,rgba(216,178,72,.2),transparent 28%),linear-gradient(150deg,#143723,#050b07 72%);font-family:Inter,Arial,sans-serif}.bda-capture-stage>header{display:flex;align-items:center;justify-content:space-between;gap:22px;padding-bottom:25px;border-bottom:2px solid rgba(242,215,125,.28)}.bda-capture-stage>header span{color:#f0ce67;font-size:12px;font-weight:900;letter-spacing:.18em}.bda-capture-stage>header h1{margin:7px 0 4px;color:#fff;font:900 48px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.bda-capture-stage>header p{margin:0;color:#a9b9ae;font-size:13px}.bda-capture-stage>header>b{display:grid;place-items:center;width:76px;height:76px;border-radius:21px;color:#07100c;background:linear-gradient(145deg,#fff2b3,#d4a92d);font-size:24px}.bda-capture-stage>main{margin:28px 0}.bda-capture-stage>main>.gi-phase{margin:0}.bda-capture-stage>main>.gi-game{max-width:920px;margin:auto}.bda-capture-stage>footer{display:flex;justify-content:space-between;gap:20px;padding-top:22px;border-top:2px solid rgba(242,215,125,.24);color:#9fb0a5;font-size:12px}.bda-capture-stage>footer b{color:#f0ce67}
    @media(max-width:760px){.bda-capture-toolbar>header{align-items:start;flex-direction:column}.bda-capture-toolbar>div{grid-template-columns:1fr}.bda-capture-toolbar button{width:100%}}
  `;
  document.head.append(style);

  window.ArenaBDASimpleCapture = Object.freeze({ refresh: schedule, capture });
  schedule();
  [150,500,1200,2500].forEach(delay => setTimeout(schedule, delay));
})();