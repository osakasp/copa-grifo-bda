(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let observer = null;
  let timer = 0;
  let opening = false;

  function readTeams() {
    try {
      const stored = JSON.parse(localStorage.getItem('bda-v2-teams') || '[]');
      if (Array.isArray(stored)) return stored;
    } catch {}
    return [];
  }

  function teamNameFromButton(button) {
    const explicit = button.dataset.clubProfileName?.trim();
    if (explicit) return explicit;

    const card = button.closest('.team-card');
    const heading = $('h3', card)?.textContent?.trim();
    if (heading) return heading;

    const index = Number(button.dataset.openClubProfile);
    if (Number.isInteger(index) && index >= 0) {
      return readTeams()[index]?.name || '';
    }

    return '';
  }

  function forceModalVisible() {
    const modal = $('#clubProfileModal');
    if (!modal) return false;
    modal.classList.add('show');
    modal.style.setProperty('display', 'block', 'important');
    modal.style.setProperty('z-index', '10020', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    document.body.classList.add('club-profile-open');
    return true;
  }

  function openByName(name) {
    if (!name || opening) return;
    opening = true;

    try {
      const api = window.ArenaBDAClubProfiles;
      if (!api?.open) {
        notify('O perfil ainda está carregando. Tente novamente em um instante.');
        return;
      }

      api.open(name);
      requestAnimationFrame(() => {
        forceModalVisible();
        const title = $('#clubProfileModal .club-profile-identity h1')?.textContent?.trim();
        if (!title || norm(title) !== norm(name)) {
          api.open(name);
          requestAnimationFrame(forceModalVisible);
        }
      });
    } catch (error) {
      console.error('Falha ao abrir perfil completo:', error);
      notify('Não foi possível abrir o perfil deste time.');
    } finally {
      setTimeout(() => { opening = false; }, 180);
    }
  }

  function bindButton(button) {
    if (!button || button.dataset.profileClickFixed === 'true') return;

    const name = teamNameFromButton(button);
    if (name) button.dataset.clubProfileName = name;
    button.dataset.profileClickFixed = 'true';
    button.setAttribute('aria-label', name ? `Ver perfil completo de ${name}` : 'Ver perfil completo');

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openByName(teamNameFromButton(button));
    }, true);
  }

  function bindCards() {
    observer?.disconnect();
    try {
      $$('#teamGrid [data-open-club-profile], #teamGrid .club-profile-card-summary button').forEach(bindButton);
    } finally {
      observer?.observe(document.body, { childList: true, subtree: true });
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(bindCards, 70);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-open-club-profile]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openByName(teamNameFromButton(button));
  }, true);

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close-club-profile]');
    if (!close) return;
    const modal = $('#clubProfileModal');
    if (modal) {
      modal.style.removeProperty('display');
      modal.style.removeProperty('z-index');
      modal.style.removeProperty('visibility');
      modal.style.removeProperty('opacity');
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    #teamGrid [data-open-club-profile]{position:relative!important;z-index:8!important;pointer-events:auto!important;cursor:pointer!important;touch-action:manipulation}
    #teamGrid .club-profile-card-summary{position:relative!important;z-index:7!important;pointer-events:auto!important}
    #clubProfileModal.show{display:block!important;z-index:10020!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
    #clubProfileModal .club-profile-dialog{position:relative;z-index:1}
  `;
  document.head.append(style);

  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', schedule);
  window.addEventListener('arena:team-profile-updated', schedule);
  schedule();

  window.ArenaBDAProfileClickFix = { refresh: schedule, open: openByName };
})();
