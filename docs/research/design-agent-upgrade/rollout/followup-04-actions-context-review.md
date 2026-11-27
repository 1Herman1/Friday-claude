# F04 Actions context fix — independent admission review

## Outcome / actual identity

**PASS — local source admission only. Actual GitHub/Linux execution remains PENDING.**
No confirmed blocking candidate defect. No required candidate positive failed, no source correction, and no positive was retried for green. One invalid reviewer helper failed and is disclosed below, not hidden as a success.

Reviewer: **Hermes actions-context-independent-review**, this fresh reviewer subagent, independent of the implementer. All five bounded role verdicts are by **this same actual identity**, not five independent agents. Full `.codex/CODEX.md`, review-loop and actual code-reviewer/devops/security-secrets-scanner/qa-engineer/silent-failure-hunter role files were loaded; security anti-patterns including §13 read. Repository-level technical workflow, not a client application; no applicable client security-profile selected. Manifest/workflow/fixture dependency inspection substitutes for stack-specific signatures, not a whole-repository/history audit. No task-gate mutation: reviewer authority permits this report only in the repository.

| Actual bounded role | Verdict | Evidence / limit |
|---|---|---|
| review/code-reviewer | PASS | Full three-file payload and actual base diff read; exact minimal inverse workflow transformation verified. No confirmed logic defect. |
| ops/devops | PASS local; Linux PENDING | Real actionlint1.7.12 schema GREEN, old three expression errors reproduced; actual seven shell bodies parse, actual owned body exports all three values after mkdir. |
| security/security-secrets-scanner | PASS bounded | Complete owned payload and changed lines inspected; credential signatures zero hits; no secret consumer, permission expansion, deploy/provider/auth change. No history/credential-file audit. |
| quality/qa-engineer | PASS local | Fresh clean-export91 Python,8 CI tests,22 mutants, selftest and readonly sync; unchanged JS approval carried only by exact byte aliases. |
| quality/silent-failure-hunter | PASS bounded | No ignored failure, conditional gate, retry, continue-on-error or new masking. Actual Bash fail-closed negative exits1 before sentinel. Helper failure retained. |

## Frozen scope / provenance

Base and observed HEAD: `6c6bf4aec9d2673f0853d229e67b1e993eab898d`. Review is of **only the three manifest files**, not foreign shared-checkout changes. Manifest `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-fix-4ql090am/payload-manifest.json`, SHA256 `ffd0aaf07c4b89812b3298d9e2219987633409ff12106493453e7e609c08e002`.
All source/frozen/worker-clean-export aliases checked before and after review: nine exact SHA256 matches. Full files were read, not merely diff snippets. Actual two-code-file base diff exactly equals worker `owned-delta.patch`; new third file is the implementation report. Readonly Git only: no commit/index/branch/push/dispatch writes.

| Owned path | SHA256 |
|---|---|
| `.github/workflows/design-regression.yml` | `26058a989faac830a35da931951a77a1152f3bfc1b26b62575826dcbb0a1c448` |
| `.codex/scripts/test_design_ci.py` | `ef3441679b58245d0a1c47b02a02b98f688fb083829f1309ca2252bcf5e78820` |
| `docs/research/design-agent-upgrade/rollout/followup-04-actions-context-fix.md` | `b97baa12490036a03276f027a8d0c728b176ce2b617456d32f01ffc08c66fe2f` |

Worker clean-export: every 4550 non-owned preexisting base blob matched actual Git blob bytes; no missing base file; only extra regular file is the owned implementation report. Reviewer execution used a fresh `git archive 6c6bf4aec9d2673f0853d229e67b1e993eab898d` export overlaid with these exact three frozen files at `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`. Foreign dirty selftest/lifecycle/content-parity/client edits were not imported. Candidate is three paths; this review report is separately authored, not silently included in candidate scope.

Exact inverse workflow transformation equals the original base bytes: remove the step env/export and restore the original three job env lines. This proves all pins, permissions, triggers, setup options, original commands and unrelated workflow bytes unchanged. Job env retains only PYTHONDONTWRITEBYTECODE. `runner.temp` now occurs in legal step env, proven by actual schema validation rather than text-check approval alone. Values are the original paths, not recomputed substitutes. The mkdir is the first actual command; printf appends three newline-terminated entries to quoted GITHUB_ENV, before all later consumer steps. Step env is necessary for that same shell; GITHUB_ENV propagates to subsequent steps. No same-step dependence on GITHUB_ENV visibility.

