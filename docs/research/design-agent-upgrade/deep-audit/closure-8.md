# Closure-8 — содержательное закрытие назначенных диапазонов

## Результат и границы доказательства

Закрыты **34 назначенных диапазона, 17 974 физических строки** из `final-assignments/closure-8.json`. Это продолжение статического аудита, а не новый обзор архитектуры и не проверка работоспособности. Код upstream, установщики, импорты upstream-модулей, hooks, тесты и UI не запускались. Изменены только этот отчёт и `closure-8-coverage.json`.

В ledger сохранены repo/path, SHA-256 полного исходного файла, total_lines, точные ranges и содержательные заметки. `status: partial` намеренно не означает пропуск: это консервативный статус файла в range-assignment, не утверждение прочтения всего файла. Полнота **назначения** отражена отдельно в `assigned_coverage_complete`. Повторные чтения не увеличивают покрытие. Начальные хеши сравнены с конечными, диапазоны проверены на границы и объединены программно.

Два случая выделены честно:
- `taste/.../icons/demo.html:1–78`: прочитаны CSS/структура/подписи/доступность, все inline SVG разобраны структурно; геометрия путей **классифицирована**, а не просмотрена визуально или вручную по координатам.
- `impeccable/extension/walks/consent-rules.js:41`: целиком разобрана гигантская generated-строка вызова с compact-данными; схема и все семейства операций классифицированы. Это **не ручная верификация каждого доменного рецепта**.
- Напротив, `crates/context/src/question_page.rs:8–9` нельзя считать «двумя тривиальными строками»: строка 8 содержит 74 067 символов generated HTML/JS. Она развёрнута в 1 030 строк и содержательно прочитана. Часть SVG-геометрии бренда остаётся декоративными данными. Конкатенируемая тема и подстановки — внешние зависимости, не буквальный HTML на диске.

Ревизии снимков из BRIEF: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`, Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`. Авторитет для реально прочитанных байтов — хеши ledger. Kowalski не входит в эту assignment; отдельного вывода о нём здесь нет. Friday сравнивается по текущим прочитанным файлам working tree, не по предположению, что описанное уже работает в IDE.

## 1. Impeccable: конкретные проверки и семантика

### 1.1. Проверки геометрии и текста

**`crates/core/src/browser/quality.rs:4801–6400` — тестовые контракты, не новая реализация правил.** FakeDom-сценарии различают padding видимого глифа и прямоугольника, clipping/transform, непрерывность реально видимой заливки, градиент/фотографию и контрастный контейнер. Отдельно проверяются малые chips `<27.5px`, размерно-зависимый воздух и исключения body-leading при ориентире `>=1.3`. Tracking относится к латинице, длина строки — к реально отрендеренной строке, с CJK-случаями, а не к длине HTML-строки. Для viewport gutters контракты различают 12px при ширине `<=480` и 16px выше. Временный горизонтальный entrance не приравнен к постоянному overflow. Полезная идея — не переносить эти числа в Friday как безусловные CSS-регексы: тесты специально защищают исключения.

**`crates/core/src/browser/page_checks.rs:1601–3200` — работающий код эвристик heading rhythm и visible ground.** Для заголовков обход ограничен: spacer, shadow/paint, eyebrow и prose рассматриваются отдельно. Повторяющийся компонент распознаётся структурным сходством Dice `>=0.7`; требуется не менее двух нарушающих `h2–h4`. Существенная асимметрия — верхний промежуток меньше `0.75` нижнего и разница не менее 12px; отдельный путь учитывает равные промежутки рядом с измеренным prose. Исключаются landmark/run-in/quote/card/hidden-контексты. Это не «всем заголовкам поставить один margin».

В той же области кремовый ground проверяется с порогом покрытия 95%; dark canvas, перекрывающие слои и текст выводятся консервативно. Не начавшийся slider оформляется как ограничение capture, а не автоматически как дефект страницы. Вход — DOM-снимок и его измерения; выход — findings/notes. Чистого результата при недостатке измерения из этого не следует.

