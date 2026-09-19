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
      '.bda-points-note{margin:8px 0 0;color:var(--muted);font-size:9px;line-height:1.45}',
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

  function formHtml(tournament) {
    const teams = Array.isArray(tournament.participants) ? tournament.participants : [];
    if (teams.length < 2) {
      return '<div class="bda-empty">Cadastre pelo menos 2 clubes participantes para lançar resultados.</div>';
    }
    const options = teams.map(team => '<option value="' + esc(team) + '">' + esc(team) + '</option>').join('');
    return [
      '<form id="bdaMatchForm" class="bda-match-form">',
      '<label>Mandante<select id="bdaHome" required>' + options + '</select></label>',
      '<label>Visitante<select id="bdaAway" required>' + options + '</select></label>',
      '<label>Gols mandante<input id="bdaHomeScore" type="number" min="0" max="99" value="0" required></label>',
      '<label>Gols visitante<input id="bdaAwayScore" type="number" min="0" max="99" value="0" required></label>',
      '<label class="full">Rodada<input id="bdaRound" maxlength="20" placeholder="1ª rodada"></label>',
      '<div class="form-actions full"><button class="secondary" type="button" id="bdaCancelMatch">Cancelar</button><button class="primary" type="submit">Salvar resultado</button></div>',
      '</form>'
    ].join('');
  }

  function render() {
    injectStyles();
    const competition = document.getElementById('tournamentCompetition');
    const tournament = currentTournament();
    if (!competition || !tournament) return;

    const matches = Array.isArray(tournament.matches) ? tournament.matches : [];
    const rows = standings(tournament).map((row, index) => [
      '<tr>',
      '<td class="rank">' + (index + 1) + '</td>',
      '<td class="team">' + esc(row.team) + '</td>',
      '<td class="pts">' + row.pts + '</td>',
      '<td>' + row.played + '</td>',
      '<td>' + row.wins + '</td>',
      '<td>' + row.draws + '</td>',
      '<td>' + row.losses + '</td>',
      '<td>' + row.gf + '</td>',
      '<td>' + row.ga + '</td>',
      '<td>' + (row.gd > 0 ? '+' : '') + row.gd + '</td>',
      '</tr>'
    ].join('')).join('');

    let html = [
      '<section class="bda-points">',
      '<div class="bda-points-head"><div><span class="eyebrow">Pontos corridos</span><h3>Classificação</h3><p>3 pontos por vitória, 1 por empate e 0 por derrota.</p></div>',
      isAdmin() ? '<button class="ghost" type="button" id="bdaAddMatch">Lançar resultado</button>' : '',
      '</div>',
      rows ? '<div class="bda-points-table-wrap"><table class="bda-points-table"><thead><tr><th>#</th><th>Clube</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="bda-empty">Nenhum clube participante cadastrado.</div>',
      '<p class="bda-points-note">Desempate: pontos, vitórias, saldo de gols, gols pró e ordem alfabética.</p>'
    ].join('');

    if (isAdmin()) {
      html += '<div class="bda-points-admin" id="bdaPointsAdmin" hidden><strong>Resultados lançados</strong>';
      if (matches.length) {
        html += '<div class="bda-match-list">';
        matches.forEach((match, index) => {
          html += '<div class="bda-match"><span><strong>' + esc(match.home) + '</strong> ' + Number(match.homeScore) + ' x ' + Number(match.awayScore) + ' <strong>' + esc(match.away) + '</strong> · ' + esc(match.round || 'Rodada') + '</span><button class="danger" type="button" data-bda-delete-match="' + index + '">Excluir</button></div>';
        });
        html += '</div>';
      } else {
        html += '<div class="bda-empty" style="margin-top:8px">Nenhum resultado lançado.</div>';
      }
      html += formHtml(tournament);
      html += '</div>';
    }

    competition.innerHTML = html;

    document.getElementById('bdaAddMatch')?.addEventListener('click', () => {
      const panel = document.getElementById('bdaPointsAdmin');
      if (panel) panel.hidden = false;
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
      current.matches.push({
        home,
        away,
        homeScore: Number(document.getElementById('bdaHomeScore').value),
        awayScore: Number(document.getElementById('bdaAwayScore').value),
        round: document.getElementById('bdaRound').value.trim() || String(current.matches.length + 1) + 'ª rodada',
        status: 'final'
      });

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
        window.toast?.('Resultado excluído');
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