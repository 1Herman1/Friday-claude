# Taste close-2 — implementation follow-up (static-only)

## Вердикт и точное покрытие

**REWORK / НЕ ЗАКРЫТО ПОЛНОСТЬЮ.** Это содержательный промежуточный implementation-аудит, а не полный PASS. Из 117 назначенных исходников полностью прочитан 51 (18 560 строк); 66 исходников (8 276 строк) ещё не прочитаны. Все они перечислены в конце и остаются `unread` в coverage. Метаданные, подсчёт строк, SHA и поиск не засчитаны чтением реализации. Предыдущие короткие ranges из assignment не унаследованы как собственное полное чтение.

- Assignment: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/followup-assignments/taste-close-2.json` (26 836 строк исходников).
- Source root: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/taste`.
- Заданный upstream revision: `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`; SHA-256 каждого файла в соседнем ledger фиксирует фактически прочитанный snapshot.
- Friday HEAD проверен read-only git: `388ec708f39583172d7f36110f6424cc175b5512`. Сравнение учитывает только прочитанный working context; отсутствия во всём Friday не утверждаются.
- Никакие upstream JS/imports/installer/hooks/tests/browser не запускались. Никаких визуальных, FPS, GPU memory или WCAG результатов не получено. Описанное поведение — трассировка веток исходника; симптомы требуют отдельного разрешённого runtime-теста.
- Роли, клиенты, конфиги, зависимости и upstream не изменены. Записаны только этот отчёт и `taste-close-2-coverage.json`.

Это дополнение к `taste-content-runtime.md` / `taste-assets.md`: оно разбирает конкретные реализации, а не повторяет правила/metas. Старые отчёты не считаются доказательством полного чтения оставшихся исходников. Ответственного за устранение findings здесь никто не назначал; ниже указаны только рекомендуемые роли/targets будущей работы.

## 1. Новые границы runtime и зависимостей

### 1.1 Общий FX runtime — полезный, но не жёсткий admission control

`assets/effects/fx.js` прочитан полностью. `config.maxLive = 14` (`fx.js:17-20`) **не означает 14 контекстов по умолчанию**: `tpMax()` берёт `window.__tpGlMax || 4`, а `glCap()` учитывает остальные runtime (`fx.js:544-555`). Ещё важнее: `glBudget()` освобождает только невидимые instances, затем безусловно добавляет новый holder (`fx.js:558-576`). Когда все существующие видимы, отказа/очереди/постера этот API не возвращает. Поэтому прежнее краткое описание «общий cap 14» недостаточно; это cooperative accounting + idle eviction, а не гарантированный hard limit для custom contexts. Сам shader-runtime и custom photo/scenes/print engines имеют разные локальные механизмы: переносить их как единый доказанно безопасный менеджер нельзя.

Положительное: palette normalization/OKLab gamut fitting, seeded variation, bounded DPR/FPS, visibility/reduced lifecycle, GL1/GL2 helpers, CSS fallbacks, destroy — реальные implementation-примитивы, а не только декларации. Обязательный delta для возможной адаптации: admission token с `granted/queued/denied`, общий владелец лимита, отмена запроса и статический постер до выдачи токена. Это **opt-in GPU adapter**, не новая обязательная зависимость каждого Friday-проекта.

### 1.2 Три различных image/3D stacks, не одна библиотека

- `objects/_print-core/print3d.js` (1 795 строк): procedural SDF form → печать/тонирование → poster/live/retained-frame; локальный pool, адаптация, first-frame probe, управление pause/keyboard/observers. У него собственные формы/постеры/ready lifecycle.
- `objects/product-render/build.js` (1 387): spec/material/primitive compiler, bounds/pose-chain, named views/scenes/colorways, poster manifest и `image/still/live`. Он строит real-product-like формы из описания, но вложенные hardcoded props и default variants не доказывают соответствие реальному товару.
- `objects/photo-kit/photo.js` (1 138): decode/crop/levels/edge/blue-noise, texture/loupe shader helpers, max-three локальный pool, original-photo fallback, credits formatting.
- `objects/_scenes/kit.js` (959): stage-local max-two pool, CPU-photo helpers, matrix helpers, shared pause hit area, flat-first-frame fallback и retained image.

Первые четыре файла прочитаны полностью. Это не распространяется на не назначенные/не прочитанные `specs`, `auto.js`, shared component helpers, poster generation или binary image pixels. `product-render/make-posters.mjs` назначен, но пока не прочитан: offline asset pipeline остаётся открытым.

### 1.3 UI/scene contracts и недочитанные зависимости

`ui/ui.js` прочитан полностью: fragments/style/module caches, unique SVG id rewriting, timelines, generation abort, visibility/hover/keyboard pause, grounds bake priority/queue, narrow presets. Но `ui/cards.html`, `ui/base.css`, большинство fragments и UI demo entrypoints ещё открыты: нельзя объявлять каждый UI asset проверенным через общий loader.

Полностью прочитанные scene implementations: product-assembles-into-its-action, object-through-giant-type, letter-bar-floods-the-ground, shaped-window-over-fixed-world, fixed-hero-object, letter-physics. Их `lib.js`/`print.js` здесь не прочитаны, следовательно responsive/reduced dispatch, `attachPrint`, scrub cancellation и общий exception recovery остаются dependency gaps. Прочитанный `scenes/scenes.css:21-29` подтверждает sticky live stage и скрытый pre-mount stage до `.sc-safe`; наличие/надёжность timeout в loader этим CSS не доказывается.

## 2. Concrete reusable positive patterns — переносить устройство, не samples

