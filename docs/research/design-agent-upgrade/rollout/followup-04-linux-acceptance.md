# F04 — actual GitHub/Linux acceptance

## Exact executed source

- Workflow: `.github/workflows/design-regression.yml`, **Design regression**, push event.
- Source: `77d9e09390835250b39a684d245a32f2338fff32`.
- Run: [46038429158](https://github.com/1Herman1/Friday-claude/actions/runs/46038429158).
- Job: [regression / 140639660297](https://github.com/1Herman1/Friday-claude/actions/runs/46038429158/job/140639660297).
- Authenticated read-back: terminal status **completed / success**, exact headSha matches, every recorded job step success. `gh run watch --exit-status` returned0; full API JSON and logs retrieved separately afterward.

This is the actual dedicated design workflow, not a scheduled or unrelated Perfect Skin job. Local source admission and real runner execution are now both observed for the exact SHA above.

## Observed checks

Runner image `ubuntu-26.04` (ubuntu-latest resolved image); setup-node log reports `v24.22.3`, not the local v24.21.0. Python3.12 setup succeeded. We do not infer any old race's cause from that version difference.

- Selftest and readonly role sync: success; log `Drift: none`.
- Full Python discovery: **91 tests, OK**.
- Isolated locked fixture npm installation: success; no application/root dependency changes.
- Runner-only Chromium installation and executable/path export: success.
- Explicit Node suites: **76 tests /76pass /0fail /0skipped**, including real live-latency, actual DOM12px expected-negative, default-input and queued-ACK cases.
- Separate integration step: `PASS createDraggable export contract`, strict TypeScript against actual engine declarations, real-engine SSR import/creation/subscription, and `PASS real headless temporal pilot; normal/reduced/dynamic/interrupt/repeat/destroy`.
- Cleanup/post steps: success. No secret-backed provider or deploy job was added.

Actual authenticated readbacks are retained privately at `~/.hermes/cache/scratch/actions-context-fix-4ql090am/linux-run.json` and `linux-full.log`. Log SHA256 is recorded in the local verification packet. The runner logged receipt `/home/runner/.hermes/cache/scratch/motion-run-pW9wwA/receipt.json`; it was **not downloaded or persisted as an Actions artifact**. Assertions and log/step status were observed, not a separate parent visual review of Linux screenshots or receipt JSON.

## Historical failures and limits

Initial run [46036428539](https://github.com/1Herman1/Friday-claude/actions/runs/46036428539) on `6c6bf4aec9d2673f0853d229e67b1e993eab898d` remains FAILURE: GitHub rejected job-env `runner.temp` before runner creation, zero jobs/logs. It was repaired via separately reviewed scope/export regression and actionlint; this successful run is on a **new corrected source**, not a rerun-until-green. Earlier real motion misses and REQUEST_CHANGES remain in their revision-bound reports.

This closes follow-up point2: standalone credential-free design regression CI actually executes successfully on Linux. It does not prove zero future pointer misses, physical/Safari/cross-browser/product-a11y acceptance, native IDE reload, client design quality or owner acceptance. Those remain separate later gates. No blanket full-repository/history security clearance is claimed.