## Execution and RED history

Fresh evidence root: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y`. `receipts.json` contains full argv/cwd/exits and every log path. Python `/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3`3.14.9; explicit PATH `/usr/local/bin:$PATH` resolves Node24.21.0; PYTHONDONTWRITEBYTECODE=1; TMPDIR is Hermes scratch. Bash3.2.57 macOS. Actionlint binary `/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/actionlint/actionlint`1.7.12, go1.26.1 darwin/arm64; no install. Parent archive checksum provenance is carried, not independently re-downloaded. `-shellcheck= -pyflakes=` disables optional shellcheck/pyflakes subprocesses, **not schema/expression checks**; actual Bash validation is separate.

Fresh new regression on old workflow: exit1, runner unavailable assertion. Fresh old actionlint: exit1, exactly three original runner-context errors at31–33. Both use separate `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/red` and preserve old bytes; neither is a required-positive failure. Worker original `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-fix-4ql090am/regression-red.log`, `schema-red.log`, `baseline-workflow.yml` and prior real GitHub run46036428539 remain historical FAIL, not overwritten or relabelled. Run failed before runner creation with zero jobs/logs according to parent's supplied authenticated evidence; no new remote API query or Linux execution here.

Fresh current8-test suite and clean91-test suite pass with nonzero discovery and no skip/failure. Mutation instrumentation records14 original unsafe variants+6 original required-command removals+2 new negatives =22; `mutation-events.json` records each original subtest. New regression checks forbidden context semantically, not merely an updated expected string. Missing export and injected job-level runner are rejected. Ordered exact owned block is also contract-bound. The checker is intentionally bounded text validation, **not** a general YAML parser; real actionlint covers the reviewed workflow schema.

All seven actual extracted run bodies pass bash-n. Actual owned body ran once with runner root containing spaces, isolated HOME, and GITHUB_ENV located inside initially nonexistent TMPDIR. Thus successful append proves mkdir precedes export. Exact three-entry readback is in `export-values.json`; no actual home was written. Subsequent `consumer-protocol` readback parsed the key/value file and injected those values into an isolated child, not a claim to execute the GitHub runner implementation.

## Retained reviewer helper error / no rerun selection

The additional `consumer` helper incorrectly tried `source "$GITHUB_ENV"`. GITHUB_ENV is a runner key/value file, **not a shell program**: unquoted spaces produced `temp: command not found`, exit127. The helper assertion/trace was preserved by the tool and `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/consumer.log` plus receipts. This is a reviewer probe-design error, not candidate runtime failure: the actual workflow never sources that file. No candidate test/schema/export positive was rerun. The different `consumer-protocol` helper parses each line at the first '=' (preserving spaces), passes the mapping to a child environment and prints actual values; exit0. The original exit127 remains in the full ledger/appendix. Expected fail-closed `false` exits1 with no sentinel. No other helper error encountered in this review; initial multi-file tool output truncation was paged back from its saved full output.

## Unchanged JS / production / fixture approval carry

No browser replay, dependency install, provider/auth access or browser window. Prior approval is `docs/research/design-agent-upgrade/rollout/followup-04-queued-independent-review.md`: previous independent Node24 76-test suite and real motion replays, **not fresh executions here**. Actual prior approved tree `853a6d1a777c019a1b4039ff258235b7567c7afd` equals base/candidate/source bytes for16 bounded JS/TS/HTML paths plus both dependency JSONs; full SHA aliases in `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/aliases.json`. Includes runner, observer, regression modules, design-library/lint, production motion.ts and fixture TS/HTML. All other production bytes in the prospective candidate derive directly from the base archive; shared checkout foreign production changes are not claimed unchanged or approved.

- `.codex/scripts/design-library.mjs` — `19589d92ddad4c4414bdbdac875fde0875377c68cab1fb78e3d2c2bab9b5add3`
- `.codex/scripts/design-lint.mjs` — `188f33829ad9ec0982a1f24de172bb9b149605c6073512c5ccba9f156e38b243`
- `.codex/scripts/lib/motion-observation.mjs` — `faa801c586e87bc11d95c139a40ec8d439b9e5ddcf870a1fab0e45c4ade6dd09`
- `.codex/scripts/lib/projects.mjs` — `92b5056f70ddac2c141a04c31e580de1c33753da0f31f4891aeef32ef86726d9`
- `.codex/scripts/rkn-lint.mjs` — `438610854ead085a2285eb1934e203c4814bfa778adaa588e244e72d15fb938c`
- `.codex/scripts/screenshot.mjs` — `11ef2b9872c4bb3a69c5bff5321903dc9babb8dd0149dd4fae4b947102188839`
- `.codex/scripts/selftest.mjs` — `1f60639e1b7fef2edbc8f18d9ce35b91b74698cb77ca956487ea70bd2c36f4ea`
- `.codex/scripts/sync-agent-blocks.mjs` — `94d52736b167b6ad1d34a136a8feaba1e0f5857d015c350bd110864c5e815e62`
- `.codex/scripts/test-design-library.mjs` — `b7dd3c6bdeae03712be881d374e0ad2270da0e58ad1869ebe004ab7974dc45f2`
- `.codex/scripts/test-design-lint.mjs` — `829a68354b59e0ddba300f723b517e1145e0c6495e312b85439ed4e45fc5def8`
- `.codex/scripts/test-motion-dependency-isolation.mjs` — `67ca06ce18c8f07b308ecaa0f80c7132d8b8bbcf5241ba9ac6e5881fedcb8114`
- `.codex/scripts/test-motion-observation.mjs` — `24445c871e48468ad9e3cc875f7117058d5b30301a7f3e765126e960c116fe3f`
- `.codex/scripts/test-motion-template.mjs` — `52978437c7658cf4a31dfc95fa222338b9ff53961f1a846c39cd19ed3cd4d038`
- `docs/core/templates/motion.ts` — `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`
- `docs/research/design-agent-upgrade/rollout/motion-pilot/fixture.html` — `09fb978e1c9a301feb0918750bc62a5e8cab14dff2528f499e625bc1d1b30244`
- `docs/research/design-agent-upgrade/rollout/motion-pilot/fixture.ts` — `f85ef00cb67bad96af7529d63c9c4a8be6cdabad5b99ff9300eccd891fab8d1c`
- `docs/research/design-agent-upgrade/rollout/motion-pilot/dependencies.package.json` — `8e72eaaa77bf5f4bb3afe57795a05a0e5407774fb1778b15c5be0abcf3565de0`
- `docs/research/design-agent-upgrade/rollout/motion-pilot/dependencies.lock.json` — `d5c07cd0ebc685c72ce408abd5d7e085661cbb42596656adaa17097351eb2be5`

Prior local DevOps approval did not discover the expression admission defect; the actual failed GitHub run and old schema RED supersede that part of prior approval. Only unchanged JS/browser source approval is carried, not old workflow admission. Historical motion misses/REQUEST_CHANGES stay true for their own revisions. No claim of zero future misses, Linux success, cross-browser/product/design acceptance or completed rollout.

## Full command ledger and outputs

All command outputs below are complete combined stdout/stderr (empty means no diagnostics), with unmodified exits. Exact argument arrays/cwds are in `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/receipts.json`. Output logs are absolute-path verifiable. Mutation instrumentation output and event JSON are separately preserved. Required future gate: publish exact reviewed bytes through authorized scope-preserving coordinator flow, read back exact commit, then actual GitHub job creation and Linux run result. Any required-positive failure means REQUEST_CHANGES; no rerun-until-green.

### runtime — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", "-c", "import sys,subprocess;print(sys.version);print(subprocess.check_output([\"node\",\"--version\"],text=True))"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/runtime.log`

