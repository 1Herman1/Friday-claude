# Stage 05 — independent bounded code / policy / security review

## Role, scope, revision

- Reviewer: **Hermes subagent, adapted `code-reviewer`**, independent of implementer; not native Codex and not implementer self-review. Authoritative `.codex/agents/review/code-reviewer.md` and review-loop read.
- Verdict: **PASS** for the bounded code/policy scope below. **Критичных проблем не обнаружено.** No confirmed findings ≥80% confidence.
- Baseline: local published-stage01 HEAD `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`. No network verification of remote publication performed.
- Read/review targets: `docs/core/design-surface-workflow.md`, `.codex/scripts/test_design_surface.py`, `.codex/scripts/design-lint.mjs`, `.codex/scripts/test-design-lint.mjs`; implementation report `rollout/stage-05-surface-policy.md`.
- Only persistent repository write by this reviewer: this report. No source fixes, Git writes, network, installations or browser UI. Isolated fixtures used and removed under `/Users/germanbryzgalov/.hermes/cache/scratch`.
- Routing CODEX/commands/SKILL and their integration remain the parent’s separately assigned scope. The parent’s updated disclaimer at surface-doc lines 76–82 was read; the four policy tests were replayed after that update. Routing statements in that paragraph were not independently certified here.

### Exact reviewed SHA256

| Target | SHA256 |
|---|---|
| `docs/core/design-surface-workflow.md` | `6e391aaeb4ee07e141025558cb301bf6749f150663542bfd9929a836cca4ee2e` |
| `.codex/scripts/test_design_surface.py` | `e64f0c69f0f71a83721d5dd9cba357c71fd9ff5a3d1f25469546481e658a2f4a` |
| `.codex/scripts/design-lint.mjs` | `b7a9dfc9fbc8e47e4c7f2f672b8942d8978ebf92e3fab44529498b9f8d5177f6` |
| `.codex/scripts/test-design-lint.mjs` | `d45b50a7b728d4c1794f725c72b688e72b5c791acfcda998232444858b81b05e` |
| `rollout/stage-05-surface-policy.md` | `4a7c577fcd71b2ef8e4d67ef6017768267d21c7df098b887668743e9b1d81e07` |

The implementation report retains its historical leaf document hash; it is not the updated parent disclaimer hash above. Any later content change requires affected checks/review again.

## Minimality and preservation proof

Compared both complete lint/test files with `git show HEAD:<path>`, not just snippets:

1. Replacing only the new `forbidden-font` function/comments with the original `/\b(Inter|Arial)\b/` rule and removing the third `filePath` call argument reconstructs the complete HEAD linter **byte-for-byte**.
2. Removing only the contiguous five added tests reconstructs the complete HEAD test file **byte-for-byte**.
3. HEAD SHA256: linter `9f0ac6e57f178a02bf1d2b39861e16e18cf2ccc511c3ddfda7eb7220d32be29a`; tests `383a20a372c779cf141ccea140eb62fbbb922c949b62ac353f57e5b32950bb73`.
4. `lib/projects.mjs` has no diff against HEAD. Resolution/parser, remaining RULES/MASTER_RULES, hints, levels, coverage and exits are unchanged. All 17 legacy seeds are preserved.
5. Executed the unchanged HEAD 37-test suite against both HEAD CLI and current CLI in isolated scratch copies with the real HEAD projects helper: **37/37 pass in each**.

New exception at linter lines 12–15 only suppresses matches whose exact case-sensitive `Inter`/`Arial` name belongs to `loadDesignSystem().fonts`, with project identity matching for named `projects/<target>/...` and `tools/<target>/...` targets. It does not globally whitelist either name or suppress another unapproved name on the same line. A missing target MASTER cannot inherit approval from the active project, even though the unchanged resolver can still supply that foreign DS for existing layer-2 rules. This review does not claim a resolver-wide change.

For paths without a recognizable project, existing active/sole-project resolution remains in effect. This is documented scope, not target discovery by AST. The legacy parser remains heuristic: this is not a structured MASTER schema validator, role detector or page-override parser. Approved body font used as a new display identity still requires manual identity review.

## Policy semantics

