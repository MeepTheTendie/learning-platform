import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../packages/progress/worker.mjs';

const schema = `
CREATE TABLE progress (app_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE tutor_usage (app_id TEXT NOT NULL, day TEXT NOT NULL, messages INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (app_id, day));
`;

function setup(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const key = 'a'.repeat(64);
  const env = {
    APP_ID: 'grammar-reader',
    SYNC_KEY_HASH: '',
    TUTOR_MODEL: 'test-model',
    TUTOR_DAILY_LIMIT: '40',
    TUTOR_ENABLED: 'true',
    PROGRESS_DB: { prepare(sql) { return { bind(...params) { return { async first() { return db.prepare(sql).get(...params) || null; } }; } }; } },
    AI: { calls: [], async run(model, inputs) { this.calls.push({ model, inputs }); return { response: 'What makes you say that?' }; } },
    ASSETS: { async fetch() { return new Response(JSON.stringify({ id: 'english-sentence-exemplar', title: 'The sentence', objective: 'Find subjects and predicates.', lesson: { opening: 'A sentence names and says.', sections: [{ heading: 'Subject', body: 'The subject names what is spoken of.' }] }, activities: [{ id: 'identify-subject', type: 'choice', prompt: 'Which words are the subject?' }] }), { status: 200, headers: { 'content-type': 'application/json' } }); } },
    ...overrides,
  };
  return { db, key, env };
}

async function post(ctx, body, options = {}) {
  if (!ctx.env.SYNC_KEY_HASH) ctx.env.SYNC_KEY_HASH = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ctx.key))).toString('hex');
  return worker.fetch(new Request('https://app.test/api/tutor', {
    method: 'POST',
    headers: { ...(options.auth === false ? {} : { Authorization: 'Bearer ' + ctx.key }), 'content-type': 'application/json', ...(options.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), ctx.env);
}

const ask = { lessonId: 'english-sentence-exemplar', messages: [{ role: 'user', content: 'Why is this a sentence?' }] };

test('tutor refuses unauthorized and cross-origin requests', async () => {
  const c = setup();
  assert.equal((await post(c, ask, { auth: false })).status, 401);
  assert.equal((await post(c, ask, { headers: { origin: 'https://evil.test' } })).status, 403);
  c.db.close();
});

test('tutor grounds the answer in the lesson and counts usage', async () => {
  const c = setup();
  const response = await post(c, ask);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.reply, 'What makes you say that?');
  assert.equal(data.remaining, 39);
  const system = c.env.AI.calls[0].inputs.messages[0];
  assert.equal(system.role, 'system');
  assert.match(system.content, /The sentence/);
  assert.match(system.content, /The subject names what is spoken of/);
  assert.equal(c.db.prepare('SELECT messages FROM tutor_usage').get().messages, 1);
  c.db.close();
});

test('tutor enforces the daily cap', async () => {
  const c = setup({ TUTOR_DAILY_LIMIT: '1' });
  assert.equal((await post(c, ask)).status, 200);
  const limited = await post(c, ask);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, 'daily_limit');
  c.db.close();
});

test('tutor rejects malformed conversations', async () => {
  const c = setup();
  assert.equal((await post(c, { messages: [] })).status, 400);
  assert.equal((await post(c, { messages: [{ role: 'system', content: 'x' }] })).status, 400);
  assert.equal((await post(c, { messages: [{ role: 'user', content: '' }] })).status, 400);
  assert.equal((await post(c, { messages: [{ role: 'user', content: 'x'.repeat(5000) }] })).status, 400);
  c.db.close();
});

test('tutor is unavailable when disabled or unbound', async () => {
  const disabled = setup({ TUTOR_ENABLED: 'false' });
  assert.equal((await post(disabled, ask)).status, 503);
  disabled.db.close();
  const unbound = setup({ AI: undefined });
  assert.equal((await post(unbound, ask)).status, 503);
  unbound.db.close();
});
