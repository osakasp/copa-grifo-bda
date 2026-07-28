(() => {
  'use strict';

  const FORMATS = Object.freeze({
    square: { width: 1080, height: 1080, label: 'Quadrado 1:1' },
    portrait: { width: 1080, height: 1350, label: 'Post 4:5' },
    story: { width: 1080, height: 1920, label: 'Story 9:16' }
  });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const notify = message => typeof window.toast === 'function' ? window.toast(message) : console.info(message);

  let retryTimers = [];

  function clearRetries() {
    retryTimers.forEach(timer => clearTimeout(timer));
    retryTimers = [];
  }

  function managerRoot() {
    return $('#giManager') || document;
  }

  function availablePhases() {
    return $$('.gi-phase', managerRoot())
      .map((element, index) => ({
        element,
        index,
        name: $('h3', element)?.textContent?.trim() || `Fase ${index + 1}`,
        games: $$('.gi-game', element)
      }))
      .filter(item => item.games.length > 0);
  }

  function scoreValues(card) {
    const central = $$('.gip-scoreboard > .gi-score-input, .gip-scoreboard > .gi-score', card)
      .slice(0, 2)
      .map(element => {
        const raw = 'value' in element ? element.value : element.textContent;
        const value = String(raw ?? '').trim();
        return value === '' ? '–' : value;
      });
    if (central.length === 2) return central;

    return $$('.gi-team', card).slice(0, 2).map(team => {
      const input = $('input[type="number"]', team);
      const value = input ? input.value : $('.gi-score', team)?.textContent;
      return String(value ?? '').trim() || '–';
    });
  }

  function gamePreview(card) {
    const teams = $$('.gi-team', card).slice(0, 2);
    const scores = scoreValues(card);
    const name = team => $('strong', team)?.textContent?.trim() || 'A definir';
    return {
      a: name(teams[0]),
      b: name(teams[1]),
      sa: scores[0] || '–',
      sb: scores[1] || '–'
    };
  }

  function selectedPhase(modal) {
    const list = availablePhases();
    const index = Number($('#artPhase', modal)?.value || 0);
    return list[index] || list[0] || null;
  }

  function updateOutput(modal) {
    const key = $('#artFormat', modal)?.value;
    const format = FORMATS[key] || FORMATS.story;
    const output = $('#artOutputSize', modal);
    if (output) output.textContent = `${format.width} × ${format.height} px`;
    const mock = $('#artFormatMock', modal);
    if (mock) mock.style.aspectRatio = `${format.width}/${format.height}`;
  }

  function renderPreview(modal) {
    const mock = $('#artFormatMock', modal);
    if (!mock) return;

    const phase = selectedPhase(modal);
    const scope = $('#artScope', modal)?.value || 'phase';
    const games = phase?.games?.slice(0, 2).map(gamePreview) || [];
    const label = scope === 'bracket'
      ? 'Chaveamento oficial'
      : phase?.name || 'Aguardando confrontos';

    mock.innerHTML = `
      <span class="art-lite-kicker">${esc(label)}</span>
      <div class="art-lite-games">
        ${games.length
          ? games.map(game => `<article><b>${esc(game.a)}</b><strong>${esc(game.sa)} × ${esc(game.sb)}</strong><b>${esc(game.b)}</b></article>`).join('')
          : '<small>As fases aparecerão assim que os confrontos terminarem de carregar.</small>'}
      </div>
      <small class="art-lite-note">A imagem final terá exatamente a resolução exibida acima.</small>`;
  }

  function updatePhaseState(modal) {
    const scope = $('#artScope', modal);
    const phaseField = $('#artPhaseField', modal);
    const phaseSelect = $('#artPhase', modal);
    const submit = $('#artConfigForm button[type="submit"]', modal);
    if (!scope || !phaseField || !phaseSelect || !submit) return;

    const list = availablePhases();
    const previousText = phaseSelect.options[phaseSelect.selectedIndex]?.textContent?.split('•')[0]?.trim() || '';
    phaseSelect.innerHTML = list.map((phase, index) =>
      `<option value="${index}" ${phase.name === previousText ? 'selected' : ''}>${esc(phase.name)} • ${phase.games.length} ${phase.games.length === 1 ? 'jogo' : 'jogos'}</option>`
    ).join('');

    const needsPhase = scope.value === 'phase';
    phaseField.hidden = !needsPhase;
    phaseSelect.disabled = needsPhase && list.length === 0;
    submit.disabled = needsPhase && list.length === 0;
    submit.textContent = needsPhase && list.length === 0 ? 'Carregando fases...' : '📸 Gerar imagem';

    let status = $('#artLitePhaseStatus', modal);
    if (!status) {
      status = document.createElement('small');
      status.id = 'artLitePhaseStatus';
      phaseField.append(status);
    }
    status.textContent = list.length
      ? `${list.length} fase${list.length === 1 ? '' : 's'} encontrada${list.length === 1 ? '' : 's'}.`
      : 'Aguardando os confrontos do campeonato.';
    status.dataset.state = list.length ? 'ready' : 'loading';

    updateOutput(modal);
    renderPreview(modal);
  }

  function removeField(selector, modal) {
    $(selector, modal)?.closest('label')?.remove();
  }

  function simplify(modal) {
    if (!modal || modal.dataset.arenaLiteReady === 'true') return;
    modal.dataset.arenaLiteReady = 'true';

    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';

    removeField('#artQuality', modal);
    removeField('#artZoom', modal);
    removeField('#artModel', modal);
    $('#artQuickPresets', modal)?.remove();
    $('#artCaptureGuidance', modal)?.remove();
    $('#artPhasePackageWrap', modal)?.remove();
    $('.art-batch-mode', modal)?.remove();
    $('.art-save-defaults', modal)?.remove();

    const scope = $('#artScope', modal);
    if (scope) {
      [...scope.options].forEach(option => {
        if (option.value === 'all') option.remove();
        if (option.value === 'single') option.textContent = 'Somente um jogo';
        if (option.value === 'phase') option.textContent = 'Somente uma fase';
        if (option.value === 'bracket') option.textContent = 'Chaveamento';
      });
      if (!['single', 'phase', 'bracket'].includes(scope.value)) scope.value = 'phase';
    }

    const format = $('#artFormat', modal);
    if (format) {
      [...format.options].forEach(option => {
        if (!FORMATS[option.value]) option.remove();
        else option.textContent = `${FORMATS[option.value].label} • ${FORMATS[option.value].width}×${FORMATS[option.value].height}`;
      });
      if (!FORMATS[format.value]) format.value = 'story';
    }

    const title = $('header h2', modal);
    if (title) title.textContent = 'Criar imagem dos jogos';
    const description = $('header p', modal);
    if (description) description.textContent = 'Escolha o conteúdo, a fase e o formato. A saída será leve e fiel à prévia.';

    const grid = $('.art-config-grid', modal);
    grid?.classList.add('art-lite-grid');

    scope?.addEventListener('change', () => updatePhaseState(modal));
    format?.addEventListener('change', () => {
      updateOutput(modal);
      renderPreview(modal);
    });
    $('#artPhase', modal)?.addEventListener('change', () => renderPreview(modal));

    updatePhaseState(modal);
    clearRetries();
    [120, 350, 800, 1500, 2600].forEach(delay => {
      retryTimers.push(setTimeout(() => {
        if (modal.isConnected) updatePhaseState(modal);
      }, delay));
    });
  }

  function scheduleForTrigger() {
    clearRetries();
    [0, 60, 180, 420].forEach(delay => {
      retryTimers.push(setTimeout(() => simplify($('#artConfigurator')), delay));
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-pro-photo],[data-pro-bracket],.pro-phase-photo,.pro-game-photo')) {
      scheduleForTrigger();
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target instanceof Element ? event.target.closest('#artConfigForm') : null;
    if (!form) return;
    const modal = form.closest('#artConfigurator');
    const scope = $('#artScope', modal)?.value;
    if (scope === 'phase' && !$('#artPhase', modal)?.value && availablePhases().length === 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('Aguarde as fases carregarem antes de gerar a imagem');
    }
  }, true);

  const style = document.createElement('style');
  style.id = 'arenaImageStudioLiteStyles';
  style.textContent = `
    .art-config-grid.art-lite-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    #artLitePhaseStatus{display:block;margin-top:5px;color:var(--muted);font-size:8px;letter-spacing:0;text-transform:none}
    #artLitePhaseStatus[data-state="ready"]{color:var(--green)}
    #artFormatMock{padding:16px!important;align-content:center!important}
    .art-lite-kicker{color:var(--gold-soft);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .art-lite-games{display:grid;gap:8px;width:100%;margin-top:8px}
    .art-lite-games article{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px;padding:9px;border:1px solid rgba(245,220,134,.20);border-radius:12px;background:rgba(0,0,0,.22)}
    .art-lite-games article b{overflow:hidden;color:#f6faf7;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
    .art-lite-games article b:last-child{text-align:right}
    .art-lite-games article strong{color:var(--gold-soft);font-size:13px}
    .art-lite-games small,.art-lite-note{color:var(--muted);font-size:8px;line-height:1.45;text-align:center}
    @media(max-width:620px){.art-config-grid.art-lite-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);
})();