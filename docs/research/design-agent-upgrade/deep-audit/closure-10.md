# closure-10 — содержательное закрытие назначенных диапазонов

## Verdict и граница доказательства

**PASS по полноте статического чтения назначения: 32 диапазона, 17 974 строки. Не runtime PASS.** Срезы прочитаны целиком средними последовательными батчами; два усечённых вывода дочитаны отдельными диапазонами (evidence.rs:438–475 и lab.html:40–56). SHA-256 каждого целого файла совпал с inventory, total_lines — с assignment; повторная проверка выполняется после подготовки отчёта. Ledger намеренно ставит `status: partial` всем записям: это range-аудит, не заявление полного аудита соответствующего upstream файла/дерева. `assigned_range_complete` относится только к назначению. Дополнительный контекст границ: page_checks.rs:4760–4800 и text_collectors.rs:1550–1600; в назначенные 17 974 строки он не входит.

Scope: source snapshots Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`, Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`. Friday HEAD прочитан: `388ec708f39583172d7f36110f6424cc175b5512`; сравнение также учитывает прочитанные working-tree инструкции. Kowalski в этом assignment отсутствует. Запуск upstream, imports, hooks, installs, tests, UI, сетевые вызовы upstream не производились. Исходники, настройки, клиентские сайты не менялись. Все «тест проверяет» ниже означают прочитанный assertion/fixture intent, а не наблюдавшийся успешный прогон.

## Главные выводы и полезные различия Friday

| Область | Сравнение с прочитанным Friday | Доказательство / решение |
|---|---|---|
| Screenshot evidence | **partial**: Friday уже требует три ширины, просмотр и интерактивные состояния, но его script делает прямой Playwright screenshot после фиксированного wait. В прочитанном script нет nested-scroller stitching, identity, drift, validity или capture replay | Friday `.codex/scripts/screenshot.mjs:34–38,107–139`; Impeccable `crates/browser/src/fullpage.rs:608–710,1027–1290`, `crates/browser/tests/evidence.rs:328–398,478–588`. Переносить контракт доказательности, не весь Rust runtime |
| Runtime geometry/contrast | **partial**: Friday reviewer уже смотрит иерархию/контраст/длину строки; исполняемый lint остаётся построчной эвристикой, не расчётом pixels | Friday `.codex/agents/design/design-reviewer.md:39–98,125–156`; `.codex/scripts/design-lint.mjs:20–26,221–240`. Impeccable `visual.rs:109–291,1094–1279`, `page_checks.rs:4807–5402`, `text_geometry.rs:113–348`. Не выдавать gray-Tailwind regex за measured 4.5:1 |
| Project-owned design tokens | **already equivalent по ключевому принципу**, не по всем formats | Friday `design-lint.mjs:106–184` выбирает MASTER по пути projects/tools прежде active; Impeccable `hook_tests.rs:499–549,606–687` требует app-local DESIGN. Не добавлять вторую конкурирующую .active-модель. Синхронизация sidecar/staleness — отдельная delta |
| Revision-bound acceptance | **already equivalent на уровне Friday workflow; partial в конкретном UI evidence** | Friday `.codex/workflows/review-loop.md:22–54` аннулирует прежние pass при revision change. Impeccable `hook_tests.rs:264–355` привязывает ship к artifact и captureInputs. Полезная детализация: изменённый CSS должен аннулировать визуальную приёмку, даже если entry HTML прежний |
| Existing debt vs agent blame | **absent in inspected local script scope**, не утверждение об отсутствии во всём Friday | Impeccable `hook_tests.rs:698–1059`: проверенный preimage, multiset occurrences, unknown attribution и bounded notices. Friday прочитанный `design-lint.mjs:221–240` выдаёт все совпадения без session baseline. Не подавлять долг, а отдельно маркировать old/new/unknown |
| Hook portability / Hermes | **not applicable для прямого копирования manifests**, полезен подход adapter contract tests | Impeccable `hook-build.test.mjs:296–356` прямо различает Hermes plugin `transform_tool_result/pre_verify` и manifests других providers. `hook_manifest_tests.rs:316–500` сохраняет известные Windows gaps, а не обещает universal shell support. Friday `.codex/CODEX.md:35–68` уже требует реальный доступный механизм и content parity. Тестовые manifests не доказывают живое подключение |
| Product mockups vs actual UI | **partial**: Friday nested-card/a11y checklist общий, без прочитанного механического классификатора | Friday reviewer:140–156; Impeccable `hidden_mockup.rs:38–45,188–241,341–443`. Borrow conservative mockup exceptions с negative twins, не blanket «aria-hidden значит не проверять». Working forms/modal-backed page сохраняют проверки |
| Taste hard house rules | **conflict при универсальном включении** | Taste consistency:10291–10317,10338–10346,10606–10641,10871–10896 требует hero CTA/full-screen, visual sections, ≤2 button looks и часто FAIL за scroll motion. Friday reviewer:86–111 требует доменный смысл/частоту; `docs/core/motion-engine.md:23–46` допускает scrollReveal. Эти Taste checks только явно выбранный профиль/сигнал для reviewer, не auto-fix всей базы |
| Motion/assets | **partial/equivalent по отдельным примитивам**, не turnkey import | `fx-avatar/component.css:38–41` явно reduced motion; god-rays делегирует shader helper, print-cards — definePrint. Friday `.codex/CODEX.md:372–378`, `motion-engine.md:10–34,71–81` требует wrapper и measured bundle. Не переносить эффект без lifecycle/fallback/context-budget и brand mapping |
| Target sizing / fonts | **conflict при production-копировании** | Taste prompt tools/send32px и hints30px (`component.css:23–46`), lab34px (`lab.html:40–47`), giant-type demo Inter (`demo.html:10,17`). Friday reviewer:127–129,152–155 и CODEX:353–360 — 44px/brand font. Демо не освобождает production от адаптации |

