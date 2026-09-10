# Release and operations

This is the runbook for building, validating, deploying, backing up and restoring the learning platform. The approved plan and current status live in `PLAN.md` and `HANDOFF.md`.

## Layout

| App | Worker (production) | Preview |
| --- | --- | --- |
| English | `grammar-reader.history-atlas.workers.dev` | `learning-english-preview.history-atlas.workers.dev` |
| History | `history-atlas.history-atlas.workers.dev` | `learning-history-preview.history-atlas.workers.dev` |
| Philosophy | `philosophy-scholar.history-atlas.workers.dev` | `learning-philosophy-preview.history-atlas.workers.dev` |

Previews use Cloudflare Access (owner-email only) and the separate `learning-platform-preview` D1 database. Production still uses the legacy pairing key and the `learning-progress-sync` database.

## Prerequisites

- Node 22.16 or later.
- `npm ci` at the repository root.
- `npx playwright install chromium` for browser tests.
- An authenticated Wrangler session for deploys (`wrangler whoami`).

## Build and validate

```
npm run check          # unit + auth tests, all builds, Wrangler dry runs
npm run test:browser   # two-profile browser sync, offline merge, exemplar sync, mobile
```

`npm run check` must pass before any commit. `npm run test:browser` must pass before any deploy.

## Deploy a preview

```
npm run preview -- english     # or history / philosophy
```

The script refuses production Worker names and the production database id. Previews are isolated from real learner progress.

## Production cutover (gated)

Production migration requires an explicit decision from the owner. Do not run these steps until then.

1. Confirm `npm run check` and `npm run test:browser` pass on the exact commit to release.
2. Refresh the production backup immediately before cutover: `npm run backup`.
3. Verify the backup: `npm run restore-drill`.
4. Review live provenance and confirm the current production data, URLs and History illustrations are preserved.
5. Deploy production with the app's `deploy` script, which checks the `SYNC_KEY_HASH` secret before building.
6. Sign in on two devices and confirm progress appears on both.

### Rollback

Every Worker keeps previous versions. Roll back by promoting the last known-good version in the Cloudflare dashboard or with `wrangler versions`. The D1 database is revision-checked; restore from the pre-cutover backup only if the schema or data changed, using the drill in `scripts/restore-drill.mjs` first.

## Backup

```
npm run backup         # exports production D1 to the private backup directory
npm run restore-drill  # imports the newest backup into isolated SQLite and verifies it
```

Backups are written outside the repository (default `~/Projects/learning-platform-private/backups`, mode 700) with mode 600 files and a `SHA256SUMS` log. Override the location with `LEARNING_BACKUP_DIR`.

Schedule the backup with cron, for example a daily run at 03:15:

```
15 3 * * * cd /home/meep/Projects/learning-platform && /usr/bin/env node scripts/backup-d1.mjs >> "$HOME/Projects/learning-platform-private/backup.log" 2>&1
```

Or a systemd timer (`OnCalendar=daily`) invoking the same command. The drill is intended to run after each backup and at least monthly.

## Monitoring

- Every Worker has observability and traces enabled in `wrangler.jsonc`.
- The progress Worker emits a structured `progress_failure` log line when storage is unavailable.
- `npm run health -- preview` (or `production`) checks that the app shell and progress API respond as expected: previews redirect to Access (302); production serves the shell (200) and refuses anonymous progress writes (401).
- Add Cloudflare notifications for Worker error-rate spikes and D1 storage errors in the dashboard; no alerting credentials are stored in this repository.

## Learning features kept in place

The approved plan asked to reuse existing learning features rather than rebuild them:

- English: per-section practice quizzes, recall challenges, margin notes, bookmarking, and export.
- History: chronology reconstruction, event-vs-interpretation claims, confidence self-assessment, notebook and backup/restore.
- Philosophy: scheduled spaced review driven by correctness, early practice, mastery tracking, commonplace book, and the argument workshop.

Exemplar lesson answers, attempts and completion now live in each app's canonical synced state, so they follow the same save, conflict and recovery paths as the rest of the progress.

## Paid AI feedback

Grounded AI feedback is optional and remains gated: no provider is configured and no paid calls are made until the owner agrees on a provider and spending limit.
