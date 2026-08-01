(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  function tournaments() {
    try {
      const items = JSON.parse(localStorage.getItem('bda-v3-tournaments'));
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function setBanner(container, item, direct = false) {
    if (!container || !item) return;
    let image = direct ? $(':scope > img', container) : $('img', container);
    if (!item.banner) {
      image?.remove();
      return;
    }
    if (!image) {
      image = document.createElement('img');
      container.prepend(image);
    }
    image.src = item.banner;
    image.alt = `Banner de ${item.name || 'campeonato'}`;
  }

  function refresh() {
    const items = tournaments();
    $$('.arena-card').forEach(card => {
      const id = $('[data-open-tournament]', card)?.dataset.openTournament;
      const item = items.find(entry => String(entry.id) === String(id));
      if (item) setBanner($('.arena-cover', card), item);
    });

    const name = $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim();
    const item = items.find(entry => norm(entry.name) === norm(name));
    if (item) setBanner($('#arenaDetail .arena-hero'), item, true);
  }

  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  };

  window.addEventListener('arena:tournament-logo-updated', later);
  window.ArenaDOMEvents.subscribe(later, { selector: '#arenaDetail,.arena-card,.gi-head' });
  refresh();
})();
