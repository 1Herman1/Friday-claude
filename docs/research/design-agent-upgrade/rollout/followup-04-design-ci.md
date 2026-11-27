# Follow-up 04 — design regression CI (point 2)

## Status and scope

Implementation candidate, not published or accepted Linux execution. Base HEAD:
`aa69a3782a4de4b5106da4753e5e6956acf4cb7b`, existing working/default branch
`claude/greeting-nnz368`. This worker made no commit, branch, push, dispatch,
deploy, provider call, client edit, root npm change or local installation.

Only three repository files belong to this proposal:

- `.github/workflows/design-regression.yml`
- `.codex/scripts/test_design_ci.py`
- `docs/research/design-agent-upgrade/rollout/followup-04-design-ci.md`

Parent performs independent review, exact-path publication and verification of
the actual GitHub run. This report does not substitute for that review.

## Workflow

One `ubuntu-latest` job, 20-minute timeout; push on the actual default branch
with design/.codex/.claude/core/registry/source/workflow path filters, and
input-free `workflow_dispatch`. Full checkout preserves all test dependencies.
Only `contents: read`; checkout credentials are not persisted. No secrets,
provider inputs, protected environment, write permissions, deploy, artifact
upload, `pull_request_target`, conditional tests or ignored failures.

Official action pins came from the parent's fresh releases/latest + tag-commit
resolution; this worker additionally fetched each exact commit object and its
`action.yml`. All three SHA strings are valid 40-hex commit IDs; all use node24:

