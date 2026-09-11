import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const root=new URL('../apps/',import.meta.url).pathname.replace(/\/$/,'');
for(const [i,app] of ['history','english','philosophy','geography','hub'].entries()) {
 const config=JSON.parse(fs.readFileSync(`${root}/${app}/wrangler.jsonc`));
 const worker=(await import(`${root}/${app}/src/worker.mjs`)).default;
 const db=new DatabaseSync(':memory:');for(const file of fs.readdirSync(`${root}/${app}/migrations`).sort())db.exec(fs.readFileSync(`${root}/${app}/migrations/${file}`,'utf8'));
 const env={...config.vars,SYNC_KEY_HASH:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('a'.repeat(64)))).toString('hex'),PROGRESS_DB:{prepare(sql){return {bind(...params){return {async first(){return db.prepare(sql).get(...params)||null;}}}}}},AI:{async run(){return {response:'Good question — what makes you say that?'}}},ASSETS:{async fetch(request){
  const pathname=decodeURIComponent(new URL(request.url).pathname);
  const file=path.resolve(`${root}/${app}/dist`,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(`${root}/${app}/dist/`)||!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});
  const types={'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  return new Response(fs.readFileSync(file),{headers:{'content-type':types[path.extname(file)]||'application/octet-stream'}});
   }}};
 delete env.PEER_VALIDATE_URL;
 http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const result=await worker.fetch(new Request(`http://127.0.0.1:${19001+i}${req.url}`,{method:req.method,headers:req.headers,...(body.length?{body}:{} )}),env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch(error){console.error(error);res.writeHead(500);res.end('Error');}}).listen(19001+i,'127.0.0.1',()=>console.log(app,19001+i));
}
