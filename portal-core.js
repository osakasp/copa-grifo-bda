/* Pure domain rules shared by the browser, audits and regression tests. */
(function (root) {
  'use strict';
  const KEY = 'bda-portal-state-v2';
  const RECOVERY_KEY = KEY + '-recovery';
  const clone = value => JSON.parse(JSON.stringify(value));
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const normalizeName = value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  const score = value => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const raw = String(value).trim();
    return /^(0|[1-9][0-9]?)$/.test(raw) ? Number(raw) : null;
  };
  const validScore = value => record(value) && score(value.home) !== null && score(value.away) !== null;
  const keyFor = (r, m) => r + ':' + m;
  const matchKeys = t => (t.matches || []).flatMap((round, r) => round.map((_, m) => keyFor(r, m)));
  const calendar = t => JSON.stringify({id:t.id, participants:t.participants, matches:t.matches || [], byes:t.byes || []});
  const validName = value => typeof value === 'string' && value.trim().length >= 2 && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
  const validBadge = value => value === '' || (typeof value === 'string' && value.length <= 90000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  function validateResults(t, results) {
    assert(record(results), 'Resultados inválidos em ' + t.name);
    const keys = new Set(matchKeys(t));
    for (const [key, value] of Object.entries(results)) {
      assert(keys.has(key) && validScore(value), 'Placar inválido ou jogo inexistente: ' + t.name + ' / ' + key);
    }
  }
  function validateTournament(t) {
    assert(record(t) && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(t.id) && validName(t.name), 'Competição inválida');
    assert(Array.isArray(t.participants) && t.participants.length <= 200 && t.participants.every(validName), 'Clubes inválidos em ' + t.name);
    const names = new Set(t.participants.map(normalizeName));
    assert(names.size === t.participants.length, 'Clubes duplicados em ' + t.name);
    const clubs = new Set(t.participants);
    assert(Array.isArray(t.matches || []) && (t.matches || []).length <= 100, 'Rodadas inválidas');
    for (const round of t.matches || []) {
      assert(Array.isArray(round) && round.length <= 100, 'Rodada inválida');
      for (const pair of round) assert(Array.isArray(pair) && pair.length === 2 && pair.every(name => clubs.has(name)) && pair[0] !== pair[1], 'Confronto inválido em ' + t.name);
    }
    assert(t.byes === undefined || (Array.isArray(t.byes) && t.byes.every(name => name === null || clubs.has(name))), 'Folgas inválidas');
    validateResults(t, t.results || {});
    assert(t.pendingTeams === undefined || (Array.isArray(t.pendingTeams) && t.pendingTeams.length <= 200 && t.pendingTeams.every(validName)), 'Solicitações inválidas');
    assert(t.resultHistory === undefined || Array.isArray(t.resultHistory), 'Histórico inválido');
    for (const item of t.resultHistory || []) {
      assert(record(item) && Number.isFinite(item.at), 'Histórico inválido');
      validateResults(t, item.results);
    }
    assert(t.lastResultUpdate == null || Number.isFinite(t.lastResultUpdate), 'Data inválida');
    if (t.teamProfiles !== undefined) {
      assert(record(t.teamProfiles), 'Escudos inválidos');
      for (const [name, profile] of Object.entries(t.teamProfiles)) {
        assert((clubs.has(name) || (t.pendingTeams || []).includes(name)) && record(profile) && validBadge(profile.badge || ''), 'Escudo inválido para ' + name);
      }
    }
    return t;
  }
  function validateState(state) {
    assert(Array.isArray(state) && state.length > 0 && state.length <= 100, 'Arquivo de competições inválido');
    const ids = new Set();
    state.forEach(t => { validateTournament(t); assert(!ids.has(t.id), 'Competição duplicada: ' + t.id); ids.add(t.id); });
    return state;
  }
  function hydrate(seeds, raw) {
    const defaults = seeds.map(t => ({...clone(t), results:{}, pendingTeams:[], resultHistory:[], teamProfiles:{}, lastResultUpdate:null}));
    if (raw === null) return {state:defaults, errors:[]};
    try {
      const saved = JSON.parse(raw);
      assert(Array.isArray(saved) && saved.length > 0, 'Armazenamento inválido');
      const ids = new Set();
      const merged = saved.map(t => {
        assert(record(t) && !ids.has(t.id), 'Competição inválida ou duplicada'); ids.add(t.id);
        const seed = defaults.find(s => s.id === t.id);
        // Persisted fixtures and unknown competitions are retained, never rebuilt on load.
        return {...(seed || {}), ...t, results:t.results || {}, pendingTeams:t.pendingTeams || [], resultHistory:t.resultHistory || [], teamProfiles:t.teamProfiles || {}};
      });
      defaults.forEach(t => { if (!ids.has(t.id)) merged.push(t); });
      return {state:validateState(merged), errors:[]};
    } catch (error) {
      return {state:defaults, errors:[error.message]};
    }
  }
  function audit(t) {
    const warnings = [];
    try { validateTournament(t); } catch (error) { return [error.message]; }
    const rounds = t.matches || [];
    if (!rounds.length) return warnings;
    const pairs = new Set(), byes = new Map(), counts = new Map(t.participants.map(name => [name, 0]));
    rounds.forEach((round, r) => {
      const used = new Set();
      round.forEach(pair => {
        for (const name of pair) { if (used.has(name)) warnings.push('Clube repetido na rodada ' + (r + 1)); used.add(name); counts.set(name, counts.get(name) + 1); }
        const key = JSON.stringify([...pair].sort());
        if (t.format === 'Pontos corridos' && pairs.has(key)) warnings.push('Confronto repetido na rodada ' + (r + 1));
        pairs.add(key);
      });
      const bye = t.byes?.[r];
      if (bye) { if (used.has(bye)) warnings.push('Folga conflitante na rodada ' + (r + 1)); byes.set(bye, (byes.get(bye) || 0) + 1); }
      if (t.format === 'Pontos corridos') {
        if (round.length !== Math.floor(t.participants.length / 2)) warnings.push('Quantidade de jogos inválida na rodada ' + (r + 1));
        if (t.participants.length % 2 && (!bye || used.size !== t.participants.length - 1)) warnings.push('Folga ausente ou inválida na rodada ' + (r + 1));
      }
    });
    if (t.format === 'Pontos corridos') {
      const n = t.participants.length;
      if (rounds.length !== n - 1 + n % 2 || pairs.size !== n * (n - 1) / 2) warnings.push('Calendário não corresponde a turno único completo');
      for (const [name, count] of counts) if (count !== n - 1 || (n % 2 && byes.get(name) !== 1)) warnings.push('Jogos ou folgas inconsistentes: ' + name);
    }
    return warnings;
  }
  function standings(t) {
    const rows = new Map(t.participants.map(name => [name, {name, played:0, won:0, draw:0, lost:0, goalsFor:0, goalsAgainst:0, points:0, form:[]}]));
    (t.matches || []).forEach((round,r) => round.forEach((pair,m) => {
      const res = t.results?.[keyFor(r,m)]; if (!validScore(res)) return;
      const h = rows.get(pair[0]), a = rows.get(pair[1]); if (!h || !a) return;
      const hs = score(res.home), as = score(res.away);
      h.played++; a.played++; h.goalsFor += hs; h.goalsAgainst += as; a.goalsFor += as; a.goalsAgainst += hs;
      if (hs > as) { h.won++; a.lost++; h.points += 3; h.form.push('V'); a.form.push('D'); }
      else if (hs < as) { a.won++; h.lost++; a.points += 3; a.form.push('V'); h.form.push('D'); }
      else { h.draw++; a.draw++; h.points++; a.points++; h.form.push('E'); a.form.push('E'); }
    }));
    // Preserve the portal's published tie-break order; alphabetical order is only for display.
    return [...rows.values()].sort((a,b) => b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst) || b.goalsFor-a.goalsFor || a.name.localeCompare(b.name,'pt-BR'));
  }
  function patchResults(t, patch, now = Date.now()) {
    const next = clone(t), keys = new Set(matchKeys(t));
    for (const [key, value] of Object.entries(patch)) {
      assert(keys.has(key) && (value === null || validScore(value)), 'Informe os dois gols (0 a 99) ou apague ambos.');
      if (value === null) delete next.results[key];
      else next.results[key] = {home:score(value.home), away:score(value.away)};
    }
    if (JSON.stringify(next.results) === JSON.stringify(t.results)) return null;
    next.resultHistory = [...(t.resultHistory || []), {at:now, results:clone(t.results)}].slice(-10);
    next.lastResultUpdate = now;
    return validateTournament(next);
  }
  function addTeam(t, rawName) {
    const name = String(rawName).normalize('NFKC').trim().replace(/\s+/g,' ');
    assert(validName(name), 'Use um nome entre 2 e 80 caracteres.');
    assert(![...t.participants, ...(t.pendingTeams || [])].some(n => normalizeName(n) === normalizeName(name)), 'Esse clube já está cadastrado ou aguardando aprovação.');
    const next = clone(t); next.pendingTeams = [...(t.pendingTeams || []), name];
    return validateTournament(next);
  }
  function approveTeam(t, name) {
    assert(!(t.matches || []).length && t.status !== 'Finalizado', 'O calendário está fechado. A inscrição permanece pendente.');
    assert((t.pendingTeams || []).includes(name), 'Solicitação inexistente');
    assert(!t.maxTeams || t.participants.length < t.maxTeams, 'Limite de clubes atingido');
    const next = clone(t); next.participants.push(name); next.pendingTeams = next.pendingTeams.filter(n => n !== name);
    return validateTournament(next);
  }
  function exportBackup(state) { return {schemaVersion:2, source:'arena-bda-local', exportedAt:new Date().toISOString(), tournaments:clone(state)}; }
  function restoreBackup(state, payload) {
    assert(record(payload) && payload.source === 'arena-bda-local' && [1,2].includes(payload.schemaVersion), 'Origem ou versão do backup inválida');
    assert(Array.isArray(payload.tournaments) && payload.tournaments.length > 0, 'Backup vazio');
    const next = clone(state), ids = new Set();
    for (const entry of payload.tournaments) {
      assert(record(entry) && !ids.has(entry.id), 'Competição duplicada no backup'); ids.add(entry.id);
      const target = next.find(t => t.id === entry.id); assert(target, 'Competição desconhecida no backup');
      if (entry.matches || entry.participants) assert(calendar({...target,...entry}) === calendar(target), 'Calendário divergente em ' + target.name + '. Restauração bloqueada.');
      validateResults(target, entry.results);
      target.results = clone(entry.results);
      target.resultHistory = clone(entry.resultHistory || []).slice(-10);
      target.lastResultUpdate = entry.lastResultUpdate ?? null;
      if (entry.pendingTeams !== undefined) target.pendingTeams = clone(entry.pendingTeams);
      if (entry.teamProfiles !== undefined) target.teamProfiles = clone(entry.teamProfiles);
    }
    return validateState(next);
  }
  function createRepository(storage, seeds, locks) {
    let raw = null, ioError = null;
    try { raw = storage.getItem(KEY); } catch { ioError = 'Armazenamento indisponível. Exporte os dados antes de sair.'; }
    let loaded = hydrate(seeds, raw);
    if (ioError) loaded.errors.push(ioError);
    return {
      get state() { return clone(loaded.state); }, get errors() { return [...loaded.errors]; }, get raw() { return raw; },
      async save(next) {
        const write = () => {
          assert(!loaded.errors.length, 'Dados locais inválidos: escrita bloqueada para preservar o original.');
          validateState(next);
          assert(storage.getItem(KEY) === raw, 'Conflito entre abas. Exporte seu rascunho e recarregue antes de salvar.');
          const nextRaw = JSON.stringify(next);
          if (raw !== null && raw !== nextRaw) {
            let backups;
            try { backups = JSON.parse(storage.getItem(RECOVERY_KEY) || '[]'); } catch { throw new Error('Histórico de recuperação ilegível. Exporte o armazenamento bruto antes de continuar.'); }
            assert(Array.isArray(backups), 'Histórico de recuperação inválido');
            // Fail closed if a backup cannot be written; never confirm a partial save.
            storage.setItem(RECOVERY_KEY, JSON.stringify([...backups, {at:Date.now(), raw}].slice(-5)));
          }
          storage.setItem(KEY, nextRaw); raw = nextRaw; loaded = {state:clone(next), errors:[]};
          return clone(next);
        };
        return locks?.request ? locks.request(KEY, write) : write();
      },
      accept(newRaw) {
        const incoming = hydrate(seeds, newRaw);
        assert(newRaw !== null && !incoming.errors.length, 'Atualização externa inválida. Dados em tela preservados.');
        for (const previous of loaded.state) {
          const next = incoming.state.find(t => t.id === previous.id);
          assert(next, 'Atualização externa remove uma competição. Escrita bloqueada.');
          if ((previous.matches || []).length) assert(calendar(next) === calendar(previous), 'Calendário alterado externamente. Dados preservados.');
        }
        loaded = incoming; raw = newRaw; return clone(loaded.state);
      },
      recovery() {
        const items = JSON.parse(storage.getItem(RECOVERY_KEY) || '[]');
        assert(Array.isArray(items), 'Histórico de recuperação inválido'); return items;
      }
    };
  }
  const api = {KEY, RECOVERY_KEY, clone, record, normalizeName, score, validScore, validBadge, keyFor, matchKeys, calendar, validateResults, validateTournament, validateState, hydrate, audit, standings, patchResults, addTeam, approveTeam, exportBackup, restoreBackup, createRepository};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ArenaPortalCore = Object.freeze(api);
})(globalThis);
