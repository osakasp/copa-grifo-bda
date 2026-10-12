'use strict';
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp}=require('firebase/firestore');
const C=require('../portal-core.js'),seeds=require('../portal-data.js');
const t=C.hydrate(seeds,null).state.find(t=>t.id==='liga-b');
let env;
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Emulator is mandatory; never run against a real project');
 env=await initializeTestEnvironment({projectId:'demo-arena-bda',firestore:{rules:fs.readFileSync('docs/firestore-portal-v2.rules','utf8')}});
});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'portalV2/ liga-b'.replace(' ','')),{calendar:C.calendar(t),allowedMatchKeys:C.matchKeys(t),revision:0,updatedAt:new Date(0),updatedBy:'migration'});});});
const dbFor=(email,verified=true)=>email?env.authenticatedContext('user',{email,email_verified:verified}).firestore():env.unauthenticatedContext().firestore();
function batch(db,{key='0:0',home=2,away=1,revision=1,calendar,uid='user',cleared=false,audit=true}={}){
 const b=writeBatch(db),base='portalV2/liga-b',stamp={revision,updatedAt:serverTimestamp(),updatedBy:uid};
 b.update(doc(db,base),{...stamp,...(calendar?{calendar}:{})});b.set(doc(db,base+'/results/'+key),{home,away,cleared,...stamp});
 if(audit)b.set(doc(db,base+'/events/'+revision),{...stamp,keys:[key]});return b.commit();
}
test('public can read migrated competition but cannot write/create/delete',async()=>{
 const db=dbFor();await assertSucceeds(getDoc(doc(db,'portalV2/liga-b')));await assertFails(batch(db));await assertFails(deleteDoc(doc(db,'portalV2/liga-b')));await assertFails(setDoc(doc(db,'portalV2/new'),{}));
});
test('ordinary and unverified users cannot update scores',async()=>{
 await assertFails(batch(dbFor('member@example.com')));await assertFails(batch(dbFor('claboleirosdeatitude@gmail.com',false)));
});
test('verified admin commits a score with atomic revision and immutable audit event',async()=>{
 const db=dbFor('claboleirosdeatitude@gmail.com');await assertSucceeds(batch(db));assert.equal((await getDoc(doc(db,'portalV2/liga-b/results/0:0'))).data().home,2);
 await assertFails(updateDoc(doc(db,'portalV2/liga-b/events/1'),{keys:[]}));await assertFails(deleteDoc(doc(db,'portalV2/liga-b/results/0:0')));
});
test('negative, fractional, too large and wrong-type scores fail in server rules',async()=>{
 for(const home of [-1,100,1.5,'2',null])await assertFails(batch(dbFor('claboleirosdeatitude@gmail.com'),{home}));
});
test('unknown game, fixture mutation, skipped revision, wrong actor and missing audit fail',async()=>{
 const db=dbFor('claboleirosdeatitude@gmail.com');
 for(const options of [{key:'999:999'},{calendar:'tampered'},{revision:2},{uid:'other'},{audit:false},{cleared:true,home:3}])await assertFails(batch(db,options));
});
test('stale updates fail and clearing uses an explicit tombstone instead of deleting',async()=>{
 const db=dbFor('claboleirosdeatitude@gmail.com');await assertSucceeds(batch(db));await assertFails(batch(db));await assertSucceeds(batch(db,{revision:2,cleared:true,home:0,away:0}));assert.equal((await getDoc(doc(db,'portalV2/liga-b/results/0:0'))).data().cleared,true);
});
test('admin cannot rewrite fixtures, initialize seeds or write unrelated collections',async()=>{
 const db=dbFor('claboleirosdeatitude@gmail.com');await assertFails(updateDoc(doc(db,'portalV2/liga-b'),{allowedMatchKeys:['999:0']}));await assertFails(setDoc(doc(db,'portalV2/new'),{}));await assertFails(setDoc(doc(db,'arenaData/legacy'),{value:1}));
});