## Находки, ограничения и владельцы следующего разрешённого этапа

1. **КАЧЕСТВО / reproducibility:** frozen recorder не регенерируется на этом snapshot: `crates/comp/tests/record.mjs:4–7,23–32,126` требует удалённые JS modules. Проверка existence подтвердила отсутствие `skill/scripts/lib/png.mjs` и `skill/scripts/comp-diff.mjs`. Owner будущего parity-процесса: qa-engineer; target — provenance manifest тестовых goldens с old revision/source hash/command. Ожидаемая проверка: regeneration на явном historical snapshot либо явная метка frozen; не тестировать фиктивный current recorder.
2. **КАЧЕСТВО / zero-scope gate:** `assets/objects/_scenes/lint-glsl.mjs:56–82` в explicit-file ветке не проваливает `checked===0`: файл без `/* glsl */` получает нулевое покрытие и exit0. Это статически установленное поведение, не наблюдавшийся запуск. Owner: qa-engineer при будущей адаптации shader tooling; ожидаемый negative fixture — непустой JS без shader literals должен дать distinct no-shader/not-applicable либо failure, не притворяться проверенным GPU-кодом. Friday CODEX:800–804 уже запрещает пустую зелёную проверку.
3. **КАЧЕСТВО / evidence mutation:** `fullpage.rs:376–388,1150–1152,1286–1289` возвращает документ в начало, а element-shots скроллят ancestor chain без общего восстановления. Это важно для будущего захвата в пользовательской авторизованной сессии; не дефект заявленного isolated evidence контракта. Owner: browser tooling; target будущего Friday screenshot adapter — сохранение/восстановление исходных window+ancestor offsets и disclosure hidden covers. Test intent: nested scroller/RTL/modal/duplicate selectors/virtual feed, screenshot failure cleanup.
4. **КАЧЕСТВО / readiness не compliance:** `foundations-scan/src/lib.rs:1861–1927,1930–2037,2040–2076` засчитывает filename/dependency/existential guard evidence. Не подменять этим Friday legal review, реальные exception delivery или reduced-motion всех маршрутов. Owner: design-department + legal/security по предмету; target будущего отчёта — отдельные detected/configured/exercised/unknown и read/coverage limits.
5. **КАЧЕСТВО / E2E truthfulness:** `tests/live-e2e/ui.mjs:54–69,468–472,794–823,1271–1277` имеет soft handshake, DOM-click fallback и hides. Сильные anti-mask примеры — noRetry stuck shader:640–659, mounted variant settle:741–765, source readback:1242–1249. Owner: qa-engineer; target будущих UI тестов — отдельно interaction-realism и state/render/source evidence. Не повторять декларацию «ровно как пользователь» для всех helpers.

