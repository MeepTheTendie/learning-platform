// Client-side sync for the Sourcebook. This lives outside the renderer so the
// merge and queue behaviour can be unit-tested. The helper functions are plain
// JavaScript (no type annotations): `syncClient` is assembled with
// Function#toString() and evaluated in the browser, where a type annotation
// would be a syntax error.

export function blankState() {
  return { complete: {}, bookmarks: {}, notes: {}, review: {}, tutor: {} };
}

export function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return ((a.at || 0) >= (b.at || 0)) ? a : b;
}

// Completion and bookmark entries are booleans (legacy) or {at, deleted?}
// tombstones. A deletion must stay in the synced state, otherwise a remote copy
// that still holds the mark would resurrect it on the next merge. Every map
// resolves per key by timestamp so a tombstone beats an older mark.
export function mergeState(a, b) {
  a = a || blankState();
  b = b || blankState();
  var out = blankState();
  var maps = ['complete', 'bookmarks', 'notes', 'review', 'tutor'];
  for (var m = 0; m < maps.length; m++) {
    var key = maps[m];
    var left = a[key] || {};
    var right = b[key] || {};
    var id;
    for (id in left) out[key][id] = left[id];
    for (id in right) out[key][id] = newer(left[id], right[id]);
  }
  return out;
}

export const syncClient = `(function(){
  var KEY='sourcebook-state', AUTH_KEY='sourcebook-key';
  ${blankState.toString()}
  ${newer.toString()}
  ${mergeState.toString()}
  function isMarked(entry){return entry===true||!!(entry&&!entry.deleted)}
  function read(){try{var s=JSON.parse(localStorage.getItem(KEY));return (s&&typeof s==='object')?s:blankState()}catch(e){return blankState()}}
  function write(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
  var state=read();
  ['complete','bookmarks','notes','review','tutor'].forEach(function(k){if(!state[k]||typeof state[k]!=='object')state[k]={}});
  var busy=false, queued=false;
  var paired=(function(){var m=location.hash.match(/^#sync=([a-f0-9]{64})$/i);if(m){try{localStorage.setItem(AUTH_KEY,m[1])}catch(e){}history.replaceState(null,'',location.pathname+location.search);return m[1];}try{return localStorage.getItem(AUTH_KEY)||''}catch(e){return''}})();
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  function changed(){window.dispatchEvent(new CustomEvent('sourcebook:changed'))}
  function status(t){var el=document.getElementById('sync-status');if(el)el.textContent=t}
  function sync(){
    if(busy){queued=true;return} busy=true;
    var settled=false, retry=false;
    var headers={}; if(paired)headers.Authorization='Bearer '+paired;
    fetch('/api/progress',{headers:headers,cache:'no-store'}).then(function(res){
      if(res.status===401||res.status===403){status(paired?'Sign in again to sync':'Local only — not paired');settled=true;return null}
      if(!res.ok)throw new Error('offline');
      return res.json();
    }).then(function(remote){
      if(!remote)return;
      var merged=mergeState(state,remote.state);
      state=merged; write(state); changed();
      if(!remote.state||!equal(merged,remote.state)){
        return fetch('/api/progress',{method:'PUT',headers:Object.assign({},headers,{'Content-Type':'application/json'}),body:JSON.stringify({revision:remote.revision,state:merged,syncId:crypto.randomUUID()})}).then(function(put){
          if(put.status===409){retry=true;status('Retrying…');return}
          if(!put.ok)throw new Error('offline');
          return put.json();
        });
      }
    }).then(function(){if(!settled&&!retry&&!queued)status(paired?'Saved to cloud':'Local only — not paired')}).catch(function(){if(!settled&&!retry&&!queued)status('Saved on this device')}).then(function(){busy=false;if(retry){queued=false;setTimeout(sync,700)}else if(queued){queued=false;sync()}});
  }
  function touch(){write(state);changed();status('Saving…');sync()}
  function schedule(id,quality){
    var now=Date.now(), prev=state.review[id];
    var r=(prev&&!prev.deleted)?prev:{reps:0,interval:0};
    if(quality<1){r.reps=0;r.interval=0}else{r.reps=(r.reps||0)+1;r.interval=r.interval?Math.min(r.interval*2,180):1}
    r.last=now; r.next=now+(r.interval||0)*86400000; r.at=now; delete r.deleted; state.review[id]=r;
  }
  window.SourcebookSync={
    isComplete:function(id){return isMarked(state.complete[id])},
    toggleComplete:function(id){var now=Date.now();if(isMarked(state.complete[id])){state.complete[id]={at:now,deleted:true};state.review[id]={at:now,deleted:true}}else{state.complete[id]={at:now};schedule(id,1)}touch()},
    isBookmarked:function(id){return isMarked(state.bookmarks[id])},
    toggleBookmark:function(id){var now=Date.now();if(isMarked(state.bookmarks[id]))state.bookmarks[id]={at:now,deleted:true};else state.bookmarks[id]={at:now};touch()},
    getNote:function(id){var n=state.notes[id];return (n&&typeof n.text==='string')?n.text:''},
    setNote:function(id,text){state.notes[id]={text:text,at:Date.now()};touch()},
    getTutor:function(id){var t=state.tutor[id];return (t&&t.messages)?t.messages:[]},
    setTutor:function(id,messages){state.tutor[id]={messages:messages,at:Date.now()};touch()},
    dueUnits:function(){var now=Date.now(),out=[];for(var id in state.review){var r=state.review[id];if(r&&!r.deleted&&r.next&&r.next<=now)out.push(id)}return out},
    reviewInfo:function(id){var r=state.review[id];return (r&&!r.deleted)?r:null},
    markReviewed:function(id){schedule(id,1);touch()},
    askTutor:function(subject,unitId,messages){var headers={'Content-Type':'application/json'};if(paired)headers.Authorization='Bearer '+paired;return fetch('/api/tutor',{method:'POST',headers:headers,body:JSON.stringify({subject:subject,unitId:unitId,messages:messages})}).then(function(res){return res.json().then(function(data){if(!res.ok)throw new Error((data&&data.error)||'tutor_unavailable');return data})})},
    sync:sync, changed:changed
  };
  addEventListener('online',sync);
  addEventListener('focus',sync);
  addEventListener('storage',function(e){if(e.key===KEY){state=read();changed()}});
  sync();
})();`;
