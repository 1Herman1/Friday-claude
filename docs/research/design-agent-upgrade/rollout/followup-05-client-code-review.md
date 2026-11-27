# R3 Stroymat — independent technical/security/QA admission review

## Verdict and reviewer identity

**PASS — code admission only, for the exact seven payloads below.** No blocking technical/security defect found within this bounded, private-preview scope. This is not owner acceptance, independent visual/brand approval, a production release, a whole-repository/history audit, or certification of media/font rights.

Reviewer: **Hermes focused review subagent, gpt-6.1-sol / openai-codex**, runtime session `20261128_021735_875028`. One actual reviewer applied five separately reported lenses; these are **not five independent people or agents**. The reviewer did not implement or modify any candidate source. Only this review document was written in the repository. Disposable test fixtures and temporary regeneration outputs were confined to Hermes scratch and removed after execution.

Read the complete canonical role instructions for code-reviewer, typescript-reviewer, qa-engineer, security-secrets-scanner and silent-failure-hunter, plus `.codex/workflows/review-loop.md`; inspected their registered TOML wrappers. Also read project context/security profile and TypeScript rules/anti-patterns and security guidance. `docs/projects/stroymat/business-processes.md` does not exist; the static-page project brief and frozen pilot brief supplied the relevant workflow. No task-gate/implementation edits were made during this read-only admission assignment.

## Exact scope and source aliases

Repository/export base: `d89bcbcf0a88b9a000008328d67d80ec6c83b5a5`.

Private evidence root, abbreviated `E` below:
`/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-repair-v1/`.

Owned manifest: `E/frozen/owned-manifest.json`, SHA-256
`1f50055cbf720869dac5efefff6d5538dcbda3a0564f438c1552d8f4084d5c76`.

Every payload was read in full, not merely as a diff. All seven hashes and lengths match the frozen owned copy, frozen clean export and live owned paths. Manifest modes are regular non-executable text files (`100644`); no generated HTML, screenshots, binary media or production source belongs to this admission.

| Exact owned path | SHA-256 |
|---|---|
| `.codex/scripts/test_client_design_pilot.py` | `4433bdf667ef7b8d55c8d58a266bc4a99c0dd175d5e1cb23c2cc79233d165738` |
| `docs/research/design-agent-upgrade/rollout/followup-05-client-pilot.md` | `dc4762853c1bdeb98e57c57d77c016326a27713951643fa314df8d5a2562beb3` |
| `docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/README.md` | `cd665c60a448bab84267340c5fdf9ee2790effbffcdf8188e6e002e051d67ca5` |
| `docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/browser-check.mjs` | `b248fd4fdc40637be903344bf4caa6506b4c77e77d37ac6b05f8424ec1b87f1c` |
| `docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/layouts.css` | `f04bcbc03eed6c3e6f8e9881d421f180e83af1f2c9b0e73095f297680c6bbed2` |
| `docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/recipe.py` | `22ecaedc644199ee9ad38c7569aaf8cd48fb89162422db5e9481caaacf4dcaa1` |
| `docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/source-lock.json` | `27d0d7f60c3b1f8b0df9943f669ceac20ab11025ad787f54109d731a13360584` |

Original source alias: `77d9e09390835250b39a684d245a32f2338fff32`, all **25** locked `projects/stroymat/` files. Independently matched their Git blob identities against a clean-environment, read-only `git ls-tree -rz` of that commit. The compiled baseline alias is SHA-256 `528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca`.

Verified all **4,558** actual archive entries against base-commit modes/blob IDs with read-only `git ls-tree -rz`; then checked the clean export against the archive, except for the explicitly owned overlay: zero mismatches and zero unlisted extra files. The export has no `.git`. This is provenance checking, not a full-repository code review. No foreign live working-tree edits were imported.

The existing inline script blocks are byte-identical between baseline and both generated proposals. All original href occurrences remain, with exactly the two added navigation hrefs (`#materials`, `#price`). R3 admission does not re-approve or claim new execution of the separate R2 engine/motion/SSR/TypeScript/76-Node evidence.

## Independently executed checks

Interpreter actually used:
`/Users/germanbryzgalov/.hermes/installs/85f1f94234f7e14a/environments/2cb3796150ef4be4b476ddcadb93d64d/venv/bin/python`
— Python **3.14.9**, not system Python 3.9.

Working directory for the following commands:
`E/frozen/clean-export`.

