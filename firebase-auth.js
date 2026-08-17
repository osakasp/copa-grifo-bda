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

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

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
      'auth/email-already-in-use': 'Este e-mail já possui uma conta',
      'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres',
      'auth/operation-not-allowed': 'O cadastro por e-mail ainda não foi liberado no Firebase'
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

  let currentUser = auth.currentUser || null;
  const subscribers = new Set();

  function isAdminUser(user = currentUser) {
    return Boolean(user && ADMIN_EMAILS.has(normalizeEmail(user.email)));
  }

  function stateFor(user = currentUser) {
    return Object.freeze({
      user: user || null,
      email: normalizeEmail(user?.email),
      isAuthenticated: Boolean(user),
      isMember: Boolean(user),
      isAdmin: isAdminUser(user)
    });
  }

  function publish(user) {
    currentUser = user || null;
    const state = stateFor(currentUser);
    document.documentElement.classList.toggle('arena-admin-authenticated', state.isAdmin);
    document.documentElement.classList.toggle('arena-member-authenticated', state.isAuthenticated);
    document.documentElement.dataset.arenaAuth = state.isAdmin ? 'admin' : state.isAuthenticated ? 'member' : 'visitor';

    subscribers.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Falha em um assinante da autenticação Arena BDA', error);
      }
    });

    window.dispatchEvent(new CustomEvent('arena:auth-changed', { detail: state }));
    return state;
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
    signIn(email, password) {
      return auth.signInWithEmailAndPassword(normalizeEmail(email), password);
    },
    async register(email, password, displayName) {
      const credential = await auth.createUserWithEmailAndPassword(normalizeEmail(email), password);
      await credential.user.updateProfile({ displayName: String(displayName || '').trim().slice(0, 40) });
      publish(credential.user);
      return credential;
    },
    signOut() {
      return auth.signOut();
    },
    resetPassword(email) {
      return auth.sendPasswordResetEmail(normalizeEmail(email));
    }
  };

  window.ArenaBDAAuth = Object.freeze(authApi);
  window.ARENA_ADMIN_EMAILS = authApi.emails;

  function setAdminState(authorized) {
    try {
      isAdmin = Boolean(authorized);
      if (typeof updateAdminUI === 'function') updateAdminUI();
    } catch (error) {
      console.warn('Não foi possível atualizar o estado administrativo legado', error);
    }
  }

  auth.onAuthStateChanged(user => {
    const state = publish(user);
    setAdminState(state.isAdmin);
  });

  const oldAdminButton = document.getElementById('adminBtn');
  if (!oldAdminButton) return;

  const adminButton = oldAdminButton.cloneNode(true);
  oldAdminButton.replaceWith(adminButton);
  adminButton.textContent = 'ENTRAR';
  adminButton.setAttribute('aria-label', 'Entrar na Comunidade BDA');

  const logoutButton = adminButton.cloneNode(false);
  logoutButton.id = 'memberLogoutBtn';
  logoutButton.classList.add('member-logout-btn');
  logoutButton.textContent = 'SAIR';
  logoutButton.hidden = true;
  logoutButton.setAttribute('aria-label', 'Sair da Comunidade BDA');
  adminButton.insertAdjacentElement('afterend', logoutButton);

  const subtitle = document.querySelector('.brand-copy span');
  if (subtitle) subtitle.textContent = 'Arena competitiva • Comunidade do Clã';

  const adminModal = document.getElementById('adminModal');
  if (adminModal) {
    adminModal.innerHTML = `
      <div class="modal member-auth-modal">
        <div class="member-auth-brand"><span>⚽</span><div><span class="eyebrow">Rede oficial do clã</span><h2 id="adminModalTitle">Comunidade BDA</h2></div></div>
        <p id="memberAuthDescription">Entre para publicar, comentar, seguir membros e conversar em particular.</p>
        <nav class="member-auth-tabs" aria-label="Acesso à comunidade"><button type="button" class="active" data-auth-mode="login">Entrar</button><button type="button" data-auth-mode="register">Criar conta</button></nav>
        <p id="memberAuthStatus" class="member-auth-status" hidden aria-live="polite">Conectando...</p>
        <form id="memberAuthForm">
          <div class="form-grid">
            <label id="memberNameLabel" hidden>Nome no clã
              <input id="memberName" maxlength="40" autocomplete="name" placeholder="Como você quer aparecer">
            </label>
            <label>E-mail
              <input id="adminEmail" type="email" autocomplete="username" inputmode="email" placeholder="seuemail@exemplo.com" required>
            </label>
            <label>Senha
              <input id="adminPassword" type="password" minlength="6" autocomplete="current-password" placeholder="Mínimo de 6 caracteres" required>
            </label>
            <label id="memberConfirmLabel" hidden>Confirmar senha
              <input id="memberConfirmPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Digite a senha novamente">
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary" id="adminCancelBtn">Cancelar</button>
            <button type="submit" class="primary" id="adminLoginBtn">Entrar</button>
          </div>
        </form>
        <button type="button" class="ghost" id="adminResetBtn">Esqueci minha senha</button>
        <small class="member-auth-note">Contas administrativas continuam com acesso exclusivo ao painel de campeonatos.</small>
      </div>`;
  }

  const authStyle = document.createElement('style');
  authStyle.id = 'memberAuthStyles';
  authStyle.textContent = `
    .member-auth-modal{width:min(100%,470px)!important}.member-auth-modal [hidden]{display:none!important}.member-auth-brand{display:flex;align-items:center;gap:11px}.member-auth-brand>span{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(242,215,125,.35);border-radius:15px;background:rgba(216,178,72,.09);font-size:23px}.member-auth-brand h2{margin:3px 0 0}.member-auth-modal>p{margin:12px 0;color:var(--muted);font-size:10px;line-height:1.55}.member-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:13px;padding:5px;border:1px solid var(--line);border-radius:13px;background:#07100c}.member-auth-tabs button{min-height:38px;border:0;border-radius:9px;color:var(--muted);background:transparent;font-size:9px;font-weight:900;text-transform:uppercase}.member-auth-tabs button.active{color:#171107;background:linear-gradient(135deg,var(--gold-soft),var(--gold))}.member-auth-status{display:grid;place-items:center;min-height:112px;margin:8px 0!important;border:1px solid var(--line);border-radius:13px;background:#07100c;color:var(--text)!important;font-size:11px!important;font-weight:800}.member-auth-modal #adminResetBtn{width:100%;min-height:39px;margin-top:8px}.member-auth-note{display:block;margin-top:11px;color:var(--muted);font-size:7px;line-height:1.5;text-align:center}.admin-btn[data-account-state=member]{color:var(--green);border-color:rgba(79,223,143,.35)}
  `;
  document.head.append(authStyle);

  let authMode = 'login';
  let authPending = false;

  function openAuthModal(mode = 'login') {
    setAuthMode(mode);
    setAuthPending(false, mode);
    if (typeof openModal === 'function') openModal('adminModal');
    else document.getElementById('adminModal')?.classList.add('show');
    window.setTimeout(() => document.getElementById(mode === 'register' ? 'memberName' : 'adminEmail')?.focus(), 0);
  }

  function closeAuthModal() {
    if (typeof closeModal === 'function') closeModal('adminModal');
    else document.getElementById('adminModal')?.classList.remove('show');
  }

  function setAuthPending(pending, mode = authMode) {
    authPending = Boolean(pending);
    const registering = mode === 'register';
    const form = document.getElementById('memberAuthForm');
    const tabs = document.querySelector('.member-auth-tabs');
    const status = document.getElementById('memberAuthStatus');
    const reset = document.getElementById('adminResetBtn');
    const loginButton = document.getElementById('adminLoginBtn');
    if (form) form.hidden = authPending;
    if (tabs) tabs.hidden = authPending;
    if (status) {
      status.hidden = !authPending;
      status.textContent = registering ? 'Criando sua conta...' : 'Conectando...';
    }
    if (reset) reset.hidden = authPending || registering;
    if (loginButton) {
      loginButton.disabled = authPending;
      loginButton.textContent = authPending
        ? (registering ? 'Criando conta...' : 'Entrando...')
        : (registering ? 'Criar minha conta' : 'Entrar');
    }
  }

  function setAuthMode(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === authMode));
    const registering = authMode === 'register';
    document.getElementById('memberNameLabel').hidden = !registering;
    document.getElementById('memberConfirmLabel').hidden = !registering;
    document.getElementById('memberName').required = registering;
    document.getElementById('memberConfirmPassword').required = registering;
    document.getElementById('adminPassword').autocomplete = registering ? 'new-password' : 'current-password';
    document.getElementById('adminLoginBtn').textContent = registering ? 'Criar minha conta' : 'Entrar';
    document.getElementById('adminResetBtn').hidden = registering || authPending;
    document.getElementById('memberAuthDescription').textContent = registering
      ? 'Crie seu perfil para participar da comunidade do Clã BDA.'
      : 'Entre para publicar, comentar, seguir membros e conversar em particular.';
  }

  adminButton.addEventListener('click', () => {
    if (currentUser) {
      if (window.ArenaBDACommunity?.openOwnProfile) window.ArenaBDACommunity.openOwnProfile();
      else if (typeof navigate === 'function') navigate('community');
      return;
    }
    openAuthModal('login');
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = 'SAINDO...';
    try {
      await authApi.signOut();
      showToast('Você saiu da comunidade');
    } catch (error) {
      console.error('Não foi possível sair da Comunidade BDA', error);
      showToast('Não foi possível sair da conta');
    } finally {
      logoutButton.disabled = false;
      logoutButton.textContent = 'SAIR';
    }
  });

  async function createPublicProfile(user, displayName) {
    if (!window.firebase || typeof firebase.firestore !== 'function') return;
    await firebase.firestore().collection('members').doc(user.uid).set({
      uid: user.uid,
      displayName: String(displayName || user.displayName || 'Membro BDA').trim().slice(0, 40),
      team: '',
      bio: '',
      avatar: '',
      role: isAdminUser(user) ? 'admin' : 'member',
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function submitAuth(event) {
    event?.preventDefault?.();
    if (authPending) return;
    const submittedMode = authMode;
    const emailInput = document.getElementById('adminEmail');
    const passwordInput = document.getElementById('adminPassword');
    const email = normalizeEmail(emailInput?.value);
    const password = passwordInput?.value || '';
    const name = document.getElementById('memberName')?.value.trim() || '';
    const confirmation = document.getElementById('memberConfirmPassword')?.value || '';

    if (!email || !password) {
      showToast('Digite o e-mail e a senha');
      return;
    }
    if (submittedMode === 'register' && name.length < 2) return showToast('Digite seu nome no clã');
    if (password.length < 6) return showToast('Use uma senha com pelo menos 6 caracteres');
    if (submittedMode === 'register' && password !== confirmation) return showToast('As senhas não coincidem');

    setAuthPending(true, submittedMode);

    try {
      const credential = submittedMode === 'register'
        ? await authApi.register(email, password, name)
        : await authApi.signIn(email, password);
      if (submittedMode === 'register') {
        try { await createPublicProfile(credential.user, name); }
        catch (profileError) { console.error('Não foi possível criar o perfil inicial', profileError); }
      }
      if (passwordInput) passwordInput.value = '';
      const confirmInput = document.getElementById('memberConfirmPassword');
      if (confirmInput) confirmInput.value = '';
      closeAuthModal();
      showToast(submittedMode === 'register' ? 'Conta criada. Bem-vindo à Comunidade BDA!' : 'Login confirmado');
      if (typeof navigate === 'function') navigate('community');
    } catch (error) {
      setAuthPending(false, submittedMode);
      showToast(authErrorMessage(error));
    }
  }

  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
  document.getElementById('memberAuthForm')?.addEventListener('submit', submitAuth);
  document.getElementById('adminCancelBtn')?.addEventListener('click', closeAuthModal);
  document.getElementById('adminResetBtn')?.addEventListener('click', async () => {
    const email = normalizeEmail(document.getElementById('adminEmail')?.value);
    if (!email) {
      showToast('Digite o e-mail da conta');
      return;
    }

    try {
      await authApi.resetPassword(email);
      showToast('E-mail de redefinição enviado');
    } catch (error) {
      showToast(authErrorMessage(error));
    }
  });

  authApi.subscribe(state => {
    const label = state.isAdmin
      ? 'ADMIN'
      : state.isAuthenticated
        ? String(state.user?.displayName || 'MINHA CONTA').split(/\s+/)[0].slice(0, 12).toUpperCase()
        : 'ENTRAR';
    adminButton.textContent = label;
    adminButton.classList.toggle('active', state.isAuthenticated);
    adminButton.dataset.accountState = state.isAdmin ? 'admin' : state.isAuthenticated ? 'member' : 'visitor';
    adminButton.setAttribute('aria-label', state.isAuthenticated ? 'Abrir meu perfil na Comunidade BDA' : 'Entrar na Comunidade BDA');
    logoutButton.hidden = !state.isAuthenticated;
  });

  window.ArenaBDAAuthUI = Object.freeze({ open: openAuthModal, close: closeAuthModal, mode: setAuthMode });
})();
