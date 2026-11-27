# F04 queued input — independent critical review

## Verdict and identity

**PASS for local reviewed source only. Linux/GitHub Actions: PENDING.**

Reviewer identity: `Hermes queued-independent-review` — this one fresh reviewer subagent, independent of the implementer. The same identity executed all six bounded role reviews below; these are **not six independent agents**. No delegation or source fixes.

| Actual role | Verdict | Basis |
|---|---|---|
| review/code-reviewer | PASS (local) | Full changed executable sources, observer, fixture, dependency closure and frozen scope checked; no confirmed new logic/security finding. |
| review/typescript-reviewer (JS harness) | PASS (local) | Public call initiation order, awaited Promise.all, real strict TypeScript/SSR and process.execPath child execution verified. |
| ops/devops | PASS (local); Actions PENDING | Read-only workflow/pins/install order unchanged from rejected revision; five contract cases, twenty negative subtests, YAML/bash checks pass. |
| security/security-secrets-scanner | PASS (bounded) | Changed payload/added-line signature inspection; no hardcoded credentials, secret-consuming job, provider/deploy action or expanded permissions found. |
| quality/qa-engineer | PASS (local) | Fresh 76 Node/88 Python; required real-browser regressions and exactly two predeclared sequential default runs pass. |
| quality/silent-failure-hunter | PASS (bounded) | Missing target/bounds and actual discontinuity still fail closed; Promise rejection and child failure are asserted, receipt survives runner failure. |

Findings: no confirmed blocking defect in this frozen local revision. No claim that intermittent misses are eliminated. Historical REQUEST_CHANGES remain true for their own revisions; no historical failing attempt has been erased or relabelled GREEN.

Loaded full actual six `.codex/agents/` role documents, review-loop and security §13; read TypeScript rules/anti-patterns and project base context. This task is a repository-wide technical fixture, not a named client application: no applicable client security-profile was selected. Bounded manifest/workflow stack inspection substituted; not a whole-repository/history credential audit. No authentication files read.

## Frozen revision and exact scope

- Base: `c10a97d7e80d805087889efc448ee3e0aafb5234`.
- Tree: `853a6d1a777c019a1b4039ff258235b7567c7afd`.
- Map: `~/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/review-map.json`.
- Map SHA256: `5ecbaaa40cd55996caf7dc8c55cc6e59b22d19807be11b02b94ad5ffaec38d06`.
- Tested cwd: that directory's `export/`, not foreign dirty ROOT.

Verified exact base→tree fifteen-path set, SHA256, working/export aliases, actual Git blob content and tree modes; all fifteen modes are `100644`. proposal.json equals these fifteen files byte-for-byte; publication.diff equals actual binary base→tree diff. Additionally verified all **1749 supplied export files** against actual frozen-tree blob IDs. That is byte provenance/dependency closure, not a claim to have semantically reviewed every export file or the full repository/history.

Production `docs/core/templates/motion.ts` is unchanged between base/tree/export/ROOT, SHA256 `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`. Fixture TS/HTML and pinned dependency manifest/lock likewise match base/tree/export/ROOT. Final twenty-path ROOT source guard (15 mapped + those five) unchanged. No Git writes, push, dispatch, installations, providers, client changes or browser windows.

### Verified map bindings

