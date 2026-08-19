(() => {
  'use strict';

  const SUPER_LEAGUE_ID = 'bda-super-league';
  const MATCH_KEY = 'bda-v3-confrontos';

  const FALLBACK_GROUPS = Object.freeze([
    Object.freeze({ name: 'Grupo A', teams: Object.freeze(['CV Cruz BDA','Hellyeah BDA','Imortais FC BDA','BDA Golden FC','CR Flamengo','Vera Cruz Do Oeste PR BDA']) }),
    Object.freeze({ name: 'Grupo B', teams: Object.freeze(['Zombie BDA','Sport Recife BDA','São Paulo BDA','Nacional AC BDA','Imperial São Paulo BDA']) }),
    Object.freeze({ name: 'Grupo C', teams: Object.freeze(['Red Bull BDA','Independente FC BDA','Vasco Da Gama BDA','Esperança BDA','Florence Real BDA']) }),
    Object.freeze({ name: 'Grupo D', teams: Object.freeze(['Boca Juniors','Praia Grande Jogobugado BDA','Flamestre BDA','BDA URDLS','Isaías 55-6-7']) })
  ]);

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

  function groups() {
    const source = window.ArenaBDASuperLeagueGuard?.groups;
    return Array.isArray(source) && source.length ? source : FALLBACK_GROUPS;
  }

  function hasConfiguredGroups(tournament) {
    const source = tournament?.groupGenerator?.groups
      || tournament?.groupSettings?.groups
      || tournament?.settings?.groups;
    return Array.isArray(source) && source.some(group => Array.isArray(group?.teams) && group.teams.length);
  }

  function withCanonicalGroups(tournament) {
    if (!tournament || String(tournament.id || '') !== SUPER_LEAGUE_ID || hasConfiguredGroups(tournament)) return tournament;
    const canonicalGroups = groups().map(group => ({ name: group.name, teams: [...group.teams] }));
    return {
      ...tournament,
      format: tournament.format || 'Grupos + mata-mata',
      qualifiersPerGroup: Number(tournament.qualifiersPerGroup || 2),
      groupSettings: {
        ...(tournament.groupSettings || {}),
        qualifiersPerGroup: Number(tournament.groupSettings?.qualifiersPerGroup || tournament.qualifiersPerGroup || 2),
        rankingMode: tournament.groupSettings?.rankingMode || tournament.rankingMode || 'efficiency',
        groups: canonicalGroups
      },
      groupGenerator: {
        ...(tournament.groupGenerator || {}),
        mode: 'groups',
        groupCount: 4,
        qualifiers: Number(tournament.groupGenerator?.qualifiers || tournament.qualifiersPerGroup || 2),
        groups: canonicalGroups
      }
    };
  }

  function patchValidMatches() {
    const current = window.ArenaBDAValidMatches;
    if (!current?.forTournament || current.__superLeagueRuntimeFix) return;

    const originalForTournament = current.forTournament.bind(current);
    const patchedForTournament = (tournament, games) => originalForTournament(withCanonicalGroups(tournament), games);

    const patched = {
      ...current,
      forTournament: patchedForTournament,
      forTournamentId(tournamentId, games, tournaments) {
        const list = Array.isArray(tournaments) ? tournaments : [];
        const tournament = list.find(item => String(item?.id) === String(tournamentId)) || null;
        return patchedForTournament(tournament, games);
      },
      diagnostics(tournament, games) {
        const list = Array.isArray(games) ? games : [];
        const visible = patchedForTournament(tournament, list);
        return Object.freeze({
          total: list.length,
          visible: visible.length,
          ignored: Math.max(0, list.length - visible.length)
        });
      }
    };

    Object.defineProperty(patched, '__superLeagueRuntimeFix', { value: true });
    window.ArenaBDAValidMatches = Object.freeze(patched);
  }

  function teamGroup(name) {
    const key = normalize(name);
    for (const group of groups()) {
      if (group.teams.some(team => normalize(team) === key)) return group.name;
    }
    return '';
  }

  function isCanonicalGroupGame(game) {
    const homeGroup = teamGroup(game?.ta);
    const awayGroup = teamGroup(game?.tb);
    return Boolean(homeGroup && awayGroup && homeGroup === awayGroup);
  }

  function installMatchStorageGuard() {
    const previous = Storage.prototype.setItem;
    if (previous.__arenaSuperLeagueMatchGuard) return;

    const guarded = function(key, value) {
      let nextValue = value;
      if (this === localStorage && key === MATCH_KEY) {
        try {
          const nextStore = JSON.parse(String(value || '{}'));
          const oldStore = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}');
          const incoming = Array.isArray(nextStore?.[SUPER_LEAGUE_ID]) ? nextStore[SUPER_LEAGUE_ID] : null;
          const existing = Array.isArray(oldStore?.[SUPER_LEAGUE_ID]) ? oldStore[SUPER_LEAGUE_ID] : [];

          if (incoming && existing.length) {
            const incomingHasGroups = incoming.some(isCanonicalGroupGame);
            const existingGroups = existing.filter(isCanonicalGroupGame);
            if (!incomingHasGroups && existingGroups.length) {
              const incomingIds = new Set(incoming.map(game => String(game?.id || '')));
              nextStore[SUPER_LEAGUE_ID] = [
                ...existingGroups.filter(game => !incomingIds.has(String(game?.id || ''))),
                ...incoming
              ];
              nextValue = JSON.stringify(nextStore);
              console.warn('[Arena BDA] Jogos da fase de grupos foram preservados durante a edição.');
            }
          }
        } catch (error) {
          console.warn('[Arena BDA] Não foi possível validar a gravação dos confrontos', error);
        }
      }
      return previous.call(this, key, nextValue);
    };

    Object.defineProperty(guarded, '__arenaSuperLeagueMatchGuard', { value: true });
    Storage.prototype.setItem = guarded;
  }

  let editProtectionUntil = 0;
  let scoreSyncPatched = false;

  function patchScoreSync() {
    const sync = window.ArenaBDAScoreSync;
    if (!sync?.isPending || scoreSyncPatched || sync.__arenaSuperLeagueScoreGuard) return;
    const originalIsPending = sync.isPending.bind(sync);
    sync.isPending = tournamentId => originalIsPending(tournamentId)
      || (String(tournamentId) === SUPER_LEAGUE_ID && Date.now() < editProtectionUntil);
    Object.defineProperty(sync, '__arenaSuperLeagueScoreGuard', { value: true });
    scoreSyncPatched = true;
  }

  function protectScoreEdit(event) {
    const target = event.target instanceof Element
      ? event.target.closest('#giManager .gi-score-input')
      : null;
    if (!target) return;
    const manager = target.closest('#giManager');
    if (manager?.dataset?.tid !== SUPER_LEAGUE_ID) return;
    editProtectionUntil = Date.now() + 4500;
    patchScoreSync();
  }

  function renderGroupOverview() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;

    let overview = document.getElementById('superLeagueGroupsOverview');
    if (!overview) {
      overview = document.createElement('section');
      overview.id = 'superLeagueGroupsOverview';
      const head = manager.querySelector('.gi-head');
      if (head?.parentNode) head.insertAdjacentElement('afterend', overview);
      else manager.prepend(overview);
    }

    const signature = JSON.stringify(groups());
    if (overview.dataset.signature === signature) return;
    overview.dataset.signature = signature;
    overview.innerHTML = `
      <div class="slg-overview-head">
        <div>
          <span class="eyebrow">Fase de grupos</span>
          <h3>Grupos da BDA Super League</h3>
          <p>21 clubes divididos em quatro grupos. Os 2 melhores de cada grupo avançam às quartas de final.</p>
        </div>
        <button type="button" class="primary" data-super-league-open-standings>Ver classificação</button>
      </div>
      <div class="slg-grid">
        ${groups().map(group => `
          <article class="slg-card">
            <header>
              <div><span>⚜️</span><strong>${escapeHtml(group.name)}</strong></div>
              <small>2 avançam</small>
            </header>
            <ol>
              ${group.teams.map((team, index) => `
                <li>
                  <span>${index + 1}</span>
                  <b>${escapeHtml(team)}</b>
                </li>`).join('')}
            </ol>
          </article>`).join('')}
      </div>`;
  }

  function ensureRuntimeStyles() {
    if (document.getElementById('superLeagueRuntimeFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'superLeagueRuntimeFixStyles';
    style.textContent = `
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gip-card,
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gi-game,
      html.arena-score-editing #giManager[data-tid="${SUPER_LEAGUE_ID}"] .gi-score-input{
        transition:none!important;
        animation:none!important;
      }
      #giManager[data-tid="${SUPER_LEAGUE_ID}"] #autoStandings:not([hidden]){display:block}
      #superLeagueGroupsOverview{margin:14px 0 12px;padding:16px;border:1px solid rgba(242,215,125,.18);border-radius:20px;background:linear-gradient(145deg,rgba(16,34,23,.96),rgba(4,11,7,.96));box-shadow:0 16px 42px rgba(0,0,0,.26)}
      #superLeagueGroupsOverview .slg-overview-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:13px}
      #superLeagueGroupsOverview .slg-overview-head h3{margin:4px 0 3px;color:var(--text);font:900 clamp(24px,5vw,34px)/.95 "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.02em}
      #superLeagueGroupsOverview .slg-overview-head p{max-width:690px;margin:0;color:var(--muted);font-size:9px;line-height:1.5}
      #superLeagueGroupsOverview .slg-overview-head button{flex:0 0 auto;min-height:40px;padding:0 13px}
      #superLeagueGroupsOverview .slg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #superLeagueGroupsOverview .slg-card{overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
      #superLeagueGroupsOverview .slg-card header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(135deg,rgba(216,178,72,.11),rgba(79,223,143,.045))}
      #superLeagueGroupsOverview .slg-card header div{display:flex;align-items:center;gap:7px}
      #superLeagueGroupsOverview .slg-card header strong{color:var(--gold-soft);font:900 18px "Barlow Condensed",sans-serif;text-transform:uppercase}
      #superLeagueGroupsOverview .slg-card header small{padding:5px 7px;border:1px solid rgba(79,223,143,.18);border-radius:999px;color:var(--green);background:rgba(79,223,143,.07);font-size:7px;font-weight:900;text-transform:uppercase;white-space:nowrap}
      #superLeagueGroupsOverview .slg-card ol{list-style:none;margin:0;padding:6px 10px 9px}
      #superLeagueGroupsOverview .slg-card li{display:grid;grid-template-columns:27px minmax(0,1fr);align-items:center;gap:8px;min-height:38px;padding:5px 2px;border-bottom:1px solid rgba(255,255,255,.055)}
      #superLeagueGroupsOverview .slg-card li:last-child{border-bottom:0}
      #superLeagueGroupsOverview .slg-card li>span{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;color:#161006;background:linear-gradient(145deg,#f4dfa0,#c79a2e);font-size:8px;font-weight:900}
      #superLeagueGroupsOverview .slg-card li>b{overflow:hidden;color:#eaf1ec;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
      @media(max-width:680px){
        #superLeagueGroupsOverview{padding:13px}
        #superLeagueGroupsOverview .slg-overview-head{display:grid;align-items:stretch}
        #superLeagueGroupsOverview .slg-overview-head button{width:100%}
        #superLeagueGroupsOverview .slg-grid{grid-template-columns:1fr}
      }
    `;
    document.head.append(style);
  }

  function nudgeStandings() {
    const manager = document.getElementById('giManager');
    if (!manager || manager.dataset.tid !== SUPER_LEAGUE_ID) return;
    const panel = document.getElementById('autoStandings');
    const standingsButton = manager.querySelector('[data-standings-tab],[data-tab="standings"]');
    if (!panel || !standingsButton || panel.hidden || panel.querySelectorAll('.stand-group').length >= 4) return;
    if (panel.dataset.superLeagueRetry === 'true') return;
    panel.dataset.superLeagueRetry = 'true';
    setTimeout(() => standingsButton.click(), 0);
  }

  let refreshFrame = 0;
  function refresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      patchValidMatches();
      patchScoreSync();
      ensureRuntimeStyles();
      renderGroupOverview();
      nudgeStandings();
    });
  }

  installMatchStorageGuard();
  patchValidMatches();
  ensureRuntimeStyles();

  document.addEventListener('focusin', protectScoreEdit, true);
  document.addEventListener('input', protectScoreEdit, true);
  document.addEventListener('change', protectScoreEdit, true);
  document.addEventListener('click', event => {
    const button = event.target instanceof Element
      ? event.target.closest('[data-super-league-open-standings]')
      : null;
    if (!button) return;
    const manager = button.closest('#giManager');
    const standings = manager?.querySelector('[data-standings-tab],[data-tab="standings"]');
    standings?.click();
  });

  window.addEventListener('arena:quick-score-saved', () => {
    editProtectionUntil = Date.now() + 1800;
    refresh();
  });
  window.addEventListener('arena:bundle-loaded', refresh);
  window.addEventListener('arena:cloud-ready', refresh);
  window.addEventListener('arena:matches-updated', refresh);
  window.addEventListener('arena:tournaments-updated', refresh);

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDASuperLeagueRuntimeFix = Object.freeze({
    version: 2,
    refresh,
    groups: () => groups().map(group => ({ name: group.name, teams: [...group.teams] }))
  });

  refresh();
})();