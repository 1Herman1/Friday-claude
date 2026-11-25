# Impeccable close-7 — substantive source audit

## Итог и границы утверждения

**Назначенное чтение закрыто: 64/64 файла, 51 098 строк, все `full`.** Это закрытие follow-up assignment `impeccable-close-7.json`, не всего upstream и не runtime PASS. Revision снимка: `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. Корень upstream: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`. Локальные ссылки Friday ниже относительны `/Users/germanbryzgalov/Friday-claude`; остальные ссылки относительны upstream.

Ledger `impeccable-close-7-coverage.json` содержит для каждого назначенного файла path, SHA-256 фактических байтов, status, включительные ranges, total_lines и содержательную заметку. Множество путей, суммы строк и SHA проверены механически отдельно от чтения; хеширование не использовалось как основание `full`. Продолжено существующее чтение, включая хвост `element_checks.rs:9301–13721`; участок `live-browser.js:7601–8100` дополнительно перечитан для перекрытия потенциального byte-budget truncation предыдущего большого батча. Предыдущие content/runtime отчёты — контекст, не подмена нового чтения.

**Audit-only.** Ни upstream tests, ни npm/cargo, imports исполняемого кода, hooks, installers, binaries, browser/UI, сетевые MCP/OAuth/upload операции не запускались. Все описанные тесты — прочитанные assertions и сценарии, а не полученный зелёный прогон. Состояние реального harness, серверов и клиентских сайтов не проверялось. Роль researcher адаптирована к Hermes; ограничение 15 файлов отменено заданием; делегирования не было.

## 1. Реальный поток данных и зависимостей

### 1.1 Browser live overlay: это редактор и протокол, не только линтер

`skill/scripts/live-browser.js` реализует общий цикл выбора DOM-элемента → configure prompt/action/count → generate → progressive publication → mount/HMR → cycling/parameters → accept/discard/manual edit. Существуют отдельные ветки source-preview и compiled Svelte/Vue component-preview. Их нельзя считать одним HTML-injection механизмом.

- **Сессии и доставка:** session-creation gate сериализует создание перед checkpoint/progress (`live-browser.js:8084–8091`); SSE reconnect сохраняет восстановимое состояние, после исчерпания retries переводит UI в server-lost, а не выдаёт это за discard (`:7834–7847`, `:8047–8081`). LocalStorage/checkpoints, root/pathname isolation, adoption, orphan и deferred-wrapper recovery разобраны полностью. Это клиентские recovery механизмы; authoritative серверный journal этим файлом не доказывается.
- **Framework ownership:** source-preview не инжектируется на каждом checkpoint: reconciliation оставлен HMR, final source fallback имеет settle/retry (`:7893–7908`, `:7950–7956`). Discard скрывает wrapper немедленно, структурную замену откладывает и различает framework-owned/static DOM (`:10094–10152`). Даже cleanup способен вызвать поздний `location.reload`, это реальный побочный эффект, не косметика.
- **Compiled preview:** manifest fetch → проверка id → загрузка params → поиск/ожидание anchor → wrapper `display:contents` → runtime/import → mount (`:6067–6227`). Revision directory меняет module URL против transform-cache (`:5924–5936`). Contract-v2 hydration извлекает live props и исключает неподходящие узлы. Mounted acknowledgement отправляется после mount, отдельно от publish (`:5978–5983`); ошибка получает report/card/retry. Это полезное разделение publish/render truth, но ниже есть race, ослабляющая его.
- **Автоматический target:** tab сначала проверяет busy/resolvability, затем получает server lease; отсутствующий элемент перепроверяется, denied claimant ждёт pending/lease. Lease обновляется непосредственно перед Go, а teardown соединения прекращает действия (`:7606–7636`, `:7690–7735`, `:7768–7813`). Это защита от двух Go в разных вкладках, не общая транзакционная гарантия всех async mounts.
- **Accept/manual editing:** annotation/copy/removal stash и manual commit 202/SSE/repair/rollback отделены от generation. Optimistic accept освобождает foreground до окончательного результата; поздняя ошибка выводит осторожное «may not have been saved», поскольку carbonize может упасть уже после source promotion (`:7975–8021`). Нельзя интерпретировать исчезновение панели как подтверждённую запись source.
- **Detection:** загрузка detect bundle, ready/scan/results postMessage, scanId stale gate, disabledRules/disabledValues/skipScan. `onDetectMessage` проверяет форму source и scanId, но это не изолированный security channel (`:12595–12615`). Другие скрипты страницы не становятся недоверенной sandbox-зоной.
- **Прочие эффекты:** MutationObserver, reparenting chrome в modal top layer, focus-trap suppression, clipboard fallback/focus restore; voice зависит от secure context/доступности recognition/cloud, умеет autosubmit; screenshot capture подгружает modern-screenshot; GL shader имеет собственный epoch/cleanup. Наличие GL epoch не означает epoch в component mount.
- **Design viewer:** DESIGN.md frontmatter/basic view и `.impeccable/design.json` sidecar дают цветовые ramps, typography, radii, shadows, narrative и настоящие HTML/CSS component tiles. У каждого tile shadow root для CSS isolation, но не sandbox (`:13521–13551`).

