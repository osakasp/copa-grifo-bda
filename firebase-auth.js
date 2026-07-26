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
      'auth/user-disabled': 'Esta conta foi desativada'
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
      isAdmin: isAdminUser(user)
    });
  }

  function publish(user) {
    currentUser = user || null;
    const state = stateFor(currentUser);
    document.documentElement.classList.toggle('arena-admin-authenticated', state.isAdmin);
    document.documentElement.dataset.arenaAuth = state.isAdmin ? 'admin' : state.isAuthenticated ? 'unauthorized' : 'visitor';

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
    subscribe(listener, immediate = true) {
      if (typeof listener !== 'function') return () => {};
      subscribers.add(listener);
      if (immediate) listener(stateFor(currentUser));
      return () => subscribers.delete(listener);
    },
    signIn(email, password) {
      return auth.signInWithEmailAndPassword(normalizeEmail(email), password);
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

    if (user && !state.isAdmin) {
      showToast('Esta conta não possui permissão administrativa');
      auth.signOut().catch(() => {});
    }
  });

  const oldAdminButton = document.getElementById('adminBtn');
  if (!oldAdminButton) return;

  const adminButton = oldAdminButton.cloneNode(true);
  oldAdminButton.replaceWith(adminButton);
  adminButton.textContent = 'ENTRAR';
  adminButton.setAttribute('aria-label', 'Entrar no painel administrativo');

  const subtitle = document.querySelector('.brand-copy span');
  if (subtitle) subtitle.textContent = 'Arena competitiva • Login protegido';

  const adminModal = document.getElementById('adminModal');
  if (adminModal) {
    adminModal.innerHTML = `
      <div class="modal">
        <h2 id="adminModalTitle">Login administrativo</h2>
        <p>Entre com uma conta autorizada no Firebase. A senha não fica salva no código do site.</p>
        <div class="form-grid">
          <label>E-mail
            <input id="adminEmail" type="email" value="claboleirosdeatitude@gmail.com" autocomplete="username" inputmode="email">
          </label>
          <label>Senha
            <input id="adminPassword" type="password" autocomplete="current-password" placeholder="Sua senha do Firebase">
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary" id="adminCancelBtn">Cancelar</button>
          <button type="button" class="primary" id="adminLoginBtn">Entrar</button>
        </div>
        <button type="button" class="ghost" id="adminResetBtn" style="width:100%;margin-top:10px">Redefinir senha por e-mail</button>
      </div>`;
  }

  adminButton.addEventListener('click', async () => {
    if (auth.currentUser) {
      try {
        await authApi.signOut();
        showToast('Sessão administrativa encerrada');
      } catch {
        showToast('Não foi possível encerrar a sessão');
      }
      return;
    }

    if (typeof openModal === 'function') openModal('adminModal');
    else document.getElementById('adminModal')?.classList.add('show');
    document.getElementById('adminPassword')?.focus();
  });

  async function loginAdmin() {
    const emailInput = document.getElementById('adminEmail');
    const passwordInput = document.getElementById('adminPassword');
    const loginButton = document.getElementById('adminLoginBtn');
    const email = normalizeEmail(emailInput?.value);
    const password = passwordInput?.value || '';

    if (!email || !password) {
      showToast('Digite o e-mail e a senha');
      return;
    }

    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'Entrando...';
    }

    try {
      const credential = await authApi.signIn(email, password);
      if (!isAdminUser(credential.user)) {
        await authApi.signOut();
        showToast('Esta conta não possui permissão administrativa');
        return;
      }

      if (passwordInput) passwordInput.value = '';
      if (typeof closeModal === 'function') closeModal('adminModal');
      else document.getElementById('adminModal')?.classList.remove('show');
      showToast('Login administrativo confirmado');
    } catch (error) {
      showToast(authErrorMessage(error));
    } finally {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'Entrar';
      }
    }
  }

  document.getElementById('adminLoginBtn')?.addEventListener('click', loginAdmin);
  document.getElementById('adminPassword')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') loginAdmin();
  });
  document.getElementById('adminCancelBtn')?.addEventListener('click', () => {
    if (typeof closeModal === 'function') closeModal('adminModal');
    else document.getElementById('adminModal')?.classList.remove('show');
  });
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
})();