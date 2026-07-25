(() => {
  'use strict';

  const PRIMARY_ADMIN = 'boleirosdeatitude@gmail.com';
  const LEGACY_ADMIN = 'miniamikaren@gmail.com';

  if (!window.firebase || typeof firebase.auth !== 'function') return;

  const auth = firebase.auth();
  const originalOnAuthStateChanged = auth.onAuthStateChanged.bind(auth);

  function adminCompatibleUser(user) {
    const email = String(user?.email || '').toLowerCase();
    if (!user || email !== PRIMARY_ADMIN) return user;

    return new Proxy(user, {
      get(target, property, receiver) {
        if (property === 'email') return LEGACY_ADMIN;
        return Reflect.get(target, property, receiver);
      }
    });
  }

  auth.onAuthStateChanged = function onAuthStateChangedWithAdminAlias(nextOrObserver, error, completed) {
    if (typeof nextOrObserver === 'function') {
      return originalOnAuthStateChanged(
        user => nextOrObserver(adminCompatibleUser(user)),
        error,
        completed
      );
    }

    const observer = nextOrObserver || {};
    return originalOnAuthStateChanged({
      next: user => observer.next?.(adminCompatibleUser(user)),
      error: observer.error?.bind(observer),
      complete: observer.complete?.bind(observer)
    });
  };

  window.ARENA_ADMIN_EMAILS = Object.freeze([
    PRIMARY_ADMIN,
    LEGACY_ADMIN
  ]);
})();
