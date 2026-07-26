(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const isFrancos = value => norm(value).includes('francos');

  let scheduled = false;

  function tournaments() {
    try {
      const value = JSON.parse(localStorage.getItem(TOURNAMENT_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function francosTournament() {
    return tournaments().find(item => item?.id === 'copa-francos' || isFrancos(item?.name)) || null;
  }

  function logoUrl() {
    return window.ArenaBDALeagueLogo?.get?.('Copa Francos')?.logo
      || francosTournament()?.logo
      || '';
  }

  function activeFrancos() {
    const manager = $('#giManager');
    const managerName = $('.gi-head h2', manager)?.textContent || '';
    const detailName = $('#arenaDetail .arena-hero-copy h2')?.textContent || '';
    return manager?.dataset.tid === 'copa-francos' || isFrancos(managerName) || isFrancos(detailName);
  }

  function decorateTournamentCard() {
    $$('.arena-card').forEach(card => {
      const name = $('.arena-body h3', card)?.textContent || '';
      const francos = isFrancos(name);
      card.classList.toggle('francos-tournament-card', francos);
      if (!francos) return;

      const cover = $('.arena-cover', card);
      if (cover && !$('.francos-card-wordmark', cover)) {
        const wordmark = document.createElement('div');
        wordmark.className = 'francos-card-wordmark';
        wordmark.innerHTML = '<span>COPA</span><b>FRANCOS</b><small>Competição especial BDA</small>';
        cover.append(wordmark);
      }

      const openButton = $('.arena-open', card);
      if (openButton) openButton.textContent = 'Abrir Copa Francos';
    });
  }

  function enhanceHero() {
    const detail = $('#arenaDetail');
    const hero = $('.arena-hero', detail);
    const title = $('.arena-hero-copy h2', hero)?.textContent || '';
    const active = Boolean(hero && isFrancos(title));
    detail?.classList.toggle('copa-francos-detail', active);
    if (!active) return;

    hero.classList.add('francos-hero-premium');

    if (!$('.francos-hero-kicker', hero)) {
      const kicker = document.createElement('div');
      kicker.className = 'francos-hero-kicker';
      kicker.innerHTML = '<span>EVENTO OFICIAL</span><b>COPA FRANCOS</b>';
      hero.append(kicker);
    }

    let seal = $('.arena-detail-league-logo', hero) || $('.francos-hero-logo', hero);
    if (!seal) {
      seal = document.createElement('span');
      seal.className = 'francos-hero-logo';
      hero.append(seal);
    }
    const logo = logoUrl();
    if (logo && !seal.querySelector('img')) {
      seal.innerHTML = `<img src="${String(logo).replace(/"/g, '&quot;')}" alt="Logo da Copa Francos">`;
    } else if (!logo && !seal.textContent.trim()) {
      seal.textContent = 'CF';
    }
  }

  function statusKind(text) {
    const value = norm(text);
    if (value.includes('finaliz') || value.includes('encerr')) return 'finished';
    if (value.includes('andamento') || value.includes('ao vivo')) return 'live';
    if (value.includes('adiad') || value.includes('cancel')) return 'alert';
    return 'scheduled';
  }

  function phaseKind(text) {
    const value = norm(text);
    if (value.includes('prelim')) return 'preliminary';
    if (value === 'final' || value.includes('grande final')) return 'final';
    if (value.includes('semi')) return 'semifinal';
    if (value.includes('quart')) return 'quarterfinal';
    if (value.includes('oitav')) return 'round16';
    return 'regular';
  }

  function enhanceGames(manager) {
    $$('.gi-phase', manager).forEach((phase, phaseIndex) => {
      const title = $('h3', phase)?.textContent || '';
      const kind = phaseKind(title);
      phase.dataset.francosPhase = kind;
      phase.style.setProperty('--francos-phase-index', String(phaseIndex + 1));

      const phaseHeader = phase.firstElementChild;
      if (phaseHeader && !$('.francos-phase-emblem', phaseHeader)) {
        const emblem = document.createElement('span');
        emblem.className = 'francos-phase-emblem';
        emblem.textContent = kind === 'preliminary' ? 'P' : kind === 'final' ? 'F' : String(phaseIndex + 1);
        phaseHeader.prepend(emblem);
      }

      $$('.gi-game', phase).forEach((game, gameIndex) => {
        game.classList.add('francos-game-card');
        game.style.setProperty('--francos-game-index', String(gameIndex + 1));

        const status = $('header span', game);
        if (status) status.dataset.francosStatus = statusKind(status.textContent);

        if (!$('.francos-game-number', game)) {
          const number = document.createElement('span');
          number.className = 'francos-game-number';
          number.textContent = `JOGO ${String(gameIndex + 1).padStart(2, '0')}`;
          game.append(number);
        }

        const teams = $$('.gi-team', game);
        if (teams.length >= 2 && !$('.francos-versus', game)) {
          const versus = document.createElement('div');
          versus.className = 'francos-versus';
          versus.innerHTML = '<span>VS</span>';
          teams[0].insertAdjacentElement('afterend', versus);
        }
      });
    });
  }

  function championBanner(bracket, finalSection) {
    const winner = $('.winner', finalSection);
    const name = $('span', winner)?.textContent?.trim();
    if (!name) {
      $('.francos-champion-banner', bracket.parentElement)?.remove();
      return;
    }

    let banner = $('.francos-champion-banner', bracket.parentElement);
    if (!banner) {
      banner = document.createElement('section');
      banner.className = 'francos-champion-banner';
      bracket.parentElement.insertBefore(banner, bracket.parentElement.firstChild);
    }

    const badge = $('.gi-badge', winner)?.innerHTML || '🏆';
    banner.innerHTML = `<div class="francos-champion-crown">🏆</div><span class="francos-champion-badge">${badge}</span><div><small>CAMPEÃO DA COPA FRANCOS</small><h2>${name.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character]))}</h2><p>Nome gravado na história da competição.</p></div>`;
  }

  function enhanceBracket(manager) {
    const bracket = $('.gi-bracket', manager);
    if (!bracket) return;
    bracket.classList.add('francos-bracket-pro');

    const sections = $$(':scope > section', bracket);
    let finalSection = null;
    sections.forEach((section, index) => {
      const title = $('h3', section)?.textContent || '';
      const kind = phaseKind(title);
      section.dataset.francosRound = kind;
      section.style.setProperty('--francos-round-index', String(index + 1));
      if (kind === 'final') finalSection = section;

      $$(':scope > article', section).forEach((match, matchIndex) => {
        match.classList.add('francos-bracket-match');
        match.style.setProperty('--francos-match-index', String(matchIndex + 1));
        if (!$('.francos-bracket-label', match)) {
          const label = document.createElement('span');
          label.className = 'francos-bracket-label';
          label.textContent = `C${matchIndex + 1}`;
          match.append(label);
        }
      });
    });

    if (finalSection) championBanner(bracket, finalSection);
  }

  function enhanceManager() {
    const manager = $('#giManager');
    const active = activeFrancos();
    manager?.classList.toggle('copa-francos-manager', active);
    if (!manager || !active) return;

    const head = $('.gi-head', manager);
    if (head && !$('.francos-manager-mark', head)) {
      const mark = document.createElement('div');
      mark.className = 'francos-manager-mark';
      const logo = logoUrl();
      mark.innerHTML = logo
        ? `<img src="${String(logo).replace(/"/g, '&quot;')}" alt="Logo Copa Francos"><span><small>Central oficial</small><b>COPA FRANCOS</b></span>`
        : '<strong>CF</strong><span><small>Central oficial</small><b>COPA FRANCOS</b></span>';
      head.prepend(mark);
    }

    enhanceGames(manager);
    enhanceBracket(manager);
  }

  function run() {
    scheduled = false;
    decorateTournamentCard();
    enhanceHero();
    enhanceManager();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  const style = document.createElement('style');
  style.textContent = `
    :root{--francos-cyan:#16c8f4;--francos-blue:#1681ff;--francos-blue-deep:#082b62;--francos-ink:#02050a;--francos-panel:#071522;--francos-panel-2:#0b2435;--francos-white:#f5fbff;--francos-silver:#a9c2d1;--francos-line:rgba(53,193,255,.32);--francos-glow:rgba(22,200,244,.25)}

    .francos-tournament-card{position:relative!important;overflow:hidden!important;border-color:var(--francos-line)!important;background:linear-gradient(160deg,#0b2131,#03080e 62%,#010204)!important;box-shadow:0 18px 45px #0008,0 0 28px rgba(22,200,244,.08)!important}
    .francos-tournament-card:before{content:"";position:absolute;z-index:5;inset:0 auto 0 0;width:4px;background:linear-gradient(180deg,#79eaff,var(--francos-cyan),#176cff)}
    .francos-tournament-card .arena-cover{height:138px!important;background:radial-gradient(circle at 76% 12%,rgba(22,200,244,.30),transparent 28%),linear-gradient(145deg,#103851,#02060b)!important}
    .francos-tournament-card .arena-cover:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 0 47%,rgba(255,255,255,.055) 48%,transparent 49% 100%);background-size:125px 125px}
    .francos-tournament-card .arena-cover:after{height:76%!important;background:linear-gradient(transparent,rgba(1,5,9,.97))!important}
    .francos-card-wordmark{position:absolute;z-index:3;left:14px;bottom:12px;display:grid;line-height:.84;text-shadow:0 5px 18px #000}.francos-card-wordmark span{color:#9cecff;font:800 9px/1 Inter,sans-serif;letter-spacing:.38em}.francos-card-wordmark b{color:#fff;font:900 31px/.9 "Barlow Condensed",sans-serif;letter-spacing:.035em}.francos-card-wordmark small{margin-top:6px;color:#a6becd;font-size:7px;letter-spacing:.12em;text-transform:uppercase}
    .francos-tournament-card .arena-symbol{display:none}.francos-tournament-card .arena-status{border-color:rgba(71,210,255,.42)!important;color:#b9f2ff!important;background:#03101bd9!important}.francos-tournament-card .arena-edition{color:#82e7ff!important}.francos-tournament-card .arena-body h3{color:#f7fcff}.francos-tournament-card .arena-open{border-color:rgba(56,205,255,.44)!important;color:#07131d!important;background:linear-gradient(135deg,#94efff,#16c8f4 58%,#1681ff)!important;box-shadow:0 9px 24px rgba(22,200,244,.18)!important}

    .copa-francos-detail .francos-hero-premium{min-height:310px!important;border-color:rgba(72,210,255,.43)!important;background:radial-gradient(circle at 81% 14%,rgba(22,200,244,.32),transparent 25%),radial-gradient(circle at 10% 90%,rgba(22,129,255,.17),transparent 30%),linear-gradient(145deg,#0b2d42,#02060b 70%)!important;box-shadow:0 28px 70px #0009,0 0 45px rgba(22,200,244,.14)!important}
    .copa-francos-detail .francos-hero-premium:before{content:"FRANCOS";position:absolute;right:-18px;bottom:-50px;z-index:1;color:rgba(255,255,255,.045);font:900 170px/1 "Barlow Condensed",sans-serif;letter-spacing:-.04em}
    .copa-francos-detail .francos-hero-premium:after{z-index:1;background:linear-gradient(180deg,rgba(1,4,8,.10),rgba(1,4,8,.97))!important}
    .copa-francos-detail .arena-hero-copy{max-width:720px}.copa-francos-detail .arena-hero-copy .eyebrow{color:#8ceaff!important}.copa-francos-detail .arena-hero-copy h2{color:#fff;font-size:clamp(46px,9vw,78px)!important;text-shadow:0 5px 28px #000,0 0 26px rgba(22,200,244,.20)}.copa-francos-detail .arena-hero-copy p{max-width:630px;color:#c8dce7!important}
    .francos-hero-kicker{position:absolute;right:24px;bottom:24px;z-index:3;display:grid;justify-items:end;pointer-events:none}.francos-hero-kicker span{color:#75e7ff;font-size:8px;font-weight:900;letter-spacing:.28em}.francos-hero-kicker b{margin-top:4px;color:#fff;font:900 25px "Barlow Condensed",sans-serif;letter-spacing:.05em;text-shadow:0 5px 18px #000}
    .copa-francos-detail .arena-detail-league-logo,.francos-hero-logo{position:absolute;z-index:4;right:24px;top:22px;display:grid;place-items:center;width:105px;height:105px;border:2px solid rgba(112,231,255,.52);border-radius:50%;color:#fff;background:rgba(2,9,15,.80);box-shadow:0 18px 45px #0009,0 0 32px rgba(22,200,244,.22);font:900 27px "Barlow Condensed",sans-serif;backdrop-filter:blur(10px)}.copa-francos-detail .arena-detail-league-logo img,.francos-hero-logo img{max-width:88px!important;max-height:88px!important;object-fit:contain!important}
    .copa-francos-detail .arena-stat{border-color:rgba(45,188,241,.22)!important;background:linear-gradient(150deg,#0b2636,#030a10)!important}.copa-francos-detail .arena-stat b{color:#8feaff!important}.copa-francos-detail .arena-club{border-color:rgba(45,188,241,.24)!important;background:rgba(17,104,145,.10)!important}

    .copa-francos-manager{--gold:#16c8f4;--gold-soft:#8feaff;--green:#42dcff;--line-strong:rgba(46,203,255,.38);position:relative}
    .copa-francos-manager .gi-head{position:relative;overflow:hidden;min-height:150px;padding:22px!important;border:1px solid rgba(67,211,255,.42)!important;background:radial-gradient(circle at 92% 0,rgba(22,200,244,.31),transparent 35%),linear-gradient(145deg,#0b344b,#02070d 72%)!important;box-shadow:0 24px 60px #0008,0 0 38px rgba(22,200,244,.12)!important}
    .copa-francos-manager .gi-head:before{content:"CF";position:absolute;right:14px;bottom:-65px;color:rgba(255,255,255,.055);font:900 190px/1 "Barlow Condensed",sans-serif}.copa-francos-manager .gi-head>div:not(.francos-manager-mark){position:relative;z-index:2}.copa-francos-manager .gi-head h2{color:#fff!important;font-size:clamp(38px,7vw,58px)!important;text-shadow:0 4px 20px #000}.copa-francos-manager .gi-head p{color:#bfd5e0!important}
    .francos-manager-mark{position:relative;z-index:3;display:flex;align-items:center;gap:10px;align-self:flex-start;min-width:190px;padding:9px 12px;border:1px solid rgba(109,225,255,.35);border-radius:16px;background:rgba(1,8,14,.64);box-shadow:0 12px 28px #0005;backdrop-filter:blur(8px)}.francos-manager-mark img,.francos-manager-mark>strong{display:grid;place-items:center;width:52px;height:52px;object-fit:contain;border:1px solid rgba(113,232,255,.42);border-radius:50%;background:#02090f;color:#fff;font:900 18px "Barlow Condensed",sans-serif}.francos-manager-mark span small,.francos-manager-mark span b{display:block}.francos-manager-mark span small{color:#7ce8ff;font-size:7px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.francos-manager-mark span b{margin-top:3px;color:#fff;font:900 17px "Barlow Condensed",sans-serif;letter-spacing:.04em}
    .copa-francos-manager .gi-metrics div{border-color:rgba(50,192,240,.20)!important;background:linear-gradient(150deg,#0a2636,#030a10)!important}.copa-francos-manager .gi-metrics b{color:#8feaff!important}.copa-francos-manager>nav{border-color:rgba(51,199,247,.23)!important;background:#02080dd9!important}.copa-francos-manager>nav button.active{color:#031018!important;background:linear-gradient(135deg,#a0f1ff,#16c8f4 58%,#1681ff)!important;box-shadow:0 7px 18px rgba(22,200,244,.20)}

    .copa-francos-manager .gi-phase{position:relative;margin-top:22px;padding:12px;border:1px solid rgba(47,187,235,.18);border-radius:22px;background:linear-gradient(180deg,rgba(10,39,55,.62),rgba(2,8,13,.45))}.copa-francos-manager .gi-phase>div{min-height:44px;margin-bottom:11px!important}.copa-francos-manager .gi-phase h3{color:#f5fbff!important;font-size:26px!important;text-shadow:0 0 20px rgba(22,200,244,.16)}.copa-francos-manager .gi-phase>div>span:not(.francos-phase-emblem){color:#8da9b7!important}.francos-phase-emblem{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border:1px solid rgba(91,220,255,.37);border-radius:12px;color:#031018!important;background:linear-gradient(145deg,#9ef1ff,#17c9f4 58%,#1681ff);font:900 16px "Barlow Condensed",sans-serif;box-shadow:0 8px 22px rgba(22,200,244,.20)}
    .copa-francos-manager .gi-phase[data-francos-phase="preliminary"]{border:2px solid rgba(103,226,255,.48);background:radial-gradient(circle at 50% 0,rgba(22,200,244,.17),transparent 32%),linear-gradient(180deg,#0b3448,#02090f);box-shadow:0 0 0 5px rgba(22,200,244,.045),0 0 35px rgba(22,200,244,.12)}.copa-francos-manager .gi-phase[data-francos-phase="preliminary"] h3:after{content:"FASE DE ENTRADA";display:inline-block;margin-left:9px;padding:5px 7px;border:1px solid rgba(111,229,255,.30);border-radius:999px;color:#85eaff;font:800 7px Inter,sans-serif;letter-spacing:.10em;vertical-align:middle}.copa-francos-manager .gi-phase[data-francos-phase="final"]{border-color:rgba(151,238,255,.45);background:radial-gradient(circle at 50% 0,rgba(22,200,244,.21),transparent 34%),linear-gradient(180deg,#10435d,#02080d);box-shadow:0 0 42px rgba(22,200,244,.15)}

    .copa-francos-manager .gi-phase>main{gap:12px!important}.copa-francos-manager .francos-game-card{position:relative;overflow:hidden;padding:14px!important;border:1px solid rgba(64,195,239,.25)!important;border-radius:20px!important;background:radial-gradient(circle at 100% 0,rgba(22,200,244,.10),transparent 29%),linear-gradient(155deg,#0b2737,#03090f 72%)!important;box-shadow:0 14px 34px #0005,inset 0 1px 0 rgba(255,255,255,.03);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.copa-francos-manager .francos-game-card:hover{transform:translateY(-3px);border-color:rgba(91,220,255,.48)!important;box-shadow:0 20px 44px #0007,0 0 24px rgba(22,200,244,.12)}.copa-francos-manager .francos-game-card:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,#16c8f4,#1681ff,transparent);opacity:.65}
    .francos-game-number{position:absolute;right:11px;bottom:8px;color:rgba(162,222,239,.22);font:900 10px "Barlow Condensed",sans-serif;letter-spacing:.11em;pointer-events:none}.copa-francos-manager .gi-game header{margin-bottom:8px!important}.copa-francos-manager .gi-game header span{border:1px solid rgba(76,201,241,.22);color:#9feeff!important;background:rgba(22,200,244,.08)!important}.copa-francos-manager .gi-game header span[data-francos-status="finished"]{color:#87f2c0!important;border-color:rgba(70,226,151,.25);background:rgba(43,196,124,.09)!important}.copa-francos-manager .gi-game header span[data-francos-status="live"]{color:#fff!important;border-color:rgba(66,206,255,.55);background:#0879a7!important;box-shadow:0 0 18px rgba(22,200,244,.24)}.copa-francos-manager .gi-game header span[data-francos-status="alert"]{color:#ffb5bf!important;border-color:rgba(255,105,120,.30);background:rgba(255,105,120,.09)!important}.copa-francos-manager .gi-game header small{color:#91aab7!important}
    .copa-francos-manager .gi-team{grid-template-columns:46px minmax(0,1fr) auto!important;min-height:65px!important;padding:8px 9px!important;border-top-color:rgba(86,171,202,.16)!important}.copa-francos-manager .gi-team strong{color:#edfaff!important;font-size:13px!important}.copa-francos-manager .gi-team small{color:#8ea7b4!important}.copa-francos-manager .gi-team.winner{color:#a4efff!important;background:linear-gradient(90deg,rgba(22,200,244,.17),rgba(22,200,244,.025))!important;box-shadow:inset 3px 0 0 #16c8f4}.copa-francos-manager .gi-team.winner strong{color:#a7efff!important;text-shadow:0 0 16px rgba(22,200,244,.18)}
    .copa-francos-manager .gi-badge{width:44px!important;height:44px!important;border:2px solid rgba(105,226,255,.38)!important;background:linear-gradient(145deg,#dffaff,#43d8f7 62%,#187fff)!important;box-shadow:0 8px 20px #0006,0 0 17px rgba(22,200,244,.12)}.copa-francos-manager .gi-badge.small{width:31px!important;height:31px!important}.copa-francos-manager .gi-score,.copa-francos-manager .gi-score-input{min-width:48px!important;height:45px!important;border:1px solid rgba(75,202,245,.28)!important;border-radius:12px!important;color:#b8f4ff!important;background:#01070c!important;font:900 24px "Barlow Condensed",sans-serif!important;box-shadow:inset 0 0 18px rgba(22,200,244,.07)}
    .francos-versus{display:grid;place-items:center;height:0;position:relative;z-index:2}.francos-versus span{display:grid;place-items:center;width:27px;height:27px;border:1px solid rgba(83,214,255,.35);border-radius:50%;color:#9eefff;background:#04111a;box-shadow:0 6px 16px #0008;font:900 8px Inter,sans-serif;letter-spacing:.08em}.copa-francos-manager .gi-agg{border-color:rgba(54,193,239,.25)!important;background:rgba(22,200,244,.055)!important}.copa-francos-manager .gi-agg b{color:#a4efff!important}

    .copa-francos-manager .gi-bracket-scroll{padding:11px;border:1px solid rgba(53,193,241,.18);border-radius:22px;background:radial-gradient(circle at 100% 0,rgba(22,200,244,.10),transparent 27%),linear-gradient(180deg,#061722,#02070c)}.copa-francos-manager .francos-bracket-pro{gap:18px!important;padding:8px!important}.copa-francos-manager .francos-bracket-pro>section{position:relative;min-width:220px!important;padding:10px;border:1px solid rgba(55,188,232,.17);border-radius:18px;background:rgba(7,29,41,.42)}.copa-francos-manager .francos-bracket-pro>section>h3{position:sticky;top:0;z-index:3;margin:0 0 12px!important;padding:10px;border:1px solid rgba(87,216,255,.26);border-radius:12px;color:#f2fbff!important;background:linear-gradient(135deg,#0c3b55,#061723)!important;text-align:center;text-transform:uppercase;letter-spacing:.08em;box-shadow:0 8px 20px #0005}.copa-francos-manager .francos-bracket-pro>section[data-francos-round="preliminary"]>h3{color:#b8f4ff!important;border-color:rgba(114,231,255,.43)}.copa-francos-manager .francos-bracket-pro>section[data-francos-round="final"]{border-color:rgba(122,231,255,.40);background:radial-gradient(circle at 50% 0,rgba(22,200,244,.17),transparent 35%),rgba(8,35,50,.66);box-shadow:0 0 32px rgba(22,200,244,.11)}.copa-francos-manager .francos-bracket-pro>section[data-francos-round="final"]>h3{background:linear-gradient(135deg,#1388b4,#0a3f61)!important;box-shadow:0 0 24px rgba(22,200,244,.18)}
    .copa-francos-manager .francos-bracket-match{position:relative!important;overflow:visible!important;margin-bottom:12px!important;border:1px solid rgba(57,183,226,.23)!important;border-radius:16px!important;background:linear-gradient(150deg,#0a2737,#02080d)!important;box-shadow:0 12px 28px #0005!important}.copa-francos-manager .francos-bracket-match:after{content:"";position:absolute;right:-19px;top:50%;width:18px;height:2px;background:linear-gradient(90deg,#16c8f4,transparent);opacity:.44}.copa-francos-manager .francos-bracket-pro>section:last-child .francos-bracket-match:after{display:none}.copa-francos-manager .francos-bracket-match>div{min-height:44px!important;padding:7px!important;border-bottom-color:rgba(68,160,193,.15)!important}.copa-francos-manager .francos-bracket-match>div span{color:#dff7ff!important;font-size:10px!important}.copa-francos-manager .francos-bracket-match>div b{color:#93ebff!important;font-size:15px!important}.copa-francos-manager .francos-bracket-match>div.winner{background:linear-gradient(90deg,rgba(22,200,244,.18),rgba(22,200,244,.025))!important;box-shadow:inset 3px 0 0 #16c8f4}.copa-francos-manager .francos-bracket-match>small{color:#7fa1b0!important}.francos-bracket-label{position:absolute;right:8px;top:-7px;padding:3px 6px;border:1px solid rgba(83,214,255,.28);border-radius:999px;color:#7ce8ff;background:#031018;font-size:6px;font-weight:900;letter-spacing:.10em}
    .francos-champion-banner{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:15px;margin-bottom:14px;padding:18px;border:1px solid rgba(119,232,255,.45);border-radius:22px;background:radial-gradient(circle at 100% 0,rgba(22,200,244,.22),transparent 35%),linear-gradient(145deg,#0d4159,#02080e);box-shadow:0 18px 48px #0007,0 0 35px rgba(22,200,244,.12)}.francos-champion-crown{font-size:34px;filter:drop-shadow(0 8px 15px #0008)}.francos-champion-badge{overflow:hidden;display:grid;place-items:center;width:70px;height:70px;border:2px solid rgba(114,231,255,.48);border-radius:50%;background:#031018;box-shadow:0 12px 28px #0007}.francos-champion-badge .gi-badge{width:100%!important;height:100%!important}.francos-champion-banner small{color:#7ce8ff;font-size:7px;font-weight:900;letter-spacing:.17em}.francos-champion-banner h2{margin:4px 0 2px;color:#fff;font-size:31px;text-transform:uppercase}.francos-champion-banner p{margin:0;color:#a9c2d1;font-size:9px}

    @media(max-width:760px){.francos-tournament-card .arena-cover{height:126px!important}.copa-francos-detail .francos-hero-premium{min-height:370px!important}.francos-hero-kicker{display:none}.copa-francos-detail .arena-detail-league-logo,.francos-hero-logo{right:14px;top:14px;width:78px;height:78px}.copa-francos-detail .arena-detail-league-logo img,.francos-hero-logo img{max-width:66px!important;max-height:66px!important}.copa-francos-manager .gi-head{display:grid!important}.francos-manager-mark{min-width:0;width:max-content}.copa-francos-manager .gi-phase>main{grid-template-columns:1fr!important}.copa-francos-manager .gi-phase{padding:9px}.copa-francos-manager .gi-phase h3{font-size:22px!important}.copa-francos-manager .gi-team strong{font-size:12px!important}.francos-champion-banner{grid-template-columns:auto 1fr}.francos-champion-crown{display:none}.francos-champion-banner h2{font-size:24px}}
    @media(max-width:440px){.copa-francos-detail .arena-hero-copy h2{font-size:46px!important}.copa-francos-manager .gi-head{padding:15px!important}.francos-manager-mark img,.francos-manager-mark>strong{width:44px;height:44px}.copa-francos-manager .gi-team{grid-template-columns:41px minmax(0,1fr) auto!important}.copa-francos-manager .gi-badge{width:39px!important;height:39px!important}.copa-francos-manager .gi-score,.copa-francos-manager .gi-score-input{min-width:43px!important;height:42px!important}.francos-champion-badge{width:58px;height:58px}}
    @media(prefers-reduced-motion:reduce){.copa-francos-manager .francos-game-card{transition:none!important}}
  `;
  document.head.append(style);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('arena:tournament-logo-updated', schedule);
  window.addEventListener('storage', schedule);
  schedule();

  window.ArenaBDACopaFrancosDesign = { refresh: schedule };
})();