`live-browser-dom.js` — отдельный DOM adapter: picking с минимальной геометрией, framework ownership, fallback идентификаторов, modal/popover positioning, UI shadow mount, clipboard selection с возвратом фокуса, остановка host event propagation. Его observer/listener lifecycle — часть исполнения, не данные.

`live-browser-ignores.js` — browser-side waiver resolver, вход — сериализованные project/local detector ignores и location pathname; выход — `{disabledRules, disabledValues, skipScan}` (`:199–239`). Декодирует URL, добавляет directory index/suffix candidates; единственный suffix-match `pageFiles` имеет приоритет, иначе используется common served-root (`:122–173`). Unscoped wildcard не выключает rule; malformed glob игнорируется в сторону сохранения finding (`:176–186`, `:221–236`). **Известный незакрытый продуктовый gap:** `/about` не сопоставляется автоматически с `src/routes/about/+page.svelte`, source-scoped waivers теряются (`:29–32`). Это не пробел чтения.

### 1.2 Core: общий Dom interface, разные уровни достоверности

`crates/core/src/browser/element_checks.rs` — исполняемые проверки через `Dom`, не corpus данных. Использует общие measures/color/rules, геометрию, computed styles, pseudo styles, keyframes/running animations, shadow slot и hit-test ответы. Большая часть хвоста — FakeDom tests. Содержательно:

| Семейство | Что реально учитывается | Ограничение/значение для Friday |
|---|---|---|
| Border/pseudo/inset/child stripe | Скруглённые углы, geometry, row/cell/tab/status/selected context; отдельные представления одного визуального паттерна (`:120`, `:437`, `:576`, `:772`) | Не эквивалентно grep `border-l-4`; квадратный функциональный sidebar не обязательно дефект |
| Contrast/paint | Direct glyphs, icons/control/disabled semantics, наследование, opacity fold, фактический owner поверхности, pseudo gradient face, transform/visibility, filter order (`:861`, `:955`, `:1820`, `:2074`, `:2669–2681`) | Не строгий WCAG verifier: uncertainty/waivers/advisory и разные link/prose пути сохраняются |
| Gradient text | Различает настоящий ramp, shimmer и alpha-only variation (`:2469`, `:2503`, `:2640`) | Скриншот в случайной фазе не доказывает постоянную нечитаемость |
| Typography/icon/hero | Icon tile, italic serif emphasis, eyebrow, first-screen oversized h1 (`:3310`, `:3502`, `:3558`, `:4625`) | Контекстные эвристики; не универсальный запрет serif/eyebrow/крупного heading |
| Motion | Имена плюс keyframes; pure pulse может не считаться bounce; finite running width animation временно освобождает overflow (`:3599`, tests `:11104–11160`, `:13618–13646`) | Переносить не как ослабление house policy, а как distinction intent vs measured harm |
| Glow/palette | Светимость против поверхности, chroma/opacity/blur/size, DESIGN.md declared colors, visible gradient-stop votes; neon ink удерживается для page-level сигнала (`:3701`, `:3853`, `:3971`, `:4168`, `:4335`) | Один брендовый cyan или violet не автоматически «AI-slop» |
| Radial spotlight | Layered backdrop/compositing, media coverage/paint order/alpha format, наличие текста поверх; text rect cache (`:4460`, `:4471`, `:4590`) | Фото — unknown, не произвольно выбранный background; JPEG/PNG/WebP различаются консервативно |
| Repeated cards | Thin border + wide shadow только при повторении comparable cards, до двух wrappers, hidden flyouts не ряд (`:4937`, tests `:11624–11970`) | Один elevation component не равен массовому карточному шаблону |
| Overflow | Ближайший реально клиппирующий owner для semantic popover, modal top-layer исключён; text spill должен причинять harm: clip, collision, viewport | Не всякий `scrollWidth > clientWidth` ошибка; intentional ellipsis/clamp/code crop/positioned decoration не равны поломке |

