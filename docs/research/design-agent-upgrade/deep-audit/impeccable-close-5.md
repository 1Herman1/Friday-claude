# Impeccable close-5 — статические трассы detector/common и тестовые контракты

## Вердикт: INCOMPLETE — назначение не закрыто

Сэр, **полного substantive reading всех 73 назначенных файлов здесь нет**. Полностью прочитаны 53 файла, 17 390 строк, включая implementation и встроенные тесты. Ещё один файл имеет только унаследованные 1–180; 19 файлов не прочитаны. Всего подтверждённые диапазоны с учётом предыдущего прохода: 17 570 из 51 107; **остаются 33 537 строк в 20 файлах**. Этот результат нельзя агрегировать как «close-5 closed», «полный detector audit» или PASS. Причина незавершённости — оставшийся объём содержательного чтения, не недоступность файлов. Сохраняю точный промежуточный результат для продолжения, а не заменяю чтение inventory.

Source-only root: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, revision из assignment `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. SHA-256 каждого из 73 путей заново рассчитан и сохранён; соответствие assignment, уникальность строк ledger, суммы строк и gaps механически проверены. Хеширование НЕ служило основанием статуса full. Все bounded source reads дочитаны по continuation offsets. Унаследованный partial `detect_text.rs:1–180` явно отделён от текущего чтения.

Исполнение: adapted researcher Hermes, без делегирования. Прочитаны BRIEF, researcher role, CODEX, README, review-loop и предыдущие impeccable-content/runtime отчёты как карта leads. **Upstream код, тесты, installers, hooks, binaries, imports, браузер и UI не запускались.** Собственные Python-операции использовались исключительно для ledger/hash/count и записи этих отчётов. Friday/upstream implementation, роли, настройки и чужие отчёты не менялись; secrets/.env/customer DB не читались. Тестовые строки с вымышленными секретами являются данными тестов, не чтением credentials.

## 1. Открытые статические findings

Это findings по реально прочитанному исходнику, не результаты воспроизведения. Владельцы ниже — предлагаемые owner/target, не фактически назначенные исполнители. Все остаются OPEN.

### C5-R1 — ВАЖНО: изменение ignores может уничтожить malformed/unreadable config

**Evidence:** `crates/detect/src/config.rs:26–31` сводит missing/invalid/non-object JSON к None; `:271` применяет `unwrap_or_default()` к существующему документу перед записью. `:280–294` собирает новый объект и пишет прямо в тот же путь. CLI `ignores add-rule` читает raw config без distinction «отсутствует/не парсится» (`ignores.rs:291–295`); add-value/clear проходят тот же writer (`:389–419,506–511`).

**Статический сценарий:** существующий `.impeccable/config.json` содержит синтаксическую ошибку; пользователь добавляет waiver. Чтение возвращает пустой config, затем writer трактует старый файл как `{}` и перезаписывает. Теряются unrelated keys, включая hook/live/other configuration, вместо отказа с диагностикой. Аналогично возможен read failure при разрешённой записи. Наличие общего atomic writer в `common/src/fsx.rs:11–41` эту ветку не защищает: здесь непосредственно `std::fs::write`.

**Исправление/test:** owner detector config; типизированно различать NotFound, ParseError и IO error; mutations отказывают при повреждённом existing file, не меняя bytes. Читать валидный объект, сохранить unrelated fields, atomic replacement с учётом конкурентных изменений. Regression: malformed JSON/non-object/read-error не меняются после add/clear, валидный документ сохраняет все unrelated fields. `--all` сейчас последовательный и не транзакционный (`ignores.rs:441–446,506–511`): ошибка второй записи не откатывает первую — отдельно объяснять partial mutation.

### C5-R2 — ВАЖНО: лимит HTTP body не ограничивает chunk metadata

**Evidence:** `crates/common/src/http.rs:140,149` ограничивает head 64 KiB; `:184–186` снимает `Take` после headers. В chunked branch обычный `BufRead::read_line` накапливает размер/extension line в String без byte cap (`:248–255`), trailer lines тоже (`:258–264`), как и delimiter после payload (`:296–299`). Ограничение `max_body` проверяется только после чтения size line и только для payload (`:273–275`). SerialServer вызывает parser до передачи request route handler (`:747–759`).

**Последствие:** localhost peer может отправить chunk-size line с очень длинным extension, длинную trailer line или последовательность metadata, не засчитываемую в body cap. Память для строки растёт независимо от `max_body`/MAX_HEAD_BYTES до EOF/newline/deadline. Watchdog total 10s (`:482,491–530`) действительно ограничивает время и освобождает turnstile, но не количество быстро переданных bytes; это не unlimited-time claim. Не утверждается удалённая эксплуатируемость: bind/route origin policies — отдельные уровни, tests изучены, runtime каждого сервера здесь не перечитан.

**Исправление/test:** owner common HTTP/security; отдельные bounded chunk-size/extension/trailer bytes и total wire metadata budget, проверка CRLF, отказ до накопления. Regression: payload cap=1 KiB + oversized chunk extension/trailer не увеличивают line buffer сверх лимита; существующие legitimate chunked/100Continue/slow-upload tests сохраняются. Сейчас tests `:909–933` защищают huge numeric size и overflow, `:1027–1045` — oversized initial head, но не этот metadata path.

### C5-R3 — ВАЖНО: «локальный dev-server probe» следует redirect на другой host

**Evidence:** `file_system.rs:443–448` начинает HTTP на localhost; redirect handler `:457–468` принимает произвольный `http://host[:port]/path`, заменяет host без loopback проверки. `http_get_once` DNS-resolves и соединяется с ним (`:488–495`), отправляет GET (`:501–504`). Реальный caller — text-mode directory scan с обнаруженным framework config (`cli.rs:1401–1405`); JSON/quiet/github/sarif эту ветку не выполняют.

