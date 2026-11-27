# F04 — queued native input candidate

## Question and scope

Base `c10a97d7e80d805087889efc448ee3e0aafb5234`. Historical failures and REQUEST_CHANGES reports are retained. No older PASS closes the Node24 missed-target failure. This revision changes only test input dispatch and adds its regression; production and fixture bytes remain unchanged.

Readonly spike `~/.hermes/cache/scratch/queued-grab-spike-20261127/README.md` tested exactly six predeclared cases on explicit `/usr/local/bin/node` v24.21.0. It confirmed a narrow property: start public move/down back-to-back and await both, removing the caller's wait for move response. Actual CDP telemetry verified move→press order and before-move-ACK dispatch for37pairs. Baseline with180ms completion delay did NOT miss; it is not a reproduced miss→fixed comparison. Four queued positive replays gave36trusted grabs and8live interruptions, deltas0; real DOM12px negative failed. This is not proof of zero intermittent misses or arbitrary scheduling atomicity.

## Current implementation / TDD

Inside grab, after snapshot/arm/optional latency and final bbox:

```js
await Promise.all([
  page.mouse.move(box.x + 23, box.y + 31),
  page.mouse.down(),
]);
```

Only public Playwright APIs are used. Offsets, causal observer, trusted target, event identity, actual grab/inertia pause, <1px threshold, all original stability/motion assertions and fail-closed missing-input checks remain. No retries, bigger hit area, synthetic positive input, pause/settle workaround or engine modification.

New regression runs a real default browser replay in a scratch copy. It forwards the real grab-move, delays only completion visible to its caller by180ms, and records whether down is called before the public move promise resolves. Old sequential source: genuine RED (`press must be queued before move acknowledgement`). Queued source: GREEN. Its flags concern public promise acknowledgement/completion, not a claim that this test itself captures raw CDP ACK timing; raw protocol order was separately observed by the spike. No engine, snapshot or actual mouse event is mocked. Existing default-input regression now observes the down expression inside the queue, instead of requiring a standalone awaited statement.

## Fresh parent checks, explicit Node24

- Exact owned clean export:88Python PASS; working95Python PASS.
- Explicit Node24 four suites:76PASS,0fail/skip. Existing80ms/live/default/real DOM12px cases remain; the added queued-ACK case is included by the same module.
- Two sequential ordinary Node24 integration commands:PASS, PASS; no retry-until-green.
- Selftest:PASS without WARNING; readonly role sync:Drift:none.
- Production template SHA256 unchanged: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`.

Actual outputs: `~/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/` (`ack-red.json`, `ack-green.json`, full suites and normal24-{1,2}.json). Linux/Actions remains PENDING; independent review of the current frozen candidate is required. Qualified spike success or local happy paths do not certify elimination of all scheduling misses. Nothing has been pushed/dispatched in this step.