```text
3.14.9 (main, Oct 21 2026, 17:47:42) [Clang 23.1.3 ]
v24.21.0

```

### ci-eight — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", ".codex/scripts/test_design_ci.py", "-v"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/ci-eight.log`

```text
test_isolated_install_precedes_node_dependency_test (__main__.DesignCIContractTests.test_isolated_install_precedes_node_dependency_test) ... ok
test_rejects_missing_essential_commands (__main__.DesignCIContractTests.test_rejects_missing_essential_commands) ... ok
test_rejects_missing_owned_path_export (__main__.DesignCIContractTests.test_rejects_missing_owned_path_export) ... ok
test_rejects_runner_context_in_job_env (__main__.DesignCIContractTests.test_rejects_runner_context_in_job_env) ... ok
test_rejects_unsafe_mutations (__main__.DesignCIContractTests.test_rejects_unsafe_mutations) ... ok
test_runner_context_is_not_used_in_job_env (__main__.DesignCIContractTests.test_runner_context_is_not_used_in_job_env) ... ok
test_workflow_contract (__main__.DesignCIContractTests.test_workflow_contract) ... ok
test_workflow_exists (__main__.DesignCIContractTests.test_workflow_exists) ... ok

----------------------------------------------------------------------
Ran 8 tests in 0.003s

OK
```

