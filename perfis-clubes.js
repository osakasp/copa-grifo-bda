(() => {
  'use strict';

  const KEYS = {
    teams: 'bda-v2-teams',
    champions: 'bda-v2-champions',
    tournaments: 'bda-v3-tournaments',
    matches: 'bda-v3-confrontos'
  };
  const POINTS = { win: 3, draw: 1, participation: 10, finalWin: 50, runnerUp: 25, title: 100 };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const slug = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clube-bda';
  const number = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const placeholder = value => /^vencedor\s+/i.test(String(value || ''));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  let activeTeamIndex = -1;
  let pendingProfileBanner = null;
  let observerTimer = 0;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function teamList() {
    if (typeof teams !== 'undefined' && Array.isArray(teams)) return teams;
    const value = read(KEYS.teams, []);
    return Array.isArray(value) ? value : [];
  }

  function championList() {
    if (typeof champions !== 'undefined' && Array.isArray(champions)) return champions;
    const value = read(KEYS.champions, []);
    return Array.isArray(value) ? value : [];
  }

  function tournamentList() {
    const value = read(KEYS.tournaments, []);
    return Array.isArray(value) ? value : [];
  }

  function matchStore() {
    const value = read(KEYS.matches, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function adminActive() {
    return typeof isAdmin !== 'undefined' && Boolean(isAdmin);
  }

  function initials(name, code = '') {
    return String(code || name || 'BDA').split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join('').toUpperCase().slice(0, 4);
  }

  function badgeHtml(team, className = 'club-profile-badge') {
    return team?.badge
      ? `<span class="${className}"><img src="${esc(team.badge)}" alt="Escudo de ${esc(team.name)}"></span>`
      : `<span class="${className}">${esc(initials(team?.name, team?.code))}</span>`;
  }

  function tieCode(value) {
    return norm(value).replace(/\s+/g, '').replace(/-(ida|volta|v)$/i, '');
  }

  function refCode(value) {
    const match = String(value || '').match(/^Vencedor\s+(.+)$/i);
    return match ? tieCode(match[1]) : '';
  }

  function score(game, side) {
    if (game?.wo === 'a') return side === 'a' ? 3 : 0;
    if (game?.wo === 'b') return side === 'b' ? 3 : 0;
    const value = side === 'a' ? game?.a : game?.b;
    return number(value) ? Number(value) : null;
  }

  function finished(game) {
    return ['a', 'b'].includes(game?.wo) || (number(game?.a) && number(game?.b));
  }

  function gameTime(game) {
    if (game?.date) {
      const parsed = Date.parse(`${game.date}T${game.time || '00:00'}:00`);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Number(game?.updated || game?.created || 0);
  }

  function phaseIsFinal(value) {
    const phase = norm(value);
    return phase === 'final' || phase.includes('grande final');
  }

  function makeResolver(rawGames) {
    const groups = new Map();
    rawGames.forEach((game, index) => {
      const key = String(game?.tieId || game?.id || `jogo-${index}`);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ...game, _index: index });
    });
    groups.forEach(list => list.sort((a, b) => Number(a.leg || 1) - Number(b.leg || 1) || gameTime(a) - gameTime(b)));
    const byCode = new Map([...groups].map(([key, list]) => [tieCode(key), list]));
    const cache = new Map();

    function resolveName(name, seen = new Set()) {
      const code = refCode(name);
      if (!code || seen.has(code)) return String(name || '');
      seen.add(code);
      return winner(byCode.get(code), seen)?.team || String(name || '');
    }

    function winner(list, seen = new Set()) {
      if (!list?.length) return null;
      const cacheKey = String(list[0]?.tieId || list[0]?.id || '');
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const totals = new Map();
      let complete = true;
      const last = list[list.length - 1];
      list.forEach(game => {
        const a = resolveName(game.ta, new Set(seen));
        const b = resolveName(game.tb, new Set(seen));
        const sa = score(game, 'a');
        const sb = score(game, 'b');
        if (sa == null || sb == null) complete = false;
        if (!placeholder(a)) totals.set(a, (totals.get(a) || 0) + (sa || 0));
        if (!placeholder(b)) totals.set(b, (totals.get(b) || 0) + (sb || 0));
      });
      const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      let team = '';
      if (complete && entries.length >= 2) {
        if (entries[0][1] !== entries[1][1]) team = entries[0][0];
        else if (number(last?.pa) && number(last?.pb) && Number(last.pa) !== Number(last.pb)) {
          team = Number(last.pa) > Number(last.pb)
            ? resolveName(last.ta, new Set(seen))
            : resolveName(last.tb, new Set(seen));
        }
      }
      const result = { team, totals, complete };
      cache.set(cacheKey, result);
      return result;
    }

    return { groups, resolveName, winner };
  }

  function blankStats(team) {
    return {
      name: team.name,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      sg: 0,
      titles: 0,
      runnerUps: 0,
      participations: 0,
      lastGames: [],
      matches: []
    };
  }

  function calculateAllStats() {
    const registered = teamList();
    const map = new Map(registered.map(team => [norm(team.name), blankStats(team)]));
    const tournaments = tournamentList();
    const store = matchStore();

    const ensure = name => {
      if (!name || placeholder(name)) return null;
      const key = norm(name);
      if (!map.has(key)) map.set(key, blankStats({ name: String(name).trim() }));
      return map.get(key);
    };

    tournaments.forEach(tournament => {
      (tournament.participants || []).forEach(name => {
        const stats = ensure(name);
        if (stats) {
          stats.points += POINTS.participation;
          stats.participations += 1;
        }
      });

      const stored = Array.isArray(store[tournament.id]) ? store[tournament.id] : [];
      const raw = window.ArenaBDAValidMatches?.forTournament(tournament, stored) || stored;
      const resolver = makeResolver(raw);
      raw.forEach(game => {
        if (!finished(game)) return;
        const aName = resolver.resolveName(game.ta);
        const bName = resolver.resolveName(game.tb);
        const a = ensure(aName);
        const b = ensure(bName);
        const sa = score(game, 'a');
        const sb = score(game, 'b');
        if (!a || !b || sa == null || sb == null) return;

        a.played += 1; b.played += 1;
        a.gf += sa; a.ga += sb;
        b.gf += sb; b.ga += sa;
        if (sa > sb) {
          a.wins += 1; b.losses += 1; a.points += POINTS.win;
        } else if (sb > sa) {
          b.wins += 1; a.losses += 1; b.points += POINTS.win;
        } else {
          a.draws += 1; b.draws += 1; a.points += POINTS.draw; b.points += POINTS.draw;
        }
        const record = {
          tournament: tournament.name || 'Campeonato BDA',
          tournamentId: tournament.id,
          phase: game.phase || 'Confronto',
          date: game.date || '',
          time: game.time || '',
          place: game.place || '',
          updated: gameTime(game),
          a: aName,
          b: bName,
          sa,
          sb
        };
        a.matches.push(record);
        b.matches.push(record);
      });

      resolver.groups.forEach(list => {
        if (!phaseIsFinal(list[0]?.phase)) return;
        const result = resolver.winner(list);
        if (!result?.team) return;
        const names = [...result.totals.keys()];
        const champion = ensure(result.team);
        if (champion) champion.points += POINTS.finalWin;
        const runnerName = names.find(name => norm(name) !== norm(result.team));
        const runner = ensure(runnerName);
        if (runner) {
          runner.points += POINTS.runnerUp;
          runner.runnerUps += 1;
        }
      });
    });

    championList().forEach(champion => {
      const stats = ensure(champion?.name);
      if (stats) {
        stats.points += POINTS.title;
        stats.titles += 1;
      }
    });

    map.forEach(stats => {
      stats.sg = stats.gf - stats.ga;
      stats.matches.sort((a, b) => b.updated - a.updated);
      stats.lastGames = stats.matches.slice(0, 5).map(match => {
        const isA = norm(match.a) === norm(stats.name);
        const own = isA ? match.sa : match.sb;
        const opponent = isA ? match.sb : match.sa;
        return own > opponent ? 'V' : own === opponent ? 'E' : 'D';
      });
    });

    const ordered = [...map.values()].sort((a, b) => b.points - a.points || b.titles - a.titles || b.sg - a.sg || b.gf - a.gf || a.name.localeCompare(b.name, 'pt-BR'));
    return { map, ordered };
  }

  function profileData(team, index) {
    const calculated = calculateAllStats();
    const stats = calculated.map.get(norm(team.name)) || blankStats(team);
    const rank = calculated.ordered.findIndex(item => norm(item.name) === norm(team.name)) + 1;
    const titles = championList().filter(item => norm(item?.name) === norm(team.name));
    const competitions = tournamentList().filter(item => (item.participants || []).some(name => norm(name) === norm(team.name)));
    const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    return { team, index, stats, rank, titles, competitions, winRate };
  }

  function dateLabel(value) {
    if (!value) return 'Não informada';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function matchResult(match, clubName) {
    const isA = norm(match.a) === norm(clubName);
    const own = isA ? match.sa : match.sb;
    const opponent = isA ? match.sb : match.sa;
    return own > opponent ? 'V' : own === opponent ? 'E' : 'D';
  }

  function matchHtml(match, clubName) {
    const result = matchResult(match, clubName);
    const date = match.date ? dateLabel(match.date) : 'Data não registrada';
    return `<article class="club-profile-match" data-result="${result}">
      <span class="club-profile-result">${result}</span>
      <div><small>${esc(match.tournament)} • ${esc(match.phase)}</small><b>${esc(match.a)} <strong>${match.sa} × ${match.sb}</strong> ${esc(match.b)}</b><em>${esc(date)}${match.place ? ` • ${esc(match.place)}` : ''}</em></div>
    </article>`;
  }

  function titleHtml(title) {
    return `<article class="club-profile-title-card">
      ${title.banner ? `<img src="${esc(title.banner)}" alt="Banner de ${esc(title.edition)}">` : '<span>🏆</span>'}
      <div><small>${esc(title.edition || 'Título BDA')}</small><b>Campeão</b>${title.quote ? `<p>“${esc(title.quote)}”</p>` : ''}</div>
    </article>`;
  }

  function renderProfile(index) {
    const team = teamList()[index];
    if (!team) return;
    activeTeamIndex = index;
    const { stats, titles, competitions, winRate } = profileData(team, index);
    const modal = ensureProfileModal();
    const banner = team.profileBanner || '';
    const phrase = team.phrase || 'Representando o Clã BDA dentro e fora da arena.';
    const about = team.description || `${team.name} faz parte da comunidade competitiva do Clã BDA.`;
    const form = stats.lastGames.length
      ? stats.lastGames.map(result => `<i data-result="${result}">${result}</i>`).join('')
      : '<span>Sem jogos registrados</span>';

    modal.querySelector('.club-profile-dialog').innerHTML = `
      <header class="club-profile-hero" ${banner ? `style="--profile-banner:url('${esc(banner)}')"` : ''}>
        <button class="club-profile-close" type="button" data-close-club-profile aria-label="Fechar">×</button>
        <div class="club-profile-identity">
          ${badgeHtml(team, 'club-profile-badge large')}
          <div><span class="eyebrow">Perfil oficial do clube</span><h1>${esc(team.name)}</h1><p>“${esc(phrase)}”</p></div>
        </div>
        <div class="club-profile-hero-actions">
          <button class="ghost" type="button" data-share-club-profile>↗ Compartilhar</button>
          ${adminActive() ? '<button class="primary" type="button" data-edit-club-profile>✎ Editar perfil</button>' : ''}
        </div>
      </header>

      <main class="club-profile-body">
        <section class="club-profile-overview">
          <article><span>Competições</span><b>${stats.participations}</b><small>participações registradas</small></article>
          <article><span>Títulos</span><b>${stats.titles}</b><small>${stats.runnerUps} vice${stats.runnerUps === 1 ? '' : 's'}</small></article>
          <article><span>Jogos</span><b>${stats.played}</b><small>${stats.wins} vitórias</small></article>
          <article><span>Aproveitamento</span><b>${winRate}%</b><small>${stats.gf} gols marcados</small></article>
        </section>

        <div class="club-profile-columns">
          <section class="club-profile-panel club-profile-about">
            <div class="club-profile-section-head"><div><span>Identidade</span><h2>Sobre o clube</h2></div></div>
            <p>${esc(about)}</p>
            <dl>
              <div><dt>Mestre</dt><dd>${esc(team.master || 'Não informado')}</dd></div>
              <div><dt>Status</dt><dd>${esc(team.status || 'Clã BDA')}</dd></div>
              <div><dt>Entrada no clã</dt><dd>${esc(dateLabel(team.joinedAt))}</dd></div>
              <div><dt>Cidade</dt><dd>${esc(team.city || 'Não informada')}</dd></div>
              <div><dt>Fundação</dt><dd>${esc(team.founded || 'Não informada')}</dd></div>
              <div><dt>Jogador favorito</dt><dd>${esc(team.favoritePlayer || 'Não informado')}</dd></div>
            </dl>
          </section>

          <section class="club-profile-panel">
            <div class="club-profile-section-head"><div><span>Desempenho geral</span><h2>Números na Arena</h2></div><div class="club-profile-form">${form}</div></div>
            <div class="club-profile-stat-grid">
              <div><b>${stats.wins}</b><span>Vitórias</span></div><div><b>${stats.draws}</b><span>Empates</span></div><div><b>${stats.losses}</b><span>Derrotas</span></div>
              <div><b>${stats.gf}</b><span>Gols pró</span></div><div><b>${stats.ga}</b><span>Gols contra</span></div><div><b>${stats.sg > 0 ? '+' : ''}${stats.sg}</b><span>Saldo</span></div>
            </div>
            <div class="club-profile-progress"><span><b style="width:${winRate}%"></b></span><small>${winRate}% de vitórias em partidas registradas</small></div>
          </section>
        </div>

        <section class="club-profile-panel">
          <div class="club-profile-section-head"><div><span>Histórico recente</span><h2>Últimos confrontos</h2></div></div>
          <div class="club-profile-matches">${stats.matches.length ? stats.matches.slice(0, 8).map(match => matchHtml(match, team.name)).join('') : '<div class="club-profile-empty">Nenhum resultado registrado para este clube.</div>'}</div>
        </section>

        <section class="club-profile-panel">
          <div class="club-profile-section-head"><div><span>Sala particular</span><h2>Títulos e campanhas</h2></div><small>${competitions.length} participações cadastradas</small></div>
          <div class="club-profile-titles">${titles.length ? titles.map(titleHtml).join('') : '<div class="club-profile-empty">Os títulos cadastrados na Sala de Troféus aparecerão aqui automaticamente.</div>'}</div>
          ${competitions.length ? `<div class="club-profile-competitions">${competitions.map(item => `<span>${esc(item.badge || '🏆')} ${esc(item.name)}</span>`).join('')}</div>` : ''}
        </section>
      </main>`;

    modal.classList.add('show');
    document.body.classList.add('club-profile-open');
    modal.querySelector('[data-close-club-profile]')?.focus();
  }

  function ensureProfileModal() {
    let modal = $('#clubProfileModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'clubProfileModal';
    modal.className = 'club-profile-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<section class="club-profile-dialog"></section>';
    document.body.append(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-close-club-profile]')) closeProfile();
    });
    return modal;
  }

  function closeProfile() {
    $('#clubProfileModal')?.classList.remove('show');
    document.body.classList.remove('club-profile-open');
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = source;
    });
  }

  async function prepareProfileBanner(file) {
    if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB');
    const image = await loadImage(await readFile(file));
    const width = 1400;
    const height = 620;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao preparar a capa');
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    return canvas.toDataURL('image/webp', 0.84);
  }

  function openEditor() {
    if (!adminActive() || activeTeamIndex < 0) return;
    const team = teamList()[activeTeamIndex];
    if (!team) return;
    pendingProfileBanner = null;
    let modal = $('#clubProfileEditor');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'clubProfileEditor';
      modal.className = 'club-profile-editor modal-backdrop';
      modal.innerHTML = `<div class="modal club-profile-editor-dialog"><div class="club-profile-editor-head"><div><span class="eyebrow">Administração do clube</span><h2>Editar perfil</h2></div><button type="button" data-close-club-editor>×</button></div><form id="clubProfileForm"><div class="form-grid two">
        <label>Mestre<input id="profileMaster" maxlength="50"></label>
        <label>Status<select id="profileStatus"><option>Inscrito</option><option>Confirmado</option><option>Lista de espera</option><option>Inativo</option></select></label>
        <label>Data de entrada<input id="profileJoinedAt" type="date"></label>
        <label>Cidade<input id="profileCity" maxlength="55" placeholder="Ex.: Praia Grande - SP"></label>
        <label>Fundação<input id="profileFounded" maxlength="30" placeholder="Ex.: 2024"></label>
        <label>Jogador favorito<input id="profileFavoritePlayer" maxlength="55"></label>
        <label style="grid-column:1/-1">Frase oficial<input id="profilePhrase" maxlength="130" placeholder="Frase que representa o clube"></label>
        <label style="grid-column:1/-1">História do clube<textarea id="profileDescription" maxlength="700" placeholder="Conte a origem, trajetória e identidade do clube."></textarea></label>
        <label style="grid-column:1/-1">Imagem de capa<input id="profileBannerFile" type="file" accept="image/png,image/jpeg,image/webp"><div class="club-profile-banner-preview" id="profileBannerPreview"></div></label>
      </div><div class="form-actions"><button class="secondary" type="button" data-close-club-editor>Cancelar</button><button class="primary" type="submit">Salvar perfil</button></div></form></div>`;
      document.body.append(modal);
      modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-close-club-editor]')) closeEditor();
      });
      $('#profileBannerFile', modal).addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) {
          pendingProfileBanner = null;
          renderBannerPreview();
          return;
        }
        try {
          notify('Preparando a capa do clube...');
          pendingProfileBanner = await prepareProfileBanner(file);
          renderBannerPreview();
          notify('Capa ajustada');
        } catch (error) {
          pendingProfileBanner = null;
          event.target.value = '';
          renderBannerPreview();
          notify(error.message || 'Não foi possível preparar a capa');
        }
      });
      $('#clubProfileForm', modal).addEventListener('submit', saveProfile);
    }

    $('#profileMaster', modal).value = team.master || '';
    $('#profileStatus', modal).value = team.status || 'Inscrito';
    $('#profileJoinedAt', modal).value = team.joinedAt || '';
    $('#profileCity', modal).value = team.city || '';
    $('#profileFounded', modal).value = team.founded || '';
    $('#profileFavoritePlayer', modal).value = team.favoritePlayer || '';
    $('#profilePhrase', modal).value = team.phrase || '';
    $('#profileDescription', modal).value = team.description || '';
    $('#profileBannerFile', modal).value = '';
    renderBannerPreview();
    modal.classList.add('show');
    $('#profileMaster', modal).focus();
  }

  function renderBannerPreview() {
    const root = $('#profileBannerPreview');
    if (!root || activeTeamIndex < 0) return;
    const team = teamList()[activeTeamIndex] || {};
    const image = pendingProfileBanner === null ? team.profileBanner || '' : pendingProfileBanner;
    root.innerHTML = image
      ? `<img src="${esc(image)}" alt="Prévia da capa"><span>A capa aparecerá no alto do perfil.</span><button type="button" class="danger" data-remove-profile-banner>Remover capa</button>`
      : '<div>CAPA DO CLUBE</div><span>Imagens horizontais ficam melhores. O site ajusta para 1400 × 620.</span>';
  }

  function closeEditor() {
    $('#clubProfileEditor')?.classList.remove('show');
  }

  function saveProfile(event) {
    event.preventDefault();
    if (!adminActive() || activeTeamIndex < 0) return;
    const list = teamList();
    const team = list[activeTeamIndex];
    if (!team) return;
    team.master = $('#profileMaster').value.trim();
    team.status = $('#profileStatus').value;
    team.joinedAt = $('#profileJoinedAt').value;
    team.city = $('#profileCity').value.trim();
    team.founded = $('#profileFounded').value.trim();
    team.favoritePlayer = $('#profileFavoritePlayer').value.trim();
    team.phrase = $('#profilePhrase').value.trim();
    team.description = $('#profileDescription').value.trim();
    if (pendingProfileBanner !== null) team.profileBanner = pendingProfileBanner;
    localStorage.setItem(KEYS.teams, JSON.stringify(list));
    if (typeof renderTeams === 'function') renderTeams();
    closeEditor();
    renderProfile(activeTeamIndex);
    notify('Perfil do clube atualizado');
  }

  function shareProfile() {
    if (activeTeamIndex < 0) return;
    const team = teamList()[activeTeamIndex];
    if (!team) return;
    const { stats } = profileData(team, activeTeamIndex);
    const text = `${team.name} • Mestre ${team.master || 'BDA'} • ${stats.titles} títulos • ${stats.wins} vitórias`;
    if (navigator.share) navigator.share({ title: `Perfil ${team.name}`, text, url: location.href }).catch(error => { if (error?.name !== 'AbortError') notify('Não foi possível compartilhar'); });
    else navigator.clipboard?.writeText(`${text}\n${location.href}`).then(() => notify('Resumo do perfil copiado')).catch(() => notify('Não foi possível copiar o perfil'));
  }

  function installSearch() {
    const page = $('[data-page="teams"]');
    const grid = $('#teamGrid', page);
    if (!page || !grid || $('#clubProfileToolbar', page)) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'clubProfileToolbar';
    toolbar.className = 'club-profile-toolbar';
    toolbar.innerHTML = `<label><span>Buscar clube</span><input id="clubProfileSearch" type="search" placeholder="Nome do clube ou mestre"></label><label><span>Status</span><select id="clubProfileStatusFilter"><option value="todos">Todos</option><option>Confirmado</option><option>Inscrito</option><option>Lista de espera</option><option>Inativo</option></select></label>`;
    grid.before(toolbar);
    toolbar.addEventListener('input', filterCards);
    toolbar.addEventListener('change', filterCards);
    const heading = page.querySelector('.section-head h2');
    const copy = page.querySelector('.section-head p');
    if (heading) heading.textContent = 'Clubes e perfis oficiais';
    if (copy) copy.textContent = 'Escudos, mestres, títulos, ranking e histórico de partidas.';
  }

  function filterCards() {
    const query = norm($('#clubProfileSearch')?.value || '');
    const status = norm($('#clubProfileStatusFilter')?.value || 'todos');
    let visible = 0;
    $$('#teamGrid .team-card').forEach(card => {
      const haystack = norm(`${card.dataset.profileName || ''} ${card.dataset.profileMaster || ''}`);
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = status === 'todos' || norm(card.dataset.profileStatus) === status;
      const show = matchesQuery && matchesStatus;
      card.hidden = !show;
      if (show) visible += 1;
    });
    const count = $('#teamCount');
    if (count) count.textContent = `${visible} ${visible === 1 ? 'clube encontrado' : 'clubes encontrados'}`;
  }

  function decorateCards() {
    installSearch();
    const calculated = calculateAllStats();
    const registered = teamList();
    $$('#teamGrid .team-card').forEach((card, position) => {
      const name = $('h3', card)?.textContent?.trim();
      const index = registered.findIndex(team => norm(team.name) === norm(name));
      if (index < 0) return;
      const team = registered[index];
      const stats = calculated.map.get(norm(team.name)) || blankStats(team);
      const rank = calculated.ordered.findIndex(item => norm(item.name) === norm(team.name)) + 1;
      card.classList.add('club-profile-card');
      card.dataset.profileIndex = String(index);
      card.dataset.profileName = team.name || '';
      card.dataset.profileMaster = team.master || '';
      card.dataset.profileStatus = team.status || '';
      let summary = $('.club-profile-card-summary', card);
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'club-profile-card-summary';
        const adminActions = $('.team-admin-actions', card);
        if (adminActions) adminActions.before(summary);
        else card.append(summary);
      }
      summary.innerHTML = `<div><span><b>${rank || '–'}º</b> Ranking</span><span><b>${stats.titles}</b> Títulos</span><span><b>${stats.played}</b> Jogos</span></div><button class="primary" type="button" data-open-club-profile="${index}">Ver perfil completo</button>`;
    });
    filterCards();
  }

  document.addEventListener('click', event => {
    const open = event.target.closest('[data-open-club-profile]');
    if (open) {
      renderProfile(Number(open.dataset.openClubProfile));
      return;
    }
    if (event.target.closest('[data-edit-club-profile]')) {
      openEditor();
      return;
    }
    if (event.target.closest('[data-share-club-profile]')) {
      shareProfile();
      return;
    }
    if (event.target.closest('[data-remove-profile-banner]')) {
      pendingProfileBanner = '';
      renderBannerPreview();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('#clubProfileEditor')?.classList.contains('show')) closeEditor();
    else closeProfile();
  });

  const style = document.createElement('style');
  style.textContent = `
    .club-profile-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:9px;margin:0 0 12px;padding:11px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}
    .club-profile-toolbar label{display:grid;gap:5px}.club-profile-toolbar label>span{color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.club-profile-toolbar input,.club-profile-toolbar select{min-height:43px;padding-block:10px}
    .club-profile-card{position:relative;overflow:hidden}.club-profile-card:before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,var(--gold-soft),transparent);opacity:.55}.club-profile-card-summary{display:grid;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.club-profile-card-summary>div{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.club-profile-card-summary span{display:grid;gap:3px;padding:7px 5px;border:1px solid var(--line);border-radius:10px;color:var(--muted);background:#ffffff04;font-size:7px;text-align:center;text-transform:uppercase}.club-profile-card-summary span b{color:var(--gold-soft);font-size:13px}.club-profile-card-summary button{width:100%;min-height:39px;font-size:9px}
    .club-profile-modal{display:none;position:fixed;inset:0;z-index:210;overflow:auto;padding:18px;background:rgba(0,0,0,.88);backdrop-filter:blur(15px)}.club-profile-modal.show{display:block}.club-profile-dialog{width:min(1120px,100%);margin:0 auto 30px;overflow:hidden;border:1px solid rgba(245,220,134,.35);border-radius:30px;background:linear-gradient(180deg,#0c2116,#030806);box-shadow:0 40px 120px #000d}.club-profile-open{overflow:hidden}
    .club-profile-hero{--profile-banner:none;position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;align-items:end;gap:20px;min-height:330px;padding:34px;background:linear-gradient(180deg,rgba(2,7,4,.12),rgba(2,7,4,.95)),var(--profile-banner),radial-gradient(circle at 78% 15%,rgba(245,220,134,.32),transparent 26%),linear-gradient(145deg,#23583a,#06100a);background-size:cover;background-position:center}.club-profile-hero:after{content:"BDA";position:absolute;right:-10px;bottom:-55px;color:#fff1;font:900 190px/1 "Barlow Condensed",sans-serif}.club-profile-close{position:absolute;right:18px;top:18px;z-index:4;width:45px;height:45px;padding:0;border:1px solid #ffffff2b;border-radius:14px;color:#fff;background:#020503b8;font-size:26px}.club-profile-identity,.club-profile-hero-actions{position:relative;z-index:2}.club-profile-identity{display:flex;align-items:center;gap:20px;min-width:0}.club-profile-badge{overflow:hidden;display:grid;place-items:center;width:54px;height:54px;flex:0 0 auto;border:2px solid rgba(245,220,134,.52);border-radius:50%;color:#171107;background:linear-gradient(145deg,#f7e29b,#c69a2d);font-weight:900}.club-profile-badge.large{width:145px;height:145px;border-width:4px;font-size:26px;box-shadow:0 22px 60px #0009,0 0 30px rgba(245,220,134,.18)}.club-profile-badge img{width:100%;height:100%;object-fit:cover}.club-profile-identity h1{max-width:690px;margin:7px 0 8px;font-size:clamp(42px,7vw,76px);line-height:.87;text-shadow:0 5px 25px #000}.club-profile-identity p{margin:0;color:#dce7df;font-size:13px;font-style:italic}.club-profile-hero-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.club-profile-hero-actions button{min-height:43px}
    .club-profile-body{display:grid;gap:15px;padding:20px}.club-profile-overview{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:-54px;position:relative;z-index:3}.club-profile-overview article{padding:17px;border:1px solid rgba(245,220,134,.25);border-radius:18px;background:linear-gradient(150deg,rgba(26,64,42,.96),rgba(4,13,8,.98));box-shadow:0 16px 36px #0008}.club-profile-overview span,.club-profile-overview b,.club-profile-overview small{display:block}.club-profile-overview span{color:#a9bbb0;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.club-profile-overview b{margin-top:7px;color:var(--gold-soft);font:900 31px/1 "Barlow Condensed",sans-serif}.club-profile-overview small{margin-top:5px;color:#c9d6ce;font-size:9px}
    .club-profile-columns{display:grid;grid-template-columns:1fr 1fr;gap:15px}.club-profile-panel{padding:18px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(150deg,var(--surface-2),var(--surface));box-shadow:0 14px 34px #0004}.club-profile-section-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:13px}.club-profile-section-head span{color:var(--gold-soft);font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.club-profile-section-head h2{margin:4px 0 0;font-size:25px;text-transform:uppercase}.club-profile-section-head>small{color:var(--muted);font-size:9px}.club-profile-about>p{margin:0 0 14px;color:#c7d4cc;font-size:11px;line-height:1.65}.club-profile-about dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}.club-profile-about dl>div{padding:10px;border:1px solid var(--line);border-radius:12px;background:#ffffff04}.club-profile-about dt{color:var(--muted);font-size:7px;font-weight:900;text-transform:uppercase}.club-profile-about dd{margin:5px 0 0;color:#edf4ef;font-size:10px;font-weight:700}
    .club-profile-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.club-profile-stat-grid div{padding:12px;border:1px solid var(--line);border-radius:13px;background:#ffffff04;text-align:center}.club-profile-stat-grid b,.club-profile-stat-grid span{display:block}.club-profile-stat-grid b{color:var(--gold-soft);font-size:23px}.club-profile-stat-grid span{margin-top:4px;color:var(--muted);font-size:7px;text-transform:uppercase}.club-profile-form{display:flex;gap:4px}.club-profile-form i{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;color:#fff;font-size:8px;font-style:normal;font-weight:900}.club-profile-form i[data-result=V]{background:#168b50}.club-profile-form i[data-result=E]{background:#836e25}.club-profile-form i[data-result=D]{background:#9e2d3d}.club-profile-form span{color:var(--muted);font-size:8px}.club-profile-progress{margin-top:13px}.club-profile-progress>span{display:block;overflow:hidden;height:8px;border-radius:999px;background:#020503}.club-profile-progress>span>b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--green),var(--gold-soft))}.club-profile-progress small{display:block;margin-top:7px;color:var(--muted);font-size:8px}
    .club-profile-matches{display:grid;gap:7px}.club-profile-match{display:grid;grid-template-columns:42px 1fr;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:13px;background:#ffffff035}.club-profile-result{display:grid;place-items:center;width:39px;height:39px;border-radius:12px;color:#fff;font-size:11px;font-weight:900}.club-profile-match[data-result=V] .club-profile-result{background:#168b50}.club-profile-match[data-result=E] .club-profile-result{background:#836e25}.club-profile-match[data-result=D] .club-profile-result{background:#9e2d3d}.club-profile-match small,.club-profile-match b,.club-profile-match em{display:block}.club-profile-match small{color:var(--gold-soft);font-size:7px;text-transform:uppercase}.club-profile-match b{margin-top:4px;color:#edf4ef;font-size:10px}.club-profile-match b strong{color:var(--gold-soft);font-size:13px}.club-profile-match em{margin-top:4px;color:var(--muted);font-size:7px;font-style:normal}
    .club-profile-titles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.club-profile-title-card{overflow:hidden;min-height:150px;border:1px solid var(--line);border-radius:16px;background:#06100a}.club-profile-title-card>img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.club-profile-title-card>span{display:grid;place-items:center;min-height:92px;font-size:42px;background:radial-gradient(circle,#f5dc8633,transparent 60%)}.club-profile-title-card>div{padding:10px}.club-profile-title-card small,.club-profile-title-card b{display:block}.club-profile-title-card small{color:var(--gold-soft);font-size:7px;text-transform:uppercase}.club-profile-title-card b{margin-top:4px;font-size:14px;text-transform:uppercase}.club-profile-title-card p{margin:7px 0 0;color:var(--muted);font-size:8px;line-height:1.4}.club-profile-competitions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.club-profile-competitions span{padding:7px 9px;border:1px solid var(--line);border-radius:999px;color:#cbd8d0;background:#ffffff04;font-size:8px}.club-profile-empty{grid-column:1/-1;padding:22px;border:1px dashed var(--line-strong);border-radius:15px;color:var(--muted);font-size:10px;text-align:center}
    .club-profile-editor{z-index:225!important}.club-profile-editor-dialog{width:min(760px,100%)}.club-profile-editor-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.club-profile-editor-head h2{margin:5px 0 10px}.club-profile-editor-head>button{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;color:#fff;background:#ffffff08;font-size:24px}.club-profile-banner-preview{display:grid;grid-template-columns:180px 1fr auto;align-items:center;gap:10px;margin-top:7px;padding:9px;border:1px solid var(--line);border-radius:14px;background:#03080670}.club-profile-banner-preview img,.club-profile-banner-preview>div{display:block;width:180px;aspect-ratio:16/7;object-fit:cover;border-radius:10px;background:#020503}.club-profile-banner-preview>div{display:grid;place-items:center;color:var(--gold-soft);font-size:10px}.club-profile-banner-preview span{color:var(--muted);font-size:8px;line-height:1.4}.club-profile-banner-preview button{min-height:36px;padding-inline:10px;font-size:8px}
    @media(max-width:780px){.club-profile-toolbar{grid-template-columns:1fr}.club-profile-hero{grid-template-columns:1fr;align-items:end;padding:24px 18px;min-height:380px}.club-profile-identity{display:grid;gap:12px}.club-profile-badge.large{width:112px;height:112px}.club-profile-hero-actions{justify-content:flex-start}.club-profile-overview{grid-template-columns:repeat(2,1fr);margin-top:-40px}.club-profile-columns{grid-template-columns:1fr}.club-profile-titles{grid-template-columns:1fr 1fr}.club-profile-banner-preview{grid-template-columns:120px 1fr}.club-profile-banner-preview img,.club-profile-banner-preview>div{width:120px}.club-profile-banner-preview button{grid-column:1/-1;width:100%}}
    @media(max-width:480px){.club-profile-modal{padding:6px}.club-profile-dialog{border-radius:22px}.club-profile-body{padding:10px}.club-profile-hero{padding:22px 14px;min-height:390px}.club-profile-identity h1{font-size:44px}.club-profile-overview{gap:6px}.club-profile-overview article{padding:12px}.club-profile-about dl{grid-template-columns:1fr}.club-profile-stat-grid{grid-template-columns:repeat(2,1fr)}.club-profile-titles{grid-template-columns:1fr}.club-profile-section-head{align-items:start}.club-profile-match{grid-template-columns:35px 1fr;padding:8px}.club-profile-result{width:33px;height:33px}.club-profile-banner-preview{grid-template-columns:1fr}.club-profile-banner-preview img,.club-profile-banner-preview>div{width:100%}}
  `;
  document.head.append(style);

  if (typeof window.renderTeams === 'function') {
    const previousRenderTeams = window.renderTeams;
    window.renderTeams = function renderTeamsWithProfiles(...args) {
      const result = previousRenderTeams.apply(this, args);
      requestAnimationFrame(decorateCards);
      return result;
    };
  }

  window.ArenaDOMEvents.subscribe(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(decorateCards, 45);
  }, { selector: '.team-card,.club-card,[data-team]' });
  decorateCards();

  window.ArenaBDAClubProfiles = {
    open(name) {
      const index = teamList().findIndex(team => norm(team.name) === norm(name));
      if (index >= 0) renderProfile(index);
    },
    refresh: decorateCards
  };
})();
