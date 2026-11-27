# R3 Stroymat pilot — repaired private candidate; independent review pending

## Revision v4 — single independent visual finding repaired; fresh review pending

The actual independent visual report `followup-05-client-visual-review.md` returned REQUEST_CHANGES for A/B proposal desktop heroes at 4:3, contrary to MASTER hero 16:9. The earlier `followup-05-client-code-review.md` PASS covers old candidate bytes only. Both reports and all v3 PASS/FAIL evidence remain untouched; neither is reinterpreted as acceptance of v4.

TDD actual DOM RED: new harness assertion first ran on exact current-v3 HTML in new `red-v4-current-v3/`. All 15 states executed; process exited 1 for exactly A desktop 600×450 and B desktop 240×180 (both 1.3333333). The harness records actual hero box and ratio and fails closed for any proposal hero not finite/positive/16:9 within .002. Baseline remains observation-only, preserving legacy findings. Then only the A and B owned hero aspect-ratio declarations changed to 16/9. Cards stay 4/3; previous 4px heading padding and B grid-image sizing/alignment repair are unchanged.

New `preview-v4/`: freshly generated baseline/A/B HTML, **15 actual browser states / 45 screenshots, zero proposal failures**. Desktop hero boxes now A 600×337.5 and B 240×135. Existing eight-card, image decode, fonts/Russian glyph coverage, original prose/specifications/contact hrefs, keyboard focus/anchors, 48px contact/44px other targets, reduced-motion, text-overflow, no-HTTP/page-error and image/body-intersection checks are preserved. Baseline's existing two desktop text findings and 44px contact findings remain recorded, not new failures. `hero-overlap-v4.json`: **18 actual pages** (A/B × nine widths 390/700/701/768/860/899/900/1024/1440), all heroes 16:9 and all **144** card images 4:3; no wide card image/body intersection, horizontal overflow, remote request or page error. Actual current desktop/mobile screenshots inspected by implementer: no visible desktop media/text collision; mobile text/actions remain before media and retain existing sticky contact dock. Not independent visual approval.

Final exact seven-file candidate is frozen separately in `frozen-v4/owned/`, with `owned-manifest.json`; `clean-export/` contains full actual HEAD plus only those seven files and no .git. Final safe Git-less Python suite after final source/document bytes: **101 passed, zero failures/errors/skips**, including the unchanged ten pilot tests and disposable canary proof. `frozen-v4/verification.json` and `evidence-manifest.json` bind candidate hashes, actual receipts, source-lock 25-file identity, exact generated HTML, and unchanged protected main/Git metadata/source guards. Recipe, source-lock and pilot test bytes remain identical to v3. Only layouts.css, browser-check.mjs, README.md and this report changed. No production source edit, Git metadata write, motion rerun, install, new media/provider, public output or deployment. Fresh independent v4 review: **PENDING**; owner acceptance: **PENDING**. Font/media rights remain unverified; private preview only.

## Previous v3 repair verification (historical; not v4 acceptance)

Private repair evidence: `/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-repair-v1/`.
Actual export base: `d89bcbcf0a88b9a000008328d67d80ec6c83b5a5`. Coordinator-owned Git recovery and its independent PASS are documented separately in `followup-05-git-recovery-review.md`; this worker performed no recovery writes. The earlier `live-before.json` → `live-mid.json` difference is only `refs/remotes/origin/ci/serum-actual-one`; it is explained concurrent media work, not renewed main corruption. Original guard records and RED/GREEN logs remain intact.

The repaired recipe performs no Git/subprocess invocation: a hash-pinned `source-lock.json` validates all 25 actual original Stroymat files (paths, sizes, modes, hashes; extra/missing/changed/symlink/traversal fail closed). Compiled baseline remains SHA-256 `528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca`. Ten pilot tests include real Git-less archive generation and a poisoned **disposable** metadata canary; no live Git variables enter tests.

Safe actual-HEAD archive plus only owned allowlist: `clean-export/`, without `.git`, excluding foreign dirty files. Initial safe full Python discovery: **101 passed**, zero failures/errors/skips (`python-full.log`, `python-run.json`); count parsed from execution, not inferred. Final frozen rerun receipts and manifest are in `frozen/` (see README). Existing 76 Node checks and motion evidence remain historical R2 results, not newly executed R3 claims.

### Browser and actual visual review

`preview-v1/` completed the existing 4px heading-padding repair: 15 states, no A/B ink-overhang failures. Actual screenshot inspection then exposed a separate B tablet image-over-text defect missed by the original detector. `red-tablet-overlap.json` reproduces overlaps at 701/768/860/899/900/1024px; 1440px and mobile were unaffected. Minimal owned CSS repair constrains B image grid items with `min-width:0;width:100%;align-self:start`; the last property prevents grid stretch from defeating the intended 4:3 ratio. Browser harness now checks actual image/body intersection for wide A/B cards. One intermediate harness attempt failed because unnormalized baseline cards lack `.item-body`; `browser-v2-baseline-harness-failed.log` is preserved. The intersection check is explicitly proposal-only, not a change to baseline.