Рекомендуемый первый delta: улучшить evidence schema и negative fixtures в будущем, сохранив Friday brand/domain authority; не устанавливать новый движок, не переносить Taste marketing FAIL автоматически. Ничего из рекомендаций этой audit-only задачей не внедрено.

## Содержательная карта всех назначенных диапазонов

Номера ниже соответствуют порядку assignment. Зависимости, состояние, ошибки/побочные эффекты и intent тестов отмечены внутри каждой записи. Если реализация helper вне range, это явно dependency, не заявленное полное чтение transitive runtime.


### 1. impeccable — `crates/browser/src/fullpage.rs:1–1600`

CDP-снимок не сводится к fullPage: вложенный скроллер, RTL/отрицательный origin, ширина до 4096 CSS px, виртуализированный пустой хвост и resize-relayout переключают захват на PNG-тайлы. До 240 тайлов, до 40 отдельных viewport-захватов для элементов за пределами общего кадра. Отдельные элементы разрешаются по сохранённой node identity, затем по индексу повторного selector. Неподвижные перекрытия временно получают opacity:0 с восстановлением и disclosure hidden_covers; открытый modal не скрывается. Ошибки захвата оставляют findings без картинки. Layout-проба 6×6, горизонтальное движение ≥2px минимум двух и четверти измеренных блоков; возврат дважды через 100ms, ожидание до 2s. Пустые полосы отличают от медиа. Тесты проверяют transient resize, невзаимозаменяемость двигающихся виджетов, границы и скроллер. Документ возвращается к началу, а не к произвольному исходному scrollX/Y; вложенные ancestor scroll offsets element-shot не восстанавливаются.


### 2. impeccable — `crates/core/src/browser/visual.rs:1–1600`

Это начало подсистемы визуального контраста, не весь verdict: Rust принимает Dom и делегирует shared foundation/color/text_layers/painted, а асинхронные pixels/scroll находятся в JS bundle. Reasons: image/gradient/background-clip text, text-shadow, opacity, blend/filter/backdrop. Почти непрозрачная подложка ≥0.8 допускает pixel-путь, halo требует разделения с ink ≥2:1. Малый повторяющийся raster ≤256px считается texture, одиночный небольшой no-repeat — icon, не фон текста. Paint-модель различает Picture/Fill/PseudoFill/Unmodelled/Gradient; отрицательный z-index, stacking context, transformed pseudo quads и неизвестный origin не заменяются простым contrast(color,background). Обход ограничен 32 уровнями/соседями, 6 обычными или 24 покрывающими уровнями, 64 детьми и 1024 узлами. Неизвестная геометрия уводит к осторожной классификации, не доказывает pass. В данном Rust-срезе DOM не меняется.


### 3. impeccable — `crates/hook/tests/hook_tests.rs:1–1600`

Контракты hook-тестов: буквальная session identity без shell injection; SessionStart append без повторов; Gemini BeforeTool меняет только читающий session build-phase, AfterAgent использует deny; чужую сессию/continuation не перехватывает. Напоминания о незавершённом comp ограничены; ship привязан к artifact/captureInputs SHA и аннулируется изменением HTML/CSS. Для monorepo DESIGN выбирается по файлу приложения без переноса cache root. Debt attribution использует проверенный dirty-worktree preimage, а не HEAD: new/pre-existing/unknown; source body в cache не пишется, одинаковые дополнительные occurrences не теряются. Есть UTF16 budget, фильтры sensitive/generated, symlink scope, shared/local config, extension suffix, восемь последних cache sessions, worktree common info/exclude, advisory tiers и безопасно quoted ignore-value hints. Это определения тестов: запуск создавал бы temp/config/git/shell side effects; здесь не запускались.


### 4. impeccable — `crates/core/src/browser/page_checks.rs:4801–6400`

Реальные DOM-правила text-occlusion и first-viewport-column-overflow. Occlusion читает painted-at-capture и glyph/line geometry: исключает sr-only, blur, движущийся marquee, pinned overlay, media, buried curtain и точную надпечатку тех же glyphs; порог text/graphic 45%, box/border 30%. Отдельно headline ≥40px, который нависает над краем чужой карточки, и opaque padding inline, реально перекрывший текст соседа. Декоративный mockup переводит часть находок в advisory, не стирая controls/leak. First-fold: широкая flex/grid секция, длинная колонка >1.4vh и сосед ≤vh, реально рядом, стартуют близко; nav/tab/sticky/link rails, hidden details и clipped content корректируют выбор. FakeDom-тесты фиксируют aliases/загрузку/реальный render шрифта, минимум 5% букв, CJK fallback, иерархию с шагом 1.25, popup/control-strip/page-frame исключения nested cards и run-in heading rhythm. Чистый статический Dom-анализ.


