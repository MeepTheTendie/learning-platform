# Sourcebook

A single-origin learning app. Seven subjects, taught from the period's own documents:
a dense neutral spine, two or three primary sources, a named interpretation with its
counter-argument, practice, and illustrations.

Subjects and units:

| Subject | Folder | Units |
| --- | --- | --- |
| World History | `content/history` | 24 |
| American History | `content/american-history` | 16 |
| Geography | `content/geography` | 10 |
| Economics | `content/economics` | 4 |
| Philosophy | `content/philosophy` | 10 |
| English (grammar) | `content/english` | 12 |
| Literature | `content/literature` | 10 |

Economics units should be checked against university, library, archive, or open-course anchors where possible. Good non-Ivy anchors include MIT OpenCourseWare, OpenStax/Rice, Toronto Metropolitan University Pressbooks, ETH Bibliothek, UQAM Classiques des sciences sociales, the University of Pennsylvania Online Books Page, California Digital Library scans in the Internet Archive, and other institutional collections.

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
npm run render     # create/update WebP companions, then build dist/ (the site the Worker serves)
npm test           # content tests (schema, sources, framing, images, activities)
npm run check      # validate + render + test
```

The framing lint (`src/framing-lint.ts`) bans present-day pedagogical and moralising
vocabulary from authored text. It never runs on quoted primary sources.

The browser layer is native HTML, CSS, and JavaScript. The renderer copies the
small source files in `src/styles.css`, `src/reader.js`, `src/unit.js`, and
`src/index.js` into cacheable `dist/assets/` files; there is no UI framework or
client-side bundler.

Each attributed source JPEG has a generated WebP companion, made by the local
ImageMagick `magick` command during `npm run render`. Lesson pages use WebP where
supported, retain JPEG fallback, eagerly load only the lead map, and lazy-load the
remaining illustrations.

## Study features

Each unit page carries, all stored in one synced state object:

- **Completion** — marks the unit done and schedules its first spaced review.
- **Bookmarks** — a per-unit star; bookmarked units are listed on the index.
- **Notes** — a synced text area per unit (debounced).
- **Spaced review** — completing a unit schedules it; the index lists what is due;
  "Mark reviewed" doubles the interval (1, 2, 4 … up to 180 days).
- **Tutor** — a grounded chat answered by Cloudflare Workers AI from the unit's own
  spine and sources (`POST /api/tutor`, capped per day, material served from
  `dist/tutor/<subject>/<unit>.json`).

Across devices the sets (completions, bookmarks) merge by timestamped tombstones, so an
unmark propagates instead of being resurrected; notes, conversations, and review
schedules merge by timestamp.

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
(`src/sync-client.ts`, embedded by the renderer as `SourcebookSync`) queues an edit made
while a write is in flight, keeps tombstones so deletions sync, and falls back to
`localStorage` when unpaired or offline.

### Cloudflare Access (optional)

The Worker currently uses the pairing key. To move to Cloudflare Access: create a
self-hosted Access application for the Worker hostname with an owner-email policy, then
add JWT validation to `worker.mjs` (the earlier v1 implementation, now removed from the
tree but preserved in Git history, used `jose` with `ACCESS_ISSUER` / `ACCESS_AUD` /
`OWNER_EMAIL`). Access cannot be configured with Wrangler alone.
