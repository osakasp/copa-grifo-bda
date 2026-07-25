(() => {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  let busy = false;
  let previewUrl = '';
  let observerTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const slug = value => String(value || 'jogos-bda')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'jogos-bda';
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

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

  function iconUrl() {
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

  function gameData(card, phase = '') {
    const teams = $$('.gi-team', card).slice(0, 2).map(teamData);
    const header = $(':scope > header', card);
    const status = $('span', header)?.textContent?.trim() || 'Agendado';
    const meta = $('small', header)?.textContent?.trim() || 'Data a definir';
    const aggregate = $('.gi-agg b', card)?.textContent?.trim() || '';
    const note = $(':scope > p', card)?.textContent?.trim() || '';
    return {
      phase: phase || card.closest('.gi-phase')?.querySelector('h3')?.textContent?.trim() || 'Confronto',
      status,
      meta,
      aggregate,
      note,
      teams: teams.length === 2 ? teams : [teamData(), teamData()]
    };
  }

  function badgeHtml(team, large = false) {
    const className = `hd-team-badge${large ? ' large' : ''}`;
    return team.image
      ? `<span class="${className}"><img src="${esc(team.image)}" alt="Escudo de ${esc(team.name)}"></span>`
      : `<span class="${className}">${esc(team.badge || initials(team.name))}</span>`;
  }

  function scoreClass(value) {
    return /^\d+$/.test(String(value)) ? 'has-score' : '';
  }

  function singleGameHtml(game) {
    const [a, b] = game.teams;
    return `<section class="hd-single-game">
      <div class="hd-status-row"><span>${esc(game.phase)}</span><b>${esc(game.status)}</b></div>
      <div class="hd-single-versus">
        <article class="${a.winner ? 'winner' : ''}">
          ${badgeHtml(a, true)}
          <h2>${esc(a.name)}</h2>
          ${a.detail ? `<small>${esc(a.detail)}</small>` : ''}
        </article>
        <div class="hd-main-score">
          <span class="${scoreClass(a.score)}">${esc(a.score)}</span><i>×</i><span class="${scoreClass(b.score)}">${esc(b.score)}</span>
          <small>${esc(game.meta)}</small>
        </div>
        <article class="${b.winner ? 'winner' : ''}">
          ${badgeHtml(b, true)}
          <h2>${esc(b.name)}</h2>
          ${b.detail ? `<small>${esc(b.detail)}</small>` : ''}
        </article>
      </div>
      ${game.aggregate ? `<div class="hd-aggregate"><span>Placar agregado</span><b>${esc(game.aggregate)}</b></div>` : ''}
      ${game.note ? `<p class="hd-game-note">${esc(game.note)}</p>` : ''}
    </section>`;
  }

  function compactGameHtml(game) {
    const [a, b] = game.teams;
    return `<article class="hd-game-card">
      <header><span>${esc(game.status)}</span><small>${esc(game.meta)}</small></header>
      <div class="hd-card-team ${a.winner ? 'winner' : ''}">${badgeHtml(a)}<b>${esc(a.name)}</b><strong>${esc(a.score)}</strong></div>
      <div class="hd-card-team ${b.winner ? 'winner' : ''}">${badgeHtml(b)}<b>${esc(b.name)}</b><strong>${esc(b.score)}</strong></div>
      ${game.aggregate ? `<footer><span>Agregado</span><b>${esc(game.aggregate)}</b></footer>` : ''}
    </article>`;
  }

  function phaseHtml(name, games) {
    return `<section class="hd-phase-block">
      <header><div><span>FASE OFICIAL</span><h2>${esc(name)}</h2></div><b>${games.length} ${games.length === 1 ? 'jogo' : 'jogos'}</b></header>
      <main>${games.map(compactGameHtml).join('')}</main>
    </section>`;
  }

  function stageHeader(title, subtitle) {
    return `<header class="hd-shot-header">
      <div class="hd-brand-lockup"><span><img src="${esc(iconUrl())}" alt="Grifo Arena BDA"></span><div><small>ARENA BDA</small><b>${esc(championshipName())}</b></div></div>
      <div class="hd-shot-title"><span>COMPETIÇÃO OFICIAL</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
    </header>`;
  }

  function createStage(kind, title, content, subtitle) {
    const stage = document.createElement('section');
    stage.className = `hd-shot-stage hd-shot-${kind}`;
    stage.style.cssText = 'position:fixed;left:-16000px;top:0;width:1080px;z-index:-5;';
    stage.innerHTML = `${stageHeader(title, subtitle)}<main class="hd-shot-content">${content}</main><footer class="hd-shot-footer"><b>arenabda.com.br</b><span>Clã BDA • Boleiros de Atitude</span><small>${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}</small></footer>`;
    document.body.append(stage);
    return stage;
  }

  async function waitForImages(root) {
    const images = $$('img', root);
    await Promise.all(images.map(image => {
      if (image.complete && image.naturalWidth) return image.decode?.().catch(() => {}) || Promise.resolve();
      return new Promise(resolve => {
        const done = () => resolve();
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
        setTimeout(done, 5000);
      });
    }));
  }

  function closePreview() {
    $('#hdCapturePreview')?.remove();
    document.body.classList.remove('hd-preview-open');
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
    modal.id = 'hdCapturePreview';
    modal.className = 'hd-capture-preview';
    modal.innerHTML = `<section>
      <header><div><span class="eyebrow">Imagem pronta</span><h2>Prévia da arte HD</h2><p>${canvas.width} × ${canvas.height}px • PNG em alta qualidade</p></div><button type="button" data-hd-close aria-label="Fechar">×</button></header>
      <div class="hd-preview-media"><img src="${previewUrl}" alt="Prévia de ${esc(title)}"></div>
      <footer><button class="secondary" type="button" data-hd-close>Fechar</button><button class="ghost" type="button" data-hd-download>⬇ Baixar PNG</button><button class="primary" type="button" data-hd-share>↗ Compartilhar</button></footer>
    </section>`;
    document.body.append(modal);
    document.body.classList.add('hd-preview-open');

    $$('[data-hd-close]', modal).forEach(button => button.addEventListener('click', closePreview));
    $('[data-hd-download]', modal)?.addEventListener('click', () => downloadBlob(blob, filename));
    $('[data-hd-share]', modal)?.addEventListener('click', async () => {
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'Arena BDA', text: title, files: [file] });
        } else if (navigator.share) {
          await navigator.share({ title: 'Arena BDA', text: title, url: location.href });
        } else {
          downloadBlob(blob, filename);
          notify('Compartilhamento indisponível. A imagem foi baixada');
        }
      } catch (error) {
        if (error?.name !== 'AbortError') notify('Não foi possível compartilhar a imagem');
      }
    });
    modal.addEventListener('click', event => event.target === modal && closePreview());
  }

  async function renderStage(stage, title, filename) {
    if (busy) return;
    busy = true;
    notify('Montando arte HD...');
    try {
      const html2canvas = await loadCapture();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(stage);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const width = stage.scrollWidth;
      const height = stage.scrollHeight;
      const canvas = await html2canvas(stage, {
        backgroundColor: '#030805',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        windowWidth: width,
        windowHeight: height,
        width,
        height,
        scrollX: 0,
        scrollY: 0
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG')), 'image/png', 1));
      showPreview(blob, `${slug(filename)}-arena-bda-hd.png`, title, canvas);
      notify('Arte HD pronta');
    } catch (error) {
      console.error(error);
      notify('Não foi possível gerar a arte dos jogos');
    } finally {
      stage.remove();
      busy = false;
    }
  }

  async function captureGame(card) {
    if (!card) return;
    const game = gameData(card);
    const title = `${game.teams[0].name} × ${game.teams[1].name}`;
    const stage = createStage('single', title, singleGameHtml(game), `${game.phase} • ${game.status}`);
    await renderStage(stage, title, title);
  }

  async function capturePhase(phase) {
    if (!phase) return;
    const name = $('h3', phase)?.textContent?.trim() || 'Fase';
    const games = $$('.gi-game', phase).map(card => gameData(card, name));
    if (!games.length) return notify('Nenhum jogo encontrado nesta fase');
    const stage = createStage('collection', name, phaseHtml(name, games), `${games.length} ${games.length === 1 ? 'confronto' : 'confrontos'}`);
    await renderStage(stage, `${name} • ${championshipName()}`, `${championshipName()}-${name}`);
  }

  async function captureAllGames() {
    const phases = $$('.gi-phase');
    if (!phases.length) return notify('Nenhum confronto disponível para fotografar');
    const blocks = phases.map(phase => {
      const name = $('h3', phase)?.textContent?.trim() || 'Fase';
      const games = $$('.gi-game', phase).map(card => gameData(card, name));
      return games.length ? phaseHtml(name, games) : '';
    }).filter(Boolean).join('');
    const total = $$('.gi-phase .gi-game').length;
    const stage = createStage('collection', 'Jogos oficiais', blocks, `${total} ${total === 1 ? 'confronto registrado' : 'confrontos registrados'}`);
    await renderStage(stage, `Jogos oficiais • ${championshipName()}`, `${championshipName()}-jogos-oficiais`);
  }

  async function captureBracket() {
    const source = $('#giManager .gi-bracket-scroll') || $('#giManager .gi-content');
    if (!source) return notify('Chaveamento indisponível');
    const clone = source.cloneNode(true);
    $$('button,.gi-editor,[data-pro-ignore]', clone).forEach(element => element.remove());
    clone.classList.add('hd-bracket-clone');
    const stage = createStage('bracket', 'Chaveamento oficial', clone.outerHTML, 'Caminho até a grande final');
    await renderStage(stage, `Chaveamento • ${championshipName()}`, `${championshipName()}-chaveamento`);
  }

  function improveLabels() {
    const all = $('[data-pro-photo]');
    if (all) { all.textContent = '📸 Jogos HD'; all.title = 'Criar arte HD de todos os jogos'; }
    const bracket = $('[data-pro-bracket]');
    if (bracket) { bracket.textContent = '📸 Chave HD'; bracket.title = 'Criar arte HD do chaveamento'; }
    $$('.pro-phase-photo').forEach(button => { button.textContent = '📸 Arte da fase'; button.title = 'Criar arte HD desta fase'; });
    $$('.pro-game-photo').forEach(button => { button.textContent = '📸 Arte HD'; button.title = 'Criar arte quadrada deste jogo'; });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (button.matches('[data-pro-photo]')) captureAllGames();
    else if (button.matches('[data-pro-bracket]')) captureBracket();
    else if (button.matches('.pro-phase-photo')) capturePhase(button.closest('.gi-phase'));
    else captureGame(button.closest('.gi-game'));
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePreview();
  });

  const style = document.createElement('style');
  style.textContent = `
    .hd-shot-stage{box-sizing:border-box;min-height:1080px;padding:44px;color:#f7faf6;background:radial-gradient(circle at 88% 0,rgba(245,220,134,.18),transparent 25%),radial-gradient(circle at 4% 55%,rgba(88,229,154,.07),transparent 25%),linear-gradient(180deg,#08140d,#030805 58%,#020503);font-family:Inter,Arial,sans-serif}
    .hd-shot-stage *{box-sizing:border-box}.hd-shot-header{overflow:hidden;position:relative;padding:26px 28px;border:1px solid rgba(245,220,134,.38);border-radius:28px;background:radial-gradient(circle at 90% 0,rgba(245,220,134,.28),transparent 34%),linear-gradient(135deg,#1a492f,#07130d 65%,#030806);box-shadow:0 25px 65px rgba(0,0,0,.38)}
    .hd-shot-header:after{content:"BDA";position:absolute;right:-10px;bottom:-48px;color:rgba(255,255,255,.055);font:900 160px/1 Arial,sans-serif}.hd-brand-lockup,.hd-shot-title{position:relative;z-index:1}.hd-brand-lockup{display:flex;align-items:center;gap:16px}.hd-brand-lockup>span{overflow:hidden;display:grid;place-items:center;width:76px;height:76px;border:2px solid rgba(245,220,134,.55);border-radius:22px;background:#020503}.hd-brand-lockup img{width:100%;height:100%;object-fit:cover}.hd-brand-lockup small,.hd-brand-lockup b{display:block}.hd-brand-lockup small{color:#f5dc86;font-size:13px;font-weight:900;letter-spacing:.2em}.hd-brand-lockup b{margin-top:4px;font-size:24px;text-transform:uppercase}.hd-shot-title{margin-top:25px}.hd-shot-title>span{color:#f5dc86;font-size:12px;font-weight:900;letter-spacing:.18em}.hd-shot-title h1{max-width:920px;margin:8px 0 5px;color:#fff;font:900 54px/.96 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.hd-shot-title p{margin:0;color:#bfd0c5;font-size:15px}.hd-shot-content{margin-top:22px}
    .hd-single-game{display:grid;align-content:center;min-height:650px;padding:29px;border:1px solid rgba(219,241,226,.14);border-radius:28px;background:radial-gradient(circle at 50% 45%,rgba(245,220,134,.09),transparent 30%),linear-gradient(150deg,rgba(24,51,34,.94),rgba(6,16,10,.98));box-shadow:0 22px 60px rgba(0,0,0,.33)}.hd-status-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid rgba(219,241,226,.12)}.hd-status-row span{color:#f5dc86;font-size:14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.hd-status-row b{padding:9px 13px;border:1px solid rgba(88,229,154,.30);border-radius:999px;color:#8cf0b8;background:rgba(88,229,154,.08);font-size:12px;text-transform:uppercase}.hd-single-versus{display:grid;grid-template-columns:1fr 250px 1fr;align-items:center;gap:20px;padding:45px 0 35px}.hd-single-versus article{display:grid;justify-items:center;text-align:center}.hd-single-versus article.winner h2{color:#f5dc86}.hd-team-badge{overflow:hidden;display:grid;place-items:center;width:54px;height:54px;flex:0 0 auto;border:2px solid rgba(245,220,134,.48);border-radius:50%;color:#171107;background:linear-gradient(145deg,#f8e59b,#bd8d20);font-size:12px;font-weight:900}.hd-team-badge.large{width:150px;height:150px;border-width:4px;font-size:28px;box-shadow:0 20px 45px rgba(0,0,0,.42)}.hd-team-badge img{width:100%;height:100%;object-fit:cover}.hd-single-versus h2{max-width:300px;margin:20px 0 4px;color:#fff;font:900 36px/.95 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.hd-single-versus small{color:#9fb2a6;font-size:12px}.hd-main-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:13px;text-align:center}.hd-main-score>span{display:grid;place-items:center;min-height:105px;border:1px solid rgba(245,220,134,.22);border-radius:22px;color:#f5dc86;background:#020503;font:900 70px/1 "Barlow Condensed",Arial,sans-serif;box-shadow:inset 0 0 25px rgba(245,220,134,.05)}.hd-main-score>span:not(.has-score){color:#718078}.hd-main-score i{color:#8e9d94;font:700 34px Arial,sans-serif}.hd-main-score small{grid-column:1/-1;margin-top:8px;color:#aec0b5;font-size:12px}.hd-aggregate{display:flex;align-items:center;justify-content:center;gap:13px;padding:14px;border:1px solid rgba(245,220,134,.22);border-radius:16px;background:rgba(245,220,134,.055)}.hd-aggregate span{color:#a9bbb0;font-size:12px;text-transform:uppercase}.hd-aggregate b{color:#f5dc86;font-size:18px}.hd-game-note{margin:13px 0 0;color:#b9c9bf;font-size:13px;line-height:1.5;text-align:center}
    .hd-phase-block{margin-bottom:20px;padding:20px;border:1px solid rgba(219,241,226,.12);border-radius:25px;background:linear-gradient(150deg,rgba(20,44,29,.88),rgba(5,14,9,.96))}.hd-phase-block>header{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:4px 3px 17px;border-bottom:1px solid rgba(219,241,226,.12)}.hd-phase-block>header span{color:#f5dc86;font-size:10px;font-weight:900;letter-spacing:.17em}.hd-phase-block>header h2{margin:5px 0 0;font:900 34px/1 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase}.hd-phase-block>header>b{color:#a9bbb0;font-size:12px;text-transform:uppercase}.hd-phase-block>main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:14px}.hd-game-card{overflow:hidden;border:1px solid rgba(219,241,226,.12);border-radius:18px;background:linear-gradient(150deg,#112c1d,#06100a);box-shadow:0 12px 28px rgba(0,0,0,.23)}.hd-game-card>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(219,241,226,.10);background:rgba(255,255,255,.025)}.hd-game-card>header span{color:#77e8a7;font-size:10px;font-weight:900;text-transform:uppercase}.hd-game-card>header small{overflow:hidden;color:#9fb2a6;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.hd-card-team{display:grid;grid-template-columns:54px 1fr 58px;align-items:center;gap:10px;min-height:72px;padding:9px 12px;border-bottom:1px solid rgba(219,241,226,.08)}.hd-card-team.winner b{color:#f5dc86}.hd-card-team>b{overflow:hidden;color:#eef5f0;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.hd-card-team>strong{display:grid;place-items:center;width:54px;height:48px;border-radius:13px;color:#f5dc86;background:#020503;font:900 27px "Barlow Condensed",Arial,sans-serif}.hd-game-card>footer{display:flex;justify-content:space-between;gap:12px;padding:9px 12px;color:#9fb2a6;font-size:9px;text-transform:uppercase}.hd-game-card>footer b{color:#f5dc86;font-size:11px}
    .hd-shot-footer{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:20px;margin-top:23px;padding:16px 4px 0;border-top:1px solid rgba(245,220,134,.28);color:#90a298;font-size:12px}.hd-shot-footer b{color:#f5dc86;font-size:15px}.hd-shot-footer small{text-transform:capitalize}.hd-shot-single{height:1080px}.hd-shot-single .hd-shot-header{padding-block:20px}.hd-shot-single .hd-brand-lockup>span{width:62px;height:62px}.hd-shot-single .hd-shot-title{margin-top:15px}.hd-shot-single .hd-shot-title h1{font-size:43px}.hd-shot-single .hd-single-game{min-height:610px}.hd-shot-bracket{width:1600px!important}.hd-bracket-clone{width:100%!important;overflow:visible!important}.hd-bracket-clone .gi-bracket{display:grid!important;grid-auto-flow:column!important;grid-auto-columns:minmax(260px,1fr)!important;gap:14px!important;width:max-content!important;min-width:100%!important}.hd-bracket-clone .gi-bracket section{min-width:260px!important}.hd-bracket-clone button{display:none!important}
    .hd-capture-preview{position:fixed;inset:0;z-index:180;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.86);backdrop-filter:blur(14px)}.hd-capture-preview>section{overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(920px,100%);max-height:94vh;border:1px solid rgba(245,220,134,.38);border-radius:25px;background:linear-gradient(150deg,#142f20,#050c08);box-shadow:0 35px 110px rgba(0,0,0,.70)}.hd-capture-preview header{display:flex;align-items:start;justify-content:space-between;gap:15px;padding:17px 19px;border-bottom:1px solid rgba(219,241,226,.11)}.hd-capture-preview h2{margin:5px 0 2px;font-size:30px;text-transform:uppercase}.hd-capture-preview header p{margin:0;color:#9fb2a6;font-size:9px}.hd-capture-preview header>button{width:42px;height:42px;border:1px solid rgba(219,241,226,.13);border-radius:13px;color:#fff;background:rgba(255,255,255,.05);font-size:24px}.hd-preview-media{overflow:auto;display:grid;place-items:center;min-height:260px;padding:13px;background:#020503}.hd-preview-media img{display:block;max-width:100%;max-height:65vh;object-fit:contain;box-shadow:0 16px 45px rgba(0,0,0,.45)}.hd-capture-preview footer{display:flex;justify-content:flex-end;gap:8px;padding:13px 16px;border-top:1px solid rgba(219,241,226,.11)}.hd-preview-open{overflow:hidden}
    @media(max-width:650px){.hd-capture-preview{padding:8px}.hd-capture-preview>section{border-radius:20px}.hd-capture-preview header{padding:13px}.hd-capture-preview h2{font-size:25px}.hd-preview-media{padding:8px}.hd-capture-preview footer{display:grid;grid-template-columns:1fr 1fr}.hd-capture-preview footer .primary{grid-column:1/-1}.hd-capture-preview footer button{width:100%}}
  `;
  document.head.append(style);

  improveLabels();
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(improveLabels, 90);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
