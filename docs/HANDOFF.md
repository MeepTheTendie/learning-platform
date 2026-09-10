# Current checkpoint — 2026-09-10

User wants the approved learning-app work continued, with economical token use. Work locally without subagents. Browser recovery exports were explicitly waived; do not ask again. Preserve the private cloud backup and existing production until migration acceptance checks pass.

## Verified and implemented
- Monorepo imports preserve all three histories and latest History illustrations. Shared build, progress Worker, sync client, merge logic and CI are present.
- The old Access blocker was stale: live API inspection confirms `meep-learning.cloudflareaccess.com`, owner-email-only Access application `9025fce3-e998-4c7f-abd5-20ade6229ecd`, and all three deployed preview Workers.
- All previews use D1 `learning-platform-preview` (`62dd3923-e3e5-4454-b764-655d4e2714da`), separate from production `learning-progress-sync` (`5a9273d4-9360-4a6e-a146-cb432e68f03b`). Preview `progress` table exists. No production data writes this turn.
- Access JWT verification uses jose with issuer, audience, expiry and owner-email checks. Do not use ctx.access with these Static Assets apps: the router does not propagate it. Docs: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ .
- App adapters apply downloaded state without reload, defer UI replacement while editing, merge in-flight changes, and retry offline edits. Save status replaces the floating pairing widget in the new build.
- Unresolved conflicts now live separately from the three rotating routine recovery snapshots and are included in recovery downloads. Storage failure aborts conflict merge rather than deleting older unresolved copies.
- Philosophy commonplace note drafts now save locally and sync, survive reload/validation, and clear when converted to a saved entry.
- Sync writes carry stable client operation IDs through acknowledgement and retries. English and Philosophy now persist reading positions; History already did. The migration/rollback test copies a synthetic progress backup into an isolated database, verifies it, deletes it, and restores it.
- Root and app README build/preview guidance updated.

## Validation this turn
- `npm run check`: auth/store/sync tests, all three builds and Wrangler deployment dry runs pass.
- `node tests/run-browser.mjs`: all three apps pass two-browser live-state and mobile checks. History/English deletions and offline merging pass. English active-writing merge and conflict retention across later downloads pass. Philosophy draft reload, cross-device sync, offline retry and save-entry clearing pass.
- Browser tests use local in-memory SQLite and legacy test authentication. They do NOT establish successful real Access login or authenticated deployed writes. JWT verification is tested separately.
- The sandbox blocks localhost browser tests; approved `node tests/run-browser.mjs` outside sandbox. Saved Wrangler login refresh/deploy also requires network access outside sandbox; use approved `npm run preview` when needed. Never print tokens.

## Remaining milestone 1 work
1. Live owner sign-in / two-device acceptance is waived by the user for this milestone. Previews remain available at https://learning-{english,history,philosophy}-preview.history-atlas.workers.dev/ . No production cutover yet.
2. Refresh the production cloud backup immediately before any real cutover, verify full live asset/Worker provenance, and preserve current production data, URLs and latest illustrations.
3. Keep real account-authenticated migration gated until the user elects to cut over. Optional paid AI remains gated on provider/spending agreement.

Cloudflare Codex duplicate login was addressed separately: config disables plugin duplicate `cloudflare-api`, keeps authenticated `cloudflare`. Do not redo OAuth unnecessarily.

## Deployed checkpoint
All three previews updated successfully this turn. Unauthenticated `/` and `/api/progress` on each return HTTP 302 to `meep-learning.cloudflareaccess.com` (six checks passed).
- English version: `8893d1e0-6bef-4e3f-9da7-1df7cc7b7b31`
- History version: `9711317c-38fb-4c02-a918-8803ee4fea4d`
- Philosophy version: `08f7487a-fee8-469d-984d-3b6c6d943646`
Production was not deployed or migrated. Unit/build/dry-run and local browser checks passed before these preview deployments.

