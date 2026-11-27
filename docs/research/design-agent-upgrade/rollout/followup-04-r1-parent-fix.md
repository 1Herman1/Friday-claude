# F04-R1 — parent input-order fix

## Revision and evidence

Base `c10a97d7e80d805087889efc448ee3e0aafb5234`. Independent reports `followup-04-code-devops-review.md` and `followup-04-qa-silent-review.md` remain historical REQUEST_CHANGES for the old frozen tree `3e6077d6…`; neither is overwritten or counted as acceptance of this revision.

The fresh fix worker did not obtain a new actual miss with180ms artificial delay; its run was inconclusive and no fix was made. That report remains `followup-04-r1-input.md`. The two independently captured real missed-target failures already establish F04-R1; no subsequent PASS erases them.

Parent added a deterministic protocol-order regression on a **real default browser replay**, without artificial observation latency: its scratch-only instrumentation records whether the last bbox was obtained after observation arming whenever inertia is live. It does not move/pause/mock the engine, manufacture an event, or enlarge the hit area. Old source produced a genuine RED (`live input coordinates must be sampled after observer arming`), not a newly claimed random miss. Then parent moved snapshot/arming and any optional latency before final bbox → real mouse.move → real mouse.down, for both modes. No observation roundtrip now ages the aim between move and press. Offset23px, trusted input, event identity, actual hit/real grab/paused inertia and <1px continuity are unchanged.

This is a bounded input-order invariant, not a claim that arbitrary host stalls can never affect automated input. Actual event hit and live interruption continue to be asserted, not retried/skipped.

## Current parent results

- Focused default-path regression: RED → GREEN with live actual event.
- Exact clean overlay:88Python and75Node PASS,0skip/fail; working95Python PASS.
- Node75 contains the old74 cases plus the new default-path real-browser regression. Positive80ms and real DOM+12px negative controls remain.
- Two subsequent unmodified default integration commands, sequential: both PASS. Each receipt contains9 trusted/tile/same-event grabs and2 actual live inertia interruptions. Receipts: `motion-run-rcIICa/receipt.json`, `motion-run-9FXclk/receipt.json` under Hermes scratch.
- Selftest:PASS without WARNING; readonly sync:Drift:none.
- Production SHA256 remains `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`; production/fixtures are unchanged.

Commands/results: `~/.hermes/cache/scratch/design-ci-parent-06580sea/r1-parent/{protocol-red,protocol-green}.json` and `r1-final/*.json`. Historical old reports/counts are not current positive proofs. Workflow step label no longer hardcodes a stale test count; Actions pins, permission and install order unchanged.

No Git publication/dispatch, provider call, installation, client edit or visible browser was performed in this fix. Independent review of the new frozen revision is required before publication; actual Linux/GitHub run is still pending.
