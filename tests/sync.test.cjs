'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../portal-core.js'),S=require('../portal-sync.js'),seeds=require('../portal-data.js');
const tournament=C.hydrate(seeds,null).state.find(t=>t.id==='liga-b');
const admin={uid:'admin',email:'claboleirosdeatitude@gmail.com',emailVerified:true};
function server(){
 let data={calendar:C.calendar(tournament),revision:0,results:{}},writes=0;
 const subscribers=new Set();
 return {get writes(){return writes;},get data(){return data;},
  client(user=admin){let listener;return{onAuth(fn){fn(user);return()=>{};},watch(id,fn,error){listener={fn,error};subscribers.add(listener);fn(C.clone(data));return()=>subscribers.delete(listener);},
   signIn:async()=>{},signOut:async()=>{},
   async commit({revision,patch}){if(revision!==data.revision)throw new Error('Conflito remoto');writes++;const t=C.patchResults({...tournament,results:data.results},patch);data={...data,revision:revision+1,results:t.results};subscribers.forEach(s=>s.fn(C.clone(data)));},
   emit(value){listener.fn(value);},fail(){listener.error(new Error('offline'));}};
  }
 };
}
test('two devices synchronize after confirmed transaction; stale drafts cannot overwrite',async()=>{
 const remote=server(),statesA=[],statesB=[];
 const a=S.createSync({transport:remote.client(),tournament,onState:s=>statesA.push(s)}),b=S.createSync({transport:remote.client(),tournament,onState:s=>statesB.push(s)});
 a.start();b.start();await a.save({'0:0':{home:2,away:1}},0);
 assert.equal(statesB.at(-1).tournament.results['0:0'].home,2);assert.equal(statesB.at(-1).revision,1);
 await assert.rejects(b.save({'0:0':{home:4,away:0}},0),/Conflito/);assert.equal(remote.writes,1);a.stop();b.stop();
});
test('anonymous, ordinary and unverified users cannot write through adapter',async()=>{
 for(const user of [null,{...admin,email:'user@example.com'},{...admin,emailVerified:false}]){const remote=server(),sync=S.createSync({transport:remote.client(user),tournament});sync.start();await assert.rejects(sync.save({'0:0':{home:1,away:0}},0),/verificada/);assert.equal(remote.writes,0);sync.stop();}
});
test('missing migration, calendar divergence, invalid remote scores and offline all block writes',async()=>{
 for(const value of [null,{calendar:'other',revision:0,results:{}},{calendar:C.calendar(tournament),revision:0,results:{'999:1':{home:2,away:1}}}]){const remote=server(),transport=remote.client(),sync=S.createSync({transport,tournament});sync.start();transport.emit(value);await assert.rejects(sync.save({'0:0':{home:1,away:0}},0));assert.equal(remote.writes,0);}
 const remote=server(),transport=remote.client(),sync=S.createSync({transport,tournament});sync.start();transport.fail();await assert.rejects(sync.save({'0:0':{home:1,away:0}},0));assert.equal(remote.writes,0);
});
test('failed server write never reports saved or mutates local results',async()=>{
 const remote=server(),transport=remote.client(),states=[];transport.commit=async()=>{throw new Error('permission-denied');};
 const sync=S.createSync({transport,tournament,onState:s=>states.push(s)});sync.start();await assert.rejects(sync.save({'0:0':{home:1,away:0}},0),/permission/);
 assert.equal(states.some(s=>s.status==='saved'),false);assert.deepEqual(states.at(-1).tournament.results,{});
});
test('disabled portal configuration never initializes Firebase automatically',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),context={window:{}};vm.runInNewContext(fs.readFileSync('portal-config.js','utf8'),context);assert.equal(context.window.ArenaPortalConfig.enabled,false);
});
