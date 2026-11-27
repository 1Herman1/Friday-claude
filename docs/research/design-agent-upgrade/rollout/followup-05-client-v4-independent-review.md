# R3 v4 — fresh independent bounded closure

## Verdict

**PASS — exact seven-file v4 private-preview admission and closure of the sole prior new visual finding.** A/B desktop heroes now actually render at 16:9; no new visible layout regression was found in the inspected updated desktop and mobile/tablet card captures. No source fix requested. This is not full MASTER/media compliance, production approval or owner acceptance.

Reviewer: **one actual independent Hermes subagent in this delegated v4 review session**, distinct from the implementer. The six roles below are bounded perspectives performed by this same reviewer, not six people, native role activations or six independent approvals. Actual `.codex/CODEX.md`, review-loop, code-reviewer, typescript-reviewer, qa-engineer, security-secrets-scanner, silent-failure-hunter and design-reviewer contracts were read, together with Stroymat project/brand/MASTER and relevant review/design/security policies. No task-gate, context or other repository file was written; the coordinator owns gate registration.

Читаю это как B2B-витрину обновления ассортимента для снабженца/прораба: сдержанный характер, V/M/D=5/3/3, поиск спецификации и запрос прайса. **Recommendation remains B**: compact product rows expose dimensions/status sooner, particularly on mobile. A remains a valid editorial alternative. This is expert judgment, not conversion or user-test evidence. Owner selection/acceptance remains **PENDING**.

## Exact revision and aliases

Private evidence root `E=/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-repair-v1`.
Base: `d89bcbcf0a88b9a000008328d67d80ec6c83b5a5`.

Independently recomputed SHA-256:

| Receipt | SHA-256 |
|---|---|
| `frozen-v4/owned-manifest.json` | `168c7322086daea3197ba61fb683f16dcd829ecadc411b17542c88c9ec33a48a` |
| `frozen-v4/verification.json` | `8ece3e8e9e33fb8a7c5e4b2766819c2020421659d92d84ba141ae7de453501bd` |
| `frozen-v4/evidence-manifest.json` | `956be2074b93b7624468c283d911e61d1fc13c63c7fab068816801449603ed39` |

All seven manifest entries match live owned files, `frozen-v4/owned/` and `frozen-v4/clean-export/` byte-for-byte. The clean export has no `.git`; all **4,558 non-owned regular archive files** match `frozen-v4/actual-head.tar`. This is archive readback, not a new Git export or Git write. The full 25-file production source lock also matches live source and clean export.

Paths below are relative to `docs/research/design-agent-upgrade/rollout/`, except the test:

| Owned file | SHA-256 |
|---|---|
| `.codex/scripts/test_client_design_pilot.py` | `4433bdf667ef7b8d55c8d58a266bc4a99c0dd175d5e1cb23c2cc79233d165738` |
| `followup-05-client-pilot.md` | `9e3c9b52bcc5290f0f7adaa42ef857499bb4c6df57f6f15c2115411b371a2327` |
| `client-pilot-stroymat/README.md` | `06bf4b4d9b425b7dbbbc9fdaa3ccb753992286937c30bfbec44a1c863e6acebd` |
| `client-pilot-stroymat/browser-check.mjs` | `4f9c21c6d2b5145e0b188c0729bb687c4e1a047043d01a880e67a8798b06822d` |
| `client-pilot-stroymat/layouts.css` | `ec2484fd2c25ff5d70b62393d6026a1c06b13814f827566cb195c4288df238cb` |
| `client-pilot-stroymat/recipe.py` | `22ecaedc644199ee9ad38c7569aaf8cd48fb89162422db5e9481caaacf4dcaa1` |
| `client-pilot-stroymat/source-lock.json` | `27d0d7f60c3b1f8b0df9943f669ceac20ab11025ad787f54109d731a13360584` |