**`crates/core/src/checks/text_context.rs:1601–3121` — классификация контекста micro-label/fine print и её регрессии.** Units, step/chart labels допускают малую подпись, но money, controls, nav, form, table и headings не получают универсального иммунитета. Dotted/phone/scaled demo frames и замкнутые англоязычные sample captions отличены от настоящих органов управления, кода и основного текста. Для fine print результат трёхсостоянийный: `No`, `Advisory`, `Exempt`. Policy body и accordion не становятся исключением одним именем контейнера. Главный delta: контекст меняет серьёзность предупреждения, но не уничтожает его происхождение.

**`crates/browser/tests/advisory_contexts.rs:1–350`** проверяет это на браузерных fixtures: mockup/fine-print могут перейти в advisory, но реальные consent controls и code остаются warnings; nested panel даёт агрегированную находку по siblings, SVG оценивается по rendered size. При отсутствии браузера есть ранний возврат с сообщением о skip. Это изученное намерение теста, не PASS.

**`crates/browser/tests/unread_surfaces.rs:1–233`** фиксирует контраст на sibling/negative-z/pseudo-поверхностях только там, где они действительно нарисованы; фото, scrim, outline, побледневшие media controls и мобильная правая колонка отличаются от припаркованного drawer. Replay сохраняет scan/content-hidden origins, но не должен возвращать pixel-superseded verdict. Нужны локальный fixture server и браузер; они не запускались.

### 1.2. Достоверность браузерного доказательства

**`crates/browser/src/cdp.rs:1–1600`.** Это собственный CDP transport с оглядкой на Puppeteer parity, временным профилем с exclusive ownership/reaper и учётом владения процессом. События читаются синхронным потоком, исключения и ожидания ограничены. Авторизация привязана к origin, а не произвольно наследуется на другие адреса. Различаются disposable страницы и изолированная работа с attached browser. Native DOM/style/pseudo capture связан с loader, чтобы не смешивать документы при навигации. Внешние эффекты — процессы/профили/страницы/CDP, а не просто чтение HTML. В assignment не входит конец файла; утверждение полной совместимости с Chrome из этого диапазона невозможно.

**`crates/browser/src/lib.rs:1601–2742`.** Finding привязывается к исходному scan node/rect, а при повторяющихся ID сохраняется match index. Перед evidence есть ограниченное ожидание drift до 1.5s; движение после снимка больше `max(половина размера бокса,16px)` отмечает ненадёжность. Best-effort screenshot может отсутствовать — это не доказательство чистой страницы. Контраст идёт от аналитического к pixel fallback в ограниченном бюджете. Видео приостанавливается и восстанавливается, consent/overlay прячутся, reveal вызывается прокруткой: capture **меняет состояние disposable страницы**. Unresolved/advisory/unmeasured, дедуп пар, vendor/error caps и declared-purple override — отдельные ветви, а не один бинарный pass/fail.

**`crates/cli/tests/entry_capture.rs:1–337`.** Anti-cheat: private/package/source не входят в разрешённый inventory; symlink отклоняется; receipt привязан к свежему source/asset состоянию и к approved comp, не раздаваемому как готовая страница. Отказ предусмотрен для comp path/copy/data URI и незаявленной растровой подмены. Проверяются native pseudo geometry, mobile plate identity, remote transport и per-region receipts. Fixtures включают синтетические конфигурационные имена, но реальные секреты не читались. Optional-browser early return не означает успешного испытания.

### 1.3. Состояние, хранение, протоколы

**`crates/context/src/critique_storage.rs:1–1452`.** Store выбирается по целевому workspace, а не по случайному cwd. URL identity отбрасывает query/hash; локальный SHA fingerprint позволяет закрыть/считать устаревшим старое ревью. Это осознанный компромисс: query-driven экраны могут оказаться одной identity, и переносить нормализацию в Friday без решения о семантике маршрутов нельзя. Есть ownership/legacy slug handling, эксклюзивное создание истории с суффиксом коллизий, ограничение входного regular nofollow файла 64KiB, очистка metadata, локальный config precedence, gitignore по умолчанию и callback только при complete write. Audit использует тот же writer; чтение audit history пока не предлагается (`:724–742`).

