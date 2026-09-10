const CACHE='philosophy-scholar-__BUILD__';
const ASSETS=['./','./index.html','./style.css','./app.js','./lib/store.js','./lib/questions.js','./content/curriculum.json','./content/reference.json','./content/apology.html','./content/crito.html','./assets/icon.svg','./manifest.webmanifest','./__cloud-sync.js','./sync-merge.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('philosophy-scholar-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Progress responses contain private, changing state. Never cache them or
 // substitute an HTML page when an API request fails offline.
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith((async()=>{
  try {
   const response=await fetch(event.request);
   if(response.ok) {const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
   return response;
  } catch {
   return await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('./index.html'):null)||Response.error();
  }
 })());
});