Direct v3/v4 diff confirms exactly four changed files: the stylesheet, browser harness and two documents. CSS changes are only `aspect-ratio:4/3` → `16/9` at A desktop hero and B hero overrides (`layouts.css:43,55`). Card 4:3, prior heading padding and B grid-image containment remain unchanged. Harness adds actual `.hero-media` box/ratio, finite ratio/tolerance check and `!r.heroRatio16_9` to the proposal failure predicate. Missing/zero-height/nonfinite/non-16:9 frames fail closed; baseline remains observation-only. No prior failure predicate was weakened. Docs correctly retain old PASS/FAIL as historical and v4/owner review as pending at freeze time.

Recipe, pilot tests and source-lock are exact byte aliases of the already reviewed v3 files; their old review is carried only for identical bytes/dependency context, not used as approval of the changed CSS/harness. Both prior independent reports remain historical and unchanged.

## Independent execution and evidence readback

Executed with the current Hermes Python 3.14 interpreter (`sys.executable`), cwd `E/frozen-v4/clean-export`, removing every inherited `GIT_*`, `PYTHONPATH`, `NODE_PATH`; PATH explicitly `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`, TMPDIR private Hermes scratch. No live `.git` was supplied to tests.

```text
<sys.executable> -m unittest discover -s .codex/scripts -p test_*.py -v
Ran 101 tests in 14.803s
OK
exit 0
```

All ten pilot tests, including disposable Git-less/poisoned-canary isolation, actually ran and passed; no skips/errors/failures. Direct protected-byte guards for live `.git/HEAD`, config, index and production files remained identical before/after. No live Git subprocess was needed.

Also executed `/usr/local/bin/node --check <frozen-v4/owned/.../browser-check.mjs>`: exit 0. Executed `node .codex/scripts/design-lint.mjs <frozen-v4/owned/.../layouts.css>` from clean export: exit 0, «Проблем не обнаружено.»

A fresh real headless Chromium probe was run through `/usr/local/bin/node -` using existing `motion-stage04` Playwright-core and existing `chromium_headless_shell-1255`. It opened exact final local A/B HTML, blocked/recorded HTTP requests, awaited fonts and image decode, and read `getBoundingClientRect()` plus computed aspect-ratio. It throws for absent/nonpositive/nonfinite hero, ratio error ≥ .002, overflow, card count != 8, remote request or page error. **Exit 0; six pages**, no screenshot regeneration:

| Variant | Viewport | Actual hero | Computed aspect-ratio |
|---|---:|---|---|
| A | 1440 | 600 × 337.5 | 16 / 9 |
| B | 1440 | 240 × 135 | 16 / 9 |
| A and B | 768 | 720 × 405 | 16 / 9 |
| A and B | 390 | 358 × 201.375 | 16 / 9 |

Every page: eight cards, no horizontal overflow, HTTP request or page error. This independently closes the prior actual desktop 4:3 finding; source bitmap identity is not confused with frame ratio.

All **164 evidence-manifest entries** were rehashed successfully. All **45 screenshots** listed in verification match both `preview-v4/` and `preview-v4-frozen-exact/`; exact final HTML hashes match verification:

- A: `bf647571058a35fd2e871ef440f0e659a56a794057c8f08d378f91d55437ca88`
- B: `f238fad45b1d478abaede8120d3910eff4f842ea1166f569f05350dc63319245`
- Baseline: `528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca`

Read and programmatically re-evaluated all 15 final browser records against the full failure predicate: **zero proposal failures**. Receipt SHA-256 `77879740006f34c8cdc6610ff2d3644d2525c9aeca8ec078065163456974d7f1`.

Read all 18 nine-width pages and 144 card boxes in `hero-overlap-v4.json`: widths 390/700/701/768/860/899/900/1024/1440, both proposals; all heroes 16:9 and card images 4:3 within .002, no recorded wide image/body intersection, overflow, remote request or page error. SHA-256 `e9ae48d30afbbb1d980edc623d60c6b4490f4623347ad28bcceb59d0de26a8b8`.

Preserved RED `red-v4-current-v3/browser-receipt.json` has 15 states and exactly two proposal failures under the same predicate: A desktop 600×450, B desktop 240×180; every other proposal condition passes. RED receipt SHA-256 `16e73612eae499785ba53e2b5cc961aad858e4528e464ab219b85953247b9c4a`. Read retained `red-v4.log`, not overwritten or rerun. Every entry in `v4-history-hashes.json` still matches. Existing baseline 44px contacts and two desktop clipping records remain present; baseline hero is not forced through the new proposal-only ratio gate.

