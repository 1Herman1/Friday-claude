# Follow-up 04 R1 — input-order tracer: BLOCKED before implementation

## Result

F04-R1 remains OPEN. No runner fix or accepted new revision is supplied. Strict TDD stopped before implementation because the bounded 180ms protocol-delay tracer did **not** reproduce an actual missed press on the old default runner. A failing coverage assertion is not accepted as the required RED. No timing sweep, rerun-until-green, engine alteration, enlarged target, threshold relaxation, synthetic input or settling workaround followed.

## Exact source and scope

HEAD: `c10a97d7e80d805087889efc448ee3e0aafb5234` (unchanged).

Read both independent F04-R1 reports in full. Built a fresh bounded dependency export from actual HEAD blobs plus the exact eight owned overlays from the prior review map, including `.github`. Foreign dirty source was not copied into that candidate. Original independent failures `motion-run-TB0X76` and `motion-run-8Qm5Lz` were not modified.

Workspace: `/Users/germanbryzgalov/.hermes/cache/scratch/f04-r1-8z841qc3/`.

- `baseline.json`: HEAD and original eight-overlay hashes.
- `before-guard.json`: working-source baseline.
- `old-runner.mjs`: unchanged original runner.
- `candidate/`: diagnostic export; its test module retains the failed tracer for inspection. **Not an accepted candidate.**
- `red.log`: actual targeted Node output.
- `final-source-guards.json`: exact final hashes and guard comparison.

Only this report remains authored in the repository. Temporary changes to the existing test module were restored byte-for-byte after the failed tracer. Runner, observer, workflow, CI ledger and plan were not changed.

## Actual bounded experiment

One existing-module browser case was attempted, using the real engine, headless shell 1255, real Playwright mouse and default `--integration` without `--observation-latency`. Scratch runner instrumentation inserted `if (!before.inertiaPaused) await page.waitForTimeout(180)` immediately after the existing arm evaluate. No fixture or production changes. This was asynchronous protocol/input latency, not CPU stress.

The 180ms bound was selected from prior independent receipts showing 4.9–15.6px advance during 80ms; those observations did **not** establish a reliable minimum velocity. Actual execution disproved the assumption that 180ms necessarily moves the tile beyond its original 23px aim.

Command in diagnostic export:

```sh
node --test --test-name-pattern=normal-input-delay .codex/scripts/test-motion-observation.mjs
```

Existing environment only: `MOTION_DEPS=~/.hermes/cache/scratch/motion-stage04`, `MOTION_BROWSER=~/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell`, scratch `TMPDIR`. No installs/network/providers/visible browser/Git writes.

Actual Node result: **1 test, 0 pass, 1 fail**, no skipped/cancelled/todo. Failure: `controlled input latency must move live tile past the original 23px aim`. Crucially, the subprocess itself returned **0** with a PASS receipt; this is **not** an actual old-runner missed-input RED.

Receipt: `/Users/germanbryzgalov/.hermes/cache/scratch/motion-observation-regression-Wf1XKo/receipt.json`.
SHA-256: `b42b81d615a310af204b1ddd32c0e884c3a17731c67a252723d4cd75c1f7ef79`.

The two live-inertia presses had legacy/event-before positions:

- `167.11911010742188` → `169.9571990966797`.
- `283.86199951171875` → `288.083984375`.

Both event-before snapshots had `inertiaPaused=false`; neither movement crossed the 23px stale-aim offset. The existing production velocity varies with actual headless input timing, so this bound alone is insufficient as a deterministic regression. Repeated attempts were deliberately not used to obtain a favorable miss.

## Final source guards / unexecuted gates

Final 1729-entry working-source guard comparison: **zero changed entries**. All eight original owned-overlay hashes match their prior map. Exact important SHA-256:

- Runner: `a5b216a1bd0fa57449860e6533b3e5c235a42b542af4117a3576dd7d8148d371`.
- Existing observation test module (restored): `bfa7fd10f54d557e1cfc1c079f9d3d1dd1b0e1556e7f1fdf316413cb91d3a783`.
- Observer: `faa801c586e87bc11d95c139a40ec8d439b9e5ddcf870a1fab0e45c4ade6dd09`.
- Production template: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`.
- Fixture TS: `f85ef00cb67bad96af7529d63c9c4a8be6cdabad5b99ff9300eccd891fab8d1c`.
- Fixture HTML: `09fb978e1c9a301feb0918750bc62a5e8cab14dff2528f499e625bc1d1b30244`.

No GREEN claimed. Full Node four-suite/new count, Python clean 88/working 95, selftest/sync, two sequential unmodified normal replays and final positive/12px-negative gates were **not run in this attempt**, because the prerequisite actual failing tracer was not established. Prior reviewer counts are not substituted for fresh execution. Independent review and Linux CI remain blocked; publication was not attempted.
