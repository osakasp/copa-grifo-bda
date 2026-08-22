(() => {
  'use strict';

  if (window.ArenaBDAFlashKnockout?.version >= 1) return;

  const PHASES = Object.freeze(['Preliminar', '16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']);
  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const hasScore = value => value !== '' && value != null && !Number.isNaN(Number(value));

  function winner(match) {
    const decision = String(match?.decision || '');
    if (decision === 'wo-a') return 'a';
    if (decision === 'wo-b') return 'b';
    if (decision === 'scheduled' || decision === 'cancelled') return '';
    if (!hasScore(match?.scoreA) || !hasScore(match?.scoreB)) return '';

    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);
    if (scoreA !== scoreB) return scoreA > scoreB ? 'a' : 'b';
    if (!hasScore(match?.penaltiesA) || !hasScore(match?.penaltiesB)) return '';
    if (Number(match.penaltiesA) === Number(match.penaltiesB)) return '';
    return Number(match.penaltiesA) > Number(match.penaltiesB) ? 'a' : 'b';
  }

  function winningTeam(match) {
    const side = winner(match);
    return side === 'a' ? String(match?.teamA || '').trim() : side === 'b' ? String(match?.teamB || '').trim() : '';
  }

  function nextPhase(phase) {
    const index = PHASES.indexOf(phase);
    return index >= 0 && index < PHASES.length - 1 ? PHASES[index + 1] : '';
  }

  function phaseForEntrants(size) {
    if (size <= 2) return 'Final';
    if (size <= 4) return 'Semifinal';
    if (size <= 8) return 'Quartas de final';
    if (size <= 16) return 'Oitavas de final';
    if (size <= 32) return '16 avos de final';
    return 'Preliminar';
  }

  function uniqueTeams(values) {
    const teams = new Map();
    values.forEach(value => {
      const name = String(value || '').trim();
      const key = norm(name);
      if (key && !teams.has(key)) teams.set(key, name);
    });
    return [...teams.values()];
  }

  function planRound({ phase, matches, byes = [] }) {
    const current = (Array.isArray(matches) ? matches : []).filter(match => match?.phase === phase);
    if (!PHASES.includes(phase) || !current.length) {
      return Object.freeze({ complete: false, final: false, phase: '', pairs: Object.freeze([]), champion: '', runnerUp: '' });
    }

    const winners = current.map(winningTeam);
    if (winners.some(name => !name)) {
      return Object.freeze({ complete: false, final: phase === 'Final', phase: '', pairs: Object.freeze([]), champion: '', runnerUp: '' });
    }

    if (phase === 'Final') {
      if (current.length !== 1) throw new Error('A fase final precisa ter exatamente um jogo');
      const match = current[0];
      const side = winner(match);
      return Object.freeze({
        complete: true,
        final: true,
        phase: 'Final',
        pairs: Object.freeze([]),
        champion: side === 'a' ? match.teamA : match.teamB,
        runnerUp: side === 'a' ? match.teamB : match.teamA
      });
    }

    const entrants = uniqueTeams([...(phase === 'Preliminar' ? byes : []), ...winners]);
    if (entrants.length < 2 || entrants.length % 2 !== 0) {
      throw new Error('A quantidade de classificados não permite montar a próxima fase');
    }
    const phaseName = phase === 'Preliminar' ? phaseForEntrants(entrants.length) : nextPhase(phase);
    const pairs = [];
    for (let index = 0; index < entrants.length; index += 2) {
      pairs.push(Object.freeze({ position: pairs.length + 1, teamA: entrants[index], teamB: entrants[index + 1] }));
    }
    return Object.freeze({
      complete: true,
      final: false,
      phase: phaseName,
      pairs: Object.freeze(pairs),
      champion: '',
      runnerUp: ''
    });
  }

  window.ArenaBDAFlashKnockout = Object.freeze({
    version: 1,
    phases: PHASES,
    hasScore,
    winner,
    winningTeam,
    nextPhase,
    phaseForEntrants,
    planRound
  });
})();