Особенно важны прочитанные regression twins: declared palette vs другая палитра (`:9345–9452`), photo coverage vs contain/hidden/mask (`:9758–9811`, `:10104–10181`), text spill в свободное пространство vs соседняя ячейка (`:10395–10429`, `:10735–10887`), inline `truncate` без собственного box vs inline-block (`:10515–10566`).

Shadow slot tests (`:12040–12110`) проверяют реальную ink/surface ownership вместо цвета host. Occlusion tests требуют согласованных captured rect и hit-test ответа; missing/stale ответ не означает covered (`:13576–13616`). Filter tests подтверждают intent blend-before-filter и отказ от произвольного unknown filter verdict (`:13056–13207`). Это всё assertions над FakeDom, не снимки живого Chrome.

`crates/core/src/browser/line_breaks.rs` измеряет rendered line/last-word rects: straggler с коротким хвостом и достаточным prose measure, unbalanced heading из двух/трёх строк, authored `<br>`, balance/pretty и mixed/hidden/CJK/multicolumn conservative exemptions. Не предлагает переписывать каждую последнюю строку. Raw `pretty` fallback намеренно ограничен: specificity не взвешивается, linked/@import/shadow styles не читаются, условия grouping at-rule не вычисляются (`:103–112`, `:175–194`).

`crates/core/src/checks/css_scan.rs` — raw CSS/HTML heuristics без DOM: glow, grids/halos, pseudo/inset stripe, organic polygon/path, buried raster, keyframe pulse/marquee/reduced-motion, header/nav dot severity. Делит helpers с `impeccable_foundation::css::scan`, uses regex/once_cell/color/measures (`:6–26`). Custom property substitution ограничен глубиной и regex fallback, не полноценный cascade (`:34–65`). Есть сохранение UTF-16 source positions; геометрическая аппроксимация кривых не доказательство фактического paint. Нельзя смешивать findings raw scanners и DOM engine в одну шкалу уверенности.

### 1.3 Installation engine и harness adapters

`crates/agents/src/cli.rs` валидирует spec/version/owner/harness/root, вычисляет installation identity, берёт общий state lock, разводит plan/status/apply/undo/recover/list. **Plan не пишет target, но CLI/state lock и observation не равны «никаких эффектов».** `targets.rs` различает settings/hooks/config/AGENTS и harness-specific manual trust действия. Эти adapters не byte aliases.

`lib.rs` задаёт Spec/hook formats, journals v2, pending transaction/recovery и state permissions. На Unix используется flock; не-Unix create-new locking не следует приравнивать к flock. `render.rs` отказывает duplicate JSON keys, добавляет точные hook entries, сохраняет user drift вокруг owned markers, хирургически меняет TOML features/approval, не перетирает явный false, различает baseline/owned/current при undo.

`resources.rs` выполняет preflight ownership/drift/peer claims, строит before/next, пишет pending intent перед target writes, затем sync MCP и journal resource records (`:90–287`). Shared ownership означает, что undo одной установки не обязан удалять общий ресурс. Created dirs и исходные snapshots используются для восстановления. Error path может оставить pending для recover; это не безусловный all-or-nothing rollback при любой внешней гонке.

`fs_writer.rs` проверяет regular file/current UID, canonical physical target и Unix dev/ino; пишет unique create-new temp, sync, сохраняет mode, повторяет before/identity checks, rename, sync directory, readback (`:17–101`, `:185–266`). Это заметно сильнее простого writeFile, но не compare-and-swap и не защита render snapshot на всём пути — см. F1.

