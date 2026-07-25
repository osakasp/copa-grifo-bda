(() => {
  'use strict';

  const ADMIN_EMAIL = 'miniamikaren@gmail.com';
  const STORAGE_KEY = 'bda-v3-confrontos';
  const TOURNAMENT_ID = 'copa-grifo';
  const CLOUD_DOCUMENT = `confrontos-${TOURNAMENT_ID}`;

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
    updated: 1784999000000 + pos
  });

  const INITIAL_MATCHES = [
    match('p1', 'Preliminar', 1, 'mozamigos bda', 'FLORENCE REAL FC BDA'),
    match('p2', 'Preliminar', 2, 'BDA URDLS', 'CV CRUZ BDA'),
    match('p3', 'Preliminar', 3, 'INTER BRASIL BDA', 'MILAN AC BDA'),

    match('j1', 'Oitavas de final', 1, 'REDBULL BDA', 'São Paulo BDA'),
    match('j2', 'Oitavas de final', 2, 'BDA GOLDEN FC', 'Cajueiro BDA'),
    match('j3', 'Oitavas de final', 3, 'Vasco da gama bda', 'INDEPENDENTE FC BDA'),
    match('j4', 'Oitavas de final', 4, 'JOGOBUGADO BDA', 'Zombie Fc BDA'),
    match('j5', 'Oitavas de final', 5, 'FLAMESTRE FC BDA', 'HELLYEAH BDA'),
    match('j6', 'Oitavas de final', 6, 'MACIEIRA BDA', 'Sport Recife BDA'),
    match('j7', 'Oitavas de final', 7, 'IMORTAIS FC BDA', 'Vencedor P1'),
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

  const data = readStore();
  const current = Array.isArray(data[TOURNAMENT_ID]) ? data[TOURNAMENT_ID] : [];
  const seededNow = current.length === 0;

  if (seededNow) {
    data[TOURNAMENT_ID] = INITIAL_MATCHES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  if (!seededNow || !window.firebase || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
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
      const remoteGames = snapshot.exists && Array.isArray(snapshot.data()?.games)
        ? snapshot.data().games
        : [];

      if (remoteGames.length > 0) return;

      await ref.set({
        dataset: 'confrontos',
        tournamentId: TOURNAMENT_ID,
        games: INITIAL_MATCHES,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: String(user.email || '').toLowerCase()
      });
    } catch (error) {
      console.error('Falha ao publicar confrontos iniciais', error);
    }
  });
})();