### python-91 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", "-m", "unittest", "discover", "-s", ".codex/scripts", "-p", "test_*.py", "-v"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/python-91.log`

```text
test_isolated_install_precedes_node_dependency_test (test_design_ci.DesignCIContractTests.test_isolated_install_precedes_node_dependency_test) ... ok
test_rejects_missing_essential_commands (test_design_ci.DesignCIContractTests.test_rejects_missing_essential_commands) ... ok
test_rejects_missing_owned_path_export (test_design_ci.DesignCIContractTests.test_rejects_missing_owned_path_export) ... ok
test_rejects_runner_context_in_job_env (test_design_ci.DesignCIContractTests.test_rejects_runner_context_in_job_env) ... ok
test_rejects_unsafe_mutations (test_design_ci.DesignCIContractTests.test_rejects_unsafe_mutations) ... ok
test_runner_context_is_not_used_in_job_env (test_design_ci.DesignCIContractTests.test_runner_context_is_not_used_in_job_env) ... ok
test_workflow_contract (test_design_ci.DesignCIContractTests.test_workflow_contract) ... ok
test_workflow_exists (test_design_ci.DesignCIContractTests.test_workflow_exists) ... ok
test_core_authority_and_existing_reference_contract_remain_present (test_design_routing.DesignRoutingTests.test_core_authority_and_existing_reference_contract_remain_present) ... ok
test_design_system_command_and_invoked_skill_discover_catalogue (test_design_routing.DesignRoutingTests.test_design_system_command_and_invoked_skill_discover_catalogue) ... ok
test_main_entrypoint_exposes_full_catalogues_and_readonly_lookup (test_design_routing.DesignRoutingTests.test_main_entrypoint_exposes_full_catalogues_and_readonly_lookup) ... ok
test_taste_role_and_registered_payload_route_to_same_library (test_design_routing.DesignRoutingTests.test_taste_role_and_registered_payload_route_to_same_library) ... ok
test_per_page_modes_and_identity_lock (test_design_surface.SurfacePolicyTests.test_per_page_modes_and_identity_lock) ... ok
test_priority_scopes_and_protected_guard_contract (test_design_surface.SurfacePolicyTests.test_priority_scopes_and_protected_guard_contract) ... ok
test_task_first_sequence_and_copy_intents (test_design_surface.SurfacePolicyTests.test_task_first_sequence_and_copy_intents) ... ok
test_temporal_evidence_is_not_static_capture (test_design_surface.SurfacePolicyTests.test_temporal_evidence_is_not_static_capture) ... ok
test_deletions_and_unreachable_markers_are_rejected (test_feature_migration.FeatureMigrationTests.test_deletions_and_unreachable_markers_are_rejected) ... ok
test_feature_receipt_matches_frozen_source (test_feature_migration.FeatureMigrationTests.test_feature_receipt_matches_frozen_source) ... ok
test_hash_mutation_is_detected (test_feature_migration.FeatureMigrationTests.test_hash_mutation_is_detected) ... ok
test_invoked_feature_preserves_source_obligations (test_feature_migration.FeatureMigrationTests.test_invoked_feature_preserves_source_obligations) ... ok
test_fixture_false_cannot_bypass_real_checks_even_with_dry_run (test_handoff_publication.HandoffPublicationTests.test_fixture_false_cannot_bypass_real_checks_even_with_dry_run) ... ok
test_mandatory_consumers_resolve_contract (test_handoff_publication.HandoffPublicationTests.test_mandatory_consumers_resolve_contract) ... ok
test_media_selector_metadata_matches_conditional_execution_route (test_handoff_publication.HandoffPublicationTests.test_media_selector_metadata_matches_conditional_execution_route) ... ok
test_offline_fixture_still_enforces_rights_pilot_and_publication_gates (test_handoff_publication.HandoffPublicationTests.test_offline_fixture_still_enforces_rights_pilot_and_publication_gates) ... ok
test_published_template_dry_run_is_offline_and_valid (test_handoff_publication.HandoffPublicationTests.test_published_template_dry_run_is_offline_and_valid) ... ok
test_synthetic_template_is_rejected_as_real_handoff (test_handoff_publication.HandoffPublicationTests.test_synthetic_template_is_rejected_as_real_handoff) ... ok
test_validator_and_adopted_tests_have_stdlib_import_closure (test_handoff_publication.HandoffPublicationTests.test_validator_and_adopted_tests_have_stdlib_import_closure) ... ok
test_committed_work_survives_without_intermediate_stop (test_lifecycle.GitLifecycleTests.test_committed_work_survives_without_intermediate_stop) ... ok
test_deleted_and_untracked_paths_are_remembered (test_lifecycle.GitLifecycleTests.test_deleted_and_untracked_paths_are_remembered) ... ok
test_failed_lint_is_retried (test_lifecycle.GitLifecycleTests.test_failed_lint_is_retried) ... ok
test_first_commit_of_unborn_repository_survives (test_lifecycle.GitLifecycleTests.test_first_commit_of_unborn_repository_survives) ... ok
test_parallel_parent_session_hooks_leave_valid_files (test_lifecycle.GitLifecycleTests.test_parallel_parent_session_hooks_leave_valid_files) ... ok
test_repeated_flush_preserves_agent_notes_and_deduplicates_facts (test_lifecycle.GitLifecycleTests.test_repeated_flush_preserves_agent_notes_and_deduplicates_facts) ... ok
test_shell_created_ui_and_journal_are_detected (test_lifecycle.GitLifecycleTests.test_shell_created_ui_and_journal_are_detected) ... ok
test_startup_preserves_context_tail (test_lifecycle.GitLifecycleTests.test_startup_preserves_context_tail) ... ok
test_unicode_spaces_and_newline_paths_are_not_quoted_or_dropped (test_lifecycle.GitLifecycleTests.test_unicode_spaces_and_newline_paths_are_not_quoted_or_dropped) ... ok
test_apply_patch_detects_ui_file_and_hash (test_lifecycle.LifecycleTests.test_apply_patch_detects_ui_file_and_hash) ... ok
test_archive_never_copies_messages_or_secrets (test_lifecycle.LifecycleTests.test_archive_never_copies_messages_or_secrets) ... ok
test_branch_warning_is_visible (test_lifecycle.LifecycleTests.test_branch_warning_is_visible) ... ok
test_empty_change_list_creates_no_archive (test_lifecycle.LifecycleTests.test_empty_change_list_creates_no_archive) ... ok
test_external_file_is_not_linted (test_lifecycle.LifecycleTests.test_external_file_is_not_linted) ... ok
test_fixture_root_is_canonical_like_production (test_lifecycle.LifecycleTests.test_fixture_root_is_canonical_like_production) ... ok
test_session_id_cannot_escape_runtime_folder (test_lifecycle.LifecycleTests.test_session_id_cannot_escape_runtime_folder) ... ok
test_startup_loads_context_and_name (test_lifecycle.LifecycleTests.test_startup_loads_context_and_name) ... ok
test_startup_preserves_current_owner_policy (test_lifecycle.LifecycleTests.test_startup_preserves_current_owner_policy) ... ok
test_stop_does_not_dirty_tracked_session_notes (test_lifecycle.LifecycleTests.test_stop_does_not_dirty_tracked_session_notes) ... ok
test_cli_fixture_requires_explicit_dry_run (test_media_handoff.HandoffTests.test_cli_fixture_requires_explicit_dry_run) ... ok
test_codex_config_loads_synchronized_design_roles (test_media_handoff.HandoffTests.test_codex_config_loads_synchronized_design_roles) ... ok
test_dropped_native_ref_and_transfer (test_media_handoff.HandoffTests.test_dropped_native_ref_and_transfer) ... ok
test_fixture_cannot_pass_real_mode (test_media_handoff.HandoffTests.test_fixture_cannot_pass_real_mode) ... ok
test_gate_failures (test_media_handoff.HandoffTests.test_gate_failures) ... ok
test_invalid_structure (test_media_handoff.HandoffTests.test_invalid_structure) ... ok
test_null_sku_requires_matching_identifier_type_and_value (test_media_handoff.HandoffTests.test_null_sku_requires_matching_identifier_type_and_value) ... ok
test_null_sku_uses_verified_stable_identity (test_media_handoff.HandoffTests.test_null_sku_uses_verified_stable_identity) ... ok
test_positive_synthetic_dry_run (test_media_handoff.HandoffTests.test_positive_synthetic_dry_run) ... ok
test_ready_before_native_call (test_media_handoff.HandoffTests.test_ready_before_native_call) ... ok
test_reference_only_research_has_no_ai_transfer (test_media_handoff.HandoffTests.test_reference_only_research_has_no_ai_transfer) ... ok
test_required_roles_and_rights (test_media_handoff.HandoffTests.test_required_roles_and_rights) ... ok
test_published_codex_remains_authoritative_for_conditional_address (test_published_owner_policy.PublishedOwnerPolicyTests.test_published_codex_remains_authoritative_for_conditional_address) ... ok
test_published_config_has_complete_owner_policy (test_published_owner_policy.PublishedOwnerPolicyTests.test_published_config_has_complete_owner_policy) ... ok
test_startup_emits_complete_policy_and_keeps_context_contract (test_published_owner_policy.PublishedOwnerPolicyTests.test_startup_emits_complete_policy_and_keeps_context_contract) ... ok
test_actual_consumers_read_policy_before_style_choice (test_surface_routing.SurfaceRoutingTests.test_actual_consumers_read_policy_before_style_choice) ... ok
test_policy_not_misrepresented_as_new_commands_or_runtime (test_surface_routing.SurfaceRoutingTests.test_policy_not_misrepresented_as_new_commands_or_runtime) ... ok
test_registered_role_has_exact_markdown_body_and_policy_route (test_surface_routing.SurfaceRoutingTests.test_registered_role_has_exact_markdown_body_and_policy_route) ... ok
test_blank_reviewer_identity_rejected (test_task_gate.TaskGateTests.test_blank_reviewer_identity_rejected) ... ok
test_cannot_replace_active_task_with_new_task (test_task_gate.TaskGateTests.test_cannot_replace_active_task_with_new_task) ... ok
test_change_invalidates_old_evidence (test_task_gate.TaskGateTests.test_change_invalidates_old_evidence) ... ok
test_changed_hidden_index_invalidates_revision (test_task_gate.TaskGateTests.test_changed_hidden_index_invalidates_revision) ... ok
test_commit_of_same_reviewed_content_preserves_pass (test_task_gate.TaskGateTests.test_commit_of_same_reviewed_content_preserves_pass) ... ok
test_complete_task_becomes_incomplete_after_new_edit (test_task_gate.TaskGateTests.test_complete_task_becomes_incomplete_after_new_edit) ... ok
test_current_verified_task_passes (test_task_gate.TaskGateTests.test_current_verified_task_passes) ... ok
test_duplicate_init_does_not_erase_previous_task (test_task_gate.TaskGateTests.test_duplicate_init_does_not_erase_previous_task) ... ok
test_empty_task_cannot_pass (test_task_gate.TaskGateTests.test_empty_task_cannot_pass) ... ok
test_every_command_has_semantic_steps (test_task_gate.TaskGateTests.test_every_command_has_semantic_steps) ... ok
test_executable_mode_change_invalidates_revision (test_task_gate.TaskGateTests.test_executable_mode_change_invalidates_revision) ... ok
test_explicit_external_blocker_can_be_reported (test_task_gate.TaskGateTests.test_explicit_external_blocker_can_be_reported) ... ok
test_explicit_scope_excludes_independent_neighbor (test_task_gate.TaskGateTests.test_explicit_scope_excludes_independent_neighbor) ... ok
test_finding_blocks_even_with_pass_label (test_task_gate.TaskGateTests.test_finding_blocks_even_with_pass_label) ... ok
test_hidden_staged_version_cannot_pass (test_task_gate.TaskGateTests.test_hidden_staged_version_cannot_pass) ... ok
test_native_leaf_roles_do_not_inherit_recursive_delegation (test_task_gate.TaskGateTests.test_native_leaf_roles_do_not_inherit_recursive_delegation) ... ok
test_new_repository_first_commit_is_in_scope (test_task_gate.TaskGateTests.test_new_repository_first_commit_is_in_scope) ... ok
test_react_rules_do_not_assert_false_positives (test_task_gate.TaskGateTests.test_react_rules_do_not_assert_false_positives) ... ok
test_review_rerun_can_close_finding (test_task_gate.TaskGateTests.test_review_rerun_can_close_finding) ... ok
test_routine_label_cannot_bypass_critical_roles (test_task_gate.TaskGateTests.test_routine_label_cannot_bypass_critical_roles) ... ok
test_routing_covers_python_shell_and_reviewer_of_secrets (test_task_gate.TaskGateTests.test_routing_covers_python_shell_and_reviewer_of_secrets) ... ok
test_same_person_cannot_self_approve (test_task_gate.TaskGateTests.test_same_person_cannot_self_approve) ... ok
test_scope_includes_index_untracked_deleted_and_committed (test_task_gate.TaskGateTests.test_scope_includes_index_untracked_deleted_and_committed) ... ok
test_skipped_required_test_is_not_success (test_task_gate.TaskGateTests.test_skipped_required_test_is_not_success) ... ok
test_staged_deletion_with_untracked_replacement_is_blocked (test_task_gate.TaskGateTests.test_staged_deletion_with_untracked_replacement_is_blocked) ... ok
test_stop_continues_incomplete_owner_task (test_task_gate.TaskGateTests.test_stop_continues_incomplete_owner_task) ... ok
test_stop_does_not_block_other_session_or_subagent (test_task_gate.TaskGateTests.test_stop_does_not_block_other_session_or_subagent) ... ok

----------------------------------------------------------------------
Ran 91 tests in 13.309s

OK
```

