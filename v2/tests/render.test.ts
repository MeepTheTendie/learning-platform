import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(new URL('../dist', import.meta.url).pathname);

test('the renderer emits cacheable native web assets', () => {
  for (const file of ['sourcebook.css', 'sync.js', 'reader.js', 'unit.js', 'index.js']) {
    const asset = path.join(dist, 'assets', file);
    assert.ok(fs.existsSync(asset), `missing ${file}`);
    assert.ok(fs.statSync(asset).size > 100, `${file} is unexpectedly empty`);
  }
  const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.match(index, /<link rel="stylesheet" href="\/assets\/sourcebook\.css">/);
  assert.match(index, /<script src="\/assets\/sync\.js" defer><\/script>/);
  assert.match(index, /<script src="\/assets\/index\.js" defer><\/script>/);
  const unit = fs.readFileSync(path.join(dist, 'history', '01-first-cities.html'), 'utf8');
  assert.match(unit, /data-page="unit" data-unit-id="01-first-cities" data-subject="history"/);
  assert.match(unit, /<script src="\/assets\/unit\.js" defer><\/script>/);
  assert.match(unit, /<source type="image\/webp" srcset="\.\.\/content\/history\/01-first-cities\/assets\/mesopotamia-map\.webp">/);
  assert.match(unit, /class="map"[^>]*fetchpriority="high"/);
  assert.match(unit, /cuneiform-tablet\.jpg"[^>]*loading="lazy"/);
});
