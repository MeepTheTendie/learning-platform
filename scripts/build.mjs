import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [app, storageKey, sourceDirectory, templateFile, outputFile] = process.argv.slice(2);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png'
};
const assets = {};

function visit(current) {
  for (const entry of fs.readdirSync(current, {withFileTypes:true})) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (entry.isFile()) {
      const relative = path.relative(sourceDirectory, full).replaceAll('\\', '/');
      let content = fs.readFileSync(full);
      if (relative === 'index.html') {
        const tag = `<script src="/__cloud-sync.js" data-app="${app}" data-storage="${storageKey}"></script>`;
        const html = content.toString('utf8');
        const injected = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>')
          : /<body/i.test(html) ? html.replace(/<body/i, tag + '<body')
          : html.replace(/<!doctype html>/i, match => match + tag);
        content = Buffer.from(injected);
      }
      if (relative === 'sw.js') content = Buffer.from(content.toString('utf8').replace(/philosophy-scholar-v1-[^']+/, 'philosophy-scholar-v1-20260908-sync'));
      const compressed = zlib.gzipSync(content, {level:9});
      assets['/' + relative] = {type:types[path.extname(relative).toLowerCase()] || 'application/octet-stream', data:compressed.toString('base64')};
    }
  }
}
visit(sourceDirectory);

const runtime = String.raw`
const EMBEDDED_ASSETS = __ASSET_MAP__;
const decodedAssets = new Map();
function decodeAsset(pathname, data) {
  if (decodedAssets.has(pathname)) return decodedAssets.get(pathname);
  const binary = atob(data), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  decodedAssets.set(pathname, bytes);
  return bytes;
}
function serveAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const asset = EMBEDDED_ASSETS[pathname];
  if (!asset) return new Response('Not found', {status:404});
  const headers = new Headers({'content-type':asset.type,'x-content-type-options':'nosniff'});
  headers.set('cache-control', pathname === '/index.html' || pathname === '/sw.js' ? 'no-cache' : 'public, max-age=3600');
  if (pathname === '/sw.js') headers.set('service-worker-allowed','/');
  const compressed = new Blob([decodeAsset(pathname, asset.data)]).stream();
  return new Response(compressed.pipeThrough(new DecompressionStream('gzip')), {headers});
}
`.replace('__ASSET_MAP__', JSON.stringify(assets));

let worker = fs.readFileSync(templateFile, 'utf8');
worker = runtime + '\n' + worker;
const oldTail = `    const response = await env.ASSETS.fetch(request);\n    if ((response.headers.get('content-type') || '').includes('text/html')) {\n      const tag = '<script src="/__cloud-sync.js" data-app="' + env.APP_ID + '" data-storage="' + env.STORAGE_KEY + '"></script>';\n      return new HTMLRewriter().on('head', { element(element) { element.append(tag, {html:true}); } }).transform(response);\n    }\n    return response;`;
worker = worker.replace(oldTail, `    return serveAsset(request);`);
if (worker.includes('env.ASSETS.fetch')) throw new Error('Failed to replace the static asset handler');
fs.mkdirSync(path.dirname(outputFile), {recursive:true});
fs.writeFileSync(outputFile, worker);
console.log(JSON.stringify({app, files:Object.keys(assets).length, bytes:Buffer.byteLength(worker)}));
