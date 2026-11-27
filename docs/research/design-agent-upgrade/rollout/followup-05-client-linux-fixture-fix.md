# Client pilot — portable Linux archive-test fixture

## Scope and status

**Local technical GREEN; fresh independent narrow review and new actual Linux CI remain pending.** This report is implementer evidence, not independent approval or owner acceptance. One actual Hermes implementation subagent applied the coder/QA self-check perspectives after reading their contracts and `.codex/workflows/review-loop.md`; these are not separate reviewers or native role activations. The coordinator owns review/gate registration.

Base HEAD: `d0ab31fb90de0bd24cc000b5597a9d6608d042d2`.
Only two admitted payloads:

- `.codex/scripts/test_client_design_pilot.py`
- `docs/research/design-agent-upgrade/rollout/followup-05-client-linux-fixture-fix.md`

No recipe, source-lock, CSS, browser harness, CI workflow, client content/media, old review or owner-pending artifact changed. No Git writes, push, install, browser/motion rerun, provider request, publication or deployment. Foreign concurrent work is outside scope and was not reverted or paused.

## Actual Linux failure and root cause

Actual CI run **46083975998**, full Python regression step: **101 tests, one failure**, exit 1, at `ArchiveIsolationTests.test_gitless_archive_and_poisoned_disposable_canary`, old line 156. Preserved original log:

`~/.hermes/cache/scratch/stroymat-r3-repair-v1/frozen-v4/linux-first-failed.log`

SHA-256: `a04f245113acf5336e43bc38ae4d586f4be9410962965b2f371f3724dd3e9ee8`.

The log records Python **3.12.16** and `TMPDIR=/home/runner/work/_temp/design-ci-owned`. The old fixture used unqualified `TemporaryDirectory()`, placing its `clean`/`poisoned` outputs outside `$HOME/.hermes/cache/scratch`. The unchanged recipe correctly rejected them with `ValueError: New output directory must be private Hermes scratch, outside repository`. Local Mac TMPDIR inside private scratch concealed this test-only portability defect. Changing the output safeguard or CI TMPDIR would hide rather than repair it.

Existing CI pins remain untouched: Node `24`, Python `3.12`; checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node `949feb2413d6458794dcd2491c4babbbce0c15c1`, setup-python `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0`.

## Minimal repair and TDD

Added a separate `ArchiveFixturePortabilityTests` class. Its fixture is explicitly inside real private Hermes scratch. It creates a disposable HOME and a TMPDIR outside that HOME's allowed scratch root, asserts that separation, strips inherited `GIT_*`, `PYTHONPATH` and `NODE_PATH`, then invokes **only the existing exact ArchiveIsolation test method** with `sys.executable`. This cannot recurse into the new regression. The nested old test still executes both clean generation and its deliberately poisoned disposable fake-`.git` canary, plus all nine `ClientPilotTests` in each archive. No main Git metadata is donated.

**Actual RED before repair:** new focused regression exited 1; the nested unchanged old test failed at line 156 on the exact private-output safeguard. Saved `red-test.py` contains the new regression and old faulty fixture. Its SHA-256 is `422aa194498da6aac6e43f265c0f6467cc97c06b307fa1a564b26bfb7c6e40ab`. The failure is not a syntax/import/zero-test error.

Only repair to the existing method: create `Path.home() / '.hermes/cache/scratch'` with `mkdir(parents=True, exist_ok=True)`, then pass it explicitly as `TemporaryDirectory(dir=private)`. All existing source, media, canary-byte comparisons and negative output/symlink/repository guards remain unchanged.

**Actual focused GREEN:** both the new portability test and existing ArchiveIsolation test passed: **2 tests, 3.144s**, exit 0.

**Actual full GREEN:** stdlib discovery in a fresh Git-less actual-HEAD archive plus owned test overlay: **102 tests, 16.102s**, exit 0; no skips/failures/errors. Count derived from real unittest output, not assumed. Selftest exited 0 (45 original roles + codex-docs; 22 skills; lifecycle/MCP/source mappings/syntax checks); readonly role sync exited 0, `Drift: none`.

## Reproducible commands and receipts

Private evidence root:

`E=~/.hermes/cache/scratch/stroymat-r3-repair-v1/linux-fixture-fix`

`clean-export/` starts from `git --no-optional-locks archive d0ab31fb90de0bd24cc000b5597a9d6608d042d2`, not copied dirty working-tree content. `actual-head.tar` SHA-256: `864c88b3c2eb2e919958ec2cdc6f58d015e269949124dffde51e01f11b73ffd8`. The final review export overlays exactly the two admitted payloads. No `.git` exists in the export. `owned/`, `owned-manifest.json`, `export-manifest.json`, `verification.json` and `receipts.json` freeze exact source/export/receipt hashes for the fresh reviewer; external manifest hashing avoids a self-referential report hash.

All test commands run from `E/clean-export`, with the actual Hermes **Python 3.14.9** interpreter (`sys.executable`), `/usr/local/bin/node` **v24.21.0**, PATH `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`, TMPDIR `E`, `PYTHONDONTWRITEBYTECODE=1`, and inherited `GIT_*`, `PYTHONPATH`, `NODE_PATH` removed. This is a local simulation of the Linux containment condition, not a new Linux CI result.

```text
<sys.executable> .codex/scripts/test_client_design_pilot.py ArchiveFixturePortabilityTests -v
# focused-red.log: exit 1 before fixture repair
<sys.executable> .codex/scripts/test_client_design_pilot.py ArchiveFixturePortabilityTests ArchiveIsolationTests -v
# focused-green.log: 2 tests, OK, exit 0
<sys.executable> -m unittest discover -s .codex/scripts -p test_*.py -v
# full-green.log: 102 tests, OK, exit 0
<sys.executable> .codex/scripts/selftest.py
<sys.executable> .codex/scripts/sync-roles.py
```

The final two-file review export is re-exercised after this report is overlaid; final receipts and source pins are in `verification.json` rather than claiming an unexecuted result here. The old Linux log is retained, not overwritten or rerun.

## Preservation and review boundary

Before/after read-only guards cover main HEAD, `.git/HEAD`, config, index and exact `ls-files --stage -z` output. All are unchanged; ref snapshots are recorded separately so legitimate foreign refs can be distinguished without rollback. The source-lock's **25 files** are checked for exact hash, size and executable mode in main and the clean export. Recipe/CSS/browser/source-lock and all other pilot regular files are hashed unchanged.

Old v4 frozen manifest SHA-256 remains `168c7322086daea3197ba61fb683f16dcd829ecadc411b17542c88c9ec33a48a`. All **4,649 regular files** under the existing `frozen-v4/` and `preview-v4-frozen-exact/` trees were hashed before this task and rechecked unchanged. This preserves earlier evidence; it does not claim a fresh browser/visual/motion run. The previous independent six-perspective review remains historical, bound to its original bytes, and does not approve this changed test. Owner selection/acceptance and rights limits remain PENDING/unchanged.

Self-review found no new guard weakening, recursive execution, production change or added dependency. Fresh independent acceptance of these exact two payloads is still required before any separately authorised publication/new Linux CI. A harmless first execution-wrapper attempt lacked its `shutil` import and stopped before running a test; importing it and rerunning produced the preserved real RED. An initial ad hoc source-lock probe compared each hash with the whole metadata record; the corrected probe verified all 25 hashes, sizes and modes. Neither diagnostic was hidden as a product/test failure or claimed GREEN.