### 5. impeccable — `crates/skills/tests/hook_manifest_tests.rs:1–1463`

Полный набор тестов переписывания hook manifests: разные shell/command fields и пути Claude/Codex/Cursor/Copilot/Grok/Gemini/Antigravity; project/home/CODEX_HOME; legacy mjs → launcher; идемпотентные merge/prune только своих handlers, сохранение чужих hooks/settings и enabled:false. Gemini JSONC сначала backup; malformed whole settings не заменяются даже force. Project-hook не удаляется до полноценной home-замены и существующего launcher. Явно документированы Windows gaps: GROK_SHELL=cmd escaping и VS Code agent-host при single-quoted пути с пробелами. Тестовые shell-spawn/write не выполнялись.


### 6. impeccable — `tests/live-e2e/ui.mjs:1–1453`

Playwright helpers для живой панели: shadow-root queries, pick/insert exclusivity, detect overlays без перехвата pointer при pick, Design Raw/loaded/error/close, annotations pin/stroke/upload shape, реальный keyboard focus configure, count2..4/action/Go, Tune, edit-copy/apply/source readback, steer lock/unlock, insert anchor. CYCLING требует не только счётчик, но arrived variants и при наличии debug — mounted variant; computed font-weight доказывает render. Зависший generating shader даёт no-retry: reload не должен скрыть дефект. Есть mount-error/retry. Ограничения: handshake после init/bar лишь ждёт 250ms, а не доказывает SSE; часть fallback использует DOM.click, скрывает annotation/Astro toolbar и не равна чисто пользовательскому клику.


### 7. impeccable — `crates/foundations-scan/src/lib.rs:1601–2786`

Хвост foundations scanner: favicon плюс крупная иконка/локальный manifest; framework-aware 404; social preview; privacy+terms по путям; error-tracking по зависимостям/API evidence; reduced-motion/token presence и giant-file exclusions. Это readiness hints: один motion guard или token usage может засчитать всю область, имя legal route не доказывает правовое соответствие. Secrets получают отдельные read/byte budgets, tracked git и максимум пять безопасных locations без значений. Failed git/incomplete list/overbudget не превращается в чистый Checked. Исключения публичных env/stand-ins, binary/lockfiles, parsing comments только для evidence, не secrets. CI block/list commands и README code commands отделяют исполняемую подсказку от prose/scaffolding.


### 8. impeccable — `tests/oracle/cases/context.mjs:1–1053`

Полный offline oracle corpus, не golden outputs: env isolation; context/doctor по product/design/target/native/monorepo/git boundaries, staleness throttle и hook coverage/recent cache. Doctor --fix/idempotence/drift; design-compact archive/no-symlink/no-overwrite, lookup и font-fetch отказы до сети. Pin/unpin не трогает foreign commands, OpenCode получает commands. Surface briefs primary/related/routes, report enabled:false/latest/trend, palette seed precedence, PNG/JPEG prompt metadata и WebP sidecar, git UI signals, CSP Next proxy. Concept seed включает modes/quotas/catalog/degraded/roll records. Generate-image только fake/error/ref-unreachable; question — answer/reroll/flip, recorded root, 30min hand budget, stale comp fingerprints, sidecars, per-hand generated marker и обязательные comps/catalog identity. Fixture setup создавал бы файлы/git; реальные генерации, browser и server этим файлом не доказаны.


### 9. impeccable — `crates/core/src/browser/hidden_mockup.rs:1–929`

HiddenMockups: только уверенно declared inert/aria-hidden frame ≥120×80, ≥3 rendered text runs, ≤3000 узлов, меньше половины текста страницы. Landmarks/h1/text hosts, modal backdrop/chrome, carousel/peer/копия split text и readable sr alternative не mockup. Working UI: ≥2 поля или поле+label, либо половина linked text runs, также сохраняет обычную проверку. Screenshot aria-label означает advisory, не drop. DROP_RULES ровно low-contrast/nested-cards/tiny-text/undersized-ui-text/cramped-padding/clipped-overflow-container; заголовки declared mockup не участвуют в outline по контракту модуля. Per-page caches, без DOM-записей. Много positive/negative FakeDom twins.