1. **Постер является частью контракта, а не error page.** print3d стартует с image, переходит к live и сохраняет кадр при release; product-render различает image/still/live. Сохранять один и тот же semantic product/focus box между режимами; не подменять реальный товар generic SDF. См. полные файлы в ledger; конкретный still→blob путь `product-render/build.js:1262-1280`.
2. **Ресурс дорогой только во время действия.** photo-kit просыпается на hover/tap, stages освобождаются offscreen/idle, still cards сохраняют картинку вместо постоянного GL. Лимиты не копировать без исправления admission (§1.1).
3. **Композиция учитывает место текста геометрически.** dotted-globe задаёт calm-aware placement и отбор видимых hubs (`effects/dotted-globe/effect.js:268-295,705-755`); это лучше, чем «сделать глобус прозрачнее». Его география/маршруты — фикстуры, не customer data.
4. **Canvas ограничен visual box.** dotted-globe рисует мягкое тело в 1x, dots/arcs — bounded box с DPR cap (`effect.js:670-695`), кэширует lattice по квантованному радиусу (`626-668`). Это конкретный экономный pattern, не измеренный performance результат.
5. **Типографика резервирует место до движения.** `layout/layout.js` измеряет lines после fonts, CSS rotating word резервирует max slot; `motion.js` фиксирует width числа до count-up. Подход пригоден для локализованных данных только после проверки числового парсинга и длинной кириллицы.
6. **В responsive rest показываются все смысловые шаги.** scene CSS не оставляет многоскринный пустой hold: rest composition становится обычным flow (`scenes/scenes.css:12-20`); pinned chapters static rows сохраняют свои images (`moments/pinned-chapters/moment.css:20-36`). Loader restoration ещё не доказан.
7. **Анимируем solid geometry вместо маски с seam.** shaped-window использует пять прямоугольных ground pieces, отдельную целую photo и caption band (`scene.css:25-43`, JS полностью прочитан). Это opt-in narrative scene, не общая page transition.
8. **Нарастание фона из glyph с реальными метриками.** letter-bar измеряет ink bounds glyph, рисует stem, ждёт room под следующую строку; letter heuristics Latin-specific — не готовый русский renderer (`scene.js` полностью, `scene.css:19-30`).
9. **Object/type collision avoidance привязано к размерам.** object-through-giant-type расширяет gaps в quote по круговому сечению объекта; rest остаётся quote+still (`scene.css:20-42`). Сложный эффект допускается только где помогает сообщению.
10. **Отдельная transform-composition для click ring.** feature-card разделяет `translate` и `scale`, чтобы ring не улетал при масштабировании (`components/fx-feature-card/component.js:148-157`). Моделируемый invoice/invite при этом не production transaction.
11. **Фотография сохраняет alt/layout до готовой grade.** duotone выбирает собственный direct-child img, не вложенный avatar (`effects/duotone-grade/effect.js:420-423`), скрывает оригинал только после graded frame/fallback (`577-581`), имеет CORS/CSS recovery (`632-660`). Это полезная progressive enhancement схема; scrim/hue policing — отдельные конфликтующие решения.
12. **Доступность не только цветом.** `system.css:1247-1256` даёт text error/status + border; `1317-1324` — focus skip link; `1039-1052` расширяет phone targets. Нельзя экстраполировать это на 36px print pause или 32px demo controls.
13. **UI с длинным кодом сохраняет контекст.** diff-review CSS разделяет old/new gutters, переносы/container query, inline comment anchor и suggestion collapse, а не делает строку целиком нечитаемой заливкой (`ui/diff-review/fragment.css`, полный). HTML ещё gap.
14. **Двусторонняя fallback ladder.** dotted-globe: WebGL dots → grouped Path2D → CSS dotted sphere (`effect.js:492-528,578-611,786-818`). CSS уже не содержит continents/arcs: fallback quality — визуальная аналогия, не feature-equivalence.

## 3. Статические findings: file:line, impact, remediation

Все severity — приоритет адаптации, не утверждение наблюдавшегося инцидента. Владельцы **не назначены**; будущий platform/asset maintainer должен принять их до rollout.

| ID / приоритет | Доказательство | Статический вывод / будущая проверка |
|---|---|---|
| T2-01 / P2 | `effects/fx.js:558-576` | Custom glBudget не отказывает, если нет idle holders. До копирования сделать hard admission/queue+poster. Проверить несколько одновременных видимых custom effects и освобождение quota. |
| T2-02 / P2 | `objects/product-render/build.js:838-840` | Motion parent chain идёт `while(g)` без visited set. Циклическая spec может не завершить компиляцию; trusted fixtures не гарантируют safe external specs. Валидировать DAG до traversal, выдать читаемый fallback/error. |
| T2-03 / P2 | `objects/product-render/build.js:1197-1215` | image onload проверяет destroyed/isConnected, но не generation token. Быстрые смены variants могут дать позднему load старого image сменить current img. Добавить request identity; проверить искусственно переставленный порядок завершения loads. |
| T2-04 / P2 | `objects/product-render/build.js:1265-1274` | После toBlob вызывается clearInner, а null blob приводит к return без явного done/error здесь. Возможен незавершённый ready/отсутствующий replacement; проверить null-toBlob и rejected export, сохранить poster/resolve outcome. |
| T2-05 / P2 | `diagrams/diagram.js:1070-1082,1169-1171,1615-1626` | destroy отменяет rq, но не q; pending fonts promise проверяет connected, а не destroyed. Connected host после destroy может быть перестроен. Нужны dead/generation guard и cancel q; проверить destroy до fonts/resize callback. |
| T2-06 / P2 | `diagrams/diagram.js:1147-1150,1624` | У hover есть focusin, но нет симметричного focusout. Переход Tab из host должен явно завершать focus-driven highlight/play. Проверить keyboard-only route; не считать hover-а11y завершённой. |
| T2-07 / P2 | `objects/_print-core/print3d.js:848-850` vs `system.css:1039-1052` | Pause 36×36, phone44px rule не адресует этот класс. При адаптации увеличить target либо дать44px hit area (как shared scene kit); проверить narrow и zoom. Это project policy delta, не автоматическое объявление WCAG violation. |
| T2-08 / P2 | `effects/duotone-grade/effect.js:579-581,681-691` | Observer, скрывающий original img, создан без сохранения handle. destroy не может сразу его disconnect; дополнительно img transition не восстанавливается. Сохранить observer/style snapshot, teardown до first frame. |
| T2-09 / P2 | `objects/photo-kit/photo.js:1100-1107,1125-1137` | credits helpers escape HTML, но не проверяют scheme href; это не sanitizer для недоверенной metadata. Ввести https/http allowlist на ingestion и explicit ownership/licence provenance; отсутствие by не доказывает client-owned. |
| T2-10 / P3 | `components/fx-feature-card/component.js:127-165,196-217` | Clock учитывает hidden/offscreen/held, но движение pointer/ring — CSS и отдельные classes. Сам gating wait не доказывает заморозку CSS mid-transition; после destroy wait не resolves. Обеспечить cancelable scene/timeline и восстановление synthetic states. Shared helper ещё не прочитан, вывод ограничен этим файлом. |
| T2-11 / P3 | `effects/duotone-grade/effect.js:172-185,285-304,428` | Встроенные hue exclusions реально меняют violet на blue/rose/desaturate; calmMax(0)=0.5 оставляет text-area mixing. Не универсальный brand mapper. Ввести explicit artistic grade opt-in и точное brand mode без смены hue. |
| T2-12 / P3 | `effects/dotted-globe/effect.js:53-119,239-265,871-917` | Coastline fixed, cities fixed, arcs seeded. Нельзя представлять это как реальную сеть, deployments или клиентов. Либо честная decorative illustration, либо authenticated topology adapter с легендой и отдельными данными. |

