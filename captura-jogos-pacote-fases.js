(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let packageBusy = false;
  let scheduled = false;

  function triggerChange(element) {
    element?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function syncToggle(modal) {
    const scope = $('#artScope', modal);
    const wrap = $('#artPhasePackageWrap', modal);
    const input = $('#artPhasePackage', modal);
    if (!scope || !wrap || !input) return;
    const enabled = scope.value === 'all';
    wrap.hidden = !enabled;
    if (!enabled) input.checked = false;
    else if (!wrap.dataset.userTouched) input.checked = true;
  }

  function injectToggle(modal) {
    if ($('#artPhasePackageWrap', modal)) return;
    const target = $('#artExportPackageWrap', modal) || $('#artCaptureGuidance', modal) || $('.art-config-grid', modal);
    if (!target) return;
    const wrap = document.createElement('label');
    wrap.id = 'artPhasePackageWrap';
    wrap.className = 'art-phase-package';
    wrap.innerHTML = '<input id="artPhasePackage" type="checkbox" checked><span><b>📦 Baixar todas as fases separadas</b><small>O site vai gerar uma arte por fase: preliminar, oitavas, quartas, semifinal e final.</small></span>';
    target.insertAdjacentElement('afterend', wrap);

    const scope = $('#artScope', modal);
    const input = $('#artPhasePackage', modal);
    if (scope && !scope.dataset.phasePackageHook) {
      scope.dataset.phasePackageHook = 'true';
      scope.addEventListener('change', () => syncToggle(modal));
    }
    if (input && !input.dataset.phasePackageHook) {
      input.dataset.phasePackageHook = 'true';
      input.addEventListener('change', () => {
        wrap.dataset.userTouched = 'true';
      });
    }
    syncToggle(modal);
  }

  function waitForElement(selector, timeout = 25000) {
    return new Promise((resolve, reject) => {
      const existing = $(selector);
      if (existing) return resolve(existing);
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Tempo esgotado para ${selector}`));
      }, timeout);
      const observer = new MutationObserver(() => {
        const element = $(selector);
        if (!element) return;
        clearTimeout(timer);
        observer.disconnect();
        resolve(element);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  async function waitUntilGone(selector, timeout = 12000) {
    const start = Date.now();
    while ($(selector)) {
      if (Date.now() - start > timeout) throw new Error(`Elemento ainda visível: ${selector}`);
      await wait(120);
    }
  }

  async function exportPackage(settings) {
    if (packageBusy) return;
    const buttons = $$('.pro-phase-photo').filter(button => button.closest('.gi-phase'));
    if (!buttons.length) return notify('Nenhuma fase disponível para exportar');

    packageBusy = true;
    try {
      $('#artConfigurator [data-art-config-close]')?.click();
      notify(`Gerando pacote com ${buttons.length} fases...`);

      for (const [index, button] of buttons.entries()) {
        const phase = button.closest('.gi-phase');
        const phaseName = $('h3', phase)?.textContent?.trim() || `Fase ${index + 1}`;
        notify(`Gerando ${index + 1}/${buttons.length}: ${phaseName}`);

        button.click();
        const modal = await waitForElement('#artConfigurator', 10000);
        const form = $('#artConfigForm', modal);
        const scope = $('#artScope', modal);
        const format = $('#artFormat', modal);
        const quality = $('#artQuality', modal);
        const zoom = $('#artZoom', modal);

        if (scope) scope.value = 'phase';
        if (format) format.value = settings.format;
        if (quality) quality.value = settings.quality;
        if (zoom) zoom.value = settings.zoom;
        triggerChange(scope || format || quality || zoom);

        await nextFrame();
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        const preview = await waitForElement('#artCapturePreview', 45000);
        await wait(600);
        $('[data-art-download]', preview)?.click();
        await wait(900);
        $('[data-art-preview-close]', preview)?.click();
        await waitUntilGone('#artCapturePreview').catch(() => {});
        await wait(450);
      }

      notify('Pacote de fases pronto');
    } catch (error) {
      console.error(error);
      notify('Não foi possível gerar o pacote das fases');
    } finally {
      packageBusy = false;
    }
  }

  function enhance() {
    scheduled = false;
    const modal = $('#artConfigurator');
    if (modal) injectToggle(modal);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('#artConfigForm');
    if (!form || packageBusy) return;
    const modal = $('#artConfigurator');
    if (!modal) return;
    const scope = $('#artScope', modal)?.value;
    const packageMode = Boolean($('#artPhasePackage', modal)?.checked);
    if (!(scope === 'all' && packageMode)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    exportPackage({
      format: $('#artFormat', modal)?.value || 'story',
      quality: $('#artQuality', modal)?.value || 'twoK',
      zoom: $('#artZoom', modal)?.value || 'close'
    });
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .art-phase-package{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(96,226,150,.25);border-radius:15px;background:linear-gradient(90deg,rgba(88,229,154,.12),rgba(255,255,255,.03));color:#b9c9bf}.art-phase-package input{width:auto;min-height:0}.art-phase-package b,.art-phase-package small{display:block}.art-phase-package b{color:#f5dc86;font-size:11px}.art-phase-package small{margin-top:4px;font-size:8px;color:#a8bbb0}
    @media(max-width:720px){.art-phase-package{align-items:flex-start}}
  `;
  document.head.append(style);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();
})();