**Последствие:** обычный локальный source scan в human text mode может сделать исходящий HTTP GET при ответе локального сервиса redirect на external/LAN endpoint. Это не credential exfiltration claim и не обход CDP parser: `cdp_endpoint.rs:71–75,128–139` loopback действительно валидирует, но этот HTTP helper независим. Для audit-only нельзя называть любую detect directory операцию pure filesystem read.

**Исправление/test:** owner detector networking; либо не следовать redirect, либо каждый hop допускает только literal loopback/проверенные loopback resolved addresses, с выбранной явной DNS policy. Test local302→external destination: второй request не сделан; loopback-only hop допустим при объявленном контракте. Отдельно `http_get_once` читает весь response без byte cap (`file_system.rs:505–515`), а DNS lookup не ограничен переданным deadline (`:489`); 2s в комментарии не является строгой гарантией общего wall-clock для DNS.

### C5-R4 — КАЧЕСТВО/логика: невалидный framework port превращается в другой u16 port

**Evidence:** config regex извлекает произвольные digits в u32, overflow даёт `u32::MAX` (`file_system.rs:347–351`); TCP branch делает `port as u16` (`:427–428`), HTTP — то же (`:443–445`), без range validation. Human message продолжает печатать исходный u32 (`cli.rs:1408–1425`).

**Последствие:** malformed port в project config может привести к probe другого порта и ложному «dev server found/another service». В отличие от этого CDP порт валидируется 1..65535 (`cdp_endpoint.rs:105–109`).

**Исправление/test:** owner detector; `u16::try_from`, исключить 0, invalid detection/report state без network. Fixtures port0,65536,65537,too-long digits не открывают socket и не рекомендуют неверный endpoint. Это статическая ошибка conversion, не проверка текущих портов Mac.

## 2. Реальные implemented flows

### Detector CLI: argv → target dispatch → raw checks → waivers → output

`cli.rs` прочитан целиком, включая tests. `:697–864` нормализует legacy flags, scopes, viewport, CDP/target, config и base ScanOptions. `--no-config` отключает не только project ignores, но inline ignores и DS; `--report-unused-ignores` требует inline support. Конфликты wiring/catalog/changed/CDP/formats отвергаются до engines (`:870–954`). Неизвестные `--...` не имеют общего reject branch: targets собираются как все аргументы без `--` (`:859–864`), поэтому отсутствие ошибки на typo не значит распознанный flag; blanket strict-parser claim делать нельзя.

