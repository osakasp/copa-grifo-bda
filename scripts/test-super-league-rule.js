'use strict';

const assert = require('node:assert/strict');

const memory = new Map();
global.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value))
};
global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
global.Element = class Element {};
global.MutationObserver = class MutationObserver {
  observe() {}
};
global.requestAnimationFrame = () => 1;
global.document = {
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  documentElement: {},
  head: { append() {} }
};
global.window = {
  addEventListener() {},
  dispatchEvent() {},
  ArenaBDAAuth: { isAdmin: () => false }
};

require('../super-league-rule.js');

const rule = global.window.ArenaBDASuperLeagueRule;
assert.equal(rule.version, 2);
assert.equal(rule.qualifiers, 2);

const normalized = rule.normalizeGames([
  { id: 'grupo-a-1', phase: 'Grupo A • Rodada 1', ta: 'Time A', tb: 'Time B' },
  { id: 'mata-antigo-rep-1', phase: 'Repescagem', ta: 'Time C', tb: 'Time D' },
  { id: 'mata-antigo-playin-1', phase: 'Play-in', ta: 'Time E', tb: 'Time F' },
  { id: 'mata-super-league-qf1', phase: 'Quartas de final', ta: 'Time G', tb: 'Vencedor Play-in 1', a: 3, b: 0 }
]);

assert.equal(normalized.filter(game => String(game.phase).startsWith('Grupo')).length, 1);
assert.equal(normalized.filter(game => game.phase === 'Quartas de final').length, 4);
assert.equal(normalized.filter(game => game.phase === 'Semifinal').length, 2);
assert.equal(normalized.filter(game => game.phase === 'Final').length, 1);
assert.equal(normalized.some(game => /repescagem|play-in/i.test(game.phase)), false);
assert.deepEqual(
  normalized.filter(game => game.phase === 'Quartas de final').map(game => [game.ta, game.tb]),
  [
    ['1º Grupo A', '2º Grupo B'],
    ['1º Grupo B', '2º Grupo A'],
    ['1º Grupo C', '2º Grupo D'],
    ['1º Grupo D', '2º Grupo C']
  ]
);
assert.equal(normalized.find(game => game.id === 'mata-super-league-qf1').a, '');

global.window.ArenaBDASuperLeagueRuntimeFix = {
  calculate: () => ['A', 'B', 'C', 'D'].map((group, groupIndex) => ({
    name: `Grupo ${group}`,
    rows: [
      { name: `${group} Líder`, pts: 9, v: 3, sg: 6, gp: 8, j: 1 },
      { name: `${group} Vice`, pts: 6, v: 2, sg: 3, gp: 5, j: 1 }
    ].map(row => ({ ...row, j: 1, groupIndex }))
  }))
};

assert.equal(rule.groupsComplete(), true);
const generated = rule.buildKnockout();
assert.equal(generated.length, 7);
assert.deepEqual(
  generated.filter(game => game.phase === 'Quartas de final').map(game => [game.ta, game.tb]),
  [
    ['A Líder', 'B Vice'],
    ['B Líder', 'A Vice'],
    ['C Líder', 'D Vice'],
    ['D Líder', 'C Vice']
  ]
);

const generatedWithResult = generated.map(game => game.id === 'mata-super-league-qf1'
  ? { ...game, a: 2, b: 1, updated: Date.now() }
  : game);
localStorage.setItem('bda-v3-confrontos', JSON.stringify({
  'bda-super-league': [{ id: 'grupo-a-1', phase: 'Grupo A • Rodada 1' }, ...generatedWithResult]
}));
assert.equal(rule.resetKnockout('test-group-change'), true);
const resetGames = JSON.parse(localStorage.getItem('bda-v3-confrontos'))['bda-super-league'];
assert.equal(resetGames.find(game => game.id === 'mata-super-league-qf1').ta, '1º Grupo A');
assert.equal(resetGames.find(game => game.id === 'mata-super-league-qf1').a, '');
assert.equal(JSON.parse(localStorage.getItem('bda-v114-super-league-legacy-knockout-backup')).reason, 'test-group-change');

let domWrites = 0;
const textNode = initial => {
  let value = initial;
  return {
    get textContent() { return value; },
    set textContent(next) { domWrites += 1; value = next; }
  };
};
const legend = {
  ...textNode(''),
  dataset: {},
  get innerHTML() { return this._html || ''; },
  set innerHTML(value) { domWrites += 1; this._html = value; }
};
const meta = textNode('3 classificam • 5 clubes');
const ruleCopy = textNode('Regra antiga');
const overview = textNode('Resumo antigo');
const label = textNode('3 classificados');
const title = textNode('Fase final');
const description = textNode('Descrição antiga');
const footer = textNode('Repescagem');
const button = { ...textNode('Gerar fase final'), hidden: false, disabled: false };
const section = {
  querySelector: selector => selector === ':scope > header > span' ? meta : null,
  querySelectorAll: () => []
};
const panel = {
  firstChild: {},
  querySelectorAll: selector => selector === '.stand-group' ? [section] : [],
  querySelector: selector => ({
    '#superLeagueRuleLegend': legend,
    '.stand-rule': ruleCopy
  })[selector] || null
};
const card = {
  querySelector: selector => ({
    h3: title,
    p: description,
    'footer span': footer,
    '[data-generate-knockout]': button
  })[selector] || null
};
const manager = {
  querySelector: selector => ({
    '#autoStandings': panel,
    '#superLeagueGroupsOverview .slg-overview-head p': overview,
    '.league-knockout-card': card
  })[selector] || null,
  querySelectorAll: selector => selector === '#superLeagueGroupsOverview .slg-card header small' ? [label] : []
};
document.getElementById = id => id === 'superLeagueDirectRuleStyles' ? {} : null;
document.querySelector = selector => selector === '#giManager[data-tid="bda-super-league"]' ? manager : null;

rule.patchUi();
const writesAfterFirstPatch = domWrites;
rule.patchUi();
assert.equal(domWrites, writesAfterFirstPatch, 'a segunda renderização não pode reescrever o DOM');

console.log('Regra da Super League validada: 2 classificados diretos e 7 jogos eliminatórios.');
