(() => {
  'use strict';

  if (window.ArenaBDAProvisionalKnockout?.version >= 4) return;

  const TID = 'bda-super-league';
  const STYLE_ID = 'arenaProvisionalKnockoutStyles';
  let frame = 0;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function manager() {
    return document.querySelector(`#giManager[data-tid="${TID}"]`);
  }
  function entries() {
    return window.ArenaBDASuperLeagueRule?.provisionalEntries?.() || [];
  }
  function finalStructureExists() {
    return Boolean(window.ArenaBDASuperLeagueRule?.finalStructureExists?.());
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

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .arena-provisional-qualified{margin:10px 0 12px;padding:12px;border:1px solid rgba(216,178,72,.22);border-radius:14px;background:linear-gradient(145deg,rgba(13,29,19,.96),rgba(5,12,8,.96))}
      .arena-provisional-qualified>header{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:9px}
      .arena-provisional-qualified>header h3{margin:3px 0 0;color:#f3f6f4;font-size:15px}.arena-provisional-qualified>header small{color:#82958a;font-size:8px;text-align:right}
      .arena-provisional-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.arena-provisional-team{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:8px;min-height:58px;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.arena-provisional-team>i{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;color:#171207;background:#d8b248;font-size:8px;font-style:normal;font-weight:900}.arena-provisional-team b{display:block;overflow:hidden;color:#eef4ef;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.arena-provisional-team span{display:block;margin-top:3px;color:#82958a;font-size:7px;font-weight:800}.arena-provisional-team[data-zone="direct"] span{color:#69e69b}.arena-provisional-team[data-zone="qualified"] span{color:#b7c9ff}.arena-provisional-team[data-zone="repechage"]{border-color:rgba(216,178,72,.28);background:rgba(216,178,72,.045)}.arena-provisional-team[data-zone="repechage"] span{color:#e7c664}
      @media(max-width:760px){.arena-provisional-qualified>header{display:block}.arena-provisional-qualified>header small{display:block;margin-top:4px;text-align:left}.arena-provisional-list{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
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

    const list = entries();
    if (!list.length) {
      panel?.remove();
      return;
    }

    const completed = new Set(list.map(entry => entry.group)).size;
    const signature = JSON.stringify(list.map(entry => [entry.name, entry.group, entry.position, entry.destination, entry.zone]));
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
        <small>${completed} ${completed === 1 ? 'grupo encerrado' : 'grupos encerrados'} • 3 classificados por grupo</small>
      </header>
      <div class="arena-provisional-list">
        ${list.map(entry => `
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

  ['arena:bundle-loaded','arena:matches-updated','arena:quick-score-saved','arena:tournaments-updated','arena:cloud-ready','arena:auth-changed','arena:super-league-cloud-synced']
    .forEach(type => window.addEventListener(type, schedule));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.ArenaBDAProvisionalKnockout = Object.freeze({
    version:4,
    render,
    entries:() => entries().map(entry => ({ ...entry }))
  });

  render();
})();
