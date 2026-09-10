import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const schema = `CREATE TABLE progress (app_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL)`;
const open = () => { const db = new DatabaseSync(':memory:'); db.exec(schema); return db; };

test('synthetic progress migration is isolated and reversible', () => {
  const source = open();
  const original = { app_id: 'grammar-reader', revision: 12, state_json: JSON.stringify({ done: [1, 2], notes: { 1: 'keep' } }), updated_at: 100 };
  source.prepare('INSERT INTO progress VALUES (?, ?, ?, ?)').run(original.app_id, original.revision, original.state_json, original.updated_at);
  const backup = source.prepare('SELECT app_id,revision,state_json,updated_at FROM progress').all();

  const target = open();
  for (const row of backup) target.prepare('INSERT INTO progress VALUES (?, ?, ?, ?)').run(row.app_id, row.revision, row.state_json, row.updated_at);
  assert.deepEqual(target.prepare('SELECT * FROM progress').all(), backup);

  target.prepare('DELETE FROM progress WHERE app_id=?').run(original.app_id);
  assert.equal(target.prepare('SELECT count(*) AS n FROM progress').get().n, 0);
  for (const row of backup) target.prepare('INSERT INTO progress VALUES (?, ?, ?, ?)').run(row.app_id, row.revision, row.state_json, row.updated_at);
  assert.deepEqual(target.prepare('SELECT * FROM progress').all(), backup);
  source.close(); target.close();
});