| Action | Release | Exact commit |
|---|---|---|
| [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [setup-python](https://github.com/actions/setup-python/releases/tag/v7.1.0) | v7.1.0 | `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0` |

Node 24 / Python 3.12 are explicit. Automatic setup-node package-manager cache
is disabled. The job runs selftest, read-only role-sync and full stdlib Python
discovery. It copies the existing motion package and actual lock into
`RUNNER_TEMP/design-ci-owned/motion-deps`, then runs
`npm ci --prefix "$MOTION_DEPS" --ignore-scripts --no-audit --no-fund`.
Only after installation does the explicit three-file Node suite run (64 tests,
including dependency-isolation). The existing suite uses HOME's
`.hermes/cache/scratch`; that directory is explicitly created on the runner.
TMPDIR and browser downloads are under the owned RUNNER_TEMP subfolder.

Chromium installation uses the isolated playwright-core CLI with
`install --with-deps chromium` only on the disposable Linux runner. Its real
`chromium.executablePath()` is checked executable and exported as MOTION_BROWSER.
The final integration command invokes the existing strict TypeScript, real
engine SSR and headless temporal runner, with explicit MOTION_DEPS/MOTION_BROWSER.
That existing runner writes its technical receipts to HOME's scratch folder;
its outputs, dependencies, browser and RUNNER_TEMP are **not uploaded**. Actions
logs provide the gate result; no artifact action is needed for this proposal.

## TDD and mutation evidence

1. Before workflow creation, `test_workflow_exists` failed with the actual
   assertion `design regression workflow is missing` (one test, exit 1).
   Minimal workflow creation made that test pass.
2. Contract mutation tests initially failed against the empty checker:
   20 negative subtests rejected nothing. Implementing the textual guards
   made the contract green. The 20 probes are 14 unsafe/config mutations plus
   six essential-command removals, not 20 separate unittest cases.
3. A subsequent ordering test failed because the Node dependency-isolation
   suite preceded installation. Installation was moved before Node testing;
   the runner scratch directory prerequisite was added. Final focused suite:
   **5 tests, PASS**.

Mutations cover write/extra/job permissions, true/implicit checkout credentials,
continue-on-error, secret references, failure masking/conditional gates,
unpinned action, untrusted event, missing isolated lock/browser export, root npm
installation and removal of selftest, role-sync, Python, Node, Chromium or real
motion commands. Required shell lines are checked as active run lines rather
than accepting comments as commands. These are deliberately bounded textual
contracts, **not a YAML parser, GitHub schema validator or proof of execution**.

## Actual local verification

Existing macOS arm64 environment: Node **24.21.0**, already installed Hermes
Python **3.14.9**. No local global/package/browser installation. System Python
3.9 cannot run the export harness's modern tar extraction API; the first harness
attempt stopped before tests and was rerun using the existing Python 3.14.

| Gate | Shared working tree | HEAD + three-file overlay |
|---|---|---|
| Focused CI contract | 5 tests PASS | 5 tests PASS |
| Full Python `unittest discover` | **95 tests PASS** | **88 tests PASS** |
| Explicit Node three-file suite | **64 PASS**, 0 fail/skip | **64 PASS**, 0 fail/skip |
| Selftest | PASS; no freshness warning | PASS; no freshness warning |
| Role sync, no `--apply` | `Drift: none` | `Drift: none` |
| Strict TS + real SSR + real headless replay | PASS | PASS |
| Psych YAML syntax/indentation AST | PASS | PASS |

The count difference is pre-existing uncommitted Python content-parity work,
not excluded tests: the published base has 83 Python cases; this proposal adds
five. Both full suites use `-p 'test_*.py' -v`, with no filtering or skips.

Local integration used only the existing dependency prefix
`~/.hermes/cache/scratch/motion-stage04` and existing Chromium headless shell
`~/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
The existing dependency lock hash equals the committed pilot lock hash. Actual
engine versions: animejs 4.5.0, TypeScript 5.9.3, esbuild 0.28.2,
playwright-core 1.65.1. Replay covers normal inertia, reduced/dynamic preference,
interrupt, repeat and destroy cleanup. Fresh subprocesses with MOTION_DEPS or
MOTION_BROWSER removed each exited 1 with the expected explicit environment
assertion before strict TypeScript or browser startup; these expected failures
are negative gates, not successful integration runs.

Psych is the available Ruby YAML 1.1 parser (`on` resolves to boolean true when
loaded; AST parsing preserves syntax). Additional bounded structure assertions
and `bash -n` checked all run scripts: ten steps, PASS. `actionlint` and a local
official GitHub schema validator are unavailable. No validator was installed.
Linux npm installation, Linux browser dependencies and the Actions expression /
event engine have **not** been exercised locally. Only the parent's real GitHub
run can accept those gates.

## Exact candidate and evidence handoff

Scratch directory: `~/.hermes/cache/scratch/design-ci-worker/`.

- `head-source.tar`: actual Git HEAD archive, including `.github`, `.codex`,
  `.claude`, `docs/core`, rollout research, `docs/projects`, CLAUDE.md, .mcp.json.
  Archive SHA-256: `9c9a5e09fb29d80b754db913220076020306a77f6d83541a4e059d203955f420`.
- `export/`: that archive plus **only the three owned proposal files**, not a
  copy of the foreign dirty tree. `export-manifest.json` records every source
  file hash and the explicit overlay. Final packaging is in `proposal-overlay.tar`
  and `proposal.patch`; `final-hashes.json` records final hashes without a
  self-referential hash inside this report.
- Workflow SHA-256: `dc6a439cd8276dfb3881defd885c9d02e8d71f0f5c3f0414c716394fa2ae0f5b`.
- Test SHA-256: `7e04b6bb74db95c14eecb1a076ed50c1910a84ea362f283aeed7c4bcb1f1b9bb`.
- `results.json`, `working-*.log`, `clean-*.log`, `gate-MOTION_*.log`,
  `red-missing-workflow.log`, `yaml-structure.log` contain real execution.
- `official-action-runtime-verification.json` and the three fetched
  `actions-*-action.yml` files preserve primary-source runtime/commit checks.
- `source-guard-before.json` / `source-guard-after.json` preserve owned hashes.
  Foreign tracked-delta hashes are informational and changed concurrently
  (including another task's journal DEVLOG); they are not an owned-scope gate.
  Parent FOLLOWUP-PLAN changes are explicitly excluded. The three owned files
  must match the final export manifest; no foreign working files enter it.

Final code execution returns zero for every positive gate; two missing-env
subprocess probes intentionally return one. Publication and independent review
remain outstanding, not silently marked PASS.

## Коррекция verdict после parent replay

Исторический PASS выше не является текущим CI gate: независимый parent replay
завершился exit 1 (`grab must not jump to pointer center`, restored inertia).
Исходные failure receipts не переписаны. Подтверждена гонка межкомандного
наблюдения; диагноз, RED/GREEN, actual-event traces и текущая расширенная
семифайловая proposal описаны в `followup-04-motion-observation.md`.
Workflow теперь включает четвёртую Node suite (74 tests), включая два настоящих
headless browser regression cases; поэтому browser install предшествует Node.
Никакие Actions pins/permissions/deploy/secrets/upload gates не расширены.
Локальные исправленные прогоны не заменяют независимое ревью и реальный Linux
Actions run; до их завершения публикационный статус остаётся BLOCKED.