`agents/src/mcp.rs` перед add/remove наблюдает old/desired/peer collisions, вызывает Claude/Codex CLI, разбирает JSON либо text observation. Новая установка проверяется readback, update существующего имени идёт другой веткой (`:25–47`). Субпроцессный эффект есть и у observation, не только apply.

`tests.rs` и `tests/mcp.rs` содержат сценарии CRLF/markers/duplicate keys/false switches, symlink/dangling/cyclic targets, interrupted write boundaries/recovery, shared owners/servers, surgical undo, user drift, unreadable/missing journal, redacted list и adapters Cursor/Copilot/OpenCode; MCP тестируется fake CLI. Это полезные failure-injection контракты. Проверки не выполнялись, конкурентный render→write сценарий ниже ими не доказан закрытым.

### 1.4 Account MCP proxy, local browser relay, assets/presence

`crates/mcp/src/lib.rs` — stdio JSON-RPC proxy к account service `/mcp` через `impeccable_account::session::Session`, а не локальный deterministic design engine. Initialize/list не должны сами открывать login; tool call может потребовать OAuth, progress/hold и ровно один retry. Есть отдельный sign-in worker/create-new lock с ограниченным временем; missing scope отделён от workspace refusal. `tests.rs` с scripted Upstream фиксирует именно эти intent contracts, notification no-reply и no-browser/SSH семантику, не проверяет настоящий account backend.

`asset.rs` принимает absolute/relative path, extensions MIME allowlist (включая JS/JSON), regular file и 1..50 MiB; отказывает terminal symlink, проверяет opened handle identity/длину, ограничивает чтение и хеширует (`:13–83`). После reserve по digest bytes загружаются в service, agent получает key; malformed/incomplete reservation отказывает (`:97–116`). **Это capability upload локального файла, не workspace sandbox:** `cwd.join(path)` не ограничивает absolute/parent paths, symlink в родительском компоненте не запрещён. MIME определяется extension, не decode/sanitization. Для Friday это отдельная opt-in security boundary, не обязательная часть заимствования линтера.

`browser.rs` — native messaging/local Unix socket relay: allowlisted extension origin, capped native-endian frames, 0700/0600 directory/socket, host lock, mutex driver/pending request IDs, probe без driver claim, timeout/cleanup disconnection. Консент сайта и Pro gate принадлежат extension и в этом assignment не доказываются. `presence.rs` считывает ps parent chain с bounded depth, cwd/repo/session record, start-time против PID reuse, различает seen/connected и чистит stale records только при пригодном ps результате. Это локальные metadata side effects, не нулевой footprint.

`crates/cli/assets/opencode-loop-plugin.ts` подставляет доверенный COMMAND template, запускает `/bin/sh -c` lifecycle/register, sha-derived session UUID, dedupe waiting Set, idle→Stop→promptAsync, tool.execute.after→register (`:7–49`). Это auto-resume execution path, не просто текст skill. Для Hermes адаптация нужна по доступным tools и permission model, не копированием native Codex/OpenCode механизмов.

## 2. Test intent и точные границы проверки

Все 36 назначенных `crates/html/tests/*.rs` прочитаны по source; индивидуальные заметки ledger содержат intent каждого файла. Они охватывают:

- source line attribution/raw-text/comments/quoted tags/inline ignores; vector/oracle wiring и extension RulePack с приоритетом document hook над text hook;
- typography: footer heading semantics, negative/wide tracking, italic serif, justified Latin vs scripts/hyphenation, tight leading, hero kicker, all-caps body, undersized functional vs fine print;
- static cascade: em/rem/inheritance/importance/@layer/CSS-wide custom-property keywords, unresolved values, background shorthand reset и hover swaps;
- contrast: same-pair counted dedupe с разделением warning/advisory, placeholders/pseudo selectors, gradient/stroke/opacity/Color4/P3/OKLCH, sampled glyph surfaces, image unknown, ancestor/descendant ink;
- layout/style: nested cards vs embedded media/modal, popover clipping, stripe child/pseudo/logical border geometry, hard offset shadow advisory, repeated border+shadow, radial spotlight;
- сохранение пользовательского source inventory forms/fields/id/handlers/scripts/test hooks и статусы exit в wiring;
- robustness на ограниченном corpus/truncation/garbage/deep/wide входах, не доказательство отсутствия panic на всех входах.