Две статически подтверждённые ветви скрытой ошибки:
1. `:687–715`: после открытия файла `write_all(...).is_ok()` используется для callback, но при `false` всё равно устанавливается `written=Some(file_path)`, затем печатается путь и возвращается 0. При ошибке записи можно получить частичный файл и ложный успех. Это доказанный контрольный путь, не воспроизведённый disk-full инцидент.
2. `:382–388`: close игнорирует результат `fs::write`, после чего возвращает `Ok(Some(snapshot.path))`. Ошибка записи closed flag не попадает вызывающему коду.

Тесты внутри файла покрывают isolation/legacy/collisions/config, но не представляют проверки этих I/O-failure путей. Владелец исправления при будущей работе — upstream context/storage maintainer; в текущем аудите ничего не исправлялось.

**`crates/cli/tests/agent_target.rs:1–1047`.** Локальные process/SSE fixtures задают held requests, число вариантов 1–8, token/input validation, per-client lease, reconnect/disconnect/grace, различение no-match и busy. Generate-event backstop и fencing superseded/unknown/late claimant стоят до journal. Есть reply/poll, cold boot/dev-server-gone и harness browser guards. Следствие для интеграции — нельзя принимать поздний ответ только по совпавшему текстовому ID. Наличие тестов не доказывает реальную надёжность сервера без их запуска.

**`crates/cli/src/loop_connect.rs:1601–1900`.** Opt-in/update/remove Taste block работает под support lock; после prompt без удержания lock targets определяются заново. No удаляет блоки; при disconnect удачные файлы забываются, неудачные остаются для повторной попытки. Затронуты global agent rules/support metadata, поэтому это не «безопасный локальный README import». Конец диапазона содержит тесты rollback install record и production/staging MCP allowlist/override boundary. Ни подключения, ни установки не выполнялись.

### 1.4. Проверки агента и границы тестового доказательства

**`tests/live-e2e.test.mjs:1–1600`** моделирует real fixture install/dev-server/browser с fake либо credential-gated LLM agent; доказательства охватывают source, computed style и network, CSS scoping по adapter. Встречаются reload/params/mount failure/revision cache, storage loss, пропущенный SSE и stale read, orphan/foreign project, annotations/manual ack/exit. `KnownLimitation` способен превратить сценарий в skip, а пустой набор fixtures — в no-op. Это важное ограничение последующего CI: итоговый счётчик success без причин skip недостаточен.

**`tests/live-e2e-llm-agent.test.mjs:1601–1840`** проверяет response validator: сохранение выбранного видимого copy, отказ для source-identical/no material change и множества editable leaf splits, допустимый single child с полным copy. JSON fences, непустые variants/params, запрет wrapper/framework/style markup, backticks/interpolation и несбалансированного CSS — конкретные входные границы; diagnostic ограничен первыми 500 символами. Это тестирование разбора ответа, не измерение качества платного провайдера.

**`tests/skill-behavior-harness.test.mjs:1–476`.** Negative controls требуют действительно прочитанных content/images, свежих desktop/mobile captures по source hash после последних правок, отдельных tokens и v2 sidecar, evidence даже при no-change, порядка consent/brief/build/document. Advice не должен мутировать, сканировать или придумывать prerequisites; denial должен появиться до следующего tool; ключи провайдера не наследуются. Compound/symlink writes блокируются, checkpoint отделён от completion, failed traces сохраняются. Это сильнее общего требования «сделай скриншот», но mock model не подтверждает хороший вкус реальной модели.

### 1.5. Зависимости, влияющие на смысл результатов

**`crates/foundation/src/js.rs:1–863`.** Чистая JS-совместимость: whitespace/ASCII folding, radix/decimal printing и ties, `toFixed`, prefix `parseFloat` против whole-string `Number`, `parseInt`, signed zero/NaN, Kahan hypot/fdlibm trig, форма serde-чисел. Эти пограничные случаи защищают parity правил; это не ещё один visual skill. Для Friday применимо только при портировании детектора и его numeric/regex semantics.

