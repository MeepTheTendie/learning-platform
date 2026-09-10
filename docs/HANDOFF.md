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
- Root and app README build/preview guidance updated.

## Validation this turn
- `npm run check`: auth/store/sync tests, all three builds and Wrangler deployment dry runs pass.
- `node tests/run-browser.mjs`: all three apps pass two-browser live-state and mobile checks. History/English deletions and offline merging pass. English active-writing merge and conflict retention across later downloads pass. Philosophy draft reload, cross-device sync, offline retry and save-entry clearing pass.
- Browser tests use local in-memory SQLite and legacy test authentication. They do NOT establish successful real Access login or authenticated deployed writes. JWT verification is tested separately.
- The sandbox blocks localhost browser tests; approved `node tests/run-browser.mjs` outside sandbox. Saved Wrangler login refresh/deploy also requires network access outside sandbox; use approved `npm run preview` when needed. Never print tokens.

## Remaining milestone 1 work
1. Complete real owner sign-in / two-device acceptance. Previews: https://learning-{english,history,philosophy}-preview.history-atlas.workers.dev/ . No production cutover yet.
2. Extend persistent drafts/reading positions where missing; stable per-response records and revisions are not yet implemented (storage is still per-app revisioned JSON snapshots).
3. Verify migration and rollback with synthetic isolated data, refresh cloud backup before real cutover, and verify full live asset/Worker provenance. Preserve current production data, URLs and latest illustrations.
4. Complete account-authenticated migration only after those checks. Then milestone 2 exemplar lessons for user review; optional paid AI remains gated on provider/spending agreement.

Cloudflare Codex duplicate login was addressed separately: config disables plugin duplicate `cloudflare-api`, keeps authenticated `cloudflare`. Do not redo OAuth unnecessarily.

## Deployed checkpoint
All three previews updated successfully this turn. Unauthenticated `/` and `/api/progress` on each return HTTP 302 to `meep-learning.cloudflareaccess.com` (six checks passed).
- English version: `8893d1e0-6bef-4e3f-9da7-1df7cc7b7b31`
- History version: `9711317c-38fb-4c02-a918-8803ee4fea4d`
- Philosophy version: `08f7487a-fee8-469d-984d-3b6c6d943646`
Production was not deployed or migrated. Unit/build/dry-run and local browser checks passed before these preview deployments.
