# Stage 03 — independent QA / code review

**Verdict: PASS — local library + read-only lookup CLI + instruction routing.**

Reviewer: independent Hermes leaf subagent, adapted `qa-engineer` + `code-reviewer`; no delegation. Repository: `/Users/germanbryzgalov/Friday-claude`. Scope/revision is identified by the SHA-256 table below, not an assumed clean Git checkout. No Git command, network, generation, client source edit or visible browser was used. Only this report was written in the shared repository; corruptions/mutations were confined to isolated scratch copies.

## Results

- Independently executed **14/14 Node tests PASS**, zero failures/skips, with actual `TASTE_SOURCE=/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/taste`. Node v26.12.1, Python 3.14.9. Snapshot `.git/HEAD` contains `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`; no remote provenance refresh was attempted.
- Independently executed **4/4 Python routing tests PASS**. Parsed actual `.codex/config.toml`: registered `taste-curator.config_file` resolves to `agents/taste-curator.toml`; TOML developer payload equals the complete Markdown role body. This is on-disk routing evidence, not native Codex reload evidence.
- Read implementation, inline schema checks, all 14 tests, routing tests, manifest and full MIT notice. Independently parsed all four raw collections and all JSON blocks in all four complete-record documents, comparing every nested field, not a sample. **141 INDEX rows / 141 unique source IDs / 141 exact complete records**, split 64 palettes, 39 typography, 11 heroes, 27 diagrams. Tests exercised `get` for every record and `list` for every family. Independent document comparisons preserved dictionary-key identity for diagrams without injecting an `id` field.
- Four complete raw files match the actual pinned snapshot byte-for-byte and all manifest SHA-256 pins; full local LICENSE matches snapshot byte-for-byte, SHA-256 `4575a543ab88dad12ccea7d97e563d0bce5b448b06072e65d3264497dad326df`. Copyright and complete MIT grant/disclaimer preserved. No imported font binaries, photos, icons, runtime or promised availability of those assets.
- Implementation has only `node:fs`, `node:crypto`, `node:url` imports. Family allowlist determines fixed paths; IDs are exact lookup keys, never paths. No fetch, installation, random choice, child execution or write API. Manifest paths/commit/source/hash/count/ID set and raw integrity fail closed. Schema checks are structural/minimal, not a universal JSON Schema for future sources; fixed byte pins reject other nested changes.

## Negative / isolation checks

The 14-test suite actually exercised unknown/traversal families and IDs; exact command arity; missing files/directories; malformed JSON; invalid roots/collections/fields; duplicates and ID drift; nested mutation; raw-byte mutation; malformed/missing/tampered manifest, including path traversal and unpinned commit. Expected structured stderr codes, empty stdout and nonzero exit were verified.

Additional independent probes (all exit 1, empty stdout, parseable JSON error):
- `["get", "palettes", "../../../../etc/passwd"]` → `UNKNOWN_ID`.
- `["get", "palettes", "%2e%2e%2fetc%2fpasswd"]` → `UNKNOWN_ID`.
- `["get", "palettes", "white-link-blue\n"]` → `UNKNOWN_ID`.
- `["get", "palettes", "WHITE-LINK-BLUE"]` → `UNKNOWN_ID`.
- `["get", "palettes", "toString"]` → `UNKNOWN_ID`.
- `["list", "../raw/palettes"]` → `UNKNOWN_FAMILY`.
- `["list", "/etc/passwd"]` → `UNKNOWN_FAMILY`.
- `["list", "__proto__"]` → `UNKNOWN_FAMILY`.
- `["summary"]` → `PARSE_ERROR`.
- `["summary"]` → `INTEGRITY_ERROR`.
- `["summary"]` → `READ_ERROR`.

Independent read-only fixture: all directories 0555/files 0444; executed summary, typography list, retired editorial hero get and hub-tools diagram get from an unrelated cwd under `node --permission --allow-fs-read=<fixture>`, without fs-write or child-process permission. All four exit 0; entire fixture file hashes, modes and mtimes unchanged. Negative controls actually attempting fs write and child spawn both exit 1 with `ERR_ACCESS_DENIED`: permission enforcement was tested, not inferred. Existing suite additionally checks repeat-output determinism and mutation snapshots.

Routing removal mutations, each on a fresh scratch copy, removing the INDEX reference independently:

