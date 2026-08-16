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

  function adminActive() {
    return Boolean(window.ArenaBDAAuth?.isAdmin?.() || document.documentElement.classList.contains('arena-admin-authenticated'));
  }

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

  function showResult(blob, name) {
    $('#bdaCaptureResult')?.remove();
    const url = URL.createObjectURL(blob);
    const fileName = `${slug(name)}-arena-bda.png`;
    const modal = document.createElement('div');
    modal.id = 'bdaCaptureResult';
    modal.className = 'bda-capture-result';
    modal.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Imagem gerada"><header><div><span>IMAGEM PRONTA</span><b>${esc(name)}</b></div><button type="button" data-cap-close aria-label="Fechar">×</button></header><img src="${url}" alt="Prévia da imagem gerada"><footer><button type="button" class="secondary" data-cap-download>Baixar PNG</button><button type="button" class="primary" data-cap-share>Compartilhar</button></footer></section>`;
    modal._capture = { blob, name, fileName, url };
    document.body.append(modal);
    if (!navigator.share || typeof File !== 'function') $('[data-cap-share]', modal).hidden = true;
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
      const requestedScale = Number($('[data-cap-quality]', button?.closest('.bda-capture-toolbar'))?.value || 1.5);
      const safeScale = Math.min(requestedScale, Math.sqrt(28000000 / (1080 * height)));
      stage.style.height = `${height}px`;
      const canvas = await html2canvas(stage, {
        backgroundColor: '#07100c', scale: Math.max(1, safeScale), useCORS: true, allowTaint: false,
        logging: false, imageTimeout: 5000, width: 1080, height,
        windowWidth: 1080, windowHeight: height, scrollX: 0, scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG indisponível')), 'image/png', 1));
      showResult(blob, stage.dataset.file);
      toast(`Imagem pronta em ${canvas.width} × ${canvas.height}px`);
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
    if (!adminActive()) {
      $('.bda-capture-toolbar', manager)?.remove();
      return;
    }
    let bar = $('.bda-capture-toolbar', manager);
    if (!bar) {
      bar = document.createElement('section');
      bar.className = 'bda-capture-toolbar';
      bar.innerHTML = `<header><div><span>IMAGENS</span><b>Central de imagens</b></div><small>Prévia, alta resolução e compartilhamento.</small></header><div><label>Qualidade<select data-cap-quality><option value="1">HD • rápido</option><option value="1.5" selected>Full HD • recomendado</option><option value="2">Ultra • redes sociais</option></select></label><label>Fase<select data-cap-phase></select></label><button type="button" data-cap-phase-btn>📸 Gerar fase</button><label>Jogo<select data-cap-game></select></label><button type="button" data-cap-game-btn>📸 Gerar jogo</button></div>`;
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
    const result = event.target instanceof Element ? event.target.closest('#bdaCaptureResult') : null;
    if (result) {
      const data = result._capture;
      if (event.target.closest('[data-cap-close]') || event.target === result) {
        URL.revokeObjectURL(data.url);
        result.remove();
      } else if (event.target.closest('[data-cap-download]')) {
        download(data.blob, data.name);
      } else if (event.target.closest('[data-cap-share]')) {
        const file = new File([data.blob], data.fileName, { type: 'image/png' });
        navigator.share({ title: data.name, text: 'Arena BDA', files: [file] }).catch(error => {
          if (error?.name !== 'AbortError') toast('Compartilhamento indisponível neste navegador');
        });
      }
      return;
    }
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

  window.ArenaDOMEvents.subscribe(mutations => {
    if (mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(node => node instanceof Element && (node.id === 'giManager' || node.matches?.('.gi-content,.gi-phase,.gi-game') || node.querySelector?.('#giManager,.gi-phase,.gi-game'))))) schedule();
  }, { selector: '#giManager,.gi-content,.gi-phase,.gi-game' });
  ['arena:matches-updated','arena:quick-score-saved','arena:permissions-updated'].forEach(name => window.addEventListener(name, schedule));

  const style = document.createElement('style');
  style.textContent = `
    [data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo,[data-old-match-photo]{display:none!important}
    .bda-capture-toolbar{display:grid;gap:10px;margin:10px 0;padding:13px;border:1px solid rgba(242,215,125,.28);border-radius:16px;background:linear-gradient(145deg,rgba(242,215,125,.11),rgba(4,12,8,.9))}.bda-capture-toolbar>header{display:flex;align-items:end;justify-content:space-between;gap:10px}.bda-capture-toolbar>header span,.bda-capture-toolbar>header b{display:block}.bda-capture-toolbar>header span{color:var(--gold-soft);font-size:7px;font-weight:900;letter-spacing:.15em}.bda-capture-toolbar>header b{margin-top:3px;font-size:15px;text-transform:uppercase}.bda-capture-toolbar>header small{color:var(--muted);font-size:8px}.bda-capture-toolbar>div{display:grid;grid-template-columns:minmax(130px,.7fr) minmax(0,1fr) auto minmax(0,1fr) auto;gap:8px;align-items:end}.bda-capture-toolbar select{min-height:40px;padding:8px;font-size:9px}.bda-capture-toolbar button{min-height:40px;padding:0 12px;border:1px solid var(--gold);border-radius:11px;color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold));font-size:9px;font-weight:900;white-space:nowrap}.bda-capture-toolbar button:disabled{opacity:.45}
    .bda-capture-result{position:fixed;inset:0;z-index:99000;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.9);backdrop-filter:blur(14px)}.bda-capture-result>section{overflow:auto;width:min(780px,100%);max-height:94dvh;border:1px solid rgba(242,215,125,.4);border-radius:22px;background:#07100c;box-shadow:0 35px 110px #000}.bda-capture-result header,.bda-capture-result footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-bottom:1px solid var(--line)}.bda-capture-result header span,.bda-capture-result header b{display:block}.bda-capture-result header span{color:var(--green);font-size:8px;font-weight:900}.bda-capture-result header b{margin-top:3px;font-size:13px}.bda-capture-result header button{width:40px;height:40px;padding:0;border:1px solid var(--line);border-radius:11px;color:#fff;background:#ffffff08;font-size:23px}.bda-capture-result img{display:block;width:100%;max-height:65dvh;object-fit:contain;background:#030806}.bda-capture-result footer{justify-content:flex-end;border-top:1px solid var(--line);border-bottom:0}
    .bda-capture-stage{position:fixed;left:-20000px;top:0;z-index:-10;box-sizing:border-box;width:1080px;min-height:1080px;padding:52px;color:#f7faf7;background:radial-gradient(circle at 85% 0,rgba(216,178,72,.2),transparent 28%),linear-gradient(150deg,#143723,#050b07 72%);font-family:Inter,Arial,sans-serif}.bda-capture-stage>header{display:flex;align-items:center;justify-content:space-between;gap:22px;padding-bottom:25px;border-bottom:2px solid rgba(242,215,125,.28)}.bda-capture-stage>header span{color:#f0ce67;font-size:12px;font-weight:900;letter-spacing:.18em}.bda-capture-stage>header h1{margin:7px 0 4px;color:#fff;font:900 48px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.bda-capture-stage>header p{margin:0;color:#a9b9ae;font-size:13px}.bda-capture-stage>header>b{display:grid;place-items:center;width:76px;height:76px;border-radius:21px;color:#07100c;background:linear-gradient(145deg,#fff2b3,#d4a92d);font-size:24px}.bda-capture-stage>main{margin:28px 0}.bda-capture-stage>main>.gi-phase{margin:0}.bda-capture-stage>main>.gi-game{max-width:920px;margin:auto}.bda-capture-stage>footer{display:flex;justify-content:space-between;gap:20px;padding-top:22px;border-top:2px solid rgba(242,215,125,.24);color:#9fb0a5;font-size:12px}.bda-capture-stage>footer b{color:#f0ce67}
    @media(max-width:760px){.bda-capture-toolbar>header{align-items:start;flex-direction:column}.bda-capture-toolbar>div{grid-template-columns:1fr}.bda-capture-toolbar button{width:100%}}
  `;
  document.head.append(style);

  window.ArenaBDASimpleCapture = Object.freeze({ refresh: schedule, capture });
  schedule();
  [150,500,1200,2500].forEach(delay => setTimeout(schedule, delay));
})();