Статический broken-image suite проверяет наличие source/binding формы, не HTTP/декодирование изображения. `sampled_contrast.rs` передаёт sample data fixtures — не снимает пиксели браузером. В tests намеренно закреплены ограничения: unknown layout, dark-surface false positives, invisible identical-color false negatives, static worst-stop gradient overflags. Это не следует скрывать под словом parity.

Vector runner `core/tests/vectors.rs` объединяет foundation/core dispatch, нормализует undefined/negative-zero/retired findings; Windows допускает 4 ULP для отдельных чисел (`:126–149`). Unknown function получает SKIP; rejected args известного dispatch — fail (`:193–225`). `checks/vectors_b.rs` — adapter JS-shaped аргументов, не сама реализация проверок. HTML vector runner имеет собственные пропуски/dispatch. Missing directory может fail в core, но пустой существующий corpus всё ещё может green: F5.

Назначенные WASM tools — исполняемые verification harnesses, не набор готовых доказательств:

| Tool | Реальная проверка и зависимости | Что не гарантирует |
|---|---|---|
| `snapshot-diff.mjs` | Puppeteer + built `dist/detect-antipatterns-browser.js`; live Dom vs snapshot в одном Chrome; exact JSON, stats/unknown properties (`:30–87`) | Equality не независимая ground truth; pageerrors/unknown props печатаются, сами по себе не fail; empty --only selection не запрещён |
| `ab-diff.mjs` | Old JS checkout vs new bundle, reload той же page, findings/hidden и opt-in visual; rules filter; timing (`:33–76`, `:85–100`) | Потребляет другой checkout/puppeteer/build, которые здесь не запускались; одинаковая ошибка двух движков всё ещё equality |
| `ext-diff.mjs` | Загружает extensions, вызывает SW sendScanToTab, ждёт settled findings; --csp, --messages проверяют popup/panel/toggle и отсутствие window API (`:61–116`, `:169–215`) | В A/B игнорирует rects при verdict; F6: одинаковое отсутствие результатов не валидирует успешный scan |
| `disabled-values-check.mjs` | Baseline undocumented font/color, exact delta после value waiver, hex↔rgb equivalence, unrelated findings survive, skipScan (`:88–173`) | scan helper не возвращает отдельное received/deadline status; empty result может имитировать исчезновение findings в некоторых шагах |
| `skip-scan-check.mjs` | Positive visual control; scanId-scoped results; skip must post ≥1 result, каждый post zero, markers zero (`:76–127`) | Наблюдение после skip ограничено 2500ms, не доказательство отсутствия произвольно позднего async post |

Общие эффекты tools при запуске: чтение fixture/build/другого checkout, HTTP server с ephemeral port, запуск Chrome/extensions и загрузка страниц (включая remote --url). Здесь ничего из этого не запускалось. Версии package dependencies/доступность built bundles не перепроверялись: manifests/build outputs вне назначенного follow-up scope.

## 3. Static findings — не runtime reproductions

Severity — приоритет исправления механизма, не доказанный exploit. Владельцы ниже — **предлагаемые upstream/local targets**, не уже принятые исполнители. Findings не исправлялись.

### F1 · P1 · Render→write race может перетереть чужую правку

**Evidence:** `agents/src/resources.rs:98–136` читает before и рендерит next, `:160–161` сохраняет writes без исходного before; `:194–200` перечитывает before для pending, `:223–228` перечитывает его ещё раз и передаёт safe_write вместе со старым next. `fs_writer.rs:27`, `:73–88` корректно проверяет именно переданный поздний before, а не исходный render base.

**Сценарий:** render A→next(A); пользователь пишет B до нового read; engine принимает B как expected before и записывает next(A), теряя B. State lock сериализует собственные установки, не внешние редакторы. Readback проверяет собственные bytes, не сохранность чужой правки. Отдельно между last check и rename остаётся обычное TOCTOU окно.