Дополнительные quality hypotheses по каждой прочитанной реализации сохранены в substantive_note. Они не заменяют эти проверяемые locators и не являются runtime evidence. regex-based SVG rewriting в diagram loader не следует называть полноценным sanitization boundary; безопасность произвольных fetched SVG требует отдельной проверки input trust.

## 4. Opt-in assets ≠ global defaults

| Слой | Что переносить | Что НЕ включать глобально |
|---|---|---|
| Friday-wide guidance | Требование settled fallback, cancel/destroy contract, factual sample labelling, lifecycle/resource budgets | Глобальные GL, animated hero, произвольная Hue police, обязательный Taste font/grid |
| Project primitive adapter | По явному выбору проекта: token mapping + reduced/visibility subscriptions + pause + allocation queue | Параллельный самодельный animation engine поверх обхода motion wrapper |
| Narrative scene / object | Только выбранный hero/section, со смыслом и static mobile/reduced composition | Все headings/sections по умолчанию, обязательный scroll hold/entrance |
| Demo/gallery | Fixtures, inspector, deterministic seed/clock для сравнения | Synthetic invoice/Sent/Invite/metrics/social proof в production без backend/provenance |
| Page system CSS | Отдельные scoped recipes и semantic role mapping | Прямой import system.css: он меняет `:root`, reset, nav/page typography/layout и theme globals |

Внутри самого upstream есть конфликт поколений: современный `system.css:1067-1112` запрещает scrim и отделяет текст от photo (на phone/place), тогда как `duotone-grade/effect.js:114-124,429-441` намеренно burn/lift текстовую область. Нельзя объединять оба как одно непротиворечивое общее правило. Выбор — explicit visual treatment; для neutral Friday default оставить readability/layout contract, не художественный scrim.

## 5. Exact Friday deltas (предложения, НЕ внесённые изменения)

Проверены `docs/core/templates/motion.ts` (122 строки), `docs/core/motion-engine.md` (81), review-loop и brief. Шаблон motion.ts сам по себе не входит в bundle (`motion.ts:1-4`): наличие шаблона не доказывает runtime у клиентов.

| Статус сравнения | Friday evidence | Конкретный delta / owner proposal / ожидаемый output и проверка |
|---|---|---|
| already equivalent | `motion-engine.md:23-34`; Taste `motion.css` и `motion.js` полные | CSS для простой feedback, engine для coordinated values уже выбран. Не добавлять ещё один UI motion engine. Suggested motion-curator: использовать существующую точку входа. |
| partial | `motion.ts:33-48,86-98,107-119` | Есть reduced query/change subscription и initial guards, но нет GPU/still contract/общего mount registry в этом файле. Suggested platform maintainer: отдельный opt-in adapter рядом с motion template; API mount/pause/resume/destroy/ready outcome, subscribe/unsubscribe preference, scope-cancel. Output: proposed `docs/core/templates/asset-lifecycle.ts` (не создан). Future test: change reduced после mount, destroy during ready, hidden/offscreen, remount. |
| absent in inspected template | `motion.ts:1-122`; Taste `fx.js:548-576` | В прочитанном Friday template нет allocation admission/queue/poster policy. Не заявлено отсутствие во всём Friday. Proposed opt-in `docs/core/templates/asset-resource-budget.ts` + section в `motion-engine.md:71-75`: concurrent visible budget, denied/queued branch, explicit release. Test: no allocation beyond selected cap, cancel queue, context loss. |
| partial / extend evaluation | `motion-engine.md:71-75` | Friday требует bundle delta, но это не GPU/time budget. Добавить в тот же budget раздел принятые проектом DPR/FPS/context/idle limits и report actual measurement, без заимствования 14 как magic constant. Owner proposal motion-curator + performance reviewer. Не назначены. |
| conflict if global import | `motion-engine.md:15-20`; `motion.ts:6-9,50-65`; Taste raw RAF/WAAPI/CSS renderers | Taste autonomous loops нельзя считать проходящими существующую wrapper policy автоматически. Добавить explicit asset-adapter policy в `motion-engine.md:15-21`, оставив DOM motion через wrapper, shader clock только через lifecycle adapter. Длительности90/150ms Taste не заменяют Friday press160/dropdown200. |
| partial verification coverage | `motion-engine.md:77-81`; Taste static source findings выше | Снимок нужен, но он не проверяет mid-transition pause, stale image loads, repeated mount/destroy и GPU reclaim. Proposed дополнение review acceptance в `.codex/workflows/review-loop.md` через владельца workflow (файл не менять сейчас): before/during/after captures + failure and reduced transitions + cleanup evidence. Нужен будущий authorized browser-run; этот audit его не выполняет. |
| not applicable as default | `motion-engine.md:62-69`; Taste print/scenes/shaders | Three.js не требуется: прочитанные Taste renderers raw WebGL/SDF. Не добавлять Three как dependency из-за «3D» и не обещать нулевую стоимость; opt-in raw shader adapter отдельно считать по bundle/resources/licence. |

