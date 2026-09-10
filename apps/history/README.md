# History Atlas

The History Atlas reading app, deployed at https://history-atlas.history-atlas.workers.dev/.

Progress is stored in the browser and synchronized through the Worker to the shared Cloudflare D1 database. The previous deployment only used browser storage, which is why progress created on one computer did not appear on another.

## Layout

- `public/` contains the app.
- `src/worker.mjs` implements authenticated progress sync and D1 storage.
- `scripts/build.mjs` packages the static app into the Worker.
- `migrations/` contains the D1 schema.

## Build and deploy

Run `npm run build` to generate `dist/worker.mjs`, then `npm run deploy` to deploy it with Wrangler. The Cloudflare Worker requires a `SYNC_KEY_HASH` secret and the `PROGRESS_DB` D1 binding declared in `wrangler.jsonc`. The private pairing key is intentionally excluded from this repository.


## Sync reliability and recovery

Sync uses a last-acknowledged snapshot and atomic revision checks. Deleting notes or completions, shortening text, and reducing settings are supported. Independent edits are merged; when the same value changes on both devices, the uploading device's pending value wins and both snapshots are retained in a local recovery backup. Recovery backup downloads the current, synced, and up to three pre-merge snapshots; each state can be extracted and restored using the app's existing import flow. Apply updates refreshes the app when another device changes its state, without interrupting ongoing writing. Failed saves stay local and retry with backoff.

Refresh old tabs after deployment. The old revisionless sync protocol is rejected to prevent stale tabs from overwriting newer progress. Their local state is retained. Pairing links grant access to this single-owner notebook; keep them private.

Static files use Cloudflare Workers Assets. Builds include the sync client and security headers, and Philosophy Scholar keeps API responses out of its offline cache. The shared D1 schema is unchanged. Back up the remote D1 database before deployment.

Validation: `npm ci && npm run check`. Wrangler is pinned; the sharp override fixes the development-tool advisory without downgrading Wrangler. The unit suite exercises actual SQLite revision writes as well as merges, deletions, authentication and body limits.

Browser integration: install Playwright and set `PLAYWRIGHT_MODULE` to its module path; run `node tests/browser.cjs` against a local test server (History uses `APP_URL`; Philosophy accepts a URL argument). Browser profiles are isolated.

Deployment preflight verifies the required `SYNC_KEY_HASH` secret. The previously plain-text binding was preserved from deployment history and moved to a Wrangler secret; existing pairing links remain valid.