Every test child environment was built by removing **all `GIT_*`**, `PYTHONPATH`, and `NODE_PATH`; `/usr/local/bin` was prepended to PATH. Set `PYTHONDONTWRITEBYTECODE=1` and TMPDIR to a newly created private Hermes-scratch temporary directory. No live Git metadata was supplied to a test. Existing fixture tests can mutate only their disposable repositories.

```text
python -m unittest discover -s .codex/scripts -p 'test_*.py' -v
  exit 0; Ran 101 tests in 15.806s; OK; no skips/failures/errors

python .codex/scripts/test_client_design_pilot.py ClientPilotTests -v
  exit 0; Ran 9 tests in 0.586s; OK

python .codex/scripts/test_client_design_pilot.py ArchiveIsolationTests -v
  exit 0; Ran 1 test in 1.571s; OK

/usr/local/bin/node --check docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/browser-check.mjs
  exit 0; Node v24.21.0
```

Count clarification: the pilot file has **10 tests total: nine ClientPilotTests plus one ArchiveIsolationTests**. The 101-test discovery includes all ten; it is not 101 plus another ten unique tests. Separate runs explicitly exercised the negative cases and isolation case rather than relying on an inferred total.

The actual negative scenarios passed: changed/missing/extra source files, source symlink, changed media before render, source-lock hash tampering, traversal after deliberately re-pinning the disposable lock, unlisted source path, unknown variant, altered source prose/dimensions, injected remote script, CSS remote media/font/palette/identity drift, repository/existing output and symlink output refusal. Tests copy and mutate only disposable source trees.

The isolation test constructed a Git-less archive and **its own disposable metadata canary**, executed generation and all nine client tests both clean and with `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` pointing only to that canary, then compared every canary file byte-for-byte. Both branches passed and the canary stayed unchanged. The recipe itself contains no Git or subprocess invocation.

No required positive check failed or was rerun repeatedly to obtain green. An initial interpreter-location probe referenced a nonexistent conventional Hermes venv path; interpreter discovery corrected the command before tests were executed. No installation was performed.

## Regeneration and browser evidence inspection

Executed the exact clean-export `recipe.py` into a **new** private scratch output directory, with the same stripped environment. Exit **0**. Independently recomputed the generated files' hashes; each is identical to `E/preview-v3/` and the frozen-exact preview:

| Artifact | Regenerated SHA-256 |
|---|---|
| `baseline.html` | `528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca` |
| `A.html` | `fbb076faa9d1c4bf52b9b11bf957e94c90414ac2f83b0fc25df4f072aa5bcf6c` |
| `B.html` | `bbbcecabc2c1bc41cca43ed52bac001382f4a0df23a6bc17d3699811b1f25633` |

Recomputed all **208** entries in `E/frozen/evidence-manifest.json`: no hash/length mismatch. That evidence manifest's own SHA-256 is `e2e25ff5b36f125a22022f6e0fdd1e16a0f55319fa57036737e2b496f3818f57`.

Inspected the actual raw browser receipt, not just its successful summary:
`E/preview-v3/browser-receipt.json`, SHA-256
`d0ad4d4dd62ef01540f0f80d620c5e03eb0aeb1d2dfcf370857f21f94a33e6aa`.

It contains exactly **15 states**, baseline/A/B × desktop 1440, mobile 390, tablet 768, long-Russian stress 390 and reduced-motion 390, height 900. All ten proposal records have zero document overflow, measured text clipping, image/body intersections, small-target findings, HTTP(S) attempts and page errors; eight cards and successfully decoded images each; tabular numerals and revealed content. Actual keypath records show a solid outline on the material link, material-anchor activation and price-anchor positions approximately 24px below viewport top. Font records show 66 custom-rendered Russian glyphs for Manrope 700 and Golos Text 400/500, with no fallback in those probes.

Baseline findings remain visible: two desktop heading-overflow records (`ОСП`, `Фанера`) and original 44px contact heights below the unchanged 48px contact threshold. Proposal guards do not erase these historical baseline findings. Image/body overlap is proposal-only because baseline does not have the normalized wrapper; mobile intentionally has a different thumbnail composition.

Inspected `E/frozen/overlap-v3.json`, SHA-256
`112f1af469d55a460433ab02660170b93dac2be21e31678f73c5d4517524ac56`, and its actual checker. It covers **nine widths**: 390, 700, 701, 768, 860, 899, 900, 1024, 1440; eight B cards per width; zero detected wide-layout image/body overlap. Measured image ratios are 4:3 within browser subpixel rounding, not mathematically exact at every width. The repair at `layouts.css:66` constrains the grid image with `min-width:0;width:100%;align-self:start`.

