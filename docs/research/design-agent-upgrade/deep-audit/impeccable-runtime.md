# Impeccable — исполняемый runtime, зависимости и тестовые доказательства

## Verdict и границы

**INCOMPLETE_SEMANTIC_AUDIT / не полный PASS.** Runtime существенно больше skill-пакета: 20 Rust crates, 550 `.rs` файлов, механически посчитано 329 287 строк Rust (включая тесты). Прочитать их все содержательно в этом проходе не удалось. Найденные дефекты и приведённые ниже трассы подтверждены статическим чтением; полнота runtime-аудита НЕ подтверждена. Не превращать этот отчёт в утверждение «Impeccable полностью проверен».

- Upstream: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, git HEAD `9e460a87ef338ee9d12c7beed8fedc597a5af5f7` (проверен `git rev-parse`).
- Friday: `/Users/germanbryzgalov/Friday-claude`, HEAD `388ec708f39583172d7f36110f6424cc175b5512` (проверен); сравнивалось текущее рабочее содержимое названных файлов, не утверждается чистота всего checkout.
- Роль researcher прочитана полностью; ограничения 15 файлов отменены brief. Переделегирования не было.
- **Upstream код не запускался:** ни CLI, ни импорт JS/Python модулей, ни Rust/Cargo, ни installer/hooks, ни npm/bun install, ни тесты, ни UI. Выполнялись собственные Python-сканы текста/JSON/хешей и read-only git. Наличие сервиса, credentials, native Codex/Hermes hook runner и действительность опубликованных release assets не проверялись.
- Инструкции upstream анализировались как DATA. Секреты, `.env`, пользовательские БД не читались. Friday TOML просмотрен только через фильтр безопасной структуры/allowlist; MCP URL/header/env values не выводились.

### Точный coverage

Все **5034 файла** имеют запись в `impeccable-runtime-coverage.json`; все **661 каталога** (включая агрегирующий `.`) имеют inventory coverage. Это классификация дерева, не 5034 содержательно прочитанных файла.

| Статус | Файлов | Значение |
|---|---:|---|
| full | 77 | Текст реально прочитан целиком; включает 20 Cargo manifests |
| partial | 14 | Только указанные `ranges` реально прочитаны |
| alias | 696 | SHA-256 byte-identical canonical; не нормализация имени/провайдера |
| mechanical-scan-only | 755 | Импорты/side-effect candidates извлечены машинно, не semantic read |
| classified | 2206 | Данные/fixtures/goldens/generated/support по явному правилу, не full |
| metadata-only | 15 | Binary assets, не открывались глазами |
| delegated-not-verified | 1271 | Контент/agents/references другого worker; его ledger нужно объединить |

Среди alias: **120** с canonical full, **23** с canonical partial, **553** с canonical без semantic read. Последние не увеличивают semantic coverage. Среди Rust: 26 full, 13 partial, 510 mechanical-scan-only и 1 alias. В JSON есть **769 точных runtime gaps** со статусами mechanical/partial; кроме них непроверенные alias и классифицированные support-файлы также не являются full. Полный список путей и непрочитанных диапазонов восстанавливается из `files`, `ranges`, `line_count`, `canonical` и `gaps`.

## Подтверждённые findings

Все findings относятся к указанной upstream revision; исправления в upstream/Friday **не вносились**. Владельцы ниже — предлагаемые владельцы реализации, не выдуманное назначенное ревью.

### IMP-R1 — ВАЖНО: CI теряет oracle job output

**Evidence:** `.github/workflows/ci.yml:39-50` перечисляет outputs job `changes`, но `oracle` там нет. Условие oracle job читает `needs.changes.outputs.oracle` в `:312`. `scripts/ci-test-plan.mjs:47` вычисляет `oracle`, `:103-110` пишет его в **step** output; это не автоматически экспортируемый job output. Oracle triggers включают `tests/fixtures/` и `skill/reference/` (`scripts/test-suites.mjs:111-118`), Rust triggers — только crates/Cargo/toolchain/browser-bundle/tests-oracle/ci (`scripts/ci-test-plan.mjs:20-27`).

**Сценарий:** PR меняет только `tests/fixtures/…` либо `skill/reference/…`; step plan выбирает oracle, но rust и new_work_e2e false. В job condition oracle output пуст, оставшиеся условия false → oracle не запускается. Это статическая трасса GitHub Actions, не реально запущенный CI.

**Owner/target/test:** upstream CI owner; добавить `oracle: ${{ steps.plan.outputs.oracle }}` в job outputs и тест, сверяющий все `needs.changes.outputs.*` с экспортами. Ожидаемый результат: fixture/reference-only PR действительно запускает source-built oracle. **Verdict: FAIL, open.**

### IMP-R2 — ВАЖНО: live-inject сообщает успех после неудачной записи

