(() => {
  'use strict';

  if (window.ArenaBDAPhaseBatchCapture?.version >= 1) return;

  const VERSION = 1;
  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const MAX_GAMES_PER_PAGE = 8;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = text => typeof window.toast === 'function' ? window.toast(text) : console.info(text);
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

  let busy = false;
  let enhanceTimer = 0;

  function adminActive() {
    return Boolean(
      window.ArenaBDAAuth?.isAdmin?.()
      || document.documentElement.classList.contains('arena-admin-authenticated')
    );
  }

  function loadCanvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
      const old = [...document.scripts].find(script => String(script.src).includes('html2canvas'));
      if (old) {
        const finish = () => window.html2canvas
          ? resolve(window.html2canvas)
          : reject(new Error('Captura indisponível'));
        if (window.html2canvas) return finish();
        old.addEventListener('load', finish, { once: true });
        old.addEventListener('error', reject, { once: true });
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

  function phaseName(phase, index = 0) {
    return $('h3', phase)?.textContent?.trim() || `Fase ${index + 1}`;
  }

  function competitionName() {
    return $('#giManager .gi-head h2')?.textContent?.trim() || 'Arena BDA';
  }

  function prepareGameClone(source) {
    const clone = source.cloneNode(true);
    $$('.gi-score-input', clone).forEach(input => {
      const score = document.createElement('b');
      score.className = 'gi-score';
      score.textContent = String(input.value || '').trim() || '–';
      input.replaceWith(score);
    });
    $$('button,input,select,textarea,.gi-editor,.bda-capture-toolbar,.bda-simple-print', clone)
      .forEach(element => element.remove());
    clone.querySelectorAll('[hidden]').forEach(element => element.removeAttribute('hidden'));
    clone.classList.add('bda-batch-game');
    return clone;
  }

  function chunk(values, size) {
    const pages = [];
    for (let index = 0; index < values.length; index += size) pages.push(values.slice(index, index + size));
    return pages;
  }

  function makeStage(games, phaseTitle, pageIndex, pageCount, totalGames) {
    const stage = document.createElement('section');
    stage.className = 'bda-phase-batch-stage';
    const start = pageIndex * MAX_GAMES_PER_PAGE + 1;
    const end = Math.min(totalGames, start + games.length - 1);
    stage.innerHTML = `
      <header>
        <div><span>ARENA BDA • FASE COMPLETA</span><h1>${esc(phaseTitle)}</h1><p>${esc(competitionName())}</p></div>
        <aside><b>${start}–${end}</b><span>de ${totalGames} jogos</span></aside>
      </header>
      <main class="bda-phase-batch-grid"></main>
      <footer><b>arenabda.com.br</b><span>Clã BDA • Boleiros de Atitude${pageCount > 1 ? ` • Página ${pageIndex + 1}/${pageCount}` : ''}</span></footer>`;
    const grid = $('.bda-phase-batch-grid', stage);
    games.forEach(game => grid.append(prepareGameClone(game)));
    document.body.append(stage);
    return stage;
  }

  async function waitImages(root) {
    await Promise.all($$('img', root).map(img => img.complete
      ? (img.decode?.().catch(() => {}) || Promise.resolve())
      : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
          window.setTimeout(resolve, 2200);
        })));
  }

  function quality(bar) {
    return Math.max(1, Math.min(2, Number($('[data-cap-quality]', bar)?.value || 1.5)));
  }

  async function stageToBlob(stage, scale) {
    const html2canvas = await loadCanvas();
    if (document.fonts?.ready) await document.fonts.ready;
    await waitImages(stage);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const height = Math.max(1080, Math.ceil(stage.scrollHeight));
    const safeScale = Math.max(1, Math.min(scale, Math.sqrt(24000000 / (1080 * height))));
    stage.style.height = `${height}px`;
    const canvas = await html2canvas(stage, {
      backgroundColor: '#07100c',
      scale: safeScale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 4500,
      width: 1080,
      height,
      windowWidth: 1080,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG indisponível')), 'image/png', 1);
    });
    return { blob, width: canvas.width, height: canvas.height };
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
    window.setTimeout(() => URL.revokeObjectURL(url), 3500);
  }

  function closeResult(modal) {
    (modal?._batchItems || []).forEach(item => URL.revokeObjectURL(item.url));
    modal?.remove();
  }

  function showResults(items, phaseTitle, totalGames) {
    $('#bdaPhaseBatchResult')?.remove();
    const modal = document.createElement('div');
    modal.id = 'bdaPhaseBatchResult';
    modal.className = 'bda-phase-batch-result';
    const mapped = items.map((item, index) => ({
      ...item,
      url: objectUrl(item.blob),
      fileName: `${slug(phaseTitle)}-${String(index + 1).padStart(2, '0')}-arena-bda.png`
    }));
    modal._batchItems = mapped;
    modal.innerHTML = `
      <section role="dialog" aria-modal="true" aria-label="Imagens da fase geradas">
        <header><div><span>FASE COMPLETA</span><b>${esc(phaseTitle)}</b><small>${totalGames} jogos • ${mapped.length} imagem${mapped.length === 1 ? '' : 's'}</small></div><button type="button" data-batch-close aria-label="Fechar">×</button></header>
        <main>${mapped.map((item, index) => `
          <article data-batch-item="${index}">
            <img src="${item.url}" alt="${esc(phaseTitle)} página ${index + 1}">
            <footer><span>Página ${index + 1}/${mapped.length}</span><div><button type="button" class="secondary" data-batch-download="${index}">Baixar</button>${navigator.share && typeof File === 'function' ? `<button type="button" class="primary" data-batch-share="${index}">Compartilhar</button>` : ''}</div></footer>
          </article>`).join('')}</main>
        <footer><button type="button" class="secondary" data-batch-close>Fechar</button><button type="button" class="primary" data-batch-download-all>Baixar todas</button></footer>
      </section>`;
    document.body.append(modal);
  }

  async function captureSelectedPhase(button) {
    if (busy || !adminActive()) return;
    const manager = $('#giManager');
    const bar = button.closest('.bda-capture-toolbar');
    const phases = $$('.gi-phase', manager || document);
    const phaseIndex = Number($('[data-cap-phase]', bar)?.value || 0);
    const phase = phases[phaseIndex];
    if (!phase) return toast('Nenhuma fase selecionada');

    const games = $$('.gi-game', phase).filter(game => game.offsetParent !== null || !game.hidden);
    if (!games.length) return toast('Essa fase ainda não tem jogos para gerar');

    busy = true;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = `⏳ 0/${games.length}`;
    const title = phaseName(phase, phaseIndex);
    const pages = chunk(games, MAX_GAMES_PER_PAGE);
    const results = [];
    toast(`Gerando ${games.length} jogos de ${title}...`);

    try {
      const requestedScale = quality(bar);
      for (let index = 0; index < pages.length; index += 1) {
        button.textContent = `⏳ ${Math.min(games.length, index * MAX_GAMES_PER_PAGE + 1)}/${games.length}`;
        const stage = makeStage(pages[index], title, index, pages.length, games.length);
        try {
          results.push(await stageToBlob(stage, requestedScale));
        } finally {
          stage.remove();
        }
        await new Promise(resolve => window.setTimeout(resolve, 45));
      }
      showResults(results, title, games.length);
      toast(`${games.length} jogos gerados sem cortes`);
    } catch (error) {
      console.error(error);
      toast('Não foi possível gerar todos os jogos da fase');
    } finally {
      busy = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  function enhanceToolbar() {
    const bar = $('.bda-capture-toolbar');
    if (!bar || !adminActive()) return false;
    const oldPhaseButton = $('[data-cap-phase-btn]', bar);
    if (!oldPhaseButton) return false;

    oldPhaseButton.classList.add('bda-original-phase-capture');
    let batchButton = $('[data-cap-phase-batch-btn]', bar);
    if (!batchButton) {
      batchButton = document.createElement('button');
      batchButton.type = 'button';
      batchButton.dataset.capPhaseBatchBtn = 'true';
      batchButton.textContent = '📸 Gerar fase completa';
      oldPhaseButton.insertAdjacentElement('afterend', batchButton);
    }
    batchButton.disabled = oldPhaseButton.disabled;
    bar.dataset.batchCaptureReady = 'true';
    return true;
  }

  function scheduleEnhance(delay = 40) {
    clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhanceToolbar, delay);
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;

    const batchButton = event.target.closest('[data-cap-phase-batch-btn]');
    if (batchButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      captureSelectedPhase(batchButton);
      return;
    }

    const modal = event.target.closest('#bdaPhaseBatchResult');
    if (!modal) return;
    const items = modal._batchItems || [];

    if (event.target.closest('[data-batch-close]') || event.target === modal) {
      closeResult(modal);
      return;
    }

    const downloadOne = event.target.closest('[data-batch-download]');
    if (downloadOne) {
      const item = items[Number(downloadOne.dataset.batchDownload)];
      if (item) download(item.blob, item.fileName);
      return;
    }

    const shareOne = event.target.closest('[data-batch-share]');
    if (shareOne) {
      const item = items[Number(shareOne.dataset.batchShare)];
      if (!item || !navigator.share || typeof File !== 'function') return;
      const file = new File([item.blob], item.fileName, { type: 'image/png' });
      navigator.share({ title: item.fileName.replace(/\.png$/i, ''), text: 'Arena BDA', files: [file] })
        .catch(error => {
          if (error?.name !== 'AbortError') toast('Compartilhamento indisponível neste navegador');
        });
      return;
    }

    if (event.target.closest('[data-batch-download-all]')) {
      items.forEach((item, index) => window.setTimeout(() => download(item.blob, item.fileName), index * 180));
    }
  }, true);

  ['arena:bundle-loaded', 'arena:matches-updated', 'arena:permissions-updated', 'arena:cloud-ready']
    .forEach(name => window.addEventListener(name, () => scheduleEnhance(70)));

  if (window.ArenaDOMEvents?.subscribe) {
    window.ArenaDOMEvents.subscribe(mutations => {
      if (mutations.some(mutation => [...mutation.addedNodes].some(node =>
        node instanceof Element && (node.matches?.('.bda-capture-toolbar,#giManager') || node.querySelector?.('.bda-capture-toolbar'))
      ))) scheduleEnhance(30);
    }, { selector: '.bda-capture-toolbar,#giManager' });
  }

  [300, 1000, 2200, 4200].forEach(delay => window.setTimeout(enhanceToolbar, delay));

  const style = document.createElement('style');
  style.id = 'arenaPhaseBatchCaptureStyles';
  style.textContent = `
    .bda-original-phase-capture{display:none!important}
    .bda-capture-toolbar [data-cap-phase-batch-btn]{min-height:40px;padding:0 12px;border:1px solid var(--gold);border-radius:11px;color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold));font-size:9px;font-weight:900;white-space:nowrap}
    .bda-capture-toolbar [data-cap-phase-batch-btn]:disabled{opacity:.45}
    .bda-phase-batch-stage{position:fixed;left:-22000px;top:0;z-index:-10;box-sizing:border-box;width:1080px;min-height:1080px;padding:48px;color:#f7faf7;background:radial-gradient(circle at 86% 0,rgba(216,178,72,.23),transparent 28%),linear-gradient(150deg,#143723,#050b07 72%);font-family:Inter,Arial,sans-serif}
    .bda-phase-batch-stage>header{display:flex;align-items:center;justify-content:space-between;gap:22px;padding-bottom:23px;border-bottom:2px solid rgba(242,215,125,.3)}
    .bda-phase-batch-stage>header span{color:#f0ce67;font-size:12px;font-weight:900;letter-spacing:.16em}.bda-phase-batch-stage>header h1{margin:7px 0 4px;color:#fff;font:900 48px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.bda-phase-batch-stage>header p{margin:0;color:#cbd7cf;font-size:14px}.bda-phase-batch-stage>header aside{text-align:right}.bda-phase-batch-stage>header aside b{display:block;color:#f0ce67;font:900 34px/1 "Barlow Condensed",Arial,sans-serif}.bda-phase-batch-stage>header aside span{display:block;margin-top:5px;color:#aab9af;font-size:10px;letter-spacing:.08em}
    .bda-phase-batch-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important;margin-top:26px!important;align-items:stretch!important}.bda-phase-batch-grid .bda-batch-game{display:block!important;min-width:0!important;width:auto!important;margin:0!important;transform:none!important;position:relative!important;inset:auto!important;opacity:1!important;visibility:visible!important;break-inside:avoid!important}.bda-phase-batch-grid .gi-game{height:100%!important}.bda-phase-batch-grid .gi-editor{display:none!important}
    .bda-phase-batch-stage>footer{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:28px;padding-top:18px;border-top:1px solid rgba(242,215,125,.25);color:#b9c7bd;font-size:12px}.bda-phase-batch-stage>footer b{color:#f0ce67}
    .bda-phase-batch-result{position:fixed;inset:0;z-index:99500;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.91);backdrop-filter:blur(12px)}.bda-phase-batch-result>section{overflow:auto;width:min(920px,100%);max-height:95dvh;border:1px solid rgba(242,215,125,.4);border-radius:22px;background:#07100c;box-shadow:0 35px 110px #000}.bda-phase-batch-result>section>header,.bda-phase-batch-result>section>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-bottom:1px solid var(--line)}.bda-phase-batch-result>section>header span,.bda-phase-batch-result>section>header b,.bda-phase-batch-result>section>header small{display:block}.bda-phase-batch-result>section>header span{color:var(--green);font-size:8px;font-weight:900}.bda-phase-batch-result>section>header b{margin-top:3px;font-size:15px}.bda-phase-batch-result>section>header small{margin-top:3px;color:var(--muted);font-size:9px}.bda-phase-batch-result>section>header>button{width:40px;height:40px;padding:0;border:1px solid var(--line);border-radius:11px;color:#fff;background:#ffffff08;font-size:23px}.bda-phase-batch-result>section>main{display:grid;gap:12px;padding:14px}.bda-phase-batch-result article{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:#030806}.bda-phase-batch-result article>img{display:block;width:100%;max-height:62dvh;object-fit:contain;background:#020503}.bda-phase-batch-result article>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px}.bda-phase-batch-result article>footer span{color:var(--muted);font-size:9px}.bda-phase-batch-result article>footer div{display:flex;gap:7px}.bda-phase-batch-result>section>footer{justify-content:flex-end;border-top:1px solid var(--line);border-bottom:0}
    @media(max-width:760px){.bda-capture-toolbar>div{grid-template-columns:1fr!important}.bda-capture-toolbar [data-cap-phase-batch-btn],.bda-capture-toolbar [data-cap-game-btn]{width:100%}.bda-phase-batch-result article>footer{align-items:stretch;flex-direction:column}.bda-phase-batch-result article>footer div{display:grid;grid-template-columns:1fr 1fr}.bda-phase-batch-result article>footer button{width:100%}}
  `;
  document.head.append(style);

  window.ArenaBDAPhaseBatchCapture = Object.freeze({
    version: VERSION,
    refresh: enhanceToolbar,
    captureSelectedPhase
  });
})();