## Milestone 1 continuation
Stable sync operation IDs, English and Philosophy reading positions, and the isolated migration/rollback rehearsal were added after the previous preview checkpoint. The updated previews were deployed from the tested build:
- English version: `32c1433b-c9ad-4779-962c-1ead2f5803f5`
- History version: `05e17ba3-7a37-4de1-ab10-d0a95badb752`
- Philosophy version: `0cf679f7-f36c-4411-a746-72dd650bce25`

The deploy output confirmed each preview was built from the local `dist/` assets and bound to `learning-platform-preview`; no production Worker or D1 binding was targeted. The remaining production-gated actions are a fresh backup immediately before cutover, final live provenance review, and an explicit decision to migrate production.

## Milestone 2 current state
The shared content contract and first exercise renderer are in `packages/learning-content`. Reviewable exemplars are in `content/exemplars/` for English sentence structure, History early cities, and Philosophy argument reconstruction. They validate in `tests/content.test.mjs` and appear in a separate review surface; they do not replace the live curriculum until content direction is approved.

The review surface is now wired into each preview build behind a `Start lesson`/`Review exemplar` link. It loads the subject lesson, renders teaching sections and activities, saves draft responses locally, and provides hints, rubrics, attempt counts, revision checks, and self-checks. English has 3 activities, History 4, and Philosophy 4. `tests/exemplars.cjs` covers all three interfaces; existing curriculum routes remain unchanged.

The three first lessons are complete as reviewable preview content:
- English: subject, predicate, fragment repair, editing, and written explanation.
- History: river settings, chronology, causal reasoning, evidence/inference boundaries, and source comparison.
- Philosophy: conclusions and premises, fair reconstruction, hidden assumptions, objections, and counterexamples.

The review surface now stores answers and attempt metadata in each app's canonical synced state (`state.exemplars`), so exemplar work syncs between devices, merges offline, participates in conflict handling, and is included in recovery backups. Older `learning-exemplar-v1-*` drafts are migrated into canonical state on first load and then removed. Shared sanitization lives in `packages/learning-content/progress.mjs`; `tests/exemplar-progress.test.mjs` and the extended `tests/exemplars.cjs` cover migration, cross-device sync, the sequence round-trip and offline merge.

Do not replace existing curriculum routes or production data. Keep content and preview deployments isolated.

Latest preview versions with the review surface (pre-sync build):
- English: `8fe6008e-89f4-4665-8fd9-81874c9aa34b`
- History: `82d0c968-4536-4c6a-942b-551b80f34a27`
- Philosophy: `a1a86117-5443-4556-aebe-1fceab8b344f`

## Takeover checkpoint

Latest commits, newest first:
- `a35174f` documents the milestone two takeover state (this handoff).
- `ecb99b1` marks the first subject lessons complete in the plan.
- `d39ec76` records the Philosophy preview deployment.
- `2cbcda0` adds the complete Philosophy lesson.
- `68f0b36` records the History preview deployment.
- `e926b96` adds the complete History unit.
- `aa4341a` records the shared lesson preview versions.
- `1040820` adds the complete English lesson chapter.
- `7366c9f` finishes the exemplar review flow and attempt tracking.

Checks currently passing: `npm run test:auth`, `npm run test:browser`, and the earlier full `npm run check`. Before handing off new code, rerun `npm run check` and `npm run test:browser`, then deploy only the affected preview with `npm run preview -- <subject>`.

The next model should inspect the three app state validators and `packages/progress/sync-client.js`, then implement synced exemplar progress. Do not begin paid AI feedback, production migration, or broad curriculum expansion yet.

## Synced exemplars and operations — 2026-09-10

Exemplar progress is now part of each app's canonical synced state. Changes made this turn:

