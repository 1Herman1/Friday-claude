# Private Stroymat R3 implementation recipes — repaired review candidate

Read `../followup-05-client-pilot.md` first: it preserves the original isolation incident and failed receipts alongside current safe repair evidence. Independent review and owner acceptance remain PENDING; this is not production implementation.

## Surface brief before tokens

Page: existing `obnovlenie-assortimenta.html`; B2B buyer on a building site, mobile-first, sunlight/gloves. Task: identify dimension/thickness, distinguish actual stated availability, request a price list via original mail/phone links. Primary Explore, secondary Operate. Friday mode: Operate for catalog/price request, Read for logistics/requisites; restrained Persuade framing only in existing introduction. No backend, forms, inventory fetching or checkout. Unknown sizes/availability stay unknown, not inferred from logistics prose. Dates and existing source statistics remain historical source claims, not newly validated commercial facts.

Identity lock: target Stroymat brand + MASTER only, dials 5/3/3. Original Manrope headings and Golos Text body; exact source font/image bytes; original title/copy, eight articles and all actual specifications/contact hrefs. MASTER variable palette unchanged. Radius <=16, 96px mobile /160px desktop sections, tabular figures, visible keyboard focus and 44/48px targets. No paid generation, new media, remote assets, imports or deployment.

## Two compositions

A: editorial gallery — split dark introduction; featured first/last material with large imagery; two-column middle gallery. Mobile text/actions precede image; stacked gallery.

B: specification-led catalog — restrained masthead, small contextual image; sequential material rows, image/name/specification columns on desktop, thumbnail + full-width specifications on mobile. Not a color swap. Baseline remains immutable.

`recipe.py` reads original compiled HTML from the exported source tree without Git or subprocesses, verifies `source-lock.json` against its pinned hash and all 25 source paths/modes/sizes/hashes, requires exact baseline SHA, adds scoped CSS and two internal anchor links using original labels, normalizes article body wrappers, and preserves original content/media inventory. It refuses output in repository or outside new private Hermes scratch. It never runs build.py, which writes adjacent output and artifact files. `layouts.css` is a page-only proposal, not a new token source. `browser-check.mjs` requires existing explicit MOTION_DEPS / MOTION_BROWSER and always launches headless. It blocks remote requests, records actual layout/font/keypath evidence and never activates tel/mail links. CSS guard is a bounded denylist, not a general CSS parser/security sanitizer.

## Actual Taste lookup

Read `docs/core/design-library/INDEX.md`; `--help` returned USAGE with actual CLI syntax; then full records obtained using:

```
node .codex/scripts/design-library.mjs get heroes split
node .codex/scripts/design-library.mjs get typography manrope
```

Stable `heroes/split`: adopt text/object separation and mobile text-before-picture. Reject its fixed 900/844px viewport recipe, 72/40 scale, floating fact card, looping dot and technology grounds/effects. MASTER and buyer task control geometry; no invented floating fact.

Stable `typography/manrope`: adopt precise/open-number intent and existing Manrope heading identity. Reject all-Manrope text, proposed weights/tracking/scale substitutions and JetBrains Mono companion. Keep MASTER Golos Text body and source local font files. Catalog record is not font binary licensing/Cyrillic proof.

## Evidence boundaries

Private paths and actual test results are in followup. The 4px heading ink-overhang repair and subsequently reproduced B grid-image overlap/stretch repair have regenerated 15-state evidence in `preview-v3/` under private repair scratch. Historical failed screenshots/logs remain in place. Existing baseline hero contains several material layers despite current MASTER single-material preference; preserved source asset, not newly generated media or silently certified compliance. No license files were found in the tracked font listing; browser proves rendered Russian glyph coverage but not licensing or a full binary cmap audit. Independent review and owner acceptance remain PENDING.

## Revision v4 — independent visual finding R3 hero ratio

This new revision supersedes only the current-candidate status above, not historical evidence. The independent visual report `../followup-05-client-visual-review.md` requested changes for proposal A/B desktop heroes at 4:3 despite MASTER requiring 16:9. Previous code PASS applies to the previous bytes; fresh independent review of v4 is PENDING, as is owner acceptance.

Before changing CSS, the updated actual-browser harness ran all 15 states against exact `preview-v3` HTML copied into `red-v4-current-v3/`, preserving every v3 receipt. It failed for exactly A/B desktop heroes: 600×450 and 240×180. Harness now records actual hero box/ratio and fails closed for a missing, zero-height, non-finite or non-16:9 proposal hero; baseline remains observation-only. Only the two owned hero overrides changed from 4:3 to 16:9. Card rule remains 4:3; 4px heading padding and B `.shot{min-width:0;width:100%;align-self:start}` remain unchanged.

New `preview-v4/` contains freshly generated baseline/A/B and 45 actual screenshots across 15 states. Browser proposal checks pass with unchanged target/intersection/text thresholds. Additional `hero-overlap-v4.json` checks both proposals at 390/700/701/768/860/899/900/1024/1440px: 18 pages, 16:9 actual heroes, all 144 card image boxes at 4:3, no wide image/body intersection or horizontal overflow. Implementer inspected actual v4 desktop/mobile screenshots; desktop media is separate from text, mobile retains text/actions before media and the existing sticky contact dock. This is not independent visual acceptance. Existing baseline findings and source-media/licensing limitations remain.

Current exact handoff is `frozen-v4/owned-manifest.json`, `frozen-v4/owned/`, `frozen-v4/clean-export/`, `frozen-v4/verification.json` and `frozen-v4/evidence-manifest.json` under the same private root. It contains exactly seven owned candidate files; only layouts.css, browser-check.mjs, this README and the followup report changed since v3. Final full safe Git-less regression is 101 Python tests passed, including the unchanged ten pilot tests. Frozen verification binds final hashes, exact generation/browser receipts and protected source/Git guards. `frozen/`, all v3 evidence, and prior independent review reports remain historical and untouched. No motion rerun, install, new media, production edit, Git metadata write, publication or deployment.

## Exact independent-review handoff (historical v3)

Private root: `/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-repair-v1/`.
`frozen/owned-manifest.json` enumerates every approved payload path with SHA-256, size and mode. `frozen/owned/` contains those exact bytes; `frozen/clean-export/` is full actual HEAD archive plus only that owned payload, never foreign working-tree edits. `frozen/verification.json` binds regression results, source/media identity, regenerated HTML, screenshot equality/crosswalk, browser receipts and live guards. `frozen/evidence-manifest.json` hashes the private evidence files (not itself). No generated HTML/PNG is added to production or this source payload.

Safe Python reproduction: from the clean export, use Python >=3.11 and run `-m unittest discover -s .codex/scripts -p 'test_*.py' -v` in a child environment with every `GIT_*`, `PYTHONPATH` and `NODE_PATH` removed; set TMPDIR to a new private Hermes scratch directory. Do not point any suite to live Git metadata. Original fixture tests create their own disposable repositories. The ten pilot tests also work without `.git` and poison only their own disposable canary. Browser reproduction: generate a **new** private scratch directory with `recipe.py OUTPUT`, then execute `browser-check.mjs OUTPUT` with existing MOTION_DEPS and MOTION_BROWSER paths. It is always headless; no install/provider/network/deploy permission is implied.
