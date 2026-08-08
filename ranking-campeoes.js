(() => {
  'use strict';

  const STORAGE_KEY = 'bda-champion-ranking';
  const DEFAULT_RANKING = Object.freeze([
    {
      club: 'Flamestre',
      aliases: ['Flamestre BDA', 'Flamestre FC', 'Flamestre DF'],
      titles: 6,
      achievements: [
        ['Liga A', '1ª Ed'],
        ['', '3ª e 6ª Ed'],
        ['', '1ª e 3ª Ed'],
        ['', '4ª Ed']
      ]
    },
    {
      club: 'Internacional',
      aliases: ['Internacional BDA', 'Inter BDA', 'Inter Brasil BDA'],
      titles: 5,
      achievements: [
        ['Liga A', '2ª Ed'],
        ['', '5ª Ed'],
        ['', '4ª Ed'],
        ['', '1ª e 3ª Ed']
      ]
    },
    {
      club: 'Zombie FC BDA',
      aliases: [],
      titles: 2,
      achievements: [
        ['', '8ª Ed'],
        ['', '5ª Ed']
      ]
    },
    {
      club: 'Bahia City BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '1ª Ed']]
    },
    {
      club: 'Leeds United BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '2ª Ed']]
    },
    {
      club: 'Barcelona City BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '4ª Ed']]
    },
    {
      club: 'Santos RB BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '7ª Ed']]
    },
    {
      club: 'Vasco BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '2ª Ed']]
    },
    {
      club: 'AC Milan BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '2ª Ed']]
    },
    {
      club: 'Hellyeah BDA',
      aliases: [],
      titles: 1,
      achievements: [['', '5ª Ed']]
    }
  ]);
  let rankingEntries;
  let editingEntryIndex = null;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const clone = value => JSON.parse(JSON.stringify(value));

  function normalizeCompetition(value) {
    const competition = String(value || '').trim();
    return /^Imagem\s+[234]$/i.test(competition) ? '' : competition;
  }

  function normalizeEntry(entry, index = 0) {
    const titles = Math.max(0, Number(entry?.titles) || 0);
    return {
      id: String(entry?.id || `ranking-${index + 1}`),
      club: String(entry?.club || '').trim(),
      aliases: Array.isArray(entry?.aliases) ? entry.aliases.map(String).filter(Boolean) : [],
      titles,
      achievements: Array.isArray(entry?.achievements)
        ? entry.achievements
          .map(item => [normalizeCompetition(item?.[0]), String(item?.[1] || '').trim()])
          .filter(item => item[0] || item[1])
        : []
    };
  }

  function sortRanking(entries) {
    return entries
      .map(normalizeEntry)
      .filter(entry => entry.club)
      .sort((a, b) => b.titles - a.titles || a.club.localeCompare(b.club, 'pt-BR'));
  }

  function loadRanking() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(stored)) return sortRanking(stored);
    } catch {}
    return sortRanking(clone(DEFAULT_RANKING));
  }

  rankingEntries = loadRanking();

  function persistRanking(previousValue) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rankingEntries));
      return true;
    } catch {
      rankingEntries = previousValue;
      render();
      toast('Não foi possível salvar a lista de campeões neste navegador');
      return false;
    }
  }

  function titleLabel(amount) {
    return `${amount} ${amount === 1 ? 'título' : 'títulos'}`;
  }

  function editionText(achievements) {
    return achievements.map(([competition, editions]) => {
      const legacyEdition = /(?:\d|ed(?:i(?:ç|c)[aã]o)?)/i.test(competition) ? competition : '';
      return String(editions || legacyEdition).replace(/^\((.+)\)$/, '$1').trim();
    }).filter(Boolean).join(' · ');
  }

  function clubKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function clubTokens(value) {
    return clubKey(value).split(' ').filter(token => token && !['bda', 'fc', 'df', 'da', 'de', 'do'].includes(token));
  }

  function sameClub(left, right) {
    const leftTokens = clubTokens(left);
    const rightTokens = clubTokens(right);
    if (!leftTokens.length || !rightTokens.length) return false;
    const leftSorted = [...leftTokens].sort().join(' ');
    const rightSorted = [...rightTokens].sort().join(' ');
    if (leftSorted === rightSorted) return true;
    if (leftTokens.length === 1) return rightTokens.includes(leftTokens[0]);
    if (rightTokens.length === 1) return leftTokens.includes(rightTokens[0]);
    return false;
  }

  function findChampionTeam(champion) {
    if (typeof teams === 'undefined' || !Array.isArray(teams)) return null;
    const names = [champion.club, ...champion.aliases];
    return teams.find(team => names.some(name => clubKey(name) === clubKey(team?.name)))
      || teams.find(team => names.some(name => sameClub(name, team?.name)))
      || null;
  }

  function initials(value, code = '') {
    return String(code || value || 'BDA')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }

  function shieldMarkup(champion) {
    const team = findChampionTeam(champion);
    const label = `Escudo de ${champion.club}`;
    return team?.badge
      ? `<span class="champion-club-shield has-image" role="img" aria-label="${escapeHtml(label)}"><img src="${escapeHtml(team.badge)}" alt=""></span>`
      : `<span class="champion-club-shield" role="img" aria-label="${escapeHtml(label)}"><b>${escapeHtml(initials(champion.club, team?.code))}</b></span>`;
  }

  function rankingRow(champion, index) {
    const editions = editionText(champion.achievements) || 'Edições não informadas';

    return `
      <article class="champion-ranking-row champion-club-card" role="listitem" style="--champion-order:${index}" aria-label="${escapeHtml(`${champion.club}, ${titleLabel(champion.titles)}, ${editions}`)}">
        ${shieldMarkup(champion)}
        <div class="champion-ranking-club">
          <h3>${escapeHtml(champion.club)}</h3>
          <div class="champion-club-titles"><strong>${champion.titles}</strong><span>${champion.titles === 1 ? 'título' : 'títulos'}</span></div>
          <div class="champion-club-editions"><span>Edições conquistadas</span><p>${escapeHtml(editions)}</p></div>
        </div>
      </article>
    `;
  }

  function installStyles() {
    if (document.getElementById('championRankingStyles')) return;

    const styles = document.createElement('style');
    styles.id = 'championRankingStyles';
    styles.textContent = `
      .champion-ranking{position:relative;overflow:hidden;margin:10px 0 28px;padding:clamp(17px,4vw,28px);border:1px solid var(--line-strong);border-radius:28px;background:radial-gradient(circle at 88% 5%,rgba(242,215,125,.15),transparent 27%),linear-gradient(145deg,rgba(19,43,29,.96),rgba(5,12,8,.96));box-shadow:var(--shadow)}
      .champion-ranking:after{content:'★';position:absolute;right:-15px;top:-62px;color:var(--gold-soft);font-size:190px;opacity:.04;transform:rotate(11deg);pointer-events:none}
      .champion-ranking-header,.champion-ranking-list{position:relative;z-index:1}
      .champion-ranking-header{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px;padding-bottom:17px;border-bottom:1px solid var(--line)}
      .champion-ranking-header h2{margin:5px 0 4px;font-size:clamp(31px,6vw,48px);line-height:.9;text-transform:uppercase}
      .champion-ranking-header p{max-width:650px;margin:0;color:#cad6ce;font-size:11px;line-height:1.5}
      .champion-ranking-edit{flex:0 0 auto;min-height:39px!important}
      .champion-ranking-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
      .champion-club-card{position:relative;overflow:hidden;display:grid;grid-template-columns:84px minmax(0,1fr);align-items:center;gap:14px;min-height:152px;padding:16px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));animation:championCardReveal .48s cubic-bezier(.2,.75,.25,1) both;animation-delay:calc(var(--champion-order)*45ms);transition:transform .22s ease,border-color .22s ease,background .22s ease}
      .champion-club-card:after{content:'';position:absolute;inset:auto -30% -75% 35%;height:130px;background:radial-gradient(circle,rgba(216,178,72,.14),transparent 67%);pointer-events:none}
      .champion-club-card:hover{transform:translateY(-3px);border-color:rgba(242,215,125,.38);background:linear-gradient(145deg,rgba(216,178,72,.075),rgba(255,255,255,.022))}
      .champion-club-shield{position:relative;isolation:isolate;display:grid;place-items:center;width:76px;height:88px;color:#191306;background:linear-gradient(150deg,#fff0aa 0%,var(--gold) 58%,#73560d 100%);clip-path:polygon(50% 0,91% 13%,87% 68%,50% 100%,13% 68%,9% 13%);filter:drop-shadow(0 11px 12px rgba(0,0,0,.36));animation:championShieldFloat 4s ease-in-out infinite;animation-delay:calc(var(--champion-order)*-180ms)}
      .champion-club-shield:before{content:'';position:absolute;z-index:1;inset:-35% -70%;background:linear-gradient(110deg,transparent 38%,rgba(255,255,255,.48) 49%,transparent 60%);transform:translateX(-48%) rotate(7deg);animation:championShieldShine 5.4s ease-in-out infinite}
      .champion-club-shield:after{content:'';position:absolute;z-index:2;inset:5px;clip-path:inherit;border:1px solid rgba(255,255,255,.3)}
      .champion-club-shield img{position:absolute;z-index:0;inset:0;width:100%;height:100%;object-fit:cover}
      .champion-club-shield b{position:relative;z-index:3;font:900 19px/1 'Barlow Condensed',sans-serif;letter-spacing:.04em}
      .champion-ranking-club{position:relative;z-index:1;min-width:0}
      .champion-ranking-club h3{margin:0 0 9px;font-size:22px;line-height:1;text-transform:uppercase}
      .champion-club-titles{display:inline-flex;align-items:baseline;gap:5px;padding:5px 9px;border:1px solid rgba(242,215,125,.23);border-radius:999px;background:rgba(216,178,72,.08)}
      .champion-club-titles strong{color:var(--gold-soft);font:900 21px/1 'Barlow Condensed',sans-serif}
      .champion-club-titles span{color:#d7e0da;font-size:7px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .champion-club-editions{margin-top:10px}.champion-club-editions>span{display:block;color:var(--muted);font-size:6.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.champion-club-editions p{margin:4px 0 0;color:#e1e7e3;font-size:8px;line-height:1.45}
      .champion-banner-section-head{margin-top:32px;padding:0 4px}.champion-banner-section-head h2{font-size:clamp(25px,4vw,34px)}
      @keyframes championCardReveal{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}
      @keyframes championShieldFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-5px) rotate(1deg)}}
      @keyframes championShieldShine{0%,58%{transform:translateX(-48%) rotate(7deg)}78%,100%{transform:translateX(48%) rotate(7deg)}}
      .champion-ranking-editor-modal{width:min(100%,720px)}
      .champion-ranking-editor-head{display:flex;align-items:start;justify-content:space-between;gap:14px;margin-bottom:14px}
      .champion-ranking-editor-head h2{margin:0}.champion-ranking-editor-head p{margin:5px 0 0}
      .champion-ranking-editor-list{display:grid;gap:7px;max-height:48vh;overflow:auto;margin-top:12px;padding-right:3px}
      .champion-ranking-editor-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03)}
      .champion-ranking-editor-item .champion-club-shield{width:40px;height:46px;animation:none;filter:drop-shadow(0 5px 6px rgba(0,0,0,.25))}.champion-ranking-editor-item .champion-club-shield b{font-size:12px}
      .champion-ranking-editor-item b,.champion-ranking-editor-item small{display:block}.champion-ranking-editor-item b{font-size:10px;text-transform:uppercase}.champion-ranking-editor-item small{margin-top:3px;color:var(--muted);font-size:7px}
      .champion-ranking-editor-item button{min-height:35px;padding:0 10px;font-size:8px}
      .champion-ranking-editor-toolbar{display:flex;justify-content:space-between;gap:8px}
      .champion-ranking-editor-form[hidden],.champion-ranking-editor-list-view[hidden]{display:none!important}
      .champion-ranking-editor-help{display:block;margin-top:5px;color:var(--muted);font-size:7px;line-height:1.45;text-transform:none;letter-spacing:0}
      .champion-ranking-editor-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.champion-ranking-editor-actions .primary{margin-left:auto}
      @media(max-width:760px){
        .champion-ranking-header{align-items:start}
        .champion-ranking-list{grid-template-columns:1fr}
      }
      @media(max-width:520px){
        .champion-ranking{padding:15px;border-radius:22px}
        .champion-ranking-header{display:grid;gap:12px}.champion-ranking-edit{justify-self:start}
        .champion-club-card{grid-template-columns:69px minmax(0,1fr);min-height:137px;padding:13px;gap:11px}
        .champion-club-shield{width:64px;height:74px}
        .champion-ranking-club h3{font-size:18px}
        .champion-club-editions p{font-size:7.5px}
      }
      @media(prefers-reduced-motion:reduce){.champion-club-card,.champion-club-shield,.champion-club-shield:before{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(styles);
  }

  function buildEditor() {
    if (document.getElementById('championRankingEditorModal')) return;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'championRankingEditorModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'championRankingEditorTitle');
    modal.innerHTML = `
      <div class="modal champion-ranking-editor-modal">
        <header class="champion-ranking-editor-head">
          <div>
            <h2 id="championRankingEditorTitle">Editar campeões</h2>
            <p>Gerencie clubes, quantidade de títulos e edições conquistadas.</p>
          </div>
          <button class="secondary" type="button" data-close="championRankingEditorModal" aria-label="Fechar">Fechar</button>
        </header>
        <section class="champion-ranking-editor-list-view" id="championRankingEditorListView">
          <div class="champion-ranking-editor-toolbar">
            <span class="eyebrow">Clubes campeões</span>
            <button class="primary" id="championRankingAddBtn" type="button">+ Adicionar clube</button>
          </div>
          <div class="champion-ranking-editor-list" id="championRankingEditorList"></div>
        </section>
        <form class="champion-ranking-editor-form" id="championRankingEditorForm" hidden>
          <div class="form-grid two">
            <label>Clube<input id="rankingClub" maxlength="60" required placeholder="Nome oficial"></label>
            <label>Títulos<input id="rankingTitles" type="number" min="0" max="999" required></label>
            <label style="grid-column:1/-1">Nomes alternativos<input id="rankingAliases" maxlength="240" placeholder="Nome BDA, nome FC, outro nome"><small class="champion-ranking-editor-help">Separe os nomes por vírgula.</small></label>
            <label style="grid-column:1/-1">Edições conquistadas<textarea id="rankingAchievements" required placeholder="1ª Ed\n3ª e 6ª Ed"></textarea><small class="champion-ranking-editor-help">Informe uma edição ou grupo de edições por linha.</small></label>
          </div>
          <div class="champion-ranking-editor-actions">
            <button class="danger" id="championRankingDeleteBtn" type="button">Excluir da lista</button>
            <button class="secondary" id="championRankingBackBtn" type="button">Voltar</button>
            <button class="primary" type="submit">Salvar alterações</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('championRankingAddBtn').addEventListener('click', () => openEntryForm());
    document.getElementById('championRankingBackBtn').addEventListener('click', showEditorList);
    document.getElementById('championRankingDeleteBtn').addEventListener('click', deleteCurrentEntry);
    document.getElementById('championRankingEditorForm').addEventListener('submit', submitEntry);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal('championRankingEditorModal');
    });
  }

  function achievementLines(achievements) {
    return achievements.map(([competition, editions]) => editions || competition).filter(Boolean).join('\n');
  }

  function parseAliases(value) {
    return String(value || '').split(/[,\n]/).map(item => item.trim()).filter(Boolean);
  }

  function parseAchievements(value) {
    return String(value || '').split('\n').map(rawLine => {
      const line = rawLine.trim();
      const editionOnly = line.match(/^\((.+)\)$/);
      if (editionOnly) return ['', editionOnly[1].trim()];
      if (!line.includes('|')) return ['', line];
      const [competition, ...editionParts] = line.split('|');
      return [normalizeCompetition(competition), editionParts.join('|').trim()];
    }).filter(item => item[0] || item[1]);
  }

  function renderEditorList() {
    const list = document.getElementById('championRankingEditorList');
    if (!list) return;
    list.innerHTML = rankingEntries.length
      ? rankingEntries.map((entry, index) => `
        <article class="champion-ranking-editor-item">
          ${shieldMarkup(entry)}
          <div><b>${escapeHtml(entry.club)}</b><small>${titleLabel(entry.titles)} · ${escapeHtml(editionText(entry.achievements) || 'Edições não informadas')}</small></div>
          <button class="ghost" type="button" data-ranking-entry="${index}">Editar</button>
        </article>
      `).join('')
      : '<div class="empty">Nenhum campeão cadastrado.</div>';
  }

  function showEditorList() {
    editingEntryIndex = null;
    document.getElementById('championRankingEditorForm').hidden = true;
    document.getElementById('championRankingEditorListView').hidden = false;
    renderEditorList();
  }

  function openEditor() {
    if (!isAdmin) return;
    showEditorList();
    openModal('championRankingEditorModal');
  }

  function openEntryForm(index = null) {
    if (!isAdmin) return;
    const form = document.getElementById('championRankingEditorForm');
    const entry = Number.isInteger(index) ? rankingEntries[index] : null;
    editingEntryIndex = entry ? index : null;
    form.reset();
    document.getElementById('rankingClub').value = entry?.club || '';
    document.getElementById('rankingAliases').value = entry?.aliases?.join(', ') || '';
    document.getElementById('rankingTitles').value = entry?.titles ?? 0;
    document.getElementById('rankingAchievements').value = achievementLines(entry?.achievements || []);
    document.getElementById('championRankingDeleteBtn').hidden = !entry;
    document.getElementById('championRankingEditorListView').hidden = true;
    form.hidden = false;
    document.getElementById('rankingClub').focus();
  }

  function submitEntry(event) {
    event.preventDefault();
    if (!isAdmin) return;

    const club = document.getElementById('rankingClub').value.trim();
    const achievements = parseAchievements(document.getElementById('rankingAchievements').value);
    if (!club || !achievements.length) return;

    const previousValue = clone(rankingEntries);
    const current = Number.isInteger(editingEntryIndex) ? rankingEntries[editingEntryIndex] : null;
    const entry = normalizeEntry({
      ...(current || {}),
      id: current?.id || `ranking-${Date.now().toString(36)}`,
      club,
      aliases: parseAliases(document.getElementById('rankingAliases').value),
      titles: document.getElementById('rankingTitles').value,
      achievements
    });

    if (current) rankingEntries[editingEntryIndex] = entry;
    else rankingEntries.push(entry);
    rankingEntries = sortRanking(rankingEntries);
    if (!persistRanking(previousValue)) return;

    render();
    showEditorList();
    toast(current ? 'Campeão atualizado' : 'Clube adicionado aos campeões');
  }

  function deleteCurrentEntry() {
    if (!isAdmin || !Number.isInteger(editingEntryIndex)) return;
    const entry = rankingEntries[editingEntryIndex];
    if (!entry || !confirm(`Excluir ${entry.club} da lista de campeões?`)) return;
    const previousValue = clone(rankingEntries);
    rankingEntries.splice(editingEntryIndex, 1);
    if (!persistRanking(previousValue)) return;
    render();
    showEditorList();
    toast('Clube removido dos campeões');
  }

  function updateAdminControls() {
    const editButton = document.getElementById('editChampionRankingBtn');
    if (editButton) editButton.hidden = !isAdmin;
    if (!isAdmin) closeModal('championRankingEditorModal');
  }

  function render() {
    const page = document.querySelector('[data-page="champions"]');
    const championGrid = document.getElementById('championGrid');
    if (!page || !championGrid) return false;

    installStyles();

    let ranking = document.getElementById('championRanking');
    if (!ranking) {
      ranking = document.createElement('section');
      ranking.id = 'championRanking';
      ranking.className = 'champion-ranking';
      ranking.setAttribute('aria-labelledby', 'championRankingTitle');
      page.insertBefore(ranking, championGrid);
    }

    const bannerHeader = document.getElementById('addChampionBtn')?.closest('.section-head');
    if (bannerHeader) {
      bannerHeader.hidden = false;
      bannerHeader.classList.remove('champion-ranking-legacy-hidden');
      bannerHeader.classList.add('champion-banner-section-head');
      const eyebrow = bannerHeader.querySelector('.eyebrow');
      const heading = bannerHeader.querySelector('h2');
      const description = bannerHeader.querySelector('p');
      const addButton = bannerHeader.querySelector('#addChampionBtn');
      if (eyebrow) eyebrow.textContent = 'Memória visual BDA';
      if (heading) heading.textContent = 'Banners dos campeões';
      if (description) description.textContent = 'Artes oficiais dos títulos conquistados na Arena BDA.';
      if (addButton) addButton.textContent = 'Adicionar banner';
      page.insertBefore(bannerHeader, championGrid);
    }
    championGrid.hidden = false;
    championGrid.classList.remove('champion-ranking-legacy-hidden');
    championGrid.setAttribute('aria-label', 'Banners dos campeões');

    ranking.innerHTML = `
      <header class="champion-ranking-header">
        <div>
          <span class="eyebrow">Hall da fama BDA</span>
          <h2 id="championRankingTitle">Campeões e Títulos</h2>
          <p>Clubes campeões, quantidade de títulos e edições conquistadas.</p>
        </div>
        <button class="primary champion-ranking-edit" id="editChampionRankingBtn" type="button" ${isAdmin ? '' : 'hidden'}>Editar campeões</button>
      </header>
      <div class="champion-ranking-list" role="list" aria-label="Clubes campeões e títulos">
        ${rankingEntries.length ? rankingEntries.map((champion, index) => rankingRow(champion, index)).join('') : '<div class="empty">Nenhum campeão cadastrado.</div>'}
      </div>
    `;

    return true;
  }

  document.addEventListener('click', event => {
    const openButton = event.target.closest('#editChampionRankingBtn');
    if (openButton) {
      openEditor();
      return;
    }

    const entryButton = event.target.closest('[data-ranking-entry]');
    if (entryButton) openEntryForm(Number(entryButton.dataset.rankingEntry));
  });

  if (typeof updateAdminUI === 'function') {
    const previousUpdateAdminUI = updateAdminUI;
    updateAdminUI = function updateAdminUIWithChampionRanking() {
      previousUpdateAdminUI();
      updateAdminControls();
    };
  }

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) rankingEntries = loadRanking();
    const teamStorageKey = typeof STORAGE !== 'undefined' ? STORAGE.teams : 'bda-v2-teams';
    if ([STORAGE_KEY, teamStorageKey].includes(event.key)) render();
  });

  window.addEventListener('arena:team-profile-updated', render);
  window.addEventListener('arena:cloud-ready', () => window.setTimeout(render, 250));

  const teamGrid = document.getElementById('teamGrid');
  if (teamGrid) new MutationObserver(render).observe(teamGrid, { childList: true, subtree: true });

  window.ArenaBDAChampionRanking = Object.freeze({
    get champions() { return clone(rankingEntries); },
    render,
    openEditor
  });

  buildEditor();
  render();
  updateAdminControls();
})();