**`crates/foundation/src/browser/selector.rs:1–793`.** Servo selectors/cssparser адаптируются к snapshot, а не к живому браузеру. UI/form/media states записаны, некоторые complement states выводятся. Invalid selector — ошибка; известный pseudo-element может просто никогда не совпасть. Учтены quirks id/class, HTML/SVG case; отсутствуют полноценные shadow host/parts/custom state, visited никогда не включён, lang filtering упрощён. Тесты доказывают намерение парсера, не complete Chrome conformance. Поэтому «selector не нашёл» не всегда значит «элемента на странице нет».

**`crates/foundation/src/vectors/mod.rs:1–450`.** Oracle replay codec кодирует undefined/NaN/Infinity/-0/Map/Set; dispatcher вызывает checks_a/b, color conversion/contrast и inline-ignore с JS coercion. Known-function tables видимо выявляют отсутствующие vectors. Roundtrip test защищает сериализацию. Некорректный map payload способен вызвать expect/panic: это trusted fixture interface, не готовый API для непроверенного пользовательского ввода.

### 1.6. Две гигантские generated-строки

**`crates/context/src/question_page.rs:8–9`.** Внутри PAGE находятся не только стили, но клиентский state machine выбора:
- горизонтальная/вертикальная deck, text-only/canon/declined карточки; inspiration и actual comp маркируются по-разному, donor improvements сохраняют provenance;
- скрытая сторона карточки лишена pointer events, реальный поворот читается через DOMMatrix, decorative deal имеет failsafe 1.6s и reduced-motion ветку;
- heartbeat раз в 5s, ответ/reroll через POST, bounded next-status poll раз в 1200ms, после восьми сетевых сбоев — явный stall;
- stall прекращает heartbeat, но watch без heartbeat продолжает ждать позднюю delivery: reload не должен оживлять уже просроченный round;
- comp polling хранит generation stamp; только после четырёх минут без прогресса появляется честно подписанный stand-in, а не «готовая картинка»; sketch имеет собственный readiness и fallback reveal через 4s;
- переключение code→comp с возможной платной генерацией требует подтверждения, возврат бесплатен; polling старого поколения fenced; ошибка art даёт palette fallback с явным artwork unavailable.

Статический риск: `answer` и `dealAgain` ловят reject fetch, но не проверяют `response.ok`, поэтому HTTP 4xx/5xx могут пройти как записанный выбор. `build-path` обновляет UI и отправляет fetch без подтверждения результата. В template не обнаружен полноценный modal focus trap. Проверка серверных ответов, escaping подстановок, полный a11y и содержимое theme producer за пределами assignment; эксплуатируемая XSS не заявляется.

**`extension/walks/consent-rules.js:41`.** Это generated invocation: compact v1, **4 077 interned strings, 1 355 rule records**. Index: generic `[0,493)`, frame `[491,525)`, specific `[493,1355)`; интервалы пересекаются, складывать их длины как независимые правила нельзя. Структурно перечислены все records и ключи операций; семейства включают existence/visibility, cookie checks, click, hide, checkbox operations, wait/timeout/retry, optional/negated/any, if/then/else, iframe/shadow-style targets, removeClass/setStyle/addStyle/stylesheet и eval references. Примеры — adstate settings-component, iframe Consent window, sourcepoint stylesheet; реальная семантика коротких opcodes зависит от decoder вне строки 41.

Конфигурация: enabled, `autoAction=optOut`, `heuristicMode=reject`, 20 detectRetries, prehideTimeout 2000ms, cosmetic/generated/heuristics/main-world включены, filter list и logs выключены. Значит capture с этим механизмом **может менять выбор согласия, checkbox, DOM/style/cookies**, а не нейтрально «сфотографировать исходную страницу». Тела eval-функций и корректность всех селекторов на сегодняшних сайтах не проверены. Классификация generated data не равна ручной сертификации 1 355 сайтов.

## 2. Taste: конкретный контент и runtime-поведение

### 2.1. Объекты и эффекты как предметная библиотека

**`skills/taste-skill/assets/objects/index.html:1–654`.** Каталог из 13 объектов: пять code-product, три photo-print, пять scene. Содержательные ограничения — фотография впереди декоративной обработки; turntable нельзя выдавать за фактический продукт клиента; у каждой техники есть уместный домен и never-случай. 12-column editorial composition, responsive stacking и четыре token palette — не универсальная тема для всех брендов.

