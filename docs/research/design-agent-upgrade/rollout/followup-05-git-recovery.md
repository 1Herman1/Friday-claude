# R3 — Git isolation incident: recovery and remaining work

## Cause

A delegated pilot worker exported the live repository's GIT_DIR and a scratch GIT_WORK_TREE into a regression suite. Nested Git-fixture commands inherited them and wrote the live Git metadata. This violated the no-Git-writes boundary. A scratch cwd alone is not isolation. The failed Python run (96 attempted;4failures/29errors) is not acceptance evidence.

## Restorative action, verified

At the owner's explicit request to restore the accidental changes immediately, the coordinator restored ONLY main Git metadata:

- Main branch `claude/greeting-nnz368`: CAS from fixture tip `5e3ae869464cd78072b41a7177f2ebe77d611e5a` to legitimate `77d9e09390835250b39a684d245a32f2338fff32`.
- Main index: exact4554 base mode/OID/path entries; staged diff against that base is empty.
- Local configuration: removed the demonstrably erroneous scratch core.worktree and Fixture name/email assignments. Legitimate committer identity and main worktree path read back correctly. This is an **inferred semantic repair**, not a claim to know byte-exact historical config/index images.
- Remote main branch read back unchanged at77d9e093. No push, reset, checkout, clean, rebase or service stop was used for recovery. Fixture commits remain in the preserved snapshot/reflog/object history; no pruning.
- Before/after source manifests:81730 records exactly equal (regular bytes, types, modes, symlink targets), including tracked/untracked/ignored files. Only the actively changing `trade-performance/prop-agents/engine/funding_monitor/out/` runtime subtree was excluded from the strict comparison; recovery never writes it. ACL/xattr identity is not certified.

Immutable post-incident Git snapshot and all attempts/receipts are private at `~/.hermes/cache/scratch/git-incident-20261127-201955/`; final read-back: `recovery-final-verification.json`. Exclusive config/index locks, isolated index construction, disabled reference hooks, expected hashes and explicit branch CAS were used. Original REQUEST_CHANGES and failed preflight/postcheck outputs remain preserved.

## Concurrent-work boundary

Another legitimate linked checkout was active. It fetched and refreshed its index during the recovery window. The broad postcheck therefore returned nonzero even though the three intended main targets and source preservation had already passed. Coordinator did NOT rerun recovery or undo that work: exact differences were inspected separately, limited to that checkout's FETCH_HEAD/index; its stage entries remained equal. A fresh checkpoint retained legitimate foreign ref/object changes made since the initial snapshot. No foreign branch was reset.

A legitimate concurrent media commit `9c5d2303` was authored under the temporary Fixture identity while the common config was contaminated. Its content/history was not rewritten: doing so could invalidate the other task's exact-SHA execution. Correct current identity is restored; this historical attribution consequence remains documented rather than falsely described as undone.

## Execution TZ — continue in order, no repeat continuation approval

1. Remove all live-Git dependencies from the pilot's recipe/unit tests. Use a source-lock manifest tied to the actual original77d9e093 bytes; unit tests read hash-checked files and need no Git repository.
2. Prove isolation with a Git-less clean export and a disposable poisoned-Git canary. No live GIT_* donation. Run suites in subprocess environments stripped of inherited GIT_*; inspect before/after main refs/config/index.
3. Regenerate A/B from current CSS; recheck the reported B long-RU ink overhang without weakening layout checks. Preserve old failures/screenshots.
4. Run full applicable clean regression, actual desktop/mobile/tablet/long-RU/reduced browser checks, then independent technical/visual review. No browser windows or installs in application dependencies.
5. Show real baseline/A/B to the owner. Owner visual acceptance remains PENDING; no production/client-media publication or paid generation.
6. Then continue original follow-up points4–9 in order. Native IDE, product accessibility, Figma/Canva permissions and other real gates are not implied by successful technical fixtures.

R1 fixes and r2 real Linux CI remain published and valid for their exact revisions. R3 is partial, not complete. No new browser or Python PASS is claimed by this recovery document.