- Surface doc lines 5–12: safety/a11y/anti-slop global authority retained; MASTER/brand control identity/tokens; page override only approved page/field. Conflicts stop dependent changes rather than rewrite the base for PASS.
- Lines 25–33: hero/nav/list numeric defaults are not universal Read/Operate hard failures; this does not waive clipping, overlap, unavailable actions, touch-target or measured contrast requirements. Existing regex seeds/levels/exits are not downgraded. **Regex pattern signals are not a WCAG audit** and do not calculate contrast or hit geometry.
- Lines 34–42: decorative bounce/elastic remains banned; inertial spring around damping 0.8 is restricted to actual momentum gestures through the wrapper and continuity evidence. Default no-overshoot damping 1.0 preserved, consistent with `motion.md:110–112`; drawer naming is not approval for generic overshoot. Reduced-motion and existing animation guards remain.
- Lines 49–72: mode assigned per page/surface, not whole product; refinement preserves known identity, redesign requires explicit scope; absent identity is not invented.
- Task-first sequence, fabricated-claim prohibition, functional/onboarding states and temporal evidence remain substantive requirements. before/first/mid/last/settled, interruption/repetition/reduced/offscreen/destroy and paint/frame-time evidence are not replaced with a static screenshot or a green detector.
- Protected source-rights/budget/pilot/owner-acceptance/publication gates remain. No client UI, visual acceptance or runtime motion/a11y claim follows from this policy review.

## Real replay output

Environment: Node `v24.21.0`; Hermes Python executable
`/Users/germanbryzgalov/.hermes/installs/85f1f94234f7e14a/environments/2cb3796150ef4be4b476ddcadb93d64d/venv/bin/python3.14`, actual version `3.14.9`.
All fixtures used `TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch`; Python used `PYTHONDONTWRITEBYTECODE=1`.

`node --test .codex/scripts/test-design-lint.mjs`, exit 0:

```text
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1140.793041
```

`<Hermes Python> -m unittest discover -s .codex/scripts -p test_design_surface.py -v`, exit 0, repeated after disclaimer update:

```text
test_per_page_modes_and_identity_lock (test_design_surface.SurfacePolicyTests.test_per_page_modes_and_identity_lock) ... ok
test_priority_scopes_and_protected_guard_contract (test_design_surface.SurfacePolicyTests.test_priority_scopes_and_protected_guard_contract) ... ok
test_task_first_sequence_and_copy_intents (test_design_surface.SurfacePolicyTests.test_task_first_sequence_and_copy_intents) ... ok
test_temporal_evidence_is_not_static_capture (test_design_surface.SurfacePolicyTests.test_temporal_evidence_is_not_static_capture) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

Independent baseline replay, exact summary outputs:

```text
PUBLISHED_HEAD_OLD37 exit 0
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 930.488375

CURRENT_LINT_OLD37 exit 0
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 931.150417
```

Independent adversarial fixture replay: **72/72 passed**. Matrix: projects/tools × missing-MASTER/unapproved-MASTER/approved-target × Inter/Arial/mixed/repeated names × relative/dot-relative/absolute paths; `.active` and `ACTIVE_PROJECT` both set to foreign approved project. Expected/observed exit 2 for missing/unapproved target; 0 for matching approved target. JSON exitCode matched process status in every case. Existing tests additionally cover prose, Inter Tight, lowercase inter and approved Inter with unapproved Arial.

`git diff --check -- .codex/scripts/design-lint.mjs .codex/scripts/test-design-lint.mjs`: exit 0, empty output.

Python tests are static marker/ordering contracts, not executable proof of routing, UI behavior or visual quality. The implementation report’s earlier RED receipts, 73-test broader suite and mutation receipts were not independently replayed in this bounded review; no inherited claim of those runs is made.

## Separate bounded secrets/security verdict

**PASS — bounded five-file review only.** Zero signature matches in all five reviewed files; full scoped text/context inspected. Checked private-key headers, GitHub tokens, AWS access IDs, OpenAI-style/Slack service tokens, literal credential assignments and credential-bearing HTTP(S) URLs. No new subprocess execution, network path, dynamic evaluation or external side effect is introduced by the production delta; tests use existing isolated CLI fixture mechanics.

Limits: `gitleaks` and `trufflehog` were absent (`which` returned null). This was a local signature/context check, **not a full-repository secrets scanner**, not a Git-history audit, entropy scan, provider validation or revocation test. Unrelated dirty files, routing changes, binary/generated/media payloads and external systems were excluded. Zero findings is not proof that arbitrary secret formats or encoded credentials cannot exist elsewhere.

## Completion / remaining boundary

Bounded code/policy PASS and bounded secrets PASS for the exact hashes above. No confirmed code/policy/security defect left open in this scope. Parent separately owns routing integration, any subsequent revision revalidation and packaging/publication permissions. No persistent file other than this report was created or modified by the reviewer.