Mount происходит возле viewport, максимум четыре mounted/mounting, photo-family cap три (`:500–598`); destroy при уходе, динамические импорты и underlay не оставляют пустой panel в штатном случае. Palette сохраняется в localStorage; idle prefetch отдельно загружает модули и изображения, поэтому lazy mount не означает отсутствие фонового трафика. Credits содержат источники и licence metadata, но сами по себе не подтверждают права на конкретный клиентский reuse.

Риски sample runtime:
- `:515–547`: fetch photo metadata при ошибке возвращает пустую библиотеку, но `PHOTOS[key].file/focus` затем разыменовывается без guard. Мягкий catch способен закончиться падением и незавершённой инициализацией.
- `:555–570`: host добавляется до `obj.mount`; ошибка оставляет ctrl unset, catch только предупреждает, finally снова schedule. Для остающегося near slot возможны повторные попытки и лишние hosts. Это статический путь, не измеренная GPU-утечка.
- `:624–629`: отказ clipboard подавляется, но кнопка получает done. Успешная анимация не подтверждает копирование.

**`assets/effects/gallery.html:1–528`.** Восемь family labels, встроенные palette metadata и правила look/bestOn/random eligibility задают подбор, а не просто перечень shader names. Seed даёт повторяемый deal hero+четырёх cards; local history ограничивает повтор. Calm text region выводится из геометрии, UI окрашивается palette-derived tokens. Есть family filters, pause, URL state, pinned-time/WebGL1/fallback режимы. Gallery budget отличается от production: GL16 против production4; выводы о production performance по галерее неверны. Все tile mounts всё равно делегируются внешнему fx lifecycle.

Если index не загрузился, показана конкретная ошибка HTTP serving/index generation (`:506–510`). Но ошибки jobs в deal сводятся к console.warn (`:457`), затем ready ставится в 1 (`:525`). Это readiness документа/цикла, не гарантия успешного эффекта на каждом tile. Зависимости — `fx.js`, `index.json`, UI loader и эффекты; фактический WebGL не проверялся.

**`assets/objects/_print-core/make-fallbacks.html:1–89`.** Maintainer-only generator последовательно mount→ready→проверка не fallback→pose→snapshot→destroy; делает light/dark и дополнительные plates, рисует plates/color side-by-side и формирует data URL PNG. Файлы появляются только при пользовательском download, не от статического просмотра. При ошибке выставляется ready=error, но finally destroy на ошибочном shoot нет. Это инструмент обслуживания ассетов, не требование запускать его в клиентском проекте.

### 2.2. Четыре раздельных композиционных контракта

**`assets/layout/hero-triptych.html:1–172`.** Carte — software hero: copy/collage/CTA распределены в три зоны; menu/poster/phone mockups показывают предмет, а не абстрактные gradient cards. Container units cqw с минимумом 13px, mobile убирает второстепенные блюда. Mockup role=img получает краткое alt-представление. Внешние system/layout.js отвечают за nav/enter/cycling. Цены/числа/отзывы — demo copy, не подтверждённые факты бизнеса.

**`assets/layout/hero-word.html:1–142`.** Service hero на Archivo variable wdth с плоским ground, прямо без tech effects; ротация предметных слов flats/offices/pianos/studios поддерживает категорию услуги. Есть цена, состав услуги и quote mockup; review claims и `.example` links остаются демонстрацией. Ground/motion/nav обслуживаются внешними модулями. Смысл — конкретика service offer, а не заимствование чужих чисел.

**`assets/layout/hero-split.html:1–121`.** Fraunces+Figtree, тёплые tokens, 5+6 text/photo columns, приоритетная hero-фотография, маленький booking overlay, price rows и lazy secondary photo. CTA mailto, credits указаны. Это не полноценный booking backend; навигация и движение вынесены в shared system.

