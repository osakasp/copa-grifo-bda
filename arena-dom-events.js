(() => {
  'use strict';
  if (window.ArenaDOMEvents) return;

  const subscribers = new Set();
  let observer = null;
  let queued = [];
  let frame = 0;

  function matches(records, selector) {
    if (!selector) return true;
    return records.some(record => {
      if (record.type === 'attributes') return record.target instanceof Element && record.target.matches(selector);
      return [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && (node.matches(selector) || node.querySelector(selector))
      );
    });
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function subscribe(callback, options = {}) {
    const entry = { callback, selector: options.selector || '' };
    subscribers.add(entry);
    start();
    return () => subscribers.delete(entry);
  }

  window.ArenaDOMEvents = Object.freeze({ subscribe, subscriberCount: () => subscribers.size });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