- `packages/learning-content/progress.mjs` defines and sanitizes the `state.exemplars` shape (`responses`, `attempts`, `passed`, `updatedAt` per lesson).
- `packages/progress/sync-client.js` exposes `LearningSync.read()`, `whenReady()` and `refresh()`, dispatches a `learning-sync:applied` event, and keeps the save widget outside `<main>`.
- `packages/learning-content/exemplar-review.mjs` reads and mutates canonical state, migrates legacy `learning-exemplar-v1-*` drafts once, and hands the view back to the app on leaving `#exemplar`.
- English, History and Philosophy state schemas carry and preserve `exemplars`; the app re-renders are deferred while the exemplar route is active.
- The shared renderer now round-trips sequence answers (1-based input, 0-based storage).
- Milestone 3 operations: `npm run backup`, `npm run restore-drill`, `npm run health`, and `docs/RELEASE.md`.

Validation: `npm run check` (17 unit tests plus builds/dry runs) and `npm run test:browser` (all three apps: cross-device state, offline merge, exemplar migration, exemplar cross-device sync, sequence round-trip, mobile, tutor send/sync) pass. `npm run health -- preview` returns 302 to Access for all six checks.

## Grounded tutor and lesson rebalance — 2026-09-10

Owner direction: written responses broke flow, so lessons are now mostly multiple choice with one short reflection; and a back-and-forth tutor was requested. Owner agreed to Cloudflare Workers AI on the free tier with a hard daily cap, and to syncing tutor conversations.

- `packages/progress/worker.mjs` adds `POST /api/tutor`: authenticated like progress sync, grounded only in the lesson's own content, capped per app per UTC day via the new `tutor_usage` table (`migrations/0002_tutor.sql`), with `TUTOR_ENABLED`, `TUTOR_MODEL` and `TUTOR_DAILY_LIMIT` vars and an `AI` binding in all six Worker configs.
- `packages/learning-content/tutor.mjs` defines and bounds the `state.tutor` shape; `exemplar-review.mjs` renders the chat, keeps the typed draft across re-renders, and saves each exchange into canonical synced state.
- English, History and Philosophy schemas carry `tutor` alongside `exemplars`; conversations are bounded to 40 messages per lesson.
- All three exemplars were rewritten to 5 choice activities plus 1 short reflection (History keeps one sequence).

Deployed previews from this commit (Cloudflare Access, `learning-platform-preview` database):
- English: `f99d5774-489c-4556-ab51-0a97c73cc468`
- History: `7ce5a33d-de57-4062-80e9-3c5fcbb2e445`
- Philosophy: `534aab9f-69f6-4a6d-aa18-47ca551822ea`

The `0002_tutor.sql` migration was applied to the preview D1 database. The tutor route was exercised against the real `@cf/meta/llama-3.1-8b-instruct-fp8` model with a local `wrangler dev` run: it returned a grounded reply and counted usage (`remaining: 39`).

## Production cutover — 2026-09-10

The owner approved shipping everything to production. Production was cut over in place; it keeps the original legacy pairing auth (Cloudflare Access remains on the previews only).

Before deploying: refreshed the production D1 export to `~/Projects/learning-platform-private/backups/learning-progress-sync-20260910-161015.sql` (sha256 `a35275f83412dff2912beca057c7140394e93121b3ac40e345b6ecbe6f1f61a1`), verified it with `npm run restore-drill` (integrity ok; Grammar 12, History 15, Philosophy 1), and applied `0002_tutor.sql` to production D1.

Production versions:
- grammar-reader: `d098399c-09b5-431d-a8af-6fa84230b6fc`
- history-atlas: `614f4456-a9c6-4e02-b7b3-a4c4aa07a2b7`
- philosophy-scholar: `318a6abe-c84f-47a0-990c-230aec5076b7`

Verified after deploy: `npm run health -- production` passes (shell 200, anonymous progress 401), the served HTML includes the new sync client and exemplar review, and production D1 rows are unchanged (revisions 12/15/1).

Also this turn: the new sync client restored the legacy pairing control ("Copy pairing link" plus `#sync=<key>` handling), and shared practice points now award for the lesson reflection, tutor exchanges, and revisiting a previously missed activity. English and Philosophy mirror those awards into their native XP; History shows them in the lesson.

Remaining, owner-gated:
1. Exemplar content review before curriculum expansion (Milestone 2): confirm the multiple-choice mix, tutor behavior, and practice points.
2. Paid AI overage remains disabled; enabling it needs a new provider/spending agreement.