**`assets/ui/_lab/loops.html:1–117`.** Девятнадцать placement recipes, по умолчанию query выбирает шесть. Corner/rise/cut/fade дают разные встраивания; только slider центрирован, cursor overlays остаются в окне UI, grain ограничен, painterly background один. Query фиксирует время, theme перекрашивает сцену. `ui.grounds` обещает cached static picture/context release, но реализация находится снаружи; нельзя объявлять доказанной экономию GPU по одному вызову. Index fetch без catch — отдельная граница надёжности лаборатории.

### 2.3. Компоненты и сцены

**`assets/components/fx-feature-card/component.css:1–161`.** Subgrid выравнивает текстовые ряды; вложенные radius вычисляются outer-minus-inset, а не произвольной новой скруглённой карточкой. Стабильные panel/card скрывают UI windows с непрозрачным фоном. Есть payment/payout/invite states, ring/cursor/caret keyframes и pause placement; mobile убирает chip/select, но не title. Внутри CSS reduced-motion явно касается caret; полное gating остальных эффектов нужно искать в global/JS dependency. Только по этому CSS объявлять a11y failure всего компонента нельзя.

**`assets/scenes/powers-of-ten-pullback/scene.css:1–67`.** Без `.is-live` видна законченная composition; live скрывает copy/ground, включает will-change для двигаемых элементов. Desktop 12-col и tablet/phone stacking различаются. Последнее mobile правило `:64–66` делает экран квадратным и переопределяет более ранний portrait ratio: фактический cascade важнее старого комментария. Сам по себе это не доказанный баг — конечный комментарий прямо говорит squarer on phone. Scroll и reduced-motion принадлежат внешнему scene engine.

**`assets/moments/marquee-row/demo.html:1–64`.** Семантический список городов, speed36, mo-js/mo-safe и 2.5s safety path; invoice mockup и статичная следующая секция, photo credit. Реальные pause/visibility/reduced-motion находятся в moment implementation. Customer count — demo, не отчёт о клиентской базе.

**`assets/scenes/shaped-window-over-fixed-world/demo.html:1–57`.** Fjord photo как fixed world, headline/CTA/lede, stage с `--h2`, sc-js/sc-safe 2.5s. Alt/credits присутствуют, anchors placeholders и survey metrics — пример narrative. Поведение scroll, keyboard и fallback определяется внешними scene JS/CSS, не этим HTML.

**`assets/components/fx-bars/component.css:1–48`.** Подписанная шкала, plot 220px/180mobile, значения через --h, static accent fallback и transparent live windows. Последний bar выделен внешним ring, а не обесцвечиванием остальных. Предыдущие значения показываются hover; focus counterpart в этом CSS отсутствует. Доступный data path нужно обеспечить HTML/JS, которых assignment здесь не охватывает.

**`assets/backgrounds/check.html:1–45`.** Fixture для text-zone pixel checks: 800px grounds, невидимые ink/muted probes, фото со scrim в grey/pale/worst-white вариантах, liquid start/mid/end зафиксированы transform и data-no-pause. Это конструкция входов для contrast test, не готовые коэффициенты контраста.

**`assets/ui/terminal-run/fragment.html:1–24`.** Законченное статичное состояние: typed command/progress, четыре file rows, «128 tests» и next prompt caret через data-term hooks; decorative chrome aria-hidden. Animation/controls подключает внешний UI loader. Строка об успешных тестах — содержимое макета, не фактический результат этого аудита.

**`assets/icons/demo.html:1–78`.** Полный CSS/каталог структурно разобран, inline geometry классифицирована: 1 362 geometry/group/definition tags. Original-colour logos отделены от monochrome customer row; tall/land/wide aspect categories, aria-label/role и responsive file/icon grids. Inter и отсутствие JS — факты sample, не разрешение обходить house font policy. Название Stripe/OpenAI/прочего логотипа не доказывает интеграцию и права на endorsement.

### 2.4. References и что не доказано их существованием

У Taste статически разрешены 495 буквальных локальных ссылок/import-like ссылок из назначенных HTML/CSS; пять не разрешились при трактовке относительно страницы objects/index.html. Все пять относятся к **копируемым примерам**, а не к активным imports: `./assets/objects/photo-{dither,engraving,halftone}/object.js` и placeholder photos `assets/img/{object-on-white,photo}.jpg`. Их нужно перепривязывать к корню проекта и реальному asset, а не объявлять runtime broken links исходной галереи. Динамические template paths, index-driven effects, external HTTP/Unsplash/Commons и клиентские URL этим проходом не проверены. Metadata/import target exists не равно dependency executed/visual accepted/licence verified. Rust `use` и JS adapter dependencies учитывались при содержательном чтении; их транзитивное дерево не переобъявляется целиком покрытым этой assignment.