### selftest — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", ".codex/scripts/selftest.py"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/selftest.log`

```text
PASS: 45 original roles + codex-docs; 22 skills; 5 lifecycle events; 3 MCP configs
PASS: 90 source mappings, source freshness reviewed, native prompt sync, TOML/JSON and script syntax
```

### sync — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", ".codex/scripts/sync-roles.py"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/sync.log`

```text
Drift: none
```

### actionlint-version — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/actionlint/actionlint", "-version"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/actionlint-version.log`

```text
1.7.12
installed by downloading from release page
built with go1.26.1 compiler for darwin/arm64
```

### schema — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/actionlint/actionlint", "-shellcheck=", "-pyflakes=", ".github/workflows/design-regression.yml"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/schema.log`

```text
```

### regression-red — exit 1

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/red`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", ".codex/scripts/test_design_ci.py", "DesignCIContractTests.test_runner_context_is_not_used_in_job_env", "-v"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/regression-red.log`

```text
test_runner_context_is_not_used_in_job_env (__main__.DesignCIContractTests.test_runner_context_is_not_used_in_job_env) ... FAIL

======================================================================
FAIL: test_runner_context_is_not_used_in_job_env (__main__.DesignCIContractTests.test_runner_context_is_not_used_in_job_env)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/red/.codex/scripts/test_design_ci.py", line 116, in test_runner_context_is_not_used_in_job_env
    self.assertNotRegex(job_env.group(1), r'\$\{\{\s*runner\s*[.\[]',
    ~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                        'runner context is unavailable in jobs.<job_id>.env')
                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex matched: '${{ runner.' matches '\\$\\{\\{\\s*runner\\s*[.\\[]' in "      PYTHONDONTWRITEBYTECODE: '1'\n      TMPDIR: ${{ runner.temp }}/design-ci-owned\n      MOTION_DEPS: ${{ runner.temp }}/design-ci-owned/motion-deps\n      PLAYWRIGHT_BROWSERS_PATH: ${{ runner.temp }}/design-ci-owned/browsers\n" : runner context is unavailable in jobs.<job_id>.env

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

### schema-red — exit 1

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/red`

