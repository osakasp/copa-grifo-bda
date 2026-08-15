(() => {
  'use strict';
  if (window.ArenaDOMEvents) return;

  const subscribers = new Set();
  let observer = null;
  let queued = [];
  let frame = 0;

  function matches(records, selector) {
    if (!selector) return true;
    for (const record of records) {
      for (const nodes of [record.addedNodes, record.removedNodes]) {
        for (const node of nodes) {
          if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) return true;
        }
      }
    }
    return false;
  }

  function flush() {
    frame = 0;
    const records = queued;
    queued = [];
    subscribers.forEach(entry => {
      if (!matches(records, entry.selector)) return;
      try { entry.callback(records); } catch (error) { console.error('ArenaDOMEvents', error); }
    });
    window.dispatchEvent(new CustomEvent('arena:dom-changed', { detail: { records: records.length } }));
  }

  function start() {
    if (observer || !document.body) return;
    observer = new MutationObserver(records => {
      queued.push(...records);
      if (!frame) frame = requestAnimationFrame(flush);
    });
    // Os assinantes decoram conteúdo inserido. Observar cada troca de classe fazia
    // navegação, animações e estados de botão reexecutarem todos eles no celular.
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function subscribe(callback, options = {}) {
    const entry = { callback, selector: options.selector || '' };
    subscribers.add(entry);
    start();
    return () => subscribers.delete(entry);
  }

  window.ArenaDOMEvents = Object.freeze({ subscribe, subscriberCount: () => subscribers.size });
})();
