(() => {
  'use strict';

  if (window.ArenaBDAHomeActive?.version >= 4) return;

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const HOME_SELECTOR = '[data-page="home"]';
  const SUPER_LEAGUE_ID = 'bda-super-league';

  function loadSuperLeagueStandingsFix() {
    // A classificação da Super League agora pertence ao runtime dedicado.
    // O módulo legado não deve ser carregado em paralelo, pois ambos escrevem
    // no mesmo painel e podem deixar pontos novos em posições antigas.
    return;
  }

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function tournaments() {
    try {
      const value = JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function isActive(item) {
    return normalize(item?.status) === 'em andamento';
  }

  function shieldSource() {
    return document.querySelector('.brand-mark img')?.src || '';
  }

  function ensureStyles() {
    if (document.getElementById('arenaHomeActiveStyles')) return;
    const style = document.createElement('style');
    style.id = 'arenaHomeActiveStyles';
    style.textContent = `
      ${HOME_SELECTOR}{position:relative;isolation:isolate}
      ${HOME_SELECTOR}>*:not(.arena-home-watermark){position:relative;z-index:1}
      .arena-home-watermark{position:absolute;z-index:0;top:84px;right:clamp(-90px,-4vw,-28px);width:clamp(260px,43vw,520px);aspect-ratio:1;object-fit:contain;pointer-events:none;user-select:none;opacity:.065;filter:grayscale(.15) saturate(.75) drop-shadow(0 22px 48px rgba(0,0,0,.25));transform:rotate(-8deg)}
      .arena-active-section{margin:16px 0 8px}
      .arena-active-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 10px}
      .arena-active-heading h2{margin:4px 0 0;font:900 27px/1 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.03em}
      .arena-active-heading p{margin:5px 0 0;color:var(--muted);font-size:10px}
      .arena-active-count{flex:0 0 auto;padding:7px 10px;border:1px solid rgba(79,223,143,.22);border-radius:999px;color:#9af0bb;background:rgba(79,223,143,.08);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .arena-active-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
      .arena-active-card{position:relative;overflow:hidden;min-height:190px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:14px;padding:18px;border:1px solid rgba(79,223,143,.34);border-radius:24px;background:radial-gradient(circle at 90% 10%,rgba(79,223,143,.16),transparent 31%),radial-gradient(circle at 15% 95%,rgba(242,215,125,.12),transparent 32%),linear-gradient(145deg,rgba(19,44,29,.98),rgba(5,13,9,.98));box-shadow:0 20px 54px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.035)}
      .arena-active-card::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0 48%,rgba(255,255,255,.035) 50%,transparent 52%);transform:translateX(-55%);animation:arenaActiveSweep 5.6s ease-in-out infinite}
      .arena-active-card[data-banner="true"]::after{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(90deg,rgba(4,11,7,.96) 0 44%,rgba(4,11,7,.78) 70%,rgba(4,11,7,.58))}
      .arena-active-banner{position:absolute;inset:0;z-index:-1;width:100%;height:100%;object-fit:cover;filter:saturate(.9) contrast(1.05)}
      .arena-active-copy,.arena-active-side{position:relative;z-index:2}
      .arena-active-live{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid rgba(79,223,143,.28);border-radius:999px;color:#98f1b9;background:rgba(79,223,143,.09);font-size:8px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
      .arena-active-live i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(79,223,143,.10),0 0 18px rgba(79,223,143,.32);animation:arenaActivePulse 1.5s ease-in-out infinite}
      .arena-active-card h3{margin:10px 0 6px;font:900 clamp(30px,5vw,46px)/.9 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:-.01em}
      .arena-active-card p{max-width:610px;margin:0;color:#cbd8cf;font-size:10px;line-height:1.5}
      .arena-active-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      .arena-active-meta span{padding:7px 9px;border:1px solid rgba(255,255,255,.085);border-radius:10px;color:#b9c8bf;background:rgba(255,255,255,.035);font-size:8px}
      .arena-active-side{display:grid;justify-items:end;align-content:end;gap:11px;min-width:118px}
      .arena-active-badge{display:grid;place-items:center;width:64px;height:64px;border:1px solid rgba(242,215,125,.25);border-radius:19px;color:var(--gold-soft);background:rgba(242,215,125,.07);font-size:35px;box-shadow:0 12px 28px rgba(0,0,0,.28)}
      .arena-active-card button{min-height:40px;padding:0 13px;white-space:nowrap}
      #arenaHome .arena-home-card[data-active="true"]{border-color:rgba(79,223,143,.30)!important;box-shadow:0 16px 42px rgba(0,0,0,.30),0 0 0 1px rgba(79,223,143,.045)!important}
      @keyframes arenaActivePulse{50%{opacity:.45;transform:scale(.82)}}
      @keyframes arenaActiveSweep{0%,72%,100%{transform:translateX(-60%)}86%{transform:translateX(75%)}}
      @media(max-width:720px){.arena-home-watermark{top:118px;right:-105px;width:330px;opacity:.052}.arena-active-grid{grid-template-columns:1fr}.arena-active-card{min-height:176px;padding:15px;grid-template-columns:minmax(0,1fr) 82px}.arena-active-card h3{font-size:34px}.arena-active-side{min-width:0}.arena-active-badge{width:54px;height:54px;border-radius:16px;font-size:29px}.arena-active-card button{padding:0 10px;font-size:9px}}
      @media(max-width:460px){.arena-active-heading{align-items:start}.arena-active-card{grid-template-columns:1fr}.arena-active-side{grid-auto-flow:column;justify-content:space-between;justify-items:stretch;align-items:center}.arena-active-badge{display:none}.arena-active-card button{width:100%}}
      @media(prefers-reduced-motion:reduce){.arena-active-card::before,.arena-active-live i{animation:none!important}}
    `;
    document.head.append(style);
  }

  function ensureWatermark() {
    const home = document.querySelector(HOME_SELECTOR);
    if (!home) return;
    let image = home.querySelector(':scope > .arena-home-watermark');
    const src = shieldSource();
    if (!src) return;
    if (!image) {
      image = document.createElement('img');
      image.className = 'arena-home-watermark';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      home.prepend(image);
    }
    if (image.src !== src) image.src = src;
  }

  function activeSection() {
    const home = document.querySelector(HOME_SELECTOR);
    const hero = home?.querySelector('.hero');
    if (!home || !hero) return null;
    let section = home.querySelector('#arenaActiveTournaments');
    if (!section) {
      section = document.createElement('section');
      section.id = 'arenaActiveTournaments';
      section.className = 'arena-active-section';
      hero.insertAdjacentElement('afterend', section);
    }
    return section;
  }

  function renderActive() {
    const section = activeSection();
    if (!section) return;
    const active = tournaments().filter(isActive);
    section.hidden = active.length === 0;
    if (!active.length) {
      section.innerHTML = '';
      return;
    }

    section.innerHTML = `
      <div class="arena-active-heading">
        <div><span class="eyebrow">Agora na Arena</span><h2>Competições em andamento</h2><p>Acompanhe primeiro o que está valendo agora.</p></div>
        <span class="arena-active-count">${active.length} ativa${active.length === 1 ? '' : 's'}</span>
      </div>
      <div class="arena-active-grid">
        ${active.map(t => {
          const participants = Array.isArray(t.participants) ? t.participants.length : 0;
          const phase = t.phase || 'Em disputa';
          const format = t.format || 'Formato definido pela organização';
          const banner = t.banner ? `<img class="arena-active-banner" src="${escapeHtml(t.banner)}" alt="">` : '';
          return `<article class="arena-active-card" data-banner="${t.banner ? 'true' : 'false'}">
            ${banner}
            <div class="arena-active-copy">
              <span class="arena-active-live"><i aria-hidden="true"></i> Em andamento</span>
              <h3>${escapeHtml(t.name || 'Campeonato BDA')}</h3>
              <p>${escapeHtml(t.description || 'Competição oficial do Clã BDA.')}</p>
              <div class="arena-active-meta"><span>${escapeHtml(phase)}</span><span>${escapeHtml(format)}</span><span>${participants} participantes</span></div>
            </div>
            <div class="arena-active-side">
              <span class="arena-active-badge" aria-hidden="true">${escapeHtml(t.badge || '🏆')}</span>
              <button class="primary" type="button" data-home-tournament="${escapeHtml(t.id)}">Abrir competição</button>
            </div>
          </article>`;
        }).join('')}
      </div>`;
  }

  function markLegacyCards() {
    const activeIds = new Set(tournaments().filter(isActive).map(item => String(item.id || '')));
    document.querySelectorAll('#arenaHome [data-home-tournament]').forEach(button => {
      const card = button.closest('.arena-home-card');
      if (card) card.dataset.active = activeIds.has(String(button.dataset.homeTournament || '')) ? 'true' : 'false';
    });
  }

  function repairSuperLeagueStandingsOrder() {
    const runtime = window.ArenaBDASuperLeagueRuntimeFix;
    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    const panel = manager?.querySelector('#autoStandings');
    if (!runtime?.calculate || !panel || panel.hidden) return;

    const data = runtime.calculate();
    if (!Array.isArray(data)) return;
    const limit = Math.max(1, Number(runtime.qualifiers?.() || 3));

    data.forEach(group => {
      const section = [...panel.querySelectorAll('.stand-group')]
        .find(node => normalize(node.querySelector('h3')?.textContent) === normalize(group.name));
      const tbody = section?.querySelector('tbody');
      if (!tbody) return;

      const rowByTeam = new Map(
        [...tbody.querySelectorAll('tr')]
          .map(row => [normalize(row.querySelector('.stand-club b')?.textContent), row])
          .filter(([name]) => Boolean(name))
      );

      group.rows.forEach((entry, index) => {
        const row = rowByTeam.get(normalize(entry.name));
        if (!row) return;
        const current = tbody.children[index];
        if (current !== row) tbody.insertBefore(row, current || null);
        const position = row.querySelector('.stand-pos');
        if (position && position.textContent !== String(index + 1)) position.textContent = String(index + 1);
        row.classList.toggle('qualified', index < limit);
      });
    });
  }

  function openTournamentDirectly(tournamentId) {
    const id = String(tournamentId || '').trim();
    if (!id) return;

    const activate = () => {
      const button = [...document.querySelectorAll('[data-open-tournament]')]
        .find(node => String(node.dataset.openTournament || '') === id);
      if (!button) return false;

      button.click();
      requestAnimationFrame(() => {
        const detail = document.getElementById('arenaDetail');
        if (detail) detail.scrollIntoView({ block:'start', behavior:'smooth' });
      });
      return true;
    };

    window.navigate?.('tournament');

    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (activate() || attempts >= 15) return;
      setTimeout(retry, 70);
    };
    requestAnimationFrame(retry);
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-home-tournament]')
      : null;
    if (!target) return;

    const id = target.dataset.homeTournament;
    if (!id) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openTournamentDirectly(id);
  }, true);

  let frame = 0;
  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureStyles();
      ensureWatermark();
      renderActive();
      markLegacyCards();
      repairSuperLeagueStandingsOrder();
    });
  }

  ['arena:tournaments-updated','arena:bundle-loaded','arena:cloud-ready','arena:quick-score-saved','arena:matches-updated']
    .forEach(type => window.addEventListener(type, refresh));
  window.addEventListener('storage', event => {
    if (event.key === TOURNAMENT_KEY || event.key === 'bda-v3-confrontos') refresh();
  });

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  loadSuperLeagueStandingsFix();
  window.ArenaBDAHomeActive = Object.freeze({
    version: 4,
    refresh,
    openTournamentDirectly,
    repairSuperLeagueStandingsOrder
  });
  refresh();
})();