**Target/acceptance:** upstream agents resources/fs_writer maintainer; нести immutable render-before в planned write/pending/safe_write, при расхождении abort/replan. Failure-injection test: barrier после render, внешняя B, apply обязан concurrent_change и B сохранена. Для полной CAS гарантии нужна отдельно обоснованная стратегия; нынешний rename ею не является.

### F2 · P1 · Async component mount не fenced текущей попыткой

**Evidence:** progressive `variant_progress` и `done` могут оба вызвать inject (`live-browser.js:7893–7901`, `:7927–7932`); fetch/params awaits предшествуют global currentSessionId присваиванию (`:6074–6097`). Mount захватывает manifest/target, ждёт runtime/import, затем читает и меняет глобальную `svelteComponentSession` без post-await epoch/session guard (`:5919–5956`). Guard есть в requestAnimationFrame callback (`:5967–5975`), но не вокруг основного mount; teardown выставляет session null (`:6016–6029`).

**Следствие:** медленная старая попытка после новой публикации/переключения/teardown способна mount/report устаревший вариант, unmount новую instance либо попасть в null/error recovery. Не утверждается, что это воспроизведено в браузере.

**Target/acceptance:** upstream live preview maintainer; epoch + local session object identity, recheck после каждого await и до DOM mutation/report. Тест с reversed promise completion двух revisions и teardown во время import: только latest может mount/ack, teardown не воскрешается.

### F3 · P2 · Detect loader застревает после неудачной первой загрузки

`live-browser.js:12586–12592` ставит `detectScriptLoaded=true` до загрузки, не имеет onerror/reset/timeout. При network/CSP отказе последующий load возвращается немедленно; ready не придёт. Target: detect integration maintainer. Acceptance: load promise/state loading/ready/error, сброс после fail, ограниченный retry с понятным UI; simulate reject и успешный второй load.

### F4 · P2 · Full teardown оставляет lifecycle ресурсы

Init создаёт design host и deferred scout (`live-browser.js:13870–13912`); designHost прикреплён к UI (`:12739–12760`). Teardown удаляет перечисленные UI nodes/listeners, сбрасывает init flag, но не designHost и не локальный scout (`:12618–12687`). Scout отключается только при wrapper hit (`:13904–13912`). `cleanup:10087–10175` не является общим disposer design/scout. Debug focus listener отдельно условный и остаётся (`:11062–11069`); его global debug flag предотвращает повторную регистрацию, но замыкает старую overlay instance.

Последствие: после exit могут оставаться design panel/chrome и observer старого экземпляра; повторный init создаёт новый host. Не обобщаем это до «каждый listener течёт». Target: upstream overlay lifecycle maintainer; registry disposers/AbortController и idempotent teardown. Test init→open design→exit→init: нет старого host/observer callbacks. Дополнительное внимание pending component retry и отложенным callbacks.

### F5 · P2 · Parity runners могут green при нулевой substantive проверке

`core/tests/vectors.rs:185–190` missing module превращает в пустые entries; unknown/missing functions SKIP (`:196–198`, `:258–260`); финальный assert только total_fail==0 (`:264–266`). Существующая пустая vectors root проходит. HTML oracle при отсутствии repo возвращает (`html/tests/oracle_html.rs:79–84`), missing workspace/golden также skip (`:214–224`), aggregate fails только на непустом failures (`:193–207`), без minimum matched.

Target: upstream test harness owner. CI strict mode должен требовать expected fixture/function manifest и executed>0; local optional mode явно SKIP, не parity PASS. Tests: empty dir, missing mandatory module, все goldens skipped обязаны non-success/explicit skipped gate.

### F6 · P2 · Extension A/B считает одинаково сломанные сканы идентичными

`ext-diff.mjs:99–112` может вернуть findings=null/injected=false/failed при отсутствии ответа. Без A branch проверяет injected/failed (`:139–142`), но **с A** verdict основан на JSON findings/stripRects (`:145–148`), не на успехе обоих scan. Два null или два пустых findings при failed дают sameNoRect=true и не увеличивают failures. Дополнительно обычные rect differences лишь диагностируются, не fail — это явная политика, не сам по себе дефект.

