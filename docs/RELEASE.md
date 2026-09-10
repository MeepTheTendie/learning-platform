# Release and operations

This is the runbook for building, validating, deploying, backing up and restoring the learning platform. The approved plan and current status live in `PLAN.md` and `HANDOFF.md`.

## Layout

| App | Worker (production) | Preview |
| --- | --- | --- |
| English | `grammar-reader.history-atlas.workers.dev` | `learning-english-preview.history-atlas.workers.dev` |
| History | `history-atlas.history-atlas.workers.dev` | `learning-history-preview.history-atlas.workers.dev` |
| Philosophy | `philosophy-scholar.history-atlas.workers.dev` | `learning-philosophy-preview.history-atlas.workers.dev` |
| Geography | `geography-atlas.history-atlas.workers.dev` | `learning-geography-preview.history-atlas.workers.dev` |
| Hub | `learning-hub.history-atlas.workers.dev` | `learning-hub-preview.history-atlas.workers.dev` |

English, History and Philosophy previews use Cloudflare Access (owner-email only) and the separate `learning-platform-preview` D1 database. Their production apps use the account-wide legacy pairing key and the `learning-progress-sync` database.

Geography is different: Cloudflare Access does not cover new hostnames, so it uses the legacy pairing key on both preview and production, with an **app-scoped** key (`KEY_SCOPE=app`) stored in that origin's localStorage. This keeps it from overwriting the shared pairing cookie the other subjects rely on. The Learning Hub uses the same app-scoped approach. Pairing links are written to `~/Projects/learning-platform-private/geography-pairing.txt`.

Account resources (all intentional): ten Workers — production `grammar-reader`, `history-atlas`, `philosophy-scholar`, `geography-atlas`, `learning-hub`; previews `learning-english-preview`, `learning-history-preview`, `learning-philosophy-preview`, `learning-geography-preview`, `learning-hub-preview` — and two D1 databases, `learning-progress-sync` and `learning-platform-preview`. The previews are the staging environment and should be kept.

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

## Production cutover (performed 2026-09-10)

Production was cut over to the monorepo build while keeping the legacy pairing auth (Cloudflare Access stays on the previews). Use these steps for any future cutover or redeploy.

1. Confirm `npm run check` and `npm run test:browser` pass on the exact commit to release.
2. Refresh the production backup immediately before cutover: `npm run backup`.
3. Verify the backup: `npm run restore-drill`.
4. Review live provenance and confirm the current production data, URLs and History illustrations are preserved.
5. Apply any new D1 migrations to production, for example: `npx wrangler d1 execute learning-progress-sync --remote --file=apps/english/migrations/0002_tutor.sql`.
6. Deploy production with the app's `deploy` script, which checks the `SYNC_KEY_HASH` secret before building.
7. Verify with `npm run health -- production`, then sign in on two devices and confirm progress appears on both.

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

The grounded tutor runs on Cloudflare Workers AI with a daily cap. Configure it per Worker:

- `TUTOR_ENABLED` — `true` to allow requests, `false` to disable immediately (returns 503).
- `TUTOR_MODEL` — Workers AI model id (default `@cf/meta/llama-3.1-8b-instruct-fp8`).
- `TUTOR_DAILY_LIMIT` — maximum tutor messages per app per UTC day (default `40`).

Requests are authenticated like progress sync and grounded only in the lesson's own content. Usage is counted in the `tutor_usage` table. Paid overage stays disabled until a new provider/spending agreement is made; if the free allowance is exhausted, raise the cap deliberately or set `TUTOR_ENABLED` to `false`.
