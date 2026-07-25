(() => {
  'use strict';

  const ADMIN_EMAIL = 'miniamikaren@gmail.com';
  const STORAGE_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_ID = 'copa-grifo';
  const CLOUD_DOCUMENT = `confrontos-${TOURNAMENT_ID}`;
  const SCHEDULE_VERSION = 3;

  const match = (id, phase, pos, ta, tb) => ({
    id,
    tieId: id,
    leg: 1,
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

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  const store = readStore();
  const localMatches = Array.isArray(store[TOURNAMENT_ID]) ? store[TOURNAMENT_ID] : [];

  // A tabela oficial é usada apenas na primeira criação.
  // Depois disso, o administrador pode editar todos os jogos livremente.
  if (localMatches.length === 0) {
    store[TOURNAMENT_ID] = OFFICIAL_MATCHES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
      const remoteMatches = snapshot.exists && Array.isArray(snapshot.data()?.games)
        ? snapshot.data().games
        : [];

      if (remoteMatches.length > 0) return;

      await ref.set({
        dataset: 'confrontos',
        tournamentId: TOURNAMENT_ID,
        scheduleVersion: SCHEDULE_VERSION,
        games: OFFICIAL_MATCHES,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: String(user.email || '').toLowerCase()
      });
    } catch (error) {
      console.error('Falha ao publicar a tabela inicial da Copa Grifo', error);
    }
  });
})();