Argv: `["/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/queued-final/actionlint/actionlint", "-shellcheck=", "-pyflakes=", ".github/workflows/design-regression.yml"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/schema-red.log`

```text
.github/workflows/design-regression.yml:31:19: context "runner" is not allowed here. available contexts are "github", "inputs", "matrix", "needs", "secrets", "strategy", "vars". see https://docs.github.com/en/actions/learn-github-actions/contexts#context-availability for more details [expression]
   |
31 |       TMPDIR: ${{ runner.temp }}/design-ci-owned
   |                   ^~~~~~~~~~~
.github/workflows/design-regression.yml:32:24: context "runner" is not allowed here. available contexts are "github", "inputs", "matrix", "needs", "secrets", "strategy", "vars". see https://docs.github.com/en/actions/learn-github-actions/contexts#context-availability for more details [expression]
   |
32 |       MOTION_DEPS: ${{ runner.temp }}/design-ci-owned/motion-deps
   |                        ^~~~~~~~~~~
.github/workflows/design-regression.yml:33:37: context "runner" is not allowed here. available contexts are "github", "inputs", "matrix", "needs", "secrets", "strategy", "vars". see https://docs.github.com/en/actions/learn-github-actions/contexts#context-availability for more details [expression]
   |
33 |       PLAYWRIGHT_BROWSERS_PATH: ${{ runner.temp }}/design-ci-owned/browsers
   |                                     ^~~~~~~~~~~
```