### 10. taste — `skills/taste-skill/scripts/consistency.mjs:10138–10909`

Срез consistency — orchestration и конкретные house checks, не вся программа. Группировка одной причины/selector/severity, crops; новая CDP tab на ширину, fonts/prescroll/rendered.html, до 80 остановок с шагом .85vh и восьми held scenes, pixel helper, hide-and-diff visual/text plate, повтор через 1.2s. Hierarchy 1.15/1.3; ≤2 hero actions и CTA hero/pricing/close; полный hero на первый экран; tablet main CTA; UI ground 3:1, image text worst tenth 3/4.5, plain body 7:1, button ground1.3; visual coverage около25%; photo-grade consistency; grid offsets2..24px с optical exception; nav form/current/edges; section gaps25%/60%; ≤2 button styles. Scroll-reveal/pinned/scroll-linked и text-only sections часто FAIL независимо от продукта. Ошибки safe-обёрток накапливаются, не все calls safe. Скроллит/скрывает DOM, проверяет ссылки по сети, пишет HTML/JPEG crops. Эти маркетинговые вкусовые ограничения нельзя объявлять универсальными Friday.


### 11. impeccable — `crates/browser/tests/evidence.rs:1–588`

Browser evidence integration tests: CLI отказывает captcha405/404, evidence сохраняет validity/screenshot и ноль findings без scan_snapshot. Проверяются post-reveal реальные дефекты, painted hidden/visible twins, selectors/rects; replay точь-в-точь только SCAN/CONTENT_HIDDEN, pixel visual contrast исключён. Повторный id не ведёт к первой скрытой копии, есть node identity, transient cleanup, scan/measured/afterShot drift и halo anchor. Нет browser/fixture — тест может skip; определения не runtime PASS.


### 12. impeccable — `crates/context/src/roll_selection.rs:1–532`

Детерминированный SHA-ranking approved catalog: rating1 даёт один ticket, остальные два, family diversity, niche fallback, mode/strength filters. Operate — 5 graphic+1 interaction+0 atmosphere, пустая неприемлемая non-graphic quota переносится в graphic; reroll предпочитает unseen, затем reuse без starvation. Compositions: exact mode без fallback, platform exclusion, grain preference, family-first/topup и match metadata. Проверка parity >100 recorded cases в тестах; здесь только чистый код selection, без записи/сети.


### 13. impeccable — `tests/hook-build.test.mjs:1–516`

Build pipeline test contracts: реальные event/matcher/таймауты/платформенные поля и guard launcher без Node, shared manifest fixtures JS↔Rust. Hermes не получает hooksJsonFor manifest: transformer копирует __init__.py/plugin.yaml с transform_tool_result/pre_verify. Проверки generated output условны SYNCED launcher, допускают старый Cursor preToolUse до release sync. Это не доказательство установленного/доверенного hook runtime.


### 14. impeccable — `crates/browser/tests/text_geometry.rs:1–404`

Geometry browser tests: Range lines ≥85 chars при ориентире<80 с CJK/font condition; viewport gutter отдельно от page sideways overflow, mobile12px. Short bold title/clamp исключения tight-leading, chip glyph vs content box на27.5px, только реально видимые края cramped padding. Text spill подтверждается paint, исключаются свободное место, terminal/code, hover tooltip; edge-flush только x-card scroller. Local browser/server/fc-list запуск не выполнялся, отсутствие browser даёт skip.


### 15. taste — `skills/taste-skill/assets/effects/lab.html:1–390`

Effects lab — palette/light/dark/colour, grid/card/wide/hero, UI overlay и calmX/Y, sliders/seed/reset/copy snippet, pause/play, URL state, force fallback/WebGL1/fixed clock. Зависимости fx.js/index.json; gallery cap16 против обычного4. При index error явная ошибка/инструкция; mount rejection локально не пойман, конкурирующие remount не сериализованы в этом файле. CSS buttons34px — не Friday production44px. Реальный вид не открывался.


### 16. impeccable — `crates/cli/src/foundations/local.rs:1–327`

