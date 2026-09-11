import { accessIdentity } from './access.mjs';
const LIMIT = 2_000_000;
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json = (data,status=200,requestId=null) => { const h = new Headers(headers); if(requestId)h.set('x-sync-id',requestId); return new Response(JSON.stringify(data),{status,headers:h}); };
const peerCache=new Map();
export async function authorized(request,env) {
  if(env.AUTH_MODE==='access')return !!await accessIdentity(request,env);
  if(env.AUTH_MODE && env.AUTH_MODE!=='legacy')return false;
  const key=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!/^[a-f0-9]{64}$/.test(key))return false;
  // Apps that share the account-wide pairing key can validate it against a peer
  // app instead of storing their own hash, so they need no extra pairing.
  if(env.PEER_VALIDATE_URL){
    const cached=peerCache.get(key);
    if(cached && cached.expires>Date.now())return cached.ok;
    try{
      const response=await fetch(env.PEER_VALIDATE_URL,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(5000)});
      const ok=response.status===200;
      if(peerCache.size>100)peerCache.clear();
      peerCache.set(key,{ok,expires:Date.now()+300000});
      return ok;
    }catch{return false;}
  }
  if(!/^[a-f0-9]{64}$/.test(env.SYNC_KEY_HASH||''))return false;
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)));
  const expected=Uint8Array.from(env.SYNC_KEY_HASH.match(/../g),x=>parseInt(x,16));
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(digest,expected) : digest.reduce((diff,byte,i)=>diff|(byte^expected[i]),0)===0;
}
export async function readBody(request) {
  if(Number(request.headers.get('content-length'))>LIMIT)throw {status:413,error:'too_large'};
  const reader=request.body?.getReader();
  if(!reader)throw {status:400,error:'invalid_json'};
  const chunks=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();throw {status:413,error:'too_large'};}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{throw {status:400,error:'invalid_json'};}
}
const snapshot=row=>row?{revision:Number(row.revision),state:JSON.parse(row.state_json),updatedAt:Number(row.updated_at)}:{revision:0,state:null,updatedAt:null};
async function current(env){return snapshot(await env.PROGRESS_DB.prepare('SELECT revision,state_json,updated_at FROM progress WHERE app_id = ?').bind(env.APP_ID).first());}
const TUTOR_LESSON={'grammar-reader':'english','history-atlas':'history','philosophy-scholar':'philosophy','geography-atlas':'geography'};
const TUTOR_MAX_MESSAGES=20, TUTOR_MAX_CHARS=4000, TUTOR_MAX_TOTAL=20000, TUTOR_MAX_MATERIAL=6000;
function tutorMessages(raw){
  if(!Array.isArray(raw)||raw.length<1||raw.length>TUTOR_MAX_MESSAGES)throw {status:400,error:'invalid_messages'};
  let total=0;
  return raw.map(message=>{
    const role=message?.role, content=typeof message?.content==='string'?message.content.trim():'';
    if(role!=='user'&&role!=='assistant')throw {status:400,error:'invalid_messages'};
    if(!content||content.length>TUTOR_MAX_CHARS)throw {status:400,error:'invalid_messages'};
    total+=content.length; if(total>TUTOR_MAX_TOTAL)throw {status:400,error:'invalid_messages'};
    return {role,content};
  });
}
async function tutorMaterial(request,env,lessonId){
  const subject=TUTOR_LESSON[env.APP_ID];
  if(!subject)return null;
  const candidates=[];
  if(typeof lessonId==='string'&&/^[a-z0-9-]{1,120}$/i.test(lessonId))candidates.push(`/content/lessons/${subject}/${lessonId}.json`);
  candidates.push(`/content/exemplars/${subject}.json`);
  for(const path of candidates){
    try{
      const response=await env.ASSETS.fetch(new Request(new URL(path,request.url)));
      if(!response.ok)continue;
      const lesson=await response.json();
      const material=[lesson.title,lesson.objective,lesson.lesson?.opening,...(lesson.lesson?.sections||[]).map(section=>`${section.heading}: ${section.body}`),...lesson.activities.map(activity=>activity.prompt)].filter(Boolean).join('\n').slice(0,TUTOR_MAX_MATERIAL);
      return {title:lesson.title,material};
    }catch{}
  }
  return null;
}
function tutorSystem(lesson){
  return `You are a patient Socratic tutor inside a study app, helping with the lesson "${lesson.title}". Use only the lesson material below and keep the learner thinking.\n\nLesson material:\n${lesson.material}\n\nRules: stay on this lesson; never invent facts outside it; keep replies under 120 words; ask one short question back when it helps; encourage the learner's own reasoning; do not claim to grade work or give an official answer key. If asked about something outside the lesson, say you can only help with this lesson.`;
}
async function bumpTutorUsage(env){
  const day=new Date().toISOString().slice(0,10);
  const row=await env.PROGRESS_DB.prepare('INSERT INTO tutor_usage (app_id,day,messages) VALUES (?,?,1) ON CONFLICT(app_id,day) DO UPDATE SET messages=messages+1 RETURNING messages').bind(env.APP_ID,day).first();
  return Number(row?.messages)||0;
}
async function tutor(request,env,url){
  if(request.method!=='POST')return json({error:'method'},405);
  if(!await authorized(request,env))return json({error:'unauthorized'},401);
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'origin'},403);
  if(env.TUTOR_ENABLED==='false')return json({error:'tutor_disabled'},503);
  if(!env.AI)return json({error:'ai_unavailable'},503);
  try{
    const body=await readBody(request);
    const messages=tutorMessages(body?.messages);
    const lesson=await tutorMaterial(request,env,body?.lessonId);
    if(!lesson)return json({error:'lesson_unavailable'},503);
    const limit=Number(env.TUTOR_DAILY_LIMIT)||40;
    const used=await bumpTutorUsage(env);
    if(used>limit)return json({error:'daily_limit',limit},429);
    const result=await env.AI.run(env.TUTOR_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8',{messages:[{role:'system',content:tutorSystem(lesson)},...messages],max_tokens:400,temperature:0.4});
    const reply=typeof result?.response==='string'?result.response.trim():'';
    if(!reply)return json({error:'empty_response'},502);
    return json({reply,remaining:Math.max(0,limit-used)});
  }catch(error){
    if(error?.status)return json({error:error.error},error.status);
    console.error(JSON.stringify({event:'tutor_failure',app:env.APP_ID}));
    return json({error:'tutor_unavailable'},503);
  }
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  const requestId=request.headers.get('x-sync-id')||crypto.randomUUID();
  if(url.pathname==='/__cloud-sync.js') {
    const response=await env.ASSETS.fetch(request);const copy=new Response(response.body,response);
    copy.headers.set('cache-control','no-store');return copy;
  }
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(url.pathname==='/api/tutor')return tutor(request,env,url);
  // Legacy beacons do not carry a revision. Never allow them to overwrite a
  // newer snapshot; old tabs retain their local copy until refreshed.
  if(url.pathname==='/api/progress-beacon')return json({error:'refresh_required'},409);
  if(url.pathname!=='/api/progress')return json({error:'not_found'},404);
  if(!await authorized(request,env))return json({error:'unauthorized'},401);
  if(request.method==='PUT' && request.headers.get('origin') && request.headers.get('origin')!==url.origin)return json({error:'origin'},403);
  try {
    if(request.method==='GET')return json(await current(env),200,requestId);
    if(request.method!=='PUT')return json({error:'method'},405);
    const body=await readBody(request);
    const syncId=typeof body?.syncId==='string'&&/^[0-9a-f-]{36}$/i.test(body.syncId)?body.syncId:requestId;
    if(!Number.isSafeInteger(body?.revision)||body.revision<0)return json({error:'refresh_required'},409);
    if(!body.state||typeof body.state!=='object'||Array.isArray(body.state))return json({error:'invalid_state'},400);
    const updatedAt=Date.now();
    // The comparison and write are ONE SQL statement. A stale writer cannot
    // overwrite another device between a SELECT and an UPDATE.
    const row=body.revision===0
      ? await env.PROGRESS_DB.prepare('INSERT INTO progress (app_id,revision,state_json,updated_at) VALUES (?,1,?,?) ON CONFLICT(app_id) DO NOTHING RETURNING revision,state_json,updated_at').bind(env.APP_ID,JSON.stringify(body.state),updatedAt).first()
      : await env.PROGRESS_DB.prepare('UPDATE progress SET revision=revision+1,state_json=?,updated_at=? WHERE app_id=? AND revision=? RETURNING revision,state_json,updated_at').bind(JSON.stringify(body.state),updatedAt,env.APP_ID,body.revision).first();
    if(!row)return json({error:'conflict',...await current(env)},409,syncId);
    return json({...snapshot(row),syncId},200,syncId);
  } catch(error) {
    if(error.status)return json({error:error.error},error.status);
    console.error(JSON.stringify({event:'progress_failure',app:env.APP_ID}));
    return json({error:'storage_unavailable'},503);
  }
 }
};
