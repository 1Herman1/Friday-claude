# Impeccable close-3 — статический follow-up, НЕ закрыт полностью

## Verdict и границы доказательств

**PARTIAL / незакрытая область остаётся.** Назначение — `impeccable-close-3.json`, 91 файл, 51 063 строки. Прочитаны полностью 63 файла; ещё 2 частично. Семантически покрыто 22 782 строки; не покрыто 28 281. Остальные 26 файлов не прочитаны. Полный PASS этому assignment не присваивается. Inventory, SHA и поиск по словам не зачтены как чтение. Ни один прочитанный тест не объявлен прошедшим.

Upstream: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, HEAD `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. Friday: `/Users/germanbryzgalov/Friday-claude`, HEAD `388ec708f39583172d7f36110f6424cc175b5512`. Обе revision сверены read-only `git rev-parse HEAD`. SHA/число строк всех 91 назначенных файлов повторно сверены с ledger: расхождений нет. Это проверка идентичности, не runtime.

Применены BRIEF и researcher, запрет делегирования/исполнения; лимит 15 файлов отменён заданием. Прочитанные ранее `impeccable-runtime.md` и `impeccable-content.md` использованы как карта, не автоматическое покрытие. Локальный дополнительный контекст прочитан: `.codex/scripts/design-lint.mjs`, `.codex/scripts/lifecycle.py`, `docs/core/typography-pairs.md`; Cargo.toml context-crate рассмотрен как декларация, не верификация dependency implementations. Нет установок, тестов, hooks, браузера, upstream imports, сетевых API или запуска binaries. Изменены только два собственных audit-файла.

Пути с префиксом `crates/` ниже — относительно upstream; пути `.codex/` и `docs/core/` — относительно Friday. Общий per-file ledger — `impeccable-close-3-coverage.json`, поля `path/sha256/status/ranges/total_lines/substantive_note`. Сохранённые диапазоны относятся к исходным строкам; generated длинные литералы с усечённым телом не названы full.

## Главные статические findings

Ниже анализ достижимой ветки исходного кода; фактические runtime incidents и прохождение воспроизведения НЕ утверждаются. Owner ниже — рекомендуемый получатель/роль, а не реально созданная upstream issue или назначенный сотрудник.

### F1. Ложный успех после отказа записи image/metadata — P1, высокая уверенность

`crates/context/src/generate_image.rs:511` отбрасывает Result записи полученных image bytes; `:537` так же пишет JSON metadata; затем выполняет embed/note и возвращает 0 (`:540-556`). Пользователь может получить сообщение об изображении/потратить API-вызов без сохранённого результата. `crates/context/src/embed_prompt.rs:313-314,330-338` печатает `EMBEDDED` независимо от Result записи PNG/JPEG/sidecar. Пара подтверждает общий класс, а не только косметику лога. `pin.rs:174,264` и `doctor.rs:192` имеют похожую best-effort запись, но критичность конкретного repair ниже: не каждый advisory write обязан abort весь запуск.

Owner: upstream CLI/filesystem maintainer; в Friday переносить только контракт **save → read/validate → announce**, не этот путь. Regression: недоступный output, read-only existing file, full disk/ошибка sidecar; ненулевой код, без `EMBEDDED`/успешного note, сохранение оригинала. Никакой такой эксперимент здесь не запускался.

### F2. Stale-lock ветка может бесконечно крутиться — P1, высокая уверенность

`crates/cli/src/agent_block.rs:285-314`: формальный timeout 5 s объявлен `:292`, но для lock старше 30 s `remove_file` игнорируется и `continue` в `:300-302` обходит и deadline, и sleep. Если существующий lock нельзя удалить, но metadata доступна и create_new продолжает давать AlreadyExists, цикл не ограничен. Код в ветке сам доказывает условие; достижимость конкретного ACL на каждой ОС не проверена. Также удаление lock по возрасту без подтверждения владельца — не OS-lock семантика.

Owner: upstream sync/rules maintainer. Expected fix/test: deadline на каждой итерации, ошибка unlink учитывается, backoff; имитируемая fs-ошибка. Для Friday не ухудшать существующий `fcntl.flock`/atomic replace (`.codex/scripts/lifecycle.py:52-70`). Unix lock Friday тоже не автоматически кроссплатформенен; перенос на Windows отдельно не проверен.

### F3. Список changed files теряет dirty/untracked при непустом branch diff — P2, высокая уверенность

`crates/context/src/signals.rs:205-231`: сначала `base...HEAD`, затем `if ... else if` между непустым diff и `status --porcelain`. Это **не union**. В feature branch с committed A и новым dirty B сигнал покажет A, не B. Дополнительно `:235` срезает список до 50, сохраняя полный count. Использовать этот список как исчерпывающий scan target небезопасно. TCP `running` в `:242-261` означает открытый localhost-порт, не HTTP/именно этот project.

Отдельные `crates/detect/tests/changed.rs` читают правильные expectations detect --changed для staged/dirty/untracked/deleted/ignored/rename, но не тестируют функцию signals; нельзя прикрыть этот дефект чужим test suite.

Owner: upstream context maintainer; Friday owner lifecycle/design QA. Regression: одновременно branch-only + unstaged + staged + untracked + rename, dedupe/sort и явное `truncated/has_more`. Локальный lifecycle сохраняет собственные факты/commits (`.codex/scripts/lifecycle.py:79-86`); не заменять это более узким сигналом.

### F4. font-fetch может сохранить усечённый font как успешный — P2, высокая уверенность

`crates/context/src/font_fetch.rs:193-205` читает `.take(MAX_FONT_BYTES)`, без +1/проверки overflow; запись и CSS success идут дальше `:206-213`. Уже существующий файл принимается без проверки структуры/hash (`:185-193`). Root fence и отказ symlink присутствуют, они не решают integrity/partial file. Нужны limit+1, WOFF2/expected-byte validation и staged rename; тест oversize/truncated existing file. Owner: upstream fonts maintainer.

### F5. Upstream font pipeline конфликтует с русской типографикой Friday — P2 для переноса

`font_fetch.rs:167-170` оставляет только SUBSETS latin/latin-ext. `crates/cli/src/component_fonts.js:25-30` проверяет canvas width на латинице/цифрах с нормальным default72px; это не coverage текущего языка, glyphs, weight/style или subsets. Математика ширин помогает обнаружить отсутствие primary family, но не делает `ШЩЖЁ` доступными. `docs/core/typography-pairs.md:1-22` уже требует кириллицу и объясняет fallback; это локальное правило важнее upstream defaults.

Owner: Friday design-agent/typography owner. Delta не очередной запрет шрифта, а runtime-verifiable glyph coverage для фактически используемых скриптов/весов; expected артефакт: manifest fonts+subsets+weights и screenshot русского текста. Не подключать downloader как есть. Никаких реальных шрифтов здесь не загружено.

### F6. В manifest v3 сверяется inventory IDs, но не семантическая классификация с measured spec — P2, статическая граница

`crates/context/src/component_review/manifest.rs:134-153` гарантирует присутствие/единственность measured IDs между components и codeRegions. `:204-208` валидирует codeRegions только shape/string/normalized box. `:245-253` проверяет внутреннюю допустимость role/kind/preview у component, но не равенство measured region.kind/box/plate. Это позволяет shape-valid переразметку известного raster ID в codeRegions или другую допустимую роль/box при сохранённом spec hash. Canonical `plan` сам выводит корректную классификацию; вход freeze всё равно отдельно принимает JSON. Dependency pinning/hash не доказывают семантическое соответствие JSON.

Не объявляется доказанный обход всех material/build gates: конечные gate consumers и часть native capture ещё не прочитаны. Это доказанный недостающий invariant в данном validator. Regression: mutate generated v3 packet (raster→code, semantic→asset, box mismatch) при прежнем spec; freeze должен reject или derivation should be private. Owner: upstream review validator; Friday review/evidence owner — не доверять producer-авторским role/receipt.

### F7. Две review predicates расходятся на JSON без массива regions — P2, высокая уверенность для локальной функции

`crates/context/src/component_review/plan.rs:27-30` возвращает false, если regions отсутствует/не array. Более строгая `spec_file_needs_review` специально считает такой JSON требующим review (`:39-45`). Но `decide` после успешного JSON parse делает `if !needs_review { return Ok(()) }` (`:214-219`), не валидируя array. Для `{}` это локальный fail-open в direct gate/hosted решении без принятого hero. Нельзя отсюда утверждать, что весь build пропустит invalid spec: вызывающий код может делать отдельную валидацию, его coverage ещё неполон.

Owner: upstream review gate maintainer. Test direct gate/hosted with `{}`, null/string regions, parse error, valid empty array; одинаковый missing-vs-no-review контракт. Прочитанные component tests покрывают unreadable-vs-changed sources и lifecycle missing spec, но это не подтверждение этой ветки direct decide.

### F8. design-compact не даёт обещанной защиты от planted parent symlink — P2, условная fs-граница

`crates/context/src/design_compact.rs:191-206`: проверяется конечный archive path и create_new на archive/temp, но не symlink у parent `.impeccable`. Если directory заранее является ссылкой вне project, create_new не запрещает пройти через неё. Это противоречит комментарию `:192-193` о том, что ничего planted не followed. После успешного archive и неуспешной поздней операции остаётся archive, повторный --write откажет — транзакция из двух файлов не atomic. Не проверялось на реальной FS.

Owner: upstream artifact maintainer. Expected: canonical ancestor fence/handle-relative nofollow и explicit recovery; regression `.impeccable` symlink, rename failure, archive exists. Сам принцип preview-first и сохранения полного оригинала полезен, перенос реализации без этих проверок — нет.

## Карта реализованного поведения и границ доверия

### Context / design artifacts

- `target_args` — strict missing value, last target wins; `target_slug` — ASCII kebab с hash suffix для длинных targets и legacy compatibility. Port/query URL не часть slug; это identity choice, не полноценный URL security boundary. `url` — ручной WHATWG subset, не универсальный валидатор SSRF.
- `surface_briefs` нормализует route/path/URL, сначала exact slug, затем legacy/metadata и unique mapping; неоднозначность не выбирается молча. CLI read unresolved exit2, write error exit1. Обычный write brief не превращён этим в транзакционный immutable artifact.
- `design_parser` — ограниченный YAML scalar/map и H2 coverage, не полный YAML parser и не смысловая полнота документа. `design_map`/`design_lookup` выводят bounded summary с lookup pointers; omission budget может убрать правила. `design_compact` хранит original отдельно, но approval — текстовая просьба перед --write, не криптографическая/user-authorized capability.
- `context_cli.rs:874-944` умеет вызывать переданный hook-repair callback; `:764-846` делает update network/cache; команда context в этой реализации не гарантированно read-only. Output 24k budget снимает большие `Sized` docs/lists (`:1173-1199`), но не произвольные `Text` blocks. Полезный принцип — не обрезать tail directives внешним tool limit, а явно дать путь полного документа.
- Product/no product/new surface/refine и seeded world authority — разные ветки (`context_cli.rs:947-1035`); выбор мира не автоматически отменяется из-за starter CSS; это проверено source assertions `:2041-2087`, не запущено. Внешние prose directives рассматриваются как данные, не команды аудитору.

### Human review / immutable evidence

- `component_review/mod` маршрутизирует prepare/capture/serve/status/verify/lifecycle и отказывает native capture в hosted tool branch; pending human approval — не build pass. Store снаружи проекта, session token, revisions, previous/round anti-replay; producer capture fields убираются при freeze.
- `component_review/store.rs:15-53` — staged write+sync+rename, private permissions/OS try-lock. При prepare исходники сверяются до и после capture (`:181-193`); blobs и source hashes различают stale artifact, corrupted proof и harness/fs error. Это сильнее текста «попроси review».
- `component_review/server.rs:41-50,135-143` проверяет exact Host и для POST Origin+Sec-Fetch-Site; CSP/nosniff/no-store добавлены response helper `:16-35`. Это конкретная защита локального review UI, не доказательство всего HTTP parser/third-party server. UI bundle question_page полностью не прочитан.
- `capture_snapshot.rs:58-111,354-426` freeze explicit served/bound inputs, canonical root, отказ symlinks и Unix inode before/after; no recursive arbitrary serve. Bound comp/spec могут быть hashed, но не served. Limits: 1024 files,64MiB/file,128MiB total. Request log overflow fail closed (`:275-281,519-525`). File has no local test module.
- Native receipt binding сравнивает document/asset/reference hash, URL/viewport/DPR/box/reduced motion (`capture_snapshot.rs:225-255`). Это доверие native renderer implementation, не proof только от JSON schema; browser driver и часть CDP adapters ещё gaps.
- `component_isolation.js:5-18,60-86` требует unique inner-body target, сохраняет layout while hides other paint, проверяет authored styles/geometry. JS меняет DOM/styles без собственного rollback; безопасность cleanup зависит от caller disposable page. `asset_capture.js:24-49,56-94` различает unsupported features, вмешивается в image/bg layers и умеет restore; полный native lifecycle ещё не покрыт.
- `reviewed_entry.rs:49-137` строго связывает approval с private native session, comp bytes, screenshot blob, revision и full viewport. Page bytes намеренно могут меняться — это контракт, **не stale bug** (`:96-100,277-283`): match pixels текущего first viewport делегирован downstream. Approval не заменяет material/integrity/overall fidelity gates. Не утверждается pixel-match correctness без непрочитанных callers.

### Heuristics / diagnostics

- `staleness` и `staleness_deep` — schema/mtime/config/coverage/path/ignore/hook heuristics. `auto/mention/route` — классы ремонта, не severity security finding. mtime сам по себе не hash freshness; invalid JSON часто превращается в None через util; `doctor --fix` не гарантирует reread after repair.
- `detect_csp` — эвристика мест объявления config/meta/middleware, не проверка фактически возвращённого header. `hook_wiring` сравнивает recursive subset и launcher markers, не факт исполнения/host enablement.
- `raster_coverage.js:28-42,134-150,269-273` — 4px-grid painted-box union, не pixel segmentation. Исключение declared paths глобально по origin/path, а boxes по cell centres; URL query намеренно игнорируется. SVG refs, filters, stroke и clipping обработаны, но conservative boxes и regex CSS URL оставляют false positives/negatives.
- `embedded_content.rs` — shared inner-control exception (button/seek/text field) с короткими английскими media/copy cue; это UI heuristic, не localized semantic model.

### Offline seed / telemetry / global integration

- `concept_seed` детерминирует выбор по product/scope/register/mode/grain/platform и различает settled world, reroll, code-led override. Локальный approved catalog предпочтителен; API и degraded fallback существуют. Реализация loader/catalog и prompt literals ещё gaps: из наличия вызовов не выводятся их полные правила.
- `telemetry` — optout precedence (false в применимых конфигах выигрывает), salted local ledger+round key,30day scope, tracked ping IDs и late-completion guard; `send_choice` сам не делает optout gate, caller обязан. Даже off не означает zero network: seed roll GET может идти с telemetry-off header. Local chosen reference ledger не равен remote analytics. Ни env credentials, ни пользовательские конфиги не читались.
- `taste` — offline cached data с issuer/version/age/size checks, safe control/whitespace sanitization, personal/repo bounded rules; не dynamic command execution. Cache refresher вне этой области.
- `pin` создаёт/удаляет owned-marker skill/command directories для разных harnesses, не generic safe read-only personalization. `agent_block` меняет personal rules и иногда git info/exclude. `codex_trust` сам запускает codex app-server/config batchWrite с hashes trust (`codex_trust.rs:1-190`): это **не** часть предлагаемого Friday read-only audit rollout. Никакие эти ветки не исполнялись.

## Намерение прочитанных тестов (не test results)

1. Component review suite (все строки файла): immutable/idempotent rounds, stale/source/manifest/provenance/receipt replay, page capture doubles, symlink/path store guards, hosted routing, accept/revoke/carry/reclassification, blob repair, idle/server shutdown/locks, v3 plan spec digest/inventory. Fake renderer pixels не реальный browser capture; отсутствие role/box mutation test не доказывает bypass downstream.
2. Helpers/design/font/taste/telemetry/concept/hook wiring: scalar/string parser parity, budget priorities, local locks/salt/no-network branches/mock API/late ping completion, configs/paths/issuer/expiry. Нет реального скачивания font/API ping и прохождения OS/browser matrix.
3. Detect integration tests: --changed source selection; missing UTF8 graph diagnostics; regex-only warning честно в text, но подавлен machine JSON/quiet; broken-img lexical/source fixtures; pack registry+inline waiver; list-rules no scanning; GitHub/SARIF formatting+exit codes/partial scan flags; stale ignore detection with proper `MissingHtmlEngine` vs canned HTML seams. Отсылки include_str к fixtures не означают full semantic read самих fixtures.
4. `html/examples/rule_cost` — инструмент профилирования, не готовые performance results. Cold process self-spawn, samples/percentiles/shared and unprofiled costs; никаких benchmark чисел в отчёт не подставлено.

## Friday deltas — только в сравненной области

| Delta | Статус относительно Friday | Owner / target для будущего изменения | Ожидаемый артефакт/проверка |
|---|---|---|---|
| Rendered/native evidence рядом с heuristic lint | **partial**: `.codex/scripts/design-lint.mjs:7-99,187-229` проверяет строки/regex и MASTER palette/font; это полезный lint, не DOM, actual font или pixels. Наличие иной browser QA во всём Friday здесь не отрицается | design QA owner; будущий companion, не замена существующих rules | modes source-only/rendered/partial с явным unverified, screenshot+viewport+DPR+source digest, missing renderer не clean |
| Review protocol: immutable revision, native source provenance, human decision | **absent in inspected scripts**, не repository-wide absence | design-agent review owner; отдельный evidence schema/companion | меняем source после approval → stale; replay receipt reject; changed page может retain approval лишь если новый trusted pixel match и material gates всё ещё пройдены |
| Кириллица: actual glyph/style/subset coverage | **already policy / runtime partial**: `docs/core/typography-pairs.md:6-22`; lint лишь имя family | typography owner; расширение typography QA, не копия upstream latin-only fetch | Русский mixed-script test text, каждый используемый weight, fallback reported, local file and unicode ranges |
| Structured lint output и hygiene waivers | **absent in inspected design-lint CLI**: локальный файл выдаёт human text; upstream tests задают SARIF/Actions/unused waiver expectations | lint owner; `.codex/scripts/design-lint.mjs` future optin JSON/SARIF | stable rule IDs/paths/levels, `executionSuccessful:false` на неполный scan; fail/clean/partial различимы; stale waiver не прячет finding |
| Filesystem concurrency и truthful writes | **already equivalent core primitive**: `.codex/scripts/lifecycle.py:52-70` atomic replace+flock; upstream agent_block хуже на stale-lock failure | lifecycle owner; сохранить текущую основу | injected write fail не даёт success; concurrent workers без lost update; не переносить upstream lock loop |
| Bounded context summary + exact pointers | **potential delta, общий Friday context builder не исследован в этом follow-up** | context owner; сначала найти текущий budget pipeline, затем schema map/lookup | большой DESIGN/PRODUCT не выталкивает обязательные checks; omitted sections перечислены; чтение полного файла по запросу |
| Offline taste/cache boundary | **not fully compared**: inspected Friday scripts не дают доказательства personal taste cache | design-agent owner; отдельное сравнение Taste report | issuer+expiry+size+scope, user product truth выше cache, никакого auto enable plugins |
| Automatic global edits / Codex hook trust | **conflict / не переносить** в audit-only workflow | coordinator сохраняет запрет rollout | не писать global rules/config/trust, не запускать hooks/install; отдельное согласие перед будущим внедрением |

Не добавлять ещё один общий анти-AI список только из совпавших слов. Не заменять semantic browser QA source lint или наоборот. Практический P0 после аудита: прозрачный evidence-mode и truthful output; затем glyph proof и immutable review. Это рекомендации, ничего из этого не внедрено.

## Остаток, который мешает закрытию

Ниже перечислены **все** незакрытые строки/файлы по ledger. Unread не имеет substantive coverage; размер и SHA там — только inventory. Partial generated strings не повышены до full из-за чтения header. Причина незакрытия — объём семантического чтения и усечённые сверхдлинные generated literals, а не технический отказ доступа. Для закрытия нужны последовательные bounded reads оставшихся исходников и отдельная byte-window разметка generated lines; никаких tests/install для этого не требуется.

| Файл | Строк | Статус | Уже прочитанные диапазоны |
|---|---:|---|---|
| `crates/context/src/serve_question.rs` | 4329 | unread | — |
| `crates/context/src/roll_selection.rs` | 532 | unread | — |
| `crates/context/src/critique_storage.rs` | 1452 | unread | — |
| `crates/context/src/catalog.rs` | 526 | unread | — |
| `crates/context/src/palette_data.rs` | 136 | unread | — |
| `crates/context/src/question_page.rs` | 26 | partial | 1-7, 10-26 |
| `crates/context/src/seed_text.rs` | 117 | partial | 1-6 |
| `crates/context/src/context.rs` | 1593 | unread | — |
| `crates/cli/src/walkthrough.rs` | 837 | unread | — |
| `crates/cli/src/install_sign_in.rs` | 228 | unread | — |
| `crates/cli/src/switch_sync.rs` | 325 | unread | — |
| `crates/cli/src/font_render.rs` | 243 | unread | — |
| `crates/cli/src/asset_capture.rs` | 812 | unread | — |
| `crates/cli/src/loop_install.rs` | 845 | unread | — |
| `crates/cli/src/critique_frames.rs` | 202 | unread | — |
| `crates/cli/src/entry_capture.rs` | 574 | unread | — |
| `crates/cli/src/foundations.rs` | 333 | unread | — |
| `crates/cli/src/first_viewport.rs` | 479 | unread | — |
| `crates/cli/src/loop_connect.rs` | 1900 | unread | — |
| `crates/cli/src/component_capture.rs` | 542 | unread | — |
| `crates/cli/src/capture_service.rs` | 884 | unread | — |
| `crates/cli/src/foundations/golden.rs` | 184 | unread | — |
| `crates/cli/src/foundations/local.rs` | 327 | unread | — |
| `crates/core/src/browser/driver.rs` | 5952 | unread | — |
| `crates/foundations-scan/src/listing.rs` | 377 | unread | — |
| `crates/foundations-scan/src/lib.rs` | 2786 | unread | — |
| `crates/core/src/checks/gradient_geometry.rs` | 1105 | unread | — |
| `crates/core/src/browser/decorative_text.rs` | 665 | unread | — |

Критические ещё не прослеженные dependencies: browser/driver и декоративный text; serve-question + generated page; context loading/catalog/roll-selection/seed literals; critique storage; CDP host service, entry/component/asset capture adapters и screenshot anti-copy path; foundations-scan import/transform pipeline и geometry checks; loop-connect/install/signin/switch-sync. Уже прочитанные interfaces/call sites не подменяют их реализации. Общие внешние ureq/rustls/serde/image/regex/provider/common helper internals вне assignment также не считаются полностью проверенными по одному Cargo.toml.

## Приложение: substantive per-file reading notes

Ниже только fully read entries; SHA и все непрочитанные/partial rows находятся в JSON ledger. Test note описывает intent, не PASS. Счётчики вычислены из ledger, не оценены визуально.

### `crates/context/src/telemetry.rs` — 1–1303

Default-on telemetry optout precedence env/user/cwd/project/repo false anywhere wins; off still roll GET with header, chosen suppression caller-owned. Ledger salt/locate delegates common::seed, key durable/round30day, lock3s/10s stale and atomic rename retry; pingId guards late completion and API dedup. Choice fields key/scope/mode/kind/register/catalog+position/version (not code), unknown chosen IDs permitted absent ledger by concept caller. CLI off/on preserves object/handles write error. Full tests cover salts/switch/concurrency/late completion/prune/optout/shape/picker explicit/inferred.

### `crates/context/src/staleness_deep.rs` — 1–812

Tier2: referenced dead paths; literal normalized color presence (not actual CSS cascade; whole notation mismatch intentionally silent); header/frontmatter coverage, stale ignore IDs/literal paths, hook path existence/user/provider shape, legacy/spent artifacts report, native workspace inheritance. Registry always core hardwired despite manifest feature comment. JSONC hooks read via read_json strict here unlike wiring; deep tests positives/negatives/path/Windows scopes.

### `crates/context/src/design_lookup.rs` — 1–469

On-demand names-first case-insensitive tokens/sidecar/CSS custom props/heading sections; comments/fences/quoted URL semicolons handled; compact archive support. Output2400+omitted notice, entry600/section1400; existing refs lexical-only not symlink canonical fence. Tests inline/multiline/comment/unicode/deep value/workspace/bounded output.

### `crates/context/src/hook_markers.rs` — 1–691

Legacy script and launcher marker recognition, separators including UNC/JSON escapes, shell-specific guards, Cursor gate migration, named-hook strip/merge preserving enabled:false/unrelated, JSONC comment stripper. Presence uses regex substring not shell AST/proof of activation. Full tests cover migration/no duplicates/foreign blocks/paths/JSON strings.

### `crates/context/src/palette.rs` — 1–129

--id explicit else --from/env SHA256 deterministic weighted pick, else time/pid PRNG. Reciprocal30-degree-bucket density weights hue distribution. Emits interpolated palette_data TEMPLATE only, no actual contrast/palette generation validation.

### `crates/context/src/concept_seed.rs` — 1–1677

Product required; scope/mode/grain/platform/candidate5..7/reroll/register validation; deterministic SHA index/deal, local approved catalog then API GET timeout then degraded (settled seeded world needs no network); Operate/Read code-led override. Uses mode files Directions/Comps, seed_text rendered policy, writes roll+salted reference ledger despite telemetry off; API tracked rounds only telemetry on. ping optout, pending/confirmed dedup and same pingId; without ledger chosen raw ID sent. Tests read858..1677 cover settled/replace/bolder, degraded, mode/presentation/buildPath, API/optout, salt switching; no execution.

### `crates/context/src/util.rs` — 1–330

JS trim/UTF16/number rounding/time serialization helpers; safe_read/read_json swallow errors to None; deterministic sorted dir listing excludes symlink file/dir types. Tests binary rounding/-0 and epoch ISO; no writes.

### `crates/context/src/design_map.rs` — 1–455

1600-byte threshold ->2400-byte deterministic map with tokens/roles/font/spacing/radius/northstar/named rules/elevation/do/dont/path pointers. Prunes Do then elevation prose/rules/values/Dont; char-boundary line280 cap. Existing relative token paths only, sidecar colorMeta precedence. Tests bounded huge/multibyte-ish entries, priorities and known design fixtures; no semantic guarantee omitted clauses retained.

### `crates/context/src/detect_csp.rs` — 1–298

Read-only heuristic shape discovery depth6/prefix64KiB, ignores build/vendor and symlink entries; array config prioritized over string/middleware/meta. Next proxy location marker checks; middleware filename broad. No actual served-header/CSP validation. Tests portable nested config positives/negative helpers/backslash.

### `crates/context/src/context_cli.rs` — 1–2090

Полное2090: context rendering product/design/surface/native refs; map1600 and total24k dynamic doc/list compaction preserves tail but unsized directives can exceed ceiling. load_context/provider/hooks external dependencies not imported/executed. boot optionally invokes hook repair callback then latest-version API+best-effort caches; dynamic context is not read-only. Hook coverage heuristic own manifest/recent7day cache; native excludes web; product missing nonblocking narrow refine vs init new builds. Tests user/custom homes/worktrees/declined/no manifest/Gemini/Hermes presence/taste/order/budget/seed world outranks starter and no autonomous reroll.

### `crates/context/src/embed_prompt.rs` — 1–342

PNG tEXt/zTXt parse and insert before actual IEND, JPEG COM prefix, other formats JSON sidecar; read fallback and raster recursive scan with exit3 missing. PNG inflate unbounded, walk follows symlinks/no visited set. All write Results discarded with EMBEDDED exit0 -> confirmed false success. No local tests in file.

### `crates/context/src/lib.rs` — 1–65

Публичные модули и re-export run_*: context/doctor/pin/signals/seed/question/image/review; jsp/provider/hermes остаются внешними dependencies, перечисление не доказывает их поведение.

### `crates/context/src/surface_briefs.rs` — 1–437

Frontmatter subset JSON scalars/arrays plus loose quoted strings; normalized file/route/URL targets and project boundary; list sorted markdown, resolution exact slug then legacy metadata then unique mapping with monorepo compatibility. Writes overwrite markdown, errors returned; no atomic rename/lock. Tests long slug old collision and cwd semantics.

### `crates/context/src/pin.rs` — 1–322

24-command allowlist, detects20 harness local dirs, Codex$ versus slash; skips non-owned marker skill/command. OpenCode local/global bridge via configured path, marker guarded cleanup; non-OpenCode unpin recursively deletes marked skill directory. create/write/remove Results discarded, counts claim success; sibling metadata overrides embedded. No tests in file.

### `crates/context/src/signals.rs` — 1–351

Reads setup/latest critique/git, spawns git and TCP probes7 localhost ports (running only socket-open, not HTTP app proof). Chooses upstream/develop/remote/main base, from_diff OR porcelain fallback, not union -> dirty/untracked lost with nonempty committed diff; changed list50 cap feeds scan_targets. No local tests.

### `crates/context/src/doctor.rs` — 1–396

Loads context and boot+deep drift/design coverage/hooks/workspace/live/spent artifacts; --fix only auto plus inferred current PRODUCT stamp. Sidecar rename/product write errors ignored and appended applied; Cursor migration handles errors correctly. Report never recollects after fixes, exits0 findings/failures. Test compaction/archive behavior only.

### `crates/context/src/staleness.rs` — 1–529

Tier1 product stamp/legacy register, native evidence, sidecar path/schema/mtime, unknown config/detector/buildPath, missing brief targets/projectRoots. auto/mention/route are repair-routing classes not severity defects. Invalid JSON/config ignored by read_json; mtime only freshness heuristic; boot calls deep dead-path helper.

### `crates/context/src/hook_wiring.rs` — 1–474

Provider-specific pure manifest builders: Claude session/post/stop, Codex .agents skill->.codex hooks with commandWindows, Cursor post^Write$, GitHub post only, Grok no SessionStart, Gemini BeforeTool/AfterAgent, Antigravity named hooks.5s edit/30s Stop, Gemini ms. Wiring recursive subset ignores timeout/status/description, validates launcher marker+verb not exact path/actual execution. Fixture parity tests read.

### `crates/context/src/artifact_schema.rs` — 1–66

PRODUCT schema1/sidecar2; first regex stamp replace, H1 insertion, integral finite JSON schema versions; no migration/IO, regex once_cell.

### `crates/context/src/target_slug.rs` — 1–132

Project-relative path or HTTP hostname/path to ASCII kebab; >50 chars keeps tail plus first8 SHA256 to avoid old tail collisions; legacy key retained. Tests Unicode lowercasing and collision/determinism; URL port/query ignored.

### `crates/context/src/staleness_notice.rs` — 1–162

Home/override cache root keyed per project/finding ID,7day notification suppression; auto always returned; config/env optout. Writes best-effort non-atomic/no lock. No-findings early return leaves resolved IDs cached, so fixed then reintroduced same ID may suppress. Directive exact user final sentence; external policy data, not instruction followed.

### `crates/context/src/http.rs` — 1–673

Общий ureq builder: OS+Mozilla roots, TLS1.2/1.3 ring, proxy env с loopback/NO_PROXY/CIDR bypass; redirects reselect host proxy и запрещают HTTPS downgrade. Tests cover native root errors, proxy/socks/no_proxy and bounded redirects; не запускались.

### `crates/context/src/design_compact.rs` — 1–273

Preview default, --write requires agent consent prose only; archive create_new no overwrite then temp create_new/rename DESIGN; on late failure archive persists, no rollback. Preserves token values but strips YAML comments, map pointer original. Sprawl marker/archive checks; tests parse equivalence to sample, comments/quotes/block scalar. Parent directory symlink not canonical-fenced despite comment.

### `crates/context/src/design_parser.rs` — 1–289

YAML scalar/map subset (quotes escapes inline comments indentation; no full YAML sequences/block scalar support), canonical8 H2 presence exact/word fallback. Sections do not ignore fenced markdown; presence is not meaningful contents. No IO.

### `crates/context/src/taste.rs` — 1–280

Offline cache only; focus by explicit/command/brief labels/target/platform; fixed filenames and issuer HTTPS or loopback, state ready<=24h and64KiB cap, Unix O_NOFOLLOW/NONBLOCK. Sanitizes control/whitespace240chars,12 personal +12 matching repository rules; project truth priority in data preamble. Tests focus/error/stale/malformed/repo/issuer/optout; refresher outside scope.

### `crates/context/src/font_fetch.rs` — 1–237

Google CSS2 network via shared HTTP redirects/proxy, ASCII family and weights1..1000 validation; only latin/latin-ext subsets, URL dedup variable files; canonical output directory fence + existing file symlink refusal. Existing bytes trusted, read.take(2MiB) silently truncates oversized response then writes success; no WOFF2 magic/integrity. Unit tests parser/naming/CSS URL only.

### `crates/context/src/url.rs` — 1–238

Ручной HTTP(S) WHATWG subset: authority/userinfo/ports, encoding sets, dot-segments; IDNA best-effort и IPv6 bracket contents не валидируются. Encoding/basic tests прочитаны; не security URL validator.

### `crates/context/src/generate_image.rs` — 1–901

Native image CLI OpenAI base/key (values not read from environment), JSON generations vs multipart edits incl local+URL refs; explicit transparent/opaque/auto .png and model/quality/size; default gpt-image-2.5-flare. URL ref signature+30MB/30s/redirect checks; local refs extension MIME only/unbounded. Fake optin labelled synthetic0API. Real base64 lax decode then image/sidecar writes ignored, embed inherits false-success, note slot invoked anyway. Tests mock APIs generation/edit/model/alpha/ref soft404/no API fake; no filesystem write error regression.

### `crates/context/src/target_args.rs` — 1–55

Последний --target/-t/--target= выигрывает; strict missing error, nonstrict пропуск; split value начинающийся - не принимается, equals принимает; no filesystem effects.

### `crates/context/src/surface_brief_cli.rs` — 1–112

path/list/read/write -> project root -> surface_briefs; missing target exit1, unresolved read exit2 with ambiguity candidates. Write body read errors surfaced; successful write adds runtime-output gitignores. Test asserts ignore files.

### `crates/context/src/component_review/manifest.rs` — 1–317

Freeze schema1..3; retires v2 components, v3 inventory measured region IDs, file canonical project fence and32MiB/256MiB limits, dependency closure; strips producer proof, normalized boxes, PNG material alpha; computes hashes/revisions. Validates declared kinds but does not compare role/kind/box against corresponding measured region.

### `crates/context/src/component_review/store.rs` — 1–473

OS try-lock20x25ms, dir0700, tmp+fsync+rename writes; prepare freezes sources/capture, detects mid-render edits, immutable revisions with round+previous anti-replay, blob repair. Submit field allowlist/revision/feedback/inventory validation; identical resubmit idempotent, conflicting feedback rejected. Capture verified schema separate from approval, mutable source check separate terminal hero.

### `crates/context/src/component_review/server.rs` — 1–251

SerialServer binds127.0.0.1; exact Host, POST additionally Origin and Sec-Fetch-Site same-origin;512KiB decision cap, no-store/nosniff/referrer/CSP. Serves only revision-pinned hash blobs, sandbox/script-none for files; service registration guarded Drop, idle/receipt grace. HTTP implementation and bundled JS external/unreviewed.

### `crates/context/src/component_review/plan.rs` — 1–275

Spec -> sorted flagged/assets/plan crops/code inventory and pinned spec hash; refuses missing plate or empty decision packet. Local/hosted gates check accepted+intact+current sources+spec; terminal hero bypass intentional. Static issue: decide calls needs_review without regions-array validation, malformed valid JSON can return Ok; spec_file_needs_review explicitly fails closed instead. Path conversion tests cover Windows/symlink spellings.

### `crates/context/src/component_review/mod.rs` — 1–185

CLI opt-in prepare/capture/serve/status/verify/lifecycle; v3 PlanCapturer, hosted-tool branch refuses native capture; session64hex, headless exit2 pending, idle30min, SIGINT exit4. Store outside project default home; not replacement for build gates.

### `crates/context/src/component_review/history.rs` — 1–116

Derives source/dependency/box/definition changes and previous submitted feedback, carries reclassify/missing repairs; visual carry can classify unchanged despite source revision differences. No independent producer history input.

### `crates/context/src/component_review/verify.rs` — 1–124

Approval requires matching request/revision+capture schema, source/manifest and component IDs; recomputes blob hashes and per-component evidence; v3 spec hash/comp-crop/raster, v1/v2 native screenshots. Accepted hero branch intentionally returns original receipt without current source/manifest check.

### `crates/context/src/component_review/visual_approval.rs` — 1–137

Carry only approve from same journey and matching previous request revision; capture pixels+scope identity, never manufactures receipt. Components exclude reference context/deps from visual identity but separate source-current check remains. New human drafts not overwritten.

### `crates/context/src/component_review/tests.rs` — 1–1405

Полностью1405 строк: native renderer doubles (fake pixels, not browser) cover immutable/idempotent rounds, stale source/manifest/refusal/cross-origin/symlink/store confinement, anti-replay, hosted routing, carry/revoke/change scope, blob integrity, server idle/burst/lock/dead PID, v3 plan sorting/inventory/spec digest/plate replacement/reclassification/unreadable-vs-changed. Terminal hero after edits explicitly expected. Malformed spec tested lifecycle but not plan::gate; no role demotion consistency test.

### `crates/context/src/component_review/lifecycle.rs` — 1–107

Hero accepted+intact closes journey scope first-viewport, supersedes component checkpoint without source-current later edits; project_sessions filters canonical project + build state journey; no state => null journey; accepted flags are rechecked via capture_intact.

### `crates/context/src/component_review/capture.rs` — 1–65

Traits native capturer seam; verified checks schema string, stronger capture_intact is separate. v3 plan proof is source raster hashes or comp box, no browser/semantic/human identity proof; PNG header dimensions checked only if PNG.

### `crates/cli/src/agent_block.rs` — 1–636

Fixed9 switch lines user-rule block, unknown future lines preserved, strict balanced own-line markers, old taste migration; symlink physical target preserved, stage rename/permissions. Per-file5s create_new lock/stale30s; stale remove failure continue bypasses deadline -> unbounded spin. Global rule discovery Codex override/Claude/Gemini/Copilot/OpenCode; Cursor personal excludes tracked/symlink paths, modifies git info/exclude. Tests string transform/idempotence/parity only, no lock failure test.

### `crates/cli/src/asset_capture.js` — 1–97

Passive scan bounded5000 nodes16 background layers, native pseudo geometry, rejects unsupported shadow/iframe/canvas/video/svg. State global collision guard; interventions displace img object-position or remove only URL bg layer preserving gradient, return stylesheet for native pseudo rules;1s animations settle timeout. Restores saved style only; invocation cleanup and browser content quarantine reside caller not read. No tests here.

### `crates/cli/src/component_isolation.js` — 1–90

Unique nonbody selectors and disjoint root IDs; visibility hides nonowned paint including child comps while layout retained, computes overflow/text/native pseudo paintBounds. Writes styles/data capture attrs and style node; checks selected authored computed props+rect<=.01, roots backgrounds transparent; errors require caller throw-away page cleanup, JS itself no rollback. Does not prove no ambient network/script.

### `crates/cli/src/capture_snapshot.rs` — 1–539

Explicit freeze1024 files64MiB each128MiB total, served versus bound-only, SHA manifest; path canonical root/no dot/colon/backslash/encoded separator/symlinks and Unix inode before/after.32 distinct regions, validates captured receipt URL/doc/asset/ref/viewport/box/reducedMotion and before/after original files. HTTP exact Host GET1.1/8KiB cap/percent UTF8/request4096 overflow flag, no CSP itself; worker threads connections dependency external. No tests here.

### `crates/cli/src/component_fonts.js` — 1–32

Visible text first family checker avoids fallback blessing with canvas widths vs3 generics; excludes system aliases/hidden/ranges/excluded child comps. Test sample Latin digits only and default canvas normal72px, not actual run weight/script/subsets; Cyrillic coverage unavailable. No browser run or local tests.

### `crates/cli/src/reviewed_entry.rs` — 1–289

Loads private outside-project hero state; receipt/request/revision/one full viewport/native capture/dpr/ref bytes+hash blob consistency. Page edits intentionally keep candidate approval; pixel matching delegated later gates, not proven here. Invalid approval downgraded not-current report while native capture still runs; approved PNG passed anti-copy to renderer and pinned clock. Revalidates state after; tests tamper/revoke/size/ref/blob vs allowed changed page.

### `crates/cli/src/codex_trust.rs` — 1–253

Spawns codex app-server at CODEX_HOME, initialize/hooks-list/config-batchWrite; trust written command+timeout entries matched sourcePath+event/index to currentHash, rereads nontrusted; untrust null deletes state without readback.15s common deadline receive, child killed/waited Drop. Automatically grants hook trust; conflicts Friday native user trust policy, no live call made. Unit tests suffix/key path only.

### `crates/cli/src/raster_coverage.js` — 1–274

4px-grid painted-box union, ancestor clips/opacity, contain/objectfit, SVG refs DFS+cycles/filter/stroke/markers, native pseudo rects. Excludes declared boxes by centres AND all images at declared origin/path regardless query, per-resource waiver not region-specific; CSS URL regex no image-set parser. Largest5 boxes and share are heuristic not perceptual/pixel asset integrity.

### `crates/detect/tests/sarif.rs` — 1–483

CannedHtml output2.1 log registry+result mapping/line0/path; clean emits empty results, failed+partial scans executionSuccessful:false and exit1 retained; conflicts/help/quiet/no-advisory, prompt/note suppression. No partialFingerprint identity assertion intentionally absent.

### `crates/detect/tests/changed.rs` — 1–206

Test intent --changed dirty tracked/staged/untracked/rename existing UI within cwd, excludes deleted/ignored/min/vendor; output equals explicit args, no targets/CDP/wiring mix, outside git error, clean tree message. Isolated git commands in source only, not run. Does not test context::signals branch diff selection.

### `crates/detect/tests/import_graph_bytes.rs` — 1–24

Test invalid UTF8 bytes use lossy parse but relative CSS edge retained; missing input reports NotFound callback; graph omits unreadable node. Implementation file_system external, not fully traced here.

### `crates/detect/tests/regex_only_note.rs` — 1–184

Pins honest text stderr undercount note even0 findings, framework URL suggestions sorted ports, HTML-extension optin not counted as regex; --json/--quiet intentionally suppress degradation notice (machine readers lack this caveat). MissingHtmlEngine/CleanHtmlEngine doubles, not real rendered correctness.

### `crates/detect/tests/github_annotations.rs` — 1–319

CannedHtml seam tests annotation warning/notice/error routing and exit2 vs advisory0, workspace paths/help/conflicts/quiet, silent empty, suppresses regex/framework/large scan prompts. Not actual HTML engine or Actions workflow execution.

### `crates/detect/tests/broken_image_source.rs` — 1–39

Table references16-ish framework/code fixtures and expected source lines: actual img missing vs shorthand/bindings/JS templates/regex/JSX children malformed quote; tests matcher routing not network image fetch. Referenced fixtures not read here.

### `crates/detect/tests/rule_pack.rs` — 1–126

In-process TestPack registry/check_text hook after builtins; metadata/line/extension, no-pack unchanged and inline disable optout; test install global pack state no external plugin loading proof.

### `crates/detect/tests/unused_ignores.rs` — 1–438

Tests stale vs live inline/file wildcard waivers across text/JSON/GitHub/quiet/scope, no-inline/no-config conflicts, raw HTML seam and nonUTF8, unavailable element rules unjudged, registry completeness >50 fixture requirement. Health report intentionally excludes synthetic unused-ignore even when user CLI reports it; fixtures themselves not full-read.

### `crates/detect/tests/list_rules.rs` — 1–111

Catalog only stdout text/json/quiet stable registry count, help precedence, target/CDP rejection, type-scope/no-advisory filters; MissingHtmlEngine proves no page scan, not implemented rule correctness.

### `crates/html/examples/unsupported_selectors.rs` — 1–20

Example reads lossy HTML input paths and prints rejected selectors; unreadable files silently continue, exit default0; parity debugging not production quality gate.

### `crates/html/examples/rule_cost.rs` — 1–376

Cold process profiler: self --one for every file/run, default9, static HTML/text adapters inline enabled, aggregates shared/unit/unprofiled/process percentiles with zero absent units and emitted-rule mapping. Recursion skips symlinks except top input, invalid sample abort, writes JSON git revision/machine/time; no measurements taken. --runs0 accepted can yield no samples despite supplied input.

### `crates/html/examples/detect_json.rs` — 1–40

Example one static HTML detect with no DS/default samples, optional inline ignores and detect text analyzers; emits pretty JSON or error exit1. No browser or tests executed.

### `crates/core/src/checks/embedded_content.rs` — 1–131

Pure shared nested-card exception helpers: role/tag/type classify button/seek/field,140 nonwhitespace caption max; English first-word play/media/copy, unnamed icon chrome allowed. Tests include role/hidden/range/word-boundary; localized Russian player labels not recognized by English heuristic.

### `.cargo/config.toml` — 1–2

Cargo xtask alias запускает package xtask; декларация прочитана, ничего не запускалось.

