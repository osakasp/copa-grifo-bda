(() => {
  'use strict';

  if (window.ArenaBDAProvisionalKnockout?.version >= 1) return;

  const TID = 'bda-super-league';
  const STYLE_ID = 'arenaProvisionalKnockoutStyles';
  let frame = 0;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function manager() {
    return document.querySelector(`#giManager[data-tid="${TID}"]`);
  }

  function groupSort(a, b) {
    return Number(b?.pts || 0) - Number(a?.pts || 0)
      || Number(b?.v || 0) - Number(a?.v || 0)
      || Number(b?.sg || 0) - Number(a?.sg || 0)
      || Number(b?.gp || 0) - Number(a?.gp || 0)
      || String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
  }

  function groupComplete(group) {
    const rows = Array.isArray(group?.rows) ? group.rows : [];
    if (rows.length < 3) return false;
    const expected = Math.max(0, rows.length - 1);
    return rows.every(row => Number(row?.j || 0) >= expected);
  }

  function completedGroups() {
    const data = window.ArenaBDASuperLeagueRuntimeFix?.calculate?.();
    if (!Array.isArray(data)) return [];
    return data
      .filter(groupComplete)
      .map(group => ({
        name: String(group?.name || 'Grupo'),
        rows: [...(group.rows || [])].sort(groupSort)
      }));
  }

  function secondDestinations() {
    if (!window.ArenaBDASuperLeagueRuleV3?.groupsComplete?.()) return new Map();
    const slices = window.ArenaBDASuperLeagueRuleV3?.slices?.();
    const seconds = Array.isArray(slices?.seconds) ? slices.seconds : [];
    return new Map(seconds.map((row, index) => [norm(row?.name), index < 2 ? 'Quartas de final' : 'Play-in']));
  }

  function qualifiedEntries() {
    const destinations = secondDestinations();
    return completedGroups().flatMap(group => {
      const [leader, second, third] = group.rows;
      const items = [];
      if (leader) items.push({
        name: leader.name,
        group: group.name,
        position: 1,
        destination: 'Quartas de final',
        zone: 'direct'
      });
      if (second) items.push({
        name: second.name,
        group: group.name,
        position: 2,
        destination: destinations.get(norm(second.name)) || 'Quartas ou Play-in',
        zone: destinations.has(norm(second.name))
          ? (destinations.get(norm(second.name)) === 'Quartas de final' ? 'direct' : 'playin')
          : 'pending'
      });
      if (third) items.push({
        name: third.name,
        group: group.name,
        position: 3,
        destination: 'Repescagem',
        zone: 'repechage'
      });
      return items;
    });
  }

  function initials(name) {
    return String(name || 'BDA')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  function finalStructureExists() {
    return Boolean(window.ArenaBDASuperLeagueRuleV3?.finalStructureExists?.());
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .arena-provisional-qualified{margin:10px 0 12px;padding:12px;border:1px solid rgba(216,178,72,.22);border-radius:14px;background:linear-gradient(145deg,rgba(13,29,19,.96),rgba(5,12,8,.96))}
      .arena-provisional-qualified>header{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:9px}
      .arena-provisional-qualified>header h3{margin:3px 0 0;color:#f3f6f4;font-size:15px}
      .arena-provisional-qualified>header small{color:#82958a;font-size:8px;text-align:right}
      .arena-provisional-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .arena-provisional-team{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:8px;min-height:58px;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}
      .arena-provisional-team>i{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;color:#171207;background:#d8b248;font-size:8px;font-style:normal;font-weight:900}
      .arena-provisional-team b{display:block;overflow:hidden;color:#eef4ef;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
      .arena-provisional-team span{display:block;margin-top:3px;color:#82958a;font-size:7px;font-weight:800}
      .arena-provisional-team[data-zone="direct"] span{color:#69e69b}
      .arena-provisional-team[data-zone="repechage"] span{color:#e3c45f}
      .arena-provisional-team[data-zone="playin"] span{color:#f0ce70}
      .arena-provisional-team[data-zone="pending"] span{color:#b4c2b9}
      @media(max-width:760px){
        .arena-provisional-qualified>header{display:block}
        .arena-provisional-qualified>header small{display:block;margin-top:4px;text-align:left}
        .arena-provisional-list{grid-template-columns:1fr}
      }
    `;
    document.head.append(style);
  }

  function render() {
    frame = 0;
    installStyles();

    const root = manager();
    const shell = root?.querySelector('.arena-v4-bracket-shell');
    if (!root || !shell) return;

    let panel = shell.querySelector('.arena-provisional-qualified');
    if (finalStructureExists()) {
      panel?.remove();
      return;
    }

    const entries = qualifiedEntries();
    if (!entries.length) {
      panel?.remove();
      return;
    }

    const completed = new Set(entries.map(entry => entry.group)).size;
    const signature = JSON.stringify(entries.map(entry => [entry.name, entry.group, entry.position, entry.destination]));
    if (panel?.dataset.signature === signature) return;

    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'arena-provisional-qualified';
      const head = shell.querySelector('.arena-v4-bracket-head');
      head?.insertAdjacentElement('afterend', panel);
      if (!panel.isConnected) shell.prepend(panel);
    }

    panel.dataset.signature = signature;
    panel.innerHTML = `
      <header>
        <div><span class="eyebrow">Eliminatórias</span><h3>Vagas já confirmadas</h3></div>
        <small>${completed} ${completed === 1 ? 'grupo encerrado' : 'grupos encerrados'} • adversários podem estar a definir</small>
      </header>
      <div class="arena-provisional-list">
        ${entries.map(entry => `
          <article class="arena-provisional-team" data-zone="${esc(entry.zone)}">
            <i>${esc(initials(entry.name))}</i>
            <div>
              <b>${esc(entry.name)}</b>
              <span>${esc(entry.group)} • ${entry.position}º • ${esc(entry.destination)}</span>
            </div>
          </article>`).join('')}
      </div>`;
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(render);
  }

  ['arena:bundle-loaded','arena:matches-updated','arena:quick-score-saved','arena:tournaments-updated','arena:cloud-ready','arena:auth-changed']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ArenaBDAProvisionalKnockout = Object.freeze({
    version: 1,
    render,
    entries: () => qualifiedEntries().map(entry => ({ ...entry }))
  });

  render();
})();
