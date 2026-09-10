# Learning platform: approved delivery plan

Approved by the user on 2026-09-09. Deliver in three milestones with tested commits and persistent handoffs. Maintainability takes priority over beginner-readable code. Do not promise exactly three context windows.

## Milestone 1 — foundation and saving
- [x] Audit local Git status and current GitHub heads.
- [x] Record live deployments, storage bindings, and sync implementation.
- [x] Export production D1 and verify SQL restoration locally.
- [x] Back up existing Git histories; preserve newer History illustration fixes.
- [x] Browser recovery exports explicitly waived by user; preserve cloud backup.
- [x] Create a monorepo preserving the three histories and separate app deployments/URLs.
- [x] Establish shared, established authentication (Access configured and previews deployed), preview isolation, and shared persistence.
- [x] Replace pairing widget with sign-in and discreet save status.
- [x] Introduce stable sync operation IDs, drafts, reading positions, revision-checked writes and offline retry; retain conflicts.
- [x] Test cross-device edits, offline recovery, and isolated migration/rollback rehearsal. Live two-device sign-in acceptance is waived for this milestone by the user; retain the production gate for any real migration.

## Milestone 2 — interactive learning
- [x] Shared validated content format and exercise components (first version; app integration follows exemplar review).
- [x] One complete English chapter: inline grammar, editing, writing, hints and revisions (reviewable preview lesson).
- [x] One History unit: chronology, causal reasoning, evidence and source comparison (reviewable preview unit).
- [x] One Philosophy lesson: argument reconstruction, objections and counterexamples (reviewable preview lesson).
- [ ] Integrate exemplar lesson drafts, attempts, and completion into each app's canonical synced progress state.
- [ ] User review of exemplars before expansion; agree concrete content coverage rather than assuming every book exercise is already scoped.
- [ ] Preserve useful existing exercises and book illustrations.

## Milestone 3 — feedback and hardening
- [ ] Optional grounded AI feedback with explicit provider/spending agreement before paid calls.
- [ ] Continue learning and mistake-based review, reusing existing features where useful.
- [ ] Monitoring, automated backup, restoration drill and release documentation.

Essential regression checks and recovery safeguards belong in every milestone. Existing sites stay available during development. Production data must never be used for test writes. Keep private exports outside source control. Archive old repos only after replacements are verified. No Hetzner DB or custom authentication system planned.
