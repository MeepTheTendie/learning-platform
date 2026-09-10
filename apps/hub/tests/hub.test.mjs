import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.mjs';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE progress (app_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  const insert = db.prepare('INSERT INTO progress VALUES (?,?,?,?)');
  insert.run('grammar-reader', 3, JSON.stringify({ exemplars: { 'english-nouns': { completed: true, points: 30, passed: { a: true, b: true } } } }), 1000);
  insert.run('geography-atlas', 1, JSON.stringify({ exemplars: { 'geography-locate': { completed: false, points: 20, passed: { x: true } } } }), 2000);
  const key = 'a'.repeat(64);
  const env = { APP_ID: 'learning-hub', STORAGE_KEY: 'learning-hub-v1', SYNC_KEY_HASH: '', PROGRESS_DB: { prepare(sql) { return { bind(...params) { return { async first() { return db.prepare(sql).get(...params) || null; } }; } }; } } };
  return { db, key, env };
}
async function get(ctx, auth = true) {
  if (!ctx.env.SYNC_KEY_HASH) ctx.env.SYNC_KEY_HASH = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ctx.key))).toString('hex');
  return worker.fetch(new Request('https://hub.test/api/hub', { headers: auth ? { Authorization: 'Bearer ' + ctx.key } : {} }), ctx.env);
}

test('hub refuses unauthenticated requests', async () => {
  const c = setup();
  assert.equal((await get(c, false)).status, 401);
  c.db.close();
});

test('hub aggregates subject progress from the shared database', async () => {
  const c = setup();
  const data = await (await get(c)).json();
  assert.equal(data.apps.length, 4);
  const english = data.apps.find(app => app.app === 'grammar-reader');
  assert.equal(english.label, 'English');
  assert.equal(english.lessonsCompleted, 1);
  assert.equal(english.points, 30);
  assert.equal(english.activitiesPassed, 2);
  assert.equal(english.updatedAt, 1000);
  const geography = data.apps.find(app => app.app === 'geography-atlas');
  assert.equal(geography.lessonsCompleted, 0);
  assert.equal(geography.points, 20);
  c.db.close();
});