- CDP: loopback parser с bracket IPv6/IPv4-mapped loopback и restricted page/browser ID; attached engine получает base без local DS (`:990–1022`). Не меняет viewport этим layer; действительные browser invariants ниже по стеку здесь не перечитаны.
- Changed: `changed.rs:25–35` вызывает git без optional locks, status porcelain NUL (`:52–68`), cwd subtree prefix, rename/copy source field пропускается; extensions/skipped dirs/generated/regular file filters (`:86–105`). git errors объединены в None, CLI exit1 и не читает stdin. Удаления/подмодули не сканируются. Lossy path conversion есть, byte-perfect nonUTF8 filename support не обещать.
- Stdin: parsed tool envelope существующего file_path направляется на local engine; иначе текст сканируется как `<stdin>` (`cli.rs:519–558`). Это не весь hook event validation. Io lazy input capped64MiB и lossy decoded (`common/lib.rs:77–89`), truncation/read-error не выдаются отдельным состоянием на уровне Io.
- Local: configured suffix выбирает html/text engine (`file_system.rs:77–83`), text path требует valid UTF8 (`cli.rs:446–458`), static HTML read сохраняет lossy bytes при повторном чтении waivers (`:488–503`). Directory import graph тоже lossily decoded; не отвергает HTML до engine.
- URL multiple: shared browser создаётся для нескольких URL, launch error отмечается operational и skips URL, локальные targets продолжаются; close после scan_targets и до propagation (`:1037–1068`). Недостаточно для общего утверждения о cleanup при panic/process kill; отдельный signal test описан ниже.
- Directory: walk callback errors и graph read errors записываются как operational failures (`:1433–1470`); imports добавляются как importedBy metadata, не полное module resolution. Large scan >500files или >50HTML спрашивает confirmation только interactive text (`:1443–1460`). Отказ — exit0 с Aborted, не «scan passed».
- Findings: unused waiver reports временно отделяются, затем config/value/scopes/advisory filtering, после health snapshot возвращаются в primary findings (`:1075–1179`). Operational exit1 имеет приоритет над primary findings exit2 (`:1180–1189`); advisory не блокируют. Empty JSON `[]` сам по себе не доказывает successful complete scan — учитывать exit.
- FullScan health snapshot возможен для одного directory без scope/changed/CDP/operational errors; ruleset учитывает ignore inputs, DS contents без absolute paths, flags и extensions (`:1091–1171`). «Whole» здесь означает полноту selected walker policy, не все bytes repository: skip/ignores сохраняются.
- Regex-only note честно говорит undercount и отсутствие element checks (`:1279–1313`), но в structured/quiet modes не выдаётся этот human note (`:1069`). Нельзя выводить computed a11y из clean regex output.

### Config/ignores: не просто blanket exceptions

`config.rs` полностью прочитан. Merge shared→local, legacy hook→detector в каждом документе (`:234–254`); ignore arrays union, entries по rule/value/sorted-files key, later entry metadata заменяет прежнее (`:713–730`). Local пустой список не отменяет shared ignore. Extensions longest-suffix (`:197–220`) локально могут переназначить engine.

Ignore value нормализует quotes/plus/whitespace/case; для `design-system-color` дополнительно canonical RGB/HSL/hex RGBA (`:390–615`), не все CSS color spaces. Globs anchored, но проверяются path и basename (`:809–827`); scoped value matcher дополнительно пробует suffixes absolute path (`:904–920`) — scope не равен exact canonical identity. `*` без file scope не suppresses (`:893–900`), add-value proactively отказывает (`ignores.rs:162–163`). Exact values только шести extractable rules; inert entry rejected (`ignores.rs:381–387`, config.rs:923–964). Reason/createdAt сохраняются, но не являются авторизацией waiver.

