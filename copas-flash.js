(() => {
  'use strict';

  const STORAGE_KEY = 'bda-v3-flash-cups';
  const DRAW_BACKUP_KEY = 'bda-v3-flash-draw-backup';
  const CLOUD_DOC = 'copas-flash';
  const PHASES = ['Preliminar', '16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

  let editions = loadEditions();
  let selectedId = editions[0]?.id || '';
  let editingId = '';
  let draftMatches = [];
  let drawEditionId = '';
  let drawPreview = null;
  let db = null;
  let unsubscribe = null;
  let cloudTimer = 0;
  let cloudPending = false;

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
  const slug = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `flash-${Date.now()}`;
  const hasScore = value => value !== '' && value != null && !Number.isNaN(Number(value));
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);

  function adminActive() {
    if (window.ArenaBDAAuth?.isAdmin) return window.ArenaBDAAuth.isAdmin();
    return Boolean($('#adminBtn')?.classList.contains('active'));
  }

  function currentEmail() {
    if (window.ArenaBDAAuth?.currentEmail) return window.ArenaBDAAuth.currentEmail();
    return String(window.firebase?.auth?.()?.currentUser?.email || '').toLowerCase();
  }

  function uniqueNames(values) {
    const names = new Map();
    values.forEach(value => {
      const name = String(value || '').trim();
      const key = norm(name);
      if (key && !names.has(key)) names.set(key, name);
    });
    return [...names.values()];
  }

  function shapeMatch(match, index = 0) {
    return {
      id: String(match?.id || `flash-jogo-${Date.now().toString(36)}-${index}`),
      phase: PHASES.includes(match?.phase) ? match.phase : 'Final',
      teamA: String(match?.teamA || '').trim(),
      teamB: String(match?.teamB || '').trim(),
      scoreA: hasScore(match?.scoreA) ? Number(match.scoreA) : '',
      scoreB: hasScore(match?.scoreB) ? Number(match.scoreB) : '',
      penaltiesA: hasScore(match?.penaltiesA) ? Number(match.penaltiesA) : '',
      penaltiesB: hasScore(match?.penaltiesB) ? Number(match.penaltiesB) : '',
      status: String(match?.status || 'Finalizado')
    };
  }

  function shapeEdition(edition, index = 0) {
    const matches = Array.isArray(edition?.matches) ? edition.matches.map(shapeMatch) : [];
    const participants = uniqueNames([
      ...(Array.isArray(edition?.participants) ? edition.participants : []),
      ...matches.flatMap(match => [match.teamA, match.teamB]),
      edition?.champion,
      edition?.runnerUp
    ]);
    return {
      id: String(edition?.id || `copa-flash-${Date.now().toString(36)}-${index}`),
      name: String(edition?.name || `${index + 1}ª Copa Flash`).trim(),
      date: String(edition?.date || ''),
      status: ['Planejada', 'Em andamento', 'Finalizada'].includes(edition?.status) ? edition.status : 'Finalizada',
      champion: String(edition?.champion || '').trim(),
      runnerUp: String(edition?.runnerUp || '').trim(),
      participants,
      matches,
      lastDraw: edition?.lastDraw && typeof edition.lastDraw === 'object' ? {
        seed: String(edition.lastDraw.seed || ''),
        phase: String(edition.lastDraw.phase || ''),
        nextPhase: String(edition.lastDraw.nextPhase || ''),
        participants: uniqueNames(edition.lastDraw.participants || []),
        byes: uniqueNames(edition.lastDraw.byes || []),
        drawnAt: Number(edition.lastDraw.drawnAt) || 0
      } : null,
      createdAt: Number(edition?.createdAt) || Date.now() + index,
      updatedAt: Number(edition?.updatedAt) || Date.now() + index
    };
  }

  function loadEditions() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.map(shapeEdition) : [];
    } catch {
      return [];
    }
  }

  function persist(sync = true) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(editions));
    window.dispatchEvent(new CustomEvent('arena:flash-updated', { detail: { editions: editions.length } }));
    render();
    if (sync) queueCloudSave();
  }

  function newestUpdate(list = editions) {
    return Math.max(0, ...list.map(item => Number(item?.updatedAt) || 0));
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stable(value[key]);
        return result;
      }, {});
    }
    return value;
  }

  function sameData(a, b) {
    return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  }

  function cloudStatus(text, state = '') {
    const element = $('#flashCloud');
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
  }

  function connectCloud() {
    if (unsubscribe || !window.firebase || typeof firebase.firestore !== 'function') return;
    db = firebase.firestore();
    unsubscribe = db.collection('arenaData').doc(CLOUD_DOC).onSnapshot(snapshot => {
      const remote = snapshot.data()?.editions;
      if (cloudPending || !Array.isArray(remote)) return;
      const normalized = remote.map(shapeEdition);
      if (sameData(normalized, editions) || newestUpdate(normalized) < newestUpdate(editions)) return;
      editions = normalized;
      selectedId = editions.some(item => item.id === selectedId) ? selectedId : editions[0]?.id || '';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editions));
      render();
      cloudStatus('Sincronizado', 'ok');
    }, error => {
      console.error(error);
      cloudStatus('Modo local', 'error');
    });
  }

  function queueCloudSave() {
    clearTimeout(cloudTimer);
    if (!db || !adminActive()) {
      cloudStatus('Salvo neste aparelho', 'local');
      return;
    }
    cloudPending = true;
    cloudStatus('Salvando...', 'saving');
    cloudTimer = setTimeout(async () => {
      try {
        await db.collection('arenaData').doc(CLOUD_DOC).set({
          dataset: 'copas-flash',
          editions,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: currentEmail()
        });
        cloudStatus('Sincronizado', 'ok');
      } catch (error) {
        console.error(error);
        cloudStatus('Salvo neste aparelho', 'error');
        notify('A Copa Flash foi salva neste aparelho, mas a nuvem não respondeu');
      } finally {
        cloudPending = false;
      }
    }, 650);
  }

  function phaseOrder(phase) {
    const index = PHASES.indexOf(phase);
    return index < 0 ? 99 : index;
  }

  function editionMatches(edition) {
    return [...(edition?.matches || [])].sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase));
  }

  function winner(match) {
    if (!hasScore(match?.scoreA) || !hasScore(match?.scoreB)) return '';
    if (Number(match.scoreA) !== Number(match.scoreB)) return Number(match.scoreA) > Number(match.scoreB) ? 'a' : 'b';
    if (hasScore(match.penaltiesA) && hasScore(match.penaltiesB) && Number(match.penaltiesA) !== Number(match.penaltiesB)) {
      return Number(match.penaltiesA) > Number(match.penaltiesB) ? 'a' : 'b';
    }
    return '';
  }

  function ranking() {
    const table = new Map();
    const get = name => {
      const key = norm(name);
      if (!key) return null;
      if (!table.has(key)) table.set(key, { name: String(name).trim(), editions: 0, titles: 0, runnerUps: 0, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 });
      return table.get(key);
    };

    editions.forEach(edition => {
      uniqueNames(edition.participants || []).forEach(name => { const row = get(name); if (row) row.editions += 1; });
      const champion = get(edition.champion);
      const runnerUp = get(edition.runnerUp);
      if (champion) champion.titles += 1;
      if (runnerUp) runnerUp.runnerUps += 1;

      edition.matches.forEach(match => {
        if (!hasScore(match.scoreA) || !hasScore(match.scoreB)) return;
        const a = get(match.teamA);
        const b = get(match.teamB);
        if (!a || !b) return;
        const scoreA = Number(match.scoreA);
        const scoreB = Number(match.scoreB);
        a.played += 1; b.played += 1;
        a.gf += scoreA; a.ga += scoreB;
        b.gf += scoreB; b.ga += scoreA;
        if (scoreA === scoreB) {
          a.draws += 1; b.draws += 1;
          a.points += 1; b.points += 1;
        } else if (scoreA > scoreB) {
          a.wins += 1; b.losses += 1; a.points += 3;
        } else {
          b.wins += 1; a.losses += 1; b.points += 3;
        }
      });
    });

    return [...table.values()].sort((a, b) =>
      b.titles - a.titles
      || b.runnerUps - a.runnerUps
      || b.points - a.points
      || (b.gf - b.ga) - (a.gf - a.ga)
      || b.gf - a.gf
      || a.name.localeCompare(b.name, 'pt-BR')
    );
  }

  function formatDate(value) {
    if (!value) return 'Data a definir';
    const [year, month, day] = value.split('-');
    return day && month && year ? `${day}/${month}/${year}` : value;
  }

  function importDate(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!match) return '';
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  function parseImport(value) {
    const text = String(value || '').trim();
    if (!text) return { records: [], errors: ['Cole pelo menos uma edição.'], fullBackup: false };

    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        const source = Array.isArray(parsed) ? parsed : parsed?.editions;
        if (!Array.isArray(source)) throw new Error('O backup não contém uma lista de edições');
        return { records: source, errors: [], fullBackup: true };
      } catch (error) {
        return { records: [], errors: [`Backup JSON inválido: ${error.message}`], fullBackup: true };
      }
    }

    const records = [];
    const errors = [];
    text.split(/\r?\n/).forEach((line, index) => {
      const clean = line.trim();
      if (!clean) return;
      const parts = clean.split(clean.includes('|') ? '|' : clean.includes(';') ? ';' : '\t').map(part => part.trim());
      if (norm(parts[0]).includes('edicao') && norm(parts[1]).includes('campe')) return;
      if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
        errors.push(`Linha ${index + 1}: use Edição | Campeão | Vice | Data`);
        return;
      }
      const date = importDate(parts[3]);
      if (parts[3] && !date) errors.push(`Linha ${index + 1}: data ignorada por estar fora do formato DD/MM/AAAA`);
      records.push({
        name: parts[0],
        champion: parts[1],
        runnerUp: parts[2],
        date,
        status: 'Finalizada',
        participants: [parts[1], parts[2]],
        matches: []
      });
    });
    return { records, errors, fullBackup: false };
  }

  function applyImport(records, fullBackup = false) {
    const now = Date.now();
    const additions = [];
    let created = 0;
    let updated = 0;

    records.forEach((record, index) => {
      const existingIndex = editions.findIndex(item =>
        (record?.id && String(item.id) === String(record.id)) || norm(item.name) === norm(record?.name)
      );
      const existing = editions[existingIndex];
      let incoming;
      if (fullBackup) {
        incoming = shapeEdition({ ...record, updatedAt: Number(record?.updatedAt) || now + index }, index);
      } else {
        incoming = shapeEdition({
          ...existing,
          name: record.name,
          champion: record.champion,
          runnerUp: record.runnerUp,
          date: record.date || existing?.date || '',
          status: 'Finalizada',
          participants: uniqueNames([...(existing?.participants || []), record.champion, record.runnerUp]),
          matches: existing?.matches || [],
          updatedAt: now + index
        }, index);
      }

      if (existingIndex >= 0) {
        incoming.id = existing.id;
        incoming.createdAt = existing.createdAt;
        editions[existingIndex] = incoming;
        updated += 1;
      } else {
        additions.push(incoming);
        created += 1;
      }
    });

    if (additions.length) editions = [...additions.reverse(), ...editions];
    selectedId = editions[0]?.id || '';
    persist();
    return { created, updated };
  }

  function exportBackup() {
    const data = JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'arenabda.com.br',
      editions
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `copas-flash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Backup das Copas Flash baixado');
  }

  function editionCard(edition) {
    const active = edition.id === selectedId;
    return `<article class="flash-edition-card ${active ? 'active' : ''}">
      <button type="button" data-flash-select="${esc(edition.id)}">
        <span class="flash-edition-status">${esc(edition.status)}</span>
        <h3>${esc(edition.name)}</h3>
        <p>${esc(formatDate(edition.date))}</p>
        <div><span><b>${edition.participants.length}</b> times</span><span><b>${edition.matches.length}</b> jogos</span></div>
        <strong>${edition.champion ? `🏆 ${esc(edition.champion)}` : 'Campeão a definir'}</strong>
      </button>
      ${adminActive() ? `<footer><button type="button" data-flash-edit="${esc(edition.id)}">Editar</button><button type="button" class="danger" data-flash-delete="${esc(edition.id)}">Excluir</button></footer>` : ''}
    </article>`;
  }

  function matchCard(match) {
    const result = winner(match);
    const penalties = hasScore(match.penaltiesA) && hasScore(match.penaltiesB)
      ? `<small>Pênaltis ${Number(match.penaltiesA)} × ${Number(match.penaltiesB)}</small>`
      : '';
    return `<article class="flash-match">
      <header><span>${esc(match.status)}</span><small>${esc(match.phase)}</small></header>
      <div class="${result === 'a' ? 'winner' : ''}"><span>${esc(match.teamA || 'Time A')}</span><b>${hasScore(match.scoreA) ? Number(match.scoreA) : '–'}</b></div>
      <div class="${result === 'b' ? 'winner' : ''}"><span>${esc(match.teamB || 'Time B')}</span><b>${hasScore(match.scoreB) ? Number(match.scoreB) : '–'}</b></div>
      ${penalties}
    </article>`;
  }

  function bracket(edition) {
    const matches = editionMatches(edition);
    if (!matches.length) return '<div class="flash-empty"><b>Nenhum confronto cadastrado</b><span>Os resultados aparecerão quando as partidas forem adicionadas.</span></div>';
    const groups = new Map();
    matches.forEach(match => {
      if (!groups.has(match.phase)) groups.set(match.phase, []);
      groups.get(match.phase).push(match);
    });
    return `<div class="flash-bracket">${[...groups].map(([phase, list]) => `<section><header><span>${esc(phase)}</span><b>${list.length} ${list.length === 1 ? 'jogo' : 'jogos'}</b></header>${list.map(matchCard).join('')}</section>`).join('')}</div>`;
  }

  function drawRecord(edition) {
    const draw = edition?.lastDraw;
    if (!draw?.seed) return '';
    const byes = draw.byes?.length
      ? `<div><span>Folga para ${esc(draw.nextPhase)}</span>${draw.byes.map(name => `<b>${esc(name)}</b>`).join('')}</div>`
      : '';
    return `<aside class="flash-draw-record"><p><span>Último sorteio</span><strong>${esc(draw.phase)}</strong><code>${esc(draw.seed)}</code></p>${byes}</aside>`;
  }

  function rankingTable() {
    const rows = ranking();
    if (!rows.length) return '<div class="flash-empty compact"><b>Ranking aguardando dados</b><span>Ele será calculado automaticamente.</span></div>';
    return `<div class="flash-ranking-table" role="table" aria-label="Ranking geral das Copas Flash">
      <header role="row"><span>#</span><span>Time</span><span title="Títulos">🏆</span><span title="Vices">🥈</span><span title="Jogos">J</span><span title="Pontos">PTS</span></header>
      ${rows.map((row, index) => `<div role="row" class="${index < 3 ? 'top' : ''}"><b>${index + 1}</b><span><strong>${esc(row.name)}</strong><small>${row.wins}V • ${row.draws}E • ${row.losses}D</small></span><b>${row.titles}</b><b>${row.runnerUps}</b><b>${row.played}</b><b>${row.points}</b></div>`).join('')}
    </div>`;
  }

  function selectedEdition() {
    return editions.find(item => item.id === selectedId) || editions[0] || null;
  }

  function detail(edition) {
    if (!edition) {
      return `<section class="flash-empty flash-empty-main"><span>⚡</span><b>Nenhuma Copa Flash cadastrada</b><p>Crie a primeira edição para registrar times, jogos, campeão e vice.</p>${adminActive() ? '<button type="button" class="primary" data-flash-add>+ Criar primeira edição</button>' : ''}</section>`;
    }
    return `<section class="flash-detail">
      <header class="flash-detail-head"><div><span class="eyebrow">Edição selecionada</span><h2>${esc(edition.name)}</h2><p>${esc(edition.status)} • ${esc(formatDate(edition.date))}</p></div>${adminActive() ? `<div class="flash-detail-actions"><button type="button" class="primary" data-flash-draw="${esc(edition.id)}">🎲 Sortear jogos</button><button type="button" data-flash-edit="${esc(edition.id)}">Editar edição</button></div>` : ''}</header>
      <div class="flash-podium">
        <article><span>Campeão</span><i>🏆</i><strong>${esc(edition.champion || 'A definir')}</strong></article>
        <article><span>Vice-campeão</span><i>🥈</i><strong>${esc(edition.runnerUp || 'A definir')}</strong></article>
      </div>
      <section class="flash-participants"><header><div><span class="eyebrow">Clubes confirmados</span><h3>Times participantes</h3></div><b>${edition.participants.length}</b></header>${edition.participants.length ? `<div>${edition.participants.map((name, index) => `<span><i>${index + 1}</i>${esc(name)}</span>`).join('')}</div>` : '<div class="flash-empty compact"><b>Nenhum participante cadastrado</b></div>'}</section>
      <section class="flash-results"><header><div><span class="eyebrow">Eliminação rápida</span><h3>Chaveamento e resultados</h3></div><b>${edition.matches.length} jogos</b></header>${drawRecord(edition)}${bracket(edition)}</section>
    </section>`;
  }

  function render() {
    const page = $('[data-page="flash"]');
    if (!page) return;
    const selected = selectedEdition();
    if (selected && !selectedId) selectedId = selected.id;
    const table = ranking();
    const games = editions.reduce((total, edition) => total + edition.matches.length, 0);
    const teams = new Set(editions.flatMap(edition => edition.participants.map(norm))).size;
    page.innerHTML = `<section class="flash-hero">
      <div><span class="eyebrow">Competições rápidas BDA</span><h1>Copas Flash</h1><p>Edições curtas, resultados diretos e um ranking construído a cada novo torneio.</p><div class="flash-hero-actions"><span id="flashCloud">${db ? 'Sincronizado' : 'Modo local'}</span>${adminActive() ? '<button type="button" class="primary" data-flash-add>+ Nova Copa Flash</button><button type="button" data-flash-import>Importar histórico</button><button type="button" data-flash-export>Baixar backup</button>' : ''}</div></div>
      <aside><div><b>${editions.length}</b><span>Edições</span></div><div><b>${teams}</b><span>Times</span></div><div><b>${games}</b><span>Jogos</span></div><div><b>${table[0]?.titles || 0}</b><span>Recorde de títulos</span></div></aside>
    </section>
    <section class="flash-editions"><header><div><span class="eyebrow">Arquivo oficial</span><h2>Edições Flash</h2></div><span>Selecione para abrir</span></header>${editions.length ? `<div class="flash-edition-scroll">${editions.map(editionCard).join('')}</div>` : ''}</section>
    <div class="flash-layout"><main>${detail(selected)}</main><aside class="flash-ranking"><header><span class="eyebrow">Desempenho acumulado</span><h2>Ranking geral Flash</h2><p>Títulos, vices e pontos de todas as edições.</p></header>${rankingTable()}</aside></div>`;
  }

  function ensureModal() {
    if ($('#flashEditionModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop flash-modal-backdrop';
    modal.id = 'flashEditionModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<section class="modal flash-modal">
      <header><div><span class="eyebrow">Administração Flash</span><h2 id="flashModalTitle">Nova Copa Flash</h2></div><button type="button" data-flash-close aria-label="Fechar">×</button></header>
      <form id="flashEditionForm">
        <div class="flash-form-grid">
          <label>Nome da edição<input id="flashName" maxlength="55" required placeholder="68ª Copa Flash"></label>
          <label>Data<input id="flashDate" type="date"></label>
          <label>Status<select id="flashStatus"><option>Planejada</option><option>Em andamento</option><option>Finalizada</option></select></label>
          <label>Campeão<input id="flashChampion" maxlength="55" placeholder="Time campeão"></label>
          <label>Vice-campeão<input id="flashRunnerUp" maxlength="55" placeholder="Time vice-campeão"></label>
          <label class="wide">Times participantes<textarea id="flashParticipants" rows="6" placeholder="Um time por linha"></textarea></label>
        </div>
        <section class="flash-match-editor"><header><div><h3>Chaveamento e resultados</h3><p>Adicione as partidas na ordem em que aconteceram.</p></div><button type="button" data-flash-add-match>+ Adicionar jogo</button></header><div id="flashMatchRows"></div></section>
        <footer><button type="button" class="secondary" data-flash-close>Cancelar</button><button type="submit" class="primary">Salvar Copa Flash</button></footer>
      </form>
    </section>`;
    document.body.append(modal);
  }

  function ensureImportModal() {
    if ($('#flashImportModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop flash-modal-backdrop';
    modal.id = 'flashImportModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<section class="modal flash-modal flash-import-modal">
      <header><div><span class="eyebrow">Cadastro em lote</span><h2>Importar histórico</h2></div><button type="button" data-flash-import-close aria-label="Fechar">×</button></header>
      <form id="flashImportForm">
        <div class="flash-import-help"><b>Uma edição por linha</b><code>68ª Copa Flash | Time campeão | Time vice | 03/08/2026</code><p>Também aceita ponto e vírgula, tabulação ou um backup JSON baixado nesta página. Edições com o mesmo nome serão atualizadas sem apagar partidas já cadastradas.</p></div>
        <label class="flash-import-field">Histórico das Copas Flash<textarea id="flashImportText" rows="12" required placeholder="68ª Copa Flash | JOGOBUGADO BDA | Zombie FC BDA | 03/08/2026"></textarea></label>
        <div class="flash-import-preview" id="flashImportPreview">Cole o histórico para validar.</div>
        <footer><button type="button" class="secondary" data-flash-import-close>Cancelar</button><button type="submit" class="primary">Importar edições</button></footer>
      </form>
    </section>`;
    document.body.append(modal);
  }

  function drawBackup() {
    try {
      const value = JSON.parse(localStorage.getItem(DRAW_BACKUP_KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function ensureDrawModal() {
    if ($('#flashDrawModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop flash-modal-backdrop';
    modal.id = 'flashDrawModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'flashDrawTitle');
    modal.innerHTML = `<section class="modal flash-modal flash-draw-modal">
      <header><div><span class="eyebrow">Sorteio oficial</span><h2 id="flashDrawTitle">Sortear jogos</h2></div><button type="button" data-flash-draw-close aria-label="Fechar">×</button></header>
      <div class="flash-draw-body">
        <p class="flash-draw-summary" id="flashDrawSummary"></p>
        <section class="flash-draw-selection">
          <header><div><span class="eyebrow">Participantes</span><h3>Times no sorteio</h3></div><div class="flash-draw-tools"><b id="flashDrawTeamCount">0 selecionados</b><button type="button" data-flash-draw-all>Todos</button><button type="button" data-flash-draw-clear>Limpar</button></div></header>
          <div class="flash-draw-team-grid" id="flashDrawTeams"></div>
        </section>
        <section class="flash-draw-result">
          <header><div><span class="eyebrow">Prévia não publicada</span><h3>Confrontos sorteados</h3></div><button type="button" data-flash-draw-run>🎲 Sortear novamente</button></header>
          <div class="flash-draw-preview" id="flashDrawPreview"></div>
        </section>
      </div>
      <footer class="flash-draw-footer"><button type="button" class="danger" data-flash-draw-restore hidden>Desfazer último sorteio</button><span></span><button type="button" class="secondary" data-flash-draw-close>Cancelar</button><button type="button" class="primary" data-flash-draw-publish disabled>Publicar confrontos</button></footer>
    </section>`;
    document.body.append(modal);
  }

  function activeDrawEdition() {
    return editions.find(item => item.id === drawEditionId) || null;
  }

  function selectedDrawTeams() {
    return $$('#flashDrawTeams input[data-flash-draw-team]:checked').map(input => input.value);
  }

  function updateDrawTeamCount() {
    const count = selectedDrawTeams().length;
    const label = $('#flashDrawTeamCount');
    if (label) label.textContent = `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`;
  }

  function renderDrawTeams(edition) {
    const root = $('#flashDrawTeams');
    if (!root) return;
    root.innerHTML = edition.participants.map((name, index) => `<label><input type="checkbox" data-flash-draw-team value="${esc(name)}" checked><span><i>${index + 1}</i>${esc(name)}</span></label>`).join('');
    updateDrawTeamCount();
  }

  function renderDrawPreview() {
    const root = $('#flashDrawPreview');
    const publish = $('[data-flash-draw-publish]');
    if (!root || !publish) return;
    publish.disabled = !drawPreview;
    if (!drawPreview) {
      root.innerHTML = '<div class="flash-draw-empty"><b>Selecione pelo menos 2 times</b><span>O sorteio será exibido aqui antes de qualquer alteração na Copa Flash.</span></div>';
      return;
    }

    const gameCount = drawPreview.pairs.length;
    const byes = drawPreview.byes.length
      ? `<aside class="flash-draw-byes"><span>Folga para ${esc(drawPreview.nextPhase)}</span><div>${drawPreview.byes.map(name => `<b>${esc(name)}</b>`).join('')}</div></aside>`
      : '';
    root.innerHTML = `<div class="flash-draw-certificate"><div><span>Rodada inicial</span><b>${esc(drawPreview.phase)}</b></div><div><span>Confrontos</span><b>${gameCount}</b></div><div><span>Código do sorteio</span><code>${esc(drawPreview.seed)}</code></div></div>
      ${byes}
      <div class="flash-draw-pairs">${drawPreview.pairs.map((pair, index) => `<article><span>Jogo ${index + 1}</span><div><b>${esc(pair.teamA)}</b><i>×</i><b>${esc(pair.teamB)}</b></div></article>`).join('')}</div>`;
  }

  function invalidateDrawPreview() {
    drawPreview = null;
    updateDrawTeamCount();
    renderDrawPreview();
  }

  function runFlashDraw() {
    const edition = activeDrawEdition();
    if (!adminActive() || !edition) return;
    try {
      if (!window.ArenaBDAFlashDraw?.build) throw new Error('O motor de sorteio ainda não carregou');
      const plan = window.ArenaBDAFlashDraw.build(selectedDrawTeams());
      drawPreview = { editionId: edition.id, ...plan };
      renderDrawPreview();
    } catch (error) {
      drawPreview = null;
      renderDrawPreview();
      notify(error.message || 'Não foi possível realizar o sorteio');
    }
  }

  function openFlashDraw(id = selectedId) {
    if (!adminActive()) return;
    const edition = editions.find(item => item.id === id);
    if (!edition) return;
    if (edition.participants.length < 2) {
      notify('Cadastre pelo menos 2 times na edição antes de sortear');
      return;
    }
    if (!window.ArenaBDAFlashDraw?.build) {
      notify('O motor de sorteio ainda não carregou. Tente novamente.');
      return;
    }
    ensureDrawModal();
    drawEditionId = edition.id;
    drawPreview = null;
    $('#flashDrawTitle').textContent = `Sorteio — ${edition.name}`;
    $('#flashDrawSummary').textContent = 'Escolha os participantes, confira a prévia e publique somente quando o resultado estiver correto.';
    renderDrawTeams(edition);
    renderDrawPreview();
    const backup = drawBackup();
    $('[data-flash-draw-restore]').hidden = !(backup?.edition && backup.editionId === edition.id);
    $('#flashDrawModal').classList.add('show');
    document.body.classList.add('flash-modal-open');
    runFlashDraw();
  }

  function closeFlashDraw() {
    $('#flashDrawModal')?.classList.remove('show');
    if (!$('#flashEditionModal')?.classList.contains('show') && !$('#flashImportModal')?.classList.contains('show')) {
      document.body.classList.remove('flash-modal-open');
    }
    drawEditionId = '';
    drawPreview = null;
  }

  function publishFlashDraw() {
    if (!adminActive()) return;
    const edition = activeDrawEdition();
    if (!edition || !drawPreview || drawPreview.editionId !== edition.id) return;
    const previousMatches = edition.matches.filter(match => match.phase === drawPreview.phase);
    if (previousMatches.length && !confirm(`Já existem ${previousMatches.length} jogos em “${drawPreview.phase}”. Substituir esses confrontos pelo novo sorteio?`)) return;

    try {
      localStorage.setItem(DRAW_BACKUP_KEY, JSON.stringify({
        editionId: edition.id,
        savedAt: Date.now(),
        edition: shapeEdition(edition)
      }));
    } catch {}

    const now = Date.now();
    const generated = drawPreview.pairs.map((pair, index) => shapeMatch({
      id: `flash-draw-${slug(edition.id)}-${now.toString(36)}-${index + 1}`,
      phase: drawPreview.phase,
      teamA: pair.teamA,
      teamB: pair.teamB,
      status: 'Agendado'
    }, index));
    const next = shapeEdition({
      ...edition,
      status: edition.status === 'Planejada' ? 'Em andamento' : edition.status,
      participants: uniqueNames([...edition.participants, ...drawPreview.participants]),
      matches: [...edition.matches.filter(match => match.phase !== drawPreview.phase), ...generated],
      lastDraw: {
        seed: drawPreview.seed,
        phase: drawPreview.phase,
        nextPhase: drawPreview.nextPhase,
        participants: drawPreview.participants,
        byes: drawPreview.byes,
        drawnAt: now
      },
      updatedAt: now
    });
    editions[editions.findIndex(item => item.id === edition.id)] = next;
    selectedId = next.id;
    closeFlashDraw();
    persist();
    notify(`${generated.length} ${generated.length === 1 ? 'confronto publicado' : 'confrontos publicados'} em ${drawPreview?.phase || next.lastDraw.phase}`);
  }

  function restoreFlashDraw() {
    if (!adminActive()) return;
    const backup = drawBackup();
    if (!backup?.edition || backup.editionId !== drawEditionId) return;
    if (!confirm('Desfazer o último sorteio publicado nesta Copa Flash?')) return;
    const index = editions.findIndex(item => item.id === backup.editionId);
    if (index < 0) return;
    editions[index] = shapeEdition({ ...backup.edition, updatedAt: Date.now() });
    selectedId = editions[index].id;
    localStorage.removeItem(DRAW_BACKUP_KEY);
    closeFlashDraw();
    persist();
    notify('Último sorteio desfeito');
  }

  function updateImportPreview() {
    const input = $('#flashImportText');
    const preview = $('#flashImportPreview');
    if (!input || !preview) return;
    const result = parseImport(input.value);
    if (!input.value.trim()) {
      preview.textContent = 'Cole o histórico para validar.';
      preview.dataset.state = '';
      return;
    }
    preview.textContent = `${result.records.length} ${result.records.length === 1 ? 'edição válida' : 'edições válidas'}${result.errors.length ? ` • ${result.errors.length} aviso(s): ${result.errors[0]}` : ' • pronto para importar'}`;
    preview.dataset.state = result.records.length ? (result.errors.length ? 'warn' : 'ok') : 'error';
  }

  function openImport() {
    if (!adminActive()) return;
    ensureImportModal();
    $('#flashImportForm').reset();
    updateImportPreview();
    $('#flashImportModal').classList.add('show');
    document.body.classList.add('flash-modal-open');
    $('#flashImportText').focus();
  }

  function closeImport() {
    $('#flashImportModal')?.classList.remove('show');
    if (!$('#flashEditionModal')?.classList.contains('show')) document.body.classList.remove('flash-modal-open');
  }

  function submitImport(event) {
    event.preventDefault();
    if (!adminActive()) return;
    const result = parseImport($('#flashImportText').value);
    if (!result.records.length) {
      updateImportPreview();
      notify(result.errors[0] || 'Nenhuma edição válida encontrada');
      return;
    }
    const summary = applyImport(result.records, result.fullBackup);
    closeImport();
    notify(`${summary.created} edições criadas • ${summary.updated} atualizadas`);
  }

  function renderMatchRows() {
    const root = $('#flashMatchRows');
    if (!root) return;
    root.innerHTML = draftMatches.length ? draftMatches.map((match, index) => `<article class="flash-match-row" data-flash-match-row="${index}">
      <label>Fase<select data-flash-match-field="phase">${PHASES.map(phase => `<option ${phase === match.phase ? 'selected' : ''}>${phase}</option>`).join('')}</select></label>
      <label>Time A<input data-flash-match-field="teamA" value="${esc(match.teamA)}" placeholder="Time A"></label>
      <label>Placar<input data-flash-match-field="scoreA" type="number" min="0" max="99" value="${hasScore(match.scoreA) ? Number(match.scoreA) : ''}"></label>
      <span>×</span>
      <label>Placar<input data-flash-match-field="scoreB" type="number" min="0" max="99" value="${hasScore(match.scoreB) ? Number(match.scoreB) : ''}"></label>
      <label>Time B<input data-flash-match-field="teamB" value="${esc(match.teamB)}" placeholder="Time B"></label>
      <button type="button" data-flash-remove-match="${index}" aria-label="Excluir jogo">×</button>
    </article>`).join('') : '<div class="flash-empty compact"><b>Nenhuma partida adicionada</b><span>Use “Adicionar jogo” para montar o chaveamento.</span></div>';
  }

  function openEditor(id = '') {
    if (!adminActive()) return;
    ensureModal();
    editingId = id;
    const edition = editions.find(item => item.id === id);
    draftMatches = (edition?.matches || []).map(match => ({ ...match }));
    $('#flashModalTitle').textContent = edition ? 'Editar Copa Flash' : 'Nova Copa Flash';
    $('#flashEditionForm').reset();
    $('#flashName').value = edition?.name || `${editions.length + 1}ª Copa Flash`;
    $('#flashDate').value = edition?.date || '';
    $('#flashStatus').value = edition?.status || 'Planejada';
    $('#flashChampion').value = edition?.champion || '';
    $('#flashRunnerUp').value = edition?.runnerUp || '';
    $('#flashParticipants').value = (edition?.participants || []).join('\n');
    renderMatchRows();
    $('#flashEditionModal').classList.add('show');
    document.body.classList.add('flash-modal-open');
    $('#flashName').focus();
  }

  function closeEditor() {
    $('#flashEditionModal')?.classList.remove('show');
    document.body.classList.remove('flash-modal-open');
    editingId = '';
    draftMatches = [];
  }

  function submitEdition(event) {
    event.preventDefault();
    if (!adminActive()) return;
    const name = $('#flashName').value.trim();
    if (!name) return;
    const previous = editions.find(item => item.id === editingId);
    const now = Date.now();
    const edition = shapeEdition({
      ...previous,
      id: previous?.id || `${slug(name)}-${now.toString(36)}`,
      name,
      date: $('#flashDate').value,
      status: $('#flashStatus').value,
      champion: $('#flashChampion').value,
      runnerUp: $('#flashRunnerUp').value,
      participants: $('#flashParticipants').value.split(/\n|,/),
      matches: draftMatches,
      createdAt: previous?.createdAt || now,
      updatedAt: now
    });
    if (previous) editions[editions.findIndex(item => item.id === previous.id)] = edition;
    else editions.unshift(edition);
    selectedId = edition.id;
    closeEditor();
    persist();
    notify(previous ? 'Copa Flash atualizada' : 'Copa Flash criada');
  }

  function removeEdition(id) {
    if (!adminActive()) return;
    const edition = editions.find(item => item.id === id);
    if (!edition || !confirm(`Excluir ${edition.name}?`)) return;
    editions = editions.filter(item => item.id !== id);
    selectedId = editions[0]?.id || '';
    persist();
    notify('Copa Flash excluída');
  }

  function installStyles() {
    if ($('#copasFlashStyles')) return;
    const style = document.createElement('style');
    style.id = 'copasFlashStyles';
    style.textContent = `
      [data-page="flash"]{--flash:#ffcf4a;--flash-hot:#ff8b3d;display:none;gap:16px}[data-page="flash"].active{display:grid}
      .flash-hero{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:22px;align-items:end;min-height:320px;padding:34px;border:1px solid rgba(255,207,74,.30);border-radius:30px;background:radial-gradient(circle at 88% 15%,rgba(255,139,61,.24),transparent 28%),radial-gradient(circle at 8% 90%,rgba(255,207,74,.12),transparent 35%),linear-gradient(140deg,#241406,#110b05 52%,#050504);box-shadow:0 28px 70px rgba(0,0,0,.42)}
      .flash-hero:after{content:"⚡";position:absolute;right:4%;top:-8%;z-index:-1;color:rgba(255,207,74,.065);font-size:250px;line-height:1;transform:rotate(8deg)}
      .flash-hero h1{margin:7px 0 10px;color:#fff4d2;font:900 clamp(58px,10vw,112px)/.78 "Barlow Condensed",sans-serif;letter-spacing:-.035em;text-transform:uppercase}.flash-hero p{max-width:650px;margin:0;color:#d6c8b8;font-size:13px;line-height:1.65}.flash-hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin-top:20px}.flash-hero-actions>span{padding:8px 10px;border:1px solid rgba(255,255,255,.10);border-radius:999px;color:#c8b9a8;background:rgba(255,255,255,.04);font-size:8px;font-weight:900;text-transform:uppercase}.flash-hero-actions>span[data-state=ok]{color:#8ff0b5}.flash-hero-actions>span[data-state=error]{color:#ffadb5}.flash-hero-actions>button{min-height:39px;padding:0 11px;border:1px solid rgba(255,207,74,.22);border-radius:11px;color:#ffe596;background:rgba(255,207,74,.065);font-size:8px;font-weight:900;text-transform:uppercase}.flash-hero-actions>button.primary{color:#1d1203}
      .flash-hero aside{display:grid;grid-template-columns:1fr 1fr;gap:8px}.flash-hero aside div{min-height:91px;padding:15px;border:1px solid rgba(255,207,74,.17);border-radius:17px;background:rgba(255,255,255,.045)}.flash-hero aside b,.flash-hero aside span{display:block}.flash-hero aside b{color:var(--flash);font:900 32px/1 "Barlow Condensed",sans-serif}.flash-hero aside span{margin-top:7px;color:#b9aa9a;font-size:8px;font-weight:800;text-transform:uppercase}
      .flash-editions{display:grid;gap:10px}.flash-editions>header,.flash-detail-head,.flash-participants>header,.flash-results>header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.flash-editions h2,.flash-detail h2,.flash-ranking h2{margin:4px 0 0;font-size:clamp(27px,4vw,40px);text-transform:uppercase}.flash-editions>header>span{color:var(--muted);font-size:8px;text-transform:uppercase}.flash-edition-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(245px,29%);gap:10px;overflow-x:auto;padding:2px 1px 8px;scroll-snap-type:x proximity;scrollbar-width:thin}.flash-edition-card{overflow:hidden;scroll-snap-align:start;border:1px solid var(--line);border-radius:19px;background:linear-gradient(155deg,rgba(27,22,14,.98),rgba(8,10,8,.98))}.flash-edition-card.active{border-color:rgba(255,207,74,.48);box-shadow:0 12px 28px rgba(255,139,61,.09)}.flash-edition-card>button{display:grid;width:100%;min-height:185px;padding:15px;border:0;color:var(--text);background:transparent;text-align:left}.flash-edition-status{justify-self:start;padding:6px 8px;border-radius:999px;color:var(--flash);background:rgba(255,207,74,.09);font-size:7px;font-weight:900;text-transform:uppercase}.flash-edition-card h3{margin:12px 0 4px;font-size:24px;text-transform:uppercase}.flash-edition-card p{margin:0;color:var(--muted);font-size:9px}.flash-edition-card>button>div{display:flex;gap:14px;margin-top:auto;color:var(--muted);font-size:8px;text-transform:uppercase}.flash-edition-card>button>div b{color:var(--text)}.flash-edition-card>button>strong{overflow:hidden;margin-top:9px;color:#ffe596;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.flash-edition-card footer{display:flex;border-top:1px solid var(--line)}.flash-edition-card footer button{flex:1;min-height:38px;border:0;color:var(--flash);background:rgba(255,255,255,.025);font-size:8px;font-weight:900;text-transform:uppercase}.flash-edition-card footer button+button{border-left:1px solid var(--line)}.flash-edition-card footer button.danger{color:#ffadb5}
      .flash-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(310px,.6fr);gap:13px;align-items:start}.flash-layout>main,.flash-ranking{min-width:0}.flash-detail,.flash-ranking{padding:18px;border:1px solid var(--line);border-radius:23px;background:linear-gradient(150deg,rgba(17,31,23,.96),rgba(5,12,8,.98));box-shadow:0 16px 42px rgba(0,0,0,.24)}.flash-detail-head{padding-bottom:14px;border-bottom:1px solid var(--line)}.flash-detail-head p,.flash-ranking p{margin:3px 0 0;color:var(--muted);font-size:9px}.flash-detail-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.flash-detail-actions button{min-height:39px;padding:0 12px;border:1px solid rgba(255,207,74,.24);border-radius:11px;color:var(--flash);background:rgba(255,207,74,.06);font-size:8px;font-weight:900;text-transform:uppercase}.flash-detail-actions button.primary{color:#1d1203}
      .flash-podium{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:13px 0}.flash-podium article{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"icon label" "icon name";column-gap:11px;align-items:center;min-height:91px;padding:14px;border:1px solid rgba(255,207,74,.15);border-radius:16px;background:radial-gradient(circle at 0 50%,rgba(255,207,74,.10),transparent 37%),rgba(255,255,255,.025)}.flash-podium span{grid-area:label;color:var(--muted);font-size:8px;font-weight:800;text-transform:uppercase}.flash-podium i{grid-area:icon;font-style:normal;font-size:34px}.flash-podium strong{grid-area:name;overflow:hidden;margin-top:4px;color:#fff4cf;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
      .flash-participants,.flash-results{margin-top:13px}.flash-participants>header,.flash-results>header{margin-bottom:9px}.flash-participants h3,.flash-results h3{margin:3px 0 0;font-size:22px;text-transform:uppercase}.flash-participants>header>b,.flash-results>header>b{padding:7px 9px;border-radius:999px;color:var(--flash);background:rgba(255,207,74,.08);font-size:8px}.flash-participants>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.flash-participants>div>span{display:flex;align-items:center;gap:8px;min-width:0;padding:9px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.025);font-size:8px;font-weight:750}.flash-participants>div>span i{display:grid;place-items:center;width:21px;height:21px;flex:0 0 auto;border-radius:7px;color:#1d1203;background:var(--flash);font-size:7px;font-style:normal;font-weight:900}
      .flash-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(225px,1fr);gap:9px;overflow-x:auto;padding:1px 1px 7px;scroll-snap-type:x proximity;scrollbar-width:thin}.flash-bracket>section{scroll-snap-align:start}.flash-bracket>section>header{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;color:var(--flash);font-size:8px;font-weight:900;text-transform:uppercase}.flash-bracket>section>header b{color:var(--muted);font-size:7px}.flash-match{overflow:hidden;margin-bottom:7px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025)}.flash-match header{display:flex;justify-content:space-between;padding:7px 9px;border-bottom:1px solid var(--line);color:var(--muted);font-size:7px;text-transform:uppercase}.flash-match>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px 10px;font-size:9px}.flash-match>div+div{border-top:1px solid rgba(255,255,255,.045)}.flash-match>div.winner{color:#fff1c5;background:rgba(255,207,74,.065);font-weight:850}.flash-match>div b{color:var(--flash);font-size:12px}.flash-match>small{display:block;padding:6px 9px;color:var(--muted);background:rgba(0,0,0,.16);font-size:7px;text-align:center}
      .flash-ranking{position:sticky;top:86px}.flash-ranking>header{margin-bottom:12px}.flash-ranking-table{overflow:hidden;border:1px solid var(--line);border-radius:15px}.flash-ranking-table>header,.flash-ranking-table>div{display:grid;grid-template-columns:25px minmax(0,1fr) 30px 30px 30px 38px;align-items:center;gap:4px;min-height:42px;padding:7px 8px;border-bottom:1px solid var(--line);font-size:8px;text-align:center}.flash-ranking-table>header{min-height:34px;color:var(--muted);background:rgba(255,255,255,.035);font-size:7px;font-weight:900;text-transform:uppercase}.flash-ranking-table>div:last-child{border-bottom:0}.flash-ranking-table>div.top{background:linear-gradient(90deg,rgba(255,207,74,.08),transparent)}.flash-ranking-table>div>span{text-align:left;min-width:0}.flash-ranking-table strong,.flash-ranking-table small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.flash-ranking-table strong{font-size:8px}.flash-ranking-table small{margin-top:3px;color:var(--muted);font-size:6px}.flash-ranking-table>div>b:last-child{color:var(--flash);font-size:10px}
      .flash-empty{display:grid;place-items:center;gap:5px;min-height:180px;padding:24px;border:1px dashed var(--line);border-radius:16px;color:var(--muted);text-align:center}.flash-empty b{color:var(--text);font-size:11px}.flash-empty span,.flash-empty p{font-size:8px}.flash-empty.compact{min-height:105px}.flash-empty-main{min-height:360px}.flash-empty-main>span{color:var(--flash);font-size:48px}.flash-empty-main p{max-width:420px;margin:0;line-height:1.6}
      body.flash-modal-open{overflow:hidden}.flash-modal-backdrop{z-index:95}.flash-modal{width:min(900px,100%);max-height:min(92dvh,900px);padding:0!important}.flash-modal>header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 19px;border-bottom:1px solid var(--line);background:#101d16}.flash-modal>header h2{margin:3px 0 0}.flash-modal>header>button{width:40px;height:40px;border:1px solid var(--line);border-radius:12px;color:var(--text);background:rgba(255,255,255,.04);font-size:22px}.flash-modal form{padding:17px 19px}.flash-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.flash-form-grid label,.flash-match-row label{color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.flash-form-grid label.wide{grid-column:1/-1}.flash-form-grid input,.flash-form-grid select,.flash-form-grid textarea,.flash-match-row input,.flash-match-row select{width:100%;margin-top:5px;padding:10px;border:1px solid var(--line);border-radius:10px;color:var(--text);background:#07100c;font-size:10px;text-transform:none}.flash-form-grid textarea{resize:vertical}.flash-match-editor{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}.flash-match-editor>header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.flash-match-editor h3{margin:0;font-size:18px;text-transform:uppercase}.flash-match-editor p{margin:3px 0 0;font-size:8px}.flash-match-editor>header button{min-height:36px;padding:0 10px;border:1px solid rgba(255,207,74,.25);border-radius:10px;color:var(--flash);background:rgba(255,207,74,.06);font-size:8px;font-weight:900}.flash-match-row{display:grid;grid-template-columns:135px minmax(130px,1fr) 66px 15px 66px minmax(130px,1fr) 34px;align-items:end;gap:6px;margin-bottom:7px;padding:9px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.022)}.flash-match-row>span{padding-bottom:10px;color:var(--muted);font-size:12px;text-align:center}.flash-match-row>button{width:34px;height:37px;border:1px solid rgba(255,105,120,.18);border-radius:9px;color:#ffadb5;background:rgba(255,105,120,.06);font-size:16px}.flash-modal form>footer{position:sticky;bottom:-17px;display:flex;justify-content:flex-end;gap:8px;margin:16px -19px -17px;padding:13px 19px;border-top:1px solid var(--line);background:rgba(16,29,22,.97)}.flash-import-modal{width:min(680px,100%)}.flash-import-help{display:grid;gap:7px;padding:12px;border:1px solid rgba(255,207,74,.18);border-radius:13px;background:rgba(255,207,74,.055)}.flash-import-help b{color:#ffe596;font-size:9px;text-transform:uppercase}.flash-import-help code{overflow-x:auto;padding:9px;border-radius:9px;color:#e9ddcf;background:#050806;font-size:9px;white-space:nowrap}.flash-import-help p{margin:0;font-size:8px}.flash-import-field{display:block;margin-top:13px;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase}.flash-import-field textarea{width:100%;margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:12px;color:var(--text);background:#07100c;font:500 10px/1.55 Inter,sans-serif;resize:vertical}.flash-import-preview{margin-top:9px;padding:10px;border:1px solid var(--line);border-radius:10px;color:var(--muted);background:rgba(255,255,255,.025);font-size:8px}.flash-import-preview[data-state=ok]{border-color:rgba(79,223,143,.26);color:#8ff0b5}.flash-import-preview[data-state=warn]{border-color:rgba(255,207,74,.28);color:#ffe596}.flash-import-preview[data-state=error]{border-color:rgba(255,105,120,.28);color:#ffadb5}
      @media(max-width:900px){.flash-hero,.flash-layout{grid-template-columns:1fr}.flash-ranking{position:static}.flash-edition-scroll{grid-auto-columns:78%}.flash-participants>div{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){[data-page="flash"]{gap:12px}.flash-hero{min-height:390px;padding:23px 17px;border-radius:24px}.flash-hero h1{font-size:70px}.flash-hero aside div{min-height:77px;padding:12px}.flash-edition-scroll{grid-auto-columns:88%}.flash-detail,.flash-ranking{padding:14px;border-radius:19px}.flash-detail-head{align-items:flex-start;flex-direction:column}.flash-podium{grid-template-columns:1fr}.flash-participants>div{grid-template-columns:1fr}.flash-form-grid{grid-template-columns:1fr}.flash-form-grid label.wide{grid-column:auto}.flash-match-row{grid-template-columns:1fr 70px 15px 70px 1fr 34px}.flash-match-row label:first-child{grid-column:1/-1}.flash-match-row>button{grid-column:6}.flash-modal form>footer{display:grid;grid-template-columns:1fr 1fr}.flash-modal form>footer button{width:100%}}
      @media(max-width:430px){.flash-hero-actions{align-items:stretch;flex-direction:column}.flash-hero-actions>*{width:100%;text-align:center}.flash-match-row{grid-template-columns:1fr 58px 12px 58px 1fr}.flash-match-row>button{grid-column:1/-1;width:100%}.flash-modal form>footer{grid-template-columns:1fr}.flash-ranking-table>header,.flash-ranking-table>div{grid-template-columns:22px minmax(0,1fr) 27px 27px 34px}.flash-ranking-table>header>:nth-child(5),.flash-ranking-table>div>:nth-child(5){display:none}}
      @media(prefers-reduced-motion:reduce){.flash-edition-scroll,.flash-bracket{scroll-behavior:auto}}
    `;
    document.head.append(style);
  }

  function installDrawStyles() {
    if ($('#flashDrawStyles')) return;
    const style = document.createElement('style');
    style.id = 'flashDrawStyles';
    style.textContent = `
      .flash-draw-record{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:9px 10px;border:1px solid rgba(255,207,74,.17);border-radius:12px;background:rgba(255,207,74,.045)}.flash-draw-record p{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-width:0;margin:0}.flash-draw-record p span,.flash-draw-record>div>span{color:var(--muted);font-size:7px;font-weight:900;text-transform:uppercase}.flash-draw-record p strong{color:#ffe596;font-size:8px}.flash-draw-record code{overflow:hidden;max-width:220px;color:#8ff0b5;font-size:7px;text-overflow:ellipsis;white-space:nowrap}.flash-draw-record>div{display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:5px}.flash-draw-record>div b{padding:5px 7px;border-radius:999px;color:#a8f3c4;background:rgba(79,223,143,.09);font-size:7px}
      .flash-draw-modal{width:min(860px,100%)}.flash-draw-body{display:grid;gap:16px;padding:17px 19px}.flash-draw-summary{margin:0;color:var(--muted);font-size:9px;line-height:1.55}
      .flash-draw-selection,.flash-draw-result{padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.022)}.flash-draw-selection>header,.flash-draw-result>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}.flash-draw-selection h3,.flash-draw-result h3{margin:3px 0 0;font-size:20px;text-transform:uppercase}
      .flash-draw-tools{display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:6px}.flash-draw-tools b{margin-right:3px;color:#ffe596;font-size:8px;text-transform:uppercase}.flash-draw-tools button,.flash-draw-result>header>button{min-height:34px;padding:0 9px;border:1px solid rgba(255,207,74,.20);border-radius:9px;color:var(--flash);background:rgba(255,207,74,.055);font-size:7px;font-weight:900;text-transform:uppercase}
      .flash-draw-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.flash-draw-team-grid label{display:block;cursor:pointer}.flash-draw-team-grid input{position:absolute;opacity:0;pointer-events:none}.flash-draw-team-grid span{display:flex;align-items:center;gap:8px;min-height:42px;padding:8px;border:1px solid var(--line);border-radius:11px;color:var(--muted);background:#07100c;font-size:8px;font-weight:800}.flash-draw-team-grid i{display:grid;place-items:center;width:24px;height:24px;flex:0 0 auto;border-radius:7px;color:var(--muted);background:rgba(255,255,255,.06);font-size:7px;font-style:normal}.flash-draw-team-grid input:checked+span{border-color:rgba(255,207,74,.35);color:#fff1c5;background:rgba(255,207,74,.07)}.flash-draw-team-grid input:checked+span i{color:#1d1203;background:var(--flash)}.flash-draw-team-grid input:focus-visible+span{outline:2px solid var(--flash);outline-offset:2px}
      .flash-draw-preview{display:grid;gap:9px}.flash-draw-empty{display:grid;place-items:center;gap:5px;min-height:130px;padding:20px;border:1px dashed var(--line);border-radius:13px;color:var(--muted);text-align:center}.flash-draw-empty b{color:var(--text);font-size:10px}.flash-draw-empty span{font-size:8px}.flash-draw-certificate{display:grid;grid-template-columns:1fr 95px minmax(180px,1.2fr);gap:7px;padding:9px;border:1px solid rgba(255,207,74,.20);border-radius:12px;background:rgba(255,207,74,.055)}.flash-draw-certificate>div{display:grid;gap:4px;min-width:0}.flash-draw-certificate span,.flash-draw-byes>span{color:var(--muted);font-size:7px;font-weight:900;text-transform:uppercase}.flash-draw-certificate b{color:#ffe596;font-size:10px}.flash-draw-certificate code{overflow:hidden;color:#8ff0b5;font-size:7px;text-overflow:ellipsis;white-space:nowrap}
      .flash-draw-byes{padding:10px;border:1px solid rgba(79,223,143,.19);border-radius:12px;background:rgba(79,223,143,.045)}.flash-draw-byes>div{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.flash-draw-byes b{padding:6px 8px;border-radius:999px;color:#a8f3c4;background:rgba(79,223,143,.09);font-size:7px}.flash-draw-pairs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.flash-draw-pairs article{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:#07100c}.flash-draw-pairs article>span{display:block;padding:6px 9px;border-bottom:1px solid var(--line);color:var(--muted);font-size:7px;font-weight:900;text-transform:uppercase}.flash-draw-pairs article>div{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);align-items:center;gap:5px;min-height:54px;padding:9px;text-align:center}.flash-draw-pairs b{overflow:hidden;color:#fff1c5;font-size:8px;text-overflow:ellipsis}.flash-draw-pairs i{color:var(--flash);font-size:10px;font-style:normal}
      .flash-draw-footer{position:sticky;bottom:0;display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;padding:13px 19px;border-top:1px solid var(--line);background:rgba(16,29,22,.98)}.flash-draw-footer button{min-height:39px}.flash-draw-footer button.danger{border:1px solid rgba(255,105,120,.22);border-radius:10px;color:#ffadb5;background:rgba(255,105,120,.06);font-size:8px;font-weight:900;text-transform:uppercase}.flash-draw-footer button[disabled]{cursor:not-allowed;opacity:.42}
      @media(max-width:620px){.flash-detail-actions{justify-content:flex-start}.flash-draw-record{align-items:flex-start;flex-direction:column}.flash-draw-record>div{justify-content:flex-start}.flash-draw-selection>header,.flash-draw-result>header{align-items:flex-start;flex-direction:column}.flash-draw-tools{justify-content:flex-start}.flash-draw-team-grid,.flash-draw-pairs{grid-template-columns:1fr}.flash-draw-certificate{grid-template-columns:1fr 78px}.flash-draw-certificate>div:last-child{grid-column:1/-1}.flash-draw-footer{grid-template-columns:1fr 1fr}.flash-draw-footer span{display:none}.flash-draw-footer button{width:100%}.flash-draw-footer button.danger{grid-column:1/-1}}
      @media(max-width:430px){.flash-draw-body{padding:13px}.flash-draw-footer{grid-template-columns:1fr}.flash-draw-certificate{grid-template-columns:1fr}.flash-draw-certificate>div:last-child{grid-column:auto}.flash-draw-footer button.danger{grid-column:auto}}
    `;
    document.head.append(style);
  }

  document.addEventListener('click', event => {
    if (event.target.id === 'flashEditionModal') { closeEditor(); return; }
    if (event.target.id === 'flashImportModal') { closeImport(); return; }
    if (event.target.id === 'flashDrawModal') { closeFlashDraw(); return; }
    const add = event.target.closest('[data-flash-add]');
    if (add) { openEditor(); return; }
    if (event.target.closest('[data-flash-import]')) { openImport(); return; }
    if (event.target.closest('[data-flash-export]')) { exportBackup(); return; }
    if (event.target.closest('[data-flash-import-close]')) { closeImport(); return; }
    if (event.target.closest('[data-flash-draw-close]')) { closeFlashDraw(); return; }
    const draw = event.target.closest('[data-flash-draw]');
    if (draw) { openFlashDraw(draw.dataset.flashDraw); return; }
    if (event.target.closest('[data-flash-draw-run]')) { runFlashDraw(); return; }
    if (event.target.closest('[data-flash-draw-publish]')) { publishFlashDraw(); return; }
    if (event.target.closest('[data-flash-draw-restore]')) { restoreFlashDraw(); return; }
    if (event.target.closest('[data-flash-draw-all]')) {
      $$('#flashDrawTeams input[data-flash-draw-team]').forEach(input => { input.checked = true; });
      invalidateDrawPreview();
      return;
    }
    if (event.target.closest('[data-flash-draw-clear]')) {
      $$('#flashDrawTeams input[data-flash-draw-team]').forEach(input => { input.checked = false; });
      invalidateDrawPreview();
      return;
    }
    const select = event.target.closest('[data-flash-select]');
    if (select) { selectedId = select.dataset.flashSelect; render(); return; }
    const edit = event.target.closest('[data-flash-edit]');
    if (edit) { openEditor(edit.dataset.flashEdit); return; }
    const remove = event.target.closest('[data-flash-delete]');
    if (remove) { removeEdition(remove.dataset.flashDelete); return; }
    if (event.target.closest('[data-flash-close]')) { closeEditor(); return; }
    if (event.target.closest('[data-flash-add-match]')) {
      draftMatches.push(shapeMatch({ phase: draftMatches.length ? 'Final' : 'Preliminar', status: 'Finalizado' }, draftMatches.length));
      renderMatchRows();
      return;
    }
    const removeMatch = event.target.closest('[data-flash-remove-match]');
    if (removeMatch) {
      draftMatches.splice(Number(removeMatch.dataset.flashRemoveMatch), 1);
      renderMatchRows();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'flashImportText') {
      updateImportPreview();
      return;
    }
    const field = event.target.closest('[data-flash-match-field]');
    if (!field) return;
    const row = field.closest('[data-flash-match-row]');
    const index = Number(row?.dataset.flashMatchRow);
    if (!draftMatches[index]) return;
    const key = field.dataset.flashMatchField;
    draftMatches[index][key] = ['scoreA', 'scoreB', 'penaltiesA', 'penaltiesB'].includes(key)
      ? (field.value === '' ? '' : Number(field.value))
      : field.value;
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-flash-draw-team]')) {
      invalidateDrawPreview();
      return;
    }
    const field = event.target.closest('[data-flash-match-field]');
    if (!field) return;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'flashEditionForm') submitEdition(event);
    if (event.target.id === 'flashImportForm') submitImport(event);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#flashDrawModal')?.classList.contains('show')) closeFlashDraw();
    else if (event.key === 'Escape' && $('#flashEditionModal')?.classList.contains('show')) closeEditor();
    else if (event.key === 'Escape' && $('#flashImportModal')?.classList.contains('show')) closeImport();
  });

  window.addEventListener('arena:cloud-ready', connectCloud);
  window.addEventListener('arena:permissions-updated', render);
  window.addEventListener('arena:auth-changed', render);
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    editions = loadEditions();
    selectedId = editions.some(item => item.id === selectedId) ? selectedId : editions[0]?.id || '';
    render();
  });

  installStyles();
  installDrawStyles();
  ensureModal();
  ensureImportModal();
  ensureDrawModal();
  connectCloud();
  render();
  window.ArenaBDAFlashCups = Object.freeze({
    render,
    ranking,
    parseImport,
    exportBackup,
    editions: () => editions.map(item => ({ ...item, participants: [...item.participants], matches: item.matches.map(match => ({ ...match })) })),
    openEditor,
    openDraw: openFlashDraw,
    buildDraw: (teams, seed) => window.ArenaBDAFlashDraw?.build?.(teams, seed)
  });
})();