Final `preview-v3/`: regenerated baseline/A/B from locked originals; actual browser receipt covers all **15** states (1440 desktop, 390 mobile, 768 tablet, 390 long-RU, 390 reduced motion; height 900). No proposal failures: no horizontal overflow, measured text overflow or image/body intersections; eight cards each, decoded images, tabular figures, original contact hrefs, visible keyboard outline and both internal anchor keypaths. HTTP(S) request attempts and page errors are empty. Contact thresholds remain 48px; baseline's original 44px findings and two desktop text-overflow findings remain documented, not repaired or misrepresented as proposal regressions. Russian font probes retain 66 custom-rendered glyphs for Manrope 700 and Golos Text 400/500 with no system fallback; this is not licensing or exhaustive cmap proof.

Actual screenshot self-inspection covered top, first cards and full-page segments across all 15 states. A is an editorial large-image gallery, B a sequential specification catalogue; original facts, all eight materials, unknown-size wording, contact paths, image/font bytes and MASTER palette remain. Images and text are separate at final tablet width; long Russian headings/values wrap without visible truncation. Contact sheets are private scratch review aids, not new production media. Final screenshot hash crosswalk records unchanged states rather than silently substituting old images. Self-review is not independent design/brand/accessibility approval; native IDE integration, client acceptance, licensing, public media and deployment are not claimed.

Historical incident and failed receipts below are retained verbatim as evidence, not descriptions of the recovered current Git state.


Owner acceptance: **PENDING**. Independent review: **PENDING**. No deployment or public client implementation.

## Critical incident (implementer-owned)

During the clean-HEAD regression run, the implementer exported `GIT_DIR=/Users/germanbryzgalov/Friday-claude/.git` and `GIT_WORK_TREE=/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-checkout` to let source-reading tests see Git. Git-fixture tests inherited these variables and wrote the live repository metadata. This violated the explicit no-Git-writes constraint. Execution stopped; no reset/recovery attempted without coordinator review.

Observed original HEAD: `77d9e09390835250b39a684d245a32f2338fff32`.
Observed changed HEAD: `5e3ae869464cd78072b41a7177f2ebe77d611e5a`.
Branch: `refs/heads/claude/greeting-nnz368`.
Reflog shows ten fixture `commit: baseline` entries after original HEAD. Live local `core.worktree` now points to scratch; local user.name/email became Fixture / fixture@example.invalid. Index was also rewritten. No push command was run. Do not run reset --hard: original foreign dirty working files must be preserved. Coordinator must inspect/recover metadata separately.

Read-only verification after the incident: all tracked `projects/stroymat/` file bytes still match the frozen source hashes (zero differences). This does **not** mean repository metadata is intact.

## Partial artifacts and evidence

Private root: `/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-final/`.
`baseline.html` is the exact original compiled file from frozen Git, SHA-256 `528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca`; `A.html` / `B.html` are genuine private composition proposals, not baseline substitutes. `source-receipt.json` freezes all source hashes and HTML hashes. Each variant has `desktop`, `mobile`, `tablet`, `long-ru`, `reduced` screenshots, each with `-top.png`, `-firstcards.png`, `-full.png`; viewport widths 1440 / 390 / 768 / 390 / 390, height 900.

Browser receipt: `browser-receipt.json` in that private root. Fifteen real headless states captured with HTTP(S) blocked. Current captured B long-RU has four text ink-overhang detector failures (2px height); subsequent source CSS adds 4px internal heading padding, but was **not** regenerated/retested before the incident. Do not call current source/browser revision verified. A/B contacts met unchanged 48px thresholds; baseline has original 44px phone/footer contact findings. Source has eight actual cards; unavailable sizes were not invented. Browser CDP proves custom font rendering, including all 66 Russian upper/lowercase letters for Manrope 700 and Golos Text 400/500 (glyphCount 66, no system fallback). Binary cmap/license metadata inspection not completed; rights remain unverified for redistribution/AI-input.

Worker viewed actual screenshots with vision: A desktop top, A mobile top (before/after mobile reorder), B desktop first cards, B long-RU first cards (before/after width repair). This is self-review only, not independent or owner review.

Logs: `/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3/`:
- `red-guards.log`: real failing new prose/CSS guards.
- `pilot-clean.log`: five pilot tests passed after implementation.
- `python-clean.log`: 96 attempted, **FAILED** (4 failures, 29 errors), contaminated by Git environment.
- `node-clean.log`: 76 passed, zero skips.
- `integration-clean.log`: strict TS, real SSR and normal/reduced/dynamic/interrupt/repeat/destroy headless motion pilot passed.
- `clean-check-receipt.json`: commands, interpreter, owned deltas, results.
- `incident-source-check.json`: post-incident source-byte check.

Initial TDD: three tests failed because recipe absent; then three passed. Added prose/CSS tests then failed as expected; five passed after guards. No CI/publication success is claimed. Remaining work includes metadata recovery, safe isolated regression rerun with **no inherited live GIT_DIR/GIT_WORK_TREE**, final regeneration, full visual packet inspection, brief/manifest completion and fresh independent review.
