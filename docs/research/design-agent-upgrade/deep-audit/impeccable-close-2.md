# Impeccable close-2 — полный статический проход назначенных исходников

**Вердикт по чтению assignment: ЗАКРЫТО — 76/76 файлов, 51 071/51 071 строк.** Все назначенные файлы действительно прочитаны целиком, включая встроенные тесты; усечённые батчи дочитаны. SHA-256, полные диапазоны и содержательные заметки по каждому пути — в `impeccable-close-2-coverage.json` (`complete: true`). Это закрытие назначенного чтения, не runtime PASS, не разрешение install/rollout и не заявление об аудите всего репозитория. Предыдущие `impeccable-content.md`/`impeccable-runtime.md` не перезаписаны.

## Рамки

Hermes researcher, адаптация роли Friday, не native Codex. Upstream `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. Только чтение исходников и тестов; никакого запуска upstream, build/install/import, тестов, hooks, браузера/сервера. Статические выводы не являются воспроизведёнными runtime-дефектами. Файлы исходников не менялись. По исходникам предполагаются эффекты, но они здесь не выполнялись.

## Подтверждённые статические риски

### 1. Высокий: accept/discard может выдать успех и сохранить receipt после неудавшейся записи source

`crates/live/src/live_accept.rs:789–806,1003–1012`: результат `std::fs::write` отброшен, возвращается `Ok`. `:344–361` сохраняет успешный receipt, `:314–341` следующий вызов возвращает alreadyApplied, не проверяя файл. `:581–625` может дополнительно очистить staged ops. Условие — отказ записи (permissions/disk/IO), а не обычный happy path. После повторного запуска механика уже не пробует запись. Аналогичные ложные успешные результаты у wrap `live_wrap.rs:425–431`, insert `live_insert.rs:344–379`, manifests/gitignore/inject helpers. Прочитанные accept tests проверяют positive cases и marker refusals, не отказ FS.

**Friday delta:** контракт успешной операции должен требовать durable write + readback точного target; успешный exit code/JSON не достаточен. Не переносить auto-write live subsystem без обработанных IO errors, atomic writes и fault-injection tests. Предлагаемый владелец: runtime/tooling maintainer; target — будущий адаптер, не текущий клиентский сайт.

### 2. Высокий: journal durability не равна принятому событию

`crates/live/src/session.rs:121–169`: append `write_all` ошибку игнорирует, reducer/snapshot продолжают работу; Result не удостоверяет запись. Snapshot writer `:932+` также best-effort. `live_server.rs:1784–1786` ACK снимает pending, затем только `:1871–1905` пишет reply journal, Result отброшен; между ними compile failure может вернуть422 (`:1851–1866`). `server_state.rs:343+` реализует снятие pending. Разрыв process/crash/IO способен оставить потерянное событие/расхождение snapshot и journal. Это не доказанный exactly-once протокол. Запись source, buffer и journal — разные consistency domains.

**Friday delta:** взять eventId/lease/status/recovery как модель, но ACK-after-fsync, единственный writer/CAS и replay tests — обязательная отдельная инженерия. До неё live import отклонить.

### 3. Высокий: framework adapters недостаточно защищают чужой файл и production

`inject/sveltekit.rs:95–115,126–145,241–244`: root component перезаписывается и удаляется по фиксированному пути без проверки managed contents. `:259–264+` onMount загружает helper; dev-only guard не встроен. `inject/tanstack.rs:70–99` apply проверяет managed conflict, но `:104–117` remove удаляет component без аналогичной проверки. `:29` поддерживается Solid Start, а `:172–182` генерируется React/useEffect. При сохранённом injection production bundle может монтировать helper, несмотря на output `devOnly:true` (`:99`). `live_boot.rs:228–254` вызывает injection, но не добавляет build-time dev guard и при inject failure не останавливает уже стартовавший helper. Это риск сохраняющегося source injection; не утверждается, что любой stop обязательно оставляет его.

**Friday delta:** не переносить адаптеры как готовую capability. Нужны no-clobber по content hash, managed-only remove, framework-specific runtime, compile-time dev gating и production artifact negative tests.

### 4. Средний: CSS reconciliation ошибочно объединяет разные selectors

`accept_css.rs:300–303`: whitespace collapse и combinator tightening применяются к whole prelude, включая quoted attribute values. Следовательно `[data-x="a > b"]` и `[data-x="a>b"]` получают один normalized key; это разные значения атрибута. Merge по ключу может заменить body чужого селектора. Это вывод по коду, пример здесь не запускался. Нужна token-aware normalization, сохраняющая строки/escapes; regression — оба правила сохраняются раздельно.

### 5. Средний: Svelte compiler bridge — исполняемая project dependency и блокирующий protocol

`svelte_bridge_helper.mjs:1–73` загружает compiler через project createRequire, проверяет major>=5, parse/compile(generate:false); Rust `svelte_bridge.rs:1–171` держит persistent Node child под cache mutex, JSON-lines read без общего timeout/лимита строки. Это не pure parser: исполнится код project compiler. Зависание/неверный stdout может блокировать ветку. Error -> None понижает качество анализа, а не подтверждает валидный source.

**Friday delta:** любые untrusted repo modules только sandboxed/opt-in subprocess с deadline, byte limits и process-group cleanup. В данном аудите ни Node, ни compiler не запускались.

### 6. Средний: collect/check WASM config parity не гарантирована

`crates/wasm/src/lib.rs:30–48` installed RulePack передаётся в collect config; `dom_source.rs:116+` one-shot путь берёт десериализованный/default config без такого присваивания. Видимая асимметрия требует отдельного parity test; итог зависит от downstream collector и установленного pack, поэтому не заявляется универсальное отсутствие checker rules. JSON failures во многих exports дают []/null/default, а не typed error.

### 7. Средний: bake нескольких файлов не транзакционный

`bake.rs:550–589` apply сначала append внешнего CSS (:587), затем source write (:589); `live_accept.rs:965–989` при ошибке bake переходит к carbonize без rollback добавленных rules. Нужны journaled multi-file transaction/rollback или refuse-after-partial-write; source lock одного source не сериализует общий stylesheet.

### 8. Высокий: copy-edit worker запускает агент без sandbox/approvals, а prompt не граница доступа

`copy_edit_agent.rs:1508–1565`: Codex получает `--dangerously-bypass-approvals-and-sandbox`, Claude — `--permission-mode bypassPermissions`; `:1575–1590` задаёт cwd и переданный env, но не изолирует файловую систему/сеть. Auto selection `:1300–1387` считает не-Claude provider доступным после успешного `--version`, не реальной auth-проверки; Claude делает отдельный ping. Prompt называет customer text буквальными данными, перечисляет только project candidates и требует JSON result, но это policy для модели, не enforced capability boundary. Rollback охватывает известный список файлов, не произвольные другие записи/сеть/процессы subprocess. **Не запускалось; это явные аргументы executable, не доказанный exploit.**

`copy_edit_agent.rs:466+` дополнительно исполняет project validation shell command; JSON schema валидирует отчёт, не поведение агента. Runtime эту цепочку имеет, поэтому переносить как «read-only copy edit» нельзя. Proposed owner: coding-tooling/security maintainer (в этой задаче не назначен). Target: будущий isolated copy worker, не roles/configs сейчас. Expected output/test: explicit provider+consent, scoped credentials-free environment, sandbox deny sibling paths/network, детерминированный patch proposal до approve; injection/failed-auth tests. До этого **reject runtime import**.

### 9. Высокий: Svelte accept не проверяет, что исходный диапазон остался исходным

`crates/live/src/svelte_component.rs:1389–1393` использует originalMarkup только для восстановления attributes; `:1420–1456` заново читает source и проверяет integer/in-bounds range, но не сравнивает текущие строки с originalMarkup/hash перед splice. Даже с внешним source lock это не обнаруживает правку человека после preview: старые номера строк могут оставаться допустимыми и указывать на другой фрагмент. В отличие от generic write, Svelte source-write Result проверяется; проблема здесь именно stale locator, не игнорирование write. **Static risk, сценарий не исполнялся.**

Friday delta: CAS source fingerprint и unique AST/text relocation с отказом при divergence, затем atomic write. Proposed owner: preview/source-transform maintainer. Expected negative test: вставить строку до target/изменить target после preview → accept обязан вернуть conflict и сохранить source.

### 10. Средний: copy verification допускает слабое доказательство удаления, buffer cleanup не durable

`manual_edits/commit.rs:836–897`: отсутствие originalText в строке target сразу считается успешным deletion; out-of-range строка становится пустой. Если прежняя строка сдвинулась, проверка может принять отсутствие в старой позиции, не доказав удаление в документе. Nearby windows и locator search улучшают replace, но не превращают этот shortcut в проверку identity. `:1185–1200` clear_applied_entries игнорирует write_buffer Result: отчёт о cleared count не подтверждает durable removal. Внешняя проверка editedFiles и coupled object keys полезна, но это отдельные guards.

Friday delta: delete receipt обязан связать before-hash/уникальный locator/after-diff; buffer clear с generation CAS и propagated error. Proposed owner: manual-edit transaction maintainer. Expected tests: line-shift deletion, duplicate text, readonly buffer; нельзя сообщать cleared/success при оставшихся entries.

### 11. Средний: rollback transaction может потерять данные для повторного восстановления

`manual_edits/apply.rs:1185` сохраняет пустую content при существующем, но нечитаемом source (`safe_read(...).unwrap_or_default()`). `:1231–1295` собирает restore_failed, после чего всё равно удаляет transaction. Это отличается от гарантии «rollback восстановил всё»: при write failure остаются failures и может исчезнуть persisted recovery descriptor. `commit.rs` snapshots/rollback и conflict detection дают реальную защиту, но не покрывают чужие незаявленные файлы subprocess и concurrent human edits без CAS.

Friday delta: snapshot read failure → abort before mutation; retain recovery record до подтверждённого restore, per-file before/after hashes. Proposed owner: transaction/recovery maintainer. Expected tests: unreadable-before snapshot; restore permission failure→record сохраняется; late reply/cancel не затирает новую human edit.

## Дочитанная цепочка manual-edit / Svelte / document model

- **Evidence → batch:** `manual_edits/evidence.rs` строит page/sourceHint/locator/text контекст; original/new text и before snapshots, до16 hints, bounded text и capped matches; filesystem discovery depth7, не полноценный JS/TS module resolver и не глобальная uniqueness proof. Explicit hint lexical checks не заменяют canonical symlink fence.
- **Direct commit:** `manual_edits/commit.rs` strict buffer → candidates → provider/mock batch → validate applied/failed IDs и editedFiles → coupled object-key/source verification → post-apply checks → retry/repair1–10 (default3) → buffer clear. При agent error/unreported changed files/conflicting IDs пытается rollback; exhausted repair оставляет modified source с needsDecision. Exit/JSON success нельзя приравнивать atomic all-or-nothing transaction.
- **HTTP/chat apply:** `manual_edits/apply.rs` chunk3 ops (clamp1–20), per-page in-flight gate, snapshot/persisted transaction, result membership/count validation; default hard timeout150s, soft120s, tombstones/late-result rollback, cancellation. Strict result schema не доказывает, что source верен; durable buffer/transaction writes местами best-effort.
- **Provider/process:** `copy_edit_agent.rs` выбирает codex/claude/chat/mock, генерирует JSON schema/prompt/log/result files, опрашивает child и post-checks; missing node/Babel может означать skipped check, не parse-pass. `server_state.rs` и copy worker после child termination ждут pipe readers; descendant с открытым FD может держать join. Validation command собирает output после wait, большой pipe может привести к timeout. Это статические blocking/resource риски, не измеренные hang.
- **Svelte compiler:** `svelte_bridge.rs:38–86` запускает Node helper и line JSON protocol; `svelte_bridge_helper.mjs` через project createRequire грузит установленный compiler>=5. Поэтому parse/compile являются исполнением project dependency, не чистым Rust JSON reader. Bridge read_line синхронный без локального request deadline; SharedBridge Mutex сериализует запросы. Не запускалось.
- **Svelte AST:** `svelte_ast.rs` UTF16 ranges, lexical scopes и free expressions превращает в props/contract, сохраняет loop/local bindings. Each-key+displayed-field ambiguity, mixed local/global/complex destructuring не «исправляются» угадыванием; есть отказ. Unknown AST обход не равен compiler semantic proof. Обратная property substitution имеет precedence/name-collision ограничения; fallback без compiler не равен AST branch.
- **Svelte preview:** `svelte_component.rs` extraction/seed CSS → helper variants под node_modules → restore contract/attrs → source splice/CSS merge/prune → cleanup. Regex script/style/top-attr extraction и compile-warning pruning не универсальный Svelte formatter. `:1711–1731` отсутствие compiler возвращает ok:true, checked:0 — **not-measured**, не подтверждение compilability. `svelte_sessions.rs` занимается manifest lookup/revision/cleanup, а не отдельной security boundary.
- **DESIGN.md:** `design_md.rs:98–352` — subset frontmatter/YAML, не полный YAML; `:599–645` canonical section mapping/repeated section replaces; `:1600–1647` восемь display sections/schemaVersion2. Headings в code fence не экранированы полноценным Markdown parser. Color regex/вырезание shadow не CSS validation; golden `:1677–1678` закрепляет в том числе shadow rgba без закрывающей скобки. Использовать как presentation adapter, не авторитетный token compiler/validator.

## Реальное содержимое checker (не путать со skill prose)

`crates/core/src/checks/rules.rs` прочитан целиком вместе с unit tests. Это pure policy над подготовленными facts, а не screenshot AI. Border/card/circle/status gates (:332–439); gray text on colored surfaces/state-variant parsing (:488–610); color-pair dedup с provisional ownership и заменой частично видимой копии fully on-screen (:612–805); contrast thresholds 4.5/3 и advisory near-bar по **округлённой отображаемой** ratio (:862–879,1467–1550; tests :3891–3907). Advisory всё ещё fail threshold, не WCAG pass. Heavy-face font compensation (:894–934), gradient/alpha uncertainty и clipped-gradient text (:1203–1600), placeholder/hover (:1602–1685). Icon tile (:1707+), italic serif/hero eyebrow/kicker (:1830–2078), motion (:2079+), glow (:2116–2380), flat type hierarchy учитывает role/size/weight (:2384–2525+). Не всё является universal accessibility violation: часть — house-style heuristics.

`browser/background.rs` полностью: geometry-aware samples/gradient composition, ancestor surfaces, белый canvas fallback; legacy solid-background lookup и contrast lookup имеют разные alpha gates. URL/сложные поверхности могут давать unknown, не pass. `browser/painted.rs` прочитан целиком (6062 строки, implementation и все inline tests). Это gate для Text/Box/Raster/Toggle, не просто display:none: mask alpha/ancestor clipping/inert modal burial/1px glyphs с drawn scale/backface inverse normal, 25% horizontal и 50% single-line vertical share, ellipsis/carousel/page-shell distinctions. Scroll frames отличаются от collapsed panels по geometry/flow; обход content budget2000 сохраняет uncertainty. `:2097–2194` finite opacity animation end до60s и running/keyframes/composition определяют settled state; `:2552–2739` scroll timeline/entrance end opacity отличается от captured. Lazy/class-reveal/crossfade и colour-reveal эвристики исключают временные состояния, но могут пропустить реальный дефект, который имеет ту же структуру. Unknown metrics часто сохраняют finding, не исключают его. Tests используют FakeDom и should-flag twins, не реальные browser pixels.

WASM exports_visual — только typed wrappers над vc и raster samples; js_dom — DOM shim/memo/error sentinel, dom_source — snapshot-or-fresh selection/reset. Bundle lib собирает JS assets и WASM capture contract; это не самостоятельная реализация правил. `wasm_pack_build` действительно может spawn build при вызове; в аудите не вызывался. capture-schema unit tests прочитаны, не запускались.

## Trace и side effects прочитанных live веток

- roots → persisted manifest → pointer (несколько кандидатов: warning и first) → fresh discovery/target; logical io.cwd, не sandbox. `roots.rs:193–331,396–465,503–527`.
- live_generate → optional boot **до** selector/action/count validation (`:438–441` vs `:456–500`) → optional browser open → authenticated agent-target → leased generate event. `--dry-run` при наличии --boot/--open не означает отсутствие side effects; без generate session не равно без boot/files/process.
- wrap/insert → source_search → dialect lexer + inline_isolation → ambiguity/generated/shared-line refusal → framework CSS authoring + wrapperBlock или source write. AST-like safety остаётся эвристикой: lexer uncertainty делает unmasked/plain fallback (`wrap_common.rs:606–609,1036–1080`). Strong locator без usable text может выбрать первый match, tag-only требует общей уникальности. Count parser wrap_common:1480–1511 допускает NaN sentinel/нет 1–8 guard, в отличие от generate:474–482 и HTTP validation.
- live_poll → lease → preflight scaffold → local `_instructions` → source-changing accept/discard → completion ACK; локальная регенерация instruction text снижает wire injection, но dynamic fields остаются DATA. Default accept carbonizes; --bake opt-in; --no-bake выигрывает. `live_accept.rs:529–538`; no-original discard refuses, insert legitimately removes nothing; read tests подтверждают intended contracts, не запуск.
- staged copy buffer строгий при stage (corrupt JSON не overwrite), lenient у отдельных read/remove веток; SourceHint и pageURL важны. В wrap actual buffered apply может использовать hinted line без file check и raw replacement; это отдельный risk review, не проверенный exploit. Manual commit/apply/evidence полностью прочитаны; полный trace и ограничения ниже.
- HTTP server ограничен loopback, token routes, CORS/realpath source fence; SSE/long-poll, annotate writes, queue/leasing/startup recovery. Наличие server record/process или successful spawn браузера не равно подключённой странице. `live_http.rs` только re-export common parser — его детальный аудит относится к другому coverage.

## Tests: что действительно проверяют тексты

Полностью прочитаны 5 assigned MCP test файлов: fake UNIX socket/browser relay/session isolation, presence lifetime/stable name, proxy sign-in/refresh/revocation/403, asset reserve/upload digest reuse, host permission/foreign manifest/cache selection. Это fixtures/stubs/UNIX paths, не доказательство production login/browser/network и не portable E2E. Все inline tests в full-файлах также прочитаны. Ни один test не запускался. Missing tests: FS write failure→no receipt/no ack, selectors with quoted combinators, modified managed adapter removal, Solid-specific generation/production exclusion, bridge hangs, snapshot-vs-live RulePack parity.

## Friday: только доказанные deltas, не ещё один перенос правил

Локально полностью прочитан `.codex/scripts/design-lint.mjs` (обычный source text; не запускался). В script уже есть именованные source-pattern правила `.codex/scripts/design-lint.mjs:7–103`, MASTER-based palette/fonts и4px spacing `:166–219`, file/line/rule/hint/level `:221–243`; default registry scan только `.tsx` `:263–273`. Скрипт не меняет source и всегда exit0 (`:300`), поэтому его запуск сам по себе не blocking quality gate. Здесь нет доказательства bounded-size reads, полного waiver/catalog/provenance protocol — не приписывать их этому script. Readable `docs/core/design-principles.md:57–101` уже содержит typography hierarchy, gradient/gray-on-colour/side border/icon tiles/glow/motion,4.5/3 contrast и44px targets; prose переносить повторно не нужно. Его source-regex scope не эквивалентен rendered DOM/painted facts: computed cascade, alpha-over-ancestor, clipped gradient, pair owner dedup, hover/placeholder and near-bar evidence — **absent in inspected script**, не утверждение об отсутствии во всём Friday.

Предложение owner `design-tooling maintainer` → design-lint evidence schema/новый opt-in browser collector (в этой задаче не создавать): отдельные detected/not-measured/unknown, surface sampling evidence, viewport/route/state, ratio/threshold + severity, source/rendered provenance. Expected tests: alpha layered bg, hidden modal sibling, partial repeated ink vs full on-screen owner, threshold округления, unknown image background не auto-pass. House-style warnings отдельно от WCAG violations. Остальные readable MD/TOML/actual live state здесь не перепроверены; использовать подтверждённые file:line из предыдущих отчётов, а не считать semantic equivalence по именам.

## Решение для Friday и владельцы дальнейших действий

Сводка сравнения относится к реально прочитанному локальному scope, не ко всему Friday:

| Область | Статус относительно Friday | Доказательство / delta |
|---|---|---|
| Gradient, gray-on-colour, glow, icon tiles, motion, typography hierarchy | **already equivalent по намерению policy; partial по автоматизации** | `docs/core/design-principles.md:57–101`; source regex `.codex/scripts/design-lint.mjs:7–103`; не переносить второй prose-каталог |
| Theme fonts/palette/spacing | **partial** | script `:166–219` извлекает MASTER и сравнивает literals; это не computed cascade/rendered colour composite |
| Painted ownership, animation-settled state, near-threshold evidence | **absent in inspected script** | design-lint читает source; `rules.rs` + `painted.rs` + `background.rs` дают отдельный измерительный слой, не доказанно отсутствующий во всём Friday |
| WCAG pass против house-style / unknown | **conflict при смешении** | Friday readable `:96` даёт4.5/3, upstream содержит также стилистические verdicts и font компенсацию; хранить threshold/raw ratio/unknown отдельно от policy warning |
| Live injection / autonomous copy-edit / source accept | **not applicable к текущему read-only lint; reject прямой импорт** | findings1–3,7–11: permissions, transaction durability, stale source; расширение capability требует отдельного owner approval |
| Executing TOML и actual live state | **не перепроверены этим close-2** | не делать вывод по читаемому MD о реально применённой роли/client state; UI/config не трогались |

Предлагаемые, **не назначенные** владельцы: design-tooling maintainer — opt-in rendered-evidence collector/schema и разделение style/WCAG; preview/runtime maintainer — injection no-clobber/dev-guard и CAS accept; security/tooling maintainer — isolated copy worker; transaction maintainer — durable journal/buffer/recovery. Target следующего этапа — отдельный approved design-tooling spec и тест-план, затем новые collector/transaction модули; **не правка существующих ролей или клиентских сайтов в рамках аудита**. Для findings1–7 обязательны negative tests: EACCES/ENOSPC source→нет success receipt; journal failure→ACK не потерян; foreign adapter file сохраняется; production bundle без helper; quoted CSS selectors не merge; hung bridge bounded; failed second write bake→rollback обоих файлов. Findings8–11 содержат свои expected tests выше.

Результат этапа — **принимать только доказанный измерительный delta как кандидат на проектирование**, не устанавливать runtime. Все11 статических findings остаются открытыми; named assignees и исправлений нет, static audit не выдаёт им PASS. Кодовые fixtures/unit tests прочитаны, но ни один expected test/приёмочный сценарий из рекомендаций не запускался.

## Проверка покрытия и пределы вывода

Список assignment и ledger совпадают:76 уникальных путей, все full, ranges=[1,total_lines], всего51071 строк; unread/partial=0. SHA-256 всех76 файлов повторно совпали с начальным снимком; upstream HEAD остался9e460a87ef338ee9d12c7beed8fedc597a5af5f7, git status --short пустой. Никакие upstream binaries/tests/imports не выполнялись. Неидентичные adapters не дедуплицированы. Механический grep/hash не использовался для full, только для anchor verification.

Зависимости вне assignment (common HTTP parser/process helpers, DOM/fake_dom, visual-contrast engine, live_inject/config/paths, JS capture assets, context providers) названы по импортам/точкам вызова; их прежний coverage должен сверять координатор, этот проход не считает их новыми full. Даже полный static reading не подтверждает фактический UI, login, network, build, WCAG conformance или отсутствие race. Пользовательский exhaustive override соблюдён;15-file stopping rule не применялся.