Дополнительный acceptance для reusable product assets: supplied geometry/spec и poster должны обозначать один фактический товар; variant cache identity включает фактические angles/scene/color/off, не только rounded/generated names; async onload получает текущий request token; ready всегда завершается outcome, включая export failure. Это конкретные требования из implementation gaps, не новый глобальный визуальный стиль.

## 6. Hidden samples, external assets и остаточный риск

- `components/fx-feature-card/component.js:168-223`: Send/Draft/Sending/Sent и `ana@northwind.co` — synthetic local demo, не отправка инвойса/invite. Цвета meadow/dusk вводят natural blue/grass/gold независимо от brand (`51-87`); сохранить как иллюстрацию, не semantic data palette.
- `components/fx-dither-object/component.js:44-242,398-406`: четыре generic hardcoded object geometries + English labels. SVG fallback совпадает с категорией, не с конкретной SKU. Pointer interactions не имеют автоматически доказанного keyboard equivalent.
- `objects/product-turntable/object.js`: camera/cup/speaker/chair procedural subjects, PNG fallback и timed step turn — рисунок категории. `objects/dot-object/object.js` содержит remote default tulip; `objects/split-reveal/object.js` remote Picsum1081/credit. Требуется явная замена source/provenance, а не молчаливое использование defaults. См. их полные substantive notes ниже.
- `backgrounds/demo.html` и `objects/product-render/kinds-demo.html`: Northgate rota/статистика/quotes, €1180, bike/lamp/robot, Google Fonts/Picsum — examples. Данные/изображения/шрифты не были загружены или визуально проверены; названия не являются доказательством лицензии.
- `effects/dotted-globe/effect.js:112-119`: 23 города и выбранные hemispheres; это не актуальная карта коммерческого покрытия.
- `photo-kit/photo.js` formatters создают подпись, но не проверяют наличие licence/rights. Метаданные author/licence/CORS и legal permission — разные оси.

## 7. Полное предметное покрытие в этом проходе

Пути ниже относительно source root. `1–EOF` означает действительное последовательное substantive reading всех строк, не автоматический parse. SHA/ranges/total_lines лежат в JSON. Для больших файлов чтение шло bounded slices; truncated output дочитывался из сохранённого stdout. Полное чтение файла не закрывает не прочитанные imports и визуальную проверку.

