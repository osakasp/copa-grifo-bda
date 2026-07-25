(() => {
  'use strict';

  const ADMIN_EMAIL = 'miniamikaren@gmail.com';
  const STORAGE_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_ID = 'copa-grifo';
  const CLOUD_DOCUMENT = `confrontos-${TOURNAMENT_ID}`;
  const SCHEDULE_VERSION = 2;

  const match = (id, phase, pos, ta, tb) => ({
    id,
    phase,
    status: 'Agendado',
    ta,
    tb,
    a: '',
    b: '',
    pa: '',
    pb: '',
    wo: 'none',
    pos,
    date: '',
    time: '',
    place: '',
    note: '',
    created: 1784999000000 + pos,
    updated: 1784999000000 + pos,
    scheduleVersion: SCHEDULE_VERSION
  });

  const OFFICIAL_MATCHES = [
    match('p1', 'Preliminar', 1, 'FLAMESTRE FC BDA', 'BDA GOLDEN FC'),
    match('p2', 'Preliminar', 2, 'CAJUEIRO BDA', 'MACIEIRA BDA'),
    match('p3', 'Preliminar', 3, 'SÃO PAULO BDA', 'HELLYEAH BDA'),

    match('j1', 'Oitavas de final', 1, 'VASCO DA GAMA BDA', 'CV CRUZ BDA'),
    match('j2', 'Oitavas de final', 2, 'IMORTAIS FC BDA', 'FLORENCE REAL FC BDA'),
    match('j3', 'Oitavas de final', 3, 'REDBULL BDA', 'INDEPENDENTE FC BDA'),
    match('j4', 'Oitavas de final', 4, 'MILAN AC BDA', 'INTER BRASIL BDA'),
    match('j5', 'Oitavas de final', 5, 'JOGOBUGADO BDA', 'SPORT RECIFE BDA'),
    match('j6', 'Oitavas de final', 6, 'MOZAMIGOS BDA', 'BDA URDLS'),
    match('j7', 'Oitavas de final', 7, 'ZOMBIE FC BDA', 'Vencedor P1'),
    match('j8', 'Oitavas de final', 8, 'Vencedor P2', 'Vencedor P3'),

    match('q1', 'Quartas de final', 1, 'Vencedor J1', 'Vencedor J2'),
    match('q2', 'Quartas de final', 2, 'Vencedor J3', 'Vencedor J4'),
    match('q3', 'Quartas de final', 3, 'Vencedor J5', 'Vencedor J6'),
    match('q4', 'Quartas de final', 4, 'Vencedor J7', 'Vencedor J8'),

    match('s1', 'Semifinal', 1, 'Vencedor Q1', 'Vencedor Q2'),
    match('s2', 'Semifinal', 2, 'Vencedor Q3', 'Vencedor Q4'),

    match('f1', 'Final', 1, 'Vencedor S1', 'Vencedor S2')
  ];

  const OFFICIAL_IDS = new Set(OFFICIAL_MATCHES.map(game => game.id));

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function sameSchedule(existing, official) {
    return normalize(existing?.phase) === normalize(official.phase)
      && normalize(existing?.ta) === normalize(official.ta)
      && normalize(existing?.tb) === normalize(official.tb);
  }

  function rebuild(existing) {
    const current = Array.isArray(existing) ? existing : [];
    const customMatches = current.filter(game => !OFFICIAL_IDS.has(String(game?.id || '')));

    const officialMatches = OFFICIAL_MATCHES.map(official => {
      const saved = current.find(game => String(game?.id || '') === official.id);

      // Mantém placares já digitados somente quando o confronto continua sendo o mesmo.
      if (saved && sameSchedule(saved, official)) {
        return {
          ...official,
          ...saved,
          phase: official.phase,
          ta: official.ta,
          tb: official.tb,
          pos: official.pos,
          scheduleVersion: SCHEDULE_VERSION
        };
      }

      // Quando os times foram corrigidos, reinicia o resultado para não associar placares ao jogo errado.
      return official;
    });

    return [...officialMatches, ...customMatches];
  }

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  const data = readStore();
  const currentLocal = Array.isArray(data[TOURNAMENT_ID]) ? data[TOURNAMENT_ID] : [];
  const correctedLocal = rebuild(currentLocal);

  if (JSON.stringify(currentLocal) !== JSON.stringify(correctedLocal)) {
    data[TOURNAMENT_ID] = correctedLocal;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  if (!window.firebase || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
    return;
  }

  const db = firebase.firestore();

  firebase.auth().onAuthStateChanged(async user => {
    const isAdmin = Boolean(
      user && String(user.email || '').toLowerCase() === ADMIN_EMAIL
    );
    if (!isAdmin) return;

    try {
      const ref = db.collection('arenaData').doc(CLOUD_DOCUMENT);
      const snapshot = await ref.get();
      const currentRemote = snapshot.exists && Array.isArray(snapshot.data()?.games)
        ? snapshot.data().games
        : [];
      const correctedRemote = rebuild(currentRemote);

      if (JSON.stringify(currentRemote) === JSON.stringify(correctedRemote)) return;

      await ref.set({
        dataset: 'confrontos',
        tournamentId: TOURNAMENT_ID,
        scheduleVersion: SCHEDULE_VERSION,
        games: correctedRemote,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: String(user.email || '').toLowerCase()
      });
    } catch (error) {
      console.error('Falha ao corrigir os confrontos da Copa Grifo', error);
    }
  });
})();
