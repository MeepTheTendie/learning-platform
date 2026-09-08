# Philosophy Scholar

The Philosophy Scholar learning app, deployed at https://philosophy-scholar.history-atlas.workers.dev/.

Progress is stored in the browser and synchronized through the Worker to the shared Cloudflare D1 database. The previous deployment only used browser storage, which is why progress created on one computer did not appear on another.

## Layout

- `public/` contains the app.
- `src/worker.mjs` implements authenticated progress sync and D1 storage.
- `scripts/build.mjs` packages the static app into the Worker.
- `migrations/` contains the D1 schema.

## Build and deploy

Run `npm run build` to generate `dist/worker.mjs`, then `npm run deploy` to deploy it with Wrangler. The Cloudflare Worker requires a `SYNC_KEY_HASH` secret and the `PROGRESS_DB` D1 binding declared in `wrangler.jsonc`. The private pairing key is intentionally excluded from this repository.

