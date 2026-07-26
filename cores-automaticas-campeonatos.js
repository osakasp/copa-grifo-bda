(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const THEMES = {
    francos: {
      label: 'Copa Francos',
      description: 'Azul, preto e branco',
      icon: '🦅',
      primary: '#17c7f3',
      soft: '#82e7ff',
      secondary: '#f5f8fa',
      bg: '#010307',
      bg2: '#06131d',
      surface: '#0b2230',
      surface2: '#02090f',
      text: '#f8fcfe',
      muted: '#afc5cf',
      success: '#72e7ff',
      border: 'rgba(23,199,243,.46)',
      glow: 'rgba(23,199,243,.30)'
    },
    grifo: {
      label: 'Copa Grifo BDA',
      description: 'Dourado, verde e preto',
      icon: '🦅',
      primary: '#d3a93a',
      soft: '#f5dc86',
      secondary: '#58e59a',
      bg: '#020503',
      bg2: '#07140d',
      surface: '#173d28',
      surface2: '#06100a',
      text: '#f7faf6',
      muted: '#a8bbb0',
      success: '#58e59a',
      border: 'rgba(245,220,134,.40)',
      glow: 'rgba(211,169,58,.27)'
    },
    supercopa: {
      label: 'SuperCopa BDA',
      description: 'Vermelho, dourado e preto',
      icon: '⚡',
      primary: '#ef334f',
      soft: '#ff7789',
      secondary: '#f4c95d',
      bg: '#080204',
      bg2: '#1d070c',
      surface: '#42101b',
      surface2: '#120408',
      text: '#fff8f7',
      muted: '#d2afb4',
      success: '#f4c95d',
      border: 'rgba(244,201,93,.42)',
      glow: 'rgba(239,51,79,.30)'
    },
    ligaA: {
      label: 'Liga A BDA',
      description: 'Dourado, âmbar e preto',
      icon: '🥇',
      primary: '#e4b43d',
      soft: '#ffe08a',
      secondary: '#b97912',
      bg: '#050301',
      bg2: '#171005',
      surface: '#3a2a0e',
      surface2: '#100b03',
      text: '#fffaf0',
      muted: '#cbbf9f',
      success: '#ffe08a',
      border: 'rgba(255,224,138,.43)',
      glow: 'rgba(228,180,61,.30)'
    },
    ligaB: {
      label: 'Liga B BDA',
      description: 'Prata, azul e azul-marinho',
      icon: '🛡️',
      primary: '#8eb8df',
      soft: '#dce8f1',
      secondary: '#b7c3cc',
      bg: '#02070d',
      bg2: '#081827',
      surface: '#17344d',
      surface2: '#06111c',
      text: '#f5f9fc',
      muted: '#afc0cd',
      success: '#a9d4fa',
      border: 'rgba(220,232,241,.37)',
      glow: 'rgba(94,151,204,.30)'
    },
    aguia: {
      label: 'Copa Águia BDA',
      description: 'Azul royal, dourado e preto',
      icon: '🦅',
      primary: '#4285ff',
      soft: '#8ab7ff',
      secondary: '#e0b84b',
      bg: '#02050c',
      bg2: '#07142c',
      surface: '#122e62',
      surface2: '#050d1e',
      text: '#f7faff',
      muted: '#adbedb',
      success: '#e0b84b',
      border: 'rgba(138,183,255,.40)',
      glow: 'rgba(66,133,255,.30)'
    },
    default: {
      label: 'Arena BDA',
      description: 'Verde, dourado e preto',
      icon: '🏆',
      primary: '#d3a93a',
      soft: '#f5dc86',
      secondary: '#58e59a',
      bg: '#020503',
      bg2: '#07140d',
      surface: '#173d28',
      surface2: '#06100a',
      text: '#f7faf6',
      muted: '#a8bbb0',
      success: '#58e59a',
      border: 'rgba(245,220,134,.40)',
      glow: 'rgba(211,169,58,.27)'
    }
  };

  function themeKey(name) {
    const value = norm(name);
    if (value.includes('francos')) return 'francos';
    if (value.includes('supercopa') || value.includes('super copa')) return 'supercopa';
    if (/liga\s*a(?:\s|$)/.test(value)) return 'ligaA';
    if (/liga\s*b(?:\s|$)/.test(value)) return 'ligaB';
    if (value.includes('aguia')) return 'aguia';
    if (value.includes('grifo')) return 'grifo';
    return 'default';
  }

  function currentChampionshipName() {
    return $('#giManager .gi-head h2')?.textContent?.trim()
      || $('#arenaDetail .arena-hero-copy h2')?.textContent?.trim()
      || $('.art-shot-stage .art-logos b')?.textContent?.trim()
      || 'Arena BDA';
  }

  function themeFor(name) {
    const key = themeKey(name);
    return { key, ...THEMES[key] };
  }

  function applyVariables(element, theme) {
    if (!element) return;
    element.dataset.artTheme = theme.key;
    element.style.setProperty('--art-primary', theme.primary);
    element.style.setProperty('--art-soft', theme.soft);
    element.style.setProperty('--art-secondary', theme.secondary);
    element.style.setProperty('--art-bg', theme.bg);
    element.style.setProperty('--art-bg-2', theme.bg2);
    element.style.setProperty('--art-surface', theme.surface);
    element.style.setProperty('--art-surface-2', theme.surface2);
    element.style.setProperty('--art-text', theme.text);
    element.style.setProperty('--art-muted', theme.muted);
    element.style.setProperty('--art-success', theme.success);
    element.style.setProperty('--art-border', theme.border);
    element.style.setProperty('--art-glow', theme.glow);
  }

  function stageName(stage) {
    return $('.art-logos b', stage)?.textContent?.trim()
      || $('.art-shot-title p', stage)?.textContent?.split('•').pop()?.trim()
      || currentChampionshipName();
  }

  function applyStageTheme(stage) {
    if (!stage || stage.dataset.autoThemeApplied === 'true') return;
    const theme = themeFor(stageName(stage));
    stage.dataset.autoThemeApplied = 'true';
    applyVariables(stage, theme);
    stage.setAttribute('aria-label', `Arte com identidade visual de ${theme.label}`);
  }

  function themeCardHtml(theme) {
    return `<aside class="art-auto-theme-card" id="artAutoThemeCard">
      <div class="art-auto-theme-icon">${theme.icon}</div>
      <div><span>Identidade automática</span><b>${theme.label}</b><small>${theme.description}. As cores serão aplicadas à arte gerada.</small></div>
      <div class="art-auto-theme-swatches" aria-label="Paleta de cores"><i style="background:${theme.primary}"></i><i style="background:${theme.secondary}"></i><i style="background:${theme.bg2}"></i></div>
    </aside>`;
  }

  function applyConfiguratorTheme(modal) {
    if (!modal) return;
    const theme = themeFor(currentChampionshipName());
    applyVariables(modal, theme);
    const mock = $('#artFormatMock', modal);
    applyVariables(mock, theme);

    let card = $('#artAutoThemeCard', modal);
    if (!card) {
      const preview = $('.art-config-preview', modal);
      preview?.insertAdjacentHTML('beforebegin', themeCardHtml(theme));
      card = $('#artAutoThemeCard', modal);
    }
    if (card && card.dataset.themeKey !== theme.key) {
      card.outerHTML = themeCardHtml(theme);
      card = $('#artAutoThemeCard', modal);
    }
    if (card) card.dataset.themeKey = theme.key;
  }

  function decorateTournamentCards() {
    $$('.arena-card').forEach(card => {
      const name = $('.arena-body h3', card)?.textContent?.trim();
      if (!name) return;
      const theme = themeFor(name);
      card.dataset.competitionTheme = theme.key;
      card.style.setProperty('--competition-primary', theme.primary);
      card.style.setProperty('--competition-soft', theme.soft);
      card.style.setProperty('--competition-bg', theme.bg2);
    });
  }

  function run() {
    const modal = $('#artConfigurator');
    if (modal) applyConfiguratorTheme(modal);
    $$('.art-shot-stage').forEach(applyStageTheme);
    decorateTournamentCards();
  }

  window.ArenaBDACompetitionThemes = {
    get(name) {
      return themeFor(name);
    },
    apply(element, name) {
      applyVariables(element, themeFor(name));
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    .art-shot-stage{
      color:var(--art-text)!important;
      background:
        radial-gradient(circle at 88% 0,color-mix(in srgb,var(--art-primary) 24%,transparent),transparent 27%),
        radial-gradient(circle at 5% 58%,color-mix(in srgb,var(--art-secondary) 10%,transparent),transparent 25%),
        linear-gradient(180deg,var(--art-bg-2),var(--art-bg) 58%,#010201)!important;
    }
    .art-shot-stage:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg,transparent 0 50%,color-mix(in srgb,var(--art-primary) 5%,transparent) 51%,transparent 52% 100%);background-size:280px 280px}
    .art-shot-stage .art-shot-header{border-color:var(--art-border)!important;background:radial-gradient(circle at 90% 0,color-mix(in srgb,var(--art-primary) 34%,transparent),transparent 35%),linear-gradient(135deg,var(--art-surface),var(--art-surface-2) 67%,var(--art-bg))!important;box-shadow:0 25px 65px rgba(0,0,0,.42),0 0 42px var(--art-glow)!important}
    .art-shot-stage .art-shot-header:after{color:color-mix(in srgb,var(--art-soft) 9%,transparent)!important}
    .art-shot-stage .art-logos small,.art-shot-stage .art-shot-title>span,.art-shot-stage .art-status-row>span,.art-shot-stage .art-phase-block>header span{color:var(--art-soft)!important}
    .art-shot-stage .art-logos b,.art-shot-stage .art-shot-title h1,.art-shot-stage .art-phase-block>header h2{color:var(--art-text)!important}
    .art-shot-stage .art-league-logo,.art-shot-stage .art-arena-logo,.art-shot-stage .art-team-badge{border-color:var(--art-border)!important;background:linear-gradient(145deg,var(--art-soft),var(--art-primary))!important;box-shadow:0 16px 38px rgba(0,0,0,.38),0 0 24px var(--art-glow)!important}
    .art-shot-stage .art-league-logo:not(.fallback),.art-shot-stage .art-arena-logo:not(.fallback){background:color-mix(in srgb,var(--art-bg) 84%,transparent)!important}
    .art-shot-stage .art-status-row b{color:var(--art-success)!important;border-color:color-mix(in srgb,var(--art-success) 38%,transparent)!important;background:color-mix(in srgb,var(--art-success) 10%,transparent)!important}
    .art-shot-stage .art-single-game,.art-shot-stage .art-phase-block{border-color:color-mix(in srgb,var(--art-soft) 20%,transparent)!important;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--art-primary) 11%,transparent),transparent 34%),linear-gradient(150deg,color-mix(in srgb,var(--art-surface) 93%,transparent),var(--art-surface-2))!important}
    .art-shot-stage .art-main-score>span,.art-shot-stage .art-card-team>strong{color:var(--art-soft)!important;border-color:color-mix(in srgb,var(--art-primary) 30%,transparent)!important;background:var(--art-bg)!important;box-shadow:inset 0 0 26px color-mix(in srgb,var(--art-primary) 8%,transparent)!important}
    .art-shot-stage .art-single-versus article.winner h2,.art-shot-stage .art-card-team.winner b{color:var(--art-soft)!important;text-shadow:0 0 18px var(--art-glow)}
    .art-shot-stage .art-aggregate{border-color:color-mix(in srgb,var(--art-primary) 32%,transparent)!important;background:color-mix(in srgb,var(--art-primary) 8%,transparent)!important}
    .art-shot-stage .art-aggregate b,.art-shot-stage .art-game-card>footer b{color:var(--art-soft)!important}
    .art-shot-stage .art-game-card{border-color:color-mix(in srgb,var(--art-soft) 18%,transparent)!important;background:linear-gradient(150deg,var(--art-surface),var(--art-surface-2))!important;box-shadow:0 13px 31px rgba(0,0,0,.28)!important}
    .art-shot-stage .art-game-card>header{background:color-mix(in srgb,var(--art-primary) 6%,transparent)!important}
    .art-shot-stage .art-game-card>header span{color:var(--art-success)!important}
    .art-shot-stage .art-shot-footer{border-color:color-mix(in srgb,var(--art-primary) 42%,transparent)!important;color:var(--art-muted)!important}
    .art-shot-stage .art-shot-footer b{color:var(--art-soft)!important}
    .art-shot-stage .art-shot-title p,.art-shot-stage .art-single-versus small,.art-shot-stage .art-main-score small,.art-shot-stage .art-game-note,.art-shot-stage .art-phase-block>header>b,.art-shot-stage .art-game-card>header small{color:var(--art-muted)!important}

    .art-configurator{--art-primary:#d3a93a;--art-soft:#f5dc86;--art-secondary:#58e59a;--art-bg:#020503;--art-bg-2:#07140d;--art-surface:#173d28;--art-surface-2:#06100a;--art-text:#f7faf6;--art-muted:#a8bbb0;--art-border:rgba(245,220,134,.40);--art-glow:rgba(211,169,58,.27)}
    .art-configurator>section{border-color:var(--art-border)!important;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--art-primary) 18%,transparent),transparent 31%),linear-gradient(150deg,var(--art-surface),var(--art-bg))!important}
    .art-configurator .art-output-card b,.art-configurator .art-brand-options b,.art-configurator .art-capture-guidance b,.art-configurator .art-quick-presets b{color:var(--art-soft)!important}
    .art-configurator .art-config-preview>div{border-color:var(--art-border)!important;background:radial-gradient(circle at 80% 0,color-mix(in srgb,var(--art-primary) 34%,transparent),transparent 35%),linear-gradient(145deg,var(--art-surface),var(--art-surface-2))!important;box-shadow:0 18px 42px rgba(0,0,0,.52),0 0 28px var(--art-glow)!important}
    .art-configurator .art-config-preview>div>b{color:var(--art-soft)!important}
    .art-auto-theme-card{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--art-border);border-radius:17px;background:linear-gradient(90deg,color-mix(in srgb,var(--art-primary) 14%,transparent),rgba(255,255,255,.025));box-shadow:0 12px 28px rgba(0,0,0,.18)}
    .art-auto-theme-icon{display:grid;place-items:center;width:50px;height:50px;border:1px solid var(--art-border);border-radius:15px;background:var(--art-bg);font-size:25px;box-shadow:0 8px 22px rgba(0,0,0,.30)}
    .art-auto-theme-card span,.art-auto-theme-card b,.art-auto-theme-card small{display:block}.art-auto-theme-card span{color:var(--art-soft);font-size:7px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.art-auto-theme-card b{margin-top:4px;color:var(--art-text);font-size:13px;text-transform:uppercase}.art-auto-theme-card small{margin-top:3px;color:var(--art-muted);font-size:8px;line-height:1.4}
    .art-auto-theme-swatches{display:flex;gap:5px}.art-auto-theme-swatches i{width:20px;height:20px;border:2px solid rgba(255,255,255,.18);border-radius:50%;box-shadow:0 5px 12px rgba(0,0,0,.28)}

    .arena-card[data-competition-theme]{position:relative}.arena-card[data-competition-theme] .arena-cover{box-shadow:inset 0 -3px var(--competition-primary)!important}.arena-card[data-competition-theme] .arena-status{border-color:color-mix(in srgb,var(--competition-primary) 58%,transparent)!important}.arena-card[data-competition-theme] .arena-edition{color:var(--competition-soft)!important}
    @media(max-width:650px){.art-auto-theme-card{grid-template-columns:44px 1fr}.art-auto-theme-icon{width:43px;height:43px}.art-auto-theme-swatches{grid-column:1/-1}.art-auto-theme-swatches i{width:18px;height:18px}}
  `;
  document.head.append(style);

  let timer = 0;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 20);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('arena:tournament-logo-updated', run);
  run();
})();
