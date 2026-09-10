// Three-way merge: only edits made since this device's last acknowledged snapshot
// are applied. Missing keys and array members represent deletions, not old data.
export const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safe = key => !['__proto__','constructor','prototype'].includes(key);
function identity(value) {
  if(object(value)) for(const key of ['id','key','readingId','lessonId','sectionId']) if(value[key]!=null)return key+':'+value[key];
  return JSON.stringify(value);
}
export function mergeChanges(base, local, remote, conflicts = [], path = '') {
  if(equal(local,base)) return remote;
  if(equal(remote,base) || equal(local,remote)) return local;
  if(object(local) && object(remote) && (base===undefined || object(base))) {
    const result = {};
    for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])) {
      if(!safe(key)) continue;
      const value = mergeChanges(base?.[key],local[key],remote[key],conflicts,path+'/'+key);
      if(value!==undefined) result[key]=value;
    }
    return result;
  }
  if(Array.isArray(local) && Array.isArray(remote) && (base===undefined || Array.isArray(base))) {
    const maps=[base||[],local,remote].map(list=>new Map(list.map(v=>[identity(v),v])));
    // Preserve local order; append remote-only additions. Reordering primitive
    // answer arrays is treated as an edit when both sides changed their order.
    const result=[];
    for(const id of new Set([...maps[1].keys(),...maps[2].keys(),...maps[0].keys()])) {
      const value=mergeChanges(maps[0].get(id),maps[1].get(id),maps[2].get(id),conflicts,path+'/'+id);
      if(value!==undefined)result.push(value);
    }
    return result;
  }
  conflicts.push(path || '/');
  // Explicit deterministic policy: this device's pending edit wins. The client
  // saves both complete snapshots before applying the merge for recovery.
  return local;
}
