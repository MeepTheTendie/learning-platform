# Baseline audit — 2026-09-09 America/Chicago

## Source
GitHub owner: MeepTheTendie. All default branches are main.

| App | Current GitHub commit | Local maintenance checkout |
| --- | --- | --- |
| grammar-reader | d96b535f517a5d4206ee33aa30ac6affc73d9f97 | clean; matches |
| history-atlas | db614973c3a60b93c99c719c1e975403edd64785 | clean but older efe84cc |
| philosophy-scholar | 4f5d169688c315fd0a8f1ef52f57fa36b9cef0bb | clean; matches |

Maintenance repos: /home/meep/Projects/app-maintenance/{app}. Folders directly under /home/meep/Projects with the same names are not Git repositories; do not assume they are production sources. Fresh current History checkout: history-atlas-audit/ next to this document. Its newer commits restore Robinson image routes and Myers illustrations.

## Cloudflare
Account b6acf63074ece003b1b9f7a4e26df258. All three Workers use D1 learning-progress-sync (5a9273d4-9360-4a6e-a146-cb432e68f03b), binding PROGRESS_DB. Each has APP_ID, STORAGE_KEY, ASSETS and a secret_text SYNC_KEY_HASH. No secret values collected.

Hosts: https://{app}.history-atlas.workers.dev/.

Active versions observed:
- Grammar: 2c46fb56-0853-47a1-847a-7cbfe37ed48c (2026-09-09 00:35:26 UTC).
- History: eb284ca2-d160-4492-bb50-a8a25affcfc8 (2026-09-09 19:02:54 UTC).
- Philosophy: b91862df-e88f-407a-a15e-4fe8f5008413 (2026-09-09 00:35:28 UTC).

These deployment records do not prove every deployed byte matches a Git commit. Public sync clients/merge modules were compared. Grammar and Philosophy match directly. History appends illustrations-client.mjs through its Worker; compare the composed response, not just sync-client.js. Complete Worker/assets provenance remains to verify before cutover.

## Saving and learning
- One JSON snapshot per app, keyed by app_id; revision-checked writes and three-way merging already exist.
- Browser key/cookie pairing authorizes sync; Cloudflare dashboard/MCP login is unrelated.
- User confirmed English shows “Sync: pair this device”. This prevents that device syncing. Latest desktop upload is not established.
- Sync downloads write localStorage but require refresh to update application memory.
- Recovery backup button exports current, last synced and retained conflict copies without requiring pairing.
- Grammar has Export notebook; Philosophy has Settings & backup and existing written self-review, argument exercises and scheduled reviews. History already has notes and sequencing. Preserve these rather than claim all are absent.
- Existing repos already have GitHub Actions running npm ci and npm run check. Existing shared-looking code is duplicated across repos.

## Backup
Private directory: /home/meep/Projects/learning-platform-private/2026-09-09 (directory mode 700).
learning-progress.sql is mode 600; SHA256SUMS records its checksum. Imported successfully into an in-memory SQLite database: integrity_check=ok; all three state_json values parsed as objects. Rows: History revision 15, Grammar 12, Philosophy 1. No production writes performed.
Git bundles preserve all local refs for each maintenance repo; a further history-atlas-current.bundle preserves the current GitHub History clone. Local maintenance bundles verified. These are local backups, not yet an independent off-machine backup policy.

## Status update — 2026-09-10

The sections above record the 2026-09-09 baseline. The following items have since changed; `docs/HANDOFF.md` is authoritative for current state.

Resolved since this audit:
- Auth/domain choice: Cloudflare Access at `meep-learning.cloudflareaccess.com`, owner-email-only application `9025fce3-e998-4c7f-abd5-20ade6229ecd`.
- Monorepo: created; all three histories imported with the latest History illustrations.
- App changes: shared auth, sync client, merge logic, save status and an exemplar review surface implemented, with preview Workers deployed.
- Baseline tests: `npm run check` and the browser suites pass locally (see HANDOFF validation; they do not prove real account-authenticated sign-in).

Still pending or production-gated:
- Desktop/laptop recovery exports were explicitly waived by the user; the private cloud backup is preserved.
- Full live Worker/asset provenance verification before cutover.
- Live owner sign-in and two-device account-authenticated acceptance (waived for milestone 1; required before production migration).
- Fresh production backup immediately before cutover, and an explicit decision to migrate.

The closing statement below applied only to the 2026-09-09 baseline: at that time no repos had moved, no new GitHub repo had been created, and no app code or production configuration had changed.
