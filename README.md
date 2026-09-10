# Learning platform

Three independent Cloudflare apps with shared progress code and build tooling.

- `apps/english`: grammar-reader
- `apps/history`: history-atlas, including restored book illustrations
- `apps/philosophy`: philosophy-scholar
- `packages/progress`: shared Worker, browser sync and merge logic
- `packages/learning-content`: validated lesson contract and exercise renderer
- `scripts/build-app.mjs`: common asset packaging
- `docs/`: approved plan, audit and current handoff

## Development

Use Node 22.16 or later. Run `npm ci`, then `npm run check` from the root. This runs all existing tests, builds all subjects and checks Worker packaging without deploying. Run an individual app with `npm run check --workspace=history-atlas` (or its corresponding package name).

All three original Git histories were imported with non-squashed git subtree merges. Original repositories and production sites remain intact. The current milestone adds Access sign-in, automatic application of remote edits, offline retries, retained conflicts, and Philosophy note drafts. Production still uses the original pairing system until migration acceptance checks pass.

Do not deploy production until the authentication and migration acceptance checks in docs/PLAN.md pass. Never place database exports, pairing keys, or learner answers in this repository. Browser recovery exports were explicitly waived by the user; preserve the existing cloud backup and allow the user to redo local-only completions.

## Preview and browser checks

Run `npm run test:browser` for two isolated browser profiles per subject against local, in-memory databases. Install Chromium with `npx playwright install chromium` if needed; `CHROMIUM_BIN` can select an installed browser. Tests cover live state updates, offline merges, deletions, active writing, conflict retention, draft reloads, and mobile overflow.

`npm run preview -- english` (or `history` / `philosophy`) builds and deploys that subject using its preview config. Add `--dry-run` to check packaging. The script refuses production Worker names and shared production database IDs. Preview uses the separate `learning-platform-preview` database and owner-only Cloudflare Access.

Preview URLs: `https://learning-{english,history,philosophy}-preview.history-atlas.workers.dev/`. Sign in with the account owner's email. These previews have separate progress from production; do not treat test marks there as migrated production progress.

## Milestone 2 content review

The first reviewable lesson exemplars are in `content/exemplars/`. They use the shared contract in `packages/learning-content`; each activity has a stable response ID, prompt, response shape, and optional rubric. They are drafts for review and do not replace the existing app curriculum until approved.