## Actual vision closure

Explicitly opened these six actual `preview-v4-frozen-exact/` PNGs through vision; their bytes match the manifest:

| Screenshot | SHA-256 |
|---|---|
| `A-desktop-top.png` | `55128ce34ae202658cc9f8c1c74c6d6a4ffdf022406014796422eec33daf0e98` |
| `B-desktop-top.png` | `eafecebf94fd4767221db96dc47dfa2d2ce76fd8157d1ce0d9536f396ce75732` |
| `A-mobile-firstcards.png` | `05f490e8d1c7a7cb0a5fa6ddd17d04dbd3994916707513fe1ba1eaa766b8111e` |
| `B-mobile-firstcards.png` | `305c1a1bcb0c5deb9802005f1ea2a52c6e2cb273d29f53b0f841031170c6ef69` |
| `A-tablet-firstcards.png` | `9230f35f3f73183d04919402d28f8009f4ffe84748680bbeeefae786621eab64` |
| `B-tablet-firstcards.png` | `67aab7d4a7c2d725aa76c61048d62155938285832e291229d698bb71049de19f` |

A desktop: wide product frame separated from headline, lead and buttons; no collision/clipping. B desktop: compact image stays separate from copy/actions, with catalogue heading nearer first viewport. Mobile A: large image and prominent dimensions; B: thumbnail beside heading and more compact scan path. Existing sticky contact dock remains. Tablet A: two clear image/spec columns; tablet B: thumbnail remains left of body without covering heading, dimensions or statuses. Viewport/scroll crop at screenshot edges is not content clipping. No newly visible layout regression in these reviewed frames. Other full/long-RU/reduced captures were hash-verified and their records inspected, not claimed as newly vision-reviewed in this session.

## Six bounded role verdicts — same actual identity

| Perspective | Verdict | Basis |
|---|---|---|
| code-reviewer | PASS | Exact delta limited to two ratios, actual-browser guard and truthful docs; unchanged recipe/test/source-lock byte aliases; independent 101-test execution and source/manifest checks. No confirmed new logic issue. |
| typescript-reviewer (JavaScript harness) | PASS | Full harness and delta reviewed; syntax exit 0; actual DOM evidence, finite check and existing failure propagation retained. No production TypeScript change approved. |
| qa-engineer | PASS | Actual 101 tests including canary; six fresh browser readbacks; all 15-state/18-page records checked; actual preserved RED fails only intended desktop ratios. |
| security-secrets-scanner | PASS | Seven-file key/JWT/private-key/password-token literal scan returned zero matches; changed lines introduce no credentials, dependency or provider access. Bounded payload review, not history/full-repo security certification. |
| silent-failure-hunter | PASS | Missing/bad ratio is false and fails final proposal predicate; exceptions remain fatal and browser closes in finally. No swallowed new error or weakened existing guard. |
| design-reviewer | PASS | Sole prior new finding closed by actual six-page DOM readback and updated desktop vision; mobile/tablet first cards retain clean separation and specification hierarchy. Recommendation B retained. |

## Retained limits and authority

Inherited multi-material hero still conflicts with MASTER's single-material preference; it is a preserved existing asset, not a newly introduced regression or request to generate replacement media. Image/font rights remain unverified: private preview only, not redistribution/AI-input/production approval. Existing baseline defects remain disclosed rather than relabelled GREEN. Harness path inputs/dependencies remain trusted local operator inputs, not a general symlink-safe sandbox; recorded font/focus fields are not all individually enforced by the final predicate. No full accessibility, contrast, cross-browser, real-device, motion-temporal or licensing certification is claimed.

No new design requirements, broader refactor, source fix, live Git write, install, provider call, media generation, publication or deploy. Foreign concurrent refs/runtime/funding work was not inspected as an acceptance blocker or reverted. No issue blocked this bounded review; an initial roles-directory lookup returned absent and actual `.codex/agents/` contracts were then read. Only this report was created. Any changed admitted payload invalidates this exact-byte verdict and requires affected verification again.