| Path | SHA256 | Git blob |
|---|---|---|
| `.github/workflows/design-regression.yml` | `1a8e410573d6242dbcbc48d71f1ca406aa2fbe9c7babf822dedd51a09195421f` | `002f96e04c8c93d533edb355b106a04005604a9c` |
| `.codex/scripts/test_design_ci.py` | `1d13b1b5f04a108758fa8d1278439f3b10a63124cecc88c37fbfd2bf2c2247db` | `27f8032c195f1ad0ca6b3fc810d5b33f3af4a963` |
| `docs/research/design-agent-upgrade/rollout/followup-04-design-ci.md` | `22552578802d6f15d309900e661484f3584aa862fbb5e94ae782081379d4550f` | `50d26755e5862041366180dfd30d5306b402b682` |
| `.codex/scripts/test-motion-template.mjs` | `52978437c7658cf4a31dfc95fa222338b9ff53961f1a846c39cd19ed3cd4d038` | `e8e2bf6455f98c6a420477af95151f8f9b7eb2e5` |
| `.codex/scripts/lib/motion-observation.mjs` | `faa801c586e87bc11d95c139a40ec8d439b9e5ddcf870a1fab0e45c4ade6dd09` | `1039fab4898841f468a91c47094de8f4f78bcebd` |
| `.codex/scripts/test-motion-observation.mjs` | `24445c871e48468ad9e3cc875f7117058d5b30301a7f3e765126e960c116fe3f` | `1fb154504029901024abdaa58666f1cb6004b693` |
| `docs/research/design-agent-upgrade/rollout/followup-04-motion-observation.md` | `5ad6ffc0bd1b8a23d314a190525d1e10f5b5d300c4f3b7b7362be86a70ac7369` | `8fb05760308eb2b4c849ee3f6acad435563a95b5` |
| `docs/research/design-agent-upgrade/rollout/FOLLOWUP-PLAN.md` | `d20cb3a2d0754de486888e3e9ff64300e935398aad27cdcd110474ef8958f011` | `666a54f3f594b7fc4258f0850defd5a8b540aab8` |
| `docs/research/design-agent-upgrade/rollout/followup-04-code-devops-review.md` | `7d217e333eca9cf8fff8a9dc479e584199043afee4f94b4f994f5aec4edc641a` | `a29496d87914bd77e4630bc3e747378a4d792d89` |
| `docs/research/design-agent-upgrade/rollout/followup-04-qa-silent-review.md` | `e544a4e57dad47222872fd160c09db1384f998e2b410fd13675a5e9394b7e0e6` | `df527f99e88ec86e7a9625842f15507a5c1e7ad5` |
| `docs/research/design-agent-upgrade/rollout/followup-04-r1-input.md` | `0020594378d1fbe11ffb4716ece336b8786a3a8344e2bb432a2f6caf064de201` | `9c033218d60d3943f3855257eba21f692a3de89a` |
| `docs/research/design-agent-upgrade/rollout/followup-04-r1-parent-fix.md` | `e2be0f8a92b06678489c0a5389a196beedc98322ed7009b41edbe67ab1f93bfa` | `a3e1c141fd2071bbb658a7ee0ad40ee59920f3e5` |
| `docs/research/design-agent-upgrade/rollout/followup-04-r1-code-devops-review.md` | `8e6622b88903c983649da6aa15f8e69befdcc4e154476c56e528b84068cc2c35` | `20e46d2647a803b8264956abdda08bbc251dc396` |
| `docs/research/design-agent-upgrade/rollout/followup-04-r1-qa-review.md` | `0ff2cd27636e377cf7d4d2c36f095efb0bc818e32e6ceafdc298b187772183fe` | `8b41504bff4b4dbce78b94239a05cad81255fe6e` |
| `docs/research/design-agent-upgrade/rollout/followup-04-queued-input.md` | `c2f1be72ea7647898ced031083f2ffd8432560d25b1554906750bc9769c7100e` | `8339d2bb64aec74e2ac2b0e67ceef62d377841f3` |

## Source review and queued regression meaning

Read full test-motion-template.mjs, test-motion-observation.mjs, lib/motion-observation.mjs, Python CI contract, workflow, production template and fixtures. Read current implementation/observation ledgers and bounded historical report verdicts; all earlier reports are map-bound historical evidence, not current approval.

Compared executable files to rejected tree `f28abd3446729c053a23f905b57c04a9215159be`: only runner and observation regression module change. Workflow, CI checker, observer and old ledgers/reports are exact byte aliases where present; FOLLOWUP-PLAN status changed, and two R1 historical reviews plus queued proof are new mapped metadata. The older R1 QA PASS does not override the R1 code/DevOps REQUEST_CHANGES or actual Node24 miss.

Runner lines 99–114 retain snapshot → arm → optional80ms → final bbox ordering. Array expressions in Promise.all evaluate left-to-right: real public move(+23,+31) starts, then real public down starts, without awaiting move completion in between; both promises are awaited. No observation roundtrip between bbox and these calls, retry, widened target, settle/pause workaround, synthetic positive input or engine modification.

Observer remains capture-before and tile-after on the identical trusted event, installed after engine handling. It requires both bounds, tile target, false→true grabbed, paused inertia, and strict absolute delta <1px. All original normal/reduced/dynamic/restored/held/repeat/destroy checks and rAF stability traces remain. Synthetic touchstart is only the existing post-destroy cleanup negative, not positive grab evidence. Unit observations are constructed data; actual browser-positive engine/input/snapshot are not mocked.

New queued test forwards actual page.mouse.move, sets nativeMoveResolved only on **public promise fulfilment** (name does not mean raw CDP ACK), then holds caller completion180ms. recordQueuedDown asserts neither flag is set before invoking the real down. Actual saved old RED scratch source and receipt were read: sequential awaited move/down fails that boundary on the **first stationary grab**, with both flags true and no completed press receipt. This is genuine protocol-boundary RED, **not a fresh missed-target reproduction or proof of a delayed native packet**. Current GREEN has nine false/false records and two actual live interruptions. Default regression now wraps the real down expression within the queue; its freshness/live assertions still execute. The Node suite's process.execPath subprocesses inherit explicit Node24.