**Evidence:** `crates/live/src/util.rs:284-288` возвращает `std::io::Result<()>` от `std::fs::write`. Но `crates/live/src/live_inject.rs:337-340` делает `let _ = write_file(...)`, затем безусловно добавляет файл в `written` и `inserted:true`; `:342,359-370` превращает это в `ok:true` / exit 0. В remove-ветке `:201-220` ошибка записи тоже игнорируется, после чего возвращается `removed:true` / `ok:true`. `record_injection` дополнительно не умеет сообщить провал сохранения journal (`crates/live/src/journal.rs:36-39,54-63`).

**Сценарий:** корректный config/anchor, существующий HTML, запись запрещена правами/ошибкой ФС. Чтение проходит, write возвращает Err, но CLI сообщает, что script tag вставлен/удалён. В этом аудите сценарий не исполнялся; дефект следует из необработанного Result и безусловного success path.

**Owner/target/test:** upstream live-runtime owner; учитывать Result отдельно для каждого файла, не добавлять неуспешный файл в journal и `written`, вернуть nonzero при полной/оговорённой частичной неудаче. Тест с инъекцией EACCES/ENOSPC над write seam надёжнее chmod под root. **Verdict: FAIL, open.**

### IMP-R3 — ВАЖНО: неудачный orphan cleanup забывается journal

**Evidence:** `crates/live/src/journal.rs:116-118,154-155` возвращает `None` при ошибке remove/write. `heal_inject_journal` сохраняет `kept` только для путей из входного keep-set (`:182-184`); остальные ошибки не попадают ни в kept, ни в healed (`:186-190`). При пустом kept journal удаляется (`:192-198`). В remove-ветке live-inject journal затем дополнительно очищается (`live_inject.rs:182-183,211-212`).

**Последствие:** временная ошибка ФС оставляет внедрённый/созданный orphan, но стирает recovery record; следующему запуску уже нечего retry. Это не утверждение эксплуатации, а потеря crash-recovery contract.

**Owner/target/test:** upstream live-runtime owner; typed outcome `healed/disowned/refused/failed`, сохранять failed artifacts и явную ошибку, не очищать journal без успешной очистки. Тест: первый cleanup write/remove возвращает Err, journal сохраняется; второй успешно устраняет artifact. **Verdict: FAIL, open.**

## 1. Entrypoint → зависимости → побочные эффекты → outputs → tests

### 1.1 npm CLI и shell launchers

`package.json:37-43` публикует `impeccable → cli/bin/cli.js`, сам shim + checksum file + LICENSE. Это не npm-пакет со всем Rust source, skill references или браузером. Version npm **4.11.0** (`:3`) отличается от engine **0.1.30** (`Cargo.toml:9`, `ENGINE_VERSION`, `skill/scripts/VERSION`, exact optionalDependencies `package.json:86-91`). `--version/-v` shim отвечает без бинаря (`cli/bin/cli.js:118-122`).

**npm trace:** argv → `IMPECCABLE_BIN` → optional platform package → versioned user cache → GitHub `engine-vVERSION/impeccable-OS-ARCH` → SHA-256 → `.part.PID` rename → `.verified` → `spawnSync` inherited stdio (`cli/bin/cli.js:96-140`). Cache `$IMPECCABLE_HOME/bin/VERSION/` либо `~/.impeccable/bin/VERSION/`. Missing hash отказывает до сети; mismatch не устанавливается (`:58-94`). Env override и optional package запускаются **без собственного checksum/probe** (`:97-100`): доверие operator/package manager, не одинаковая hash-проверка всех кандидатов.

**POSIX trace:** `skill/scripts/impeccable:109-115,138-180` экспортирует skill/self context; override → sibling engine (probe exact version) → unversioned home engine (probe, но без exact pin) → versioned cache hash/stamp → PATH engine (probe, без exact pin) → pinned verified download (`:252-322`). `IMPECCABLE_LAUNCHER_PROBE` пресекает рекурсию/скачивание внутри probe (`:21-33,248-250`). Старый 3.x npm bin с тем же именем отсеивается handshake, а не просто `command -v`.

**Windows:** `skill/scripts/impeccable.cmd:24-116` аналогично; `%PROCESSOR_ARCHITECTURE%`, Windows ARM64→x64 fallback (`:158-168`), certutil SHA-256 (`:230-242`), уникальная staging dir (`:133-157`), guarded move/stamp (`:268-290`). .cmd/.bat PATH branch вызывается через call, real binary напрямую — сохранение percent-encoded argv (`:95-116`). Windows launcher прочитан полностью, но на Windows не запускался.

**Stamp trust boundary:** digest + size + mtime позволяют пропустить повторный hash (`cli/bin/cli.js:38-43`, shell `:163-176`). Это anti-corruption/download assurance, не защита от локального того же пользователя, умеющего менять binary+stamp либо сохранять размер/mtime. Нельзя писать «каждый exec криптографически проверен». Sibling local build сознательно hash не проверяет; home/PATH probe доказывает протокол, не происхождение и не exact version pin.

