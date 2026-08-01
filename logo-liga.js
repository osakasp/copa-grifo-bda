(() => {
  'use strict';

  const STORAGE_KEY = 'bda-v3-tournaments';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  let editingId = null;
  let pendingLogo = null;
  let timer = 0;

  function readTournaments() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeTournaments(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('arena:tournament-logo-updated'));
  }

  function currentTournament() {
    const items = readTournaments();
    if (editingId) return items.find(item => item.id === editingId) || null;
    const name = $('#tName')?.value?.trim();
    return items.find(item => norm(item.name) === norm(name)) || null;
  }

  function preview() {
    const root = $('#tLeagueLogoPreview');
    if (!root) return;
    const current = currentTournament()?.logo || '';
    const image = pendingLogo === null ? current : pendingLogo;
    root.innerHTML = image
      ? `<div><img src="${esc(image)}" alt="Prévia do logo da liga"></div><span>Este logo aparecerá nas artes dos jogos.</span><button type="button" class="danger" data-remove-league-logo>Remover logo</button>`
      : '<div class="arena-league-logo-empty">LOGO</div><span>Use uma imagem quadrada ou com fundo transparente.</span>';
    $('[data-remove-league-logo]', root)?.addEventListener('click', () => {
      pendingLogo = '';
      preview();
    });
  }

  function ensureField() {
    const form = $('#tournamentForm');
    if (!form || $('#tLeagueLogo')) return;
    const bannerLabel = $('#tBanner')?.closest('label');
    if (!bannerLabel) return;

    const field = document.createElement('label');
    field.className = 'arena-league-logo-field';
    field.style.gridColumn = '1/-1';
    field.innerHTML = `Logo da liga ou campeonato
      <input id="tLeagueLogo" type="file" accept="image/png,image/jpeg,image/webp">
      <div class="arena-league-logo-preview" id="tLeagueLogoPreview"></div>`;
    bannerLabel.after(field);

    $('#tLeagueLogo')?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) {
        pendingLogo = null;
        preview();
        return;
      }
      try {
        if (typeof toast === 'function') toast('Preparando o logo da liga...');
        pendingLogo = await prepareLogo(file);
        preview();
        if (typeof toast === 'function') toast('Logo da liga carregado');
      } catch (error) {
        console.error(error);
        pendingLogo = null;
        event.target.value = '';
        preview();
        if (typeof toast === 'function') toast(error.message || 'Não foi possível carregar o logo');
      }
    });

    form.addEventListener('submit', saveAfterTournament, true);
    preview();
  }

  function fileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  function imageFrom(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = source;
    });
  }

  async function prepareLogo(file) {
    if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > 8 * 1024 * 1024) throw new Error('O logo deve ter no máximo 8 MB');
    const image = await imageFrom(await fileData(file));
    const size = 640;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao preparar o logo');
    context.clearRect(0, 0, size, size);
    const scale = Math.min((size - 40) / image.width, (size - 40) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL('image/webp', 0.9);
  }

  function saveAfterTournament() {
    const name = $('#tName')?.value?.trim() || '';
    const id = editingId;
    const value = pendingLogo;
    window.setTimeout(() => {
      const items = readTournaments();
      let item = id ? items.find(entry => entry.id === id) : null;
      if (!item) item = items.find(entry => norm(entry.name) === norm(name));
      if (!item || value === null) {
        pendingLogo = null;
        editingId = null;
        return;
      }
      item.logo = value;
      writeTournaments(items);
      pendingLogo = null;
      editingId = null;
      decorateLogos();
    }, 80);
  }

  function tournamentByName(name) {
    return readTournaments().find(item => norm(item.name) === norm(name)) || null;
  }

  function decorateLogos() {
    const items = readTournaments();
    $$('.arena-card').forEach(card => {
      const id = $('[data-open-tournament]', card)?.dataset.openTournament;
      const item = items.find(entry => entry.id === id);
      let logo = $('.arena-league-logo-chip', card);
      if (!item?.logo) {
        logo?.remove();
        return;
      }
      if (!logo) {
        logo = document.createElement('span');
        logo.className = 'arena-league-logo-chip';
        $('.arena-cover', card)?.append(logo);
      }
      logo.innerHTML = `<img src="${esc(item.logo)}" alt="Logo de ${esc(item.name)}">`;
    });

    const detailName = $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim();
    const detailItem = tournamentByName(detailName);
    const hero = $('#arenaDetail .arena-hero');
    let detailLogo = $('.arena-detail-league-logo', hero);
    if (!detailItem?.logo) detailLogo?.remove();
    else if (hero) {
      if (!detailLogo) {
        detailLogo = document.createElement('span');
        detailLogo.className = 'arena-detail-league-logo';
        hero.append(detailLogo);
      }
      detailLogo.innerHTML = `<img src="${esc(detailItem.logo)}" alt="Logo de ${esc(detailItem.name)}">`;
    }
  }

  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-tournament]');
    if (edit) {
      editingId = edit.dataset.editTournament;
      pendingLogo = null;
      setTimeout(() => { ensureField(); preview(); }, 30);
      return;
    }
    if (event.target.closest('#createTournamentBtn,#adminCreateTournamentBtn,#panelCreateTournament')) {
      editingId = null;
      pendingLogo = null;
      setTimeout(() => { ensureField(); preview(); }, 30);
    }
  }, true);

  window.ArenaBDALeagueLogo = {
    get(name) {
      const item = tournamentByName(name);
      return item ? { logo: item.logo || '', banner: item.banner || '', badge: item.badge || '🏆', edition: item.edition || '' } : { logo: '', banner: '', badge: '🏆', edition: '' };
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    .arena-league-logo-preview{display:grid;grid-template-columns:110px 1fr auto;align-items:center;gap:10px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:15px;background:#03080670}
    .arena-league-logo-preview>div{display:grid;place-items:center;width:105px;height:105px;border:1px dashed var(--line-strong);border-radius:18px;background:#020503}
    .arena-league-logo-preview img{max-width:92px;max-height:92px;object-fit:contain}.arena-league-logo-preview>span{color:var(--muted);font-size:9px;line-height:1.5;text-transform:none;letter-spacing:0}.arena-league-logo-empty{color:var(--gold-soft);font:900 18px "Barlow Condensed",sans-serif!important}
    .arena-league-logo-chip{position:absolute;right:10px;bottom:9px;z-index:3;display:grid;place-items:center;width:47px;height:47px;border:1px solid rgba(245,220,134,.45);border-radius:14px;background:rgba(2,5,3,.82);box-shadow:0 9px 22px #0008;backdrop-filter:blur(8px)}.arena-league-logo-chip img{max-width:40px!important;max-height:40px!important;object-fit:contain!important}
    .arena-detail-league-logo{position:absolute;right:20px;top:20px;z-index:3;display:grid;place-items:center;width:92px;height:92px;border:1px solid rgba(245,220,134,.46);border-radius:24px;background:rgba(2,5,3,.76);box-shadow:0 18px 38px #0008;backdrop-filter:blur(10px)}.arena-detail-league-logo img{max-width:78px;max-height:78px;object-fit:contain}
    @media(max-width:580px){.arena-league-logo-preview{grid-template-columns:84px 1fr}.arena-league-logo-preview>div{width:80px;height:80px}.arena-league-logo-preview img{max-width:70px;max-height:70px}.arena-league-logo-preview button{grid-column:1/-1;width:100%}.arena-detail-league-logo{width:68px;height:68px;right:13px;top:13px;border-radius:19px}.arena-detail-league-logo img{max-width:57px;max-height:57px}}
  `;
  document.head.append(style);

  ensureField();
  decorateLogos();
  window.ArenaDOMEvents.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      ensureField();
      decorateLogos();
    }, 100);
  }, { selector: '#arenaDetail,.arena-card,[data-arena-field="leagueLogo"]' });
  window.addEventListener('arena:tournament-logo-updated', decorateLogos);
})();