Target: upstream WASM verification owner. Сначала assert a.injected/b.injected и отсутствие failed/timeout, затем сравнение; отдельный expected nonempty control там, где применимо. Regression: оба scan-failed должны завершать tool кодом 1 независимо от равенства payload.

### F7 · P2 · Harness MCP observation смешивает отсутствие и ошибку; update без readback

`agents/src/mcp.rs:241–250` любой nonzero get трактует как None; `:94–114` использует это для collision preflight. При временном get отказе существующий чужой сервер может выглядеть отсутствующим. `:29–34` remove/add update продолжает без verification, в отличие от first install `:39–45`. `:241`, `:311` blocking output без deadline/output bound.

Target: upstream harness integration owner. Разделить NotFound/CLIError/Unparsed, fail-closed на неизвестное, deadline/limited output, readback после update/remove. Fake CLI tests: transient get failure, add exits0 но config не меняется, hung subprocess. Наличие текущих fake CLI tests не доказывает эти сценарии закрытыми.

### F8 · P2 · OpenCode resume helper без bounds/error propagation

`opencode-loop-plugin.ts:15–21` stdout растёт без лимита, close игнорирует exit code, error превращается в пустую строку; `:33–40` waiting не освобождается при бесконечном child, promptAsync rejection в detached `.then` не caught. Это может навсегда запретить idle retry одной session или потерять resume/error. Target: upstream OpenCode adapter owner; timeout/kill/max-output, structured result, try/finally для waiting, catch prompt errors. Не называть shell COMMAND уязвимостью без недоверенного происхождения: это trusted template input.

### Trust boundaries и эвристические ограничения — не выдавать за безусловные vulnerabilities

- `live-browser.js:13543–13551`: component sidecar HTML/CSS в shadow root. Event handlers, resource loads и browser capabilities не sandboxed; вставка script через innerHTML сама по себе не означает automatic script execution. При доверенном локальном sidecar это capability дизайнера; при внешнем/LLM-generated unreviewed HTML нужна sanitization или sandbox iframe и resource policy. Owner до переноса: Friday design integration/security; acceptance — malicious handler/resource fixture не получает host-page capability.
- `mcp/src/asset.rs:39`, `:55–83`: upload не ограничен workspace. Contract это допускает; не утверждаем permission bypass сервиса. Для Friday допустимые roots/consent/redaction должны быть отдельным решением, не выводом из «no symlink».
- `line_breaks.rs:103–112`, `:181–186`: raw pretty fallback без specificity/условий может подавить straggler по неактивной declaration. Кандидат targeted test: false @media с pretty или более специфичный reset; проверять intent, а не переносить как точную cascade модель.

## 4. Friday: доказанные дельты, конфликты, целевой результат

Сравнение ограничено прочитанными `.codex/scripts/design-lint.mjs`, `lifecycle.py`, `.codex/commands/audit-design.md`, `docs/core/design-principles.md` и прежним project context. «Absent» ниже означает отсутствие в этом inspected executable scope, не поиск по всему Friday и не состояние живого сайта.