**Tests read:** `tests/cli-shim.test.mjs:87-135,174-265,278-315`: staged isolated shim, fixture HTTP request assertions, missing-manifest/mismatch/no-cache-write, stamp invalidation, override/package precedence. Good-stamp case `:244-250` намеренно исполняет неподтверждённые хешем в этом запуске bytes. `tests/launcher-download.test.mjs` только инвентаризирован/машинно просканирован (821 строка), не full. Source tests и их ожидания — не результат прогона.

### 1.2 Native main/router и side effects «чтения»

`crates/cli/src/main.rs:14-34`: Io → optional Pro dispatch для scan → `impeccable::run` → flush → единая process exit. `lib.rs:3-32` даёт модульную карту; полный `router.rs:66-360` связывает detect/html/browser, context/hook, installer, account, live, comp, captures и MCP. Важный инвариант коллизии command/path: `KNOWN_VERBS` перед path-shaped detect shorthand; тест `router.rs:696-727` сверяет named verbs с allowlist. Не путать чатовый `/impeccable init` с CLI: literal CLI `init` намеренно отклоняется (`:349-351`, `detect/src/lib.rs:98-99`).

**Не чисто read-only:** context/detect/doctor/whoami/agents/skills/install/update/check могут планировать detached setup/taste workers; context также switch refresh (`router.rs:93-122`). Сами gates зависят от настроек/consent; не утверждается безусловный network на каждом вызове. `setup_report.rs:8-41` обращается к account gates, запускает собственный `agents list`, ограничивает inventory 5 сек и 1 MiB (`:89-143`), process-tree kill/cleanup (`:146-174`). Полная consent/report реализация `account/setup.rs` **не прочитана**.

`detect` после вывода может загрузить signed-in health (`router.rs:365-398`). Login при допустимом grant может автоматически просканировать репозиторий и отправить результаты; telemetry opt-out **не отменяет** этот sign-in scan по принятой upstream трактовке согласия (`router.rs:401-416`). `critique-storage/audit-storage` имеют account callbacks (`:226-248`); successful live accept — prototype callback (`:321-342`). JSON wrapper сохраняет локальный path и опциональный savedTo, не выдаёт upload за local write (`:9-63` и tests `:775-870`).

### 1.3 install / update / check / link

Trace: router install/skills → `crates/skills/src/lib.rs:45-57` Flow→exit → `commands.rs` → providers Sys (scope/detection) → `bundle.rs` → skills/agents/commands/hooks writes → `engine_binary.rs` → native browser host + optional sign-in follow-ups (`router.rs:183-211`). **providers.rs, большая часть commands/hook_manifest, link/update branches не full**.

Прочитанный fresh install: `commands.rs:682-930`. Выбор targets/scope и flags, `--no-hooks` отключает hook branch, но не означает «никаких глобальных side effects вообще». Existing install может refresh skills/agents/commands, исправлять stale launcher wiring и убирать duplicate home/project hooks (`:714-827`); transport outage при уже существующей копии может закончиться exit 0 с явным skipped update, verify failure остаётся fatal. **exit 0 install не равен свежей установке работающего engine**: engine download errors логируются без провала install (`engine_binary.rs:144-148,175-218`). `check` сам скачивает signed bundle в staging для сравнения (`commands.rs:145-188`), не просто сравнивает version string.

**Remote authenticity:** resolver API выбирает redirect на exact GitHub `skill-vSEMVER/universal.zip`; signature и ZIP берутся с одной versioned location (`bundle.rs:510-547`). Ed25519 compiled keyring, deny_unknown_fields, schema/version/artifact/size/hash checks (`bundle_signature.rs:19-110`); reuse verified file handle для extraction (`bundle.rs:540-547`). Local `IMPECCABLE_BUNDLE_PATH` сознательно unsigned development input (`:369-372,563-584`). Remote подпись не делает код безопасным: доказывает автора/целостность.

ZIP limits/path fence: `bundle.rs:287-358` — число entries, compressed ratio, per-entry и total size, lexical resolved path внутри staging, capped actual reads, modes. Это не полный аудит symlink/race/security extraction: helper copy/write и все tests не прочитаны. Source install bundle идёт от latest resolver, а не обязательно от audited git SHA: audit pin нельзя автоматически приписывать будущему `npx impeccable install/update`.

**Additional global write:** успешный install (вне CI/help) регистрирует native messaging (`router.rs:574-585`), даже project-scope skill install. `mcp/src/host_setup.rs:141-192`: `$IMPECCABLE_HOME/browser/host` mode 0700, manifests в существующих Chrome/Edge/Brave profile dirs; foreign existing host path оставляет без перезаписи (`:170-178`). Host допускает extension origin allowlist (`:99-106`). Launcher выбирает newest numeric semver cache по size+mtime stamp, **не сравнивает digest с manifest** (`:20-43,124-135`), pin тут слабее skill launcher. Windows registration — no-op (`:195-198`).

### 1.4 Context / config / project state