`ignores.rs` полностью: list не пишет, mutations default shared; scope flags mutually exclusive; broad overused-font requires --all-values. add existing value меняет reason только непустым новым, remove scoped value требует тот же files set, а не «удалить все значения с rule». Local mutation дополнительно best-effort пишет common gitdir info/exclude (`config.rs:268–269,1095–1133`). Это side effect вне config.local.json, включая linked worktree common gitdir.

`unused_ignores.rs` полностью с tests: engine raw findings → одна parse/apply inline-waiver операция → warnings только по rules, которые могли сработать (`:107–155`). Unknown prose tokens исключены, CSS не объявляет low-contrast waiver stale, DS check judge только при реально loaded соответствующей token family; `*` always judged. Partition защищает report от subsequent --scope/ignoreRules. Это полезный anti-stale-waiver механизм, а не justification проверки человеческого reason.

### Project custom properties и design checks

`project_tokens.rs` полностью: nearest package внутри nearest git, затем shared checkout root; без markers own directory. BFS sorted shallow-first stylesheet walk, first declaration wins, local sheet tokens перекрывают project tokens. Ограничения 2000 sheets/100000 entries/512KiB per sheet, regular symlink_metadata files only, no dependency/build/vendor/hidden recursion (`:22–31,88–138`). Per-root и roots-list Rc caches (`:140–179`). Это справочник для stripe colors при `var(`+inset/border, **не computed cascade/theme state**; ошибки чтения и budgets дают неполную карту без typed unknown report.

Полностью изученные rules:

- `hard_offset_shadow.rs:9–39`: cssparser сначала валидирует весь shadow list; malformed/unresolved любой слой прекращает check. Hit только outer, blur=0, spread≥0, max abs offset≥4px, colorAlpha×opacity>.1. Non-px lengths unknown, кроме нулей допустимых units. Tests проверяют malformed second/first layer, functional/currentColor colors, boundary precision, transparent/inset/spread exclusions. 4px — taste review threshold, не standard; рекомендация — проверить intent, не глобально удалить shadow.
- `row_stripe.rs:503–595`: selector subject row/cell/ARIA/class с исключением pseudo-arguments/layout utilities. Row/card treatment различается; border/inset stripe2..6px, within-block cascade+!important, transparent/faint, narrow≤40px, frame/sibling gridline/hairline exemptions. Status/selection/hover stripes всё равно могут быть side-tab finding: upstream opinionated ban не автоматически ошибка task semantics. Logical inline sides здесь прочитываются LTR (`:89–103`), не полноценный writing-mode engine. Tests демонстрируют позитивные и негативные twins и project-variable fallback.
- `sampled_contrast.rs`: fixed6×6 grid, минимум75% resolved, p90 threshold3/4.5; nearuniform failure лишь при очень большой плохой части raster (`:461–507`). Text/placeholder gates, glyph/transparent/clip/ink unread exclusions, same-ink compositing; uniform wash и background extent/repeat/position/attachment logic. Unknown layout/малый decor не дают измерение. `Sampled::Pass` означает «coarse sampler не доказал nearuniform failure», **не фактический контраст текста в его расположении**; test split-light/dark допускает Pass (`:801–808`). Image IO/decode dependency принадлежит html crate, не этому pure module.
- `script_errors.rs:23–39`: React recoverable hydration allowlist418/419/422/423/425 и Chrome interrupted-play AbortError advisory; другие crashes/aborted fetch продолжают failing. Это message classifier, не доказательство, что конкретный пользователь не увидел regression.

Большие `regex_matchers`, `detect_text`, `design_system`, `html_patterns`, browser `page_checks` НЕ дочитаны; отсюда нельзя выводить исчерпывающий список/корректность всех detector checks.

### Machine outputs и preservation check

`github_annotations.rs` полностью: advisory notice/error exact severity/otherwise warning; % escaped before CRLF, properties additionally colon/comma (`:16–45`); workspace before cwd path (`:62–81`), no actual upload. Tests cover malicious-looking delimiter values, workspace nesting, URLs, no-line, deterministic order.