## Philosophy guided lessons and recognition-first — 2026-09-10

Owner feedback: at the end of a History unit, the free-response prompts "blanked" because the source text is dense and recall after days is hard. The design now expects forgetting rather than treating it as failure.

- `scripts/build-philosophy-lessons.mjs` converts all 13 authored Philosophy lessons into the shared lesson contract under `content/lessons/philosophy/` (choice-heavy with one written reflection each); `tests/content.test.mjs` validates every one.
- The shared review surface gained a guided lesson library (`#lessons` / `#lessons/<id>`) and the tutor now grounds on the specific lesson file. English and History keep their single exemplar.
- Lessons render **recognition-first**: quick checks first, then an explicitly optional "in your own words" section. Completion is based on the recognition activities only.
- Written prompts now carry an optional, no-penalty "Show the passage" (source context at recall). History's unit prompts were relabeled optional and gained a "Re-read a passage from this unit" button.
- Owner chose recognition-first and source-context-at-recall; chunking dense text and fuller spaced review remain open.

Deployed this turn:
- Previews: English `4988264e-05b9-4295-a681-a1277d0541e0`, History `a5a1d62e-1c47-4407-adee-2922cff82ff9`, Philosophy `01676c4c-384b-4e9a-bb17-4b6e77cdc2e1`.
- Production: grammar-reader `4e92e0b4-0db5-4444-9b2d-50c9cff87ef0`, history-atlas `928f8d31-205a-44b2-901f-f249a184260f`, philosophy-scholar `6e8f14a9-fc85-4949-9110-427234088c6e`.
- Verified: production health passes and `content/lessons/philosophy/index.json` serves all 13 lessons.

Remaining, owner-gated:
1. Continue content expansion (History and English) in the same recognition-first format.
2. Paid AI overage remains disabled.

## Full guided lesson sets and security pass — 2026-09-10

Owner asked to finish the remaining expansion without further input, and to keep GitHub and Cloudflare secure.