`context/src/context.rs:123-205`: target/project resolution → PRODUCT/DESIGN independently → surface brief → platform/visual signals → Ctx. Имена PRODUCT/Design-case variants и fallbacks root, `.agents/context`, `docs` (`:14-27,370-381`). Project local контекст предпочитается repo fallback; env `IMPECCABLE_CONTEXT_DIR` применяется **только если оба документа не найдены** (`:174-189`). Это не прямой аналог Friday `docs/projects/<name>/project.md` + `brand.md` + `design-system/MASTER.md`.

Monorepo selection: `:248-334` отличает repo/project/target, предлагает UI candidates без explicit target, учитывает nested external git boundary и чужой target, не наследуя слепо caller context. Workspace pattern expansion/discovery, staleness/pin/design parser/sidecar и весь context CLI остаются gaps за `context.rs:410`; их наличие видно, безопасность/семантическая эквивалентность не подтверждены.

`detect/src/config.rs:17-24,234-254`: shared `.impeccable/config.json`, local `config.local.json`; legacy hook detector keys затем detector section, shared затем local. Ignore rules/files/values объединяются, extension suffix routing нормализуется, designSystem по default enabled (`:95-138,148-220`). Config writer и сложная цветовая canonicalization не full.

`live/src/paths.rs` полностью: `.impeccable/live/{config.json,server.json,sessions/,annotations/}`, legacy paths; `read_live_server_info` может **удалить stale pid record даже при чтении** (`:111-128`); safe session ID `[A-Za-z0-9_-]{1,128}` (`:149-160`). Live config validated schema, globs with hard excludes `.git`/node_modules; literal entries проходят без exclude filtering (`live/config.rs:152-168`). Это настройка доверенного локального проекта, не доказанная безопасная sandbox граница.

### 1.5 Hook и detector

`hook/lib.rs:29-56` runtime определяется provider/skill path → stdin event → hook scanner. `hook.rs` **прочитан полностью**:
- re-entry/disable/malformed gates (`:80-126`), harness normalization → edited targets → owning root/cache (`:128-169`);
- native platform skip (`:179-189`), concurrent duplicate event claim (`:191-201`);
- sensitive/generated/ext/plain-script/config-ignore/existence/inside-project/size filters (`:226-275`);
- live preview markers гасят hook, чтобы не ломать вариантный сеанс (`:277-335`);
- text vs static HTML seam + filtering + immediate/deferred tiers + per-finding dedupe/cache (`:337-390`);
- fresh findings/pending/clean/suppression bounded output; clean не равно good design (`hook_lib.rs:171`);
- Stop: re-entry guard, build-completion reminder, roots remembered per session, shell-write discovery только при session_start, per-root configs, max files, baseline debt attribution и dedupe (`hook.rs:647-1137`).

Budget constants: edit count cap **6**, expanded target cap **6**, Stop cap **20**, cache sessions **8** (`hook_lib.rs:160-170`); immediate/deep tier не обещает полный репозиторий на каждом edit/Stop. Sensitive-path skip включает `.env`, `.git`, PEM, credential-like names (`:95-116`). Mutable hook state может быть вынесено через `IMPECCABLE_CACHE_ROOT`, config остаётся project-local (`:181-244`). Конкретные lock/cache persistence helpers и baseline scanner ещё не full.

**Consent-scoped repair:** context действительно может писать hook manifests, но только enabled + local `/hook/consent == accepted` (`admin.rs:486-497`). `hooks on` записывает consent/config и ремонтирует wiring (`:510-575`). Safe repair не затирает malformed settings; shared/team hook отделяет от user hook, preserves unrelated entries через merge, commented manifests backup, user settings atomic write (`:586-705`). Полный merge/marker recognition остаётся gap, поэтому «никогда не трогает чужое» не доказано для всех веток.

**Detector engine routing:** native router создаёт StaticHtmlEngine + BrowserEngine; detect имеет traits/seams, не зависит напрямую от browser/html (`detect/lib.rs:7-11`, `engines.rs:91-163`). Text sources — `detect_text` → regex_matchers/core CSS/page analyzers/design-system/inline ignores. Static HTML — parsed DOM/cascade/adapters → element/page checks → design-system → inline ignores (`html/engine.rs:12-148`). `detect_text.rs:79-103` честно отличает доступные regex checks от low-contrast/tiny-text DOM-only проверок. Regex проверка не доказывает rendered контраст.

Directory walker/import graph поддерживает больше Friday: HTML/HTM/CSS/SCSS/SASS/LESS/JSX/TSX/JS/TS/MJS/CJS/Vue/Svelte/Astro/Blade, stylesheet import/use/forward edges (`detect/file_system.rs:15-37,138-215`). Разрешаются только относительные/абсолютные specifiers из найденного file set; это не полный JS module resolver. Большие `regex_matchers`, `design_system`, `core/checks`, `html/cascade` и browser rule passes **не прочитаны полностью**, никаких blanket claims о качестве/false positives.

### 1.6 Screenshot / browser / live UI

