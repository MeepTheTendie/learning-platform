# Learning platform

Three independent Cloudflare apps with shared progress code and build tooling.

- `apps/english`: grammar-reader
- `apps/history`: history-atlas, including restored book illustrations
- `apps/philosophy`: philosophy-scholar
- `packages/progress`: shared Worker, browser sync and merge logic
- `scripts/build-app.mjs`: common asset packaging
- `docs/`: approved plan, audit and current handoff

## Development

Use Node 22.16 or later. Run `npm ci`, then `npm run check` from the root. This runs all existing tests, builds all subjects and checks Worker packaging without deploying. Run an individual app with `npm run check --workspace=history-atlas` (or its corresponding package name).

All three original Git histories were imported with non-squashed git subtree merges. Original repositories and production sites remain intact. The current milestone centralizes existing behavior; normal sign-in and automatic remote state application are still in progress.

Do not deploy production until the authentication and migration acceptance checks in docs/PLAN.md pass. Never place database exports, pairing keys, or learner answers in this repository. Browser recovery exports were explicitly waived by the user; preserve the existing cloud backup and allow the user to redo local-only completions.
