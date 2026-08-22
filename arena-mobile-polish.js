(() => {
  'use strict';

  if (window.ArenaBDAMobilePolish?.version >= 1) return;

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const STYLE_ID = 'arenaMobilePolishStyles';
  const mobileQuery = matchMedia('(max-width: 760px)');
  let frame = 0;

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .brand-mark{
        overflow:hidden!important;
        color:transparent!important;
        background:#020503 url('./favicon.svg') center/cover no-repeat!important;
        transform:none!important;
        box-shadow:none!important;
      }
      .arena-zone-legend{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 10px}
      .arena-zone-legend span{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 9px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#9aac9f;background:#08120c;font-size:8px;font-weight:850}
      .arena-zone-legend i{width:7px;height:7px;border-radius:50%;background:#59665e}
      .arena-zone-legend .direct i,.arena-zone-legend .qualified i{background:#4fdf8f}
      .arena-zone-legend .repechage i{background:#d8b248}

      @media(max-width:760px){
        :root{--arena-mobile-nav-space:108px;--arena-context-accent:#d8b248!important;--arena-context-rgb:216,178,72!important;--arena-context-soft:#f1d97f!important}
        html{scroll-padding-bottom:var(--arena-mobile-nav-space)}
        body.arena-visual-system{--arena-accent:#d8b248!important;--arena-accent-rgb:216,178,72!important;--arena-gold:#d8b248!important;--arena-gold-soft:#f1d97f!important;--green:#4fdf8f!important;padding-bottom:var(--arena-mobile-nav-space)!important;background:#030805!important}
        body.arena-visual-system main{padding:10px 10px var(--arena-mobile-nav-space)!important}
        body.arena-visual-system .page{padding-bottom:16px}

        body.arena-visual-system .topbar{min-height:58px!important;gap:8px!important;padding:8px 10px!important;border-radius:0!important;border-width:0 0 1px!important;background:rgba(3,10,6,.97)!important}
        body.arena-visual-system .brand{gap:8px!important}
        body.arena-visual-system .brand-mark{width:38px!important;height:38px!important;flex:0 0 38px!important;border:1px solid rgba(216,178,72,.30)!important;border-radius:10px!important}
        body.arena-visual-system .brand-copy strong{font-size:18px!important;letter-spacing:.02em!important}
        body.arena-visual-system .brand-copy span{display:none!important}
        body.arena-visual-system .top-actions{gap:5px!important;min-width:0;margin-left:auto}
        body.arena-visual-system .top-actions > :is(button,a){width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border-radius:9px!important;display:grid!important;place-items:center!important;font-size:16px!important}
        body.arena-visual-system #adminBtn{font-size:0!important;color:#f1d97f!important;background:#0a1710!important}
        body.arena-visual-system #adminBtn::before{content:'⚙';font-size:17px;line-height:1}
        body.arena-visual-system #adminBtn.active{color:#101309!important;background:#d8b248!important}
        body.arena-visual-system #memberLogoutBtn{font-size:0!important}
        body.arena-visual-system #memberLogoutBtn::before{content:'↪';font-size:17px;line-height:1}

        [data-page="home"].active{display:flex!important;flex-direction:column!important}
        [data-page="home"]>.hero{display:none!important}
        [data-page="home"] .home-grid{order:1!important;margin-top:0!important}
        [data-page="home"] #adminPanel{order:2!important}
        [data-page="home"] .quick-stats{order:3!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:12px 0 0!important}
        [data-page="home"] .quick-stats .stat{min-height:64px!important;padding:9px 7px!important;border-radius:10px!important;background:#08130c!important}
        [data-page="home"] .quick-stats .stat b{font-size:21px!important}
        [data-page="home"] .quick-stats .stat span{margin-top:4px!important;font-size:7px!important;letter-spacing:.04em!important}

        #adminPanel{margin:12px 0 0!important;padding:10px!important;border-radius:12px!important;background:#07140c!important}
        #adminPanel h3{margin:0!important;font-size:16px!important;text-transform:none!important}
        #adminPanel>p{display:none!important}
        #adminPanel .admin-tools{display:flex!important;flex-wrap:nowrap!important;gap:6px!important;overflow-x:auto!important;margin-top:8px!important;padding-bottom:2px;scrollbar-width:none}
        #adminPanel .admin-tools::-webkit-scrollbar{display:none}
        #adminPanel .admin-tools button{flex:0 0 auto!important;min-height:34px!important;padding:0 10px!important;font-size:9px!important;white-space:nowrap!important}

        .bottom-nav,.arena-mobile-nav{left:0!important;right:0!important;bottom:0!important;width:100%!important;min-height:68px!important;transform:none!important;padding:6px 8px calc(6px + env(safe-area-inset-bottom))!important;border-width:1px 0 0!important;border-radius:18px 18px 0 0!important;border-color:rgba(216,178,72,.16)!important;background:rgba(3,12,7,.98)!important;box-shadow:0 -10px 28px rgba(0,0,0,.34)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important}
        .bottom-nav .nav-btn,.arena-mobile-nav button{min-height:52px!important;border-radius:10px!important;color:#91a197!important;background:transparent!important}
        .bottom-nav .nav-btn.active,.arena-mobile-nav button.active{color:#f1d97f!important;background:#0c2516!important;box-shadow:inset 0 2px 0 #d8b248!important}
        .bottom-nav .nav-btn i,.arena-mobile-nav button i{font-size:19px!important}

        #autoStandings .stand-head{display:grid!important;grid-template-columns:1fr!important;align-items:start!important;gap:8px!important;margin:10px 0!important}
        #autoStandings .stand-head h2{margin:2px 0!important;font-size:23px!important;text-transform:none!important}
        #autoStandings .stand-head p{font-size:9px!important;line-height:1.45!important}
        #autoStandings .stand-head button{justify-self:start!important;min-height:34px!important;padding:0 10px!important;font-size:9px!important}
        #autoStandings .stand-highlights{grid-template-columns:1fr!important;gap:6px!important}
        #autoStandings .stand-highlights article{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;min-height:44px!important;padding:8px 10px!important;border-radius:10px!important}
        #autoStandings .stand-highlights article :is(span,b,small){margin:0!important}
        #autoStandings .stand-group{margin-bottom:10px!important;border-radius:12px!important}
        #autoStandings .stand-group>header{align-items:center!important;padding:10px!important;background:#0b2415!important}
        #autoStandings .stand-group h3{margin:2px 0 0!important;color:#f4f6f4!important;font-size:20px!important;text-transform:none!important}
        #autoStandings .stand-group>header>span{max-width:150px;color:#91a197!important;font-size:7px!important;line-height:1.35;text-align:right}
        #autoStandings .stand-scroll{overflow:visible!important}
        #autoStandings table{width:100%!important;min-width:0!important;table-layout:fixed!important}
        #autoStandings :is(th,td)[data-mobile-visible="false"]{display:none!important}
        #autoStandings th,#autoStandings td{height:54px;padding:7px 4px!important;border-bottom-color:rgba(255,255,255,.055)!important;font-size:9px!important;vertical-align:middle!important}
        #autoStandings th[data-mobile-key="rank"],#autoStandings td[data-mobile-key="rank"]{width:38px!important}
        #autoStandings th[data-mobile-key="club"],#autoStandings td[data-mobile-key="club"]{width:auto!important;text-align:left!important}
        #autoStandings th[data-mobile-key="pts"],#autoStandings td[data-mobile-key="pts"]{width:42px!important}
        #autoStandings th[data-mobile-key="j"],#autoStandings td[data-mobile-key="j"]{width:34px!important}
        #autoStandings th[data-mobile-key="sg"],#autoStandings td[data-mobile-key="sg"]{width:42px!important}
        #autoStandings th[data-mobile-key="group"],#autoStandings td[data-mobile-key="group"]{width:48px!important}
        #autoStandings .stand-club{gap:7px!important;min-width:0}
        #autoStandings .stand-badge{width:36px!important;height:36px!important;flex:0 0 36px!important;border-radius:10px!important}
        #autoStandings .stand-club span{min-width:0}
        #autoStandings .stand-club b{display:block;overflow:hidden;font-size:10px!important;line-height:1.2!important;text-overflow:ellipsis;white-space:nowrap}
        #autoStandings .stand-club small{font-size:7px!important}
        #autoStandings .stand-pos{display:grid!important;place-items:center!important;width:28px!important;height:28px!important;margin:auto!important;border-radius:9px!important;color:#91a197!important;background:#142219!important}
        #autoStandings tr[data-zone="direct"] .stand-pos,#autoStandings tr[data-zone="qualified"] .stand-pos{color:#041108!important;background:#4fdf8f!important}
        #autoStandings tr[data-zone="repechage"] .stand-pos{color:#171207!important;background:#d8b248!important}
        #autoStandings tr[data-zone="out"] .stand-pos{color:#728178!important;background:#111b15!important}
        #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone] .stand-club small{display:none!important}
        #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="direct"] .stand-club span::after,#giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="repechage"] .stand-club span::after,#giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="out"] .stand-club span::after{display:block;margin-top:3px;font-size:7px;font-weight:800;line-height:1}
        #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="direct"] .stand-club span::after{content:'Direto às quartas';color:#69e69b}
        #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="repechage"] .stand-club span::after{content:'Repescagem';color:#e3c45f}
        #giManager[data-tid="bda-super-league"] #autoStandings tr[data-zone="out"] .stand-club span::after{content:'Fora da zona';color:#728178}
        #autoStandings tbody tr:not(.arena-mobile-stat-detail){cursor:pointer}
        #autoStandings tbody tr[aria-expanded="true"]{background:rgba(216,178,72,.045)!important}
        #autoStandings .arena-mobile-stat-detail td{display:table-cell!important;height:auto!important;padding:0 7px 8px!important;border:0!important;background:#07110b!important}
        .arena-mobile-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:7px;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:#040b07}
        .arena-mobile-stat-grid span{min-width:0;padding:6px 5px;border-radius:7px;color:#7f9186;background:#0b1710;font-size:7px;text-align:center}
        .arena-mobile-stat-grid b{display:block;margin-top:2px;color:#eef4ef;font-size:10px;font-variant-numeric:tabular-nums}
        #superLeagueThirdPlaceRanking th[data-mobile-key="group"],#superLeagueThirdPlaceRanking td[data-mobile-key="group"]{display:table-cell!important}

        .gi-head>div:last-child,.pro-admin-bar,.admin-tools{scrollbar-width:none}
        .gi-head>div:last-child::-webkit-scrollbar,.pro-admin-bar::-webkit-scrollbar,.admin-tools::-webkit-scrollbar{display:none}
        #giManager .gi-head>div:last-child :is(button,a),.pro-admin-bar :is(button,a){min-height:34px!important;padding:0 10px!important;border-radius:8px!important;font-size:9px!important;white-space:nowrap!important}
      }
    `;
    document.head.appendChild(style);
  }

  function mobileKey(label) {
    const value = normalize(label).replace(/[^a-z0-9#]+/g, '');
    if (value === '#') return 'rank';
    if (value === 'clube' || value === 'club' || value === 'time') return 'club';
    if (value === 'pts' || value === 'pontos') return 'pts';
    if (value === 'j' || value === 'jogos') return 'j';
    if (value === 'sg' || value === 'saldo') return 'sg';
    if (value === 'grupo') return 'group';
    return value || 'other';
  }

  function decorateTable(table) {
    if (!(table instanceof HTMLTableElement)) return;
    const headers = [...table.querySelectorAll('thead th')];
    if (!headers.length) return;
    const visibleKeys = new Set(['rank', 'club', 'pts', 'j', 'sg']);
    if (table.closest('#superLeagueThirdPlaceRanking')) visibleKeys.add('group');

    headers.forEach((header, index) => {
      const key = mobileKey(header.textContent);
      const visible = visibleKeys.has(key);
      header.dataset.mobileKey = key;
      header.dataset.mobileVisible = visible ? 'true' : 'false';
      table.querySelectorAll('tbody tr:not(.arena-mobile-stat-detail)').forEach(row => {
        const cell = row.cells[index];
        if (!cell) return;
        cell.dataset.mobileKey = key;
        cell.dataset.mobileVisible = visible ? 'true' : 'false';
      });
    });
  }

  function ensureLegend(manager) {
    const panel = manager?.querySelector('#autoStandings');
    if (!panel || panel.hidden) return;
    const superLeague = String(manager.dataset.tid || '') === SUPER_LEAGUE_ID;
    const mode = superLeague ? 'super-league' : 'standard';
    let legend = panel.querySelector('.arena-zone-legend');
    if (!legend) {
      legend = document.createElement('div');
      legend.className = 'arena-zone-legend';
      const capture = panel.querySelector('#standCapture');
      if (capture) capture.before(legend);
      else panel.prepend(legend);
    }
    if (legend.dataset.mode === mode) return;
    legend.dataset.mode = mode;
    legend.innerHTML = superLeague
      ? '<span class="direct"><i></i>1º direto às quartas</span><span class="repechage"><i></i>2º e 3º repescagem</span><span><i></i>Fora da zona</span>'
      : '<span class="qualified"><i></i>Zona de classificação</span><span><i></i>Demais posições</span>';
  }

  function decorateZones() {
    const manager = document.querySelector('#giManager');
    if (!manager) return;
    const panel = manager.querySelector('#autoStandings');
    if (!panel || panel.hidden) return;
    const superLeague = String(manager.dataset.tid || '') === SUPER_LEAGUE_ID;

    panel.querySelectorAll('.stand-group:not(#superLeagueThirdPlaceRanking) tbody').forEach(tbody => {
      [...tbody.children].filter(row => row.matches?.('tr:not(.arena-mobile-stat-detail)')).forEach((row, index) => {
        let zone = 'out';
        if (superLeague) zone = index === 0 ? 'direct' : index <= 2 ? 'repechage' : 'out';
        else if (row.classList.contains('qualified')) zone = 'qualified';
        row.dataset.zone = zone;
        if (mobileQuery.matches) {
          row.tabIndex = 0;
          row.setAttribute('aria-label', `Ver estatísticas de ${row.querySelector('.stand-club b')?.textContent || `posição ${index + 1}`}`);
          if (!row.hasAttribute('aria-expanded')) row.setAttribute('aria-expanded', 'false');
        }
      });
    });
    ensureLegend(manager);
  }

  function decorateStandings() {
    document.querySelectorAll('#autoStandings table').forEach(decorateTable);
    decorateZones();
  }

  function syncNavSpace() {
    if (!mobileQuery.matches) {
      document.documentElement.style.removeProperty('--arena-mobile-nav-space');
      return;
    }
    const nav = document.querySelector('.arena-mobile-nav:not([hidden]),.bottom-nav:not([hidden])');
    const height = nav?.getBoundingClientRect?.().height || 78;
    document.documentElement.style.setProperty('--arena-mobile-nav-space', `${Math.ceil(height + 24)}px`);
  }

  function detailsFor(row) {
    const table = row.closest('table');
    if (!table) return [];
    const headers = [...table.querySelectorAll('thead th')];
    return [...row.cells].map((cell, index) => ({
      label: String(headers[index]?.textContent || '').trim(),
      value: String(cell.textContent || '').trim(),
      visible: cell.dataset.mobileVisible === 'true'
    })).filter(item => !item.visible && item.label && item.value && item.value !== '–');
  }

  function closeDetails(row) {
    row?.setAttribute('aria-expanded', 'false');
    const next = row?.nextElementSibling;
    if (next?.classList.contains('arena-mobile-stat-detail')) next.remove();
  }

  function toggleDetails(row) {
    if (!mobileQuery.matches || !row || row.classList.contains('arena-mobile-stat-detail')) return;
    const open = row.getAttribute('aria-expanded') === 'true';
    row.closest('tbody')?.querySelectorAll('tr[aria-expanded="true"]').forEach(other => {
      if (other !== row) closeDetails(other);
    });
    if (open) return closeDetails(row);

    const details = detailsFor(row);
    if (!details.length) return;
    const detailRow = document.createElement('tr');
    detailRow.className = 'arena-mobile-stat-detail';
    const cell = document.createElement('td');
    cell.colSpan = Math.max(1, row.cells.length);
    cell.innerHTML = `<div class="arena-mobile-stat-grid">${details.map(item => `<span>${esc(item.label)}<b>${esc(item.value)}</b></span>`).join('')}</div>`;
    detailRow.appendChild(cell);
    row.after(detailRow);
    row.setAttribute('aria-expanded', 'true');
  }

  function refresh() {
    frame = 0;
    installStyles();
    decorateStandings();
    syncNavSpace();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(refresh);
  }

  document.addEventListener('click', event => {
    const row = event.target.closest?.('#autoStandings tbody tr:not(.arena-mobile-stat-detail)');
    if (!row || event.target.closest('button,a,input,select,textarea')) return;
    toggleDetails(row);
  });

  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const row = event.target.closest?.('#autoStandings tbody tr:not(.arena-mobile-stat-detail)');
    if (!row) return;
    event.preventDefault();
    toggleDetails(row);
  });

  ['arena:bundle-loaded','arena:matches-updated','arena:quick-score-saved','arena:tournaments-updated','arena:auth-changed','arena:cloud-ready']
    .forEach(type => window.addEventListener(type, schedule));
  window.addEventListener('resize', schedule, { passive:true });
  mobileQuery.addEventListener?.('change', schedule);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAMobilePolish = Object.freeze({version:1,refresh,decorateStandings,syncNavSpace});
  refresh();
})();
