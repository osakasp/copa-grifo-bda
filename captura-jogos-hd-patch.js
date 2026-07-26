(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  let lastTrigger = '';
  let scheduled = false;

  function isPreliminary(value) {
    return norm(value).includes('preliminar');
  }

  function triggerChange(element) {
    element?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectPreliminaryPhase() {
    const select = $('#artPhase');
    if (!select) return;
    const option = [...select.options].find(item => isPreliminary(item.textContent));
    if (option) select.value = option.value;
  }

  function addPresetButtons(modal) {
    if ($('#artQuickPresets', modal)) return;
    const preview = $('.art-config-preview', modal);
    if (!preview) return;
    const presets = document.createElement('div');
    presets.id = 'artQuickPresets';
    presets.className = 'art-quick-presets';
    presets.innerHTML = `
      <button type="button" data-art-preset="status"><b>📱 Status HD</b><small>9:16 • 2K • nomes maiores</small></button>
      <button type="button" data-art-preset="post"><b>🖼️ Publicação</b><small>4:5 • 2K • ideal para grupos</small></button>
      <button type="button" data-art-preset="max"><b>✨ Qualidade máxima</b><small>9:16 • 4K • arquivo maior</small></button>`;
    preview.before(presets);

    presets.addEventListener('click', event => {
      const button = event.target.closest('[data-art-preset]');
      if (!button) return;
      const preset = button.dataset.artPreset;
      const format = $('#artFormat');
      const quality = $('#artQuality');
      const zoom = $('#artZoom');
      if (preset === 'post') {
        if (format) format.value = 'portrait';
        if (quality) quality.value = 'twoK';
        if (zoom) zoom.value = 'close';
      } else if (preset === 'max') {
        if (format) format.value = 'story';
        if (quality) quality.value = 'fourK';
        if (zoom) zoom.value = 'close';
      } else {
        if (format) format.value = 'story';
        if (quality) quality.value = 'twoK';
        if (zoom) zoom.value = 'close';
      }
      triggerChange(format || quality || zoom);
    });
  }

  function addGuidance(modal) {
    if ($('#artCaptureGuidance', modal)) return;
    const grid = $('.art-config-grid', modal);
    if (!grid) return;
    const note = document.createElement('aside');
    note.id = 'artCaptureGuidance';
    note.className = 'art-capture-guidance';
    note.innerHTML = '<b>🏆 Melhor resultado</b><span>Use “Somente uma fase”. O campeonato completo em uma única imagem reduz demais os nomes e escudos.</span>';
    grid.after(note);
  }

  function improveLabels(modal) {
    const scope = $('#artScope', modal);
    if (scope) {
      const labels = {
        single: 'Somente um jogo em destaque',
        phase: 'Somente uma fase em HD',
        all: 'Todas as fases em uma imagem longa',
        bracket: 'Chaveamento completo'
      };
      [...scope.options].forEach(option => {
        if (labels[option.value]) option.textContent = labels[option.value];
      });
    }
    const title = $('h2', modal);
    if (title) title.textContent = 'Criar imagem dos jogos em HD';
    const description = $('header p', modal);
    if (description) description.textContent = 'Escolha uma fase para manter nomes, escudos e placares grandes no celular.';
  }

  function applyRecommendedDefaults(modal) {
    if (modal.dataset.hdDefaultsApplied === 'true') return;
    modal.dataset.hdDefaultsApplied = 'true';
    const scope = $('#artScope', modal);
    const format = $('#artFormat', modal);
    const quality = $('#artQuality', modal);
    const zoom = $('#artZoom', modal);

    if (lastTrigger === 'all') {
      if (scope) scope.value = 'phase';
      selectPreliminaryPhase();
    }

    const mode = scope?.value || 'phase';
    if (format) format.value = mode === 'single' ? 'portrait' : 'story';
    if (quality) quality.value = 'twoK';
    if (zoom) zoom.value = mode === 'all' || mode === 'bracket' ? 'wide' : 'close';
    triggerChange(scope || format || quality || zoom);
  }

  function enhanceConfigurator(modal) {
    improveLabels(modal);
    addGuidance(modal);
    addPresetButtons(modal);
    applyRecommendedDefaults(modal);

    const scope = $('#artScope', modal);
    if (scope && !scope.dataset.hdListener) {
      scope.dataset.hdListener = 'true';
      scope.addEventListener('change', () => {
        const format = $('#artFormat', modal);
        const quality = $('#artQuality', modal);
        const zoom = $('#artZoom', modal);
        if (scope.value === 'phase') selectPreliminaryPhase();
        if (format) format.value = scope.value === 'single' ? 'portrait' : 'story';
        if (quality && quality.value === 'hd') quality.value = 'twoK';
        if (zoom) zoom.value = ['all', 'bracket'].includes(scope.value) ? 'wide' : 'close';
        triggerChange(format || quality || zoom);
      });
    }
  }

  function highlightPreliminary(stage) {
    if (stage.dataset.preliminaryChecked === 'true') return;
    stage.dataset.preliminaryChecked = 'true';
    const stageTitle = $('.art-shot-title h1', stage)?.textContent || '';
    if (isPreliminary(stageTitle)) stage.classList.add('art-preliminary-stage');
    $$('.art-phase-block', stage).forEach(block => {
      const name = $('h2', block)?.textContent || '';
      if (isPreliminary(name)) block.classList.add('art-preliminary-highlight');
    });
  }

  function runEnhancements() {
    scheduled = false;
    const modal = $('#artConfigurator');
    if (modal) enhanceConfigurator(modal);
    $$('.art-shot-stage').forEach(highlightPreliminary);
  }

  function scheduleEnhancements() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(runEnhancements);
  }

  window.addEventListener('click', event => {
    const button = event.target.closest?.('[data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo');
    if (!button) return;
    if (button.matches('[data-pro-photo]')) lastTrigger = 'all';
    else if (button.matches('[data-pro-bracket]')) lastTrigger = 'bracket';
    else if (button.matches('.pro-phase-photo')) lastTrigger = 'phase';
    else lastTrigger = 'single';
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .art-capture-guidance{grid-column:1/-1;display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid rgba(245,220,134,.38);border-radius:15px;background:linear-gradient(90deg,rgba(245,220,134,.14),rgba(245,220,134,.04));color:#b9c9bf;font-size:10px;line-height:1.45}.art-capture-guidance b{color:#f5dc86;white-space:nowrap}
    .art-quick-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.art-quick-presets button{display:grid;gap:4px;min-height:68px;padding:11px;border:1px solid rgba(245,220,134,.22);border-radius:15px;color:#eef5f0;background:#ffffff05;text-align:left}.art-quick-presets button:active{transform:scale(.98)}.art-quick-presets b,.art-quick-presets small{display:block}.art-quick-presets b{color:#f5dc86;font-size:11px}.art-quick-presets small{color:#9fb2a6;font-size:8px}
    .art-shot-stage.art-preliminary-stage .art-shot-header{border-width:2px;box-shadow:0 0 42px rgba(226,184,55,.27),0 25px 65px #0007}.art-shot-stage.art-preliminary-stage .art-shot-title h1{color:#ffe58c;text-shadow:0 0 26px rgba(229,184,51,.30)}
    .art-phase-block.art-preliminary-highlight{border:3px solid #dfb83f;background:radial-gradient(circle at 50% 0,rgba(255,210,67,.20),transparent 34%),linear-gradient(150deg,#173923,#06100a);box-shadow:0 0 0 7px rgba(223,184,63,.07),0 0 38px rgba(223,184,63,.26),0 24px 60px #0006}.art-phase-block.art-preliminary-highlight>header span{font-size:12px;color:#ffe17a;text-shadow:0 0 15px rgba(231,184,45,.44)}.art-phase-block.art-preliminary-highlight>header h2{font-size:42px;color:#ffe58e;text-shadow:0 0 22px rgba(231,184,45,.32)}.art-phase-block.art-preliminary-highlight .art-game-card{border:2px solid rgba(231,190,62,.72);box-shadow:inset 0 0 18px rgba(231,190,62,.07),0 0 17px rgba(231,190,62,.11)}
    .art-shot-stage.art-phase[data-format=story] .art-phase-block>main,.art-shot-stage.art-all[data-format=story] .art-phase-block>main{grid-template-columns:repeat(2,minmax(0,1fr))}.art-shot-stage.art-phase .art-card-team{min-height:74px}.art-shot-stage.art-phase .art-card-team>b{font-size:15px}.art-shot-stage.art-phase .art-team-badge{width:58px;height:58px}.art-shot-stage.art-phase .art-card-team{grid-template-columns:58px 1fr 58px}.art-shot-stage.art-phase .art-card-team>strong{width:54px;height:48px;font-size:28px}
    @media(max-width:720px){.art-quick-presets{grid-template-columns:1fr}.art-capture-guidance{align-items:flex-start;flex-direction:column;gap:4px}.art-capture-guidance b{white-space:normal}}
  `;
  document.head.append(style);

  const observer = new MutationObserver(scheduleEnhancements);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleEnhancements();
})();