### bash-n-00 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-00.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-00.log`

```text
```

### bash-n-01 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-01.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-01.log`

```text
```

### bash-n-02 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-02.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-02.log`

```text
```

### bash-n-03 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-03.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-03.log`

```text
```

### bash-n-04 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-04.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-04.log`

```text
```

### bash-n-05 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-05.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-05.log`

```text
```

### bash-n-06 — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "-n", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-06.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-n-06.log`

```text
```

### owned-runtime — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/run-00.sh"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/owned-runtime.log`

```text
```

### consumer — exit 127

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", "set -a; source \"$1\"; env | sort", "consumer", "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/runner temp with spaces/design-ci-owned/github-env"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/consumer.log`

```text
/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/runner temp with spaces/design-ci-owned/github-env: line 1: temp: command not found
```

### consumer-protocol — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["/Users/germanbryzgalov/.hermes/tools/python-3.14.9+20261021-darwin-arm64/bin/python3", "-c", "import os,json;print(json.dumps({k:os.environ[k] for k in (\"TMPDIR\",\"MOTION_DEPS\",\"PLAYWRIGHT_BROWSERS_PATH\")},sort_keys=True))"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/consumer-protocol.log`

```text
{"MOTION_DEPS": "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/runner temp with spaces/design-ci-owned/motion-deps", "PLAYWRIGHT_BROWSERS_PATH": "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/runner temp with spaces/design-ci-owned/browsers", "TMPDIR": "/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/runner temp with spaces/design-ci-owned"}
```

