(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const MATCH_KEY = 'bda-v3-confrontos';
  const TEAM_KEY = 'bda-v2-teams';
  const WATCHED_KEYS = new Set([TOURNAMENT_KEY, MATCH_KEY, TEAM_KEY]);
  const previousSetItem = Storage.prototype.setItem;
  const previousRemoveItem = Storage.prototype.removeItem;
  let renderTimer = 0;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function tournaments() {
    const values = read(TOURNAMENT_KEY, []);
    return Array.isArray(values) ? values : [];
  }

  function matchStore() {
    const value = read(MATCH_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function teams() {
    const values = read(TEAM_KEY, []);
    return Array.isArray(values) ? values : [];
  }

  function statusPriority(status) {
    const value = normalize(status);
    if (value === 'em andamento') return 50;
    if (value === 'inscricoes abertas') return 40;
    if (value === 'planejado') return 25;
    if (value === 'finalizado') return 10;
    return 20;
  }

  function tournamentActivity(tournament, index) {
    const explicit = Number(
      tournament?.updatedAt ||
      tournament?.createdAt ||
      tournament?.activityAt ||
      0
    );

    const games = gamesFor(tournament?.id);
    const gameActivity = games.reduce(
      (maximum, game) => Math.max(
        maximum,
        Number(game?.updated || game?.created || 0)
      ),
      0
    );

    return Math.max(explicit, gameActivity, 1_000_000 - index);
  }

  function currentTournament() {
    const values = tournaments();
    if (!values.length) return null;

    return values
      .map((tournament, index) => ({
        tournament,
        priority: statusPriority(tournament.status),
        activity: tournamentActivity(tournament, index)
      }))
      .sort((a, b) =>
        b.priority - a.priority ||
        b.activity - a.activity
      )[0]?.tournament || values[0];
  }

  function gamesFor(id) {
    const values = matchStore()[id];
    return Array.isArray(values) ? values : [];
  }

  function hasNumber(value) {
    return value !== '' && value != null && !Number.isNaN(Number(value));
  }

  function isFinished(game) {
    return ['a', 'b'].includes(game?.wo) ||
      (hasNumber(game?.a) && hasNumber(game?.b));
  }

  function gameTimestamp(game) {
    if (game?.date) {
      const date = Date.parse(
        `${game.date}T${game.time || '00:00'}:00`
      );
      if (!Number.isNaN(date)) return date;
    }

    return Number(game?.updated || game?.created || 0);
  }

  function phaseOrder(phase) {
    const value = normalize(phase);
    if (value.includes('prelim')) return 10;
    if (value.includes('grupo')) return 20;
    if (value.includes('oitav')) return 30;
    if (value.includes('quart')) return 40;
    if (value.includes('semi')) return 50;
    if (value.includes('final')) return 60;
    return 25;
  }

  function sortedGames(tournament) {
    return gamesFor(tournament?.id)
      .map((game, index) => ({ ...game, _index: index }))
      .sort((a, b) =>
        gameTimestamp(b) - gameTimestamp(a) ||
        phaseOrder(b.phase) - phaseOrder(a.phase) ||
        Number(b.pos || 0) - Number(a.pos || 0) ||
        b._index - a._index
      );
  }

  function nextOrLatestGame(tournament) {
    const values = sortedGames(tournament);
    const live = values.find(game => normalize(game.status) === 'em andamento');
    if (live) return live;

    const scheduled = values
      .filter(game => !isFinished(game) && !['cancelado', 'adiado'].includes(normalize(game.status)))
      .sort((a, b) => {
        const ta = gameTimestamp(a) || Number.MAX_SAFE_INTEGER;
        const tb = gameTimestamp(b) || Number.MAX_SAFE_INTEGER;
        return ta - tb || phaseOrder(a.phase) - phaseOrder(b.phase);
      })[0];

    if (scheduled) return scheduled;
    return values.find(isFinished) || values[0] || null;
  }

  function initials(name) {
    return String(name || 'BDA')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  function teamByName(name) {
    const key = normalize(name);
    return teams().find(team => normalize(team?.name) === key) || null;
  }

  function badgeMarkup(name, featured = false) {
    const team = teamByName(name);
    const className = `recent-team-badge${featured ? ' featured' : ''}`;

    if (team?.badge) {
      return `<span class="${className}"><img src="${escapeHtml(team.badge)}" alt="Escudo de ${escapeHtml(name)}"></span>`;
    }

    return `<span class="${className}">${escapeHtml(team?.code || initials(name))}</span>`;
  }

  function teamName(game, side) {
    return String(side === 'a' ? game?.ta : game?.tb) ||
      (side === 'a' ? 'Time A' : 'Time B');
  }

  function score(game, side) {
    if (game?.wo === 'a') return side === 'a' ? 'W.O.' : '0';
    if (game?.wo === 'b') return side === 'b' ? 'W.O.' : '0';
    const value = side === 'a' ? game?.a : game?.b;
    return hasNumber(value) ? String(Number(value)) : '–';
  }

  function winnerSide(game) {
    if (game?.wo === 'a') return 'a';
    if (game?.wo === 'b') return 'b';
    if (!isFinished(game)) return '';
    if (Number(game.a) > Number(game.b)) return 'a';
    if (Number(game.b) > Number(game.a)) return 'b';
    if (hasNumber(game.pa) && hasNumber(game.pb)) {
      if (Number(game.pa) > Number(game.pb)) return 'a';
      if (Number(game.pb) > Number(game.pa)) return 'b';
    }
    return '';
  }

  function gameStatus(game) {
    if (!game) return 'Aguardando jogos';
    if (normalize(game.status) === 'em andamento') return 'Ao vivo';
    if (isFinished(game)) return 'Finalizada';
    return game.status || 'Agendada';
  }

  function gameMeta(game, tournament) {
    if (!game) {
      return `${tournament?.phase || 'Preparação'} • ${tournament?.edition || 'Nova edição'}`;
    }

    const parts = [game.phase || tournament?.phase || 'Confronto'];
    if (Number(game.leg) === 2) parts.push('Volta');
    else if (game.tieId && gamesFor(tournament.id).some(item => item.tieId === game.tieId && Number(item.leg) === 2)) parts.push('Ida');
    if (game.date) {
      const [year, month, day] = String(game.date).split('-');
      parts.push(day && month && year ? `${day}/${month}` : game.date);
    }
    if (game.time) parts.push(game.time);
    return parts.join(' • ');
  }

  function centralLabel(game) {
    if (!game) return ['AGUARDANDO', 'Novos confrontos'];
    if (normalize(game.status) === 'em andamento') {
      return [`${score(game, 'a')} × ${score(game, 'b')}`, 'Partida em andamento'];
    }
    if (isFinished(game)) {
      const penalties = hasNumber(game.pa) && hasNumber(game.pb)
        ? ` • Pên. ${Number(game.pa)}–${Number(game.pb)}`
        : '';
      return [`${score(game, 'a')} × ${score(game, 'b')}`, `Resultado oficial${penalties}`];
    }
    return ['X', game.date || game.time ? 'Próximo confronto' : 'Aguardando data'];
  }

  function phaseShort(phase) {
    const value = normalize(phase);
    if (value.includes('prelim')) return 'Preliminar';
    if (value.includes('oitav')) return 'Oitavas';
    if (value.includes('quart')) return 'Quartas';
    if (value.includes('semi')) return 'Semifinal';
    if (value.includes('final')) return 'Final';
    if (value.includes('grupo')) return 'Grupos';
    return phase || 'Jogo';
  }

  function recentRows(tournament) {
    const completed = sortedGames(tournament)
      .filter(isFinished)
      .slice(0, 4);

    if (!completed.length) {
      const upcoming = sortedGames(tournament)
        .filter(game => !isFinished(game))
        .slice(0, 4);

      if (!upcoming.length) {
        return `
          <div class="recent-empty">
            <b>Nenhum confronto registrado</b>
            <span>Os jogos aparecerão aqui assim que forem criados.</span>
          </div>
        `;
      }

      return upcoming.map(game => `
        <button class="recent-match-row" type="button" data-recent-open="${escapeHtml(tournament.id)}">
          <span class="recent-stage">${escapeHtml(phaseShort(game.phase))}</span>
          <span class="recent-match-teams">
            <span>${escapeHtml(teamName(game, 'a'))}<b>–</b></span>
            <span>${escapeHtml(teamName(game, 'b'))}<b>–</b></span>
          </span>
          <span class="recent-match-state upcoming">${escapeHtml(game.status || 'Agendado')}</span>
        </button>
      `).join('');
    }

    return completed.map(game => {
      const winner = winnerSide(game);
      return `
        <button class="recent-match-row" type="button" data-recent-open="${escapeHtml(tournament.id)}">
          <span class="recent-stage">${escapeHtml(phaseShort(game.phase))}</span>
          <span class="recent-match-teams">
            <span class="${winner === 'a' ? 'winner' : ''}">${escapeHtml(teamName(game, 'a'))}<b>${escapeHtml(score(game, 'a'))}</b></span>
            <span class="${winner === 'b' ? 'winner' : ''}">${escapeHtml(teamName(game, 'b'))}<b>${escapeHtml(score(game, 'b'))}</b></span>
          </span>
          <span class="recent-match-state">Encerrado</span>
        </button>
      `;
    }).join('');
  }

  function render() {
    const root = document.querySelector('[data-page="home"] .home-grid');
    if (!root) return;

    const tournament = currentTournament();
    if (!tournament) {
      root.innerHTML = `
        <div class="recent-empty recent-empty-full">
          <b>Nenhum campeonato disponível</b>
          <span>Crie uma competição para iniciar o acompanhamento.</span>
        </div>
      `;
      return;
    }

    const game = nextOrLatestGame(tournament);
    const firstName = game ? teamName(game, 'a') : tournament.participants?.[0] || 'Time A';
    const secondName = game ? teamName(game, 'b') : tournament.participants?.[1] || 'Time B';
    const [mainLabel, secondaryLabel] = centralLabel(game);
    const winner = game ? winnerSide(game) : '';
    const participantCount = Array.isArray(tournament.participants)
      ? tournament.participants.length
      : 0;
    const totalGames = gamesFor(tournament.id).length;

    root.innerHTML = `
      <section class="recent-feature-block">
        <div class="section-head recent-section-head">
          <div>
            <span class="eyebrow">Acompanhando agora</span>
            <h2>${escapeHtml(tournament.name)}</h2>
            <p>${escapeHtml(tournament.status)} • ${escapeHtml(tournament.phase || tournament.edition || 'Preparação')}</p>
          </div>
          <button type="button" data-recent-open="${escapeHtml(tournament.id)}">Abrir campeonato</button>
        </div>

        <article class="recent-feature-card">
          <div class="recent-feature-top">
            <span class="recent-live-pill ${normalize(gameStatus(game)) === 'ao vivo' ? 'live' : ''}">
              <i></i>${escapeHtml(gameStatus(game))}
            </span>
            <time>${escapeHtml(gameMeta(game, tournament))}</time>
          </div>

          <div class="recent-versus">
            <div class="recent-club ${winner === 'a' ? 'winner' : ''}">
              ${badgeMarkup(firstName, true)}
              <strong>${escapeHtml(firstName)}</strong>
              ${game ? `<b>${escapeHtml(score(game, 'a'))}</b>` : ''}
            </div>

            <div class="recent-scorebox">
              <b>${escapeHtml(mainLabel)}</b>
              <span>${escapeHtml(secondaryLabel)}</span>
            </div>

            <div class="recent-club ${winner === 'b' ? 'winner' : ''}">
              ${badgeMarkup(secondName, true)}
              <strong>${escapeHtml(secondName)}</strong>
              ${game ? `<b>${escapeHtml(score(game, 'b'))}</b>` : ''}
            </div>
          </div>

          <div class="recent-feature-footer">
            <span><b>${participantCount}</b> participantes</span>
            <span><b>${totalGames}</b> jogos cadastrados</span>
            <span><b>${escapeHtml(tournament.format || 'A definir')}</b> formato</span>
          </div>
        </article>
      </section>

      <section class="recent-list-block">
        <div class="section-head recent-section-head">
          <div>
            <span class="eyebrow">Movimento da competição</span>
            <h2>${sortedGames(tournament).some(isFinished) ? 'Últimos resultados' : 'Próximos jogos'}</h2>
            <p>Atualização automática do campeonato mais recente</p>
          </div>
          <button type="button" data-recent-open="${escapeHtml(tournament.id)}">Ver todos</button>
        </div>
        <div class="recent-match-list">
          ${recentRows(tournament)}
        </div>
      </section>
    `;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 80);
  }

  const style = document.createElement('style');
  style.textContent = `
    [data-page="home"] .home-grid{
      display:grid;
      grid-template-columns:minmax(0,1.45fr) minmax(300px,.85fr);
      gap:13px;
      align-items:start;
    }
    .recent-section-head{align-items:flex-end;margin-top:0}
    .recent-section-head .eyebrow{display:block;margin-bottom:4px}
    .recent-section-head h2{font-size:28px}
    .recent-section-head button{white-space:nowrap}
    .recent-feature-card,.recent-match-list{
      overflow:hidden;
      border:1px solid var(--line-strong);
      border-radius:22px;
      background:
        radial-gradient(circle at 50% -20%,rgba(216,178,72,.18),transparent 42%),
        linear-gradient(145deg,rgba(25,58,38,.96),rgba(5,15,10,.97));
      box-shadow:0 16px 42px rgba(0,0,0,.28);
    }
    .recent-feature-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:11px 13px;
      border-bottom:1px solid var(--line);
    }
    .recent-feature-top time{color:var(--muted);font-size:10px;text-align:right}
    .recent-live-pill{
      display:inline-flex;
      align-items:center;
      gap:7px;
      padding:6px 9px;
      border-radius:999px;
      color:var(--gold-soft);
      background:rgba(216,178,72,.10);
      font-size:8px;
      font-weight:900;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    .recent-live-pill i{width:7px;height:7px;border-radius:50%;background:currentColor}
    .recent-live-pill.live{color:#ff9aa4;background:rgba(255,105,120,.11)}
    .recent-live-pill.live i{box-shadow:0 0 0 5px rgba(255,105,120,.10);animation:pulse 1.4s infinite}
    .recent-versus{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
      align-items:center;
      gap:18px;
      min-height:190px;
      padding:22px 16px;
    }
    .recent-club{min-width:0;display:grid;justify-items:center;gap:8px;text-align:center}
    .recent-club strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
    .recent-club>b{color:var(--gold-soft);font:900 24px "Barlow Condensed",sans-serif}
    .recent-club.winner strong,.recent-club.winner>b{color:var(--green)}
    .recent-team-badge{
      overflow:hidden;
      display:grid;
      place-items:center;
      width:31px;
      height:31px;
      flex:0 0 auto;
      border-radius:50%;
      color:#171107;
      background:linear-gradient(145deg,#f4dfa0,#c79a2e);
      font-size:8px;
      font-weight:900;
    }
    .recent-team-badge.featured{width:64px;height:64px;border:3px solid rgba(255,255,255,.16);box-shadow:0 9px 22px rgba(0,0,0,.32);font-size:13px}
    .recent-team-badge img{width:100%;height:100%;display:block;object-fit:cover}
    .recent-scorebox{text-align:center}
    .recent-scorebox b{display:block;color:var(--gold-soft);font:900 clamp(24px,5vw,39px) "Barlow Condensed",sans-serif;letter-spacing:.04em;text-transform:uppercase}
    .recent-scorebox span{display:block;max-width:150px;margin-top:3px;color:var(--muted);font-size:8px;text-transform:uppercase}
    .recent-feature-footer{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      border-top:1px solid var(--line);
      background:rgba(2,7,4,.28);
    }
    .recent-feature-footer span{padding:11px;border-right:1px solid var(--line);color:var(--muted);font-size:8px;text-align:center;text-transform:uppercase}
    .recent-feature-footer span:last-child{border-right:0}
    .recent-feature-footer b{display:block;margin-bottom:3px;color:var(--text);font-size:10px}
    .recent-match-list{display:grid}
    .recent-match-row{
      width:100%;
      display:grid;
      grid-template-columns:65px minmax(0,1fr) auto;
      align-items:center;
      gap:10px;
      min-height:78px;
      padding:11px 13px;
      border:0;
      border-bottom:1px solid var(--line);
      color:var(--text);
      background:transparent;
      text-align:left;
    }
    .recent-match-row:last-child{border-bottom:0}
    .recent-match-row:hover{background:rgba(255,255,255,.035)}
    .recent-stage{color:var(--gold-soft);font-size:8px;font-weight:900;text-transform:uppercase}
    .recent-match-teams{min-width:0;display:grid;gap:6px}
    .recent-match-teams>span{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;min-width:0;font-size:10px}
    .recent-match-teams>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .recent-match-teams>span.winner{color:var(--green);font-weight:800}
    .recent-match-teams b{color:var(--gold-soft);font-size:12px}
    .recent-match-state{color:var(--muted);font-size:8px;text-align:right}
    .recent-match-state.upcoming{color:var(--gold-soft)}
    .recent-empty{
      display:grid;
      place-items:center;
      gap:5px;
      min-height:190px;
      padding:25px;
      color:var(--muted);
      text-align:center;
    }
    .recent-empty b{color:var(--text);font-size:12px}
    .recent-empty span{font-size:9px}
    .recent-empty-full{grid-column:1/-1;border:1px dashed var(--line-strong);border-radius:20px}
    @media(max-width:820px){
      [data-page="home"] .home-grid{grid-template-columns:1fr}
      .recent-list-block{margin-top:3px}
    }
    @media(max-width:480px){
      .recent-section-head{align-items:flex-start}
      .recent-section-head h2{font-size:24px}
      .recent-versus{gap:8px;min-height:160px;padding:18px 8px}
      .recent-team-badge.featured{width:52px;height:52px}
      .recent-club strong{font-size:10px}
      .recent-scorebox span{max-width:95px;font-size:7px}
      .recent-feature-footer{grid-template-columns:1fr}
      .recent-feature-footer span{border-right:0;border-bottom:1px solid var(--line)}
      .recent-feature-footer span:last-child{border-bottom:0}
      .recent-match-row{grid-template-columns:58px minmax(0,1fr);min-height:72px}
      .recent-match-state{grid-column:2;text-align:left}
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-recent-open]');
    if (!button) return;

    const tournamentId = button.dataset.recentOpen;
    const original = document.querySelector(`[data-home-tournament="${CSS.escape(tournamentId)}"]`);

    if (original) {
      original.click();
      return;
    }

    if (typeof navigate === 'function') navigate('tournament');
    window.setTimeout(() => {
      document.querySelector(`[data-open-tournament="${CSS.escape(tournamentId)}"]`)?.click();
    }, 70);
  });

  Storage.prototype.setItem = function setItemWithRecentHome(key, value) {
    previousSetItem.call(this, key, value);
    if (this === localStorage && WATCHED_KEYS.has(key)) scheduleRender();
  };

  Storage.prototype.removeItem = function removeItemWithRecentHome(key) {
    previousRemoveItem.call(this, key);
    if (this === localStorage && WATCHED_KEYS.has(key)) scheduleRender();
  };

  window.addEventListener('storage', event => {
    if (WATCHED_KEYS.has(event.key)) scheduleRender();
  });

  const observer = new MutationObserver(() => {
    if (!document.querySelector('[data-page="home"] .home-grid')) return;
    scheduleRender();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