Disk Source foundations: bounded walk и read без leaf symlink, head8KiB binary detection/whole read; nearest git root только для top config/до200 workflows. git ls-files -z --cached, fsmonitor:false, deadline3s/kill и различение NotRepo/Failed. Full detect/foundations, не edit hook. Disk/listing test требует непустые ≥4 states и >1 read pass перед equality; fixtures, git и команды не выполнялись.


### 17. impeccable — `crates/core/src/browser/text_collectors.rs:1601–1895`

Хвост FakeDom tests: em-dash не считает lone dash matrix cells, shown select options и структурные list separators, но считает prose; rendered uppercase не теряется. Label-before-heading поднимается до четырёх wrappers и требует proximity/box; numbered mono index beside heading; повторённый текст только ≥3 distinct painted spots, ID-like classes и одинаковые list positions не отдельные spots. Это intent тестов, не новые реализации collectors.


### 18. taste — `skills/taste-skill/assets/objects/product-render/make-posters.html:1–254`

Poster baker: print3d/build product spec, GL4, до4MP/no adapt; ждёт live ready и отказывается снимать fallback как успешный render. Reference accent plates+colour проходят gamma/filmic relight, coverage/shadow crop, connected components убирают фрагменты close-up и близкую тень; focus/cut/box и measured-vs-predicted report. Полный/половинный WebP, packed fallback PNG, __files/__manifest/__report, ready/error. Outer catch явный; shoot destroy не finally при ошибке ready/snapshot. Не сохраняет исходную фотографию товара пиксель-в-пиксель.


### 19. impeccable — `crates/comp/tests/record.mjs:1–199`

Frozen parity recorder: imports удалённых JS png/raster/metrics/font/hero библиотек через старый checkout override. Пишет fixture PNG и golden/parity.json с CRC/structure/color/detail/bands/font/hero results для flat/recolor/shift/self. В текущем snapshot отсутствуют skill/scripts/lib/png.mjs и skill/scripts/comp-diff.mjs: подтверждённая воспроизводимость требует старый revision. Сам recorder не тест actual port и не запущен.


### 20. taste — `skills/taste-skill/assets/effects/god-rays/effect.js:1–184`

God-rays: angular noise shafts/haze/dust, seed/time, OKLab warm light с сохранением светлоты light ground, ellipse calm area, source aim уходит от верхнего text block. Schema origin/tilt/spread/density/intensity/falloff/speed/dust/tint/calm, still6 и radial+linear CSS fallback. shader/fx.js владеет ресурсами/планировкой/reduced motion; этот файл их сам не гарантирует.


### 21. taste — `skills/taste-skill/assets/ui/pipeline-board/fragment.css:1–162`

Pipeline CSS: waiting/run/done/passed/reset, один accent на running spinner1s/bar --k, done — ink check/time. Container widths399/299/279, ≥680 horizontal nodes+log, phone100%. Fine-pointer hover/pressed; token --u, ui-spin снаружи. Нет CI backend/failure model или локального reduced-motion gate.


### 22. impeccable — `crates/foundation/src/vectors/checks_a.rs:1–153`

Vector adapter rules.checks: восемь dispatch functions emoji/custom props/selector/length/zero/marquee/pulse/stripReducedMotionBlocks. Сохраняет JS undefined/null/truthy/string-array и UTF16→byte offset semantics. Неизвестный module/function→None, невалидная длина/index→Null; фактический CSS анализ делегирован css_scan.


### 23. taste — `skills/taste-skill/assets/objects/print-cards/object.js:1–131`

Playing cards: десять SDF cards, ace/diamond pips и back lattice, два материала print/render; u_step fan toggle, spin/hover light через definePrint. Label/press, camera/bounds/shadow32/step1s и card/tile/hero/narrow placement. A11y/lifecycle/reduced motion — контракт внешнего print3d, не доказательство из object.js; это процедурный ассет, не оригинальный клиентский товар.


### 24. taste — `skills/taste-skill/assets/scenes/product-assembles-into-its-action/demo.html:1–110`

Invoice assembly demo: semantic ordered five steps, data-at rows/action/paid, skip#after и roleimg screenshot, аудитория/цена/benefit copy. Shared scenes/css и Google Instrument Sans; sc-safe через2.5s. href# и проценты/суммы — demo content, не действующий invoice workflow.