## 3. Friday: сравнение по смыслу, не по названиям

Локальные доказательства: `.codex/agents/design/design-reviewer.md:39–102,125–167`; `.codex/agents/design/design-department.md:39–75,79–115`; `docs/core/motion.md:12–103,140–175`; `.codex/workflows/review-loop.md:22–54`; полностью прочитанные `.codex/scripts/screenshot.mjs:1–152` и `.codex/scripts/design-lint.mjs:1–303`. Executing role `.codex/agents/design-reviewer.toml:3` статически разобран как TOML: инструкции содержат те же design-lint/screenshot/65–75/reduced-motion/80% concepts. Это подтверждение контента роли, **не её activation/live invocation**.

| Тема upstream | Статус относительно Friday | Доказательство и полезный delta |
|---|---|---|
| Визуально смотреть результат, не судить только по коду | already equivalent на уровне policy | reviewer.md:39–77 требует реальный просмотр, явно запрещает имитацию; не надо дублировать это новым skill |
| Контраст/строка/воздух | partial | reviewer.md:63–65,127–146 знает проблему; design-lint:7–103 — line regex, не glyph/paint/DOM measurement. Контекстные rendered checks upstream существенно глубже |
| Реальный контраст 4.5:1 | partial, не эквивалентная проверка | design-lint:21–26 пишет «контраст <4.5:1» по сочетанию классов, коэффициент не вычисляется. Нужен отдельный measured evidence, не усиление текста hint |
| Heading rhythm и demo/fine-print advisory | absent in inspected scripts | design-lint:7–103,187–219 не содержит измеренного rhythm/Advisory/Exempt; reviewer policy — ручная. Это ограниченное отсутствие в двух скриптах, не во всём Friday |
| Свежий screenshot | partial | screenshot:107–138 делает fresh browser pages и png, но нет source digest/receipt/scan-node identity; review-loop:40–54 уже требует revision freshness на policy уровне |
| Capture state/error provenance | partial | screenshot:124–130 при провале --click снимает как есть; upstream distinguishes unmeasured/drift. Нужен manifest requested-state vs achieved-state, не просто существование PNG |
| Reduced motion/visibility/perf | already equivalent как принцип, partial как enforcement | motion.md:87–103,140–148 требует gating/stop; upstream samples делегируют это loader. Ни одна сторона здесь не запускалась |
| WebGL lifecycle caps/static fallback | partial/другой уровень | Friday motion.md про layers/lazy Lottie, но не object mount budget. Taste даёт конкретные MAX4/CAPphoto3/underlay/palette, полезные только для согласованной WebGL feature |
| Domain fit/конкретная service copy | already equivalent intent + delta assets | department:42–47 и reviewer:86–91 требуют brand/domain/MASTER. Taste adds предметные композиции/never cases, не заменяет MASTER |
| Inter/system fonts и decorative motion | conflict при прямом copy | design-lint:9–12 запрещает Inter/Arial; Taste icons и часть previews содержат Inter; motion.md:62–85,142–146 ограничивает duration/stagger/lifecycle. Выбирать композицию, не слепо копировать tokens и loop |
| Paid comp confirmation/reference truth | policy already present | department:58–75 и reviewer:25–33 уже сильнее одного browser confirm: права, pilot, лимит, owner acceptance, запрет production. Upstream UI не может ослаблять эти gates |
| No fake completion и skip | already equivalent policy, enforcement differs | review-loop:29–30 и :52–54 требуют фактических проверок. Live E2E KnownLimitation и mock harness нельзя выдавать за выполненный live pass |
| Подключение глобальных блоков/consent automation | not applicable to audit / conflict по scope | loop_connect и consent invocation меняют состояние; Friday research-only не разрешает install/global config или consent action. Не переносить автоматически |
| JS parity/oracle/selector engine | not applicable без решения портировать detector | Friday lint не исполняет эти проверки. Покупка parity layer без использования алгоритмов — лишняя сложность |

