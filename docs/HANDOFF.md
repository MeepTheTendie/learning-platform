# Current checkpoint

User explicitly waived desktop recovery exports. Continue without asking again; they will redo marked pages. Preserve the cloud backup. New marks must sync between devices once migration is complete.

## Done
- Production database backup restored successfully in SQLite; source histories backed up.
- Monorepo imports preserve original histories and latest History illustration changes.
- Shared progress Worker, client and merge implementation; History wrapper retains illustration routes.
- Root npm workspace/lockfile, common build script and root GitHub CI workflow.
- All 26 existing tests pass; all 3 builds and Wrangler deployment dry runs pass.

## Not done
- Production remains unchanged: pairing box still exists there.
- Cloudflare Access API returned access.api.error.not_enabled. User was asked asynchronously to choose Access email-code login (dashboard activation required) or name another provider; response pending. Do not treat silence as activation/approval of account enrollment.
- No preview resources, new account authentication, fine-grained progress records, in-memory sync adapters or migration have been deployed.

## Next
1. Resolve Access activation/provider. Cloudflare docs: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ . Important: docs explicitly say ctx.access is not passed through the Static Assets router. These apps use Assets, so use verified Access JWTs via maintained library or a directly invoked auth gateway; never trust an email header by itself.
2. Provision separate preview D1/resources before remote test writes. Do not reuse production database in preview.
3. Implement authenticated shared persistence, app state adapters, discreet status and two-browser tests, including offline/concurrent changes.
4. Update stale per-app README paths/installation instructions as consolidation proceeds. Root README is authoritative for workspace builds.

Tests were run before build script deduplication; run root build after that final refactor. No runtime behavior changes intended in this consolidation checkpoint.
