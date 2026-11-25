# Stage 03 — pinned Taste positive catalog

Status: **READY for parent review/integration; NOT routed or installed.**

## Delivered scope

Only new paths:

- `docs/core/design-library/INDEX.md` — four explicit per-item sections, computed counts, actual IDs, names/derived labels, applicability/notes and anchored links to complete records.
- `docs/core/design-library/raw/{palettes,typography,heroes,diagrams}.json` — byte-for-byte copies of four source data files, including metadata and every nested record field.
- `docs/core/design-library/records/{palettes,typography,heroes,diagrams}.md` — full JSON records grouped into four readable, anchored family documents. Dictionary-key IDs are not injected into diagram record objects.
- `docs/core/design-library/manifest.json`, `LICENSE`, `receipts/*` — source provenance, full MIT notice and execution evidence.
- `.codex/scripts/design-library.mjs` — local read-only Node ESM lookup, standard library only.
- `.codex/scripts/test-design-library.mjs` — executable Node test suite, temporary mutation fixtures isolated under `$TMPDIR`.
- `rollout/stage-03-library.md` — this handoff.

No CODEX, roles/TOML registrations, skills, commands, config, package files, project files or `.active` changed by this scope. No Git writes, commit, install, upstream script execution, hooks, sync, external calls, renderer/runtime, image/icon/font binaries. Existing unrelated dirty work was left alone; branch remains `claude/greeting-nnz368`.

## Provenance and content parity

Source: `https://github.com/Leonxlnx/taste-skill.git`, pinned commit `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`; snapshot supplied at `$HOME/.hermes/cache/scratch/design-deep-audit/taste`.

| Family | Records | Source path | SHA-256 of complete raw file |
| --- | ---: | --- | --- |
| palettes | 64 | `skills/taste-skill/library/palettes.json` | `96d594648249b2dff17addcd0e2965b0eee0cf2815ae68542add82a87d856d6d` |
| typography | 39 | `skills/taste-skill/library/type.json` | `144be2adc366028ec2d380782e9150436f6bf5f1e4177159674c84435250d830` |
| heroes | 11 | `skills/taste-skill/assets/layout/heroes.json` | `ec31203b4857901641dc2c8229ab52bb3dcebd7cadeb9619939a49e76061523e` |
| diagrams | 27 | `skills/taste-skill/assets/diagrams/presets.json` | `76ef630a24fd63143d6e70329ab1698606357c0999446b1868bff08e929a30aa` |

Total computed from the manifest: **141**. Every raw file and LICENSE also compared byte-for-byte with `git show <pinned-SHA>:<source-path>` (read-only), not only the snapshot working tree. MIT notice preserved in full: Copyright (c) 2026 Leonxlnx. Third-party photographs, icons and font binaries are not included or relicensed. String references to them and to upstream commands remain data, never executable instructions.

Catalog choices are optional proposals subordinate to project brand, `design-system/MASTER.md` and approved page overrides. Raw house policies do not become global instructions. Font subset/Cyrillic support, asset availability/rights and brand suitability still require project-specific verification.

## CLI contract

```sh
node .codex/scripts/design-library.mjs summary
node .codex/scripts/design-library.mjs list palettes
node .codex/scripts/design-library.mjs get typography instrument-serif
node .codex/scripts/design-library.mjs get heroes split
node .codex/scripts/design-library.mjs get diagrams hub-tools
```

Exact families: `palettes`, `typography`, `heroes`, `diagrams`. Explicit command and exact arity required; no default/random/deal selection. Works independently of cwd, with catalog root resolved from the script location.

- Success: exit 0, JSON stdout, empty stderr.
- `summary`: `{counts:{palettes:64,typography:39,heroes:11,diagrams:27}}`.
- `list`: `{family,records:[{id,name,notes}]}` in original source order.
- `get`: `{family,id,record}` with all original fields, including nested structures.
- Error: exit 1, empty stdout, JSON stderr `{ok:false,error:{code,message}}`.
- Codes: `USAGE`, `UNKNOWN_FAMILY`, `UNKNOWN_ID`, `READ_ERROR`, `PARSE_ERROR`, `SCHEMA_ERROR`, `INTEGRITY_ERROR`.
- Schema/collection/record boundary checks, IDs/count parity and whole-raw SHA-256 validation. Manifest source commit, source paths, counts, hash pins and local paths are checked. User family cannot become a filesystem path; ID lookup uses explicit pairs, not inherited object properties.
- Summary validates all families; list/get read the selected family and the manifest. No filesystem writes or subprocesses in the CLI.

## TDD evidence and final checks

Twelve vertical RED→GREEN slices saved under `docs/core/design-library/receipts/`:

1. summary (first RED: CLI missing; first GREEN: real imported counts);
2. provenance manifest and full MIT notice;
3. list actual ID sets;
4. get all complete records;
5. unknown/traversal family and ID diagnostics;
6. exact command/arity, no implicit random;
7. read errors;
8. JSON parse errors;
9. schema errors;
10. pinned raw-byte integrity;
11. malformed/unpinned/traversal manifest rejection;
12. counted INDEX and complete linked record parity.

Receipts `01-*` through `12-*` preserve the observed failure and success output. The first RED uses Node's original default reporter; subsequent receipts use TAP. `13-readonly-regression-green.tap` adds checks of already-implemented behavior (no new implementation): execution with Node filesystem-write/child-process permissions denied, cwd independence, deterministic output, unchanged file hashes/modes/mtimes, real duplicate IDs/ID drift and changed nested fields.

Executed on Node `v24.21.0`:

```sh
TASTE_SOURCE="$HOME/.hermes/cache/scratch/design-deep-audit/taste" \
  node --test --test-reporter=tap .codex/scripts/test-design-library.mjs
```

Observed result: **14 tests, 14 pass, 0 fail, 0 skipped**. The exhaustive retrieval test runs a real CLI subprocess for each of 141 records; full-record Markdown parity is checked for all 141 too. Imported bytes and MIT license match both source snapshot and pinned Git objects. Read/schema/malformed/integrity cases mutate only scratch copies; shared paths remain read-only.

## Parent handoff / limits

Implementation scope is ready for independent review. Self-check is not an independent review verdict. Parent owns review, task-gate/routing integration and any subsequent CODEX / taste-curator registration / design-system skill edits. Those integrations have **not** been performed here. No upstream runtime or assets are provided; this is a data catalog and lookup only. No open implementation blocker found.
