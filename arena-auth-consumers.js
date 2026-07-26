(() => {
  'use strict';

  const auth = window.ArenaBDAAuth;
  if (!auth?.subscribe) return;

  function apply(state) {
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
    isAdmin: () => auth.isAdmin(),
    email: () => auth.currentEmail(),
    refresh: () => apply(auth.state())
  };
})();