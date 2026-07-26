(() => {
  'use strict';

  if (!window.MutationObserver || window.ArenaBDAProfileObserverScope?.active) return;

  const NativeMutationObserver = window.MutationObserver;
  const teamGrid = document.getElementById('teamGrid');
  const created = [];

  class ProfileScopedMutationObserver {
    constructor(callback) {
      this._observer = new NativeMutationObserver(callback);
      created.push(this._observer);
    }

    observe(target, options = {}) {
      const isGlobalBodyWatch = target === document.body
        && options.childList === true
        && options.subtree === true;

      if (isGlobalBodyWatch && teamGrid) {
        return this._observer.observe(teamGrid, {
          childList: true,
          subtree: true
        });
      }

      return this._observer.observe(target, options);
    }

    disconnect() {
      return this._observer.disconnect();
    }

    takeRecords() {
      return this._observer.takeRecords();
    }
  }

  window.MutationObserver = ProfileScopedMutationObserver;
  window.ArenaBDAProfileObserverScope = {
    active: true,
    count: () => created.length,
    restore() {
      if (window.MutationObserver === ProfileScopedMutationObserver) {
        window.MutationObserver = NativeMutationObserver;
      }
      this.active = false;
      window.dispatchEvent(new CustomEvent('arena:profile-observers-scoped', {
        detail: { observers: created.length, target: teamGrid ? '#teamGrid' : 'original' }
      }));
    }
  };
})();