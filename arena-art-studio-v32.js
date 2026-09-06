(() => {
  'use strict';

  if (window.ArenaBDAArtV32?.version >= 1) return;
  const VERSION = 1;
  const TEAM_KEY = 'bda-v2-teams';
  let standingObserver = null;
  let standingTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
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

  function readTeams() {
    try {
      const value = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function teamMap() {
    const map = new Map();
    readTeams().forEach(team => {
      if (team?.name) map.set(norm(team.name), team);
    });
    return map;
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

  function shield(name) {
    const team = teamMap().get(norm(name));
    if (team?.badge) {
      return `<span class="bda-v32-shield"><img src="${esc(team.badge)}" alt="${esc(name)}"></span>`;
    }
    return `<span class="bda-v32-shield bda-v32-initials">${esc(initials(name))}</span>`;
  }

  function findHeaderIndex(headers, patterns, fallback = -1) {
    const index = headers.findIndex(header => patterns.some(pattern => pattern.test(norm(header))));
    return index >= 0 ? index : fallback;
  }

  function groupLabel(table, clone, index, total) {
    let node = table.parentElement;
    while (node && node !== clone) {
      const heading = node.querySelector(':scope > h2,:scope > h3,:scope > h4,:scope > .group-title,:scope > .standings-title');
      const text = String(heading?.textContent || '').trim();
      if (text && text.length <= 54 && !/^classifica[cç][aã]o$/i.test(text)) return text;
      node = node.parentElement;
    }
    if (total > 1) return `Grupo ${String.fromCharCode(65 + index)}`;
    return 'Classificação geral';
  }

  function tableData(table, clone, index, total) {
    let headers = $$('thead th', table).map(cell => String(cell.textContent || '').trim());
    let rows = $$('tbody tr', table);

    if (!rows.length) {
      const all = $$('tr', table);
      const first = all[0];
      if (!headers.length && first) headers = $$('th,td', first).map(cell => String(cell.textContent || '').trim());
      rows = all.slice(headers.length ? 1 : 0);
    }
    if (!rows.length) return null;

    const cellCount = Math.max(...rows.map(row => $$('td,th', row).length), headers.length, 0);
    const posIndex = findHeaderIndex(headers, [/^#$/, /^pos/, /^coloc/], 0);
    const teamIndex = findHeaderIndex(headers, [/time/, /clube/, /equipe/, /team/], cellCount > 1 ? 1 : 0);
    const ptsIndex = findHeaderIndex(headers, [/^pts$/, /ponto/], cellCount > 2 ? 2 : Math.max(0, cellCount - 1));
    const gamesIndex = findHeaderIndex(headers, [/^j$/, /^pj$/, /jogos/, /partidas/], cellCount > 3 ? 3 : -1);
    const winsIndex = findHeaderIndex(headers, [/^v$/, /vit/], cellCount > 4 ? 4 : -1);
    const gdIndex = findHeaderIndex(headers, [/^sg$/, /saldo/], cellCount > 2 ? Math.max(2, cellCount - 2) : -1);

    const parsed = rows.map((row, rowIndex) => {
      const cells = $$('td,th', row);
      if (!cells.length) return null;
      const text = idx => idx >= 0 && cells[idx] ? String(cells[idx].textContent || '').replace(/\s+/g, ' ').trim() : '';
      const teamCell = cells[teamIndex] || cells[1] || cells[0];
      const imgAlt = String(teamCell?.querySelector('img')?.alt || '').trim();
      let team = text(teamIndex) || imgAlt;
      if (imgAlt && (!team || team.length <= 2)) team = imgAlt;
      if (!team) return null;
      const rawPos = text(posIndex).replace(/[^0-9]/g, '');
      return {
        pos: rawPos || String(rowIndex + 1),
        team,
        pts: text(ptsIndex) || '0',
        games: text(gamesIndex) || '0',
        wins: text(winsIndex) || '0',
        gd: text(gdIndex) || '0',
        sourceClass: String(row.className || '')
      };
    }).filter(Boolean);

    if (!parsed.length) return null;
    return { label: groupLabel(table, clone, index, total), rows: parsed };
  }

  function standingsMarkup(groups) {
    const multiple = groups.length > 1 ? ' multi' : '';
    return `<section class="bda-v32-standings${multiple}">${groups.map(group => `
      <article class="bda-v32-group">
        <header><span>${esc(group.label)}</span><small>${group.rows.length} clubes</small></header>
        <div class="bda-v32-table-head"><span>#</span><span>CLUBE</span><span>PTS</span><span>J</span><span>V</span><span>SG</span></div>
        <div class="bda-v32-table-body">${group.rows.map((row, index) => {
          const sourceQualified = /qual|classif|promov|advance|green/i.test(row.sourceClass);
          const cls = index === 0 ? ' leader' : sourceQualified ? ' qualified' : '';
          return `<div class="bda-v32-row${cls}">
            <b class="bda-v32-pos">${esc(row.pos)}</b>
            <div class="bda-v32-club">${shield(row.team)}<strong>${esc(row.team)}</strong></div>
            <b class="bda-v32-pts">${esc(row.pts)}</b>
            <span>${esc(row.games)}</span>
            <span>${esc(row.wins)}</span>
            <span>${esc(row.gd)}</span>
          </div>`;
        }).join('')}</div>
      </article>`).join('')}</section>`;
  }

  function upgradeStandingsClone(clone) {
    if (!(clone instanceof Element) || clone.dataset.v32Done === 'true') return false;
    const tables = $$('table', clone);
    if (!tables.length) return false;
    const groups = tables.map((table, index) => tableData(table, clone, index, tables.length)).filter(Boolean);
    if (!groups.length) return false;
    clone.dataset.v32Done = 'true';
    clone.innerHTML = standingsMarkup(groups);
    clone.classList.add('bda-v32-native');
    return true;
  }

  function upgradeExistingStandings() {
    $$('.bda-art-standings-clone').forEach(upgradeStandingsClone);
  }

  function stopStandingsWatch() {
    if (standingObserver) standingObserver.disconnect();
    standingObserver = null;
    clearTimeout(standingTimer);
    standingTimer = 0;
  }

  function watchStandingsGeneration() {
    stopStandingsWatch();
    upgradeExistingStandings();
    standingObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('.bda-art-standings-clone')) upgradeStandingsClone(node);
          node.querySelectorAll?.('.bda-art-standings-clone').forEach(upgradeStandingsClone);
        }
      }
      if ($('#bdaProResult')) stopStandingsWatch();
    });
    standingObserver.observe(document.body, { childList: true, subtree: true });
    standingTimer = window.setTimeout(stopStandingsWatch, 18000);
  }

  function relabel() {
    const button = $('#arenaArtProButton');
    if (button) button.textContent = '🎨 Artes Broadcast';
    const modal = $('#bdaProStudio');
    const title = modal?.querySelector('h2');
    const eyebrow = modal?.querySelector('header span');
    if (title) title.textContent = 'Estúdio Broadcast';
    if (eyebrow) eyebrow.textContent = 'CENTRAL DE ARTES BDA • V3.2';
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#bdaProGenerate') && $('#bdaProType')?.value === 'standings') {
      watchStandingsGeneration();
      return;
    }
    if (target.closest('[data-pro-result-close],[data-pro-close]')) stopStandingsWatch();
  }, true);

  const style = document.createElement('style');
  style.id = 'arenaArtV32Styles';
  style.textContent = `
    .bda-art-result{position:relative!important}
    .bda-art-result::before{
      content:"";
      position:absolute;
      left:50%;top:50%;
      width:520px;height:520px;
      transform:translate(-50%,-50%);
      border:1px solid rgba(255,255,255,.035);
      border-radius:50%;
      background:radial-gradient(circle,rgba(255,255,255,.03) 0,rgba(255,255,255,.012) 44%,transparent 70%);
      z-index:-1;
    }
    .bda-art-team{position:relative!important;padding:18px 10px!important}
    .bda-art-team .bda-art-shield{width:238px!important;height:238px!important}
    .bda-art-team h2{margin-top:16px!important;font-size:42px!important;line-height:.88!important}
    .bda-art-score{
      min-height:238px!important;
      border-radius:22px!important;
      background:rgba(0,0,0,.16)!important;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.075)!important;
    }
    .bda-art-score::before{width:72%!important;height:3px!important}
    .bda-art-score>b{font-size:112px!important;letter-spacing:-.055em!important}
    .bda-art-score small{font-size:10px!important}
    .bda-art-score i{padding:8px 15px!important;font-size:9px!important}
    .bda-art-leg-list{margin-top:18px!important;gap:10px!important}
    .bda-art-leg,.bda-art-aggregate{padding:12px 14px!important;background:rgba(255,255,255,.025)!important}
    .bda-art-leg b{font-size:11px!important}
    .bda-art-aggregate b{font-size:24px!important}

    .bda-v32-native{width:100%!important;max-width:none!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
    .bda-v32-standings{display:grid;width:100%;gap:14px}
    .bda-v32-standings.multi{grid-template-columns:repeat(2,minmax(0,1fr))}
    .bda-v32-group{overflow:hidden;border-radius:16px;background:rgba(0,0,0,.20);box-shadow:inset 0 0 0 1px rgba(255,255,255,.075)}
    .bda-v32-group>header{display:flex;align-items:center;justify-content:space-between;padding:13px 15px 10px;border-bottom:1px solid rgba(255,255,255,.07)}
    .bda-v32-group>header span{color:var(--broadcast-accent)!important;font:900 17px/1 "Barlow Condensed",sans-serif;letter-spacing:.07em;text-transform:uppercase}
    .bda-v32-group>header small{color:var(--broadcast-muted)!important;font-size:8px!important;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .bda-v32-table-head,.bda-v32-row{display:grid;grid-template-columns:34px minmax(0,1fr) 44px 32px 32px 38px;align-items:center;gap:5px}
    .bda-v32-table-head{padding:8px 12px 6px;color:var(--broadcast-muted);font-size:8px;font-weight:900;letter-spacing:.08em;text-align:center}
    .bda-v32-table-head span:nth-child(2){text-align:left}
    .bda-v32-table-body{display:grid;gap:4px;padding:0 8px 9px}
    .bda-v32-row{min-height:43px;padding:5px 6px;border-radius:10px;background:rgba(255,255,255,.034);color:#f6f9f7;font-size:10px;text-align:center}
    .bda-v32-row.leader{background:rgba(255,255,255,.065);box-shadow:inset 3px 0 0 var(--broadcast-accent)}
    .bda-v32-row.qualified:not(.leader){box-shadow:inset 2px 0 0 rgba(255,255,255,.22)}
    .bda-v32-pos{color:var(--broadcast-muted);font-size:10px}
    .bda-v32-row.leader .bda-v32-pos,.bda-v32-pts{color:var(--broadcast-accent)}
    .bda-v32-club{display:grid;grid-template-columns:30px minmax(0,1fr);align-items:center;gap:8px;min-width:0;text-align:left}
    .bda-v32-club strong{overflow:hidden;color:#f7faf8;font:800 12px/1 "Barlow Condensed",sans-serif;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase}
    .bda-v32-shield{width:28px;height:28px;display:grid;place-items:center;overflow:hidden;border-radius:8px;background:rgba(255,255,255,.06)}
    .bda-v32-shield img{width:100%;height:100%;object-fit:contain}
    .bda-v32-initials{color:var(--broadcast-accent);font:900 9px/1 "Barlow Condensed",sans-serif;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
    .bda-v32-pts{font-size:13px}

    .bda-pro-champion{position:relative!important;min-height:650px!important;align-content:center!important}
    .bda-pro-champion::before{
      content:"CAMPEÃO";
      position:absolute;
      left:50%;top:50%;
      transform:translate(-50%,-50%);
      color:rgba(255,255,255,.025);
      font:900 170px/.8 "Barlow Condensed",Impact,sans-serif;
      letter-spacing:-.04em;
      white-space:nowrap;
      z-index:-1;
    }
    .bda-pro-champion .bda-art-shield.champion{width:310px!important;height:310px!important}
    .bda-pro-champion>small{margin-top:16px!important;font-size:15px!important;letter-spacing:.38em!important}
    .bda-pro-champion h2{max-width:940px!important;margin:7px 0 18px!important;font-size:86px!important;line-height:.84!important}
    .bda-pro-champion>div{padding:11px 25px!important;background:rgba(0,0,0,.18)!important}
    .bda-pro-champion>div b{font-size:30px!important}
    .bda-pro-champion p{margin-top:14px!important;font-size:10px!important}

    .bda-art-story .bda-art-team .bda-art-shield{width:220px!important;height:220px!important}
    .bda-art-story .bda-art-score>b{font-size:116px!important}
    .bda-art-story .bda-v32-standings.multi{grid-template-columns:1fr}
    .bda-art-story .bda-v32-row{min-height:47px}
    .bda-art-story .bda-v32-group>header span{font-size:20px}
    .bda-art-story .bda-pro-champion{min-height:1280px!important}
    .bda-art-story .bda-pro-champion .bda-art-shield.champion{width:350px!important;height:350px!important}
    .bda-art-story .bda-pro-champion h2{font-size:94px!important}

    .bda-art-wide .bda-art-team .bda-art-shield{width:270px!important;height:270px!important}
    .bda-art-wide .bda-art-score>b{font-size:132px!important}
    .bda-art-wide .bda-v32-standings.multi{grid-template-columns:repeat(2,minmax(0,1fr))}
    .bda-art-wide .bda-v32-row{min-height:45px}
    .bda-art-wide .bda-pro-champion{min-height:720px!important}
    .bda-art-wide .bda-pro-champion .bda-art-shield.champion{width:330px!important;height:330px!important}
    .bda-art-wide .bda-pro-champion h2{font-size:94px!important}
  `;
  document.head.appendChild(style);

  ['arena:bundle-loaded','arena:tournaments-updated','arena:permissions-updated','arena:matches-updated']
    .forEach(name => window.addEventListener(name, () => setTimeout(relabel, 80)));
  [0, 250, 800, 1800].forEach(delay => setTimeout(relabel, delay));

  window.ArenaBDAArtV32 = Object.freeze({
    version: VERSION,
    refresh: relabel,
    upgradeStandings: upgradeExistingStandings,
    features: Object.freeze(['native-standings','result-refinement','champion-refinement'])
  });
})();