`shot` полностью прочитан: argv → page/file URL → browser discovery/launch → viewport navigation → settle → viewport PNG либо full-page JPEG stitch→PNG → output files (`cli/shot.rs:24-41,50-139`). Defaults 1440×900 и 390×844, full height cap 20 000, output `.impeccable/shots` overwrites per viewport; ensure git ignored (`:103-130`). Browser discovery не скачивает браузер: env override IMPECCABLE_BROWSER/PUPPETEER_EXECUTABLE_PATH/CHROME_PATH, затем system Chrome/Chromium/Edge/Brave (`browser/discovery.rs`, full). Отсутствующий explicit override — error, не silent fallback.

`first_viewport.rs:1-260` частично: thesis visible share >=0.5, action fully inside viewport, blank stretch <=0.6 viewport; DOM ancestor clipping/backface visibility, sample-label checks для чисел, dead link detection. Он также **кликает primary action**, слушает submit/navigation/scroll/mutations (`:158-208`): это активный тест со сторонними эффектами, не безопасный screenshot-only scan. Запуск только на согласованном preview/fixture, не customer production. Normal sandbox browser; CI/dangerous override могут снять sandbox (`:210-219`). Low-level CDP implementation/reaper/fullpage/response capture/attach policy не full.

Live is **исходники меняющая система**, не один скриншот. `live_inject.rs` читает project config → resolve framework adapter → journal heal → git ignores → source HTML/framework adapter/CSP patch → journal → JSON. `--check` не пишет, **кроме explicit `--auto-config`**, который может создать config (`:102-106`). Insert/remove paths и обнаруженные false-success findings описаны выше. Встроенные adapter modules Next/Nuxt/SvelteKit/TanStack/Astro не считаются копиями и каждый остаётся индивидуальным gap.

`live/browser_assets.rs` полностью: четыре script parts session/dom/ignores/live-browser из disk при наличии всех частей, иначе embedded; embedded detector fallback и modern-screenshot UMD (`:14-35,46-72,137-180`). Disk-first значит skill/browser JS version может отличаться от compiled binary, несмотря на embedded fallback. `live-browser.js:1-180` — только начало hand-written **13 925 строк**, не generated. Token из window удаляется в closure до double-init; sessionStorage/locStorage recovery и command vocabulary из Rust globals. Авторизация server routes/origins/token verification **не проверена** — нельзя назвать live API безопасной только по токену в JS.

`live-browser-session.js` полностью: durable localStorage session/handled IDs/revision/scroll; exceptions safe no-op, revision adopts max, но отсутствует CAS и concurrent tabs могут перезаписать checkpoint (`:80-90`). randomUUID fallback uses getRandomValues then Math.random для session IDs, явно uniqueness, не bearer-secret генерация (`:11-36`).

Extension manifest development source даёт broad permissions: debugger/nativeMessaging/downloads/identity/storage/alarms и `<all_urls>` (`extension/manifest.json:7-26`). Это повод для отдельного browser-security review, не доказательство malicious behavior. Chrome worker→account/walks/detector, DevTools panel/offscreen WASM; native messaging host described above. **Extension hand-written account/background/walks/driver/page-helpers/panel модули не full**. Firefox/store builds имеют иную поверхность, не переносить dev manifest permissions на production zip: `scripts/build-extension.js:137-172` вызывает `stageStore/stageFirefox` из отдельного непрочитанного `scripts/lib/extension-manifests.js`.

### 1.7 Build / manifests / CI / tests

20 Cargo manifests прочитаны. Общий dependency graph в Cargo.toml, native CLI связывает account/browser/context/detect/html/hook/live/skills/comp/agents/MCP/foundations; core/foundation имеют pure data/rule semantics и WASM exports, HTML использует scraper/html5ever/cssparser/selectors, browser tungstenite/CDP+image/png, account ring/ureq/security-framework, skills ring/sha2/ureq/zip. Lockfiles инвентаризированы/хешированы, **не проведён CVE audit**, resolver не запускался.

Engine version pinned exact, но `rust-toolchain.toml:5` — **floating `stable`**, не конкретная rustc revision. Рядом JS devDependencies используют caret/range; Bun component bundle требует exact `.bun-version` (`scripts/build-component-review.mjs:5-10`). CI большинство JS installs `bun install`, не frozen lock (`ci.yml:97-98`), manual billed workflow использует frozen (`:775-776`). Это разные уровни reproducibility, не один «всё pinned».

`cargo xtask bundle`: wasm-pack→wasm-bindgen glue/WASM→`impeccable_bundle`→browser page JS→dist/live tracked assets + extension detector pieces (`xtask/main.rs:61-119`, full). `browser-bundle/README.md:9-30` объясняет CDP native snapshot без page WASM и browser extension/in-page WASM consumer; contract computed-style list checked generator. Сам `crates/bundle/src/lib.rs` и browser JS parts **не full**, генератор не запускался.

CI source прочитан полностью: Node floor 18.19 shim job, workspace Node 22.18/24, source Rust Linux/Windows, Windows launcher tests, source-built oracle, platform/react/svelte live smoke and nightly full matrix, provider-backed/billed suites conditional/opt-in (`ci.yml:68-350,431-792`). Pinned action SHAs есть; доступ/успех конкретных workflow runs не проверен. В `changes` выявлен R1; jobs, требующие secrets, могут skip, это не эквивалент end-to-end PASS.