`sarif.rs` полностью: rule descriptors catalog order только emitted rules плюс fallback для noncatalog, consistent ruleIndex; URI escaping spaces/#/UTF8 bytes/first-relative-segment colon; outside workspace absolute file URI без SRCROOT; finite line1..u32 floored. Partial run has executionSuccessful=false+error note (`:74–80`), clean run still valid empty log. Source line hash оставлен uploader. Formatter не проверяет, что uploader уважает partial marker; CI consumers должны явно отказать operational partial.

`list_rules.rs`: registry/order/scopes/advisory-aware catalog, JSON metadata, no engines. `profiler.rs`: optional programmatic timing, finite normalization, first-seen finding IDs, stable total-time sort/group p50/p95; no exposed CLI --profile. `detect/skills.rs` — legacy stub с not-implemented exit1, **не actual whole application's installer**; реальные router/skills crate из предыдущего отчёта нельзя заменить этим файлом.

`wiring.rs` полностью: before→static HtmlEngine inventory→schema1 target-relative saved JSON в ignored project `.impeccable/wiring`; kept→read/schema/target validation→multiset subtraction preserves duplicates. Missing wiring fails1, unable compare2 dominates; new wiring и headings/alt content только informational (`:400–526`). Project root avoids logical/canonical home, shares ancestor DESIGN boundary. Hash whitespace JS conservatively сохраняет strings/regex/comments/newlines/template literals; это не behavioral equivalence parser и не cryptographic guarantee. Static HTML only; functional handlers/server effects не исполняются. Owner Friday может позаимствовать multiset guard, но не называть его functional regression suite.

## 3. Common runtime: side effects и error behavior

- `lib.rs`: Io separates verb streams/env/cwd, only binary exits. Unicode-invalid env dropped via vars_os instead of panic. stdin cap64MiB but partial read/truncation silent. out/err discard write errors (`:117–122`): exit0 не гарантирует delivery stdout при broken pipe/disk.
- `fsx.rs`: write sibling temp→copy permissions→rename, errors cleanup; follows existing/dangling symlink targets; symlink cycle intentionally replaces original link. Permissions-copy Result ignored, no fsync or exclusive temp create: atomic visibility не равно durability/безопасная sandbox. Unit tests cover replace/no leftover/link/dangling/cycle.
- `git.rs`: parses `.git` file/commondir from disk, no git child. ensure ignored runtime output writes/appends `.gitignore` best-effort, errors don't block protected write; tracked artifacts stay tracked. release touches only file with engine header, preserves unrelated lines.
- `proc.rs`: positive pid guard kill0/EPERM alive, termination errors ignored, Unix setsid/Windows detached flags, shell/PATH tool probes, singleton interrupt handler state, SIGPIPE ignore. `spawn_refresh_args:328–339` detached self with env/null IO, no result propagated. Windows spawn temporarily clears inheritable standard handles with RAII restoration; это process-wide handling, не все concurrent behavior доказаны тестами.
- `prompt.rs`: piped answers trimmed/lowercase, interactive Unix raw-mode render/radio/search-checkbox with CtrlC/EOF and Drop termios/cursor restoration; Windows line fallback, not raw interactive support. Explicit parity quirk: DEL backspace appends U+007F to checkbox filter (`:295–305`), не образец UX для копирования. UTF16 code units for cursor != grapheme/display-cell width.
- `steps.rs`: real terminal checks, plain CI/NO_COLOR/no-browser, spinner thread joins on Drop, held stderr capture; OSC8 hyperlinks excluded tmux/screen; typeahead flush before choice protects unintended consent. Progress SIGINT handler disarm restores default, не previous (`:239–252`); не доказана безопасная composability с другим signal owner.
- `launcher.rs`: pure printed PowerShell .cmd commands quoting, smart/ASCII single quote doubling and call operator; no execution. `text.rs` UTF16 helper; `flow.rs` Exit/Abort/Throw vocabulary.
- `jsp.rs`: lexical platform Node path semantics posix/win32 including drive/UNC, normalization, resolve/relative and suffix helpers; не canonicalize filesystem. win32 drive-relative environment `=C:` intentionally replaced root fallback (`:519–522`). Boundary policy вызывающего кода не выводится из lexical normalize.
- `seed.rs`: key128bit OS random, clock+pid hashed fallback only on generator error; salt home→ignored project with create_new, corrupt salt doesn't get silently replaced, existing project salt keeps refs when home becomes writable. References64bit salted tag; ledger holds key, unsalted legacy never committable ref. `reference_for_key:286–289` может создать salt — название helper не делает его read-only. Test override arbitrary string deliberately supported; not production CSPRNG claim.
- `http.rs`: complete source/test read. Request head/body limits, exact short upload rejection, Expect100 behavior, chunk payload overflow guard; SSE close watcher, Exchange unanswered Drop500, SerialServer thread/connection then queue, total10s watchdog plus socket timeout. Turnstile ticket issued accept order, parse parallel then wait; Drop releases, read-only/parked routes must release early per caller. Tests validate slow generate/checkpoint race, silent earlier connection deadline, burst idle sockets, server port release. Metadata cap hole C5-R2 остаётся; unlimited connections/threads/queue не подменяются claim «localhost значит безопасно».