Read actual spike README, verification data, installed-source proof and raw CDP records. Independently matched **37 queued move/press/ACK triples** by raw log line order and request IDs: move send < press send < move ACK. Installed Playwright excerpt lines match actual coreBundle.js, SHA256 `874451b4e7acf90cda4330be42db2259c9e5036c22150f18016f04768434234c`. Client channel sends, server mouse coordinates and Chromium raw dispatch support this environment's result; instrumentation awaits mean it is not universal atomicity. Spike's four queued positives:36 trusted grabs/8 live interrupts; baseline180 passed without a fresh miss; native log send gaps0–1ms at log precision. Its real DOM12 negative fails. No spike browser experiment was rerun.

Queuing removes caller-enforced move-response dependency only. Bbox→input stalls, arbitrary scheduling and moving-target misses remain possible. No zero-miss, Linux, cross-browser, physical-device, product/a11y or native IDE acceptance follows.

## Fresh independent execution

All actual browser runs headless:true, existing dependencies/browser only:

- `/usr/local/bin/node` v24.21.0 (four suites and both default runs explicitly).
- Existing Hermes Python3.14.9, not system Python3.9.
- `PYTHONDONTWRITEBYTECODE=1`, `TMPDIR=~/.hermes/cache/scratch`.
- `MOTION_DEPS=~/.hermes/cache/scratch/motion-stage04`.
- `MOTION_BROWSER=~/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
- Actual engine versions animejs4.5.0, TypeScript5.9.3, esbuild0.28.2, playwright-core1.65.1; browser159.0.8154.6, macOS arm64.

| Command (in exact export) | Actual result |
|---|---|
| `/usr/local/bin/node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs .codex/scripts/test-motion-observation.mjs` | exit0; **76 PASS,0 fail/skip/cancel/todo** |
| Hermes Python `-m unittest discover -s .codex/scripts -p 'test_*.py'` | exit0; **88 PASS** |
| Hermes Python `-m unittest discover -s .codex/scripts -p test_design_ci.py -v` | exit0; **5 PASS**, including14 unsafe mutations+6 command-removal subtests |
| Hermes Python `.codex/scripts/selftest.py` | exit0;45 original roles+codex-docs,22 skills,5 lifecycle events,3 MCP configs;90 mappings; no WARNING |
| Hermes Python `.codex/scripts/sync-roles.py` | exit0; `Drift: none`, no --apply |
| `/usr/local/bin/node .codex/scripts/test-motion-template.mjs --integration` — predeclared normal1 | exit0 PASS; strict TS, SSR and complete browser flow |
| Same command — predeclared normal2, sequential after normal1 | exit0 PASS; no retry or selection |

Parent working95Python and other parent JSON receipts were read/hash-checked, not passed off as independently rerun working-tree evidence. Independent Python scope is the exact export88.

### Actual receipt read-back

Each fresh positive has nine trusted same-event actual tile grabs, all deltas0 and two live false→true inertia-pause interruptions. Both ordinary runs retain nine rAF stability traces, each range0. Controlled80ms has real pre-event advances4.741912841796875px and9.4794921875px. Default freshness records are true on both live checks; queued ACK flags false/false on all nine. Actual DOM12 negative: exit1/FAIL as expected, one trusted same-event grabbed/paused event, delta12; not a required-positive failure and not a live-inertia negative.

| Case | Actual receipt location | SHA256 |
|---|---|---|
| 80ms (PASS) | `/Users/germanbryzgalov/.hermes/cache/scratch/motion-observation-regression-m0ufot/receipt.json` | `15f63cfb6b110d85ba5fe6177fa776df2d9146418307d955e774b833d5181b28` |
| DOM12 (FAIL) | `/Users/germanbryzgalov/.hermes/cache/scratch/motion-observation-regression-bcCBvQ/receipt.json` | `b1957062df80feb3998da59607707b06df8be18d1b52b338f50f886c0f35cdf3` |
| default (PASS) | `/Users/germanbryzgalov/.hermes/cache/scratch/motion-observation-regression-VXKlXk/receipt.json` | `a85ecc23b73230c5c3aab7ff6281c684630d9a78deff61649c4dff366fadaae3` |
| queuedACK (PASS) | `/Users/germanbryzgalov/.hermes/cache/scratch/motion-observation-regression-b0y3Bi/receipt.json` | `96a94168d4df255ce66089ada4bbd15c8c093e902dfb3e89a0cd75628a9eb5b4` |
| normal1 (PASS) | `/Users/germanbryzgalov/.hermes/cache/scratch/motion-run-alVfZc/receipt.json` | `0898f782d26d2c1ac3fc9f3b880bf58839e9bd575182c9aef372bf35019092d6` |
| normal2 (PASS) | `/Users/germanbryzgalov/.hermes/cache/scratch/motion-run-Lp1fKX/receipt.json` | `89375bd0c8cdf6ac0ecb699b1fe090a73360edc64bcbd5956cba52384cbcffc4` |

## CI and fail-closed admission

Full workflow read: only existing scoped branch push and input-free workflow_dispatch; no PR/pull_request_target or provider/deploy trigger added. Exactly contents:read, checkout persist-credentials:false, three full40hex official pins retained; setup cache disabled. Isolated locked npm ci --ignore-scripts precedes Chromium installation and four Node suites; browser path is executable-checked/exported before tests. No secret reference, auth input, write permission, environment, upload, conditional/continue-on-error or failure-masking operator. Pins' release identities were not freshly fetched; their bytes are unchanged from the already reviewed revision, not a new supply-chain release certification.

Ruby Psych parsed actual workflow AST; all seven run blocks pass bash -n. Actual bash --noprofile --norc -e -o pipefail probe exits1 on false and never prints subsequent sentinel. The expected probe failure is preserved, not an integration failure. Text contracts are bounded, not YAML/schema/Actions execution proof. Linux installation and GitHub expression/event behavior remain unexecuted here.

Bounded added-line signatures for AWS/Stripe/GitHub/private keys/literal token/password assignments found no credentials; manual payload/workflow inspection also clean. No full history audit, credential-file scan, provider rotation or deployment security certification performed.

## Failures and execution deviations — retained

- Historical trusted misses remain FAIL: motion-run-NmbE69 SHA256 `b44a3ae9a2231f5f5b96a0d9e68a38fbf105538d31fbc1f6dd1ce68cbde5941c`; motion-run-TB0X76 `f45ae27bc6d74f654cd4129926f4ec4e634002040247e97f60ebfbc709c793c2`; motion-run-8Qm5Lz `9679989038fa0671725a9660b39eb34311fd21ae697ba478e21cc4343599325d`. All reread: trusted input, target empty, after null, sameEvent false, missing-event-bounds failure. Their old REQUEST_CHANGES are not erased.
- Parent ACK RED JSON exit1 retained (`db61d616ab2f9b676e048ae68829c0caeea910c72d071933223358628db9dbbe`); its actual scratch receipt flags true/true. Parent ACK GREEN exit0 read separately; no assertion it proves a fresh random-miss fix.
- Fresh DOM12 child exits1 as expected; full Node harness asserts failure reason and real DOM delta, so suite exit0 is valid.
- Review helper's first cell had a Python comprehension SyntaxError before any checks/browser launch. Corrected helper only, no candidate source fix.
- Initial environment probe printed systemPython3.9 and Node24 but ended exit1 because VIRTUAL_ENV was unset; no tests used systemPython3.9.
- Initial Python/selftest invocation inherited ambient PATH; source inspection later found selftest calls `node --check` by basename. Those initial successful Python/selftest outputs are not accepted as Node24-bound proof. PATH was explicitly prefixed `/usr/local/bin`, child resolution verified v24.21.0, and Python88/selftest/sync repeated once with corrected runtime. No positive test failure was retried for green; browser defaults remained exactly the two predeclared runs.
- Byte-alias discovery attempted git show on three files absent from the older rejected tree: expected path-not-present diagnostics retained; they are new metadata, not a source failure.
- First full-export blob helper encountered Git's quoted Unicode path (KeyError). Switched read-only parser to NUL-delimited ls-tree and completed1749-file verification; no file change or test attempt discarded.
- Spike's own retained preflight doc drift, analyzer log-spelling correction and inconclusive baseline are documented in its README; no spike pass is relabelled a miss reproduction.

**No required positive on the reviewed Node24 source failed.** Local source admission only; parent must publish exact approved bytes through authorized scope-preserving procedure and read back the actual exact-SHA Linux/Actions outcome. Point2 is not COMPLETE. Any later required-positive failure is REQUEST_CHANGES, not permission to rerun until green.

## Authored files

Only repository file authored by this reviewer: `docs/research/design-agent-upgrade/rollout/followup-04-queued-independent-review.md` (this report, outside the reviewed15-file candidate). Test runners inherently created their isolated scratch copies, logs, receipts and screenshots; no production/source/test fixture modifications. All twenty guarded ROOT paths remained unchanged before report creation.
