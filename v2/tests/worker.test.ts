import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker.mjs';

const key = 'a'.repeat(64);
const hash = async (text: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).toString('hex');

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE progress (app_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  const env: any = {
    APP_ID: 'test',
    SYNC_KEY_HASH: '',
    PROGRESS_DB: {
      prepare(sql: string) {
        return { bind(...params: any[]) { return { async first() { return db.prepare(sql).get(...params) || null; } }; } };
      },
    },
  };
  return { db, env };
}

async function call(env: any, method: string, body?: unknown, auth = true) {
  if (!env.SYNC_KEY_HASH) env.SYNC_KEY_HASH = await hash(key);
  return worker.fetch(new Request('https://app.test/api/progress', {
    method,
    headers: { ...(auth ? { Authorization: 'Bearer ' + key } : {}), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
}

test('unauthorized progress requests are refused', async () => {
  const { db, env } = setup();
  assert.equal((await call(env, 'GET', undefined, false)).status, 401);
  db.close();
});

test('oversized bodies are rejected before they are parsed', async () => {
  const { db, env } = setup();
  const response = await call(env, 'PUT', { revision: 0, state: { text: 'x'.repeat(2_000_000) } });
  assert.equal(response.status, 413);
  db.close();
});

test('progress round-trips and stale revisions conflict', async () => {
  const { db, env } = setup();
  assert.equal((await call(env, 'PUT', { revision: 0, state: { complete: { u1: true } } })).status, 200);
  assert.equal((await call(env, 'PUT', { revision: 0, state: { complete: {} } })).status, 409);
  const snapshot = await (await call(env, 'GET')).json();
  assert.equal(snapshot.revision, 1);
  assert.deepEqual(snapshot.state, { complete: { u1: true } });
  db.close();
});
