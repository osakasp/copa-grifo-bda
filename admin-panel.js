(() => {
  'use strict';

  const authCore = window.ArenaBDAAuth;
  if (!authCore && (!window.firebase || typeof firebase.auth !== 'function')) return;

  const topActions = document.querySelector('.top-actions');
  if (!topActions || document.getElementById('cloudPanelBtn')) return;

  const styles = document.createElement('style');
  styles.textContent = `
    .cloud-panel-trigger{color:#171107;border-color:var(--gold);background:linear-gradient(135deg,var(--gold-soft),var(--gold));box-shadow:0 8px 22px rgba(216,178,72,.2)}
    .cloud-panel-trigger[hidden]{display:none!important}
    .cloud-admin-modal{width:min(100%,560px)}
    .cloud-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
    .cloud-panel-head h2{margin:0}
    .cloud-panel-close{width:42px;min-width:42px;height:42px;padding:0;border:1px solid var(--line);border-radius:13px;color:var(--text);background:rgba(255,255,255,.05);font-size:20px}
    .cloud-panel-status{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:15px 0;padding:13px 14px;border:1px solid var(--line);border-radius:15px;background:rgba(3,8,6,.48)}
    .cloud-panel-status span{color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .cloud-panel-status strong{color:var(--gold-soft);font-size:12px;text-align:right}
    .cloud-panel-status strong[data-state="ok"]{color:var(--green)}
    .cloud-panel-status strong[data-state="error"]{color:#ff9aa4}
    .cloud-panel-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}
    .cloud-panel-shortcuts button{min-height:78px;padding:11px 9px;display:grid;place-items:center;align-content:center;gap:6px;border:1px solid var(--line);border-radius:15px;color:var(--text);background:rgba(255,255,255,.045);font-size:10px;font-weight:800;text-align:center}
    .cloud-panel-shortcuts i{font-style:normal;font-size:23px}
    .cloud-panel-sync{display:grid;gap:9px;margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}
    .cloud-panel-sync button{width:100%;min-height:46px}
    .cloud-panel-sync button:disabled{cursor:not-allowed;opacity:.45}
    .cloud-panel-help{margin:11px 0 0!important;color:var(--muted)!important;font-size:10px!important;line-height:1.5!important}
    @media(max-width:520px){
      .cloud-panel-trigger{min-height:38px;padding:0 10px;font-size:10px}
      .cloud-panel-shortcuts{grid-template-columns:1fr}
      .cloud-panel-shortcuts button{min-height:54px;grid-template-columns:auto 1fr;justify-content:start;text-align:left;padding-inline:14px}
      .cloud-status{display:none!important}
    }
  `;
  document.head.appendChild(styles);

  const panelButton = document.createElement('button');
  panelButton.id = 'cloudPanelBtn';
  panelButton.type = 'button';
  panelButton.className = 'admin-btn cloud-panel-trigger';
  panelButton.textContent = 'PAINEL';
  panelButton.hidden = true;
  panelButton.setAttribute('aria-label', 'Abrir painel administrativo');

  const adminButton = document.getElementById('adminBtn');
  topActions.insertBefore(panelButton, adminButton || null);

  const modal = document.createElement('div');
  modal.id = 'cloudAdminModal';
  modal.className = 'modal-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'cloudPanelTitle');
  modal.innerHTML = `
    <div class="modal cloud-admin-modal">
      <div class="cloud-panel-head">
        <div>
          <span class="eyebrow">Acesso exclusivo do administrador</span>
          <h2 id="cloudPanelTitle">Painel Arena BDA</h2>
        </div>
        <button class="cloud-panel-close" id="cloudPanelClose" type="button" aria-label="Fechar painel">×</button>
      </div>
      <p>Gerencie as competições e sincronize os mesmos dados entre celular e computador.</p>

      <div class="cloud-panel-status">
        <span>Status da nuvem</span>
        <strong id="cloudPanelStatus">Verificando...</strong>
      </div>

      <div class="cloud-panel-shortcuts">
        <button id="panelCreateTournament" type="button"><i>🏆</i><span>Criar campeonato</span></button>
        <button id="panelManageTeams" type="button"><i>🛡️</i><span>Gerenciar clubes</span></button>
        <button id="panelManageChampions" type="button"><i>⭐</i><span>Sala de troféus</span></button>
      </div>

      <div class="cloud-panel-sync">
        <button class="primary" id="panelCloudUpload" type="button">Enviar este aparelho para a nuvem</button>
        <button class="ghost" id="panelCloudDownload" type="button">Baixar dados da nuvem</button>
      </div>
      <p class="cloud-panel-help">No primeiro envio, use o aparelho que contém os dados mais atualizados.</p>
    </div>
  `;
  document.body.appendChild(modal);

  const panelStatus = document.getElementById('cloudPanelStatus');
  const uploadProxy = document.getElementById('panelCloudUpload');
  const downloadProxy = document.getElementById('panelCloudDownload');

  function sourceUploadButton() {
    return document.getElementById('cloudUploadBtn');
  }

  function sourceDownloadButton() {
    return document.getElementById('cloudDownloadBtn');
  }

  function syncPanelState() {
    const sourceStatus = document.querySelector('.cloud-status');
    if (sourceStatus) {
      panelStatus.textContent = sourceStatus.textContent || 'Conectando';
      panelStatus.dataset.state = sourceStatus.dataset.state || '';
    } else {
      panelStatus.textContent = 'Sincronização indisponível';
      panelStatus.dataset.state = 'error';
    }

    const uploadSource = sourceUploadButton();
    const downloadSource = sourceDownloadButton();
    uploadProxy.disabled = !uploadSource || uploadSource.hidden;
    downloadProxy.disabled = !downloadSource || downloadSource.hidden;
  }

  function openPanel() {
    if (authCore && !authCore.isAdmin()) return;
    syncPanelState();
    modal.classList.add('show');
    document.getElementById('cloudPanelClose')?.focus();
  }

  function closePanel() {
    modal.classList.remove('show');
  }

  function goTo(page) {
    closePanel();
    if (typeof navigate === 'function') navigate(page);
  }

  panelButton.addEventListener('click', openPanel);
  document.getElementById('cloudPanelClose').addEventListener('click', closePanel);
  modal.addEventListener('click', event => {
    if (event.target === modal) closePanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('show')) closePanel();
  });

  uploadProxy.addEventListener('click', () => {
    const source = sourceUploadButton();
    if (source && !source.hidden) source.click();
    syncPanelState();
  });

  downloadProxy.addEventListener('click', () => {
    const source = sourceDownloadButton();
    if (source && !source.hidden) source.click();
    syncPanelState();
  });

  document.getElementById('panelCreateTournament').addEventListener('click', () => {
    goTo('tournament');
    window.setTimeout(() => document.getElementById('createTournamentBtn')?.click(), 120);
  });

  document.getElementById('panelManageTeams').addEventListener('click', () => goTo('teams'));
  document.getElementById('panelManageChampions').addEventListener('click', () => goTo('champions'));

  const statusSource = document.querySelector('.cloud-status');
  if (statusSource && window.MutationObserver) {
    new MutationObserver(syncPanelState).observe(statusSource, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true
    });
  }

  function applyAuthState(state) {
    const authorized = Boolean(state?.isAdmin);
    panelButton.hidden = !authorized;
    if (!authorized) closePanel();
    window.setTimeout(syncPanelState, 0);
  }

  if (authCore?.subscribe) {
    authCore.subscribe(applyAuthState);
  } else {
    firebase.auth().onAuthStateChanged(user => {
      const email = String(user?.email || '').toLowerCase();
      const allowed = window.ARENA_ADMIN_EMAILS || [];
      applyAuthState({ isAdmin: Boolean(user && allowed.includes(email)) });
    });
  }
})();