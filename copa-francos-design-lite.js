(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const isFrancos = value => norm(value).includes('francos');

  let observer = null;
  let timer = 0;
  let decorating = false;

  function francosActive() {
    const manager = $('#giManager');
    const managerName = $('.gi-head h2', manager)?.textContent || '';
    const detailName = $('#arenaDetail .arena-hero-copy h2')?.textContent || '';
    return manager?.dataset.tid === 'copa-francos' || isFrancos(managerName) || isFrancos(detailName);
  }

  function ensureButton(root, selector, attributes, text, className = 'ghost') {
    if (!root || $(selector, root)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    Object.entries(attributes).forEach(([name, value]) => button.setAttribute(name, value));
    button.textContent = text;
    root.append(button);
  }

  function decorateCard() {
    $$('.arena-card').forEach(card => {
      const title = $('.arena-body h3', card)?.textContent || '';
      card.classList.toggle('francos-lite-card', isFrancos(title));
    });
  }

  function decorateHero() {
    const detail = $('#arenaDetail');
    const hero = $('.arena-hero', detail);
    const active = Boolean(hero && isFrancos($('.arena-hero-copy h2', hero)?.textContent));
    detail?.classList.toggle('francos-lite-detail', active);
    if (!active) return;
    hero.classList.add('francos-lite-hero');
  }

  function restorePhotoButtons(manager) {
    const headActions = $('.gi-head>div:last-child', manager);
    ensureButton(headActions, '[data-pro-photo]', { 'data-pro-photo': '' }, '📸 Criar arte', 'primary');
    ensureButton(headActions, '[data-pro-bracket]', { 'data-pro-bracket': '' }, '📸 Foto da chave', 'ghost');

    $$('.gi-phase', manager).forEach(phase => {
      const header = phase.firstElementChild;
      ensureButton(header, '.pro-phase-photo', {}, '📸 Foto da fase', 'ghost pro-phase-photo');

      $$('.gi-game', phase).forEach(game => {
        game.classList.add('francos-lite-game');
        let tools = $('.francos-lite-photo-tools', game);
        if (!tools) {
          tools = document.createElement('div');
          tools.className = 'francos-lite-photo-tools';
          game.append(tools);
        }
        ensureButton(tools, '.pro-game-photo', {}, '📸 Foto do jogo', 'ghost pro-game-photo');
      });
    });
  }

  function decorateBracket(manager) {
    const bracket = $('.gi-bracket', manager);
    if (!bracket) return;
    bracket.classList.add('francos-lite-bracket');
    $$(':scope>section', bracket).forEach(section => {
      const phase = norm($('h3', section)?.textContent);
      section.dataset.francosFinal = phase === 'final' || phase.includes('grande final') ? 'true' : 'false';
    });
  }

  function decorateManager() {
    const manager = $('#giManager');
    const active = francosActive();
    manager?.classList.toggle('francos-lite-manager', active);
    if (!manager || !active) return;
    restorePhotoButtons(manager);
    decorateBracket(manager);
  }

  function decorate() {
    if (decorating) return;
    decorating = true;
    observer?.disconnect();
    try {
      decorateCard();
      decorateHero();
      decorateManager();
    } finally {
      decorating = false;
      observer?.observe(document.body, { childList: true, subtree: true });
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(decorate, 120);
  }

  const style = document.createElement('style');
  style.textContent = `
    :root{--cf-cyan:#20c8f3;--cf-blue:#177dff;--cf-dark:#02070d;--cf-panel:#092334;--cf-line:rgba(69,205,247,.30)}

    .francos-lite-card{position:relative!important;overflow:hidden!important;border-color:var(--cf-line)!important;background:radial-gradient(circle at 100% 0,rgba(32,200,243,.16),transparent 32%),linear-gradient(155deg,#0a2839,#02070d 68%)!important;box-shadow:0 16px 38px #0007,0 0 24px rgba(32,200,243,.08)!important}
    .francos-lite-card:before{content:"";position:absolute;z-index:5;left:0;top:0;bottom:0;width:4px;background:linear-gradient(#8cecff,var(--cf-cyan),var(--cf-blue))}
    .francos-lite-card .arena-cover{background:radial-gradient(circle at 76% 12%,rgba(32,200,243,.30),transparent 29%),linear-gradient(145deg,#123b51,#02070d)!important}
    .francos-lite-card .arena-symbol{filter:drop-shadow(0 0 14px rgba(32,200,243,.30))!important}
    .francos-lite-card .arena-edition{color:#91eaff!important}.francos-lite-card .arena-open{color:#031018!important;border-color:transparent!important;background:linear-gradient(135deg,#a0f1ff,var(--cf-cyan),var(--cf-blue))!important}

    .francos-lite-detail .francos-lite-hero{min-height:300px!important;border-color:rgba(74,212,250,.40)!important;background:radial-gradient(circle at 83% 12%,rgba(32,200,243,.29),transparent 27%),linear-gradient(145deg,#0b3045,#02070d 72%)!important;box-shadow:0 24px 60px #0008,0 0 34px rgba(32,200,243,.12)!important}
    .francos-lite-detail .francos-lite-hero:before{content:"FRANCOS";position:absolute;right:-15px;bottom:-48px;color:rgba(255,255,255,.045);font:900 150px/1 "Barlow Condensed",sans-serif}
    .francos-lite-detail .arena-hero-copy h2{color:#fff!important;text-shadow:0 5px 24px #000,0 0 22px rgba(32,200,243,.18)}.francos-lite-detail .arena-hero-copy .eyebrow{color:#8eeaff!important}
    .francos-lite-detail .arena-stat{border-color:rgba(65,196,238,.21)!important;background:linear-gradient(150deg,#0a2636,#030a10)!important}.francos-lite-detail .arena-stat b{color:#91eaff!important}

    .francos-lite-manager{--gold:var(--cf-cyan);--gold-soft:#91eaff;--green:#58dfff;--line-strong:rgba(67,204,247,.36)}
    .francos-lite-manager .gi-head{border-color:rgba(69,205,247,.38)!important;background:radial-gradient(circle at 93% 0,rgba(32,200,243,.25),transparent 34%),linear-gradient(145deg,#0b3449,#02070d 72%)!important;box-shadow:0 20px 48px #0007,0 0 28px rgba(32,200,243,.10)!important}
    .francos-lite-manager .gi-head h2{color:#fff!important;text-shadow:0 4px 18px #000}.francos-lite-manager .gi-head p{color:#bdd5df!important}
    .francos-lite-manager .gi-head [data-pro-photo],.francos-lite-manager .gi-head [data-pro-bracket]{position:relative;z-index:4;min-height:38px;padding:0 11px;border-radius:11px;font-size:8px;font-weight:900;white-space:nowrap}
    .francos-lite-manager .gi-head [data-pro-photo]{color:#031018!important;background:linear-gradient(135deg,#a0f1ff,var(--cf-cyan),var(--cf-blue))!important}
    .francos-lite-manager .gi-metrics div{border-color:rgba(64,194,236,.20)!important;background:linear-gradient(150deg,#092535,#030a10)!important}.francos-lite-manager .gi-metrics b{color:#91eaff!important}
    .francos-lite-manager>nav button.active{color:#031018!important;background:linear-gradient(135deg,#a0f1ff,var(--cf-cyan),var(--cf-blue))!important}

    .francos-lite-manager .gi-phase{margin-top:18px;padding:11px;border:1px solid rgba(58,190,235,.20);border-radius:20px;background:linear-gradient(180deg,rgba(9,38,54,.65),rgba(2,8,13,.46))}.francos-lite-manager .gi-phase>div{min-height:40px}.francos-lite-manager .gi-phase h3{color:#f5fcff!important}.francos-lite-manager .gi-phase>div>.pro-phase-photo{margin-left:auto;min-height:32px!important;padding:0 9px!important;border-color:rgba(68,204,246,.29)!important;color:#91eaff!important;background:rgba(32,200,243,.06)!important;font-size:7px!important}
    .francos-lite-manager .francos-lite-game{position:relative;padding-bottom:52px!important;border-color:rgba(60,192,237,.24)!important;background:radial-gradient(circle at 100% 0,rgba(32,200,243,.09),transparent 29%),linear-gradient(155deg,#0a2737,#03090f 72%)!important;box-shadow:0 13px 30px #0005!important}
    .francos-lite-manager .gi-team{min-height:58px!important}.francos-lite-manager .gi-team.winner{color:#9decff!important;background:linear-gradient(90deg,rgba(32,200,243,.16),rgba(32,200,243,.02))!important;box-shadow:inset 3px 0 0 var(--cf-cyan)}.francos-lite-manager .gi-team.winner strong{color:#a9efff!important}
    .francos-lite-manager .gi-badge{border-color:rgba(93,220,255,.38)!important;background:linear-gradient(145deg,#ddfaff,#45d6f6 62%,#187fff)!important}.francos-lite-manager .gi-score,.francos-lite-manager .gi-score-input{color:#a9efff!important;border-color:rgba(69,199,241,.28)!important;background:#01070c!important}
    .francos-lite-photo-tools{position:absolute;left:12px;right:12px;bottom:9px;display:flex;justify-content:flex-end;padding-top:8px;border-top:1px solid rgba(67,172,207,.16)}.francos-lite-photo-tools .pro-game-photo{min-height:31px!important;padding:0 10px!important;border-color:rgba(68,204,246,.28)!important;color:#91eaff!important;background:rgba(32,200,243,.06)!important;font-size:7px!important}

    .francos-lite-manager .gi-bracket-scroll{padding:10px;border:1px solid rgba(61,192,235,.19);border-radius:20px;background:radial-gradient(circle at 100% 0,rgba(32,200,243,.09),transparent 28%),linear-gradient(180deg,#061722,#02070c)}
    .francos-lite-manager .francos-lite-bracket{gap:16px!important}.francos-lite-manager .francos-lite-bracket>section{padding:9px;border:1px solid rgba(59,187,231,.16);border-radius:17px;background:rgba(7,29,41,.45)}.francos-lite-manager .francos-lite-bracket>section>h3{padding:9px;border:1px solid rgba(86,215,253,.26);border-radius:11px;color:#f3fbff!important;background:linear-gradient(135deg,#0c3b55,#061723)!important;text-align:center!important}.francos-lite-manager .francos-lite-bracket>section[data-francos-final="true"]{border-color:rgba(117,230,255,.40);background:radial-gradient(circle at 50% 0,rgba(32,200,243,.17),transparent 36%),rgba(8,35,50,.68);box-shadow:0 0 28px rgba(32,200,243,.10)}
    .francos-lite-manager .francos-lite-bracket article{border-color:rgba(58,186,230,.22)!important;background:linear-gradient(150deg,#092536,#02080d)!important}.francos-lite-manager .francos-lite-bracket article .winner{background:linear-gradient(90deg,rgba(32,200,243,.17),rgba(32,200,243,.02))!important;box-shadow:inset 3px 0 0 var(--cf-cyan)}

    @media(max-width:720px){.francos-lite-detail .francos-lite-hero{min-height:350px!important}.francos-lite-manager .gi-head{display:grid!important}.francos-lite-manager .gi-head>div:last-child{justify-content:flex-start!important}.francos-lite-manager .gi-phase>main{grid-template-columns:1fr!important}.francos-lite-manager .gi-phase{padding:8px}.francos-lite-manager .gi-phase>div{flex-wrap:wrap}.francos-lite-manager .gi-phase>div>.pro-phase-photo{margin-left:0}.francos-lite-manager .francos-lite-game{padding-bottom:50px!important}}
    @media(max-width:440px){.francos-lite-manager .gi-head [data-pro-photo],.francos-lite-manager .gi-head [data-pro-bracket]{flex:1}.francos-lite-detail .arena-hero-copy h2{font-size:44px!important}}
  `;
  document.head.append(style);

  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', schedule);
  window.addEventListener('arena:tournament-logo-updated', schedule);
  schedule();

  window.ArenaBDACopaFrancosDesign = { refresh: schedule };
})();