| Target | Routing suite result |
| --- | --- |
| `.codex/CODEX.md` | exit 1, failures=1 (expected failure) |
| `.codex/agents/design/taste-curator.md` | exit 1, failures=1 (expected failure) |
| `.codex/agents/taste-curator.toml` | exit 1, failures=1 (expected failure) |
| `.codex/commands/design-system.md` | exit 1, failures=1 (expected failure) |
| `.codex/skills/design-system/SKILL.md` | exit 1, failures=1 (expected failure) |

All five removals are detected; main CODEX, Markdown role, registered TOML payload, command and invoked SKILL are not untested decorative links. Scratch root: `/Users/germanbryzgalov/.hermes/cache/scratch/stage03-independent-fs3fqyfy`.

## Relevance / semantics

- **Brand authority retained:** INDEX:3 explicitly subordinates suggestions to brand/approved MASTER/page overrides and treats upstream `about`, `mistakes`, `note` as data. CODEX:387–406 routes all four families without creating new roles or overriding budget, rights, a11y and reference-handoff. Command/SKILL require context first and prohibit overwriting an existing MASTER without a separate decision.
- **House presets are not mandatory policy:** retained raw heroes metadata mentions random `deal.mjs`, exactly-one-screen `100svh`, external assets and old house rules; these are quoted source data only, not commands to execute. Command and SKILL explicitly say hero selection depends on actual content/materials, not mandatory 100svh. Raw `heroes.editorial.job` remains explicitly `RETIRED, never dealt`; catalogue completeness does not require selecting it or activating its retirement as a global Friday ban. No sampler/runtime is installed by lookup.
- **Demo claims are not client facts:** CODEX says diagram labels, numbers and relationships need real data; command/SKILL require replacing all demo labels/numbers/claims; taste role explicitly forbids treating demo claims as facts.
- **RU/fonts/rights remain unverified until checked:** CODEX explicitly says typography record does not prove Cyrillic coverage or font-binary licensing; command/SKILL retain mandatory Cyrillic checks plus weights/fallback/rights; INDEX states assets were not imported/relicensed. No claims of complete RU coverage, available assets or usable client rights were added.
- **Completeness is source fidelity, not invented defaults:** the full-record equality checks found no dropped fields, ellipses or invented asset fields. There are original empty/null values: typography instrument-sans `kinds={}` / `display.letters=null`, instrument-serif `display.s=[]` / `display.letters=null`, zilla `display.letters=null`; some hero `moments`/`effects` arrays are empty. All are exact upstream values, not unfinished imported records. They must not be rewritten as verified capability or filled with invented data.

## Findings / limitations

No blocking implementation, integrity, traversal, read-only or routing defect reproduced. **No REQUEST_CHANGES findings.**

Informational historical status: `docs/core/design-library/INDEX.md:31` says READY for parent integration / not routed. That is the library handoff's original scope, not the current parent integration state: current CODEX + role/TOML + command/SKILL routes are present and independently tested above. Do not cite that old status as proof either of missing routes or of installation/reload. Coordinator can clarify the wording at final integration; this review did not edit it.

**Limits:** not native Codex reload/agent-dispatch verification; not visual acceptance, owner design acceptance or a browser client audit. No proof of remote source authenticity beyond supplied local snapshot/commit and byte pins; no font-binary, Cyrillic-glyph, third-party rights or external asset readiness verification. No claim that broader 51 Node / 69 Python parent suites were rerun by this leaf: this independent run is 14 + 4 only. Routing preservation receipt was read, but historical before/after preservation was not reconstructed with Git here. PASS applies only to the exact hashed files below; subsequent changes require affected rechecks.

## Reproduction

```sh
TASTE_SOURCE="$HOME/.hermes/cache/scratch/design-deep-audit/taste" node --test .codex/scripts/test-design-library.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -B .codex/scripts/test_design_routing.py -v
```

Both were actually run with TMPDIR under `~/.hermes/cache/scratch/`.

### Actual Node output

```text
✔ summary reports all pinned family counts (28.934125ms)
✔ manifest pins every raw byte, source path, ID and full MIT notice (2.745042ms)
✔ get retrieves every complete record without adding or dropping source fields (3300.900542ms)
✔ unknown and traversal families and IDs fail with JSON diagnostics (446.943291ms)
✔ arguments require explicit summary/list/get with exact arity; no random fallback (199.67225ms)
✔ missing and unreadable-as-file data produce JSON READ_ERROR (47.826ms)
✔ malformed JSON produces a machine-readable PARSE_ERROR (24.174959ms)
✔ wrong roots, collections, record fields and duplicate IDs produce SCHEMA_ERROR (489.135833ms)
✔ lookup rejects changed complete records or bytes against provenance hashes (108.890958ms)
✔ manifest errors fail closed without accepting path traversal or unpinned sources (276.950167ms)
✔ INDEX enumerates every ID and links to an exact complete record in four counted sections (4.695625ms)
✔ CLI runs with filesystem writes and child processes forbidden, independent of cwd (146.8465ms)
✔ real duplicate IDs, ID drift, and changed nested fields are rejected (73.052708ms)
✔ list exposes the exact pinned IDs with useful record descriptors (92.675125ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5278.649292
```

