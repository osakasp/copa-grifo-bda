(() => {
  'use strict';

  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  let scheduled = false;

  function currentEmail() {
    try {
      return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function adminActive() {
    return (typeof isAdmin !== 'undefined' && Boolean(isAdmin)) || ADMIN_EMAILS.has(currentEmail());
  }

  function teams() {
    if (typeof window.teams !== 'undefined' && Array.isArray(window.teams)) return window.teams;
    try {
      const value = JSON.parse(localStorage.getItem('bda-v2-teams') || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function teamNameFromButton(button) {
    const explicit = button?.dataset?.clubProfileName || button?.dataset?.teamName;
    if (explicit) return explicit;
    const cardName = $('h3', button?.closest?.('.team-card'))?.textContent?.trim();
    if (cardName) return cardName;
    const index = Number(button?.dataset?.openClubProfile);
    return Number.isInteger(index) && index >= 0 ? teams()[index]?.name || '' : '';
  }

  function openProfile(name) {
    if (!name) return notify('Não foi possível localizar este clube');
    const api = window.ArenaBDAClubProfiles;
    if (!api?.open) return notify('O perfil ainda está carregando');
    api.open(name);
    requestAnimationFrame(() => decorateOpenModal(name));
  }

  function decorateCards() {
    scheduled = false;
    const list = teams();
    $$('#teamGrid .team-card').forEach(card => {
      const name = $('h3', card)?.textContent?.trim();
      const team = list.find(item => norm(item?.name) === norm(name));
      if (!team) return;
      const button = $('[data-open-club-profile]', card) || $('.club-profile-card-summary button', card);
      if (!button) return;
      button.dataset.openClubProfile = 'true';
      button.dataset.clubProfileName = team.name;
      button.type = 'button';
      button.style.pointerEvents = 'auto';
      button.style.touchAction = 'manipulation';
    });
  }

  function decorateOpenModal(name = '') {
    const modal = $('#clubProfileModal.show');
    if (!modal) return;
    const title = $('.club-profile-identity h1', modal)?.textContent?.trim() || name;
    const actions = $('.club-profile-hero-actions', modal);
    if (!actions || !title) return;

    if (adminActive()) {
      $('[data-request-team-edit-profile]', actions)?.remove();
      let edit = $('[data-edit-club-profile]', actions);
      if (!edit) {
        edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'primary';
        edit.dataset.editClubProfile = 'true';
        edit.textContent = '✎ Editar perfil';
        actions.append(edit);
      }
    } else {
      $('[data-edit-club-profile]', actions)?.remove();
      let request = $('[data-request-team-edit-profile]', actions);
      if (!request) {
        request = document.createElement('button');
        request.type = 'button';
        request.className = 'primary';
        request.dataset.requestTeamEditProfile = 'true';
        request.dataset.teamEditRequestName = title;
        request.textContent = '✎ Solicitar edição';
        actions.append(request);
      } else {
        request.dataset.teamEditRequestName = title;
      }
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorateCards);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#teamGrid [data-open-club-profile],#teamGrid .club-profile-card-summary button.primary');
    if (!button || button.matches('[data-request-team-edit]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openProfile(teamNameFromButton(button));
  }, true);

  document.addEventListener('click', event => {
    const edit = event.target.closest('#clubProfileModal [data-edit-club-profile]');
    if (!edit || !adminActive()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const name = $('.club-profile-identity h1', edit.closest('#clubProfileModal'))?.textContent?.trim();
    if (!name) return;
    $('#clubProfileModal')?.classList.remove('show');
    document.body.classList.remove('club-profile-open');
    window.ArenaBDATeamEditor?.open?.(name);
  }, true);

  const style = document.createElement('style');
  style.id = 'clubProfileRouterStyles';
  style.textContent = `
    #teamGrid [data-open-club-profile]{position:relative!important;z-index:20!important;pointer-events:auto!important;touch-action:manipulation!important;min-height:44px!important}
    #clubProfileModal{z-index:60000!important;pointer-events:auto!important}
    #clubProfileModal .club-profile-dialog,#clubProfileModal button{pointer-events:auto!important}
    #clubProfileModal [data-request-team-edit-profile]{min-height:44px}
  `;
  document.head.append(style);

  const oldOpen = window.ArenaBDAClubProfiles?.open;
  if (typeof oldOpen === 'function' && !oldOpen.__arenaRouted) {
    const routedOpen = function routedClubProfileOpen(name) {
      oldOpen.call(window.ArenaBDAClubProfiles, name);
      requestAnimationFrame(() => decorateOpenModal(name));
    };
    routedOpen.__arenaRouted = true;
    window.ArenaBDAClubProfiles.open = routedOpen;
  }

  $('#bdaStandaloneProfile')?.remove();
  document.body.classList.remove('bda-sp-open');
  window.addEventListener('arena:team-profile-updated', schedule);
  window.addEventListener('storage', event => { if (event.key === 'bda-v2-teams') schedule(); });
  window.firebase?.auth?.().onAuthStateChanged?.(() => {
    schedule();
    requestAnimationFrame(() => decorateOpenModal());
  });
  schedule();
  setTimeout(schedule, 350);
  setTimeout(schedule, 1200);

  window.ArenaBDAClubProfileRouter = { refresh: schedule, open: openProfile };
})();