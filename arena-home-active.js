(() => {
  'use strict';

  if (window.ArenaBDAHomeActive?.version >= 5) return;

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const HOME_SELECTOR = '[data-page="home"]';
  const SUPER_LEAGUE_ID = 'bda-super-league';

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

  function ensureStyles() {
    let style = document.getElementById('arenaHomeActiveStyles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'arenaHomeActiveStyles';
      document.head.append(style);
    }
    style.textContent = `
      ${HOME_SELECTOR}{position:relative}
      ${HOME_SELECTOR} .home-tournaments{display:none!important}
      ${HOME_SELECTOR} .arena-home-watermark{display:none!important}
      .arena-active-section{margin:14px 0 8px}
      .arena-active-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 9px}
      .arena-active-heading>div{min-width:0}
      .arena-active-heading h2{margin:3px 0 0;font:900 23px/1 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.02em}
      .arena-active-heading p{margin:4px 0 0;color:var(--muted);font-size:9px}
      .arena-active-heading-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
      .arena-active-count{padding:6px 8px;border:1px solid rgba(79,223,143,.2);border-radius:999px;color:#9af0bb;background:rgba(79,223,143,.07);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
      .arena-active-all{min-height:32px;padding:0 9px;border:1px solid var(--line);border-radius:9px;color:var(--gold-soft);background:rgba(255,255,255,.025);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      .arena-active-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .arena-active-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;min-height:92px;padding:11px 12px;border:1px solid rgba(79,223,143,.22);border-radius:15px;background:linear-gradient(145deg,rgba(14,30,20,.96),rgba(5,13,9,.98));box-shadow:0 10px 25px rgba(0,0,0,.2)}
      .arena-active-icon{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(242,215,125,.18);border-radius:12px;color:var(--gold-soft);background:rgba(242,215,125,.055);font-size:23px}
      .arena-active-copy{min-width:0}
      .arena-active-live{display:inline-flex;align-items:center;gap:5px;color:#8feeb4;font-size:7px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .arena-active-live i{width:6px;height:6px;border-radius:50%;background:var(--green)}
      .arena-active-card h3{margin:5px 0 3px;overflow:hidden;text-overflow:ellipsis;font:900 20px/1 "Barlow Condensed",sans-serif;text-transform:uppercase;white-space:nowrap}
      .arena-active-meta{display:flex;gap:6px;overflow:hidden;color:var(--muted);font-size:8px;white-space:nowrap}
      .arena-active-meta span{overflow:hidden;text-overflow:ellipsis}
      .arena-active-meta span+span::before{content:"•";margin-right:6px;color:#587062}
      .arena-active-open{min-height:34px;padding:0 10px;border-radius:9px;white-space:nowrap;font-size:8px}
      @media(max-width:720px){
        .arena-active-grid{grid-template-columns:1fr}
        .arena-active-heading p{display:none}
      }
      @media(max-width:430px){
        .arena-active-heading{align-items:flex-end}
        .arena-active-heading h2{font-size:21px}
        .arena-active-count{display:none}
        .arena-active-card{grid-template-columns:38px minmax(0,1fr) auto;gap:9px;min-height:82px;padding:10px}
        .arena-active-icon{width:38px;height:38px;border-radius:10px;font-size:20px}
        .arena-active-card h3{font-size:19px}
        .arena-active-meta span:nth-child(n+3){display:none}
        .arena-active-open{min-height:32px;padding:0 8px}
      }
    `;
  }

  function simplifyLegacyHome() {
    const home = document.querySelector(HOME_SELECTOR);
    if (!home) return;

    home.querySelectorAll('.home-tournaments').forEach(section => section.remove());
    home.querySelectorAll('.arena-home-watermark').forEach(node => node.remove());

    const legacyRoot = home.querySelector('#arenaHome');
    const legacySection = legacyRoot?.closest('section');
    if (legacySection && legacySection.id !== 'arenaActiveTournaments') legacySection.remove();
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
      section.replaceChildren();
      return;
    }

    const signature = JSON.stringify(active.map(item => [item.id, item.name, item.phase, item.format, item.status, Array.isArray(item.participants) ? item.participants.length : 0, item.badge]));
    if (section.dataset.signature === signature) return;
    section.dataset.signature = signature;

    section.innerHTML = `
      <div class="arena-active-heading">
        <div>
          <span class="eyebrow">Agora na Arena</span>
          <h2>Em andamento</h2>
          <p>Somente as competições que estão valendo agora.</p>
        </div>
        <div class="arena-active-heading-actions">
          <span class="arena-active-count">${active.length} ativa${active.length === 1 ? '' : 's'}</span>
          <button class="arena-active-all" type="button" data-go="tournament">Ver todas</button>
        </div>
      </div>
      <div class="arena-active-grid">
        ${active.map(t => {
          const participants = Array.isArray(t.participants) ? t.participants.length : 0;
          const phase = t.phase || 'Em disputa';
          const format = t.format || 'Competição';
          return `<article class="arena-active-card">
            <span class="arena-active-icon" aria-hidden="true">${escapeHtml(t.badge || '🏆')}</span>
            <div class="arena-active-copy">
              <span class="arena-active-live"><i aria-hidden="true"></i> Em andamento</span>
              <h3>${escapeHtml(t.name || 'Campeonato BDA')}</h3>
              <div class="arena-active-meta"><span>${escapeHtml(phase)}</span><span>${escapeHtml(format)}</span><span>${participants} clubes</span></div>
            </div>
            <button class="primary arena-active-open" type="button" data-home-tournament="${escapeHtml(t.id)}">Abrir</button>
          </article>`;
        }).join('')}
      </div>`;
  }

  function repairSuperLeagueStandingsOrder() {
    const runtime = window.ArenaBDASuperLeagueRuntimeFix;
    const manager = document.querySelector(`#giManager[data-tid="${SUPER_LEAGUE_ID}"]`);
    const panel = manager?.querySelector('#autoStandings');
    if (!runtime?.calculate || !panel || panel.hidden) return;

    const data = runtime.calculate();
    if (!Array.isArray(data)) return;
    const limit = Math.max(1, Number(runtime.qualifiers?.() || 2));

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
      simplifyLegacyHome();
      renderActive();
      repairSuperLeagueStandingsOrder();
    });
  }

  [
    'arena:tournaments-updated',
    'arena:cloud-data-applied',
    'arena:bundle-loaded',
    'arena:cloud-ready',
    'arena:quick-score-saved',
    'arena:matches-updated'
  ].forEach(type => window.addEventListener(type, refresh));

  window.addEventListener('storage', event => {
    if (event.key === TOURNAMENT_KEY || event.key === 'bda-v3-confrontos') refresh();
  });

  window.ArenaBDAHomeActive = Object.freeze({
    version: 5,
    refresh,
    openTournamentDirectly,
    repairSuperLeagueStandingsOrder
  });

  refresh();
})();
