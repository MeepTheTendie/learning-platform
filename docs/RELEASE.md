# Release and operations

This is the runbook for building, validating, deploying, backing up and restoring the
Sourcebook. The app itself is documented in `v2/README.md`.

## Layout

| App | Worker |
| --- | --- |
| Sourcebook (all subjects) | `sourcebook.history-atlas.workers.dev` |

The Sourcebook serves the rendered `v2/dist/` and syncs completion, bookmarks, notes,
review schedules, and tutor conversations through `/api/progress` and `/api/tutor` under
`app_id=sourcebook`, using the private pairing key in
`~/Projects/learning-platform-private/sourcebook-pairing.txt`.

The account holds one Worker (`sourcebook`) and one D1 database
(`learning-progress-sync`). The earlier v1 Workers and previews were deleted on
2026-09-11 and removed from the tree; the old v1 `app_id` rows remain in
`learning-progress-sync` as an inert historical record.

## Prerequisites

- Node 22.16 or later.
- `npm --prefix v2 ci`.
- An authenticated Wrangler session for deploys (`wrangler whoami`).

## Build and validate

```
npm --prefix v2 run check   # validate + render + test
```

`npm --prefix v2 run check` must pass before any commit or deploy. CI runs the same
command (`.github/workflows/check.yml`).

## Deploy

```
npm --prefix v2 run render
cd v2 && npx wrangler deploy
```

The Worker stores only the SHA-256 hash of the pairing key, in the `SYNC_KEY_HASH`
secret:

```
printf '%s' "$KEY" | sha256sum | cut -d' ' -f1 | npx wrangler secret put SYNC_KEY_HASH
```

The pairing link is `https://<worker-host>/#sync=<key>`; opening it once stores the key
in that browser. The `progress` and `tutor_usage` tables already exist in
`learning-progress-sync`, so no migration step is required.

### Rollback

Every Worker keeps previous versions. Roll back by promoting the last known-good version
in the Cloudflare dashboard or with `wrangler versions`. The D1 database is
revision-checked; restore from a pre-deploy backup only if the schema or data changed,
running the drill below first.

## Backup and restore

```
npm run backup         # exports production D1 to the private backup directory
npm run restore-drill  # imports the newest backup into isolated SQLite and verifies it
```

Backups are written outside the repository (default
`~/Projects/learning-platform-private/backups`, mode 700) with mode 600 files and a
`SHA256SUMS` log. Override the location with `LEARNING_BACKUP_DIR`.

Schedule the backup with cron, for example a daily run at 03:15:

```
15 3 * * * cd /home/meep/Projects/learning-platform && /usr/bin/env node scripts/backup-d1.mjs >> "$HOME/Projects/learning-platform-private/backup.log" 2>&1
```

Or a systemd timer (`OnCalendar=daily`) invoking the same command. Run the drill after
each backup and at least monthly.

## Monitoring

- The Worker has logs and traces enabled in `v2/wrangler.jsonc`.
- The progress and tutor handlers emit structured `progress_failure` / `tutor_failure`
  log lines when storage or the AI binding is unavailable.
- Add Cloudflare notifications for Worker error-rate spikes and D1 storage errors in the
  dashboard; no alerting credentials are stored in this repository.

## Paid AI feedback

The grounded tutor runs on Cloudflare Workers AI with a daily cap. Configure it per
Worker:

- `TUTOR_ENABLED` — `true` to allow requests, `false` to disable immediately (returns 503).
- `TUTOR_MODEL` — Workers AI model id (default `@cf/meta/llama-3.1-8b-instruct-fp8`).
- `TUTOR_DAILY_LIMIT` — maximum tutor messages per app per UTC day (default `40`).

Requests are authenticated like progress sync and grounded only in the unit's own
content. Usage is counted in the `tutor_usage` table. Paid overage stays disabled until a
new provider/spending agreement is made; if the free allowance is exhausted, raise the
cap deliberately or set `TUTOR_ENABLED` to `false`.
