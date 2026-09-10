import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from '../src/worker.mjs';
import {mergeChanges} from '../src/sync-merge.js';

test('shorter notes, lower settings and deletions survive sync',()=>{
 const base={note:'An older longer note',done:[1,2],completed:true,font:22};
 const local={note:'New',done:[1],completed:false,font:16};
 assert.deepEqual(mergeChanges(base,local,base),local);
});
test('independent device changes merge and explicit deletions remain deleted',()=>{
 const base={notes:[{id:'a',text:'old'},{id:'b',text:'remove'}],done:[1]};
 const local={notes:[{id:'a',text:'new'}],done:[1]};
 const remote={...base,done:[1,2]};
 assert.deepEqual(mergeChanges(base,local,remote),{notes:[{id:'a',text:'new'}],done:[1,2]});
});
test('conflicting text preserves this device edit and reports conflict',()=>{
 const conflicts=[];assert.deepEqual(mergeChanges({note:'base'},{note:'local'},{note:'remote'},conflicts),{note:'local'});assert.deepEqual(conflicts,['/note']);
});
test('prototype keys are removed during recursive merges',()=>{
 const v=mergeChanges({},JSON.parse('{"__proto__":{"polluted":true},"x":1}'),{y:2});assert.equal({}.polluted,undefined);assert.equal(Object.hasOwn(v,'__proto__'),false);
});
function setup(){
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('migrations/0001_progress.sql','utf8'));
 const key='a'.repeat(64);
 return {db,key,env:{APP_ID:'test',SYNC_KEY_HASH:'',PROGRESS_DB:{prepare(sql){return {bind(...params){return {async first(){return db.prepare(sql).get(...params)||null;}};}}}}}};
}
async function request(ctx,method,body,auth=true){
 if(!ctx.env.SYNC_KEY_HASH)ctx.env.SYNC_KEY_HASH=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ctx.key))).toString('hex');
 return worker.fetch(new Request('https://app.test/api/progress',{method,headers:{...(auth?{Authorization:'Bearer '+ctx.key}:{}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),ctx.env);
}
test('unauthorized access is refused',async()=>{const c=setup();assert.equal((await request(c,'GET',undefined,false)).status,401);c.db.close();});
test('stale revisions never overwrite saved state; edits can delete data',async()=>{
 const c=setup();const first=await request(c,'PUT',{revision:0,state:{done:[1,2],drafts:{response:'a'}}});assert.equal(first.status,200);assert.match(first.headers.get('x-sync-id'),/^[0-9a-f-]{36}$/i);
 assert.equal((await request(c,'PUT',{revision:0,state:{done:[3]}})).status,409);
 assert.equal((await request(c,'PUT',{revision:1,state:{done:[1]}})).status,200);
 assert.deepEqual((await (await request(c,'GET')).json()).state,{done:[1]});
 assert.equal((await request(c,'PUT',{state:{done:[]}})).status,409);c.db.close();
});

test('sync operations have stable client IDs across acknowledgement',async()=>{
 const c=setup();const id='11111111-1111-4111-8111-111111111111';const r=await request(c,'PUT',{revision:0,syncId:id,state:{done:[1]}});assert.equal(r.headers.get('x-sync-id'),id);assert.equal((await (await request(c,'GET')).json()).revision,1);c.db.close();
});
test('oversized bodies, invalid revisions and legacy beacons cannot write',async()=>{
 const c=setup();assert.equal((await request(c,'PUT',{revision:0,state:{text:'x'.repeat(2000000)}})).status,413);
 assert.equal((await request(c,'PUT',{revision:10,state:{x:1}})).status,409);
 assert.equal((await worker.fetch(new Request('https://app.test/api/progress-beacon',{method:'POST',body:'{}'}),c.env)).status,409);c.db.close();
});
