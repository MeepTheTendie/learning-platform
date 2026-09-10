import fs from 'node:fs';
import crypto from 'node:crypto';
const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
fs.rmSync('dist', {recursive:true, force:true});
fs.cpSync('public', 'dist', {recursive:true});
const html = fs.readFileSync('dist/index.html', 'utf8');
const tag = `<script src="/__cloud-sync.js" data-app="${config.vars.APP_ID}" data-storage="${config.vars.STORAGE_KEY}"></script>`;
fs.writeFileSync('dist/index.html', (/<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>') : /<body/i.test(html) ? html.replace(/<body/i, tag+'<body') : html.replace(/<!doctype html>/i, match=>match+tag)));
if (!fs.readFileSync('dist/index.html','utf8').includes(tag)) throw Error('Missing HTML head');
fs.copyFileSync('../../packages/progress/sync-client.js','dist/__cloud-sync.js');
fs.copyFileSync('../../packages/progress/sync-merge.js','dist/sync-merge.js');
if (fs.existsSync('dist/sw.js')) {
  const hash = crypto.createHash('sha256');
  function visit(dir) { for (const name of fs.readdirSync(dir).sort()) { const file=dir+'/'+name; if(fs.statSync(file).isDirectory())visit(file); else hash.update(fs.readFileSync(file)); } }
  visit('dist');
  fs.writeFileSync('dist/sw.js', fs.readFileSync('dist/sw.js','utf8').replace('__BUILD__',hash.digest('hex').slice(0,16)));
}
fs.writeFileSync('dist/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'
/index.html
  Cache-Control: no-cache
/__cloud-sync.js
  Cache-Control: no-cache
/sync-merge.js
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
`);
console.log('Built '+config.name);