## 4. Что доказывают прочитанные integration tests — только intent

Все перечисленные test files прочитаны полностью; ни один не запускался.

1. `non_utf8_env.rs:14–43` — context/detect binary smoke с invalid env value; это не nonUTF8 path test. `detect_html_bytes.rs:3–68` — text invalidUTF8 operational1 без ENOENT mislabel; static HTML explicit/directory parity на legacy bytes и UTF8, findings exit2.
2. `pro_dispatch.rs:34–100` — signed fake release/lease, scan-only Pro shell child; recursion/self override/off guards, first human scan notice only once, JSON no notice, unsigned-in OSS silent. Fake account helper и actual verify implementation вне прочитанного scope.
3. `setup.rs:34–86` — hooks/probe не отправляют setup reports, doctor detached/dedup, off/forget and unconfirmed remote deletion can't claim deleted. Прямое свидетельство, что harmless-looking doctor может schedule network; consent setup fixture заранее enabled.
4. `live_server_security.rs:105–156` — source symlink outside403/internal200/broken404, live JS project ignores reasons omitted, page-controlled forged `_instructions/_completionAck/_acceptResult` stripped before poll. `:243–259` — discard page+ref не стирает другие edits/другую страницу. Token/Origin implementation не становится full от наличия теста.
5. `serve_question_security.rs:73–142` — no/wrong key401, foreign Origin/Host403, GET host, malformed target400, key embedded all POSTs, font routes absent, successful answer persists. Не полное доказательство CSRF/XSS/server safety.
6. `support/capture_service.rs` — helper native capture-server bound registered project/capability/review session, startup timeout cleanup and Drop kill/wait; capability в fixture computed from nonce, не анализ production generation.
7. `shot.rs:38–97` — usage/missing/out flag failures2, default PNG dimensions/two paths/gitignore/fullpage, self-scroll smooth page captured from top. Browser availability causes skips; screenshots не открывались этим аудитом.
8. `browser_signal_reap.rs:47–115` — navigation held endpoint, Unix SIGTERM/INT/HUP exit signal preserved, no Chrome helpers/profile leftovers after bounded wait. Browser/pgrep absent skips; тест сам выставляет default signals.
9. `component_capture.rs:89–134` — real static component/raster evidence, controls/svg/raster counts, declared CSS dependencies, repeat revision stable, missing dependency rejects without replacing session, scriptful source refused. Это strong test intent против «manifest есть значит capture valid».
10. `asset_capture.rs:140–294` — resource bytes и painted contribution различаются; hidden/opacity/clip/occlusion/outregion/wrong URL, duplicates combined contribution, canvas/closed shadow/animations/mutations ambiguity unavailable, poisoned page geometry не должна подменять result. Tiny token не получает adequateVisibility. Browser absent skips; production CDP implementation не прочитана здесь.
11. `motion.rs:11–246` — packets before/first/last/settled, files exist, content swap/clipping/paint-order/start-end jumps/entrance/crossfade/orphan/end-paint, rates/reverse, open shadow/pseudo identity, paired reduced variants и setup open→exit. Это temporal evidence test intent, не доказанный smoothness каждой UI.
12. `rule_pack.rs:120–272` — NONE vs source/static/browser hooks, HTML text fallback without static hook, shorthand/native router, hook/pre-edit composition и Stop baseline только added pack finding. Browser unavailable skips.
13. Provider tests: OpenCode correct global env/XDG bridge destination/migration preserves unrelated (`provider_commands_tests.rs:59–197`); Muse global-only custom-skills даже project selection, links preserved/current checks non-vacuous (`muse_bundle_layout_tests.rs:50–273`); DSH home confinement, Replit `.replit` owns `.agents` vs Codex (`install_detection_tests.rs:40–182`); explicit pick installs missing provider while detected-only leaves unrelated (`install_picker_tests.rs:73–129`). Эти test contracts не доказывают live harness discovery.
14. Hermes plugin tests `:68–206`: **project install всё равно пишет home plugin**; HERMES_HOME relocation constrained under home, partial repair, absent bundle skip/half error, repeated enable reminder until config enabled. Fixture Python plugin stub, не actual loaded Hermes plugin. No native Codex claims.
15. Exec modes `install_exec_bits_tests.rs:61–134`: ZIP extraction/copy yields exec launcher+binary, no exec on Markdown. Launcher contract `:21–185`: strings pin URL/handshake/checksum/certutil/errorlevel/no parse blocks; Unix stub asserts env before override exec. Windows string guards не Windows runtime PASS.
16. `foundations-scan/tests/listing.rs:43–188`: host multi-pass finite wanted, no ignored reads, capped tree absence stays unknown, secrets-off no whole-file fetch, budget and streaming facts retention, oversized input not requested. Useful anti-vacuous-green contract, actual scanner implementation outside read scope.

