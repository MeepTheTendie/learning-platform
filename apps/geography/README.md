# Geography Atlas

A world geography survey app: map skills, physical and human geography, and the regions of the world. Lessons are recognition-first with an optional written reflection, and a grounded tutor for discussion.

- `public/` contains the app shell and its minimal state manager.
- `src/worker.mjs` re-exports the shared progress/tutor Worker.
- `content/lessons/geography/` (repo root) holds the 16 generated lessons.
- `scripts/build.mjs` uses the shared asset packaging.

## Notes

This app uses an **app-scoped pairing key** (`KEY_SCOPE=app`) rather than the account-wide pairing cookie, so it cannot overwrite the key used by the other subjects. It is not behind Cloudflare Access because Access does not cover new hostnames; the progress and tutor APIs are still key-protected.

Build and deploy with the shared tooling from the repository root:

```
npm run preview -- geography
npm run check --workspace=geography-atlas
```