### Actual Python output

```text
test_core_authority_and_media_gates_remain_present (__main__.DesignRoutingTests.test_core_authority_and_media_gates_remain_present) ... ok
test_design_system_command_and_invoked_skill_discover_catalogue (__main__.DesignRoutingTests.test_design_system_command_and_invoked_skill_discover_catalogue) ... ok
test_main_entrypoint_exposes_full_catalogues_and_readonly_lookup (__main__.DesignRoutingTests.test_main_entrypoint_exposes_full_catalogues_and_readonly_lookup) ... ok
test_taste_role_and_registered_payload_route_to_same_library (__main__.DesignRoutingTests.test_taste_role_and_registered_payload_route_to_same_library) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

## SHA-256 reviewed revision

| File | SHA-256 |
| --- | --- |
| `.codex/scripts/design-library.mjs` | `19589d92ddad4c4414bdbdac875fde0875377c68cab1fb78e3d2c2bab9b5add3` |
| `.codex/scripts/test-design-library.mjs` | `b7dd3c6bdeae03712be881d374e0ad2270da0e58ad1869ebe004ab7974dc45f2` |
| `.codex/scripts/test_design_routing.py` | `d17a95fb4d4cc717fb83d3f32ad24b632226e90cd8393ee514f73e97cb6e2c5a` |
| `.codex/CODEX.md` | `aa968e63a56935b0302318229244412e3345cf5ce1918f97f83a07ff6c736a4c` |
| `.codex/agents/design/taste-curator.md` | `39e6fde69b6d23107f588babcd09eb82f12f8347478b861e6a900454833756aa` |
| `.codex/agents/taste-curator.toml` | `a46ffedcffe83c44f0d551542ee79d800eb1be761e53d9165270b54e56c2aff7` |
| `.codex/commands/design-system.md` | `f75fadb6ae80dbe762f9955b22d7ad6c359f5b0a79155199a23889492ebac9bd` |
| `.codex/skills/design-system/SKILL.md` | `31cb027960a4175d8cff1014de81d78859e40b7b7232c433f1a8e2c72b5470de` |
| `.codex/config.toml` | `842bfecba4f3436b48ec04b78ec3c7c3f31710fedc3026404a009a7d1c897374` |
| `docs/core/design-library/manifest.json` | `f2a3037058a7951eec2161bee0af5a4db17c3a444061d62efea23bd0e98e07d9` |
| `docs/core/design-library/INDEX.md` | `b579016e7e2897614e5ff60705b41820bcf0de5af254ab3e0da84cac56b79ee5` |
| `docs/core/design-library/LICENSE` | `4575a543ab88dad12ccea7d97e563d0bce5b448b06072e65d3264497dad326df` |
| `docs/core/design-library/records/palettes.md` | `962eafc42e29e505f006a83e32cd64536e6069ec4823a18220ac2263f886689c` |
| `docs/core/design-library/records/typography.md` | `f29ea49afc142903cb9d337e55deebad0aed04f5f22446db8db9cb3921e700ff` |
| `docs/core/design-library/records/heroes.md` | `5098a275f7c4995d5f08e99467a61d531db117be1f752402ed27c076a2b07cd9` |
| `docs/core/design-library/records/diagrams.md` | `e06e466ff71a2a535025c2235d3a6e9e39f51d7cd7c2a9dd04778559f7d1922e` |
| `docs/core/design-library/raw/palettes.json` | `96d594648249b2dff17addcd0e2965b0eee0cf2815ae68542add82a87d856d6d` |
| `docs/core/design-library/raw/typography.json` | `144be2adc366028ec2d380782e9150436f6bf5f1e4177159674c84435250d830` |
| `docs/core/design-library/raw/heroes.json` | `ec31203b4857901641dc2c8229ab52bb3dcebd7cadeb9619939a49e76061523e` |
| `docs/core/design-library/raw/diagrams.json` | `76ef630a24fd63143d6e70329ab1698606357c0999446b1868bff08e929a30aa` |