## 5. Friday: доказанные deltas, не повторный перенос doctrine

Локально полностью перечитаны `.codex/scripts/design-lint.mjs` и `.codex/scripts/lifecycle.py`; их hashes в ledger. `CODEX.md`/review-loop прочитаны как контекст. Live hooks/runner не проверялись.

| Capability | Friday state / evidence | Полезная дельта и acceptance |
|---|---|---|
| Changed UI discovery | **already implemented:** lifecycle.py:39–44,117–139 включает dirty/untracked + payload, canonical root confinement и content hash; не советовать «первый changed scan» | Owner local lint: общий explicit extension set для edit/full scan. design-lint.mjs:269–272 full walk только TSX; regression CSS/JSX/Astro не пропускаются. |
| Operational/unknown vs clean | **partial:** design-lint.mjs:283–300 пропускает nonexistent и always exit0; lifecycle.py:163–166 caches even ERROR findings | Owner QA/scripts: typed completed/partial/failed/unsupported + files_scanned. SARIF invocation-false и listing capped unknown — хорошие upstream contracts. Test zero/missing/unreadable target не «Проблем не обнаружено». Advisory policy не менять без явного решения. |
| Machine report | **partial:** internal rule id/level есть в объекте (design-lint.mjs:232–238), printed result не несёт ID и нет JSON/SARIF (287) | Owner lint: JSON stable id/file/line/severity/scanned/skip/error; optional SARIF adapter с proper escaping и partial execution flag. Test colon/comma/newline/Unicode path and partial+findings. Не внедрять Rust runtime ради formatter. |
| Exceptions | **absent in inspected lint:** no structured value/file waiver mechanism в полном design-lint.mjs | Owner design doctrine/scripts: только если действительно нужны legitimate brand exceptions, rule+value+file+reason и stale waiver checks. DS missing/regex unsupported не объявлять stale. Test wrong file/new reintroduction stays visible. Не копировать permissive basename/suffix matching без выбранной scope policy. |
| Refine preserves behavior | **absent in inspected lint/lifecycle:** no multiset wiring snapshot | Owner UI QA: optional before/after DOM inventory for approved preview with duplicate counts+form names/labels/test hooks/links; changed/missing vs cannot compare separate. Doesn't replace actual task tests. Headings/alt upstream only informational — Friday accessibility owner решает отдельно. |
| Rendered contrast | **not equivalent:** gray-text-on-color-bg regex in design-lint.mjs:21–26 does not calculate ratio | Owner design tooling: label heuristic honestly; real browser computed evidence отдельный слой. Sampled coarse Pass не canonize как WCAG AA, layout unknown not checked. Test image split/position/overlay semantics. |
| Side borders/shadows | **partial:** Friday blanket border-l/r-4 regex:29–32 vs row/gridline/cascade distinctions | Owner design rules: avoid false positives for table gridlines/status semantics, explicit intended-direction exceptions. Hard-offset4px taste threshold не standard; только advisory in correct scope. |
| Motion evidence | In inspected scripts **absent**; broader Friday doctrine не переаудирована этим worker | Owner motion/design QA: paired normal/reduced packet before/first/mid/last/settled + exit setup/interrupt, fixture detection of end-paint swap, not one still screenshot. Preserve Friday motion wrapper, no hidden browser install/production clicks. |
| Optional install isolation | Friday policy only разрешённый scope; upstream tests explicitly globalize Hermes/Muse | Owner integration/security: future optional pilot touched-path plan includes home plugins, enable/reload/trust explicit. Project flag не equal no-global-side-effects. Test unrelated Friday hooks/config unchanged, and copy presence != loaded runtime. |

