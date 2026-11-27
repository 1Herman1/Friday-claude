# Follow-up 04 — Actions runner-context scope fix

## Outcome and boundaries

Candidate based on published `6c6bf4aec9d2673f0853d229e67b1e993eab898d`.
Only `.github/workflows/design-regression.yml`, `.codex/scripts/test_design_ci.py`, and this report are owned. No Git writes, push, installation, providers, credentials, or browser execution. Existing foreign dirty files are not part of this candidate. Independent review remains the parent coordinator's next gate.

The first actual GitHub run, [46036428539](https://github.com/1Herman1/Friday-claude/actions/runs/46036428539), failed **before runner creation**, with zero jobs/checks/logs (parent's authenticated API evidence). Public annotations at original lines 31–33 identify the unavailable `runner` context in job-level `env`. This is not a failed motion test. This follow-up does not claim another GitHub run: **Linux execution remains PENDING**.

GitHub's [context availability table](https://docs.github.com/en/actions/learn-github-actions/contexts#context-availability) permits `runner` in step `env`, not `jobs.<job_id>.env`. Local actionlint independently reproduces all three expression errors on the old workflow.

## Minimal correction

- Keep `PYTHONDONTWRITEBYTECODE: '1'` in job `env`.
- Relocate the three unchanged expressions to `Owned temporary directory` step `env`:
  - `TMPDIR=${{ runner.temp }}/design-ci-owned`
  - `MOTION_DEPS=${{ runner.temp }}/design-ci-owned/motion-deps`
  - `PLAYWRIGHT_BROWSERS_PATH=${{ runner.temp }}/design-ci-owned/browsers`
- Keep the existing `mkdir -p "$TMPDIR" "$HOME/.hermes/cache/scratch"` first. Append one quoted `printf` exporting all three values to `GITHUB_ENV`, before any later consuming steps.
- Preserve action pins, triggers, permissions and every original executable command. Exact workflow transformation was asserted against a saved old copy; unrelated workflow bytes are identical. No motion/library/fixture/production code was edited.

The offline text contract explicitly guards job-env runner use, exact job/step environment scope, ordered creation/export block and the required executable export command. Two new negative cases cover injected job-env runner use and missing export. The original 14 unsafe mutants and six missing-essential-command mutants are unchanged. This bounded text guard is not advertised as a general YAML parser or Actions execution proof.

## RED → GREEN evidence

Evidence root (local scratch, not committed):
`/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-fix-4ql090am/`

Before modifying the workflow, the new `test_runner_context_is_not_used_in_job_env` ran against the old source and failed with the explicit assertion `runner context is unavailable in jobs.<job_id>.env` (exit 1). This was a new semantic assertion, not an expected-string update. `regression-red.log` preserves the complete failure; `baseline-workflow.yml` preserves old bytes. `schema-red.log` records actionlint's three original expression errors (exit 1).

After the minimal fix, all eight contract tests pass, including all original mutation subtests and the two new negatives. Full Python discovery passes **91 tests** on a clean `git archive HEAD` export overlaid only with the owned candidate files. Selftest and readonly sync also pass there. The report was overlaid before final verification; no foreign dirty files were imported.

## Actual commands, versions and exits

Host: macOS; Python **3.14.9** (Hermes executable, not system Python 3.9); Node **v24.21.0**, selected with `PATH=/usr/local/bin:$PATH`; bash **3.2.57(1)-release**. Python commands use:
`/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3`
with `PYTHONDONTWRITEBYTECODE=1`. Exact executable spelling and complete argv/cwd/exits are also recorded in `receipts.json`.

Actionlint **1.7.12**, built with Go 1.26.1 for darwin/arm64, reuses the parent's verified release binary at:
`/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/actionlint/actionlint`.
No installation or additional workflow lint step was added.

| Command (Python means the executable above) | Exit / result | Evidence |
| --- | --- | --- |
| `python .codex/scripts/test_design_ci.py DesignCIContractTests.test_runner_context_is_not_used_in_job_env -v` on old workflow | 1, expected assertion failure | `regression-red.log` |
| `actionlint -shellcheck= -pyflakes= .github/workflows/design-regression.yml` on old workflow | 1, three runner-context errors | `schema-red.log` |
| `python .codex/scripts/test_design_ci.py -v` | 0, 8 tests | `contract-green.log` |
| Same actionlint command on exact candidate workflow | 0, no diagnostics | `schema-green.log` |
| `python -m unittest discover -s .codex/scripts -p 'test_*.py' -v` in clean export | 0, 91 tests | `python-suite.log` |
| `python .codex/scripts/selftest.py` in clean export | 0, both PASS lines | `selftest.log` |
| `python .codex/scripts/sync-roles.py` in clean export | 0, `Drift: none` | `sync.log` |
| `bash -n` on every extracted run body (`run-00.sh` through `run-06.sh`) | 0 each | `bash-n-00.log` through `bash-n-06.log` |
| `bash -e <evidence-root>/owned-export.sh` with isolated paths | 0; exact three exports | `owned-export-evaluate.log`, `export-values.json` |

The evaluation executes the **actual extracted step body**, not a rewritten export. The fake runner root contains spaces: `<evidence-root>/runner temp with spaces/`. `TMPDIR` did not exist before execution. `GITHUB_ENV` was intentionally placed inside that not-yet-created directory (`design-ci-owned/github-env`), so successful append also proves directory creation precedes export. Readback asserts exactly three newline-terminated key/value pairs with their full literal paths. Isolated `HOME` is `<evidence-root>/isolated home`; no user's actual home files were written by this probe. `export-values.json` maps each step-env input to its exact exported value.

No browser replay, dependency install, or Linux runner was performed. Unchanged motion verification is the parent's existing published-revision evidence, not a fresh result of this narrow repair.

## Independent review packet

- `clean-export/`: HEAD archive plus only the owned three-file delta, used for the final Python/selftest/sync run.
- `frozen-payload/`: exact owned file bytes, preserving repository-relative paths.
- `payload-manifest.json`: base SHA, source → frozen/export path map and SHA-256 for each of the three owned files (including this report); hashes live outside the report to avoid self-reference.
- `receipts.json`: full command argv, working directory, exit status and log path.
- `owned-delta.patch`: only the two tracked code/workflow changes; the new report is included in the frozen payload.

The frozen hashes and source equality are checked after preparation. Parent must review those exact bytes before any separately authorized publication. Local schema GREEN does not replace GitHub job creation or Linux execution evidence.
