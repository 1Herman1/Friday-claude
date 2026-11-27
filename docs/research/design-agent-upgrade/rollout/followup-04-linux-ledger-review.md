# F04 — bounded Linux acceptance ledger review

## Verdict: PASS (source admission of two documents only)

Actual reviewer: **Hermes delegated reviewer, this review session**. One reviewer performed the five bounded perspectives below; these are not five separately executed agents or independent approvals of one another.

Base / observed HEAD: `77d9e09390835250b39a684d245a32f2338fff32`.

Reviewed payloads (SHA256 of actual working-file bytes):

| File, relative to this directory | SHA256 |
|---|---|
| `followup-04-linux-acceptance.md` | `a417bd0b18d5edd53100d79c59bee179ea2abeeffd3179e63a446a004a18c00c` |
| `FOLLOWUP-PLAN.md` | `a4aa4117abdaed844fde646fe73d8b4b1c3c1c24cce1489e4e262834ed0c7ddc` |

The actual plan is `docs/research/design-agent-upgrade/rollout/FOLLOWUP-PLAN.md`; there is no plan at the research-directory root. Review uses the existing rollout plan, not a newly invented or moved path. The acceptance document is untracked/new relative to the base, so its entire contents were reviewed, not omitted by relying on `git diff` alone. The tracked plan diff changes only status rows 2 and 3; criteria, rows 1 and 4–9, authorisation and historical prose are unchanged. `git diff --check` for the tracked plan returned 0. Foreign dirty work is outside this verdict and was not adopted.

## Fresh GitHub evidence

Read-only authenticated `gh` access succeeded as `1Herman1`; no login, credential, provider or browser configuration was changed. Fresh `gh run view --json`, `gh api` and full `gh run view --log` reads established:

- [Run 46038429158](https://github.com/1Herman1/Friday-claude/actions/runs/46038429158): **Design regression**, `.github/workflows/design-regression.yml`, event `push`, attempt **1**, head SHA exactly `77d9e09390835250b39a684d245a32f2338fff32`, terminal **completed / success**.
- Exactly one job, [regression / 140639660297](https://github.com/1Herman1/Friday-claude/actions/runs/46038429158/job/140639660297), completed successfully. All **15 recorded steps** are success, including setup, checkout, Node, Python, owned temp setup, selftest/sync, Python discovery, locked fixture installation, Chromium installation, explicit Node suites, integration and all post/completion steps. This is not an unrelated product workflow.
- Actual OS log: **Ubuntu 26.04.1**, image **ubuntu-26.04**; actual Node **v24.22.3**, Python **3.12.16**. The earlier local **v24.21.0** is separately recorded in the existing context-fix review; it is not the runner version or a proven explanation of any earlier race.
- Full log lines 404–406: **Ran 91 tests**, **OK**. Lines 764–769: **76 Node tests, 76 pass, 0 fail, 0 skipped**. Selftest passes and role sync reports `Drift: none`.
- Lines 760–763 record the real controlled-latency positive, actual DOM-jump expected-negative, default-input live-inertia and queued-input-before-ACK regressions passing. These are test/assertion results, not a new inspection of their ephemeral receipt files.
- Lines 788–803 record `PASS createDraggable export contract`, `PASS strict TypeScript against real animejs declarations`, `PASS real-engine SSR import / guarded creation / subscription`, and `PASS real headless temporal pilot; normal/reduced/dynamic/interrupt/repeat/destroy`.
- Fixture dependency install and runner Chromium provisioning precede the tests and succeed. The workflow at the exact source uses isolated locked fixture dependencies, `contents: read`, pinned actions and checkout `persist-credentials: false`; no provider-secret injection, deployment or artifact-upload step is present. This is a bounded CI metadata/source cross-check, not another implementation audit.

Private existing evidence, read rather than rewritten:

| Existing private file | SHA256 |
|---|---|
| `~/.hermes/cache/scratch/actions-context-fix-4ql090am/linux-run.json` | `cf389e165409e6b37bb15aac96a57e18ac3cf84c2a6404b4e84298dc5bdbb3df` |
| `~/.hermes/cache/scratch/actions-context-fix-4ql090am/linux-full.log` | `cda212ae977d499fee39134771512c3326fd15b3a3842edf1594493dda0c3445` |

The freshly retrieved full log has SHA256 `cda212ae977d499fee39134771512c3326fd15b3a3842edf1594493dda0c3445` and is byte-identical to the retained private log. Those private files are not committed artifacts or permanent storage guarantees. The acceptance document's account of the parent's `gh run watch --exit-status` returning 0 was not independently re-executed here; terminal success is independently corroborated by fresh API/job/step/log reads.

## Preserved failures and receipt boundary

Fresh API reads confirm initial [run 46036428539](https://github.com/1Herman1/Friday-claude/actions/runs/46036428539) remains **completed / failure**, attempt **1**, source `6c6bf4aec9d2673f0853d229e67b1e993eab898d`, with **0 jobs**. `gh run view` reports a likely workflow-file issue. Existing revision-bound context-fix evidence records the invalid job-level `runner.temp` scope and its actionlint rejection; this review does not pretend the now-empty check-run API provides a fresh detailed annotation. The corrected success is a distinct run on corrected source, not a rerun of the initial failure. No run was dispatched, retried, cancelled or modified in this review. Earlier motion FAIL / REQUEST_CHANGES evidence is not rewritten or superseded as a historical result by the new prose.

The successful log names `/home/runner/.hermes/cache/scratch/motion-run-pW9wwA/receipt.json`. Fresh artifacts API returns **total_count 0**. The two documents correctly do **not** claim that receipt or Linux screenshots were downloaded, persisted as an Actions artifact, or separately visually reviewed by the parent. Only logged assertions and real job/step outcomes support this admission; the receipt contents and screenshot bytes are not independently verified here.

## Five bounded verdicts — same actual reviewer

| Perspective | Verdict | Basis / boundary |
|---|---|---|
| Documenter | **PASS** | New acceptance prose and only plan status rows 2/3 change. Point 2 closure is tied to exact real CI; point 3 remains preparation/IN_PROGRESS, two compositions and owner visual gate pending. No product, zero-miss, cross-browser, native IDE or owner acceptance is inferred. |
| Code / scope | **PASS** | Source-admission consistency only: exact-source workflow commands match observed steps, no code or workflow is changed by these two documents. This is not approval of all repository source, foreign dirty work or the entire earlier audit. |
| DevOps | **PASS** | Fresh authenticated exact-run/SHA/job/15-step readback and full logs substantiate real Linux success, distinct runner/local versions and retained failed initial attempt. Ephemeral receipt and zero artifact limits are explicit. |
| QA | **PASS** | 91 Python and 76 Node outcomes, strict TS, SSR and real headless temporal PASS are present in actual runner logs. No expensive browser/test rerun was performed for prose; this review verifies historical execution evidence, not physical devices, product-a11y or future flake freedom. |
| Secrets / bounded history links | **PASS** | Full two-document text and added lines inspected; credential-signature scan found 0 hits. Run/job links target the owned repository; private paths are references, not copied credentials or published raw logs. Only referenced history/context evidence was consulted; no repository-wide or all-history security clearance, credential-file access or rotation is claimed. |

Findings requiring changes: **none in this bounded payload**. PASS is tied to the two SHA256 values above; changed bytes require renewed review. The sole authored deliverable is this review file. No Git write, staging, commit, push, source edit, production change or public-media action is authorised or performed by this review.