Предыдущие content/runtime отчёты сохраняют authority для уже сделанных doctrine comparisons; их statements не повышены до independently verified нами за пределами двух локальных scripts. Добавлять duplicate polish/anti-slop rules не требуется. Source-only audit не разрешает cloud reports, account login, Pro download, native service, plugin enable или изменение клиентского проекта.

## 6. Точный остаток (не full inventory)

Каждый gap имеет per-file sha256/status/ranges/total_lines/substantive_note в `impeccable-close-5-coverage.json`; `remaining_gaps` пригоден для следующего assignment. Не назначать full этим путям по упоминаниям callers/tests:

- `crates/detect/src/design_system.rs` 1–2725;
- `crates/detect/src/regex_matchers.rs` 1–3664;
- `crates/detect/src/detect_text.rs` **181–2809** (1–180 только prior read);
- `crates/core/src/browser/page_checks.rs` 1–10136;
- `crates/core/src/checks/html_patterns.rs` 1–1404;
- `crates/skills/tests/drift_ports_tests.rs` 1–1593;
- `crates/skills/tests/hook_manifest_tests.rs` 1–1463;
- `crates/cli/tests/walkthrough.rs` 1–474;
- `crates/cli/tests/health.rs` 1–1408;
- `crates/cli/tests/entry_capture.rs` 1–337;
- `crates/cli/tests/capture_snapshot.rs` 1–519;
- `crates/cli/tests/world.rs` 1–363;
- `crates/cli/tests/foundations.rs` 1–415;
- `crates/cli/tests/agent_target.rs` 1–1047;
- `crates/cli/tests/first_viewport.rs` 1–357;
- `crates/cli/tests/account.rs` 1–778;
- `crates/cli/tests/text_only_entry.rs` 1–601;
- `crates/cli/tests/critiques.rs` 1–1233;
- `crates/cli/tests/loop_connect.rs` 1–1902;
- `crates/cli/tests/support/loop_install.rs` 1–489.

Дополнительно к этим assigned gaps: полный read файла не означает full transitive implementation его imports. Внешние для assignment engines/html/browser/account verification/installer providers/hook_manifest/bundle и actual host behavior должны быть объединены с coverage других workers, не засчитаны через test intent. Здесь no tests run, no browser availability probing, no network/supply-chain CVE audit. Findings не исправлены из-за audit-only.

Созданы только собственные `impeccable-close-5.md` и `impeccable-close-5-coverage.json`. **Доставлены содержательный промежуточный audit и точный continuation ledger; требование fully close остаётся невыполненным.**
