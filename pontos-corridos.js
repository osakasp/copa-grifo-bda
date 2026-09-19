(() => {
  'use strict';

  const TOURNAMENT_KEY = 'bda-v3-tournaments';
  const TEAMS_KEY = 'bda-v2-teams';
  let lastSignature = '';

  function readTournaments() {
    try {
      const value = JSON.parse(localStorage.getItem(TOURNAMENT_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveTournaments(value) {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('arena:points-updated'));
  }

  function isAdmin() {
    return document.getElementById('adminPanel')?.classList.contains('show') === true;
  }

  function currentTournament() {
    const title = document.querySelector('#tournamentOverview h2')?.textContent?.trim();
    if (!title) return null;
    return readTournaments().find(t => t.name === title && t.format === 'Pontos corridos') || null;
  }

  function standings(tournament) {
    const names = Array.isArray(tournament.participants) ? tournament.participants : [];
    const map = new Map(names.map(name => [name, {
      team: name, pts: 0, played: 0, wins: 0, draws: 0, losses: 0,
      gf: 0, ga: 0, gd: 0
    }]));

    const matches = Array.isArray(tournament.matches) ? tournament.matches : [];
    matches.forEach(match => {
      if (!match || match.status === 'cancelled') return;
      const home = map.get(match.home);
      const away = map.get(match.away);
      if (!home || !away) return;
      const hs = Number(match.homeScore);
      const as = Number(match.awayScore);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) return;

      home.played++;
      away.played++;
      home.gf += hs;
      home.ga += as;
      away.gf += as;
      away.ga += hs;

      if (hs > as) {
        home.pts += 3;
        home.wins++;
        away.losses++;
      } else if (hs < as) {
        away.pts += 3;
        away.wins++;
        home.losses++;
      } else {
        home.pts++;
        away.pts++;
        home.draws++;
        away.draws++;
      }
    });

    return [...map.values()]
      .map(row => ({ ...row, gd: row.gf - row.ga }))
      .sort((a, b) =>
        b.pts - a.pts ||
        b.wins - a.wins ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.team.localeCompare(b.team, 'pt-BR')
      );
  }

  function leagueType(tournament) {
    const id = String(tournament?.id || '').toLowerCase();
    const name = String(tournament?.name || '').toLowerCase();
    if (id === 'liga-a' || name.includes('liga a')) return 'A';
    if (id === 'liga-b' || name.includes('liga b')) return 'B';
    return '';
  }

  function zoneFor(type, index, total) {
    if (!type || total < 4) return { className:'', label:'' };
    if (index === 0) return { className:'bda-zone-champion', label:'Campeão', labelClass:'champion' };
    if (type === 'B' && index < Math.min(4, total)) return { className:'bda-zone-promo', label:'Promoção', labelClass:'promo' };
    if (type === 'A' && index >= Math.max(0, total - 4)) return { className:'bda-zone-relegation', label:'Rebaixamento', labelClass:'relegation' };
    return { className:'', label:'', labelClass:'' };
  }

  function recentForm(tournament, team) {
    const matches = Array.isArray(tournament.matches) ? tournament.matches : [];
    return matches.filter(m => m && m.status !== 'cancelled' && m.status !== 'scheduled' && (m.home === team || m.away === team) &&
      Number.isFinite(Number(m.homeScore)) && Number.isFinite(Number(m.awayScore)))
      .slice(-5).map(m => {
        const home = Number(m.homeScore), away = Number(m.awayScore);
        const isHome = m.home === team;
        const a = isHome ? home : away, b = isHome ? away : home;
        return a > b ? 'V' : a === b ? 'E' : 'D';
      });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function injectStyles() {
    if (document.getElementById('pointsLeagueStyles')) return;
    const style = document.createElement('style');
    style.id = 'pointsLeagueStyles';
    style.textContent = [
      '.bda-points{margin-top:16px}',
      '.bda-points-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:10px}',
      '.bda-points-head h3{margin:0;font-size:24px;text-transform:uppercase}',
      '.bda-points-head p{margin:3px 0 0;color:var(--muted);font-size:10px}',
      '.bda-points-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px;background:rgba(3,8,6,.52)}',
      '.bda-points-table{width:100%;min-width:620px;border-collapse:collapse;font-size:10px}',
      '.bda-points-table th{padding:10px 8px;color:var(--muted);font-size:8px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--line);text-align:center}',
      '.bda-points-table td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:center}',
      '.bda-points-table tr:last-child td{border-bottom:0}',
      '.bda-points-table th:nth-child(2),.bda-points-table td:nth-child(2){text-align:left}',
      '.bda-points-table .rank,.bda-points-table .pts{color:var(--gold-soft);font-weight:900}',
      '.bda-points-table .team{font-weight:800;white-space:nowrap}',
      '.bda-points-note{margin:8px 0 0;color:var(--muted);font-size:9px;line-height:1.45}','.bda-league-hero{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:12px;padding:15px;border:1px solid var(--line-strong);border-radius:17px;background:linear-gradient(135deg,rgba(216,178,72,.11),rgba(79,223,143,.04))}','.bda-league-hero h3{margin:2px 0 3px;font-size:28px;text-transform:uppercase}','.bda-league-hero p{margin:0;color:var(--muted);font-size:10px;line-height:1.45}','.bda-league-badge{display:grid;place-items:center;width:54px;height:54px;border-radius:16px;font-size:27px;background:linear-gradient(145deg,var(--gold-soft),var(--gold));color:#171107}','.bda-zone-promo{background:rgba(79,223,143,.06)}.bda-zone-relegation{background:rgba(255,105,120,.06)}.bda-zone-champion{box-shadow:inset 3px 0 0 var(--gold)}','.bda-zone-label{display:inline-block;margin-left:6px;padding:3px 6px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}','.bda-zone-label.promo{color:var(--green);border:1px solid rgba(79,223,143,.25);background:rgba(79,223,143,.08)}.bda-zone-label.relegation{color:#ff9aa4;border:1px solid rgba(255,105,120,.25);background:rgba(255,105,120,.08)}.bda-zone-label.champion{color:var(--gold-soft);border:1px solid var(--line-strong);background:rgba(216,178,72,.08)}','.bda-form{display:flex;gap:3px;justify-content:center}.bda-form i{font-style:normal;width:17px;height:17px;display:grid;place-items:center;border-radius:5px;font-size:7px;font-weight:900}.bda-form .v{color:var(--green);background:rgba(79,223,143,.1)}.bda-form .e{color:var(--gold-soft);background:rgba(216,178,72,.1)}.bda-form .d{color:#ff9aa4;background:rgba(255,105,120,.1)}','.bda-legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;color:var(--muted);font-size:8px}.bda-legend span{padding:4px 7px;border:1px solid var(--line);border-radius:999px}',
      '.bda-points-admin{margin-top:12px;padding:12px;border:1px solid var(--line-strong);border-radius:15px;background:rgba(216,178,72,.06)}',
      '.bda-match-list{display:grid;gap:7px;margin-top:9px}',
      '.bda-match{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid var(--line);border-radius:11px;font-size:9px;color:var(--muted)}',
      '.bda-match strong{color:var(--text);font-size:10px}',
      '.bda-empty{padding:18px;color:var(--muted);text-align:center;border:1px dashed var(--line);border-radius:14px;font-size:11px}',
      '.bda-match-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}',
      '.bda-match-form label{display:grid;gap:5px}',
      '.bda-match-form .full{grid-column:1/-1}',
      '@media(max-width:560px){.bda-points-head{align-items:stretch;flex-direction:column}.bda-match-form{grid-template-columns:1fr}.bda-match-form .full{grid-column:auto}}'
    ].join('');
    document.head.appendChild(style);
  }

  function allMatches(tournament) {
    return Array.isArray(tournament.matches) ? tournament.matches : [];
  }

  function completedMatches(tournament) {
    return allMatches(tournament).filter(m =>
      m && m.status !== 'cancelled' && m.status !== 'scheduled' &&
      Number.isFinite(Number(m.homeScore)) && Number.isFinite(Number(m.awayScore))
    );
  }

  function scheduledMatches(tournament) {
    return allMatches(tournament).filter(m => m && m.status === 'scheduled');
  }

  function pairKey(a, b) {
    return [String(a), String(b)].sort((x, y) => x.localeCompare(y, 'pt-BR')).join('::');
  }

  function generateCalendar(teams, doubleRound = false) {
    const list = [...teams];
    if (list.length < 2) return [];
    if (list.length % 2) list.push(null);

    const rounds = list.length - 1;
    const half = list.length / 2;
    const rotation = [...list];
    const fixtures = [];

    for (let round = 1; round <= rounds; round++) {
      for (let i = 0; i < half; i++) {
        const a = rotation[i];
        const b = rotation[rotation.length - 1 - i];
        if (a && b) {
          const home = (round + i) % 2 === 0 ? a : b;
          const away = home === a ? b : a;
          fixtures.push({
            home, away, round: round + 'ª rodada', status: 'scheduled'
          });
        }
      }
      rotation.splice(1, 0, rotation.pop());
    }

    if (doubleRound) {
      const secondLeg = fixtures.map((m, index) => ({
        home: m.away,
        away: m.home,
        round: (rounds + Number(m.round.match(/\d+/)?.[0] || 1)) + 'ª rodada',
        status: 'scheduled',
        _order: index
      }));
      return fixtures.concat(secondLeg);
    }
    return fixtures;
  }

  function calendarStats(tournament) {
    const totalTeams = Array.isArray(tournament.participants) ? tournament.participants.length : 0;
    const totalRounds = totalTeams > 1 ? totalTeams - 1 : 0;
    const scheduled = scheduledMatches(tournament).length;
    const played = completedMatches(tournament).length;
    const total = totalTeams > 1 ? (totalTeams * (totalTeams - 1)) / 2 : 0;
    const doubleTotal = total * 2;
    return { totalTeams, totalRounds, scheduled, played, total, doubleTotal };
  }

  function formHtml(tournament) {
    const teams = Array.isArray(tournament.participants) ? tournament.participants : [];
    if (teams.length < 2) {
      return '<div class="bda-empty">Cadastre pelo menos 2 clubes participantes para gerar a tabela.</div>';
    }
    const options = teams.map(team => '<option value="' + esc(team) + '">' + esc(team) + '</option>').join('');
    return [
      '<form id="bdaMatchForm" class="bda-match-form">',
      '<label>Partida<select id="bdaFixture">',
      '<option value="">Lançamento manual</option>',
      scheduledMatches(tournament).map((m, i) => '<option value="' + i + '">' + esc(m.round || 'Rodada') + ' · ' + esc(m.home) + ' x ' + esc(m.away) + '</option>').join(''),
      '</select></label>',
      '<label>Mandante<select id="bdaHome" required>' + options + '</select></label>',
      '<label>Visitante<select id="bdaAway" required>' + options + '</select></label>',
      '<label>Gols mandante<input id="bdaHomeScore" type="number" min="0" max="99" value="0" required></label>',
      '<label>Gols visitante<input id="bdaAwayScore" type="number" min="0" max="99" value="0" required></label>',
      '<label>Rodada<input id="bdaRound" maxlength="20" placeholder="1ª rodada"></label>',
      '<div class="form-actions full"><button class="secondary" type="button" id="bdaCancelMatch">Cancelar</button><button class="primary" type="submit">Salvar resultado</button></div>',
      '</form>'
    ].join('');
  }

  function render(
    injectStyles();
    const competition = document.getElementById('tournamentCompetition');
    const tournament = currentTournament();
    if (!competition || !tournament) return;

    const matches = allMatches(tournament);
    const type = leagueType(tournament);
    const stats = calendarStats(tournament);
    const scheduled = scheduledMatches(tournament);
    const rows = standings(tournament).map((row, index, table) => {
      const zone = zoneFor(type, index, table.length);
      const form = recentForm(tournament, row.team);
      const formHtml = form.length ? '<span class="bda-form">' + form.map(x => '<i class="' + (x === 'V' ? 'v' : x === 'E' ? 'e' : 'd') + '">' + x + '</i>').join('') + '</span>' : '<span class="bda-points-note">—</span>';
      const label = zone.label ? '<span class="bda-zone-label ' + zone.labelClass + '">' + zone.label + '</span>' : '';
      return [
        '<tr class="' + zone.className + '">',
        '<td class="rank">' + (index + 1) + '</td>',
        '<td class="team">' + esc(row.team) + label + '</td>',
        '<td class="pts">' + row.pts + '</td>',
        '<td>' + row.played + '</td>',
        '<td>' + row.wins + '</td>',
        '<td>' + row.draws + '</td>',
        '<td>' + row.losses + '</td>',
        '<td>' + row.gf + '</td>',
        '<td>' + row.ga + '</td>',
        '<td>' + (row.gd > 0 ? '+' : '') + row.gd + '</td>',
        '<td>' + formHtml + '</td>',
        '</tr>'
      ].join('');
    }).join('');

    const leagueHero = type ? '<div class="bda-league-hero"><div><span class="eyebrow">Liga BDA · Temporada</span><h3>' + (type === 'A' ? 'Liga A BDA' : 'Liga B BDA') + '</h3><p>' + (type === 'A' ? 'Divisão principal · 4 últimas posições entram na zona de rebaixamento.' : 'Divisão de acesso · 4 primeiras posições entram na zona de promoção.') + '</p></div><div class="bda-league-badge">' + (type === 'A' ? '🥇' : '🛡️') + '</div></div>' : '';
    let html = [
      '<section class="bda-points">',
      leagueHero,
      '<div class="bda-points-head"><div><span class="eyebrow">Pontos corridos</span><h3>Classificação</h3><p>3 pontos por vitória, 1 por empate e 0 por derrota.</p></div>',
      isAdmin() ? '<div class="bda-admin-actions"><button class="ghost" type="button" id="bdaGenerateCalendar">Gerar calendário</button><button class="ghost" type="button" id="bdaAddMatch">Lançar resultado</button></div>' : ''
      '</div>',
      rows ? '<div class="bda-points-table-wrap"><table class="bda-points-table"><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>FORMA</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="bda-empty">Nenhum clube participante cadastrado.</div>',
      '<div class="bda-calendar-summary"><div><b>' + stats.played + '</b><span>jogos realizados</span></div><div><b>' + scheduled.length + '</b><span>próximos jogos</span></div><div><b>' + stats.total + '</b><span>jogos do turno</span></div></div>' +
      '<p class="bda-points-note">Desempate: pontos, vitórias, saldo de gols, gols pró e ordem alfabética.</p>' +
      (type ? '<div class="bda-legend"><span>🥇 Campeão</span>' + (type === 'B' ? '<span>🟢 Promoção: 1º–4º</span>' : '<span>🔴 Rebaixamento: últimas 4</span>') + '<span>Forma: V vitória · E empate · D derrota</span></div>' : '')
    ].join('');

    if (scheduled.length) {
      html += '<div class="bda-fixtures"><div class="bda-section-title"><div><span class="eyebrow">Calendário</span><h3>Próximas partidas</h3></div></div><div class="bda-fixture-grid">';
      scheduled.slice(0, 12).forEach((match, index) => {
        html += '<article class="bda-fixture"><span>' + esc(match.round || 'Rodada') + '</span><strong>' + esc(match.home) + ' <em>x</em> ' + esc(match.away) + '</strong>' + (isAdmin() ? '<button class="ghost bda-fixture-result" type="button" data-fixture-index="' + index + '">Lançar placar</button>' : '') + '</article>';
      });
      html += '</div></div>';
    }

    const finished = completedMatches(tournament).slice().reverse().slice(0, 8);
    if (finished.length) {
      html += '<div class="bda-fixtures"><div class="bda-section-title"><div><span class="eyebrow">Histórico</span><h3>Últimos resultados</h3></div></div><div class="bda-fixture-grid">';
      finished.forEach(match => {
        html += '<article class="bda-fixture"><span>' + esc(match.round || 'Rodada') + '</span><strong>' + esc(match.home) + ' <em>' + Number(match.homeScore) + ' x ' + Number(match.awayScore) + '</em> ' + esc(match.away) + '</strong></article>';
      });
      html += '</div></div>';
    }

    if (isAdmin()) {
      html += '<div class="bda-points-admin" id="bdaPointsAdmin" hidden><strong>Gestão da liga</strong><p class="bda-points-note">Gere o calendário uma vez. Depois, lance os placares diretamente nas partidas programadas.</p>';
      html += formHtml(tournament);
      html += '<div class="bda-match-list">';
      matches.forEach((match, index) => {
        html += '<div class="bda-match"><span><strong>' + esc(match.home) + '</strong> ' + (match.status === 'scheduled' ? 'vs' : Number(match.homeScore) + ' x ' + Number(match.awayScore)) + ' <strong>' + esc(match.away) + '</strong> · ' + esc(match.round || 'Rodada') + '</span>' + (match.status === 'scheduled' ? '<button class="danger" type="button" data-bda-delete-match="' + index + '">Excluir</button>' : '<button class="danger" type="button" data-bda-delete-match="' + index + '">Excluir</button>') + '</div>';
      });
      html += '</div></div>';
    }

    competition.innerHTML = html;

    document.getElementById('bdaGenerateCalendar')?.addEventListener('click', () => {
      const teams = Array.isArray(tournament.participants) ? tournament.participants.filter(Boolean) : [];
      if (teams.length < 2) {
        window.toast?.('Cadastre pelo menos 2 clubes antes de gerar o calendário');
        return;
      }
      const tournaments = readTournaments();
      const current = tournaments.find(item => item.id === tournament.id);
      if (!current) return;
      current.matches = Array.isArray(current.matches) ? current.matches : [];
      const existingPairs = new Set(current.matches.map(m => pairKey(m.home, m.away)));
      const calendar = generateCalendar(teams, false).filter(m => !existingPairs.has(pairKey(m.home, m.away)));
      if (!calendar.length) {
        window.toast?.('O calendário do turno já está completo');
        return;
      }
      current.matches.push(...calendar);
      saveTournaments(tournaments);
      window.toast?.(calendar.length + ' partidas adicionadas ao calendário');
      render();
    });

    document.getElementById('bdaAddMatch')?.addEventListener('click', () => {
      const panel = document.getElementById('bdaPointsAdmin');
      if (panel) panel.hidden = false;
    });

    document.querySelectorAll('.bda-fixture-result').forEach(button => {
      button.addEventListener('click', () => {
        const panel = document.getElementById('bdaPointsAdmin');
        if (!panel) return;
        panel.hidden = false;
        const fixture = document.getElementById('bdaFixture');
        if (fixture) {
          fixture.value = button.dataset.fixtureIndex || '';
          fixture.dispatchEvent(new Event('change'));
        }
      });
    });

    document.getElementById('bdaFixture')?.addEventListener('change', event => {
      const index = Number(event.target.value);
      const fixture = scheduledMatches(tournament)[index];
      if (!fixture) return;
      document.getElementById('bdaHome').value = fixture.home;
      document.getElementById('bdaAway').value = fixture.away;
      document.getElementById('bdaRound').value = fixture.round || '';
      document.getElementById('bdaHome').disabled = true;
      document.getElementById('bdaAway').disabled = true;
      document.getElementById('bdaRound').disabled = true;
    });

    document.getElementById('bdaCancelMatch')?.addEventListener('click', () => {
      const panel = document.getElementById('bdaPointsAdmin');
      if (panel) panel.hidden = true;
    });

    document.getElementById('bdaMatchForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const home = document.getElementById('bdaHome').value;
      const away = document.getElementById('bdaAway').value;
      if (!home || !away || home === away) {
        window.toast?.('Escolha dois clubes diferentes');
        return;
      }

      const tournaments = readTournaments();
      const current = tournaments.find(item => item.id === tournament.id);
      if (!current) return;
      current.matches = Array.isArray(current.matches) ? current.matches : [];

      const fixtureSelect = document.getElementById('bdaFixture');
      const scheduledList = current.matches.filter(m => m && m.status === 'scheduled');
      const fixtureIndex = fixtureSelect?.value === '' ? -1 : Number(fixtureSelect.value);
      const fixture = fixtureIndex >= 0 ? scheduledList[fixtureIndex] : null;
      if (fixture) {
        fixture.homeScore = Number(document.getElementById('bdaHomeScore').value);
        fixture.awayScore = Number(document.getElementById('bdaAwayScore').value);
        fixture.status = 'final';
      } else {
        current.matches.push({
          home,
          away,
          homeScore: Number(document.getElementById('bdaHomeScore').value),
          awayScore: Number(document.getElementById('bdaAwayScore').value),
          round: document.getElementById('bdaRound').value.trim() || (current.matches.length + 1) + 'ª rodada',
          status: 'final'
        });
      }

      saveTournaments(tournaments);
      window.toast?.('Resultado salvo e classificação atualizada');
      render();
    });

    document.querySelectorAll('[data-bda-delete-match]').forEach(button => {
      button.addEventListener('click', () => {
        const tournaments = readTournaments();
        const current = tournaments.find(item => item.id === tournament.id);
        if (!current || !Array.isArray(current.matches)) return;
        current.matches.splice(Number(button.dataset.bdaDeleteMatch), 1);
        saveTournaments(tournaments);
        window.toast?.('Partida removida do calendário');
        render();
      });
    });
  }

  function observe() {
    const target = document.getElementById('arenaDetail');
    if (!target) return;

    const observer = new MutationObserver(() => {
      const tournament = currentTournament();
      const signature = tournament ? JSON.stringify({
        id: tournament.id,
        format: tournament.format,
        participants: tournament.participants,
        matches: tournament.matches,
        admin: isAdmin()
      }) : '';
      if (signature === lastSignature) return;
      lastSignature = signature;
      if (tournament) render();
    });

    observer.observe(target, { childList: true, subtree: true });
    window.addEventListener('arena:points-updated', () => {
      lastSignature = '';
      render();
    });
  }

  observe();
})();