# Sourcebook

A single-origin learning app. Six subjects, taught from the period's own documents:
a dense neutral spine, two or three primary sources, a named interpretation with its
counter-argument, practice, and illustrations.

Subjects and units:

| Subject | Folder | Units |
| --- | --- | --- |
| World History | `content/history` | 24 |
| American History | `content/american-history` | 16 |
| Geography | `content/geography` | 10 |
| Philosophy | `content/philosophy` | 10 |
| English (grammar) | `content/english` | 12 |
| Literature | `content/literature` | 10 |

## Content layout

```
content/<subject>/<NN-slug>/
  unit.json      # title, period/region, sources, interpretations, activities, images
  spine.md       # the synthesis (3,500-4,200 words)
  sources/*.md   # quoted public-domain primary documents
  assets/*.jpg   # attributed images
```

## Commands

```
npm run validate   # schema + framing lint + regenerate content/MANIFEST.md
npm run render     # build dist/ (the site the Worker serves)
npm test           # content tests (schema, sources, framing, images, activities)
npm run check      # validate + render + test
```

The framing lint (`src/framing-lint.ts`) bans present-day pedagogical and moralising
vocabulary from authored text. It never runs on quoted primary sources.

## Deploy

The app is a Cloudflare Worker (`worker.mjs`) that serves the rendered `dist/` through
the `ASSETS` binding and answers `/api/progress` from D1. Config is `wrangler.jsonc`
(Worker name `sourcebook`, D1 `learning-progress-sync`, `APP_ID=sourcebook`).

```
npm run render
npx wrangler deploy
```

Auth is a single private pairing key (64 hex chars). The Worker stores only its
SHA-256 hash, in the `SYNC_KEY_HASH` secret:

```
printf '%s' "$(printf '%s' "$KEY" | sha256sum | cut -d' ' -f1)" | npx wrangler secret put SYNC_KEY_HASH
```

The pairing link is `https://<worker-host>/#sync=<key>`. Opening it once stores the key
in that browser; progress then syncs across devices. The live link is kept outside the
repository in `~/Projects/learning-platform-private/sourcebook-pairing.txt` (mode 600).

### Sync model

`/api/progress` is a revision-checked JSON snapshot in the shared `progress` table,
keyed by `app_id`. GET returns `{revision, state}`; PUT sends `{revision, state}` and
bumps the revision. The comparison and write are one SQL statement, so a stale writer
gets `409` and retries instead of clobbering a newer snapshot. The client
(`SourcebookSync`, embedded by the renderer) merges completions by union and falls back
to `localStorage` when unpaired or offline.

### Cloudflare Access (optional)

The Worker currently uses the pairing key, matching the v1 production apps. To move to
Cloudflare Access: create a self-hosted Access application for the Worker hostname with
an owner-email policy, then add JWT validation to `worker.mjs` (the v1 implementation is
`packages/progress/access.mjs`, using `jose` and `ACCESS_ISSUER` / `ACCESS_AUD` /
`OWNER_EMAIL`). Access cannot be configured with Wrangler alone.
