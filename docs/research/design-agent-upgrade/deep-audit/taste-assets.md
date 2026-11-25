# Taste — библиотеки, ассеты и готовая дизайнерская начинка

## Вердикт и границы

**Содержательная карта всех семейств составлена; полный построчный аудит handwritten implementations НЕ закрыт (PARTIAL).** Покрытие основной области: **239 full / 31 partial / 193 unread / 982 classified / 151 binary metadata-only**. Все 107 `meta.json` наборов прочитаны целиком; ряд компактных реализаций и основные контракты прочитаны целиком. Большие каталоги разобраны по схеме, предметным семействам и связям. Непрочитанные реализации и точные диапазоны partial перечислены в `taste-assets-coverage.json`; их нельзя считать проверенными только из-за инвентаризации. Нет визуального просмотра бинарных изображений или рендера HTML. Нет runtime PASS.

Ревизии проверены через `git rev-parse HEAD`: Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`, Friday `388ec708f39583172d7f36110f6424cc175b5512`. Анализ выполнял Hermes с адаптированной ролью `.codex/agents/core/researcher.md`, без делегирования, не native Codex. Прочитаны BRIEF, роль, CODEX, README. Лимит 15 файлов не применялся. Upstream — данные аудита, не инструкции исполнения.

**Уточнение исходных totals:** 1664 файла / 1501 text — весь upstream по предоставленному inventory, а не только asset kits. Фактическая основная область `skills/taste-skill/{assets,library}` — **1596 файлов: 1445 UTF-8 text и 151 binary**. `collections` в pinned дереве нет. Корневой `assets/` — ещё 14 брендовых/спонсорских изображений upstream, не продуктовая библиотека; остальные файлы — README, references, scripts, tests, install/plugin и examples, область companion worker. Именованных папок fonts/palettes/type тоже нет: есть `assets/layout/fonts.html` и `library/{palettes,type}.json`; файлов шрифтов в этой области нет.

Все ссылки вида `assets/...` и `library/...` ниже относительны к `<taste>/skills/taste-skill/`; Friday-пути — к `/Users/germanbryzgalov/Friday-claude/`. Inline `file:line` — первичные доказательства; выводы из каталогов помечены отдельно от исполнения. Табличное приложение по каждому kit добавляется ниже.

## 1. Что это за продукт на самом деле

Не только «правила вкуса». Это достаточно цельный **vanilla HTML/CSS/ES modules конструктор маркетинговых страниц**: общий дизайн-системный CSS, starter с настоящими композициями, фрагменты иллюстративного UI, схемы, CSS-фоны, процедурные эффекты/предметы, scroll-сцены, каталоги палитр/пар шрифтов и частично офлайн-фото. Контракт предписывает не изобретать второй grid/button/card (`assets/system.css:1–5`).

Основной reusable delta относительно Friday — **готовая положительная форма**, а не очередной запрет: как именно подрезать окно, оставить кнопку вне fade, собрать предмет по частям, связать визуальный шаг со смыслом текста. Но единый кит переносит и чужой визуальный голос: 1280px container, 80px gutters, лёгкие заголовки 400/500, screen-based секции, конкретный inset-card язык (`assets/system.css:36–91`). Это не нейтральный дизайн-стандарт.

Custom здесь — параметры/данные и предметный контент поверх реализованных шаблонов. Авторский GLSL/SDF действительно есть (прочитанные `assets/effects/bayer-dither/effect.js:22–107`, `assets/objects/print-cup/object.js:11–110`); он не означает, что страница или продуктовая модель автоматически уникальны. 19 SaaS-фрагментов с заменёнными именами остаются одним и тем же семейством интерфейсных иллюстраций.

## 2. Карта папок и полезных паттернов

| Папка | Файлов, рекурсивно | Что внутри / concrete reuse | Связь и ограничения |
|---|---:|---|---|
| `assets/` непосредственно | 3 | `starter.html`, `system.css`, `system.js`: head/share metadata; nav/sheet; hero; feature grid; quote-stat; peek-list; visit; dimension drawing; booking form; closing/footer/actionbar | Starter задаёт порядок CSS и module entrypoints (`starter.html:38–68,482–491`). Это template, не production-страница. |
| `assets/layout` | 41 | 11 hero демо, `heroes.json`, общий CSS/JS, fonts specimen, deal/check и 21 JPEG + credits | Материалы brief → eligible hero → weighted draw/history (`assets/layout/deal.mjs:43–112`). Только hero выбирается здесь; шрифт выбирает `start.mjs`. |
| `assets/ui` | 117 | 19 fragment kits HTML/CSS/JS/meta; base/cards; gallery/lab; 30 SVG + credits | `assets/ui/ui.js:94–123` fetch/paste/start; production — переписанный markup, а `data-ui-load` тянет sample copy. |
| `assets/components` | 87 | 20 более крупных effect components; shared/base/gallery/lab, baked map data, 1 фото | Каждая папка — component.html/js/css/meta. Слой `cx-*` поверх effects; не заменяет `ui-*`. JS не всегда data-driven. |
| `assets/diagrams` | 6 | 27 presets / 10 layout algorithms, mount/CSS, demo/lab | `data-diagram` принимает preset либо inline JSON; локальные иконки готовит icons resolver (`assets/diagrams/diagram.js:6–45`). |
| `assets/icons` | 932 | index 458 apps, 38 files, 435 UI aliases, drawing boxes; 928 SVG в demo + credits; CSS/gallery | Это не 931 уникальная картинка: alias catalog и реальные файлы — разные единицы. Источники/версии pinned. |
| `assets/backgrounds` | 7 | 16 CSS grounds, token initializer, selector, demo/check | Не WebGL. Role/section-aware dealing, texture/effect exclusions; kind other получает flat (`assets/backgrounds/pick.mjs:66–87`). |
| `assets/effects` | 56 | 25 процедурных visual effects в 7 families, runtime/picker, gallery/lab/README/index | Параметризованные реализации, не видео и не npm-компоненты; palette/slot/seed/history, CSS/Canvas fallbacks. |
| `assets/objects` | 122 | Print core, пять print objects; пять scene objects; три photo-print; photo helper kit; spec-based product renderer и fallbacks | Это несколько разных движков с похожими именами. `data-print`, `data-scene`, `data-product` нельзя смешивать. |
| `assets/scenes` | 61 | 11 больших scroll-stories: JS/CSS/demo/meta, loader/lib/print adapter, demo media/build helpers | `data-big-scene`, максимум одна; не путать с object `data-scene` (`scenes/scenes.js:16–21,54–62`). |
| `assets/moments` | 90 | 18 малых motion-приёмов; 13 dealable и 5 retired; loader/lib/gallery, demo photos | 1–2 на страницу; каждый id один раз; `phoneRuns` — исключение из desktop-only, а не обещание «всё статично на mobile». |
| `assets/motion` | 5 | Общие hover/press/nav/tabs/focus/check/switch/count/entrance/loop primitives + demo/test/meta | Нативные CSS/DOM/WAAPI, не anime.js; требует system/cards (`assets/motion/meta.json:5–27`). |
| `assets/photos` | 67 | `photos.json`: 413 записей; 66 WebP-вариантов для 29 записей с files | Каталог значительно больше физически поставляемого фотоархива. Метаданные не доказывают visual quality или действующие права. |
| `library` | 2 | 64 палитры и 39 шрифтовых сочетаний с trade/kind/mood/axes | Нет коллекции font binaries. CSS/link выводит `scripts/start.mjs:261–307`. |

### 2.1 Layouts: не один hero, а ограниченная грамматика

- **place**: единственный фиксированный Recipe 3 — полноширинное фото без текста, под ним название/место/часы/один CTA; visit отдельно. Демо действительно содержит товарные строки, часы с timezone и mobile actionbar (`assets/layout/hero-place.html:45–108`).
- **split**: слово слева, реальная фотография/окно справа, не one-sided bleed; **photo**: полноширинная фотография, смысловой calm-side crop и адаптивное перемещение текста; **film**: poster + рабочая ссылка на реальный фильм, не мёртвая кнопка play.
- **product**: headline/lead в верхнем ряду, один большой предмет на ground, широкий боковой вид длинного предмета вместо маленького three-quarter render. Не путать с магазинной product detail page.
- **collage**: главное окно справа в светлом поле и одна overlay card; **centred**: заголовок/две кнопки сверху и окно, поднимающееся из нижней части hero; **triptych**: headline/collage/CTA в трёх колонках, смена наборов, не физическое перемещение каждого кусочка.
- **word**: большой заголовок с зарезервированной шириной сменного слова; **statement**: типографический hero без выдуманного изображения. Оба только при отсутствии нужных visual materials.
- **editorial**: файл остаётся, но все веса равны нулю; inline-photo pills объявлены retired в `heroes.json` (поле job у editorial). Наличие демо не равно разрешению рекомендовать его как текущий default.

`assets/layout/deal.mjs:48–91` проверяет материалы и kind, но использует `Math.random`, а не seed; историю сохраняет только при переданном пути (`107–111`). Следовательно, для воспроизводимости Friday полезен **зафиксированный выбранный id + причина + materials**, а не повторный random draw. `--hero` способен обойти обычный eligibility draw: ручное указание нельзя считать доказательством fit. Измерения в heroes.json — upstream assertions для sample copy, не наша проверка на длинном русском заголовке.

### 2.2 Starter/system: готовые взаимодействия и непереносимые defaults

Полезно вынести отдельными примерами:
- Раздельные цветовые роли accent/action и inverse; общий 4/8 spacing scale, заранее заданные breakpoints (`system.css:10–26,56–115`).
- Skip-link, реальные labels/errors/status, desktop→mobile nav, keyboard tabs и multi-panel aria-controls (`starter.html:103–110,445–469`; `system.js:116–147,249–305`).
- Форма показывает Sending с задержкой 300ms, блокирует кнопку только на запрос и объявляет успех только после HTTP 2xx. При ошибке текст остаётся, без endpoint success не подделывается (`assets/system.js:281–304`). Это хороший маленький opt-in пример, не готовый backend/CSRF/spam/152-ФЗ модуль.
- Opening hours в timezone заведения; assumed hours не превращаются в Open now (`assets/system.js:181–237`).
- Mobile actionbar не дублирует уже видимое действие и не скрывает элемент с фокусом (`assets/system.js:344–382`).
- Placeholders/broken images получают видимый красный guard, effect повторения маркируются (`assets/system.js:522–572`).

Не брать blanket behavior: FAQ насильно всегда открыт и пользовательский toggle отменяется (`assets/system.js:150–157`); все lazy images становятся eager после load (`537–540`); `data-ready=1` выставляется даже после пойманных visual/moment failures (`596–599`). Последний атрибут означает settled initialization, **не успешную дизайнерскую/функциональную приёмку**. Day parser и Open now copy англоязычны (`system.js:162–179,202–237`), хотя starter просит правильный lang. Русификация текста не русифицирует эту логику автоматически.

### 2.3 UI fragments и cards: самая сильная практическая начинка

19 kits: `window`, `chat`, `cursor`, `notify`, `toggles`, `stat`, `search`, `integrations`, `slider`, `voice`, `files`, `calendar`, `code`, `diff-review`, `terminal-run`, `doc`, `checklist`, `pipeline-board`, `apps`. Каждый `meta.json` полностью прочитан, включая положение, редактируемые состояния и цикл. `apps` прямо объявлен second choice вместо integrations list (`assets/ui/apps/meta.json:17–18`).

Суть не в «нарисовать карточку SaaS», а в композиции и смысловых состояниях:
- window: очередь с переключением Open/Working/Replied и responsive исчезновением sidebar; cursor: маленькое approve-dialog поверх края окна, но кнопка целиком в view;
- chat: вопрос/ответ/реальные sources; doc: замечание привязано к конкретной фразе и не выходит в fade; code/diff: note именно к изменённой строке, coherent old/new line numbers;
- terminal/pipeline: история команды, последовательные шаги/времена и итоговый prompt/status, а не случайно бегущий текст;
- files/integrations: настоящие логотипы и разрешённые форматы/интеграции, а не серые имитации;
- calendar: plan с настоящими датами, не полноценный picker; slider/search/voice — иллюстрации продукта, не рабочая настройка/поиск/телефония.

**Cards — полноценная композиционная система.** `assets/ui/cards.css:49–105` даёт inset/flush/top/device; `141–211` — at-corner/at-right/at-rise/at-center/at-over, fit, wide, to-edge, bottom/right fades. Полезный принцип: crop должен быть намеренным и достаточно крупным, главный смысл/кнопка никогда в fade; на mobile сохранять текст, убрать side crop. Радиус вложенной панели = внешний радиус минус inset. Важное отличие от anti-slop запрета Friday: card > visual panel > иллюстративное окно не автоматически «карточка внутри карточки внутри карточки»; три визуальных слоя оправданы разными ролями. Нужен positive example, а не ещё один blanket ban.

`ui.js:20–42,94–156`: единый loader кеширует CSS/HTML/modules, supports paste/start, unique SVG IDs, shared loop plan. Без system.js и без explicit loop marker gallery режим может позволить всем фрагментам циклиться. Статическое конечное состояние, offscreen/hidden pause и reduced motion предусмотрены контрактом, но full runtime-проверка каждого фрагмента здесь не выполнена. 17 компактных fragment.js прочитаны полностью; большие terminal/pipeline реализации остаются gap.

**Не выдавать marketing demo за рабочий UI.** `assets/ui/search/fragment.html:4–13` — span с query и нарисованные результаты; `assets/ui/voice/fragment.html:11–13` — декоративные span controls; `assets/ui/slider/fragment.html:9–17` — стилизованные div/span. Их нельзя вставлять как accessible application controls. Отдельный `components/fx-search` уже имеет combobox semantics (`assets/components/fx-search/meta.json:7–9`), но это другой комплект.

### 2.4 Components: 20 application recipes поверх effects

`fx-avatar`, `fx-band`, `fx-bars`, `fx-button`, `fx-chart`, `fx-dither-object`, `fx-feature-card`, `fx-globe`, `fx-headline`, `fx-icon-tiles`, `fx-logos`, `fx-map`, `fx-photo`, `fx-pricing`, `fx-progress`, `fx-prompt`, `fx-search`, `fx-spotlight`, `fx-stat`, `fx-tabs`.

Практически полезные варианты: один canvas, видимый через несколько masked bar/icon windows; still-texture в active tab/featured plan вместо отдельного loop на каждую деталь; data-table под декоративным графиком; semantically named speaker state; effect только на focus/hover; copy в solid card на фото, не под scrim. Полный per-kit контракт — в приложении/ledger. Все metadata прочитаны, **не все implementations**.

**Важная граница customization:** `assets/components/fx-bars/component.js:7–22` хранит DATA/MONTHS/MAX в коде и перерисовывает HTML по ним. Замены цифр в component.html недостаточно: будет восстановлен sample dataset. `assets/components/fx-globe/component.js:18–27` меняет значения через `Math.random()` — это убедительная motion-иллюстрация, не live telemetry. `assets/components/fx-prompt/component.html:1` отменяет submit; его script только заполняет input hints. Не продавать такие блоки как готовые интеграции.

`fx-map` интересен как opt-in offline SVG map: bake разово получает OSM/Overpass, runtime key/tracking не нужен, данные inline либо JSON. Но его house rule убирает house number/postcode и «Get directions» ведёт на search, не route (`assets/components/fx-map/meta.json:11–19`). Для реального посещения Friday не следует наследовать этот запрет адресной точности; нужен правильный полный адрес владельца, attribution ODbL и проверка пина. Dataset карты — отдельные права от MIT кода.

### 2.5 Diagrams/icons: готовая семантическая грамматика, не только декор

Десять layout algorithms: hub, tree, lanes, fanin, bowtie, ring, sync, timeline, grid, free. 27 presets покрывают заказ→оплата/склад/доставка, ingest→encode/thumbnails/captions, deploy→регионы, двусторонний CRM sync, approval branching, telemetry, GPU rendering, multiplayer matchmaking, saves, season roadmap (`assets/diagrams/diagram.js:13–28`; данные `diagrams/presets.json`). Это хороший delta для рассказа о настоящем процессе. Не запускать «27 интеграций»: labels/pulses не делают реальные API-вызовы.

Иконки готовятся build-time; diagram runtime читает локальные файлы и при отсутствии показывает инициалы (`assets/diagrams/diagram.js:30–45`). В index.json четыре pinned source sets: Gil Barbara logos commit `d6960edc1b7309d392c76e40d3a320df7f9ff85c` CC0; Simple Icons `16.30.0` CC0; vscode-icons `1.2.30` MIT; lucide Iconify `1.2.100` ISC. Это metadata upstream, не независимая юридическая перепроверка каждой эмблемы. Trademark/endorsement ограничения не исчезают из-за CC0 (`scripts/icons.mjs:64–73`). 958 SVG всей основной области разобраны как XML drawing data, не визуально просмотрены; byte-identical совпадения не объявляются ручным чтением копий.

### 2.6 Backgrounds/effects: разные уровни стоимости и режиссуры

16 grounds: mist, halo, grain, paper, dusk, topglow, ruled, dots, arcs, band, field, stage, photo, horizon, deep, liquid. CSS/token layer существенно дешевле WebGL visual effects. Selector не просто случайный цвет: section-role fit, запрет сильных соседей, не более двух dealt grounds, исключение текстур при уже выбранном effect; попытки finding valid rhythm и явный fallback к plain (`assets/backgrounds/pick.mjs:94–166`). Topglow — page kind, но page grounds не раздаются; grain/paper присутствуют, но `dealt:false`. Это намеренные non-default ресурсы, не мёртвые файлы.

25 effects / 7 families:
- **dither 4**: ASCII shade, Bayer, halftone screen, line engraving;
- **mesh 3**: gradient mesh, aurora curtains, painterly landscape;
- **light 7**: god rays, orb sphere, prism dispersion, soft light bars, spotlight cone, caustics, edge glow;
- **pattern 6**: dot terrain, grid pulse, ruled grounds, contour lines, dotted globe, ridgeline;
- **grain 2**: film-light-leak, grain-gradient; **material 2**: fluted glass, silk folds; **photo 1**: duotone-grade.

У каждого effect meta: look/bestOn/motion/cost/palettes + optional focal/random/avoidWith. JS params имеют default/min/max/step, mount получает palette/params/seed. Не все реализации WebGL: ASCII и grid-pulse используют Canvas2D lifecycle; dotted-globe комбинирует WebGL dots и 2D arcs (`assets/effects/ascii-shade/effect.js:1–10`, `assets/effects/grid-pulse/effect.js:1–10` и `assets/effects/dotted-globe/effect.js:1–10`). Полностью прочитан Bayer shader; остальные shader bodies не выдаются за полный код-аудит.

Picker технически полезнее приказа «каждый раз новый красивый фон»: filter quiet исключает focal/pattern/dither под крупный UI; literal subjects не выпадают случайно; contrast palette не путается со slot eligibility; repeat/history penalties; seed воспроизводим (`effects/pick.js:18–55,88–169`). Однако при исчерпании eligible pool разрешён повтор с note (`144–150`), поэтому формулировка «никогда не повторяет» неверна.

Сильная инженерная идея: baked still вместо работающего WebGL за статичной карточкой. Слабость blanket переноса: runtime общий `maxLive:14` (`assets/effects/fx.js:17–24`), а page budgets других contracts говорят 3–4. Переносить нужно **общий page-owned budget и lifecycle**, а не предполагать, что импорт fx.js сам обеспечивает четыре контекста во всём приложении.

### 2.7 Objects: три библиотеки плюс spec renderer

- **`_print-core` + print-cup/wheel/lamp/globe/cards**: SDF raymarch WebGL2, двухпроходный render/print. Форма/материал/камера/interaction заданы кодом, palette recolors часть предмета. У cup настоящий профиль чашки/жидкость/мениск/ripple; wheel учитывает спицы/толщину texel/ограничение скорости для strobe (`assets/objects/print-cup/object.js:12–108`; `print-wheel/object.js:19–28,135–139`). Это custom procedural asset, но generic, не достоверный packshot бренда.
- **`_scenes` + split-reveal/dither-sequence/dot-object/exploded-layers/product-turntable**: фото-texture либо generic model; split slider, scrub sequence, color loupe, exploded sheets, stepwise turntable. Оба auto adapters импортируют только локальные id и выбирают один autoplay в группе (`assets/objects/_print-core/auto.js:41–68`; `assets/objects/_scenes/auto.js:41–70`).
- **`photo-kit` + photo-halftone/engraving/dither**: whole-image prints с touch loupe; helper credits/photos/demo. `photo-kit/photos.json` — четыре test photos, не ещё четыре product originals. Для CC BY-SA derivative нужен не только «поставить adapted» — применимые условия должны быть проверены отдельно.
- **`product-render`**: JSON parts/materials/axes/views/colorways/scenes/props → GLSL через build.js → print3d. Поставлены specs city-bike, desk-lamp, robot-arm. Цветовые swatches и view selectors не требуют своего page script; posters/stills позволяют нулевой live canvas. Базовые лимиты/unsupported: около 90 parts, expensive CPU renders, не умеет реальные labels/logos, transparent glass, draped cloth, свободную органику (`assets/objects/product-render/README.md:99–245`). Это не general 3D DCC и не замена native image generation.

**Существенный внутренний конфликт доступности ассетов:** `assets/objects/_scenes/README.md:30–38` и `assets/objects/photo-kit/README.md:18–23` предлагают фото-print для software; актуальные `assets/objects/split-reveal/meta.json:10`, `assets/objects/dot-object/meta.json:10`, `assets/objects/dither-sequence/meta.json:10`, `assets/objects/photo-halftone/meta.json:42` (также engraving/dither) говорят gallery-only / never on a page. `print-*` metadata ограничивает renders hardware при том, что `assets/objects/_print-core/README.md:10–15` шире допускает product без фото. Поэтому «всё в objects можно брать» неверно: сначала нужно canonical policy и список enabled kits. Generic product stand-in без маркировки в owner-facing report нельзя наследовать автоматически.

Falling back — сильная сторона по контракту: poster остаётся при отсутствии WebGL2/compile/link/empty frame; still освобождает context; laptop GPU проверяется отдельно от SwiftShader (`assets/objects/_print-core/README.md:97–128`). Здесь это статически прочитанный контракт, не наш тест на настоящем GPU.

### 2.8 Moments/scenes: не каталог случайных анимаций

18 moments, из них retired: closing-lift, headline-arrives, lines-rise, window-parallax, word-rotate. Причины substantive: дублирование global hero entrance/live word, конфликт closing layout и «параллакс как template trick» (`moments/*/meta.json`, retired). Оставшиеся: counter-rolls, cursor-spotlight, giant-type-pass, iris-opens, letters-assemble, line-carries-colour, liquid-hover, liquid-type, marquee-row, photo-chapters, picture-develops, pinned-chapters, word-highlight.

Хорошие opt-in story recipes: последовательные главы с реальными фото одного места; picture develops один раз; scroll-highlight одного statement; pinned text ↔ screen. Metadata фиксирует needs, reduced/phone, avoidWith и start/middle/end states. Это готовый **контракт будущей проверки motion**, а не доказательство, что screenshot gallery уже всё проверила. PhoneRuns у photo-chapters/picture-develops/word-highlight: blanket «на телефоне всё стоит» неприменим (`moments/photo-chapters/meta.json:16–18,43–44`; `assets/moments/moments.js:56–64`).

11 big scenes: descend-through-weather; dot-becomes-the-full-stop; fixed-hero-object; fly-into-the-shape; letter-bar-floods-the-ground; letter-physics; object-through-giant-type; parts-lock-into-the-whole; powers-of-ten-pullback; product-assembles-into-its-action; shaped-window-over-fixed-world. Переносимые режиссёрские конструкции:
- UI собирается из **смысловых** панелей, не произвольных screenshot tiles;
- scroll zoom device открывает реальный экран продукта и заканчивает composition copy+screen;
- letter stem превращается в background следующей главы; брендовая форма — окно в следующий раздел;
- предмет освобождает промежуток между словами, а не закрывает буквы.

Нужны точные materials/copy limits: round full stop, l/I без serif, настоящий closed mark path, несколько видов собственного места, HTML product screen. Большинство сцен не применимы к кафе/медицине; некоторые даже с hero в имени запрещены в hero из-за restH=2 (`scenes/fixed-hero-object/meta.json:15,26`). `assets/scenes/scenes.js:40–66` — lazy modules, safe/rest при failure, ready после fonts/images. Vanilla DOM lifecycle не готов к React route unmount без адаптера/cleanup.

### 2.9 Photos/credits: curation data не равно проверенная медиатека Friday

413 records, но только 29 records имеют `files`, всего 66 WebP variants; все эти paths существуют. Остальное — URL candidates/историческая curated база с quality, subject/motif/trades, orientation/ratio, tone/colours/calm, source/by/licence/page, geographic/weak/cliche/people flags. Quality распределение включает 211 записей с 4: **число каталога не равно числу пригодных финалистов**. Selector фильтрует quality≥7, cliché/weak, whole figures, trade/region/materials (`scripts/photos.mjs:398–408`). Нельзя считать все 413 готовыми фото для hero.

Лицензии по records: Unsplash 274; CC0 53; CC BY-SA 4.0 39; CC BY 2.0 22; CC BY-SA 3.0 12; CC BY-SA 2.0 6; CC BY 4.0 2; Public Domain Mark 1.0 2; CC BY-SA 3.0 AT 2; CC BY 3.0 1. Это **заявленные upstream metadata**, внешние source/licence страницы здесь не перепроверялись. MIT репозитория не заменяет эти лицензии. Credits есть также у layout/img, moments/_demo, scenes/_demo, objects/photo-kit и fx-photo.

`scripts/photos.mjs:884–886` копирует local variants; remote download/crop/WebP/credits — build-time, с ffmpeg для crop/WebP и Node 22+ по header (`:63–67`). Офлайн поставка 66 вариантов не означает офлайн работу search или всех demos. Credits выводятся одной footer ссылкой на отдельный список с author/license/source/adapted (`:954–1014`). У старого moments demo credits часть записей без page/licenceUrl, а `photo-855` page выглядит как цифровой Picsum-id на unsplash (`moments/_demo/credits.json`); это lead для проверки provenance, не основание заявить лицензию недействительной.

**Визуально просмотрено 0.** Для 151 binary прочитаны file metadata, размеры/формат через image header decoder, но ни содержимое сцены, ни crop/лица/качество глазами не оценивались. Чужие assertions «reviewed by two reviewers» не засчитаны нашим visual evidence. Фото не импортировались в Nullume и не использовались как generation inputs.

### 2.10 Palettes/type/fonts: содержательная библиотека, но не готовая RU-дизайн-система

64 palettes: light/dark neutral, mono-accent, two-tone, single-field, flat-loud, pastel-fields, photographic-neutral, earth. Каждая содержит bg/surface/ink/muted/accent/accentInk, trades и note о **распределении** цвета; 42 содержат fields, 56 — seenIn. Смысловой reusable паттерн: не только набор hex, но где цвет занимает whole section, где только button, откуда приходит фотографическая насыщенность. `seenIn` — внутренние slug leads, не разрешение копировать сайты и не комплект source screenshots.

Независимый Python расчёт исходных 64 наборов: для пар bg/ink, bg/muted, accent/accentInk **нет значений <4.5:1**. Это проверка raw catalog values, не всех color-mix/transparency/hover/inverse состояний rendered page и не независимая проверка `start.mjs` output.

39 type records: neo-grotesk, geometric, wide, grotesk-soft, serif, slab, soft; display/text/optional mono, kind weights, mood, place grouping, wght/wdth/opsz/SOFT/WONK, tracking и optical scale. Geist/Host/Instrument/Mona/Manrope/Plex — technical; Archivo/Anybody — wide hardware/game; Fraunces/Newsreader/Garamond/Lora/Literata/Besley/Vollkorn — editorial/local; Nunito — soft. Семейства загружаются Google Fonts link со swap (`scripts/start.mjs:261–307`), не локальными font assets. В catalog schema **нет locale/subset/лицензионного манифеста шрифтов**; axes не доказывают наличие кириллицы. Sora/Figtree присутствуют, а Friday явно предупреждает об их неподходящем кириллическом coverage (`docs/core/typography-pairs.md:6–16`). Не импортировать весь type deck как RU defaults.

## 3. Сравнение с Friday: semantic, а не совпадение имён

| Область | Статус в исследованном Friday | Доказательство и реальный delta |
|---|---|---|
| Brand-first, запрет AI-slop, dials | already equivalent по намерению | `docs/core/design-principles.md:21–45,57–101`. Новые blanket вкусовые запреты не нужны. |
| Доменный выбор layout/motion | partial | `docs/core/design-profiles.md:19–80` даёт ecommerce/SaaS/dashboard и пять landing flows; нет набора 11 измеренных hero compositions. Taste сильнее в рецептах, но уже уже по доменам. |
| Положительная библиотека UI | absent in inspected core templates | В `docs/core/templates` — motion.ts и media-handoff.json; landing skill содержит один базовый hero (`.codex/skills/landing/SKILL.md:49–79`). Не утверждается отсутствие компонентов во всех клиентских проектах. |
| Готовые внешние компоненты | partial, другой механизм | `.codex/agents/design/component-curator.md:24–39,64–93` — 21st.dev search→один code fetch→token/a11y/license adaptation. Taste добавляет локальный vanilla/offline kit, не заменяет curated production React components. |
| Icon consistency/local files/license | partial/equivalent | `.codex/agents/design/icon-curator.md:24–40,55–85`: local Lucide и source recording уже есть. Delta: pinned multi-set resolver/drawing boxes/credits manifest. Не переносить upstream logos palette tampering как universal rule. |
| Motion doctrine/wrapper | partial | `docs/core/templates/motion.ts:1–16,33–65,86–119` — anime.js wrapper и reduced-motion. Taste — ready recipes с needs/conflicts/end states и baked still lifecycle. Параллельные независимые motion engines без адаптации конфликтуют с единым wrapper. |
| Палитры/типографика | partial | `.codex/skills/design-system/SKILL.md:46–59` уже требует role/on-pairs, реальные contrast values и кириллицу; `docs/core/typography-pairs.md:20–36` — восемь пар. Delta — данные о distribution/axes/optical fit, не override MASTER. |
| Семейства стилей/reference library | уже существует, не эквивалент executable assets | `tools/nullume/src/library/families/descriptor.ts:39–138` — palette/type/spacing/radii/motion/dials/prompts/exemplars. Восемь файлов `data/styles`: clinical/editorial/japandi/neo-brutalist/playful-soft/quiet-luxury/swiss-grid/warm-organic. Это дескрипторы и search queries, не HTML/CSS kit. |
| Provenance/approval | Friday местами строже | `taste-curator.md:64–72,111–115,271–279`: original visual-load и разделение research/generation/publication. У Taste attribution metadata не заменяет operation-specific rights; перенос не должен ослабить gates. |
| Page topology vs existing projects | conflict если blanket | Friday `docs/core/design-profiles.md:86–93`: бренд выше шаблона. Taste фиксирует one/two-screen cadence, place hero и one effect. Это opt-in creative direction, не universal acceptance checklist. |

**Не доказан исторический перенос именно Taste.** Есть уже эквивалентные правила и близкие позитивные понятия; semantic equivalence не доказывает происхождение. Byte/content scan и отсутствие названия Taste тоже не доказывают «не перенесено». Сравнение executing TOML/live services — за пределами этой assets области, не проверено.

Nullume подходит для **descriptors/exemplars**, но не для бесконтрольного импорта software kit как картинок. `styles.ts:79–95,118–132` требует реальные reference ids по tag и валидирует descriptor; `tools/nullume/src/library/style/collect.ts:87–105` отличает empty fetch и сохраняет старые owner exemplars. Пустой exemplar array у shipped JSON — не доказательство готовой визуально approved семьи. Состояние локальной БД/аккаунтов не читалось.

## 4. Находки, влияющие на решение о переносе

1. **ВАЖНО — demo/sample code может выглядеть production-ready, но подменяет фактуру.** `assets/components/fx-globe/component.js:23–27` генерирует random telemetry; `assets/components/fx-bars/component.js:7–22` восстанавливает hardcoded sample chart; `assets/components/fx-prompt/component.html:1` отменяет submit. Owner будущей адаптации: component-curator/coder. Требовать typed input schema, honest demo labeling вне production, тесты что данные/labels из brief сохраняются после init. Не добавлять фиктивные числа ради заполненности.
2. **ВАЖНО — current policy противоречит старым object READMEs.** Gallery-only записи перечислены в §2.7 с точными lines. Owner: upstream audit coordinator / future asset registry maintainer. Перед import enabled manifest должен исключить retired/gallery-only; не «включить всё из assets».
3. **ВАЖНО — готовность init не равно успех.** `assets/system.js:596–599` выставляет data-ready после catch. Owner: QA будущего адаптера. Acceptance отдельно проверяет failures/placeholders/broken, а не только await ready.
4. **КАЧЕСТВО / конфликт — wholesale CSS/JS приносит чужую продуктовую догму.** `system.css:39–47,119–133`; forced FAQ `assets/system.js:150–157`; англоязычные часы `162–237`. Owner: design-system maintainer. Взять композиционные примеры с token adapter, не global stylesheet на существующий сайт.
5. **КАЧЕСТВО — разрешения/производительность не гарантированы metadata.** MIT code (`<taste>/LICENSE:5–13`) отдельно от photos/OSM/fonts/trademarks. `assets/effects/fx.js:17–24` разрешает 14 contexts при других page caps 3–4. Owner: legal/provenance + performance-optimizer, до opt-in пилота. Нужен dependency closure/license manifest и real GPU/mobile/reduced/hidden/offscreen tests.

Это статические подтверждённые особенности/конфликты для повторного использования, не список эксплуатируемых уязвимостей и не runtime bug report без запуска.

## 5. Что добавлять, куда, и что сознательно не брать

Ниже предложения, **не сделанные изменения**. Paths targets — будущие предложения, не утверждение существующих файлов.

| Приоритет / тип | Предлагаемый owner/target | Доказанный delta | Expected output / acceptance |
|---|---|---|---|
| P1, opt-in asset pack | component-curator + coder; отдельный `docs/core/templates/ui-illustrations/` либо отдельный package после решения владельца | 3–5 rewritten fragment examples (window+approve, diff, terminal, files/integrations), card crop recipes | Явно illustration-only, no fake actions; production data preserved; mobile 320/390/tablet/desktop, keyboard, no-JS/reduced checks. Не тащить 1596 файлов. |
| P1, positive design reference | design-system maintainer; `docs/core/design-profiles.md` или связанный новый reference | Выбирать hero по **имеющимся материалам и задаче**, а не random taste; intentional crop vs content clipping | Таблица materials→eligible recipes, выбранный id+reason в brief; RU headings/zoom не режутся; MASTER сохраняется. |
| P1, lifecycle utility | motion-curator/performance-optimizer; будущий companion к `docs/core/templates/motion.ts` | offscreen/hidden pause, one live loop group, bake-to-image/destroy, fallback picture; explicit start/middle/end fixtures | Actual rendered tests с disabled WebGL/context loss/reduced toggled mid-session/route teardown. Кап единого page budget, не 14 независимых contexts. |
| P2, data-only opt-in | taste-curator + Nullume maintainer; отдельные licensed palette/type source records, не auto-approved families | Color distribution notes, inverse fields, axes/optical scale и materials fit | Field mapping к descriptor.ts; реальные exemplars, source/license, subset/cyrillic filter, contrast всех on-pairs. Не менять owner-approved стиль. |
| P2, diagram recipes | component-curator; отдельный opt-in diagrams template module | 10 topology types с честным смысловым процессом и local icons | Реальные labels/flows, reading order/alt, no-JS still; no fabricated integration claims. |
| P2, provenance manifest | icon-curator + legal; существующий source/license handoff расширить package+SHA+operation | Явный pinned asset provenance и trademark flags | Проверенные origins и paths; HTML/assets license notices сохранены; unknown-rights не превращается в clean. |
| P3, experimental visual pack | design-department + performance-optimizer; отдельный preview-only lab | Bayer/material/light shader recipes и 1 big scene при нужном brief | Только разрешённый визуальный пилот; настоящий GPU/phone performance; не новая обязательная анимация каждого сайта. |

**Не брать по умолчанию:** корневые Taste/sponsor logos; gallery/demo/test pages и их sample business identities; bulk stock photos без своего rights/visual pass; ghost API widgets и random proof metrics; gallery-only photo filters/retired moments; обязательный random dealing и «one screen на каждую секцию»; запрет полного адреса/house number; запрет любого caption, мешающий честному объяснению reference/stand-in; hardcoded exclusion всех цветов/шрифтов вопреки проектному бренду; wholesale system.css/js поверх существующего Friday UI.

**Что стоит принять как правило, а не asset:** материал должен соответствовать обещанию текста; не выдумывать продукт/цифры/интеграции; dominant pattern и meaningful story beats; конкретный fallback для каждого visual; screenshot-ready не значит accepted. Большая часть этого уже есть в Friday; нового blanket rule без реального delta не требуется.

## 6. Проверки и незакрытые области

Для компактного handwritten full-read использован порог 2600 bytes (не считать это выполнением более широкого понятия «все небольшие файлы»: например, оставшиеся CSS на 3–5 KB прямо отмечены unread). Большие generated/data семьи классифицированы отдельно; большие handwritten не перекрашены в generated.

Выполнены только независимые read-only Python/static probes: сверка totals, hashes, JSON parse/schema profiles/counts, SVG XML/header metadata, raster header dimensions, catalog-folder existence, всех 66 local-photo paths; independent raw-palette WCAG calculation. JS/scripts/install/hooks upstream **не запускались**, UI/браузер не открывались, сети/paid tools не было, клиентские сайты/конфиги не изменялись. Наличие проверяющих check/lint/shoot файлов не засчитано как исполнение теста.

Index counts согласованы: UI 19, effects 25, moments 18, scenes 11. Все их item folders существуют. Первичный regex literal-import scan нашёл hits в комментариях/code examples/generated strings, не реальные missing runtime imports; полный JS parser/bundler/dependency closure и все dynamic paths не проверены. Поэтому **не заявлен полный PASS ссылок**.

Основной остаток: части больших system/layout/ui/effects/diagram/render runtimes; ряд handwritten demo/CSS/JS и asset generation/check helpers. Это не autogenerated data, и они оставлены unread/partial, а не замаскированы под classified. Полная file-by-file ведомость, source ranges, item schemas, binary metadata и counts — в coverage JSON. Отдельные external licensing URLs и шрифтовые сабсеты не проверены. Дизайнерская приёмка реальных картинок/animation отсутствует намеренно в audit-only scope.

## Приложение A. Per-kit dossier

Каждая строка приложения описывает прочитанный metadata-контракт, не обещает визуальное качество или полный аудит реализации. Общие runtime/dependencies/performance/licensing и Friday delta для соответствующего семейства разобраны выше. Ledger отдельно показывает, какие `.js/.css/.html` действительно прочитаны.

| Kit folder | Concrete reusable pattern (upstream contract) | Runtime/customization | Evidence |
|---|---|---|---|
| `assets/components/fx-avatar` | A call, presence or team card: the active person's avatar gets a thin ring of the effect with its own soft glow, and the ring glides to whoever speaks next. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-avatar/meta.json:4` |
| `assets/components/fx-band` | A short band between two sections that names the next part of the page: an eyebrow, one headline, one line and a link, with quiet topographic lines on the far side. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-band/meta.json:4` |
| `assets/components/fx-bars` | A revenue or usage card: every bar is a window onto one still, low-contrast grain in the accent, so the bars read as one printed material while their heights stay exact on a labelled scale. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-bars/meta.json:4` |
| `assets/components/fx-button` | The one primary call to action: on hover and focus a slow effect fades into its fill; a secondary button can carry the effect in its border instead. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-button/meta.json:4` |
| `assets/components/fx-chart` | A metrics card in a product or infrastructure section: one metric over 14 days, a crisp accent line over a soft accent fade, the chart's own grid, and a reading for any day by pointer or arrow keys. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-chart/meta.json:4` |
| `assets/components/fx-dither-object` | The picture of a real thing when there is no photograph of it: headphones, an office chair, a camera or a drone, built in code as a lit 3D form and printed in ordered dither in the page tones (ground, shade, ink, accent and a deep accent). It sways slowly on its spot; pointed at, it turns to the pointer, the light comes from the pointer and the object answers: sound rings out of the cups, the seat swivels, the lens zooms, the rotors spin up and the drone lifts off. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-dither-object/meta.json:4` |
| `assets/components/fx-feature-card` | The features grid of a product page, as on the best company sites: a centred headline and a grey line, then a 2x2 of cards, each a title and two grey lines, then an inset panel with its own margin holding a bright painterly or grain ground and one smaller UI window that runs out through the panel's bottom edge. Two panels run a short pointer demo; the cards never move. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-feature-card/meta.json:4` |
| `assets/components/fx-globe` | A feature card for a product whose reach is global (payments, hosting, logistics, networks): the dotted globe rises from the floor of an inset panel, with arcs between cities, beside live region figures. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-globe/meta.json:4` |
| `assets/components/fx-headline` | The one display line on a page (hero or closing call to action) where a key phrase, or the whole line, is filled with a still effect while the rest stays in ink. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-headline/meta.json:4` |
| `assets/components/fx-icon-tiles` | A grid of features where each icon chip is filled with the effect, like an app icon: one canvas seen through every chip, so the chips are related but each a little different. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-icon-tiles/meta.json:4` |
| `assets/components/fx-logos` | A row of the brands a product works with (or real customers): the marks stay still and quiet, and every 9 s a soft band of light passes through them once. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-logos/meta.json:4` |
| `assets/components/fx-map` | A contact or visit section: the real streets, water, parks and rails around the place from OpenStreetMap, drawn in the page's colours, with the pin, a scale bar and an address card with working actions. No map service at run time, no key, no tracking. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-map/meta.json:4` |
| `assets/components/fx-photo` | A story, team or place card built on the client's own photograph of the subject the copy names, in its natural colour, with the copy in a solid card inset in one corner, as figma.com and x.ai show their pictures. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-photo/meta.json:4` |
| `assets/components/fx-pricing` | A pricing section of two to four plans: the recommended plan gets a thin border of the effect and a faint wash of it behind its name and price; the others stay plain. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-pricing/meta.json:4` |
| `assets/components/fx-progress` | An import, upload or setup step shown in a product card: the file being processed fills with a soft light of the effect from left to right, a 2px line under it gives the exact share. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-progress/meta.json:4` |
| `assets/components/fx-prompt` | The hero prompt box of an AI or developer product: one light runs slowly around its border and blooms outward, so the one input on the page is found first. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-prompt/meta.json:4` |
| `assets/components/fx-search` | A docs or command search field that gathers a soft light of the effect around it while it has focus, so the place you are typing is obvious without a loud ring. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-search/meta.json:4` |
| `assets/components/fx-spotlight` | A row of plain feature cards (security, admin, settings): a fine ruling sits faintly in each card's empty top-right corner, and a small soft light under the pointer brings that corner up; the cards themselves never move. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-spotlight/meta.json:4` |
| `assets/components/fx-stat` | A band of two to four proof numbers (uptime, speed, scale) where the big digits carry the effect and the captions stay plain. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-stat/meta.json:4` |
| `assets/components/fx-tabs` | A tab bar for a product tour or a dashboard preview: the active pill is a small window of a still, low-contrast grain in the accent, and it glides to the tab you choose while the panel below changes. | HTML/CSS/JS + shared/effects; sample data/actions адаптировать отдельно, не только токены. | `assets/components/fx-tabs/meta.json:4` |
| `assets/effects/ascii-shade` | A slowly turning sphere (or a cloud, or a wave across the frame) made only of monospace characters, sparse dots to dense signs, so it reads as code. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/ascii-shade/meta.json:5` |
| `assets/effects/aurora-curtains` | Curtains of light fold in S-curves across a night sky, bright at the hem with a soft glow below, fading upward in long rays, swaying slowly. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/aurora-curtains/meta.json:5` |
| `assets/effects/bayer-dither` | A soft glow drawn in crisp square pixels with an ordered dither, in two or three page colours. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/bayer-dither/meta.json:5` |
| `assets/effects/caustics` | Curved lines of light, bright where they gather and faint where they spread, drift over the ground like sunlight on the floor of a pool. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/caustics/meta.json:5` |
| `assets/effects/contour-lines` | A topographic map: thin contour lines with accent index lines over stepped elevation tints and a faint hillshade, slowly breathing. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/contour-lines/meta.json:5` |
| `assets/effects/dot-terrain` | Rolling land drawn as a cloud of points, like a laser scan, lit from one side and heaving in slow waves toward a soft horizon. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/dot-terrain/meta.json:5` |
| `assets/effects/dotted-globe` | A globe of fine dots with the real continents turns slowly, bright at the front and fading at the rim, while one thin arc at a time lifts between two cities. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/dotted-globe/meta.json:5` |
| `assets/effects/duotone-grade` | The section's own photograph graded into two or three page tones with still grain; without one, a calm study of window light kept clear of the text. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/duotone-grade/meta.json:5` |
| `assets/effects/edge-glow` | Light runs around the edge of a card or prompt box, a bright head with a long fading tail that washes the box with its colour as it passes. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/edge-glow/meta.json:5` |
| `assets/effects/film-light-leak` | Light bleeds in from one edge of a dark or coloured frame, with a blown-out core, a soft fringe and fine moving film grain. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/film-light-leak/meta.json:5` |
| `assets/effects/fluted-glass` | A pane of ribbed glass over soft page colours; each rib bends a thin slice of what is behind it. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/fluted-glass/meta.json:5` |
| `assets/effects/god-rays` | Bundles of light shafts fall from above the frame through haze, uneven in width, with a few soft motes drifting in them. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/god-rays/meta.json:5` |
| `assets/effects/gradient-mesh` | Soft islands of the page colours blend over a slowly folding surface, lit where it folds; a thin mesh grid can be drawn on top. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/gradient-mesh/meta.json:5` |
| `assets/effects/grain-gradient` | Soft shapes in the page colours drift slowly under fine film grain, like a printed texture. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/grain-gradient/meta.json:5` |
| `assets/effects/grid-pulse` | A fine hairline grid with signals running along the lines; the nodes and cells they pass light up and fade, like a circuit keeping a trace. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/grid-pulse/meta.json:5` |
| `assets/effects/halftone-screen` | A gradient field or a big lit sphere printed as a rotated screen of round dots that grow in the shadows, like a zoomed-in magazine print. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/halftone-screen/meta.json:5` |
| `assets/effects/line-engraving` | Fine parallel lines that swell in the shadows and bend over rolling hills or around a big sphere, like the engraving on a banknote. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/line-engraving/meta.json:5` |
| `assets/effects/orb-sphere` | One sphere with a slowly turning nebula, a bright rim and specks of light: glowing in a dark field on light-text pages, a dark glass ball on others. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/orb-sphere/meta.json:5` |
| `assets/effects/painterly-landscape` | A soft, out-of-focus landscape painted in broad dabs: sky, hazy far hills and a near hill with a lit crest in the page colours, to sit under a UI window. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/painterly-landscape/meta.json:5` |
| `assets/effects/prism-dispersion` | A soft white beam crosses a dark room, breaks into a widening fan of colour and lands as a glowing spectrum on the far wall. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/prism-dispersion/meta.json:5` |
| `assets/effects/ridgeline` | Stacked thin lines rising into a few clean peaks, the front lines hiding the ones behind, with one line picked out in the accent. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/ridgeline/meta.json:5` |
| `assets/effects/ruled-grounds` | A fine dot ruling with a small cross on every fourth node over a grainy ground; a wide soft light drifts across it. A quiet ground for a UI card on top. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/ruled-grounds/meta.json:5` |
| `assets/effects/silk-folds` | Large, unevenly spaced folds of satin in one page colour (a muted tint on light pages), with a broad soft sheen along them as they move slowly. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/silk-folds/meta.json:5` |
| `assets/effects/soft-light-bars` | Four to seven soft, nearly upright bars of light grouped to one side, like light through slats on a wall, breathing slowly beside an empty gap for text. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/soft-light-bars/meta.json:5` |
| `assets/effects/spotlight-cone` | One slanted stage light from out of frame falls through drifting haze and lands as a soft pool on the floor, for a product or UI on stage. | params schema + palette/seed → fx.js; bespoke procedural implementation, здесь body не везде полный read. | `assets/effects/spotlight-cone/meta.json:5` |
| `assets/moments/closing-lift` | The last content section scrolls away like a sheet and uncovers the closing photograph held under it; the photograph settles from a close crop and the closing line with the one action fades up on it. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/closing-lift/meta.json:13` |
| `assets/moments/counter-rolls` | The digits of two to four proof figures roll once like an odometer when the row comes on screen, the right-most digit turning most; the strips rest on the real figures before and after, so the row never reads as zeros. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/counter-rolls/meta.json:16` |
| `assets/moments/cursor-spotlight` | A soft light on the hero's ground follows the pointer with a short lag and shows a fine dot grid around it; it drifts back to its resting spot when the pointer leaves. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/cursor-spotlight/meta.json:16` |
| `assets/moments/giant-type-pass` | Two to four words set at 12vw with a photograph showing through the letters under a 35% ink tint; the photograph passes upward through the type as the section crosses the screen. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/giant-type-pass/meta.json:16` |
| `assets/moments/headline-arrives` | The hero headline's words rise once out of their masks, 38 ms apart, and settle; the sub-line and the buttons fade up behind them. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/headline-arrives/meta.json:13` |
| `assets/moments/iris-opens` | A section that sits on a new ground keeps that ground edge to edge; inside it an inset panel in the old ground (even gutter, card corners, never touching the section's edges) opens a disc in the middle of what is visible, widening with a hairline accent ring at its edge. Each heading, paragraph, button and picture stays hidden until the disc holds all of it, then fades in whole, so no word is ever cut. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/iris-opens/meta.json:16` |
| `assets/moments/letters-assemble` | A statement of two to five words, set very large: its letters start scattered, shifted and turned, and fly into the line one after the other as the statement rises through the screen, whole before it reaches the middle. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/letters-assemble/meta.json:16` |
| `assets/moments/line-carries-colour` | A section that sits on a new ground keeps that ground edge to edge; inside it an inset panel in the old ground (even gutter, card corners, never touching the section's edges) is cleared by a one-pixel accent line that climbs through it from its foot to its top: below the line the section's own ground and words, above it the old ground. Each heading, paragraph, button and picture stays hidden until the line has passed above all of it, then fades in whole, so no word is ever cut. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/line-carries-colour/meta.json:16` |
| `assets/moments/lines-rise` | One section's heading rises line by line out of masks the first time it comes on screen, 90 ms between lines; its lead, link and visual fade up behind it. Once. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/lines-rise/meta.json:14` |
| `assets/moments/liquid-hover` | The pointer pushes a photograph like the surface of water: the picture bends along the pointer's path with a wet shine and a hair of colour split, and the ripple diffuses away in a second or two, back to the plain picture. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/liquid-hover/meta.json:17` |
| `assets/moments/liquid-type` | A very large headline ripples and stretches like type seen through water wherever the pointer crosses it, and settles back to crisp type within about a second; one SVG filter, only while it moves. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/liquid-type/meta.json:10` |
| `assets/moments/marquee-row` | One row of client words, trades, cities or formats moves slowly sideways in a loop, fading at both edges; it pauses under the pointer and has a pause button. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/marquee-row/meta.json:16` |
| `assets/moments/photo-chapters` | A short story in three to five photographs, one large frame at a time: the section holds on screen while, under its h2, one photograph the width of the page is uncovered by the next from its foot upward, settling from a slight zoom, and a panel in the page's ground on the photograph's lower left changes to that chapter (its number, a title and two lines). Each chapter has about two thirds of a screen of scroll: the wipe takes under half of it and the photograph holds for the rest. Live at every width on a screen 600px or taller, phones included. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/photo-chapters/meta.json:16` |
| `assets/moments/picture-develops` | One large photograph develops once as it comes on screen. On a place, product or service page (look "film") it comes up out of the paper like a print in the developer tray: a faint grey print at first, its darks arriving before its light tones, then its colour, while it settles from a slight zoom, about 1.6 s. The halftone look ("print", a two-tone dot print in the page's ground and ink giving way to the photograph) is not dealt: tech leaves this moment out, so it is kept only as opts look "print". | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/picture-develops/meta.json:17` |
| `assets/moments/pinned-chapters` | A feature section holds on screen for two screens of scroll while its three steps open one at a time at the left and one frame at the right changes to each step's picture with a short crossfade. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/pinned-chapters/meta.json:18` |
| `assets/moments/window-parallax` | One wide photograph seen through a frame moves a little slower than the page, so the frame reads as a window onto a larger picture. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/window-parallax/meta.json:13` |
| `assets/moments/word-highlight` | One large statement rests at half ink (readable, about 4 to 1) and turns to ink word by word as it crosses the middle of the screen, a strong word to the accent; it runs back on the way up. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/word-highlight/meta.json:19` |
| `assets/moments/word-rotate` | One word of the headline changes every two seconds, sliding up out of its mask as the next rises in, underlined in the accent; three rounds, then it rests. | moment.js/css → moments loader/lib; copy/material needs, reduced/phone/retired соблюдать. | `assets/moments/word-rotate/meta.json:13` |
| `assets/motion` | Buttons (they step 1px up on hover, 2px on the large size, and press 1px down on click), arrows, links, the nav underline and menu, the current page, tabs, focus, cards, photographs, fields, switches, checks, numbers that tick once, and the cadence of the loops inside a card's panel. | CSS + DOM/WAAPI; global behavior, не fragment backend. | `assets/motion/meta.json:4` |
| `assets/objects/dither-sequence` | Two to six real photographs that belong together printed with an ordered dither in the page palette and played like a slow loop of film. Each cut is a dithered wipe on a slight diagonal with a one-cell accent line on its leading edge; a small pill counts the frames (or shows the captions given) on a segmented timeline. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/dither-sequence/meta.json:6` |
| `assets/objects/dot-object` | A real object rebuilt from dots. It is cut out of a photograph taken on a seamless plain ground (the ground, even a graded one, is modelled from the border; an object running off the edge is not taken for ground), or out of a cut-out PNG by its alpha. Each dot takes the photograph's tone where it sits, so the dots draw the form, not only the outline. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/dot-object/meta.json:6` |
| `assets/objects/exploded-layers` | A real photograph taken apart into four sheets standing in perspective: the photograph on top, a halftone screen in the accent, an ordered dither in the ink and a plate of tone contours at the bottom; the halftone and the dither are printed on clear sheets. Up to four photographs can go in, one per sheet. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/exploded-layers/meta.json:6` |
| `assets/objects/photo-dither` | A photograph printed whole as a three-colour grain of crisp square cells, like a riso print: the photograph's deepest colour, its most colourful one and the page's surface as paper (k-means over the photograph finds them), the tone spread over the photograph's own range and dithered as light by a blue-noise threshold (an even grain) or the 8 x 8 Bayer cross-hatch (retro). Its near-whites print as clean paper. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/photo-dither/meta.json:5` |
| `assets/objects/photo-engraving` | A photograph printed whole as an intaglio plate: engraved diagonal lines in the page's ink swell in the shadows, taper to hairlines in the light and bend over the forms, over a light wash of the photograph's own colour on the page's surface as paper. Parts lighter than the paper print as bare paper; a colour cast in the light parts is let go, so a white table stays white. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/photo-engraving/meta.json:5` |
| `assets/objects/photo-halftone` | A photograph printed whole as a one-ink halftone: round dots of the page's ink (or its accent, tint 1) on one 45 degree screen, on the page's surface as paper. Its own tone curve keeps a light photograph's near-whites as clean paper and its deepest shadows solid, with a dotted outline along the photograph's edges, so a pale object on a pale wall keeps its shape. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/photo-halftone/meta.json:5` |
| `assets/objects/print-cards` | A loose stack of playing cards, the ace of diamonds face up (an A and a small pip in two corners), the backs with a white border and a fine diamond lattice in the accent. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/print-cards/meta.json:6` |
| `assets/objects/print-cup` | A porcelain cup of coffee on its saucer: the glaze outside the cup in the accent, white porcelain inside and on the saucer. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/print-cup/meta.json:6` |
| `assets/objects/print-globe` | A desk globe: the Earth with its real coastlines on a tilted axis, a brass half meridian, a turned walnut stand. A blue or teal accent colours the sea; with any other accent the render keeps a deep ocean blue and a print puts the accent on the land. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/print-globe/meta.json:6` |
| `assets/objects/print-lamp` | A balanced-arm desk lamp: a heavy stepped base with a turret, two pairs of rods, two coil springs hooked to a crossbar, knuckle joints with chrome caps, and a domed shade with a vent cowl and a rolled rim. Base and shade in a clear-coated enamel in the accent, graphite rods, chrome springs. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/print-lamp/meta.json:6` |
| `assets/objects/print-wheel` | A road bicycle wheel: a black tread with tan sidewalls, an alloy rim with its valve, 24 spokes laced to a two-flange hub in the accent. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/print-wheel/meta.json:6` |
| `assets/objects/product-turntable` | A generic thing on a studio turntable with a degree scale, modelled in code (signed distance forms: a rangefinder camera, a wooden side chair, a cylindrical speaker or a glazed cup on its saucer) and printed in the page palette with an 8x8 ordered dither, one canvas pixel per dither cell. The camera is fitted to the form and the panel, so the platter is never cut. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/product-turntable/meta.json:6` |
| `assets/objects/split-reveal` | A real photograph split by a line: one side printed as an amplitude halftone screen in the page ink, the other the photograph itself. Dots near the seam take the photograph's own colour, so the print turns back into the picture as it reaches the line. | object.js → print core/scene/photo helpers; идентичность предмета и policy eligibility проверить. | `assets/objects/split-reveal/meta.json:6` |
| `assets/scenes/descend-through-weather` | The first screen sinks through a cloud deck onto the place below: a full-bleed photograph from above the weather stands behind a flat band of the page's ground across the foot, which carries the name, one line and the action; two layers of cloud rise at different speeds and the band leaves as the cloud reaches it; a wall of mist fills the frame for a breath while one short line rises through it; then the frame clears from the bottom, under a ceiling of cloud, onto the second photograph, where a two-line statement rises on a band at the foot. The cloud is drawn once from layered noise in the page's own mist tint. No word sits straight on a photograph. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/descend-through-weather/meta.json:5` |
| `assets/scenes/dot-becomes-the-full-stop` | One large dot drops onto the page's ground and the claim grows out of it to the left one whole word at a time, the first word right behind the drop; the dot steps right and a step smaller with every word until it is exactly the sentence's own full stop as the last word lands. An optional second beat cuts the ground to the inverse in one step and sets one supporting line under the claim. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/dot-becomes-the-full-stop/meta.json:5` |
| `assets/scenes/fixed-hero-object` | One product stays on its own layer and turns with the scroll while the page's first chapters pass beneath it: it opens as the hero with the title and the action in the clear half, glides to the other side as each chapter's copy and spec list rise where it was, and a chapter marked dark brings the inverse ground up behind it. The markup carries the object's still; the render draws over it only while the scene is live and near. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/fixed-hero-object/meta.json:5` |
| `assets/scenes/fly-into-the-shape` | The brand's own mark, a clean clip of its true shape with the next chapter's photograph already inside it and the chapter's title on its face, rises to the centre of the stage, turns to face you, and the camera flies into it: it grows about its inscribed circle until its edges rush past every side of the screen and the photograph fills the page; then a flat band of the page's ground rises across the foot with the chapter's title and its first sentence. The title on the face grows with the mark to its full size, never faster. The clip is a CSS clip-path in page pixels, never an SVG clipPath repainted each frame. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/fly-into-the-shape/meta.json:5` |
| `assets/scenes/letter-bar-floods-the-ground` | A statement of 2-4 words stands on one line at display size with one straight-stemmed letter (l or I) on the centre of the screen. The camera zooms on that letter until only its stem is left, a flat column of ink that widens to full bleed and becomes the next section's ground; the next statement arrives inside the column while the outgoing words' edges are still in frame. The stem is a solid column rasterised once at full size, never the glyph scaled up; the ground is one layer clipped by clip-path. The section after sits on the same ground, so there is no seam. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/letter-bar-floods-the-ground/meta.json:5` |
| `assets/scenes/letter-physics` | A bold claim stands readable on the inverse ground, breathes in and flies apart in 3D in one short burst: every letter leaves along its own line from the centre with spin and a little gravity, the middle letters rushing nearest the viewer, each gone before the screen's edge cuts it. While the last letters leave, the one-sentence answer is already coming out of depth, whole, and lands at the claim's size on the page's own ground; a photograph behind it comes up like a room's lights, dimmed to the ground under the words. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/letter-physics/meta.json:5` |
| `assets/scenes/object-through-giant-type` | A short quote stands in huge capitals filling the held stage. One object (a render from assets/objects or the client's cut-out photograph) falls down the wall: each line parts at its word gap and its halves open round the object's silhouette, wide enough that it never covers a letter, then close behind it, and each line turns from muted to full ink as the object reaches it. In the last line the object swells toward the camera, tips and falls away into the page, and the quote stands closed, in ink, with its credit. The markup carries the object's still; the render draws over it only while the scene is live and near. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/object-through-giant-type/meta.json:5` |
| `assets/scenes/parts-lock-into-the-whole` | The stage opens on one huge word alone (a year, a figure, a name). It steps back into its place in the product's own interface while the interface's panels fly in from the four edges and lock into one whole screen; then layers of detail ink in one by one (the data, the team's comments, an agent's edit), and the finished screen steps aside into a column at least 580px wide beside the heading and a short spec list. No caption under the screen. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/parts-lock-into-the-whole/meta.json:5` |
| `assets/scenes/powers-of-ten-pullback` | The stage opens on the product's own interface filling the whole screen. The camera pulls back at a steady rate (the scale eased in log space, so it never seems to stop) until the interface is the screen of a device standing on the page's lit ground; the device settles into its slot at the right and the heading, copy and action arrive at the left. A product section under the hero, never the hero itself: its first screen carries no heading and no action. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/powers-of-ten-pullback/meta.json:5` |
| `assets/scenes/product-assembles-into-its-action` | The product's own working screen builds itself in the order of its story while the page is held: it opens on its first rows with its box only as tall as what it holds, each step slides the next part in from the foot of the screen with the newest rows in the accent for a beat and the step's caption taking the ink in the list beside it; then the rows fold back into the one action, nearest first, the screen's box closes round the action and goes, and the action stands alone, larger, with its state beside it and one closing line centred under it. The action stays a real button. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/product-assembles-into-its-action/meta.json:5` |
| `assets/scenes/shaped-window-over-fixed-world` | One full-bleed photograph of the client's site stays still behind a shutter painted in the page's ground. Two tall windows cut in it, level and side by side, show the site through a mullion under the title; the scroll widens them outward, closes the bar into one window, holds a beat, then scales the shutter past the screen's edges so the reader pushes through into the place; a flat band of the ground rises across the foot carrying the chapter's one word, then its lede and the action. The shutter is five flat pieces moved by transform: no mask edge, no hairline, no word on the photograph. | scene.js/css → scenes/lib/print; нужна точная структура story, материалы владельца и cleanup. | `assets/scenes/shaped-window-over-fixed-world/meta.json:5` |
| `assets/ui/apps` | Fourteen real app marks (in their own colours on light tiles) in a 5 x 3 field around the product's own mark, each joined to it by a hairline. In turn one app connects: its line lights and runs, its tile takes the accent ring and its name appears. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/apps/meta.json:4` |
| `assets/ui/calendar` | A month with one dated range and, under it, the dates that matter as rows (date tile, title, one line). The pointer sets the range; each row lights up as its day is reached. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/calendar/meta.json:4` |
| `assets/ui/chat` | An assistant window: a customer's question, then an answer written word by word with the two sources it used (a real app icon and a help article) the customer's thanks and an input. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/chat/meta.json:4` |
| `assets/ui/checklist` | A titled list of five steps with a progress bar; the next step ticks (the check draws, the label is struck) until all are done. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/checklist/meta.json:4` |
| `assets/ui/code` | An editor pane with two tabs, eight lines of code, one highlighted line and a one-line note on the change below. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/code/meta.json:4` |
| `assets/ui/cursor` | A drafted reply waiting for approval: the text, the action it carries (a refund with its amount) and two buttons. The pointer glides to the main button and clicks; it spins, then reads Sent and the status turns Sent. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/cursor/meta.json:4` |
| `assets/ui/diff-review` | One file of a pull request: the file path with its real TypeScript mark and its +/- counts, a hunk header, fourteen lines of a unified diff (removed lines red, added green, old and new line numbers in the gutter) and a reviewer's one-line suggestion under the line it is about, naming the change. The Apply button steps and is pressed: that line becomes a removed line with the suggested line added under it, the counts update and an Applied status takes the button's place. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/diff-review/meta.json:4` |
| `assets/ui/doc` | A page of a document (here a returns policy) with marked phrases and a note beside the current one: what kind of issue, what is wrong, where else it appears. Runs off the panel's bottom edge. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/doc/meta.json:4` |
| `assets/ui/files` | A status pill over a grid of file tiles, each with its app's real mark (Zendesk, Notion, Google Docs, Confluence, Markdown) or a plain file glyph (PDF), a name and its app. Each tile is read in turn and gets a check. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/files/meta.json:4` |
| `assets/ui/integrations` | A list of apps with their real marks (in their own colours on light tiles), what each does and its state; the pointer connects one. The default for any card about integrations. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/integrations/meta.json:4` |
| `assets/ui/notify` | Three notifications (the assistant handing over, a person taking over, a count) with avatars and times; a new one slides in on top and the oldest leaves. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/notify/meta.json:4` |
| `assets/ui/pipeline-board` | A CI run: repo, branch and run number, a total time and a status chip; the commit it runs for with a Cancel button; five steps on a rail (checkout, install, test, build, deploy), each with the real mark of its tool (Git, npm, Node.js, Docker, Kubernetes) on a light tile: done steps with an ink-outlined check and their time, the running step with a turning accent ring and a bar, the waiting steps muted. The running step moves down to the end, the run passes (the chip takes an ink check, the total stands in bold), Re-run is pressed and the board goes straight back to the picture it began on. Wide (680px or more of its own width) the steps are a row of bordered nodes with their times, and the running step's commands and log under them. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/pipeline-board/meta.json:4` |
| `assets/ui/search` | A command bar: the query types in, three results with the matches in bold, the selection steps down, keyboard hints at the foot. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/search/meta.json:4` |
| `assets/ui/slider` | A design tool's property card: an icon, a name, two sliders with values and a three-way switch. The first thumb glides between values; with opts.drive it also changes the effect ground it sits on (Figma's Texture tile). | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/slider/meta.json:4` |
| `assets/ui/stat` | A dashboard card: a label and a period, one big number with its change, and 14 daily bars (the last in the accent). The bars fall back to the period before and rise to this one; the number stays on this period, so it matches the copy beside it. With opts.window the bars are cut out of the card, so the effect ground shows through them. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/stat/meta.json:4` |
| `assets/ui/terminal-run` | A terminal pane (the repo, the shell, the branch): a command at the prompt, then a thin meter, one line per test file with its count and time, a blank row, a two-line summary and a status line with a green check and the run's duration; a fresh prompt waits under it with the caret. The command is typed again and run: each file's line arrives running (a spinner), then ticks, and the output streams in. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/terminal-run/meta.json:4` |
| `assets/ui/toggles` | A titled list of four rules, each a label, a grey line and a switch; one switch flips at a time (the changed row takes the accent) and the count follows. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/toggles/meta.json:4` |
| `assets/ui/voice` | A call card: a status and timer, the assistant's orb, who is talking, captions that light up word by word, and a bar with mute, a waveform and end call. On a dark surface the orb is a live effect (orb-sphere: a pale nebula with specks of light); on a light one a pearl drawn in CSS, with clouds of the accent and the ink turning slowly inside it and a few specks of light. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/voice/meta.json:4` |
| `assets/ui/window` | A product window: window dots, a breadcrumb with the app's real icon, search; a sidebar with counts; a list of conversations with people, subjects, status and age. The assistant takes each open row: Working, then Replied. | HTML/CSS/fragment.js → ui.js; переписать markup/data-state, конечное состояние + одна loop на группу. | `assets/ui/window/meta.json:4` |

## Приложение B. Все физические папки области (direct file counts)

Здесь `full` — только файл, реально прочитанный целиком; `classified` — структурные данные/SVG, не просмотр картинки/каждой строки; `unread` — явный semantic gap. Direct counts не суммируют вложенные папки повторно.

| Папка | Файлов непосредственно | Статусное покрытие |
|---|---:|---|
| `assets` | 3 | full=2, partial=1 |
| `assets/backgrounds` | 7 | classified=1, full=1, unread=5 |
| `assets/components` | 4 | unread=4 |
| `assets/components/fx-avatar` | 4 | full=2, unread=2 |
| `assets/components/fx-band` | 4 | full=3, unread=1 |
| `assets/components/fx-bars` | 4 | full=3, unread=1 |
| `assets/components/fx-button` | 4 | full=3, unread=1 |
| `assets/components/fx-chart` | 4 | full=2, unread=2 |
| `assets/components/fx-dither-object` | 4 | full=3, unread=1 |
| `assets/components/fx-feature-card` | 4 | full=1, unread=3 |
| `assets/components/fx-globe` | 4 | full=4 |
| `assets/components/fx-headline` | 4 | full=4 |
| `assets/components/fx-icon-tiles` | 4 | full=4 |
| `assets/components/fx-logos` | 4 | full=3, unread=1 |
| `assets/components/fx-map` | 6 | classified=1, full=2, unread=3 |
| `assets/components/fx-photo` | 5 | full=4, metadata-only=1 |
| `assets/components/fx-pricing` | 4 | full=3, unread=1 |
| `assets/components/fx-progress` | 4 | full=2, unread=2 |
| `assets/components/fx-prompt` | 4 | full=3, unread=1 |
| `assets/components/fx-search` | 4 | full=2, unread=2 |
| `assets/components/fx-spotlight` | 4 | full=3, unread=1 |
| `assets/components/fx-stat` | 4 | full=4 |
| `assets/components/fx-tabs` | 4 | full=1, unread=3 |
| `assets/diagrams` | 6 | classified=1, full=1, partial=1, unread=3 |
| `assets/effects` | 6 | classified=1, full=2, partial=1, unread=2 |
| `assets/effects/ascii-shade` | 2 | full=1, partial=1 |
| `assets/effects/aurora-curtains` | 2 | full=1, partial=1 |
| `assets/effects/bayer-dither` | 2 | full=2 |
| `assets/effects/caustics` | 2 | full=1, partial=1 |
| `assets/effects/contour-lines` | 2 | full=1, partial=1 |
| `assets/effects/dot-terrain` | 2 | full=1, partial=1 |
| `assets/effects/dotted-globe` | 2 | full=1, partial=1 |
| `assets/effects/duotone-grade` | 2 | full=1, partial=1 |
| `assets/effects/edge-glow` | 2 | full=1, partial=1 |
| `assets/effects/film-light-leak` | 2 | full=1, partial=1 |
| `assets/effects/fluted-glass` | 2 | full=1, partial=1 |
| `assets/effects/god-rays` | 2 | full=1, partial=1 |
| `assets/effects/gradient-mesh` | 2 | full=1, partial=1 |
| `assets/effects/grain-gradient` | 2 | full=1, partial=1 |
| `assets/effects/grid-pulse` | 2 | full=1, partial=1 |
| `assets/effects/halftone-screen` | 2 | full=1, partial=1 |
| `assets/effects/line-engraving` | 2 | full=1, partial=1 |
| `assets/effects/orb-sphere` | 2 | full=1, partial=1 |
| `assets/effects/painterly-landscape` | 2 | full=1, partial=1 |
| `assets/effects/prism-dispersion` | 2 | full=1, partial=1 |
| `assets/effects/ridgeline` | 2 | full=1, partial=1 |
| `assets/effects/ruled-grounds` | 2 | full=1, partial=1 |
| `assets/effects/silk-folds` | 2 | full=1, partial=1 |
| `assets/effects/soft-light-bars` | 2 | full=1, partial=1 |
| `assets/effects/spotlight-cone` | 2 | full=1, partial=1 |
| `assets/icons` | 3 | classified=1, unread=2 |
| `assets/icons/demo` | 929 | classified=929 |
| `assets/layout` | 19 | classified=1, full=2, unread=16 |
| `assets/layout/img` | 22 | classified=1, metadata-only=21 |
| `assets/moments` | 4 | classified=1, full=1, unread=2 |
| `assets/moments/_demo` | 13 | classified=1, full=1, metadata-only=8, unread=3 |
| `assets/moments/closing-lift` | 4 | full=2, unread=2 |
| `assets/moments/counter-rolls` | 4 | full=2, unread=2 |
| `assets/moments/cursor-spotlight` | 4 | full=3, unread=1 |
| `assets/moments/giant-type-pass` | 4 | full=3, unread=1 |
| `assets/moments/headline-arrives` | 4 | full=2, unread=2 |
| `assets/moments/iris-opens` | 4 | full=2, unread=2 |
| `assets/moments/letters-assemble` | 4 | full=2, unread=2 |
| `assets/moments/line-carries-colour` | 4 | full=2, unread=2 |
| `assets/moments/lines-rise` | 4 | full=2, unread=2 |
| `assets/moments/liquid-hover` | 4 | full=2, unread=2 |
| `assets/moments/liquid-type` | 4 | full=2, unread=2 |
| `assets/moments/marquee-row` | 4 | full=3, unread=1 |
| `assets/moments/photo-chapters` | 4 | full=1, unread=3 |
| `assets/moments/picture-develops` | 5 | full=2, unread=3 |
| `assets/moments/pinned-chapters` | 4 | full=1, unread=3 |
| `assets/moments/window-parallax` | 4 | full=3, unread=1 |
| `assets/moments/word-highlight` | 4 | full=3, unread=1 |
| `assets/moments/word-rotate` | 4 | full=3, unread=1 |
| `assets/motion` | 5 | full=2, partial=1, unread=2 |
| `assets/objects` | 1 | unread=1 |
| `assets/objects/_print-core` | 10 | classified=1, full=2, partial=1, unread=6 |
| `assets/objects/_scenes` | 7 | classified=1, full=2, unread=4 |
| `assets/objects/dither-sequence` | 3 | full=2, unread=1 |
| `assets/objects/dot-object` | 3 | full=2, unread=1 |
| `assets/objects/exploded-layers` | 3 | full=2, unread=1 |
| `assets/objects/photo-dither` | 3 | full=2, unread=1 |
| `assets/objects/photo-engraving` | 3 | full=2, unread=1 |
| `assets/objects/photo-halftone` | 3 | full=2, unread=1 |
| `assets/objects/photo-kit` | 5 | classified=1, full=1, unread=3 |
| `assets/objects/photo-kit/photos` | 4 | metadata-only=4 |
| `assets/objects/print-cards` | 7 | full=2, metadata-only=4, unread=1 |
| `assets/objects/print-cup` | 7 | full=3, metadata-only=4 |
| `assets/objects/print-globe` | 12 | classified=1, full=2, metadata-only=8, unread=1 |
| `assets/objects/print-lamp` | 7 | full=2, metadata-only=4, unread=1 |
| `assets/objects/print-wheel` | 7 | full=3, metadata-only=4 |
| `assets/objects/product-render` | 7 | full=1, partial=1, unread=5 |
| `assets/objects/product-render/specs` | 15 | classified=3, metadata-only=12 |
| `assets/objects/product-turntable` | 12 | full=3, metadata-only=8, unread=1 |
| `assets/objects/split-reveal` | 3 | full=2, unread=1 |
| `assets/photos` | 1 | classified=1 |
| `assets/photos/img` | 66 | metadata-only=66 |
| `assets/scenes` | 5 | classified=1, full=2, unread=2 |
| `assets/scenes/_demo` | 12 | classified=1, full=1, metadata-only=7, unread=3 |
| `assets/scenes/descend-through-weather` | 4 | full=1, unread=3 |
| `assets/scenes/dot-becomes-the-full-stop` | 4 | full=1, unread=3 |
| `assets/scenes/fixed-hero-object` | 4 | full=1, unread=3 |
| `assets/scenes/fly-into-the-shape` | 4 | full=1, unread=3 |
| `assets/scenes/letter-bar-floods-the-ground` | 4 | full=1, unread=3 |
| `assets/scenes/letter-physics` | 4 | full=1, unread=3 |
| `assets/scenes/object-through-giant-type` | 4 | full=1, unread=3 |
| `assets/scenes/parts-lock-into-the-whole` | 4 | full=1, unread=3 |
| `assets/scenes/powers-of-ten-pullback` | 4 | full=1, unread=3 |
| `assets/scenes/product-assembles-into-its-action` | 4 | full=1, unread=3 |
| `assets/scenes/shaped-window-over-fixed-world` | 4 | full=1, unread=3 |
| `assets/ui` | 6 | classified=1, full=1, partial=1, unread=3 |
| `assets/ui/_lab` | 4 | full=1, unread=3 |
| `assets/ui/apps` | 4 | full=3, unread=1 |
| `assets/ui/calendar` | 4 | full=2, unread=2 |
| `assets/ui/chat` | 4 | full=2, unread=2 |
| `assets/ui/checklist` | 4 | full=4 |
| `assets/ui/code` | 4 | full=3, unread=1 |
| `assets/ui/cursor` | 4 | full=4 |
| `assets/ui/diff-review` | 4 | full=2, unread=2 |
| `assets/ui/doc` | 4 | full=4 |
| `assets/ui/files` | 4 | full=2, unread=2 |
| `assets/ui/icons` | 31 | classified=31 |
| `assets/ui/integrations` | 4 | full=4 |
| `assets/ui/notify` | 4 | full=4 |
| `assets/ui/pipeline-board` | 4 | full=1, unread=3 |
| `assets/ui/search` | 4 | full=3, unread=1 |
| `assets/ui/slider` | 4 | full=3, unread=1 |
| `assets/ui/stat` | 4 | full=3, unread=1 |
| `assets/ui/terminal-run` | 4 | full=1, unread=3 |
| `assets/ui/toggles` | 4 | full=4 |
| `assets/ui/voice` | 4 | full=3, unread=1 |
| `assets/ui/window` | 4 | full=2, unread=2 |
| `library` | 2 | classified=2 |
