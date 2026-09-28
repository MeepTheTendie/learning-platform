import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const content = path.join(root, 'content');

function visit(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(file);
    return entry.isFile() && entry.name.endsWith('.jpg') ? [file] : [];
  });
}

const originals = visit(content);
let created = 0;
for (const original of originals) {
  const webp = original.replace(/\.jpg$/, '.webp');
  const fresh = fs.existsSync(webp) && fs.statSync(webp).mtimeMs >= fs.statSync(original).mtimeMs;
  if (fresh) continue;
  const result = spawnSync('magick', [original, '-resize', '1600x1600>', '-strip', '-quality', '80', '-define', 'webp:method=6', webp], { stdio: 'pipe' });
  if (result.error || result.status !== 0) {
    const reason = result.error?.message || result.stderr.toString().trim() || `exit ${result.status}`;
    throw new Error(`Could not create ${path.relative(root, webp)}: ${reason}`);
  }
  created++;
}

console.log(`WebP images ready: ${originals.length - created} reused, ${created} created.`);
