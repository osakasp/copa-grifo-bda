'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const C = require('../portal-core.js');
const seeds = require('../portal-data.js');
const state = () => C.hydrate(seeds,null).state;
const league = () => state().find(t=>t.id==='liga-b');
const memory = () => {const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
test('all 202 league fixtures exactly match the original PR and have unique pairs, games and byes',()=>{
 const baseline=execFileSync('git',['show','4f944b100b2f75e6c5d60322a9b65665b64be252:index.html'],{encoding:'utf8'});
 const source=baseline.slice(baseline.indexOf('const ligaAMatches='),baseline.indexOf('    const esc='));
 const original=JSON.parse(JSON.stringify(vm.runInNewContext(source+';seeds')));
 assert.deepEqual(seeds,original);
 for(const id of ['liga-a','liga-b'])assert.deepEqual(C.audit(state().find(t=>t.id===id)),[]);
 assert.equal(C.matchKeys(league()).length,136);
 assert.equal(league().byes[0],'Cruzeiro FC BDA');
 assert.deepEqual(league().matches[0][5],['Real City BDA','Esperança BDA']);
});
test('score validation rejects blanks, fractions, coercion and out-of-range input',()=>{
 for(const v of ['',null,undefined,true,{},[],-1,100,'1e1','0x10','01','1.5','<img>'])assert.equal(C.score(v),null,String(v));
 for(const v of [0,99,'0','99',' 2 '])assert.notEqual(C.score(v),null);
});
test('standings: 0x0 draw, win/loss, goal balance, unplayed and numeric strings',()=>{
 const t=league();t.results={'0:0':{home:'2',away:'1'},'0:1':{home:0,away:0}};
 const rows=C.standings(t),a=rows.find(r=>r.name==='Boleiros FC BDA'),b=rows.find(r=>r.name==='Sport Recife BDA');
 assert.equal(a.points,3);assert.equal(a.won,1);assert.equal(b.points,0);assert.equal(b.lost,1);
 assert.equal(rows.find(r=>r.name==='Vera Cruz BDA').points,1);
 assert.equal(rows.find(r=>r.name==='Cruzeiro FC BDA').played,0);
 assert.equal(rows.reduce((n,r)=>n+r.goalsFor-r.goalsAgainst,0),0);
});
test('loading preserves unknown competitions, fields, original calendars and results',()=>{
 const saved=state();saved[2].custom='preserve';saved[2].matches[0].reverse();saved[2].results={'0:0':{home:9,away:2}};
 saved.push({id:'extra',name:'Copa Extra',participants:['Clube Um','Clube Dois'],matches:[[['Clube Um','Clube Dois']]],results:{'0:0':{home:1,away:0}},format:'Mata-mata'});
 const loaded=C.hydrate(seeds,JSON.stringify(saved));assert.deepEqual(loaded.errors,[]);
 assert.equal(loaded.state.length,5);assert.equal(loaded.state[2].custom,'preserve');assert.deepEqual(loaded.state[2].matches,saved[2].matches);assert.deepEqual(loaded.state[4].results,saved[4].results);
});
test('malformed initial data is preserved byte for byte and writes fail closed',async()=>{
 for(const raw of ['{broken','null','[]',JSON.stringify([{id:'liga-b',participants:{bad:true}}]),JSON.stringify([...state(),state()[0]])]){
  const s=memory();s.setItem(C.KEY,raw);const repo=C.createRepository(s,seeds);
  assert.ok(repo.errors.length);await assert.rejects(repo.save(state()),/bloqueada/);assert.equal(s.getItem(C.KEY),raw);
 }
});
test('invalid histories, orphan scores and active payloads are rejected on every input path',()=>{
 for(const change of [t=>t.results={'999:0':{home:1,away:0}},t=>t.results={'0:0':{home:1,away:'<img onerror=alert(1)>'}},t=>t.resultHistory=[{at:1,results:{'999:0':{home:1,away:2}}}],t=>t.teamProfiles={'Boleiros FC BDA':{badge:'data:image/svg+xml,<svg onload=alert(1)>'}}]){
  const t=league();change(t);assert.throws(()=>C.validateTournament(t));
  const s=state();s[s.findIndex(x=>x.id===t.id)]=t;assert.ok(C.hydrate(seeds,JSON.stringify(s)).errors.length);
 }
});
test('save creates recovery and handles quota failure without optimistic state change',async()=>{
 const s=memory(),repo=C.createRepository(s,seeds);await repo.save(state());const before=s.getItem(C.KEY);
 const next=state();next[3]=C.patchResults(next[3],{'0:0':{home:2,away:1}});await repo.save(next);
 assert.equal(repo.recovery().at(-1).raw,before);
 const snapshot=repo.state;s.setItem=()=>{throw new Error('quota');};await assert.rejects(repo.save(state()),/quota/);assert.deepEqual(repo.state,snapshot);
});
test('two stale repositories cannot overwrite each other',async()=>{
 const s=memory(),first=C.createRepository(s,seeds),second=C.createRepository(s,seeds);
 await first.save(state());await assert.rejects(second.save(state()),/Conflito/);
 second.accept(s.getItem(C.KEY));await second.save(state());
});
test('storage events reject corruption and keep the last valid data',async()=>{
 const s=memory(),repo=C.createRepository(s,seeds);await repo.save(state());const before=repo.state;
 assert.throws(()=>repo.accept('{bad'));assert.throws(()=>repo.accept(null));assert.deepEqual(repo.state,before);
});
test('backup roundtrip restores scores, pending requests and badges without changing fixtures',()=>{
 const before=state(),changed=C.clone(before);changed[3]=C.addTeam(changed[3],'Equipe Nova');changed[3]=C.patchResults(changed[3],{'0:0':{home:0,away:0}});changed[3].teamProfiles={'Equipe Nova':{badge:'data:image/png;base64,YWJjZA=='}};
 const restored=C.restoreBackup(before,C.exportBackup(changed));assert.deepEqual(restored,changed);assert.equal(C.calendar(restored[3]),C.calendar(before[3]));
 const bad=C.exportBackup(changed);bad.tournaments[3].matches[0].reverse();assert.throws(()=>C.restoreBackup(before,bad),/divergente/);
});
test('backup rejects duplicate/unknown competitions, invalid snapshots and unsupported schemas',()=>{
 const backup=C.exportBackup(state());backup.tournaments.push(backup.tournaments[0]);assert.throws(()=>C.restoreBackup(state(),backup),/duplicada/);
 assert.throws(()=>C.restoreBackup(state(),{...backup,schemaVersion:99}),/versão/);
 const invalid=C.exportBackup(state());invalid.tournaments[0].id='unknown';assert.throws(()=>C.restoreBackup(state(),invalid),/desconhecida/);
});
test('team requests normalize whitespace, preserve calendars and do not allow in-season approval',()=>{
 const t=C.addTeam(league(),'  Novo   Clube  ');assert.equal(t.pendingTeams[0],'Novo Clube');assert.equal(C.calendar(t),C.calendar(league()));
 assert.throws(()=>C.addTeam(t,'NOVO CLUBE'),/já/);assert.throws(()=>C.approveTeam(t,'Novo Clube'),/fechado/);
 const cup=C.addTeam(state().find(t=>t.id==='copa-francos'),'Clube Novo');assert.equal(C.approveTeam(cup,'Clube Novo').participants.length,1);
});
test('score corrections and explicit clearing are reversible; no-op does not create history',()=>{
 const t=league();assert.equal(C.patchResults(t,{}),null);
 const first=C.patchResults(t,{'0:0':{home:0,away:0}}),second=C.patchResults(first,{'0:0':null});
 assert.deepEqual(second.results,{});assert.deepEqual(second.resultHistory.at(-1).results,first.results);
 assert.throws(()=>C.patchResults(t,{'0:0':{home:1,away:''}}));assert.throws(()=>C.patchResults(t,{'999:0':null}));
});
test('read-only audit reports errors without mutating tournament data',()=>{
 const t=league();t.matches[1][0]=t.matches[0][0];const before=JSON.stringify(t);assert.ok(C.audit(t).length);assert.equal(JSON.stringify(t),before);
});

test('legacy transport no longer removes Supercopa or forces 12 clubs/two turns',()=>{
 const source=fs.readFileSync('firestore-sync.js','utf8');
 const start=source.indexOf('  function normalizeTournaments('),end=source.indexOf('\n  function stable(',start);
 const normalize=vm.runInNewContext('const clone=v=>JSON.parse(JSON.stringify(v));'+source.slice(start,end)+';normalizeTournaments');
 const values=[{id:'supercopa',name:'Supercopa BDA'},{id:'liga-b',maxTeams:17,matchSettings:{leagueTurns:1}},{id:'liga-a-copy',name:'Liga A BDA',custom:42}];
 assert.deepEqual(JSON.parse(JSON.stringify(normalize(values))),values);assert.throws(()=>normalize({}));
});
