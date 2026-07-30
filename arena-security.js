(() => {
  'use strict';

  const LIMITS = Object.freeze({ chat: 5_000, teamEdit: 60_000 });
  const LAST_PREFIX = 'arena-security-last:';
  const notify = message => typeof toast === 'function' ? toast(message) : console.warn(message);

  function now() { return Date.now(); }
  function last(key) { return Number(localStorage.getItem(`${LAST_PREFIX}${key}`) || 0); }
  function mark(key) { localStorage.setItem(`${LAST_PREFIX}${key}`, String(now())); }
  function remaining(key, interval) { return Math.max(0, interval - (now() - last(key))); }
  function throttle(key, interval, message) {
    const wait = remaining(key, interval);
    if (!wait) return false;
    notify(message || `Aguarde ${Math.ceil(wait / 1000)} segundos antes de tentar novamente`);
    return true;
  }
  function normalize(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function installChatGuard() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    if (!form || !input || form.dataset.arenaSecurity === 'true') return;
    form.dataset.arenaSecurity = 'true';
    const trap = document.createElement('input');
    trap.type = 'text';
    trap.name = 'website';
    trap.tabIndex = -1;
    trap.autocomplete = 'off';
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    form.append(trap);
    form.addEventListener('submit', event => {
      if (trap.value) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (throttle('chat', LIMITS.chat, 'Aguarde alguns segundos antes de enviar outra mensagem')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const text = normalize(input.value);
      const previous = localStorage.getItem('arena-security-last-chat-text') || '';
      const previousAt = Number(localStorage.getItem('arena-security-last-chat-text-at') || 0);
      if (text && text === previous && now() - previousAt < 30_000) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notify('Esta mensagem já foi enviada');
        return;
      }
      mark('chat');
      localStorage.setItem('arena-security-last-chat-text', text);
      localStorage.setItem('arena-security-last-chat-text-at', String(now()));
    }, true);
  }

  function installGenericFormGuards() {
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (/team.*edit|edit.*team/i.test(form.id || '') && throttle('teamEdit', LIMITS.teamEdit, 'Aguarde antes de enviar outra solicitação')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (/team.*edit|edit.*team/i.test(form.id || '')) mark('teamEdit');
    }, true);
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar ${source}`));
      document.head.append(script);
    });
  }

  async function initializeAppCheck() {
    const key = document.querySelector('meta[name="firebase-app-check-site-key"]')?.content?.trim();
    if (!key) {
      document.documentElement.dataset.arenaAppCheck = 'configuration-required';
      return;
    }
    try {
      if (!firebase.appCheck) await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check-compat.js');
      const appCheck = firebase.appCheck();
      appCheck.activate(new firebase.appCheck.ReCaptchaV3Provider(key), true);
      document.documentElement.dataset.arenaAppCheck = 'active';
    } catch (error) {
      document.documentElement.dataset.arenaAppCheck = 'error';
      console.warn('Firebase App Check não foi ativado', error);
    }
  }

  installChatGuard();
  installGenericFormGuards();
  new MutationObserver(installChatGuard).observe(document.body, { childList: true, subtree: true });
  initializeAppCheck();

  window.ArenaBDASecurity = Object.freeze({
    throttle,
    mark,
    limits: LIMITS,
    appCheckState: () => document.documentElement.dataset.arenaAppCheck || 'unknown'
  });
})();
