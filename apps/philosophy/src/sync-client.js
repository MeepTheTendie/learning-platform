(() => {
 const script=document.currentScript;
 const app=script.dataset.app, keyName=script.dataset.storage;
 const metaName='learning-sync-v2-'+app, recoveryName=metaName+'-recovery';
 const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
 const read=name=>{try{return JSON.parse(get.call(localStorage,name));}catch{return null;}};
 const write=(name,value)=>set.call(localStorage,name,JSON.stringify(value));
 let meta=read(metaName)||{revision:0,base:null}, busy=false,timer,retry=1000,widget,conflictCount=0;
 let displayed=read(keyName), dirty=false, mergeFn;
 const state=()=>read(keyName);
 const getKey=()=>document.cookie.split('; ').find(v=>v.startsWith('learning_sync_key='))?.slice(18)||get.call(localStorage,'learning-cloud-key-v1')||'';
 if(location.hash.startsWith('#sync=')) {
  const key=new URLSearchParams(location.hash.slice(1)).get('sync')||'';
  if(/^[a-f0-9]{64}$/.test(key)) {
   document.cookie='learning_sync_key='+key+'; Domain=history-atlas.workers.dev; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
   set.call(localStorage,'learning-cloud-key-v1',key);
   history.replaceState(null,'',location.pathname+location.search);
  }
 }
 function status(message) {
  if(!widget||!document.body)return;
  widget.label.textContent=message;
  widget.pair.hidden=!getKey();
 }
 function backup(local,remote) {
  const copies=read(recoveryName)||[];
  copies.push({at:new Date().toISOString(),local,remote});
  // Do not overwrite learner state if retaining recovery copies fails.
  write(recoveryName,copies.slice(-3));
 }
 function queue(delay=500){clearTimeout(timer);timer=setTimeout(sync,delay);}
 Storage.prototype.setItem=function(key,value){
  if(this===localStorage&&key===keyName) {
   let incoming;try{incoming=JSON.parse(value);}catch{set.call(this,key,value);return;}
   const combined=mergeFn?mergeFn(displayed??undefined,incoming,state()??undefined):incoming;
   set.call(this,key,JSON.stringify(combined));displayed=incoming;dirty=true;status('Sync: changes pending');queue();
  } else set.call(this,key,value);
 };
 async function request(method,body) {
  const response=await fetch('/api/progress',{method,headers:{Authorization:'Bearer '+getKey(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(response.status===409&&data.error==='conflict')return {conflict:true,...data};
  if(!response.ok)throw Error(response.status===401?'Pair this device':response.status===413?'Progress is too large to sync — export a backup':'Offline — changes kept on this device');
  return data;
 }
 async function sync() {
  if(busy){dirty=true;return;}
  if(!getKey()){status('Sync: pair this device');return;}
  busy=true;
  try {
   const {mergeChanges,equal}=await import('/sync-merge.js');mergeFn=mergeChanges;
   let remote=await request('GET');
   for(let attempt=0;attempt<5;attempt++) {
    const local=state(), conflicts=[];
    let combined=local===null?remote.state:mergeChanges(meta.base??undefined,local,remote.state??undefined,conflicts);
    if(combined==null){status('Sync: ready');return;}
    if(!equal(local,combined)||conflicts.length)backup(local,remote.state);
    const sent=combined;
    const result=equal(sent,remote.state)?remote:await request('PUT',{revision:remote.revision,state:sent});
    if(result.conflict){remote=result;continue;}
    // Capture edits typed while the request was in flight; they stay pending.
    const now=state();
    const next=equal(now,local)?sent:mergeChanges(local??undefined,now,sent,conflicts);
    write(keyName,next);
    meta={revision:result.revision,base:result.state,updatedAt:result.updatedAt};write(metaName,meta);
    conflictCount+=conflicts.length;
    dirty=!equal(next,result.state);
    retry=1000;
    if(!equal(next,displayed)) {
     // The apps hold state in memory. Let the learner apply downloaded changes
     // by refreshing, without interrupting an answer or an active reading.
     widget?.refresh.removeAttribute('hidden');
     status('Sync: updates ready — refresh to apply');
    } else status('Synced '+new Date(result.updatedAt||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+(conflictCount?' — conflict copy saved':''));
    if(dirty)queue();
    return;
   }
   throw Error('Sync is busy — retrying; changes kept locally');
  } catch(error) {
   status(error.name==='QuotaExceededError'?'Storage full — export your progress':error.message==='Pair this device'?error.message:'Sync unavailable — changes kept locally');
   if(error.message!=='Pair this device'){queue(retry);retry=Math.min(retry*2,60000);}
  } finally {busy=false;}
 }
 function init() {
  const box=document.createElement('aside');box.setAttribute('aria-label','Cloud progress sync');
  box.style.cssText='position:fixed;right:8px;bottom:8px;max-width:calc(100vw - 16px);box-sizing:border-box;z-index:10000;padding:8px;border-radius:8px;background:#10202b;color:white;font:12px system-ui;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
  const label=document.createElement('span');label.setAttribute('role','status');label.setAttribute('aria-live','polite');
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;b.style.cssText='font:inherit;padding:6px;min-height:32px';box.append(b);return b;};
  box.append(label);
  const pair=button('Pair device',async()=>{const link='https://history-atlas.history-atlas.workers.dev/#sync='+encodeURIComponent(getKey());try{await navigator.clipboard.writeText(link);status('Pairing link copied — keep it private');}catch{prompt('Copy this private pairing link',link);}});
  const refresh=button('Apply updates',()=>location.reload());refresh.hidden=true;
  button('Recovery backup',()=>{const blob=new Blob([JSON.stringify({app,current:state(),synced:meta.base,recovery:read(recoveryName)||[]},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=app+'-sync-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
  widget={label,pair,refresh};document.body.append(box);status('Sync: connecting');queue(0);
 }
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',init,{once:true});else init();
 addEventListener('online',()=>queue(0));
 addEventListener('focus',()=>queue(0));
 addEventListener('storage',event=>{if(event.key===keyName){widget?.refresh.removeAttribute('hidden');status('Another tab has updates — refresh to apply');}});
 // Pending state is already persisted synchronously in localStorage. Avoid
 // revisionless beacons and the browser's small keepalive payload limit.
 addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queue(0);});
})();
