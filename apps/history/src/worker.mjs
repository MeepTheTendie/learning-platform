import shared from '../../../packages/progress/worker.mjs';
import { illustrationClient } from './illustrations-client.mjs';
export { authorized, readBody } from '../../../packages/progress/worker.mjs';
export default {async fetch(request,env,ctx) {
 const url=new URL(request.url);
  if(url.pathname==='/__cloud-sync.js') {
    const asset=await env.ASSETS.fetch(request);
    if(!asset.ok)return asset;
    const response=new Response((await asset.text())+'\n'+illustrationClient,{status:200,headers:asset.headers});
    response.headers.delete('content-length');
    response.headers.delete('content-encoding');
    response.headers.delete('etag');
    response.headers.set('cache-control','no-cache');
    return response;
  }
    if (/^\/assets\/robinson\/images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif)$/.test(url.pathname)) {
      const image = await fetch("https://www.gutenberg.org/cache/epub/26042/" + url.pathname.slice("/assets/robinson/".length), {cf:{cacheTtl:86400,cacheEverything:true}});
      if (!image.ok || !(image.headers.get("content-type") || "").startsWith("image/")) return new Response("Image unavailable", {status:502});
      const response = new Response(image.body, image);
      response.headers.set("cache-control","public, max-age=86400");
      response.headers.set("x-content-type-options","nosniff");
      return response;
    }

 return shared.fetch(request,env,ctx);
}};
