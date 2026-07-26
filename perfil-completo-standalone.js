(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function teams() {
    const value = read('bda-v2-teams', []);
    return Array.isArray(value) ? value : [];
  }

  function teamFromCard(card, requestedName = '') {
    const cardName = $('h3', card)?.textContent?.trim() || requestedName;
    const stored = teams().find(team => norm(team?.name) === norm(cardName));
    const image = $('img', card)?.currentSrc || $('img', card)?.src || '';
    const masterText = $$('.team-card p,.team-card small,.team-card span', card)
      .map(element => element.textContent.trim())
      .find(text => /mestre/i.test(text)) || '';
    return {
      name: cardName || stored?.name || 'Clube BDA',
      code: stored?.code || '',
      badge: stored?.badge || image,
      master: stored?.master || masterText.replace(/^.*mestre\s*:?\s*/i, '') || 'Não informado',
      status: stored?.status || 'Clã BDA',
      joinedAt: stored?.joinedAt || '',
      city: stored?.city || '',
      founded: stored?.founded || '',
      favoritePlayer: stored?.favoritePlayer || '',
      phrase: stored?.phrase || '',
      description: stored?.description || '',
      profileBanner: stored?.profileBanner || ''
    };
  }

  function initials(team) {
    return String(team.code || team.name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase().slice(0, 4);
  }

  function dateLabel(value) {
    if (!value) return 'Não informada';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function gameScore(game, side) {
    if (game?.wo === 'a') return side === 'a' ? 3 : 0;
    if (game?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game?.a : game?.b;
    return value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function statsFor(name) {
    const store = read('bda-v3-confrontos', {});
    const tournaments = read('bda-v3-tournaments', []);
    const titleMap = new Map((Array.isArray(tournaments) ? tournaments : []).map(item => [String(item?.id || ''), item?.name || 'Campeonato BDA']));
    const matches = [];
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;

    if (store && typeof store === 'object') {
      Object.entries(store).forEach(([tournamentId, list]) => {
        if (!Array.isArray(list)) return;
        list.forEach(game => {
          const side = norm(game?.ta) === norm(name) ? 'a' : norm(game?.tb) === norm(name) ? 'b' : '';
          if (!side) return;
          const own = gameScore(game, side);
          const other = gameScore(game, side === 'a' ? 'b' : 'a');
          if (own == null || other == null) return;
          gf += own;
          ga += other;
          if (own > other) wins += 1;
          else if (own === other) draws += 1;
          else losses += 1;
          matches.push({
            tournament: titleMap.get(tournamentId) || 'Campeonato BDA',
            phase: game?.phase || 'Confronto',
            date: game?.date || '',
            time: game?.time || '',
            place: game?.place || '',
            a: game?.ta || 'A definir',
            b: game?.tb || 'A definir',
            sa: gameScore(game, 'a'),
            sb: gameScore(game, 'b'),
            updated: Number(game?.updated || game?.created || 0)
          });
        });
      });
    }

    matches.sort((a, b) => b.updated - a.updated);
    return { played: wins + draws + losses, wins, draws, losses, gf, ga, sg: gf - ga, matches };
  }

  function titlesFor(name) {
    const list = read('bda-v2-champions', []);
    return (Array.isArray(list) ? list : []).filter(item => norm(item?.name) === norm(name));
  }

  function participationCount(name) {
    const list = read('bda-v3-tournaments', []);
    return (Array.isArray(list) ? list : []).filter(item => (item?.participants || []).some(team => norm(team) === norm(name))).length;
  }

  function cardSummary(card) {
    const values = $$('.club-profile-card-summary span', card).map(element => element.textContent.replace(/\s+/g, ' ').trim());
    const find = label => values.find(value => norm(value).includes(norm(label))) || '';
    return {
      ranking: (find('ranking').match(/\d+/) || [])[0] || '–',
      titles: (find('títulos').match(/\d+/) || [])[0] || '',
      games: (find('jogos').match(/\d+/) || [])[0] || ''
    };
  }

  function badgeHtml(team) {
    return team.badge
      ? `<span class="bda-sp-badge"><img src="${esc(team.badge)}" alt="Escudo de ${esc(team.name)}"></span>`
      : `<span class="bda-sp-badge">${esc(initials(team))}</span>`;
  }

  function matchHtml(match, clubName) {
    const isA = norm(match.a) === norm(clubName);
    const own = isA ? match.sa : match.sb;
    const other = isA ? match.sb : match.sa;
    const result = own > other ? 'V' : own === other ? 'E' : 'D';
    return `<article class="bda-sp-match" data-result="${result}"><span>${result}</span><div><small>${esc(match.tournament)} • ${esc(match.phase)}</small><b>${esc(match.a)} <strong>${match.sa} × ${match.sb}</strong> ${esc(match.b)}</b><em>${match.date ? esc(dateLabel(match.date)) : 'Data não registrada'}${match.place ? ` • ${esc(match.place)}` : ''}</em></div></article>`;
  }

  function titleHtml(title) {
    return `<article class="bda-sp-title">${title?.banner ? `<img src="${esc(title.banner)}" alt="Banner de campeão">` : '<span>🏆</span>'}<div><small>${esc(title?.edition || 'Competição BDA')}</small><b>Campeão</b>${title?.quote ? `<p>“${esc(title.quote)}”</p>` : ''}</div></article>`;
  }

  function closeProfile() {
    $('#bdaStandaloneProfile')?.remove();
    document.body.classList.remove('bda-sp-open');
  }

  function openProfile(button) {
    const card = button.closest('.team-card');
    if (!card) {
      notify('Não foi possível localizar o clube deste botão.');
      return;
    }

    const team = teamFromCard(card, button.dataset.clubProfileName || '');
    const stats = statsFor(team.name);
    const titles = titlesFor(team.name);
    const summary = cardSummary(card);
    const participations = participationCount(team.name);
    const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    const phrase = team.phrase || 'Representando o Clã BDA dentro e fora da arena.';
    const description = team.description || `${team.name} faz parte da comunidade competitiva do Clã BDA.`;

    closeProfile();
    $('#clubProfileModal')?.classList.remove('show');

    const modal = document.createElement('div');
    modal.id = 'bdaStandaloneProfile';
    modal.className = 'bda-sp-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<section class="bda-sp-dialog">
      <header class="bda-sp-hero">
        <button type="button" class="bda-sp-close" data-bda-sp-close aria-label="Fechar">×</button>
        <div class="bda-sp-identity">${badgeHtml(team)}<div><span>PERFIL OFICIAL DO CLUBE</span><h1>${esc(team.name)}</h1><p>“${esc(phrase)}”</p></div></div>
        <div class="bda-sp-actions"><button type="button" class="ghost" data-bda-sp-share>↗ Compartilhar</button>${window.ArenaBDATeamEditor?.open ? '<button type="button" class="primary" data-bda-sp-edit>✎ Editar perfil</button>' : ''}</div>
      </header>
      <main class="bda-sp-body">
        <section class="bda-sp-overview">
          <article><span>Ranking BDA</span><b>${summary.ranking !== '–' ? `${summary.ranking}º` : '–'}</b><small>Posição atual</small></article>
          <article><span>Títulos</span><b>${titles.length || summary.titles || 0}</b><small>${participations} participações</small></article>
          <article><span>Jogos</span><b>${stats.played || summary.games || 0}</b><small>${stats.wins} vitórias</small></article>
          <article><span>Aproveitamento</span><b>${winRate}%</b><small>${stats.gf} gols marcados</small></article>
        </section>

        <div class="bda-sp-columns">
          <section class="bda-sp-panel"><span class="bda-sp-eyebrow">IDENTIDADE</span><h2>Sobre o clube</h2><p>${esc(description)}</p><dl>
            <div><dt>Mestre</dt><dd>${esc(team.master || 'Não informado')}</dd></div><div><dt>Status</dt><dd>${esc(team.status || 'Clã BDA')}</dd></div>
            <div><dt>Entrada no clã</dt><dd>${esc(dateLabel(team.joinedAt))}</dd></div><div><dt>Cidade</dt><dd>${esc(team.city || 'Não informada')}</dd></div>
            <div><dt>Fundação</dt><dd>${esc(team.founded || 'Não informada')}</dd></div><div><dt>Jogador favorito</dt><dd>${esc(team.favoritePlayer || 'Não informado')}</dd></div>
          </dl></section>
          <section class="bda-sp-panel"><span class="bda-sp-eyebrow">DESEMPENHO GERAL</span><h2>Números na Arena</h2><div class="bda-sp-stats">
            <div><b>${stats.wins}</b><span>Vitórias</span></div><div><b>${stats.draws}</b><span>Empates</span></div><div><b>${stats.losses}</b><span>Derrotas</span></div>
            <div><b>${stats.gf}</b><span>Gols pró</span></div><div><b>${stats.ga}</b><span>Gols contra</span></div><div><b>${stats.sg > 0 ? '+' : ''}${stats.sg}</b><span>Saldo</span></div>
          </div></section>
        </div>

        <section class="bda-sp-panel"><span class="bda-sp-eyebrow">HISTÓRICO RECENTE</span><h2>Últimos confrontos</h2><div class="bda-sp-matches">${stats.matches.length ? stats.matches.slice(0, 8).map(match => matchHtml(match, team.name)).join('') : '<div class="bda-sp-empty">Nenhum resultado registrado para este clube.</div>'}</div></section>
        <section class="bda-sp-panel"><span class="bda-sp-eyebrow">SALA PARTICULAR</span><h2>Títulos e campanhas</h2><div class="bda-sp-titles">${titles.length ? titles.map(titleHtml).join('') : '<div class="bda-sp-empty">Os títulos cadastrados aparecerão aqui automaticamente.</div>'}</div></section>
      </main>
    </section>`;

    document.body.append(modal);
    document.body.classList.add('bda-sp-open');
    const hero = $('.bda-sp-hero', modal);
    if (team.profileBanner) hero.style.setProperty('--bda-sp-banner', `url("${team.profileBanner.replace(/"/g, '%22')}")`);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-bda-sp-close]')) closeProfile();
      if (event.target.closest('[data-bda-sp-edit]')) {
        closeProfile();
        window.ArenaBDATeamEditor?.open?.(team.name);
      }
      if (event.target.closest('[data-bda-sp-share]')) {
        const text = `${team.name} • Mestre ${team.master || 'BDA'} • ${titles.length} títulos • ${stats.wins} vitórias`;
        if (navigator.share) navigator.share({ title: `Perfil ${team.name}`, text, url: location.href }).catch(() => {});
        else navigator.clipboard?.writeText(`${text}\n${location.href}`).then(() => notify('Resumo do perfil copiado'));
      }
    });

    requestAnimationFrame(() => $('[data-bda-sp-close]', modal)?.focus());
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#teamGrid [data-open-club-profile], #teamGrid .club-profile-card-summary button');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openProfile(button);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#bdaStandaloneProfile')) closeProfile();
  });

  const style = document.createElement('style');
  style.textContent = `
    .bda-sp-open{overflow:hidden!important}.bda-sp-modal{position:fixed!important;inset:0!important;z-index:60000!important;display:block!important;overflow:auto!important;padding:16px!important;background:rgba(0,0,0,.92)!important;backdrop-filter:blur(14px)!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}.bda-sp-dialog{width:min(1120px,100%);margin:0 auto 30px;overflow:hidden;border:1px solid rgba(245,220,134,.36);border-radius:29px;background:linear-gradient(180deg,#0c2116,#030806);box-shadow:0 40px 120px #000d;text-align:left}
    .bda-sp-hero{--bda-sp-banner:none;position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px;min-height:330px;padding:32px;background:linear-gradient(180deg,rgba(2,7,4,.16),rgba(2,7,4,.96)),var(--bda-sp-banner),radial-gradient(circle at 78% 15%,rgba(245,220,134,.30),transparent 27%),linear-gradient(145deg,#23583a,#06100a);background-size:cover;background-position:center}.bda-sp-close{position:absolute;right:17px;top:17px;z-index:5;width:45px;height:45px;padding:0;border:1px solid #ffffff30;border-radius:14px;color:#fff;background:#020503c4;font-size:26px;cursor:pointer}.bda-sp-identity,.bda-sp-actions{position:relative;z-index:2}.bda-sp-identity{display:flex;align-items:center;gap:19px;min-width:0}.bda-sp-badge{overflow:hidden;display:grid;place-items:center;width:142px;height:142px;flex:0 0 auto;border:4px solid rgba(245,220,134,.56);border-radius:50%;color:#171107;background:linear-gradient(145deg,#f7e29b,#c69a2d);font-size:25px;font-weight:900;box-shadow:0 22px 60px #0009}.bda-sp-badge img{width:100%;height:100%;object-fit:cover}.bda-sp-identity span{color:#f5dc86;font-size:8px;font-weight:900;letter-spacing:.15em}.bda-sp-identity h1{max-width:680px;margin:7px 0 8px;color:#fff;font:900 clamp(42px,7vw,76px)/.87 "Barlow Condensed",Arial,sans-serif;text-transform:uppercase;text-shadow:0 5px 25px #000}.bda-sp-identity p{margin:0;color:#dce7df;font-size:13px;font-style:italic}.bda-sp-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.bda-sp-actions button{min-height:42px}
    .bda-sp-body{display:grid;gap:15px;padding:20px}.bda-sp-overview{position:relative;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:-53px}.bda-sp-overview article{padding:16px;border:1px solid rgba(245,220,134,.25);border-radius:17px;background:linear-gradient(150deg,rgba(26,64,42,.97),rgba(4,13,8,.99));box-shadow:0 15px 34px #0008}.bda-sp-overview span,.bda-sp-overview b,.bda-sp-overview small{display:block}.bda-sp-overview span{color:#a9bbb0;font-size:8px;font-weight:900;text-transform:uppercase}.bda-sp-overview b{margin-top:7px;color:#f5dc86;font:900 30px/1 "Barlow Condensed",sans-serif}.bda-sp-overview small{margin-top:5px;color:#c9d6ce;font-size:8px}
    .bda-sp-columns{display:grid;grid-template-columns:1fr 1fr;gap:15px}.bda-sp-panel{padding:18px;border:1px solid rgba(255,255,255,.10);border-radius:21px;background:linear-gradient(150deg,#10271a,#050d08);box-shadow:0 14px 34px #0004}.bda-sp-panel h2{margin:5px 0 13px;color:#fff;font-size:25px;text-transform:uppercase}.bda-sp-panel>p{margin:0 0 14px;color:#c7d4cc;font-size:11px;line-height:1.65}.bda-sp-eyebrow{color:#f5dc86;font-size:8px;font-weight:900;letter-spacing:.14em}.bda-sp-panel dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}.bda-sp-panel dl>div{padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:#ffffff04}.bda-sp-panel dt{color:#91a398;font-size:7px;font-weight:900;text-transform:uppercase}.bda-sp-panel dd{margin:5px 0 0;color:#edf4ef;font-size:10px;font-weight:700}.bda-sp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.bda-sp-stats div{padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:#ffffff04;text-align:center}.bda-sp-stats b,.bda-sp-stats span{display:block}.bda-sp-stats b{color:#f5dc86;font-size:23px}.bda-sp-stats span{margin-top:4px;color:#91a398;font-size:7px;text-transform:uppercase}
    .bda-sp-matches{display:grid;gap:7px}.bda-sp-match{display:grid;grid-template-columns:40px 1fr;align-items:center;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:#ffffff04}.bda-sp-match>span{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#fff;font-size:10px;font-weight:900}.bda-sp-match[data-result=V]>span{background:#168b50}.bda-sp-match[data-result=E]>span{background:#836e25}.bda-sp-match[data-result=D]>span{background:#9e2d3d}.bda-sp-match small,.bda-sp-match b,.bda-sp-match em{display:block}.bda-sp-match small{color:#f5dc86;font-size:7px;text-transform:uppercase}.bda-sp-match b{margin-top:4px;color:#edf4ef;font-size:10px}.bda-sp-match b strong{color:#f5dc86;font-size:13px}.bda-sp-match em{margin-top:4px;color:#91a398;font-size:7px;font-style:normal}
    .bda-sp-titles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.bda-sp-title{overflow:hidden;min-height:145px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:#06100a}.bda-sp-title>img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.bda-sp-title>span{display:grid;place-items:center;min-height:90px;font-size:40px;background:radial-gradient(circle,#f5dc8633,transparent 60%)}.bda-sp-title>div{padding:10px}.bda-sp-title small,.bda-sp-title b{display:block}.bda-sp-title small{color:#f5dc86;font-size:7px;text-transform:uppercase}.bda-sp-title b{margin-top:4px;color:#fff;font-size:14px;text-transform:uppercase}.bda-sp-title p{margin:7px 0 0;color:#91a398;font-size:8px}.bda-sp-empty{grid-column:1/-1;padding:21px;border:1px dashed rgba(245,220,134,.25);border-radius:14px;color:#91a398;font-size:10px;text-align:center}
    #teamGrid [data-open-club-profile],#teamGrid .club-profile-card-summary button{position:relative!important;z-index:30!important;pointer-events:auto!important;cursor:pointer!important;touch-action:manipulation!important}
    @media(max-width:780px){.bda-sp-modal{padding:6px!important}.bda-sp-dialog{border-radius:21px}.bda-sp-hero{grid-template-columns:1fr;align-items:end;min-height:390px;padding:23px 16px}.bda-sp-identity{display:grid;gap:11px}.bda-sp-badge{width:110px;height:110px}.bda-sp-actions{justify-content:flex-start}.bda-sp-body{padding:10px}.bda-sp-overview{grid-template-columns:repeat(2,1fr);margin-top:-38px}.bda-sp-columns{grid-template-columns:1fr}.bda-sp-titles{grid-template-columns:1fr 1fr}}@media(max-width:480px){.bda-sp-identity h1{font-size:43px}.bda-sp-panel dl{grid-template-columns:1fr}.bda-sp-stats{grid-template-columns:repeat(2,1fr)}.bda-sp-titles{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  window.ArenaBDAStandaloneProfile = { openByButton: openProfile, close: closeProfile };
})();
