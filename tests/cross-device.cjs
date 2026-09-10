const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 const wait=async(fn)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out waiting for state');};
 try {
 for(const [app,port,key,field,value] of [
  ['history',19001,'civilization-atlas-v1','done',['1|myers-1-0']],
  ['english',19002,'grammar-room-v1','done',[2,3]],
  ['philosophy',19003,'philosophy-scholar-v1','lessons',{f1:{complete:true,stage:6,answers:{},drafts:{},read:true,attempts:1}}]
 ]) {
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  for(const c of contexts)await c.addInitScript(()=>localStorage.setItem('learning-cloud-key-v1','a'.repeat(64)));
  const [a,b]=await Promise.all(contexts.map(c=>c.newPage())); const errors=[];
  for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${port}/`;
  const get=async p=>p.evaluate(({key})=>JSON.parse(localStorage.getItem(key)),{key});
  const edit=async(p,changes)=>{if(app==='philosophy'){await p.evaluate(({key,changes})=>{const s=JSON.parse(localStorage.getItem(key));Object.assign(s,changes);localStorage.setItem(key,JSON.stringify(s));},{key,changes});await p.reload();return;}return p.evaluate(({app,changes})=>{
    if(app==='philosophy'){Object.assign(state(),changes);save();}
    else {Object.assign(state,changes);if(app==='english')save();else persist();}
  },{app,changes});};
  await a.goto(url); await wait(async()=>await a.locator('[data-learning-sync] summary').textContent()==='Saved');
  await edit(a,{[field]:value});await wait(async()=>await a.locator('[data-learning-sync] summary').textContent()==='Saved');
  await b.goto(url);await wait(async()=>JSON.stringify((await get(b))?.[field])===JSON.stringify(value));
  // Inspect live application state, not only browser storage.
  if(app==='philosophy'){await b.goto(url+'#worlds');await wait(async()=>await b.locator('a[href="#lesson/f1"]').first().textContent()==='Revisit');}
  else await wait(async()=>await b.evaluate(({app,field,value})=>JSON.stringify((app==='philosophy'?state():state)[field])===JSON.stringify(value),{app,field,value}));
  assert.equal(await b.locator('aside[aria-label="Cloud progress sync"]').count(),0);
  if(app!=='philosophy') {
   await edit(a,{done:[]}); await wait(async()=>(await get(b)).done.length===0);
   const left=app==='history'?'1|myers-1-5':5,right=app==='history'?'1|myers-1-6':6;
   await contexts[1].setOffline(true);
   await edit(b,{done:[left]});
   await edit(a,{done:[right]});await wait(async()=>await a.locator('[data-learning-sync] summary').textContent()==='Saved');
   await contexts[1].setOffline(false);await b.evaluate(()=>LearningSync.syncNow());
   await wait(async()=>{const x=(await get(a)).done;return x.includes(left)&&x.includes(right);});
  }
  if(app==='english') {
   await b.locator('#notes').fill('Draft while remote changes arrive');
   await edit(a,{saved:[8]});
   await wait(async()=>(await get(b)).saved.includes(8));
   await b.locator('#notes').fill('Draft stays intact');
   await b.locator('#notes').blur();
   await wait(async()=>(await get(a)).notes[(await get(b)).current]==='Draft stays intact');
   assert((await get(a)).saved.includes(8),'remote bookmark survives active local writing');
  }
  if(app==='english') {
   // Concurrent edits to one answer retain the losing version across downloads.
   const current=(await get(b)).current;
   await contexts[1].setOffline(true);
   await edit(b,{notes:{...(await get(b)).notes,[current]:'Offline answer'}});
   await edit(a,{notes:{...(await get(a)).notes,[current]:'Other device answer'}});
   await wait(async()=>await a.locator('[data-learning-sync] summary').textContent()==='Saved');
   await contexts[1].setOffline(false);await b.evaluate(()=>LearningSync.syncNow());
   const conflicts=()=>b.evaluate(()=>JSON.parse(localStorage.getItem('learning-sync-v2-grammar-reader-conflicts')||'[]'));
   await wait(async()=>(await conflicts()).some(x=>x.local.notes[current]==='Offline answer'&&x.remote.notes[current]==='Other device answer'));
   for(let i=9;i<13;i++) {
    await edit(a,{saved:[i]});
    await wait(async()=>(await get(b)).saved.includes(i));
   }
   assert((await conflicts()).some(x=>x.remote.notes[current]==='Other device answer'),'conflict survives routine downloads');
  }
  if(app==='philosophy') {
   await a.goto(url+'#notes');
   await a.locator('#note-text').fill('Unfinished thought');
   await a.reload();
   assert.equal(await a.locator('#note-text').inputValue(),'Unfinished thought','draft survives reload');
   await b.goto(url+'#notes');
   await wait(async()=>await b.locator('#note-text').inputValue()==='Unfinished thought');
   await contexts[1].setOffline(true);
   await b.locator('#note-text').fill('Offline philosophy draft');
   await contexts[1].setOffline(false);await b.locator('#note-text').blur();await b.evaluate(()=>LearningSync.syncNow());
   await wait(async()=>await a.locator('#note-text').inputValue()==='Offline philosophy draft');
   await a.locator('#save-note').click();
   await wait(async()=>(await get(b)).notes.some(n=>n.text==='Offline philosophy draft'));
   await wait(async()=>await b.locator('#note-text').inputValue()==='');
  }
  await b.setViewportSize({width:390,height:844});
  // innerWidth updates before the layout reflows, and slower runners lag a
  // frame, so let the resize settle before measuring.
  await b.waitForTimeout(150);
  assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,app+' mobile overflow');
  assert.deepEqual(errors,[],app+' browser errors');
  console.log('PASS',app,'two-device state, automatic application, mobile'+(app!=='philosophy'?', deletions, offline merge':''));
  await Promise.all(contexts.map(c=>c.close()));
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
