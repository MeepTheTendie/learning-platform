export const KEY='philosophy-scholar-v1';
export const today=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const fresh=()=>({app:'philosophy-scholar',version:1,current:'f1',lessons:{},xp:0,awards:{},mastery:{},reviews:{},reviewLog:[],notes:[],bookmarks:[],revisit:[],daily:{},settings:{theme:'light',font:21,scholar:false},debates:{},noteDraft:{text:'',lesson:'f1',type:'note'},readingPositions:{},exemplars:{},tutor:{}});
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const safeKey=k=>!['__proto__','constructor','prototype'].includes(k);
const cleanMap=raw=>{const out={};if(!obj(raw))return out;for(const [id,record] of Object.entries(raw)){if(!safeKey(id)||id.length>=200||!obj(record))continue;out[id]=JSON.parse(JSON.stringify(record),(key,value)=>safeKey(key)?value:undefined)}return out};
const bounded=(x,max=100000)=>typeof x==='string'?x.slice(0,max):'';
export function validate(raw,ids){
 if(!obj(raw)||raw.app!=='philosophy-scholar'||raw.version!==1)throw Error('Choose a Philosophy Scholar version 1 JSON backup.');
 const s=fresh();s.current=ids.includes(raw.current)?raw.current:ids[0];
 for(const field of ['lessons','awards','mastery','reviews','daily','debates']){
  if(obj(raw[field]))s[field]=Object.fromEntries(Object.entries(raw[field]).filter(([k,v])=>safeKey(k)&&k.length<200&&obj(v)).map(([k,v])=>[k,JSON.parse(JSON.stringify(v),(key,value)=>safeKey(key)?value:undefined)]));
 }
 if(obj(raw.noteDraft))s.noteDraft={text:bounded(raw.noteDraft.text),lesson:ids.includes(raw.noteDraft.lesson)?raw.noteDraft.lesson:ids[0],type:['note','question','argument','objection','concept','quotation'].includes(raw.noteDraft.type)?raw.noteDraft.type:'note'};
 if(obj(raw.readingPositions))s.readingPositions=Object.fromEntries(Object.entries(raw.readingPositions).filter(([k,v])=>ids.includes(k)&&Number.isFinite(v)&&v>=0).map(([k,v])=>[k,Math.min(v,100000000)]));
 s.xp=Number.isFinite(raw.xp)?Math.max(0,Math.min(1e9,raw.xp)):0;
 s.notes=Array.isArray(raw.notes)?raw.notes.filter(n=>obj(n)&&typeof n.text==='string'&&typeof n.id==='string').map(n=>({id:bounded(n.id,100),text:bounded(n.text),type:bounded(n.type,30),lesson:ids.includes(n.lesson)?n.lesson:ids[0],date:bounded(n.date,40),author:bounded(n.author,500),work:bounded(n.work,1000)})).slice(0,20000):[];
 for(const f of ['bookmarks','revisit'])s[f]=Array.isArray(raw[f])?[...new Set(raw[f].filter(id=>ids.includes(id)))]:[];
 s.reviewLog=Array.isArray(raw.reviewLog)?raw.reviewLog.filter(e=>obj(e)&&ids.includes(e.lesson)&&Number.isFinite(e.at)&&typeof e.correct==='boolean').slice(-10000):[];
 if(obj(raw.settings))s.settings={theme:raw.settings.theme==='dark'?'dark':'light',font:Math.max(17,Math.min(29,Number(raw.settings.font)||21)),scholar:!!raw.settings.scholar};
 // Normalize imported nested data before any UI reads it.
 s.lessons=Object.fromEntries(Object.entries(s.lessons).filter(([id])=>ids.includes(id)).map(([id,l])=>[id,{...l,stage:Math.min(6,Math.max(0,Number(l.stage)||0)),complete:!!l.complete,read:!!l.read,answers:obj(l.answers)?l.answers:{},drafts:obj(l.drafts)?l.drafts:{},attempts:Math.max(1,Number(l.attempts)||1)}]));
 s.reviews=Object.fromEntries(Object.entries(s.reviews).filter(([id,r])=>ids.includes(id)&&Number.isFinite(r.due)&&Number.isFinite(r.interval)).map(([id,r])=>[id,{due:r.due,interval:Math.max(1,Math.min(365,r.interval)),count:Math.max(0,Math.floor(r.count)||0)}]));
 s.daily=Object.fromEntries(Object.entries(s.daily).filter(([d])=>/^\d{4}-\d{2}-\d{2}$/.test(d)).map(([d,v])=>[d,{xp:Math.max(0,Number(v.xp)||0),seconds:Math.max(0,Number(v.seconds)||0),lessons:Array.isArray(v.lessons)?v.lessons.filter(id=>ids.includes(id)):[],readings:Array.isArray(v.readings)?v.readings.filter(id=>ids.includes(id)):[],words:Math.max(0,Number(v.words)||0)}]));
 s.mastery=Object.fromEntries(Object.entries(s.mastery).filter(([,v])=>Number.isFinite(v.correct)&&Number.isFinite(v.total)).map(([k,v])=>[k,{correct:Math.max(0,v.correct),total:Math.max(v.correct,v.total,0),updated:Number(v.updated)||0}]));
 s.exemplars=cleanMap(raw.exemplars);
 s.tutor=cleanMap(raw.tutor);
 return s;
}
export function createStore(ids,storage=localStorage){let state=fresh(),error=null;
 try{const saved=storage.getItem(KEY);if(saved)state=validate(JSON.parse(saved),ids)}catch(e){error=e.message}
 return {get state(){return state},get error(){return error},save(){try{storage.setItem(KEY,JSON.stringify(state));error=null;return true}catch(e){error=e.message;return false}},replace(raw){state=validate(raw,ids);this.save()},export(){return JSON.stringify(state,null,2)}};
}
export function dayRecord(s){return s.daily[today()]??=( {xp:0,seconds:0,lessons:[],readings:[],words:0});}
export function award(s,key,xp){if(s.awards[key])return 0;s.awards[key]={at:Date.now(),xp};s.xp+=xp;dayRecord(s).xp+=xp;return xp}
export function observe(s,tags,correct){for(const tag of tags){const m=s.mastery[tag]??={correct:0,total:0,updated:0};m.correct+=correct?1:0;m.total++;m.updated=Date.now()}}
export function mastery(s,tag){const m=s.mastery[tag];if(!m?.total)return 0;const days=(Date.now()-m.updated)/86400000;return Math.round(100*(m.correct/m.total)*Math.min(1,m.total/5)*Math.max(.55,1-days*.008))}
export function schedule(s,id,correct){const old=s.reviews[id]||{interval:1,count:0};const interval=correct?Math.min(60,old.count?old.interval*2:3):1;s.reviews[id]={due:Date.now()+interval*86400000,interval,count:old.count+1};s.reviewLog.push({lesson:id,at:Date.now(),correct});}
export function dueReviews(s){return Object.entries(s.reviews).filter(([,r])=>r.due<=Date.now()).sort((a,b)=>a[1].due-b[1].due).map(([id])=>id)}
export function level(xp){const names=['Novice','Student','Questioner','Dialectician','Scholar','Philosopher'];const thresholds=[0,200,600,1200,2400,4800];let i=thresholds.findLastIndex(n=>xp>=n);return {number:i+1,name:names[i],start:thresholds[i],next:thresholds[i+1]||null}}