Важно: design-lint всегда заканчивает `process.exit(0)` (`:300`), включая ERROR findings. Это не баг само по себе — такой CLI может быть advisory. Но использовать его exit code как жёсткий quality gate без разбора вывода нельзя. Это статический факт локального скрипта, а не наблюдение о текущем CI.

## 4. Приоритетный доказанный delta и владельцы будущей работы

Это предложения, не выполненные изменения и не назначение реальных исполнителей в системе.

1. **Evidence manifest, а не ещё один чеклист.** Предлагаемый owner: maintainer screenshot/tooling; target `.codex/scripts/screenshot.mjs` + reviewer contract. Выход: URL/viewport/source digest/time/requested-state/achieved-state/capture warnings, понятное error/unmeasured. Acceptance: отсутствующий --click не превращается в снимок «открытой корзины», source edit инвалидирует старый receipt, другой query-state не смешивается без явного решения.
2. **Контекстный measured visual audit как отдельный эксперимент.** Owner: design-reviewer/tooling maintainer; target новый изолированный detector или fixture suite, не перегрузка design-lint regex. Выход: heading rhythm, rendered line length/gutters/contrast с Advisory/Exempt/Unmeasured и DOM evidence. Acceptance: paired true/false fixtures для chip, framed demo, real control, pseudo surface, photo scrim, hidden drawer и временного entrance. Числа upstream не становятся house policy без проверки на своих страницах.
3. **I/O-failure tests перед импортом store-подобной идеи.** Owner upstream context/storage. Targets critique_storage:387 и :690–715. Acceptance: simulated failed close/short write не возвращает success/path, неполный файл не считается сохранённым и callback не расходится с CLI status. Готовый upstream store в Friday не устанавливать.
4. **Taste — selective pattern adoption.** Owner component-curator/motion-curator по department.md:85–109. Target будущий component brief: композиция, предметный use/never, static fallback, palette contract, MAX/lifecycle, provenance. Acceptance: брендовые tokens, keyboard/focus data path, reduced motion, hidden tab/offscreen pause, mount throw/asset failure и честный clipboard state. Не импортировать gallery GL16 и не утверждать визуальную приемлемость без разрешённого просмотра.
5. **Интеграционные отрицательные контроли.** Owner QA/tooling. Targets существующие будущие harness tests, не agents prose. Acceptance: stale source/screenshot, no-op edit, lost SSE, superseded claimant, wrong project и skipped browser имеют отдельные статусы. Не считать mock model доказательством качества модели.
6. **Не переносить без отдельного решения:** global Taste block installation, main-world consent optOut, eval-based cleanup, чужие customer metrics, demo test output, generic licence labels как client permission. Они не следуют из запроса на улучшение design agent.

## 5. Проверка завершённости и остаточные ограничения

Ledger программно сверяет все 34 assigned paths/ranges, конечный SHA-256 с начальным, total_lines и объединённое покрытие 17 974 строк без gaps. Внутри JSON отдельно отражены generated classification, decoded giant-template reading и локальные comparison sources. Файл/диапазон не объявлялся full от одного hash/count/search.

Содержательные чтения сохранены средними batches. При переполнении вывода использовались spill/read-back либо разворачивание generated-строки в ограниченные decoded batches. Первоначально ошибочные предварительные заметки о последних двух диапазонах исправлены **до** итогового отчёта: question_page — настоящий PAGE template, consent line41 — compact invocation/data, не re-export и не directText helper. Это важно для корректного объединения с другими closure-отчётами: использовать финальный ledger.

Вердикт: **назначенная статическая область закрыта с явно классифицированными generated data; runtime/visual PASS не заявляется**. Не проверены live Chrome/IDE/server/GPU/provider, actual installed role activation, external image downloads/licensing, транзитивные реализации всех loaders и все доменные consent селекторы в интернете. Эти границы не мешают завершить range-аудит, но запрещают объявлять кандидата установленным, визуально одобренным или production-ready.
