'use strict';

const assert = require('node:assert/strict');

global.window = {};
require('../flash-cup-draw-engine.js');

const engine = global.window.ArenaBDAFlashDraw;
assert.equal(engine.version, 1);

const four = engine.build(['A', 'B', 'C', 'D'], 'seed-4');
assert.equal(four.phase, 'Semifinal');
assert.equal(four.pairs.length, 2);
assert.equal(four.byes.length, 0);

const five = engine.build(['A', 'B', 'C', 'D', 'E'], 'seed-5');
assert.equal(five.phase, 'Preliminar');
assert.equal(five.nextPhase, 'Semifinal');
assert.equal(five.pairs.length, 1);
assert.equal(five.byes.length, 3);

const six = engine.build(['A', 'B', 'C', 'D', 'E', 'F'], 'seed-6');
assert.equal(six.pairs.length, 2);
assert.equal(six.byes.length, 2);

const eight = engine.build(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 'seed-8');
assert.equal(eight.phase, 'Quartas de final');
assert.equal(eight.pairs.length, 4);

const repeat = engine.build(['A', 'B', 'C', 'D', 'E', 'F'], 'seed-6');
assert.deepEqual(repeat.pairs, six.pairs);
assert.deepEqual(repeat.byes, six.byes);

const assigned = [...six.pairs.flatMap(pair => [pair.teamA, pair.teamB]), ...six.byes];
assert.equal(new Set(assigned).size, 6);
assert.throws(() => engine.build(['A']), /pelo menos 2 times/);

console.log('Sorteio Flash validado: confrontos, preliminares, folgas e repetibilidade consistentes.');
