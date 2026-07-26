(() => {
  'use strict';

  const emails = window.ArenaBDAAuth?.emails || [
    'claboleirosdeatitude@gmail.com',
    'miniamikaren@gmail.com'
  ];
  const PRIMARY_ADMIN = String(emails[0] || '').toLowerCase();
  const LEGACY_ADMIN = String(emails[1] || '').toLowerCase();

  if (!window.firebase || typeof firebase.auth !== 'function' || !PRIMARY_ADMIN || !LEGACY_ADMIN) return;

  const auth = firebase.auth();
  const nativeOnAuthStateChanged = auth.onAuthStateChanged.bind(auth);
  let active = false;
  let registrations = 0;

  function legacyCompatibleUser(user) {
    const email = String(user?.email || '').toLowerCase();
    if (!user || email !== PRIMARY_ADMIN) return user;

    return new Proxy(user, {
      get(target, property, receiver) {
        if (property === 'email') return LEGACY_ADMIN;
        return Reflect.get(target, property, receiver);
      }
    });
  }

  function compatibleOnAuthStateChanged(nextOrObserver, error, completed) {
    registrations += 1;

    if (typeof nextOrObserver === 'function') {
      return nativeOnAuthStateChanged(
        user => nextOrObserver(legacyCompatibleUser(user)),
        error,
        completed
      );
    }

    const observer = nextOrObserver || {};
    return nativeOnAuthStateChanged({
      next: user => observer.next?.(legacyCompatibleUser(user)),
      error: observer.error?.bind(observer),
      complete: observer.complete?.bind(observer)
    });
  }

  function start() {
    if (active) return;
    auth.onAuthStateChanged = compatibleOnAuthStateChanged;
    active = true;
    document.documentElement.dataset.arenaLegacyAuth = 'scoped';
  }

  function stop() {
    if (!active) return;
    auth.onAuthStateChanged = nativeOnAuthStateChanged;
    active = false;
    delete document.documentElement.dataset.arenaLegacyAuth;
  }

  window.ARENA_ADMIN_EMAILS = Object.freeze([...emails]);
  window.ArenaBDAAuthCompatibility = Object.freeze({
    start,
    stop,
    isActive: () => active,
    registrations: () => registrations,
    userForLegacy: legacyCompatibleUser,
    reason: 'Compatibilidade restrita aos módulos que ainda verificam um único e-mail',
    primary: PRIMARY_ADMIN,
    legacy: LEGACY_ADMIN
  });
})();