Browser evidence was inspected and hash-bound to independently regenerated HTML; a new browser run was **not required or claimed** in this review. No visible browser was opened. Pixel-level visual/brand acceptance is assigned separately; this reviewer does not substitute receipt inspection for that gate.

## Separate bounded role verdicts — same reviewer

- **code-reviewer — PASS.** Frozen-source validation precedes generation; pinned lock, exact baseline and inventory comparison prevent accidental source/media drift. Output refusal is exercised. Article-wrapper normalization preserves prose/cards/contact/media identity. No blocking Python/CSS/recipe logic issue found for the exact payload.
- **typescript-reviewer, applied to JavaScript browser harness — PASS.** Reviewed full `.mjs`; syntax check passes. Sequential page operations preserve stateful keyboard/CDP/screenshot sequencing and bound browser resource use. Top-level failures are not converted into success; browser closes in `finally`; proposal findings set a failing exit code. No production TypeScript application change is being approved.
- **qa-engineer — PASS.** Independently executed 101-test discovery, explicit nine client tests and disposable-canary test. Regenerated exact hashes and inspected all 15 browser records/nine-width receipt. No new confirmed regression in the admitted scope.
- **security-secrets-scanner — PASS.** Full seven-file inspection plus signature/literal scan for AWS/GitHub/Stripe-style keys, JWTs, private keys and password/key/token assignments returned no matches. Source contact details are public supplier content, not credentials. No full-repo/history credential audit or provider/rotation action was attempted.
- **silent-failure-hunter — PASS.** Source/hash/inventory failures raise exceptions; tests assert failing cases; subprocess results are checked; generation does not silently substitute synthetic assets; browser failures propagate or set nonzero exit status. No swallowed blocking error identified in the frozen candidate.

### Bounded limitations, not expanded guarantees

The CSS validator is a small denylist for the reviewed stylesheet, not a sanitizer for arbitrary hostile CSS. Browser harness inputs/dependency/browser paths are trusted local operator inputs: its lexical scratch-prefix check is not a general symlink-safe filesystem sandbox. Use only the new real directory produced by the guarded recipe, not arbitrary directories or symlink aliases. The tested symlink/existing-output refusal applies to `recipe.generate`.

The harness records some evidence (font coverage, outline style, heading hierarchy, price position) without asserting every field in its final failure predicate; this review inspected the actual values rather than claiming those fields are all independently enforced. There is no broad accessibility certification, full font cmap/license audit, mobile image/body collision guarantee at arbitrary widths or temporal motion revalidation here. Font rendering evidence does not establish redistribution or AI-input rights. These limits do not block admission of the exact private-preview text recipes, but forbid promoting this PASS into a broader acceptance claim.

## Main Git/source guards and retained boundaries

Before tests, clean-environment read-only Git confirmed HEAD/base and an empty cached raw diff; direct config/index/HEAD hashes were recorded. After execution, the same values and empty cached diff were reproduced:

| Protected guard | Before = after |
|---|---|
| HEAD / current branch ref | `d89bcbcf0a88b9a000008328d67d80ec6c83b5a5` |
| `.git/HEAD` SHA-256 | `6839bf95e54efcdebf895966f95dd54ee188427e94dd4fec021cc63611cf0696` |
| `.git/config` SHA-256 | `528dd8f32b23aa5182e68303045fd999c82b92fe79e9031ecedf5a1f20092a6c` |
| `.git/index` SHA-256 | `51d7010edbfcd1b25f72ca91552b94f6b54eaf6e5f65e046721f7ae0d56ea04d` |

Current branch remains `refs/heads/claude/greeting-nnz368`. Post-run staged-entry serialization (`git ls-files --stage -z`) SHA-256 is `de3f882b6b61f4b6d04c3a85d08f662b31c50ade6d9730738907691f7a7a3975`, matching the frozen pre/post receipt; this serialization was not separately captured by this reviewer before tests. All 25 live production source hashes and all seven owned live hashes still match their locks. Every live read-only Git subprocess removed inherited `GIT_*`/`PYTHONPATH`/`NODE_PATH` and explicitly set `GIT_OPTIONAL_LOCKS=0`.

Foreign remote-tracking refs, unrelated working paths and caches are not immutable guards for this task; legitimate concurrent `ci/serum-actual-one`/funding work is neither blocked nor reverted. No live Git write, source fix, push, install, provider request, deployment or media publication was performed. Prior incident/failed receipts remain untouched. Owner acceptance and independent visual/brand review remain separate gates. Any change to an admitted payload invalidates this exact-byte PASS and requires affected checks/review again.