`test-suites.mjs` прочитан полностью: defaults core/oracle/detector/live/framework/plugin-e2e, отдельные opt-ins actual browser/LLM/full workflow; remote CLI E2E lane **commands:[]** (`:201-209`). Само наличие job `cli-remote-e2e` не доказывает remote install smoke. Plugin real CLI suite skips when claude отсутствует (`:210-225`), oracle/framework skip без engine (`:105-108,185-197`).

**Fixtures/goldens classification:** 1480 oracle JSON goldens структурно разобраны собственным Python (не исполнение upstream): 1395 single-run `{exit,files,signal,stderr,stdout}`, 83 `{files,steps}`, 2 `{daemon,files,steps}`. Generator/schema реально прочитаны в `tests/oracle/lib.mjs`: stage temp workspace + isolated home (`:89-102,269-347`), daemon reaper (`:31-39`), snapshot named files (`:221-247`), normalized paths/time/IDs (`:125-189`), golden write (`:417-419`), diff (`:429-460`). Normalizations скрывают часть machine/environment-dependent behavior — byte parity не равна security/correctness. record.mjs и все case definitions не full; goldens не перечитаны осмысленно поштучно.

Fixture families различены: antipatterns, consent/overlays/motion, framework fixtures (React/Vue/SvelteKit/Next/Nuxt/Astro/TanStack/CSP/styles/monorepo), oracle workspaces и pure vectors. Hand-written fixture source не объявляется generated автоматически. `tests/fixtures/` и все Rust integration tests остаются classified либо mechanical, не «всё тестирование изучено». Ни одна suite не запускалась.

## 2. Карта всех runtime папок / владельцев

Полный directory inventory с descendants/count/status — JSON `directory_inventory`. Следующая карта — **назначение и dependency traces**, а не замена индивидуального ledger.

| Папка | Entrypoint / зависимости / состояние / выход / tests |
|---|---|
| `cli/bin`, `cli/platform-packages` | npm shim→platform binary/cache/download→inherited argv/stdout; cli-shim/launcher-download |
| `skill/scripts`, provider `*/skills/impeccable/scripts` | launchers + browser parts/data, exact SHA alias only; runtime доверяет explicit skill dir/disk parts; browser helpers tests |
| `crates/cli` | main/router→все verb crates/native capture→stdout/JSON/PNG/global registration; cli integration tests, oracle |
| `crates/common` | Io, fsx/git/http/proc/prompt/seed/steps; reused by native orchestration, process/net/write helpers; mostly unread |
| `crates/foundation` | JS-number/color/fonts/registry/findings/DOM abstractions/selectors; pure rule types; vectors; unread implementation |
| `crates/core` | checks/browser rules/text/content/CSS→findings; foundation; core tests+vectors; mostly unread |
| `crates/detect` | CLI/config/fs/import graph/text/design-system/SARIF/annotations; html/url traits; detect tests/oracle |
| `crates/html` | parser/DOM/cascade/csstree/adapters/background/image sampling→findings; static fixtures/vectors |
| `crates/browser` | installed browser/CDP/attach/snapshot/consent/overlay/motion/fullpage/contrast→screenshots+findings; browser tests; lower-level gaps |
| `crates/context` | target/context/design/doctor/pin/surfaces/critique/seed/fonts/image/telemetry/question/review servers→docs/JSON/cache/HTTP/UI; large unreviewed branches |
| `crates/hook` | hook/admin/before_edit/cache/claims/sessions/baseline/discovery→local cache/audit/manifests/additionalContext/block; hook tests/oracle |
| `crates/live` | boot/server/poll/wrap/inject/generate/accept/manual edits/Svelte adapters/source locks→project source/preview state/CSP/HTTP/SSE; live framework/oracle/E2E |
| `crates/comp`, `comp-verbs` | raster/png/metrics/font fingerprints and build-phase/spec/diff/font-match→comps+gates/evidence; comp tests; implementations unread |
| `crates/account` | OAuth/session/store/health/design/critiques/taste/world/pro→account credentials/cache/API/cloud receipts; fake issuer tests; most auth/storage unread |
| `crates/agents` | harness discovery/config writers/MCP/render/resources→agent rule/config/MCP files; tests; runtime modules unread, NOT delegated prose |
| `crates/mcp` | stdio proxy/presence/browser relay/native host/asset→account+browser bridge; MCP tests; only host_setup full |
| `crates/foundations-scan` | pure repository listing checks→foundations statuses; tests; unread |
| `crates/wasm` | browser/detect/pure exports adapters around core/html/detect→WASM JSON-in/out; tools/tests; implementation unread |
| `crates/bundle`, `xtask` | assembly lib + task→WASM bundle/live/extension artifacts; generator reviewed, assembly lib gap |
| `browser-bundle` | header/natives/probe/snapshot/common/visual/overlay/scan/offscreen/footer; native include + wasm bundle; README full, JS not full |
| `extension` | account/background/content/devtools/offscreen/popup/shared/walks/mic/panel/fonts/icons; broad browser/account state; extension tests; implementation gaps |
| `ui/component-review` | entry→review/plan-review/model/store UX/styles/vendor/fonts→minified embedded IIFE; model/plan-model/viewport tests; original TS unread |
| `scripts`, `scripts/lib`, `scripts/github` | build/transformers/release/sign/fetch/check/publish/test planner/runner/process cleanup/sheriff/font-index; network/publish/git/generated writes; only named full modules reviewed |
| `.github/actions`, `.github/workflows` | setup-bun + CI/release-engine/sync/sheriff; only ci.yml full, others mechanical |
| `tests` | executable harness/lib/oracle/cases/live-e2e/new-work/skill-behavior/workflow + fixture data; selected test code full, remainder gaps |
| `plugin`, `cursor-plugin`, provider roots, `.claude-plugin`, `vscode`, `.codex` | distribution manifests/adapters; instruction packaging owned content worker, executable scripts hashed individually |
| `.impeccable`, `demos`, `docs`, root manifests | upstream self-project state/sample assets/contracts; support classification, not target machine live state |

