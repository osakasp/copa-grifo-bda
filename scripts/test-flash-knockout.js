'use strict';

const assert = require('node:assert/strict');

global.window = {};
require('../flash-cup-knockout-engine.js');

const engine = global.window.ArenaBDAFlashKnockout;
assert.equal(engine.version, 1);

const match = (phase, teamA, teamB, scoreA, scoreB, extra = {}) => ({ phase, teamA, teamB, scoreA, scoreB, decision: 'normal', ...extra });
const quarters = [
  match('Quartas de final', 'A', 'B', 2, 0),
  match('Quartas de final', 'C', 'D', 1, 3),
  match('Quartas de final', 'E', 'F', 0, 1),
  match('Quartas de final', 'G', 'H', 4, 2)
];
const semifinal = engine.planRound({ phase: 'Quartas de final', matches: quarters });
assert.equal(semifinal.complete, true);
assert.equal(semifinal.phase, 'Semifinal');
assert.deepEqual(semifinal.pairs, [
  { position: 1, teamA: 'A', teamB: 'D' },
  { position: 2, teamA: 'F', teamB: 'G' }
]);

const pending = engine.planRound({ phase: 'Quartas de final', matches: [...quarters.slice(0, 3), match('Quartas de final', 'G', 'H', '', '')] });
assert.equal(pending.complete, false);

const preliminary = engine.planRound({
  phase: 'Preliminar',
  byes: ['A', 'B', 'C'],
  matches: [match('Preliminar', 'D', 'E', 0, 1)]
});
assert.equal(preliminary.phase, 'Semifinal');
assert.deepEqual(preliminary.pairs, [
  { position: 1, teamA: 'A', teamB: 'B' },
  { position: 2, teamA: 'C', teamB: 'E' }
]);

assert.equal(engine.winner(match('Final', 'A', 'B', 1, 1, { decision: 'penalties', penaltiesA: 5, penaltiesB: 4 })), 'a');
assert.equal(engine.winner(match('Final', 'A', 'B', '', '', { decision: 'wo-b' })), 'b');
assert.equal(engine.winner(match('Final', 'A', 'B', 1, 1)), '');

const final = engine.planRound({ phase: 'Final', matches: [match('Final', 'A', 'B', '', '', { decision: 'wo-b' })] });
assert.equal(final.complete, true);
assert.equal(final.champion, 'B');
assert.equal(final.runnerUp, 'A');

console.log('Mata-mata Flash validado: avanço, pênaltis, WO, pendências e campeão consistentes.');