### bash-version — exit 0

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "--version"]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/bash-version.log`

```text
GNU bash, version 3.2.57(1)-release (arm64-apple-darwin24)
Copyright (C) 2007 Free Software Foundation, Inc.
```

### fail-closed — exit 1

Cwd: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/export`

Argv: `["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", "false; printf \"UNREACHABLE\\n\""]`

Full log: `/Users/germanbryzgalov/.hermes/cache/scratch/actions-context-independent-9iiw0p_y/fail-closed.log`

```text
```

### Mutation instrumentation

```text
test_rejects_unsafe_mutations (review_ci.DesignCIContractTests.test_rejects_unsafe_mutations) ... ok
test_rejects_missing_essential_commands (review_ci.DesignCIContractTests.test_rejects_missing_essential_commands) ... ok
test_rejects_runner_context_in_job_env (review_ci.DesignCIContractTests.test_rejects_runner_context_in_job_env) ... ok
test_rejects_missing_owned_path_export (review_ci.DesignCIContractTests.test_rejects_missing_owned_path_export) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.004s

OK
```

Only repository file created by this reviewer: `docs/research/design-agent-upgrade/rollout/followup-04-actions-context-review.md`. Scratch export, scripts, raw outputs, receipts and aliases are under the evidence root above. No candidate or foreign source edited.