Literal Rust include_str/include_bytes dependency scan обнаружил **72 ссылки, 72 существующих target, 0 missing**. Это проверка literal path existence собственным Python, не compiler check. Импорты/`use` и side-effect candidate file:line включены в JSON; условные/dynamic/generated JS imports, весь Rust module resolution, vendor licenses и всё CI referenced-file resolution не доказаны. Нельзя объявить «все зависимости разрешены» по этим 72 include.

## 3. Сравнение с Friday: что уже исполняется в коде

Friday source-only сравнение; native runtime здесь не запускался. Безопасно просмотренный `.codex/config.toml`: `[agents] enabled=true, max_depth=3` (`:4-7`), registered design-reviewer/dept/taste/media/motion roles (`:33-63`), local plugin enabled (`:232-233`); MCP structure присутствует (`:215-230`), значения omitted. Plugin manifest `.codex/.codex-plugin/plugin.json:1-6` объявляет skills. Это config declarations, не доказательство поддержки/вызова текущим IDE.

| Возможность | Verdict относительно Friday | Точное доказательство / delta |
|---|---|---|
| Post-edit deterministic lint | **already equivalent по механизму, partial по правилам** | `.codex/hooks.json:25-34`→`lifecycle.py:142-170`→Node design-lint; нельзя рекомендовать «добавить первый линтер» |
| Session/cache/dedupe | **partial** | `lifecycle.py:34-36,64-92,145-167`: hashed session ID, flock, atomic state, file-content hash. Impeccable dedupes findings, immediate/deep tiers, project roots/event claim; не идентично |
| Shell-created UI files | **already implemented, иной scope** | `lifecycle.py:39-44,117-139` добавляет все Git dirty/untracked, не только tool path; `test_lifecycle.py:120-125` pins scenario. Impeccable Stop discovery зависит от session_start/recorded roots |
| Project/brand token lint | **partial, уже существует** | `design-lint.mjs:124-161` resolves projects/tools path прежде `.active`; `:166-219` MASTER hex/fonts/4px. Impeccable PRODUCT/DESIGN+sidecars другой schema; не заменять источник истины |
| Anti-pattern detection | **partial** | Friday 14 base rules + 3 MASTER rules (`design-lint:7-103,187-219`) построчно; нет evaluated DOM/CSS cascade/real contrast в этом скрипте. Его текст «contrast <4.5:1» — heuristic, не actual ratio |
| Configured Stop quality enforcement | **partial, другой gate** | hooks Stop lifecycle + task_gate (`hooks.json:47-65`); lifecycle Stop только metadata save (`lifecycle.py:173-177,220-221`), design deep pass там нет. task_gate implementation не исследована этим worker: нельзя объявить её отсутствующей/эквивалентной Impeccable baseline |
| Multiple viewport screenshots | **already equivalent по базовой функции** | `screenshot.mjs:34-38,100-143`: desktop/tablet/mobile, URL, optional click/full/out; playwright-core package `.codex/package.json:5-6`. Не утверждать, что браузер установлен. Upstream shot native CDP/file URL/two defaults, first-viewport geometry/active response checks — отдельная delta |
| Context/session persistence | **already implemented, ограниченно** | startup reads registry/active/context (`lifecycle:95-114`); git facts archive (`:173-205`), not full transcript, no network/install/git writes (`:1-2`). Test secret payload omitted (`test_lifecycle:49-57`); это не доказательство scrub всех git filenames/messages |
| Consent/self-healing hook wiring | **absent in inspected lifecycle, не во всём Friday** | Impeccable `admin:486-705`; Friday `.codex/setup.sh` не full; без него нельзя заявить отсутствие installer repair вообще |
| Browser overlay/live variant/source accept loop | **absent in inspected lifecycle/lint/screenshot scope** | Upstream live changes source/CSP/journal; Friday screenshot не делает accept/recovery; tools/nullume/browser capabilities всего repo не обследовались |
| Cloud health/design/critiques sync | **not applicable / conflict для audit-only** | Friday lifecycle explicitly local; upstream account callbacks/network и default-on signed-in sync. Не переносить без отдельного privacy/consent решения |
| Command collision | **partial risk, не подтверждённый конфликт** | upstream executable `impeccable`, chat provider prefix `$` vs `/` (`context/provider.rs:101-137`), engine-probe legacy-bin guard. Friday имеет свои polish/audit-design/design-system (CODEX:934-936), не проверялся PATH/global skills precedence; no claim collision actually observed |

