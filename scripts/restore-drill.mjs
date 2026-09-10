// Restoration drill: import a D1 backup into an isolated in-memory SQLite
// database and verify integrity and shape without touching production.
//
//   node scripts/restore-drill.mjs [path/to/backup.sql]
//
// With no path, uses the newest .sql file in the private backup directory.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const backupDir = path.resolve(process.env.LEARNING_BACKUP_DIR || path.join(os.homedir(), 'Projects', 'learning-platform-private', 'backups'));
const requested = process.argv[2];
const candidates = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(name => name.endsWith('.sql')).sort() : [];
const file = requested ? path.resolve(requested) : candidates.length ? path.join(backupDir, candidates.at(-1)) : null;
if (!file || !fs.existsSync(file)) throw new Error('No backup SQL file found. Pass a path or run the backup first.');

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(file, 'utf8'));

const integrity = db.prepare('PRAGMA integrity_check').get();
const status = Object.values(integrity)[0];
if (status !== 'ok') throw new Error(`Integrity check failed: ${status}`);

const rows = db.prepare('SELECT app_id, revision, state_json FROM progress ORDER BY app_id').all();
if (!rows.length) throw new Error('Backup contains no progress rows.');
for (const row of rows) {
  const state = JSON.parse(row.state_json);
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error(`${row.app_id} state is not an object`);
  const exemplarLessons = state.exemplars && typeof state.exemplars === 'object' ? Object.keys(state.exemplars).length : 0;
  console.log(`  ${row.app_id}: revision ${row.revision}, ${Object.keys(state).length} fields, ${exemplarLessons} exemplar lessons`);
}
db.close();
console.log(`Restoration drill passed for ${file}: integrity ok, ${rows.length} app rows verified.`);
