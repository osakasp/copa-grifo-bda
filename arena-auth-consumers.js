(() => {
  'use strict';

  const auth = window.ArenaBDAAuth;
  if (!auth?.subscribe) return;

  const STYLE_ID = 'arenaAuthStabilityStyles';
  const DUPLICATE_WINDOW_MS = 900;
  let lastEventSignature = '';
  let lastEventAt = 0;
  let lastAppliedSignature = '';
  let releaseTimer = 0;

  function ensureStabilityStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html[data-arena-document-mode="single"] #arenaBoot[data-auth-transition-suppressed="true"]{
        opacity:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function stateSignature(state) {
    return `${Boolean(state?.isAdmin) ? 'admin' : 'visitor'}|${String(state?.email || '').trim().toLowerCase()}`;
  }

  function suppressLegacyAuthOverlay() {
    if (document.documentElement.dataset.arenaDocumentMode !== 'single') return;
    const boot = document.getElementById('arenaBoot');
    if (!boot) return;

    boot.dataset.authTransitionSuppressed = 'true';
    boot.classList.add('hidden');
    boot.setAttribute('aria-busy', 'false');

    const keepHidden = () => {
      boot.classList.add('hidden');
      boot.setAttribute('aria-busy', 'false');
    };
    requestAnimationFrame(keepHidden);
    window.setTimeout(keepHidden, 420);

    clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      keepHidden();
      delete boot.dataset.authTransitionSuppressed;
    }, 1200);
  }

  function stabilizeAuthEvent(event) {
    const signature = stateSignature(event?.detail || auth.state());
    const now = performance.now();
    const duplicate = signature === lastEventSignature && (now - lastEventAt) <= DUPLICATE_WINDOW_MS;

    lastEventSignature = signature;
    lastEventAt = now;

    if (duplicate) {
      event.stopImmediatePropagation();
      return;
    }

    suppressLegacyAuthOverlay();
  }

  ensureStabilityStyle();
  window.addEventListener('arena:auth-changed', stabilizeAuthEvent, { capture: true });

  function apply(state) {
    const signature = stateSignature(state);
    if (signature === lastAppliedSignature) return;
    lastAppliedSignature = signature;

    const admin = Boolean(state?.isAdmin);
    const panelButton = document.getElementById('cloudPanelBtn');
    if (panelButton) panelButton.hidden = !admin;

    if (!admin) {
      document.getElementById('cloudAdminModal')?.classList.remove('show');
      document.getElementById('teamEditRequestsModal')?.classList.remove('show');
      document.getElementById('teamProfileFullEditor')?.classList.remove('show');
      document.body.classList.remove('team-edit-requests-open', 'team-profile-edit-open');
    }

    window.ArenaBDAClubProfiles?.refresh?.();
    window.ArenaBDAClubProfileRouter?.refresh?.();
    window.ArenaBDATeamEditor?.refresh?.();
    window.ArenaBDATeamEditRequests?.refresh?.();

    window.dispatchEvent(new CustomEvent('arena:permissions-updated', {
      detail: { isAdmin: admin, email: state?.email || '' }
    }));
  }

  auth.subscribe(apply);
  window.ArenaBDAAdminPermissions = {
    version: 2,
    isAdmin: () => auth.isAdmin(),
    email: () => auth.currentEmail(),
    refresh: () => apply(auth.state()),
    suppressLegacyAuthOverlay
  };
})();