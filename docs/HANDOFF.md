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
- English: `c80bf1d0-871b-4888-a8b1-6c8bd0020745`
- History: `c2e8477d-622b-4948-8590-316ebb9b2b5b`
- Philosophy: `c5189e7f-b578-4526-8bd2-4b4f4336d6a2`

The `0002_tutor.sql` migration was applied to the preview D1 database. The tutor route was exercised against the real `@cf/meta/llama-3.1-8b-instruct-fp8` model with a local `wrangler dev` run: it returned a grounded reply and counted usage (`remaining: 39`).

Remaining, owner-gated:
1. Exemplar content review before curriculum expansion (Milestone 2): confirm the multiple-choice mix and tutor behavior on the previews.
2. Production cutover: refresh backup, `npm run restore-drill`, review live provenance, then deploy. See `docs/RELEASE.md`.
3. Paid AI overage remains disabled; enabling it needs a new provider/spending agreement.
