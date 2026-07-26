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
  const originalOnAuthStateChanged = auth.onAuthStateChanged.bind(auth);

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

  auth.onAuthStateChanged = function onAuthStateChangedCompatibility(nextOrObserver, error, completed) {
    if (typeof nextOrObserver === 'function') {
      return originalOnAuthStateChanged(
        user => nextOrObserver(legacyCompatibleUser(user)),
        error,
        completed
      );
    }

    const observer = nextOrObserver || {};
    return originalOnAuthStateChanged({
      next: user => observer.next?.(legacyCompatibleUser(user)),
      error: observer.error?.bind(observer),
      complete: observer.complete?.bind(observer)
    });
  };

  window.ARENA_ADMIN_EMAILS = Object.freeze([...emails]);
  window.ArenaBDAAuthCompatibility = Object.freeze({
    active: true,
    reason: 'Compatibilidade temporária com módulos que ainda verificam um único e-mail',
    primary: PRIMARY_ADMIN,
    legacy: LEGACY_ADMIN
  });
})();