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
3. Keep real account-authenticated migration gated until the user elects to cut over. Then milestone 2 exemplar lessons for user review; optional paid AI remains gated on provider/spending agreement.

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

## Milestone 2 started
The shared content contract and first exercise renderer are in `packages/learning-content`. Reviewable exemplars are in `content/exemplars/` for English sentence structure, History early cities, and Philosophy argument reconstruction. They validate in `tests/content.test.mjs` and appear in a separate review surface; they do not replace the live curriculum until content direction is approved.

The review surface is now wired into each preview build behind a `Review exemplar` link. It loads the subject exemplar, renders three activities, saves draft responses locally, and provides a first self-check. `tests/exemplars.cjs` covers all three interfaces; existing curriculum routes remain unchanged.

Latest preview versions with the review surface:
- English: `c8edaab8-b37a-4be1-ae5c-2e51c220ced5`
- History: `c53eccf4-9391-4a16-a670-60ebcc48adb0`
- Philosophy: `9cfc880d-b0f6-4612-9cd5-38c7f730b6c5`
