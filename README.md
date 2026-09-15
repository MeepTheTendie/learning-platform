# Learning platform

The live app is the **Sourcebook** in `v2/`: one Cloudflare Worker that serves a rendered
site and syncs progress through D1. See `v2/README.md` for content layout, study
features, the sync model, and deploy steps.

## Layout

```
v2/                       # Sourcebook app (renderer, Worker, content, tests)
scripts/backup-d1.mjs     # export the production D1 database to a private directory
scripts/restore-drill.mjs # import the newest backup into isolated SQLite and verify it
docs/RELEASE.md           # release and operations runbook
```

The earlier v1 apps and their shared packages were retired on 2026-09-11 (the Workers and
preview Workers were deleted) and removed from the tree; they remain available in Git
history.

## Commands

```
npm --prefix v2 run check   # validate + render + test the Sourcebook
npm run backup              # export learning-progress-sync to ~/Projects/learning-platform-private/backups
npm run restore-drill       # verify the newest backup in isolated SQLite
```

## Operations

The Worker stores only the SHA-256 hash of the private pairing key, in the
`SYNC_KEY_HASH` secret. Keep pairing links, database exports, and learner answers out of
this repository. See `docs/RELEASE.md` for backup, restore, and deploy procedure.