**Локальные замечания, не скрывать за импортом чужого runtime:** Friday lint печатает findings с ERROR, но всегда exit 0 (`design-lint.mjs:283-300`); lifecycle поэтому кэширует hash даже с findings (`lifecycle.py:163-166`), повтор неизменённого файла не напомнит то же нарушение. Это advisory design choice/ограничение, не бинарный failing quality gate. Без аргументов lint сканирует только `.tsx` (`design-lint:263-273`), хотя explicit per-edit paths включают CSS/HTML/Astro/JSX (`lifecycle:137`). Обещать «полный UI scan» нельзя. Test lifecycle failures retried (`test_lifecycle.py:188-200`) тестирует process returncode 1, а не настоящие ERROR findings при exit 0.

## 4. Только доказанный delta / рекомендации без rollout

1. **Не устанавливать upstream whole runtime по этому audit:** open R1–R3 и сотни непрочитанных modules. Owner coordinator; следующий expected output — продолженный ledger всех runtime branches, review account/network/server origin/token/writes и regression tests на findings. Не «PASS с оговорками», а incomplete.
2. **Малый Friday delta вместо замены:** owner local scripts maintainer; target `.codex/scripts/design-lint.mjs`/lifecycle + tests. Явные machine-readable `rule_id/severity/file:line`, `files_scanned>0`, skip/degraded/error states, согласованная exit policy, per-finding dedupe/reintroduction test. Существующие MASTER/path-first routing и advisory semantics не ломать молча. Expected test: CSS/JSX/Astro входит в full scan; unknown/missing/0 files не объявляются clean; fixed→reintroduced повторно виден.
3. **Отдельный rendered evidence слой:** owner design tooling, target existing screenshot workflow, не новый auto-installed browser. Сначала availability check в разрешённой будущей задаче; preview-only fixture. Из upstream заимствовать измеримые first-viewport/clipping/action checks и viewport evidence, но active clicks только с заданным безопасным fixture action. Expected output: screenshot paths + measured bounds + skipped/unsupported отдельно; не оценка дизайна по regex.
4. **Никакого автоматического context cloud sync:** owner privacy/security; target integration spec, не Friday hooks. Upstream подписанный binary безопаснее неподписанного download, но account default-on DESIGN contents upload — отдельное решение. Before optional pilot: explicit consent, endpoint inventory, data minimization, off switches, no client code/brand export без прав.
5. **Не дублировать существующий workflow:** existing PostToolUse lint/cache/archives/screenshots/roles оставить. Runtime integration выделить namespaced optional adapter; запрет installer менять project/team/global hooks без reviewed plan; точные touched paths, backup/rollback и coexistence tests со Friday Stop/task_gate.

## 5. Exact remaining gaps

Подробные paths — JSON `gaps` + per-file ranges. Основные незакрытые области: 510 Rust files только механически, account OAuth/store/session/pro verification и upload scopes, agents config writers/Loop/Codex trust, installer providers/hook manifests/copy refresh/link/update, detector rule implementations/design-system parsing/cascade, CDP attach/network/consent/fullpage/reaper, live server/origin/token/accept/manual-edit/Svelte mutation trees, component-review HTTP/approval state, comp image metrics/build-phase integrity, original UI TS, browser-bundle JS, extension background/account/walks и release/publish/sign/check/sheriff scripts. Даже у alias canonical partial/mechanical этот gap сохраняется.

Крупный hand-written `skill/scripts/live-browser.js` прочитан только 1–180 из 13 925 строк; его нельзя записать в generated exemption. Generated detector/WASM и component-review bundle классифицированы по реально прочитанным generator entrypoints; minified screenshot/vendor/autoconsent/license provenance не прошёл полный supply-chain review. Binary fonts/images не визуализировались. Lockfiles не разобраны на уязвимости. Live installations/runner/hooks/native servers/API credentials не проверены. Ни installer, ни тесты не исполнялись; «test coverage exists» в отчёте означает source test evidence, не зелёный прогон.

Созданы/обновлены только назначенные `impeccable-runtime.md` и `impeccable-runtime-coverage.json`; существующий upstream/Friday код не изменялся. Content-worker coverage 1271 delegated files нужно объединить координатору, не принимать эти строки за его завершённый отчёт.
