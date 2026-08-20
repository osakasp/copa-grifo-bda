(() => {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyD_crTo2KoA_EyS1oET1P0EzhpDoYJ1RDE',
    authDomain: 'copa-grifo-bda-5f889.firebaseapp.com',
    projectId: 'copa-grifo-bda-5f889',
    storageBucket: 'copa-grifo-bda-5f889.firebasestorage.app',
    messagingSenderId: '162191999957',
    appId: '1:162191999957:web:435cbb4370f0cd4ae4335c',
    measurementId: 'G-64HK5GVSQN'
  };

  const ADMIN_EMAILS = new Set([
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ]);

  const normalizeEmail = value => String(value || '').trim().toLowerCase();

  function showToast(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  function authErrorMessage(error) {
    const messages = {
      'auth/invalid-credential': 'E-mail ou senha incorretos',
      'auth/wrong-password': 'E-mail ou senha incorretos',
      'auth/user-not-found': 'E-mail ou senha incorretos',
      'auth/invalid-email': 'E-mail inválido',
      'auth/missing-password': 'Digite a senha',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      'auth/network-request-failed': 'Falha de conexão com o Firebase',
      'auth/user-disabled': 'Esta conta foi desativada',
      'auth/not-admin': 'Esta conta não possui acesso administrativo'
    };
    return messages[error?.code] || 'Não foi possível entrar';
  }

  if (!window.firebase || typeof firebase.auth !== 'function') {
    showToast('O Firebase não carregou');
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

  let currentUser = null;
  const subscribers = new Set();

  function isAdminUser(user = currentUser) {
    return Boolean(user && ADMIN_EMAILS.has(normalizeEmail(user.email)));
  }

  function stateFor(user = currentUser) {
    const admin = isAdminUser(user);
    return Object.freeze({
      user: admin ? user : null,
      email: admin ? normalizeEmail(user?.email) : '',
      isAuthenticated: admin,
      isMember: admin,
      isAdmin: admin
    });
  }

  function publish(user) {
    currentUser = isAdminUser(user) ? user : null;
    const state = stateFor(currentUser);
    document.documentElement.classList.toggle('arena-admin-authenticated', state.isAdmin);
    document.documentElement.classList.remove('arena-member-authenticated');
    document.documentElement.dataset.arenaAuth = state.isAdmin ? 'admin' : 'visitor';

    subscribers.forEach(listener => {
      try { listener(state); }
      catch (error) { console.error('Falha em um assinante da autenticação Arena BDA', error); }
    });

    window.dispatchEvent(new CustomEvent('arena:auth-changed', { detail: state }));
    return state;
  }

  async function signInAdmin(email, password) {
    const credential = await auth.signInWithEmailAndPassword(normalizeEmail(email), password);
    if (!isAdminUser(credential.user)) {
      await auth.signOut().catch(() => {});
      const error = new Error('Acesso restrito aos administradores');
      error.code = 'auth/not-admin';
      throw error;
    }
    publish(credential.user);
    return credential;
  }

  const authApi = {
    emails: Object.freeze([...ADMIN_EMAILS]),
    auth,
    currentUser: () => currentUser,
    currentEmail: () => normalizeEmail(currentUser?.email),
    state: () => stateFor(currentUser),
    isAdmin: user => isAdminUser(user === undefined ? currentUser : user),
    isMember: () => Boolean(currentUser),
    subscribe(listener, immediate = true) {
      if (typeof listener !== 'function') return () => {};
      subscribers.add(listener);
      if (immediate) listener(stateFor(currentUser));
      return () => subscribers.delete(listener);
    },
    signIn: signInAdmin,
    register() {
      const error = new Error('Cadastro público desativado');
      error.code = 'auth/not-admin';
      return Promise.reject(error);
    },
    signOut() { return auth.signOut(); },
    resetPassword(email) { return auth.sendPasswordResetEmail(normalizeEmail(email)); }
  };

  window.ArenaBDAAuth = Object.freeze(authApi);
  window.ARENA_ADMIN_EMAILS = authApi.emails;

  function setLegacyAdminState(authorized) {
    try {
      isAdmin = Boolean(authorized);
      if (typeof updateAdminUI === 'function') updateAdminUI();
    } catch (error) {
      console.warn('Não foi possível atualizar o estado administrativo legado', error);
    }
  }

  auth.onAuthStateChanged(user => {
    if (user && !isAdminUser(user)) {
      publish(null);
      auth.signOut().catch(() => {});
      setLegacyAdminState(false);
      return;
    }
    const state = publish(user);
    setLegacyAdminState(state.isAdmin);
  });

  const oldAdminButton = document.getElementById('adminBtn');
  if (!oldAdminButton) return;

  const adminButton = oldAdminButton.cloneNode(true);
  oldAdminButton.replaceWith(adminButton);
  adminButton.textContent = 'ENTRAR';
  adminButton.setAttribute('aria-label', 'Acesso administrativo');
  adminButton.title = 'Acesso administrativo';

  const previousLogout = document.getElementById('memberLogoutBtn');
  previousLogout?.remove();
  const logoutButton = adminButton.cloneNode(false);
  logoutButton.id = 'memberLogoutBtn';
  logoutButton.classList.add('member-logout-btn');
  logoutButton.textContent = 'SAIR';
  logoutButton.hidden = true;
  logoutButton.setAttribute('aria-label', 'Sair da administração');
  adminButton.insertAdjacentElement('afterend', logoutButton);

  const subtitle = document.querySelector('.brand-copy span');
  if (subtitle) subtitle.textContent = 'Arena competitiva • Campeonatos do Clã';

  const adminModal = document.getElementById('adminModal');
  if (adminModal) {
    adminModal.dataset.arenaAuthReady = 'true';
    delete adminModal.dataset.arenaLegacyShell;
    adminModal.innerHTML = `
      <div class="modal admin-auth-modal">
        <div class="admin-auth-brand">
          <span>⚜️</span>
          <div><span class="eyebrow">Gestão da Arena BDA</span><h2 id="adminModalTitle">Acesso administrativo</h2></div>
        </div>
        <p id="adminAuthDescription">Entre para gerenciar campeonatos, times, grupos e placares.</p>
        <p id="adminAuthStatus" class="admin-auth-status" hidden aria-live="polite">Conectando...</p>
        <form id="adminAuthForm">
          <div class="form-grid">
            <label>E-mail
              <input id="adminEmail" type="email" autocomplete="username" inputmode="email" placeholder="E-mail administrativo" required>
            </label>
            <label>Senha
              <input id="adminPassword" type="password" minlength="6" autocomplete="current-password" placeholder="Sua senha" required>
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary" id="adminCancelBtn">Cancelar</button>
            <button type="submit" class="primary" id="adminLoginBtn">Entrar</button>
          </div>
        </form>
        <button type="button" class="ghost" id="adminResetBtn">Esqueci minha senha</button>
        <small class="admin-auth-note">Acesso restrito à administração da Arena BDA.</small>
      </div>`;
  }

  if (!document.getElementById('adminAuthStyles')) {
    const style = document.createElement('style');
    style.id = 'adminAuthStyles';
    style.textContent = `
      .admin-auth-modal{width:min(100%,470px)!important}
      .admin-auth-modal [hidden]{display:none!important}
      .admin-auth-brand{display:flex;align-items:center;gap:11px}
      .admin-auth-brand>span{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(242,215,125,.35);border-radius:15px;background:rgba(216,178,72,.09);font-size:23px}
      .admin-auth-brand h2{margin:3px 0 0}
      .admin-auth-modal>p{margin:12px 0;color:var(--muted);font-size:10px;line-height:1.55}
      .admin-auth-status{display:grid;place-items:center;min-height:96px;border:1px solid var(--line);border-radius:13px;background:#07100c;color:var(--text)!important;font-weight:800}
      .admin-auth-modal #adminResetBtn{width:100%;min-height:39px;margin-top:8px}
      .admin-auth-note{display:block;margin-top:11px;color:var(--muted);font-size:7px;line-height:1.5;text-align:center}
    `;
    document.head.append(style);
  }

  let pending = false;

  function openAuthModal() {
    setPending(false);
    if (typeof openModal === 'function') openModal('adminModal');
    else document.getElementById('adminModal')?.classList.add('show');
    window.setTimeout(() => document.getElementById('adminEmail')?.focus(), 0);
  }

  function closeAuthModal() {
    if (typeof closeModal === 'function') closeModal('adminModal');
    else document.getElementById('adminModal')?.classList.remove('show');
  }

  function setPending(value) {
    pending = Boolean(value);
    const form = document.getElementById('adminAuthForm');
    const status = document.getElementById('adminAuthStatus');
    const reset = document.getElementById('adminResetBtn');
    const submit = document.getElementById('adminLoginBtn');
    if (form) form.hidden = pending;
    if (status) status.hidden = !pending;
    if (reset) reset.hidden = pending;
    if (submit) {
      submit.disabled = pending;
      submit.textContent = pending ? 'Entrando...' : 'Entrar';
    }
  }

  async function submitAuth(event) {
    event?.preventDefault?.();
    if (pending) return;
    const email = normalizeEmail(document.getElementById('adminEmail')?.value);
    const passwordInput = document.getElementById('adminPassword');
    const password = passwordInput?.value || '';
    if (!email || !password) return showToast('Digite o e-mail e a senha');
    if (password.length < 6) return showToast('Digite a senha completa');

    setPending(true);
    try {
      await authApi.signIn(email, password);
      if (passwordInput) passwordInput.value = '';
      closeAuthModal();
      showToast('Acesso administrativo confirmado');
      if (typeof navigate === 'function') navigate('tournament');
    } catch (error) {
      setPending(false);
      showToast(authErrorMessage(error));
    }
  }

  adminButton.addEventListener('click', () => {
    if (isAdminUser()) {
      if (typeof navigate === 'function') navigate('tournament');
      return;
    }
    openAuthModal();
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = 'SAINDO...';
    try {
      await authApi.signOut();
      showToast('Sessão administrativa encerrada');
    } catch (error) {
      console.error('Não foi possível encerrar a sessão administrativa', error);
      showToast('Não foi possível sair da conta');
    } finally {
      logoutButton.disabled = false;
      logoutButton.textContent = 'SAIR';
    }
  });

  document.getElementById('adminAuthForm')?.addEventListener('submit', submitAuth);
  document.getElementById('adminCancelBtn')?.addEventListener('click', closeAuthModal);
  document.getElementById('adminResetBtn')?.addEventListener('click', async () => {
    const email = normalizeEmail(document.getElementById('adminEmail')?.value);
    if (!email) return showToast('Digite o e-mail da conta');
    if (!ADMIN_EMAILS.has(email)) return showToast('Digite um e-mail administrativo');
    try {
      await authApi.resetPassword(email);
      showToast('E-mail de redefinição enviado');
    } catch (error) {
      showToast(authErrorMessage(error));
    }
  });

  authApi.subscribe(state => {
    adminButton.textContent = state.isAdmin ? 'ADMIN' : 'ENTRAR';
    adminButton.classList.toggle('active', state.isAdmin);
    adminButton.dataset.accountState = state.isAdmin ? 'admin' : 'visitor';
    adminButton.setAttribute('aria-label', state.isAdmin ? 'Abrir administração' : 'Acesso administrativo');
    logoutButton.hidden = !state.isAdmin;
  });

  window.ArenaBDAAuthUI = Object.freeze({
    open: openAuthModal,
    close: closeAuthModal,
    mode: () => 'login'
  });
})();