- `scripts/build-history-lessons.mjs` generated 16 History unit lessons (recognition-first: an order check, an evidence-vs-inference check, a chronology sequence, then an optional reflection grounded in the unit's discussion guide).
- `scripts/build-english-lessons.mjs` generated 10 English quiz-topic lessons (one multiple choice plus a reflection grounded in the explanation). The full book keeps its existing section exercises.
- The shared library now serves all three subjects at `#lessons`; the tutor grounds on the specific lesson file for every subject.
- `tests/content.test.mjs` validates every generated lesson, and `tests/exemplars.cjs` exercises all three libraries (counts, recognition pass, reflection passage, cross-device sync).

Security:
- Repository is private; no secrets are tracked and `.gitignore` covers `.dev.vars*`, `.env*`, bundles and sqlite files.
- Enabled Dependabot alerts and security updates. GitHub Free does not offer secret scanning or branch protection on private repos, so those remain unavailable.
- Actions default token permission is read-only; the workflow itself requests only `contents: read`.
- Cloudflare: production keeps the legacy pairing key (API refuses anonymous writes), previews stay behind Cloudflare Access, the AI binding exposes no key, and the tutor endpoint is authenticated, capped and token-limited.

Naming: the preview Workers keep their `-preview` names deliberately. Renaming a Worker changes its `workers.dev` hostname, and the new hostname would not be covered by the existing Access application (which I cannot reconfigure with the current credentials), so a rename would drop the Access sign-in and make the previews unusable. The `-preview` suffix already marks them as non-production.

Deployed this turn:
- Previews: English `775fec4d-9d52-41fa-88ac-5f407b0cd767`, History `2ab0bc29-64ec-4cad-af33-e3ce8144c91b`, Philosophy `633f35cb-49f8-4138-a661-9e886717fe02`.
- Production: grammar-reader `c559178f-3335-42d6-bb6d-bc0cfec015fe`, history-atlas `51037097-fbb6-445c-9bd5-fc9ae5c53eb4`, philosophy-scholar `4fdbbdf3-8a77-441b-8fb0-5e513e5cc02f`.
- Verified: production health passes and each app serves its lesson set (English 10, History 16, Philosophy 13). The app header wraps on small screens now that it carries the guided-lessons link.

Remaining: full English book conversion (~111 sections) remains an ongoing content effort; paid AI overage stays off.

## Geography Atlas — 2026-09-10

Owner asked for a fourth subject, Geography, scoped as a world survey.

- New app `apps/geography` (Worker `geography-atlas`, preview `learning-geography-preview`), reusing the shared progress/sync Worker, tutor, and guided lesson library. Its own app shell is a minimal state manager (`exemplars`, `tutor`, `awards`, theme).
- `scripts/build-geography-lessons.mjs` generated 16 recognition-first lessons across four groups (Map skills, Physical geography, Human geography, Regions), each with multiple choice and one optional reflection carrying a passage.
- Auth: Cloudflare Access does not cover new hostnames (verified: the new preview returned 200, not 302), so Geography uses the legacy pairing key on both preview and production. To avoid clobbering the account-wide pairing cookie used by the other subjects, the shared sync client gained an app-scoped key (`KEY_SCOPE=app`) stored in the origin's localStorage. Pairing links are in `~/Projects/learning-platform-private/geography-pairing.txt` (mode 600).
- Wiring: `packages/progress/worker.mjs` (tutor subject), `scripts/build-app.mjs` (optional exemplar + lessons copy), `scripts/preview.mjs` (allow app-scoped previews), `scripts/check-health.mjs`, and the content/browser tests all include geography.

Deployed:
- Preview: `796b26ed-0d42-4d13-969e-d6340943d6c1` (legacy app-scoped key; `/` 200, `/api/progress` 401).
- Production: `e6afd49e-7fb3-402b-b8c4-cbc56ccb8c54` (same; serves 16 lessons).
- Verified: `npm run health` passes for preview and production; all existing apps unchanged.

Remaining: Geography shares the `learning-progress-sync` database (separate `geography-atlas` row). The owner pairs Geography once per device using the links in the private file.

## Lesson completion — 2026-09-10

Owner reported finishing a Geography lesson with no way to mark it complete. Added to the shared lesson view:

- A **Lesson status** card with a **Mark lesson complete / Mark as not complete** toggle.
- Automatic completion when every quick check passes.
- Completion state is stored in the canonical synced record (`exemplars[lessonId].completed`), so it syncs and survives reloads; the guided-lessons list shows a ✓ and "completed" per finished lesson.

Deployed to all four previews and all four production apps this turn (completion is shared code). Verified with the browser tests, which now assert the toggle, persistence and cross-device sync. Production health passes.

## Learning Hub — 2026-09-10

Owner wanted a progress tracker outside ChatGPT that spans all their learning. Khan Academy and Biblingo have no public APIs (Khan's old API is retired; Biblingo is closed), so external learning is logged by hand while the platform's own apps aggregate automatically.

- New app `apps/hub` (Worker `learning-hub`, preview `learning-hub-preview`). Its Worker wraps the shared one and adds authenticated `GET /api/hub`, which reads the shared `progress` table and returns per-subject lessons completed, practice points, activities passed, and last-active time.
- The client shows subject cards (English, History, Philosophy, Geography), a manual "log a session" form (date, source, subject, minutes, note), totals, a day streak, and a recent log. Logs are stored in the hub's own synced state.
- Uses the app-scoped key (`KEY_SCOPE=app`), no Access, like Geography. Pairing links were appended to `~/Projects/learning-platform-private/geography-pairing.txt`.
- `scripts/build-app.mjs` now skips the lesson-review injection for subject-less apps; the hub has a unit test for aggregation and auth.

Deployed: preview `8e323c1b-a640-433f-9e64-52498dc7633a`, production `f630acc3-7efb-46dc-a18a-95dbed5921c4`. Health passes (`/` 200, `/api/progress` and `/api/hub` 401).