| Механизм | Классификация относительно Friday | Обоснование / предлагаемое действие |
|---|---|---|
| Два слоя deterministic + экспертная интерпретация | **Already equivalent по процессу**, не по detector coverage | `audit-design.md:8–20` уже требует lint→design-reviewer→dedup report. Не добавлять ещё один synonymous audit command |
| Declared brand tokens | **Partial** | Friday выбирает MASTER по пути проекта, читает hex/font и warns offbrand (`design-lint.mjs:124–184`, `:187–218`); upstream имеет live computed colors/ramps/context exceptions. Сохранить path-based project isolation; добавить нормализованные token values и source/computed provenance, не заменить MASTER новым competing DESIGN.md |
| Настоящий contrast | **Absent в inspected lint; описан в policy** | Friday `:21–26` только line co-occurrence Tailwind classes, но hint утверждает `<4.5:1`; цикл `:227–241` не вычисляет цвет/размер/cascade. Owner: Friday design tooling; target design-lint + будущий отдельный browser evidence adapter. Expected output: ratio/fg/bg/font/alpha/surface/uncertainty; fixtures pass/fail/unknown, не придуманное число от regex |
| Scope/discovery и exit contract | **Partial / integration risk** | CLI default берёт только `.tsx` (`design-lint:263–273`), отсутствующий явный путь skip (`:283–285`), exit всегда0 (`:300`). Lifecycle даёт `.tsx/.jsx/.css/.html/.astro`, SHA cache и timeout/retry (`lifecycle.py:137–169`), это расширяет hook path, не default CLI. Owner: local lint/lifecycle; expected JSON counts scanned/skipped/errors и optional --strict, tests empty scope/missing file/timeout. При exit change адаптировать cache: сейчас digest сохраняется только при code0 |
| Семантические исключения style rules | **Conflict с буквальным переносом** | Friday ERROR side border/bounce/градиент (`design-lint:15–38`), upstream допускает status/selected/declared palette/pure pulse. House policy `design-principles:44`, `:58–73` не отменяется чужой эвристикой. Отделить house-policy violation от measured visual defect; reviewer решает exemption явно |
| Overflow/typography regression pairs | **Absent в inspected lint** | Добавить evidence-driven checks для реальной поломки/truncation/collision, не grep любых nowrap/overflow. Owner: design tooling; targets отдельный DOM adapter + fixtures. Acceptance: пары inline truncate/inline-block, free space/collision, modal top layer, reduced motion/reveal, CJK/hyphenation |
| Source/inventory preservation | **Полезная отдельная delta** | HTML wiring suite проверяет forms/fields/hooks/content до/после. Owner: Friday design-review workflow; target audit-design instructions и future transformation validator. Expected diff-inventory с missing/changed identifiers, не только screenshot «красиво» |
| Publish/render/save evidence | **Полезная delta; эквивалентность всего Friday не установлена** | Отдельные generation completion, mount ack и durable save status. Owner: будущий preview adapter; expected report полями published/mounted/saved/verified revision, stale epoch test. Не тащить F2 вместе с UX |
| Installer/journal/MCP/upload/auto-resume | **Not applicable к audit-only; отдельный opt-in** | Для улучшения Friday lint не нужны account backend, OAuth, uploads или hooks installation. При отдельном разрешённом rollout сначала project scope, permissions, transaction/recovery tests и explicit external side-effect contract |

Приоритет: (1) исправить достоверность contrast hint и пустого scope, сохраняя advisory vs hard gate; (2) paired fixtures/structured evidence и preservation inventory; (3) при необходимости отдельный opt-in browser adapter с epochs, mount/save provenance и полным disposer lifecycle. Не устанавливать весь upstream ради нескольких heuristics. Экспертный design-review слой сохранить: palette/карточки/шрифты не сводятся к паритету двух реализаций одного правила.

## 5. Closure и оставшиеся gaps

- **Назначенных непрочитанных файлов/строк: 0.** Не использованы alias/classified вместо назначенного substantive text reading. Все индивидуальные записи — в companion ledger.
- Статические findings F1–F8 и trust/heuristic limitations остаются открытыми продуктово; аудит не содержит исправлений. Предложенные owners/targets — маршрутизация рекомендаций, не принятие обязательства upstream.
- Runtime verification намеренно отсутствует: нет заявлений о числе passed tests, работающем login, browser mount, file rollback, service consent или живом Friday gate.
- Внешние зависимости прочитанных entrypoints прослежены до imports/paths/protocol boundaries; реализация account/backend/extension consent/всего HTML cascade и manifests/build outputs за рамками assignment не объявляется заново fully audited. Это граница follow-up, не скрытое незакрытое чтение 64 файлов.
- Сравнение с Friday — по inspected local source; не проверка native Codex/TOML triggers и не утверждение, что hooks реально активны в Hermes.
- Единственная техническая проблема продолжения: convenience `execute_code` wrapper read_file вернул envelope без ожидаемого `content`; попытка завершилась KeyError до записи. Для механической сверки использовано stdlib чтение JSON/bytes, для semantic reads — numbered read_file; upstream код не импортировался и не исполнялся.

**Verdict: READ_SCOPE_CLOSED / STATIC_FINDINGS_OPEN / RUNTIME_NOT_RUN.** Только два собственных audit artifacts созданы/обновлены; чужие reports, source, конфиги и сайты не менялись.