| Исходник / range | Implementation observations |
|---|---|
| `skills/taste-skill/assets/objects/_print-core/print3d.js:1-1795` | Полностью прочитаны SDF/form shader, двухпроходная печать, filmic/OKLab poster recoloring, GL pool priority/idle eviction, GPU adaptation, first-frame probe, narrow presets, keyboard/toggle/pause, observers and destroy. Положительный pattern: poster → live → retained frame с общим context budget; риски: 36px pause, no timeout ready, shader poll, residual host inline styles. |
| `skills/taste-skill/assets/diagrams/diagram.js:1-1688` | Полный substantive read1688: icon resolver/fetch/SVG rewriting, normalization10 layouts (plus internal mind/outline), measured node kinds/captions, routing ports/elbows/rays/orbits, collision multi-attempt fit/height expansion, pulse Program/normalization2.5-4s/busiest still, hover graph traversal, page-kind/phone/reduced/cycles, controls and destroy. Caveats: regex SVG cleaning not sanitizer; node alt first8 labels loses edges; q RAF/font/icon callbacks not canceled on destroy; keyboard hover lacks focusout stop; invalid required spec can throw before safe fallback. diagram.css/presets not read in this pass. |
| `skills/taste-skill/assets/objects/product-render/build.js:1-1387` | Полный build1387: material/primitive GLSL, Catmull-Rom paths, shape-surface sampling,10 hardcoded prop factories, scene/color/view expansion, validation, bounds/pose chain, generated SDF/material dispatch, poster variants, image/still/live mount, serialized still queue, alpha/focus/cut framing, swatch/view/scene API and cleanup. Confirmed risks: cyclic motion parent unchecked hangs chain; params angle keys alias variant cache; pending showImage load not token guarded; ready once only; phone/reduced mode selection no change subscription; null blob after clear leaves no render and unresolved ready. print3d dependency full; specs/poster helper not read. |
| `skills/taste-skill/assets/system.css:1-1328` | Полностью1328: local page token graph/inverse remap, reset/font/spacing/type/grid/nav/hero/frame/browser/ground/tiles/footer/place/forms/actionbar/44px-phone + reduced override. Concrete reusable: screen room via svh/nav/bar/soft min-content, photo separate text at phone/place, factual dimensions as HTML, forms redundant errors, safe-area actionbar and skip link. Not universal stylesheet: many :root/* and font/page switches global; fixed typography/English content in credits/sample strings; system.js must be read separately, not validated by this CSS. |
| `skills/taste-skill/assets/objects/photo-kit/photo.js:1-1138` | Полностью1138: image decode cache/bestSrc focus parsing, percentile levels/kmeans/Sobel/void-cluster blue noise, GLSL1/2 LOD/printing/screen blend/trail, lint, texture cache, max3 photo pool + global accounting, parallel compile, quiet idle/tap1600ms/offscreen release, adaptive rendering, CORS/photo fallback, attribution helpers. Positive: restore original img style and native photo fallback. Caveats: glBudget not admission, main-thread blueNoise, no first-frame emptiness probe, no keyboard loupe, host styles not restored; credits escaping does not validate URL scheme; no by treated as owned but does not prove ownership. |
| `skills/taste-skill/assets/effects/dotted-globe/effect.js:1-1007` | Полностью1007: literal Earth handmade coastline/lakes, fixed23 cities +12 hubs, Fibonacci dots/area alpha/2-pass front-back, seeded timing/lattice quantized radius/cache3, 1x body/bounded canvases, GL60fps→2D30fps→CSS still, 3loss fallback, 4s idle release, calm-aware layout/routes and reduced2 finished arcs. Explicit opt-in global reach only; arcs/cities decorative not real infrastructure. Global budget accounting not admission; CSS loses continents/arcs, host styles remain and fallback clears original shorthand; no pause UI in file, caller must supply. |
| `skills/taste-skill/assets/objects/_scenes/kit.js:1-959` | Полностью959: palette parent-ground detection, photoURL/fallback/credits, image CPU levels/softCopy/cover, tones, GLSL lint, own hard2 stage pool/fx global accounting, lazy loaded init, compile/frame errors & flat-first-frame fallback, preserve2D freeze, pointer wake/idle/free, fps throttle, resize, shared expanded44px pause and cleanup, matrix helpers. Shared deps fx/photo full. Caveats global glBudget not admission; missing source can still blank fallback; checked flag not reset per context; no reduced-change pause registry sync; host styles not restored. |
| `skills/taste-skill/assets/effects/fx.js:1-955` | Полностью прочитан runtime: OKLab gamut reduction, seeded composition/calm slots, parameter clamping, shared lifecycle/media change, GLSL1/2 helpers, lazy GL shader/compile/fallback/adaptive/context loss, registry and cleanup. Уточнение прежнего отчёта: maxLive14 ограничен tpMax default4; custom glBudget лишь учитывает, но не отказывает при полном cap. Opt-in runtime, не безусловный auto. Fallback gl-budget sticky; generic shader first-frame emptiness не проверяет. |
| `skills/taste-skill/assets/ui/ui.js:1-733` | Прочитан весь UI loader/cache/unique SVG ids, loop timeline/generation abort, held vs keyboard/hover restart, a11y tidy, shared pause hosts; grounds bake queue, viewport priority, DPR/adaptive overrides/retry/stub/live lifecycle. Не production controls; gaps: cached rejection, swallowed module errors, no grounds disposal, lingering host listeners and failed start concurrency. |
| `skills/taste-skill/assets/effects/duotone-grade/effect.js:1-703` | Полностью703: photo vs seeded plaster-window stand-in, OKLab two/three-tone reach validation14 iterations, gamut/khaki/violet guard, actual cover/position/96px percentile levels, still grain/48s push, CORS CSS blend fallback, texture injection via shader uniforms+canvas MutationObserver and25% resize sharpening, original img alt retained. Positive native photo until graded. Risks: untracked observer580 not disconnected on destroy until later mutation; previous img transition not restored; gradients/scrim contradict modern system no-scrim; calm0 still .5 due calmMax; no responsive src changes. |
| `skills/taste-skill/assets/layout/layout.css:1-554` | Полностью прочитан layout CSS: tokenized optical scale/font axes, twelve-column hero/facts, photo solid-box/calm-side and tablet separate text, place phone-fill named grid rows, unboxed product and 7% render bleed, 32px hotspots, collage28px crop safe room, max-word slot, film solid inverse box, triptych breakpoints, centred82% fade/phone28px, short-phone fallback. Positive recipes opt-in; no-scrim policy conflicts with older backgrounds, reduced CSS covers only selected properties. |
| `skills/taste-skill/assets/components/fx-dither-object/component.js:1-480` | Полностью480: four explicit SDF headphones/chair/camera/drone, per-object hover semantics,96-step bounded marcher28shadow, Bayer onepixel/cell DPR inverse, studio640k cut, initial SVG fallback, reduced baked still, pause wrapper. Generic invented geometry not exact client product. shared.js (bag/still/pauser) dependency not read; async mount cleanup safety depends on it; stage null not guarded, labels English and no keyboard equivalents. |
| `skills/taste-skill/assets/objects/product-turntable/object.js:1-430` | Полностью430: four hardcoded SDF subjects camera/cup/speaker/chair with material lighting/shadows/AO, fitted camera incl platter marks, step15deg autoplay1.7s, critically damped integration/substeps, pointer light, stage pause/pool/fallback PNG. Generic category illustration only, not actual product. Numeric form not range checked; role img interaction has no keyboard turning; missing fallback silently removed. |
| `skills/taste-skill/assets/motion/motion.js:1-406` | Полностью прочитаны nav intent, transform-only tab indicator, locale-ish numeric parser/width lock/font wait/6s fail-open, HeadlessChrome final-state branch, CSS loop controls, switches, hero word masks + restore + 700ms/2400ms safety. Нет общего destroy; reduced queried без change subscription, глобальные click handlers ставятся даже motion=off. |
| `skills/taste-skill/assets/backgrounds/demo.html:1-376` | Полностью прочитано demo: inline palette deck, query overrides/bar/filter, 16 decorative grounds composition, Northgate rota marketing samples/static switches/stats/quotes, remote Picsum853, Google Fonts. Не production data/security evidence; no live backend. |
| `skills/taste-skill/assets/motion/motion.css:1-321` | Полный CSS: 150/120ms hover asymmetry, 90ms press, instant focus, transform-only indicator, 2px lift, masked 1.03 image zoom, 40x24 switch/20px check, pause safe band, hero early hold/settle and reduced-motion stills. Opt-in stylesheet, не global Friday defaults; отдельные .m-* selectors не scoped motion=off. |
| `skills/taste-skill/assets/objects/dot-object/object.js:1-295` | Полностью295: default remote tulip; cutOut alpha or OKLab Coons border median backdrop model, shadow downweight, blur/floodfill, percentile local tone, hex lattice GLSL points with area radii, color loupe, view+palette invalidation, stage fallback. Not semantic segmentation; object/ground similar hue may fail, N0 ready indefinite. Keyboard loupe absent; callback not destroyed guard. |
| `skills/taste-skill/assets/layout/layout.js:1-281` | Полностью прочитаны grid-reserved rotating word/two cycles, font-axis proximity letters, measured line locking after fonts/reflow fallback, inert collage sets, data-step ordering, mobile hotspot nudging, Escape/click-outside, film conversion. No destroy/idempotence or dynamic media changes; live word aria-label remains first sentence. Dependencies ui.js read, assets separate. |
| `skills/taste-skill/assets/effects/line-engraving/effect.js:1-260` | Полный shader sphere/hills, height-field bent lines analytic coverage, crosshatch light-only, guilloche, calm negative space, palette-relative ink and six-step SVG fallback; still controller stops RAF when drift0; crisp DPR3 fps30. No external data samples; dependency fx.js full. |
| `skills/taste-skill/assets/effects/halftone-screen/effect.js:1-253` | Полный shader: area-correct dots, cell-neighbor gooey SDF, dark/light inverted transparent ink overprint, dual screens45deg, seed-weighted sphere/hill/noise and calm field, GLSL2 uniform loops vs GLSL1 static bounds; SVG six-band fallback ignores secondInk/gooey detail. crisp DPR3 fps30; drift0 still consumes lifecycle RAF unlike engraving. |
| `skills/taste-skill/assets/components/fx-feature-card/component.js:1-247` | Полностью247: procedural day/dusk/meadow palettes not literal brand, three ground overrides still rendering, synthetic pointer/ring translate+scale, end state first/reduced, visibility+hidden+held gated clock, invoice and hardcoded ana@northwind.co invite demo. CSS animations not actually paused by gated clock; promise wait never resolves after destroy, timer finishes next tick; shared.js/still deps not read. Not real send/invite states. |
| `skills/taste-skill/assets/objects/split-reveal/object.js:1-234` | Полностью234: photo↔halftone seam, softened texture/linear levels, adaptive pitch/dark caps/colored seam, 40px slider keyboard arrows shift/Home/End, drag+hover, chips under480 hidden, reduced jump, ready/load fallback. Hidden default remote Picsum1081 + author credit; caller must override. Async image callback lacks dead flag; pan-y residual; aria range0..100 while actual2..98. Shared kit full. |
| `skills/taste-skill/assets/effects/edge-glow/effect.js:1-227` | Полный rounded-rect arc-length border and inverse path, capped quarter-lap/sec, linear tail and warm head/inward wash, palette OKLab tones and fallback. Hidden brand mutation: algorithm deliberately rotates hues to avoid violet; cannot be universal Friday brand adapter. No own pause button, depends on caller/lifecycle. |
| `skills/taste-skill/assets/effects/ruled-grounds/effect.js:1-224` | Полный shader whole-device-pixel ruling/crosses, seeded slow lit focus away from text, edge/calm thinning, static grain; shared shader/CSS geometry, still6s, crisp DPR3 fps30. Violet guard rejects or neutralizes brand hues/mixtures; CSS fallback approximates lighting/static grid. Dependencies fx.js full. |
| `skills/taste-skill/assets/effects/gradient-mesh/effect.js:1-211` | Полный 12-point Gaussian OKLab mesh, two-octave warp and broad derivative relief, Jacobian grid constant width/joins, seed jitter/rotation and nearest-calm neutral points, tone eligibility, CSS patchwork/straight-grid fallback, DPR1.25. Data procedural not telemetry; choosing far hue may discard accent, not exact brand reproduction. |
| `skills/taste-skill/assets/ui/diff-review/fragment.css:1-200` | Полный CSS diff review: semantic add/del tint roles, old/new gutters, applied-state counts/suggestion row grid0fr→1fr, comment anchored to code, finite spinner/status crossfade, container query wrap/hanging indent and filename priority. Readable positive pattern not default decorative side-bar prescription; no standalone reduced override in file. |
| `skills/taste-skill/assets/objects/product-render/views.html:1-144` | Полное demo: bike/lamp/robot spec views, image/still/live mode query, swatches targeting multiple frames, fill instrumentation, Google Fonts Inter Tight and hardcoded €1180. role radiogroup содержит button aria-pressed, не role radio/aria-checked. Requires auto.js/specs/posters, dependencies not read here. |
| `skills/taste-skill/assets/backgrounds/backgrounds.js:1-123` | Полностью прочитан contrast-headroom detector OKLab/L luminance approximation, dark/away/lowchroma root attributes, explicit overrides, liquid pause/offscreen IO, photo scrim from text bounds+8%/ResizeObserver/font ready. Без destroy; only initial reduced check for pause; not final rendered WCAG proof. |
| `skills/taste-skill/assets/scenes/product-assembles-into-its-action/scene.js:1-123` | Динамически измеренная сборка реального screen по data-at и captions, row-height simulated clip, nearest-first fold into real action, mates growth tracking, closing line moved/restored. phone rest; missing prerequisites fail-open. Destroy только scene controller: созданный pa__box явно не удаляется; cssText reset стирает client inline styles. lib.js dependency не прочитана. |
| `skills/taste-skill/assets/objects/photo-halftone/object.js:1-115` | Полный photo halftone shader cosine screen coverage/analytic AA/area→holes, clean tone curve/Sobel edge, linear-light inks, barrel loupe/rim/shadow, photoGL entry0,maxScale2. No sample source in file; source from caller/img. dependency photoGL full, no keyboard loupe. |
| `skills/taste-skill/assets/components/fx-search/component.js:1-104` | Полностью прочитан local combobox filter/wrap keyboard selection/slash shortcut and focus-lazy effect lifecycle700ms pause/4sfree/pending destroy. No remote search; suggestions from markup. Input Arrow keys update selection even list closed; shared.js dependency not read. |
| `skills/taste-skill/assets/scenes/object-through-giant-type/scene.js:1-104` | Падение объекта в измеренные gaps половинок giant quote; круговая ширина+Gaussian wake не перекрывает буквы, финальная swell/fall и credit. attachPrint wakes only live+near, sleep rest/far and destroy. Required still/cutout; lib.js/print.js не прочитаны. |
| `skills/taste-skill/assets/scenes/letter-bar-floods-the-ground/scene.js:1-99` | Measured canvas actual glyph inkBounds, nearest Latin lI/1 fallback pivot, exponential zoom onto solid rasterized-once stem, clipped full-width ground, wait until longest text fits, rest and stem removal. Synthetic pivot via raw text→innerHTML (not escaped); no Russian glyph heuristic. lib.js не прочитана. |
| `skills/taste-skill/assets/scenes/shaped-window-over-fixed-world/scene.js:1-94` | Five solid shutter pieces instead of mask seam, one photo fixed behind windows, outward widen→bar close→exponential push→solid caption band, premeasured geometry transform only. Phone rest; shutter removed rest/destroy, cssText resets; lib.js not read. |
| `skills/taste-skill/assets/scenes/fixed-hero-object/scene.js:1-84` | Alternating text/object lanes, scaled persistent product, chapters inverse ground via opacity, scroll-driven turn, near/live GL wake and sleep. Rest keeps all chapters readable, below-hero restH2; appended fho__ground not explicitly removed destroy, --fho-dark not cleared. lib.js/print.js not read. |
| `skills/taste-skill/assets/components/fx-spotlight/component.js:1-80` | Полный one-baked-canvas/multiwindow corner mask, text selection-safe whole-card link, fine-pointer exponential smoother and keyboard equivalent, reduced jump, still params and bag cleanup. shared.js not read; touch static corners. |
| `skills/taste-skill/assets/scenes/letter-physics/scene.js:1-77` | Полная deterministic glyph burst: measured radial vectors/depth/gravity, short burst fades before clip, answer sentence comes from depth, phone drift branch explicitly runs. split/unsplit delegated lib.js not read; root --lp-k remains after rest. |
| `skills/taste-skill/assets/moments/iris-opens/moment.js:1-76` | Полный circle ground reveal in inset stage, visible-centre geometry, whole-block corner containment before opacity to avoid sliced words, resize/fonts remeasure, reverse scrub, stage/observer release. lib.blocks/scrub dependency not read; no runtime proof. |
| `skills/taste-skill/assets/moments/pinned-chapters/moment.css:1-72` | Полный pinned chapters CSS: static rows and each own image, phone16:9 max26svh, desktop sticky two columns, grid0fr collapse with inner minheight0, image opacity/scale, print restores all, reduced only removes geometry/transitions (loader must restore hidden step state). moment.js not assigned/read. |
| `skills/taste-skill/assets/moments/liquid-type/moment.js:1-69` | Полный SVG turbulence/displacement demand-only energy loop; fine pointer only/coarse+reduced fallback text; no WebGL, selectable text and complete cleanup. Radius option actually scales energy via .5+reach, not radial spatial mask; displacement covers whole headline; decay .93/frame refresh-rate dependent. |
| `skills/taste-skill/assets/moments/counter-rolls/moment.js:1-66` | Полный odometer uses final digit at both strip ends, fixed cycles by column, native WAAPI once threshold.4; punctuation preserved and aria-label; destroy cancels but does not restore markup/prior aria-label; implementation turns increase left→right contrary header rightmost-most? cols.length increases yes rightmost more. |
| `skills/taste-skill/assets/scenes/_demo/demo.css:1-53` | Полный demo chrome CSS: fixed blurred nav36px links, logo/cards and synthetic UX32px button/sidebar/stats, mobile hides third stat. Demo-only; does not establish production controls44px or actual product data. |
| `skills/taste-skill/assets/scenes/descend-through-weather/scene.css:1-52` | Полный scene CSS: both original photos and readable captions in rest, mobile4:5, live cloud+fixed image layering, solid footer ground not scrim, desktop rest44svh max; JS dependency remains unread. |
| `skills/taste-skill/assets/components/fx-band/component.js:1-51` | Полный baked sideband effect placed48px beyond actual text range rects after fonts/resize; stack fallback at900; preset effect tuning, no live slow drift; bag destroys observer/left reset. shared.js not read. |
| `skills/taste-skill/assets/moments/letters-assemble/moment.js:1-48` | Полный deterministic char scatter scrub, transform+opacity, whole by mid-screen, reduced early return. Cleanup clears styles but does not unsplit original text; phone gating delegated loader not file. |
| `skills/taste-skill/assets/scenes/scenes.css:1-47` | Полный held/rest CSS, stage stick only live and ready marker, no-script completed composition, focus-only skip, print geometry release; runtime loader/lib not read. Potential slow-module invisible until sc-safe is confirmed contract, not tested timeout. |
| `skills/taste-skill/assets/scenes/object-through-giant-type/scene.css:1-43` | Полный scene CSS: capitals flex halves, warm/cool opacity role, object picture fallback, failure host hidden, static object-before-quote and wrap under767, live perspective1200 layering, phone still smaller. No own reduced rule; loader/lib owns. |
| `skills/taste-skill/assets/scenes/shaped-window-over-fixed-world/scene.css:1-43` | Полный CSS: natural rest semantic sequence via order, photo16:8→4:5 mobile, live fixed image+5solid shutters/no mask seams, title/action in outside-window zones, solid ground caption footer. Word nowrap only live; loader sizing needed. |
| `skills/taste-skill/assets/moments/headline-arrives/moment.js:1-40` | Полный retired entrance legacy: safety mo-safe skip, split words/chars, fonts500, WAAPI+8sfailsafe, finish cancels; no unsplit or timer removal. Do not enable alongside motion.js hero entrance. |
| `skills/taste-skill/assets/scenes/letter-bar-floods-the-ground/scene.css:1-38` | Полный CSS: original pivot hidden behind solid raster-free stem, separate clipped fullwidth ground and statement, phone readable/rest overflow band via100vmax clip, scene tokens. Cannot treat clip-path as compositor-guaranteed; runtime dependency not read. |
| `skills/taste-skill/assets/scenes/dot-becomes-the-full-stop/scene.css:1-23` | Полный CSS: at-rest giant balanced statement and subtext, phone21vw, live fitted row/word masking/dot layer and inverse cut. Missing assigned implementation? scene.js not in this assignment, not audited here. |

## 8. Незакрытое покрытие — не разрешает полный PASS

Все следующие **назначенные** исходники ещё `unread`, ranges `[]`. Их SHA/line count вычислены, но это не чтение. Нельзя заключать, что они повторяют прочитанный JS/CSS/metadata. Именно эти строки необходимо содержательно дочитать, затем дополнить отчёт по каждой реализации и заменить verdict только после сверки ledger. Помимо них внешние к assignment dependencies (§1.3), actual pixels/licences и live lifecycle/performance остаются отдельной границей доказательств.

| Исходник | Не прочитано строк |
|---|---:|
| `skills/taste-skill/assets/ui/cards.html` | 617 |
| `skills/taste-skill/assets/backgrounds/backgrounds.css` | 516 |
| `skills/taste-skill/assets/effects/soft-light-bars/effect.js` | 403 |
| `skills/taste-skill/assets/effects/lab.html` | 390 |
| `skills/taste-skill/assets/scenes/_demo/shoot.mjs` | 340 |
| `skills/taste-skill/assets/ui/base.css` | 267 |
| `skills/taste-skill/assets/layout/hero-centred.html` | 207 |
| `skills/taste-skill/assets/objects/print-lamp/object.js` | 203 |
| `skills/taste-skill/assets/effects/aurora-curtains/effect.js` | 192 |
| `skills/taste-skill/assets/icons/icon.css` | 186 |
| `skills/taste-skill/assets/effects/god-rays/effect.js` | 184 |
| `skills/taste-skill/assets/backgrounds/check.mjs` | 178 |
| `skills/taste-skill/assets/objects/print-globe/object.js` | 176 |
| `skills/taste-skill/assets/objects/product-render/make-posters.mjs` | 169 |
| `skills/taste-skill/assets/components/fx-map/component.css` | 168 |
| `skills/taste-skill/assets/diagrams/lab.html` | 164 |
| `skills/taste-skill/assets/objects/_print-core/cards.html` | 161 |
| `skills/taste-skill/assets/moments/picture-develops/moment.js` | 157 |
| `skills/taste-skill/assets/moments/_demo/in-page-service.html` | 151 |
| `skills/taste-skill/assets/scenes/descend-through-weather/scene.js` | 150 |
| `skills/taste-skill/assets/layout/hero-word.html` | 142 |
| `skills/taste-skill/assets/objects/print-cards/object.js` | 131 |
| `skills/taste-skill/assets/ui/pipeline-board/fragment.js` | 127 |
| `skills/taste-skill/assets/layout/hero-split.html` | 121 |
| `skills/taste-skill/assets/layout/hero-product.html` | 119 |
| `skills/taste-skill/assets/ui/_lab/loops.html` | 117 |
| `skills/taste-skill/assets/ui/index.html` | 116 |
| `skills/taste-skill/assets/components/fx-feature-card/component.html` | 109 |
| `skills/taste-skill/assets/scenes/parts-lock-into-the-whole/demo.html` | 109 |
| `skills/taste-skill/assets/ui/terminal-run/fragment.css` | 97 |
| `skills/taste-skill/assets/ui/window/fragment.css` | 92 |
| `skills/taste-skill/assets/scenes/powers-of-ten-pullback/demo.html` | 88 |
| `skills/taste-skill/assets/moments/pinned-chapters/demo.html` | 85 |
| `skills/taste-skill/assets/objects/_scenes/lint-glsl.mjs` | 82 |
| `skills/taste-skill/assets/objects/photo-kit/demo.css` | 81 |
| `skills/taste-skill/assets/scenes/dot-becomes-the-full-stop/demo.html` | 81 |
| `skills/taste-skill/assets/scenes/letter-bar-floods-the-ground/demo.html` | 80 |
| `skills/taste-skill/assets/objects/_scenes/demo.css` | 72 |
| `skills/taste-skill/assets/ui/_lab/object-card.html` | 71 |
| `skills/taste-skill/assets/moments/_demo/demo.css` | 70 |
| `skills/taste-skill/assets/ui/calendar/fragment.css` | 68 |
| `skills/taste-skill/assets/ui/voice/fragment.css` | 67 |
| `skills/taste-skill/assets/objects/_print-core/demo.js` | 65 |
| `skills/taste-skill/assets/moments/iris-opens/demo.html` | 64 |
| `skills/taste-skill/assets/objects/product-render/demo.html` | 64 |
| `skills/taste-skill/assets/moments/word-highlight/demo.html` | 63 |
| `skills/taste-skill/assets/moments/line-carries-colour/demo.html` | 62 |
| `skills/taste-skill/assets/moments/letters-assemble/demo.html` | 61 |
| `skills/taste-skill/assets/moments/headline-arrives/demo.html` | 60 |
| `skills/taste-skill/assets/moments/closing-lift/demo.html` | 59 |
| `skills/taste-skill/assets/layout/demo.css` | 57 |
| `skills/taste-skill/assets/scenes/shaped-window-over-fixed-world/demo.html` | 57 |
| `skills/taste-skill/assets/components/fx-pricing/component.css` | 55 |
| `skills/taste-skill/assets/moments/window-parallax/demo.html` | 53 |
| `skills/taste-skill/assets/components/fx-prompt/component.css` | 50 |
| `skills/taste-skill/assets/moments/giant-type-pass/demo.html` | 49 |
| `skills/taste-skill/assets/components/fx-chart/component.css` | 47 |
| `skills/taste-skill/assets/components/fx-tabs/component.html` | 46 |
| `skills/taste-skill/assets/ui/stat/fragment.css` | 45 |
| `skills/taste-skill/assets/ui/diff-review/fragment.html` | 40 |
| `skills/taste-skill/assets/objects/_print-core/demo.css` | 39 |
| `skills/taste-skill/assets/components/fx-progress/component.css` | 33 |
| `skills/taste-skill/assets/ui/chat/fragment.html` | 32 |
| `skills/taste-skill/assets/ui/search/fragment.css` | 30 |
| `skills/taste-skill/assets/ui/window/fragment.html` | 30 |
| `skills/taste-skill/assets/components/fx-logos/component.html` | 11 |

**Итог:** 51 full / 66 unread; 18 560 / 26 836 строк substantive read. Не install, не rollout, не runtime PASS.