### 25. taste — `skills/taste-skill/assets/objects/_scenes/lint-glsl.mjs:1–82`

GLSL lint entrypoint: kit glslLint/GLSL_PRINT/GLSL_LIB, selfcheck12 bad+4 good; default пять scene objects, четыре form expansions или explicit GLSL templates; неизвестные interpolation удаляет, remap lines, exit1 при проблемах. SwiftShader screenshot не доказывает strictGPU compilation. В explicit mode файл без marked literals даёт checked0 и успешный выход, непустой scope не защищён здесь.


### 26. taste — `skills/taste-skill/assets/scenes/dot-becomes-the-full-stop/demo.html:1–81`

Payroll dot/full-stop demo: semantic h2 claim и support text, roleimg product panel, included-service rows и inverse palette/Onest. sc-safe2.5s/shared scenes. 4200 companies/no late — пример, не проверенная фактура; animation/reduced motion находятся вне назначенного demo.


### 27. taste — `skills/taste-skill/assets/scenes/object-through-giant-type/demo.html:1–72`

Giant-type/globe demo: aria full quote, blockquote halves, print-globe opts и globe.png still/host, scenes+print auto. Google Inter/Inter Tight конфликтуют с Friday default-brand запретом. Latency/uptime/person quote — demo-only. sc-safe2.5s; runtime сцены этим HTML не доказан.


### 28. taste — `skills/taste-skill/assets/moments/letters-assemble/demo.html:1–61`

Letters-assemble demo: semantic h2/sub, pipeline UI mock, facade photo с alt, explicit demo copy. mo-safe2.5s, preloads moments/lib/moment, shared css и Google Schibsted/Hanken. Сама сборка букв/reduced motion не в этом файле; UI mock не реальная pipeline.


### 29. taste — `skills/taste-skill/assets/components/fx-pricing/component.css:1–55`

Pricing CSS: 3plans→1 ниже900px; badge переносится под name, >=900 subgrid5rows выравнивает цены/CTA/list. Featured fallback border остаётся до is-live, masked ring+top wash pointer:none и contentz1. Theme variables и button semantics внешние; billing/выбор плана не реализованы CSS.


### 30. taste — `skills/taste-skill/assets/components/fx-prompt/component.css:1–50`

Prompt CSS: plain fallback card исчезает лишь при фактическом первом frame canvas opacity1; focus-visible host outline, negative-margin glow, textarea52px. Tools/send32px, hints/pause30px конфликтуют с Friday44px. Нет request/cancel/loading states; literal inline-style selector связан с renderer implementation.


### 31. taste — `skills/taste-skill/assets/components/fx-avatar/component.css:1–42`

Avatar CSS: is-speaking и --fx-x/y перемещают маску ring/glow; initials/status/live blink/equalizer; responsive64→52. Явный prefers-reduced-motion выключает blink/eq/transition ring. Audio speaker detection/network backend отсутствуют в CSS.


### 32. taste — `skills/taste-skill/assets/ui/search/fragment.css:1–30`

Search CSS: field52px, rows40px, caret blink, is-sel/is-hidden/is-stale opacity.38, matching bold и kbd cues; phone100%. Нет реального input/keyboard/search/stale-response ordering, local reduced-motion не задан. Inset accent selected row — semantic state, не автоматически декоративный side-tab.


## Проверка references и coverage

Existence-проверкой без imports подтверждены Taste `effects/fx.js`, `effects/index.json`, `objects/_print-core/print3d.js`, `objects/product-render/build.js`, `objects/_scenes/kit.js`, `scenes/scenes.js`, `moments/moments.js`, scene globe.png и moment photo-887.jpg; Impeccable transformers/hooks.js, Hermes plugin __init__.py/plugin.yaml и roll-quota-parity fixture. Это разрешение путей, не substantive reading указанных dependencies и не просмотр бинарных images. Рендер demos и реальные GPU, фоновые службы, доверие hook runner и внешние API не проверялись по прямому запрету задания.

`closure-10-coverage.json` содержит repo/path/full-file SHA-256/total_lines, точные ranges и substantive notes; все assigned ranges закрыты, весь остальной upstream вне этого назначения не объявляется прочитанным. Две новые/обновляемые выходные записи: этот отчёт и его coverage. Механическая валидация coverage+inventory+assignment не запускает upstream code.
