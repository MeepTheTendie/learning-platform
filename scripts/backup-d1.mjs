// Export the production D1 progress database to a private, timestamped SQL
// file and record its checksum. Never writes inside the repository.
//
//   node scripts/backup-d1.mjs [--dry-run]
//
// Override the destination with LEARNING_BACKUP_DIR. Schedule it with cron or a
// systemd timer; see docs/RELEASE.md.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DB_NAME = 'learning-progress-sync';
const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const destination = path.resolve(process.env.LEARNING_BACKUP_DIR || path.join(os.homedir(), 'Projects', 'learning-platform-private', 'backups'));
const dryRun = process.argv.includes('--dry-run');

if (destination === repoRoot || destination.startsWith(repoRoot + path.sep)) {
  throw new Error('Refusing to write backups inside the repository: ' + destination);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const output = path.join(destination, `${DB_NAME}-${stamp}.sql`);

if (dryRun) {
  console.log(`Would export ${DB_NAME} to ${output}`);
  process.exit(0);
}

fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
const wrangler = path.join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
execFileSync(process.execPath, [wrangler, 'd1', 'export', DB_NAME, '--remote', '--skip-confirmation', '--output', output], { cwd: repoRoot, stdio: 'inherit' });
fs.chmodSync(output, 0o600);

const digest = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
const sums = path.join(destination, 'SHA256SUMS');
fs.appendFileSync(sums, `${digest}  ${path.basename(output)}\n`, { mode: 0o600 });
fs.chmodSync(sums, 0o600);

console.log(`Backed up ${DB_NAME} to ${output} (${fs.statSync(output).size} bytes, sha256 ${digest}).`);
