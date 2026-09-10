import { accessIdentity } from './access.mjs';
const LIMIT = 2_000_000;
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json = (data,status=200,requestId=null) => { const h = new Headers(headers); if(requestId)h.set('x-sync-id',requestId); return new Response(JSON.stringify(data),{status,headers:h}); };
export async function authorized(request,env) {
  if(env.AUTH_MODE==='access')return !!await accessIdentity(request,env);
  if(env.AUTH_MODE && env.AUTH_MODE!=='legacy')return false;
  const key=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!/^[a-f0-9]{64}$/.test(key)||!/^[a-f0-9]{64}$/.test(env.SYNC_KEY_HASH||''))return false;
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
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  const requestId=request.headers.get('x-sync-id')||crypto.randomUUID();
  if(url.pathname==='/__cloud-sync.js') {
    const response=await env.ASSETS.fetch(request);const copy=new Response(response.body,response);
    copy.headers.set('cache-control','no-store');return copy;
  }
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
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
