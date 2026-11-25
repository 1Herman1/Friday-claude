# Taste: content, workflow и runtime — TASTE 1/2

## Вердикт и граница достоверности

**Taste сохраняется в recommended stack как источник copy methodology, предметных рецептов композиции, медиаподготовки и browser-QA. Не рекомендуется безусловно переносить его house policy, устанавливать глобальный Stop hook или заменять Friday design-system.** Ценность здесь не в «ещё трёх dials», а в операционном пути от фактов и вопросов покупателя до текста, visual slots, нескольких viewport, явных пропусков и списка открытых дефектов.

**Это содержательный, но ещё НЕ полный аудит назначенного runtime:** в `taste-content-runtime-coverage.json` 50 назначенных текстовых файлов: 49 full, 1 partial. Полностью прочитаны SKILL, все 22 references, installer, три manifests, README/changelog/license, три tests, workflow, examples credits, 9 из 10 `.mjs` в `scripts/` и обе HTML runtime templates. Не полностью прочитан уникальный `scripts/consistency.mjs` (11 485 строк, около 1 MB): просмотрены 1–530, 4535–4714, 11180–11485; внутренние реализации остальных проверок остаются незакрытыми. Описание этих проверок ниже основано на прочитанном контракте, references и orchestration, а не на заявлении о полном аудите каждой реализации. До дочитывания нельзя объявлять весь Taste PASS или «runtime полностью безопасен».

Область asset/library families — другой Taste worker. Здесь разобраны **интерфейсы потребления** этих данных, но не дублируется полный каталог shader/object/UI/photo families. Четыре бинарных examples не открывались, их эстетическое качество не оценено. `examples/v2/CREDITS.md` прочитан.

- Snapshot: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/taste`, SHA **d1a2bb41d927083ac7118f60cfc9cdf711810ea0**.
- Friday: `/Users/germanbryzgalov/Friday-claude`, baseline HEAD из brief **388ec708f39583172d7f36110f6424cc175b5512**; сравнение учитывает текущие dirty MD/TOML.
- Ни один upstream installer/script/test/hook не запускался. Не было npm install, запуска браузера, генерации или изменения сайтов. Проверки ниже — статический анализ и чтение git history. Предложенные regression tests **не выполнены**.
- README и manifests называют 2.5.1; заголовок SKILL ещё `tasteskill 2.5` (`SKILL.md:4,22`). Сравнение привязано к SHA, не к этому заголовку.

Пути Taste далее относительно snapshot; `references/`, `scripts/`, `assets/`, `library/` — внутри `skills/taste-skill/`. Пути Friday явно отмечены.

## 1. Entry point и практический E2E

`SKILL.md:3–13` — один широкий автоматически релевантный frontend skill `design-taste-frontend`: build/design/redesign/restyle/polish/review company, product, shop, hospitality, SaaS, AI, devtool и game sites, static HTML либо существующий React/Next/Vue/Svelte/Astro/Tailwind. Это **не** полный комплект старых Taste variants: README:160–175 отправляет classics, включая v1/v2-experimental, в `taste-skill-classics`, image-generation — в отдельный репозиторий.

`SKILL.md:158–296` задаёт не только абстрактные эстетические советы:

1. **Вход:** brief, тип бизнеса, покупатель, одна транзакция, логотип/экран/фото/цены/адрес/часы (`166–177`). Для существующего проекта — его стек; для пустого — копия assets + starter. Next.js предписан static export (`160–164`), что не является универсальным правилом Friday.
2. **Copy до кода:** fact sheet → voice card → регистр → текст → проверяемые CTA; имя ищется, допущения отмечаются `data-assumed`, сохранённый текст можно lint как `.md` (`179–186`).
3. **План:** строка типа, строка выбранных palette/type/hero/etc, затем для каждой section идея, visual и его роль, число экранов, motion и его смысл (`188–194`). Это связывает art direction с реальным контентом.
4. **Deal:** hero по материалу и page type; palette/type по kind/trade; моменты по fits/photo/WebGL budget; история снижает повторение; результаты записываются в план и comment (`196–228`). Не просто «выбрать красивое».
5. **Сборка:** starter head/lang/metas/skip link, только section выбранного hero, адаптация fragment под клиента, icons scan последним, реальные files + credits (`230–248`). Компоненты монтируются по контрактам, а не переписываются случайно.
6. **Выход QA:** copy-lint, consistency на пяти ширинах, layout stress, shoot, perf; реальный просмотр каждого screenshot; fix rounds и gate (`250–289`). Полный QA и gate — разные запуски: gate использует quick subset.
7. **Отчёт:** `GATE:` status, waivers/open FAIL, deal, voice card, WARN с объяснением, checker/perf, not checked, assumed facts, missing photos и каждый stand-in (`291–296`).

**Ошибки не маскируются одним «готово»:** OFF, SETUP, ERROR, QUICK, OPEN и DONE — отдельные состояния. Но сам upstream разрешает завершать с OPEN после трёх rounds и с ERROR/OFF (`278–285`); Friday должен переводить их в собственный blocked/incomplete, а не в зелёную приёмку.

## 2. Что реально содержится в references

### 2.1 Copy/voice — главный методологический delta

- `references/copy.md:34–56`: h1 называет категорию, покупателя/место; один проверяемый факт на первом экране; headings называют предмет, buttons — действие + объект; одинаковое wording одной транзакции. Это конкретная редакторская механика, не просьба «пиши живо».
- `copy-voice.md:31–60`: fact sheet с альтернативой клиента, доказанным отличием, словами покупателей, источниками цифр, реальными людьми/деталями, ограничением и оффером. Пустое поле уменьшает/удаляет секцию, а не заполняется фантазией. Для отдельного copy-запроса допускает до шести полезных вопросов; build на тонком brief не блокируется автоматически.
- `copy-voice.md:62–90`: **voice card** (register, противопоставленные свойства, person, длина предложений, humour, house words, never). Voice стабилен, tone в prices/FAQ/forms становится фактическим; реальный голос клиента приоритетнее меню регистров.
- `copy-registers.md:17–131`: 12 регистров с примером, moves, fit и failure mode: facts only; technical dry/proof; founder letter; self-aware/playful; literary/formal; proper nouns/restraint; sensory literal; historical scene; activist/measured; refusal/narrowness; product-as-subject; hurried/conversational. `133–154` — стартовая trade→register таблица, не обязательный бренд-генератор.
- `copy-moves.md:8–138`: положительные формы для hero, headings, about/story, mechanisms, proof, plain-zone prices/FAQ, CTA/close, errors/empty/404/confirmation и footer. Примеры сочинены для файла; учиться приёму, не копировать строку (`3–6`). Чужой quote — дословно и с attribution; zero testimonials — допустимый результат (`81–90`).
- `copy-voice.md:92–110`: структура следует вопросам reader и awareness stage; количество cards/quotes/plans следует материалу, а не шаблону. `134–155` — budget риторических приёмов, а не запрет любой выразительности.
- `copy-tells.md:18–103`: помимо старого seamless/unlock ловит новую «аккуратную AI-копию»: один тёплый ироничный голос для всех, invented specificity, повтор X.Y., figures strip, virtue words, default cast, одинаковые origins, одинаковые paragraph arcs, unwritten microcopy. Особенно полезен блок **over-correction** (`105–118`): запрет порождает заменяющий шаблон; контролировать причину, не заменять синонимами.
- `copy-voice.md:157–176`: rival-name substitution test, cross-page sameness, read-aloud, counter-overcorrection, fresh-reader test. Fresh reader — необязательный метод upstream, не инструкция этому конечному специалисту делегировать.
- `copy.md:108–178` отделяет факты от placeholders и неподтверждённых proof; но разрешает придумать имя и **plausible prices/hours для place**, запрещает на самой странице sample notes, captions и контакты реального формата. Это уже house policy; не переносить как integrity стандарт Friday.

**Friday уже имеет:** marketing-agent читает brand/project и отказывается выдумывать рынок (`.codex/agents/marketing/marketing-agent.md:39–65`), запрещает русские штампы с positive examples (`45–59`); design-lint имеет marketing-filler (`.codex/scripts/design-lint.mjs:98–102`). Поэтому «запрет AI слов» не новый вклад. **Частичный/отсутствующий в осмотренной области delta:** единый source-backed fact sheet, voice card + registers/failure modes, device budget, cross-page sameness, контент всех состояний, claim→proof mapping. Поиск сделан по core docs, skills, commands и marketing roles, не только по слову Taste; глобальное отсутствие по всему репозиторию не заявляется.

### 2.2 Type/layout/system

- `references/system.md:10–102`: base/reset, rhythm/type/color/radius/button tokens и типографические роли; `104–194`: navigation, phone actionbar, footer, cards/lists/forms; `195–230`: access/head/motion. Это системная HTML/CSS база, а не только каталог красивых примеров. Формы и head входят в acceptance, не оставляются «за дизайном».
- `layout-v4.md:22–96`: section screens и пространство с учётом fixed header/actionbar; короткие/длинные секции — 1H/2H, особый live photo-chapters. Это сильное ограничение конкретной house-композиции.
- `layout-v4.md:98–205`: hero geometry, допустимые расположения изображения и CTA внутри fold; 11 hero recipes по материалу, отдельный place hero, tablet/phone ограничения. Нужный момент — **stress hero с максимальной длиной текста**, а не только проверить красивый короткий пример (`275–297`, hero-maxchars/hero-lines).
- `layout-v4.md:211–244`: общие L/R edges, grid/split pair, top alignment, единый ratio system.
- `layout-v4.md:246–273`: роли display/text/mono, Google Fonts exact link, веса/оси/stretch/tracking, at most two families/four files, шкала desktop/mobile. Dealer `--axis` нужен под word/editorial hero. Кириллица сама по себе не гарантируется этим контрактом; Friday уже явно требует её проверки.
- `backgrounds.md:7–111`: базовый фон/surface/inverse, off-tech flat grounds и tech CSS/code-drawn grounds. Нельзя читать это как разрешение добавить mesh на любой сайт.

**Already equivalent/partial Friday:** `docs/core/design-principles.md:21–45,88–116`, `/design-system` (`.codex/commands/design-system.md:14–56`) уже фиксируют reference extraction, домен, dials, role-based contrast pairs, точные шрифты/motion/spacing и MASTER/page overrides; `51–53` защищает существующую систему от перезаписи. Taste даёт более конкретные recipes и browser stress, но не приносит Friday «дизайн-систему с нуля». Friday typography pairs/кириллица и brand-first должны сохраняться.

### 2.3 Sections и визуальная аргументация

- `references/sections.md:7–112`: планирование экранов, выбор варианта по материалу и согласование структурных комбинаций. `113–291`: разные планы software/game/product/service. Software показывает **app-frame**, а не только рекламную карточку; game — свою art/setting, product — сам предмет/parts/use, service — услуги и доказательства, не fake SaaS pricing.
- `sections.md:292–618`: place не переодевается в SaaS: offer/menu/rooms, visit и фактические часы, фотокомпозиции, порядок по trade; число доступных фотографий задаёт short/full plan. Под восемь после реального поиска — short page; не растягивать бедный материал бессмысленными секциями.
- `sections-library.md:7–1120` — библиотека рецептов **job/use → desktop geometry → tablet/phone → copy → visual/motion → mistakes**, а не список названий. Navigation mega/cards/centre/split (`51–148`), hero index (`151+`), proof/logo-row/quote-stat/customer rows (`182–247`), features-2x2/bento/split/tour/chapter/app-frame/steps (`250–534`), далее фотографии/rooms/services/people, pricing/FAQ/close/footer. Рецепты полезны как implementation rubric; sample names/metrics не факты клиента.
- `cards.md:23–74,152–225`: card → panel → rewritten UI fragment, не три вложенные рамки; фиксированная панель, контролируемый crop на краю, исходная UI hierarchy и lit ground. `226–269`: один играющий fragment в группе, остальные still/hover, pause и ограничения GPU.
- `diagrams.md:8–88`: diagram для процесса/отношений, fragment для настоящего экрана; preset/layout и клиентские labels; общий resolver иконок; цикл движения показывает процесс, а не декоративный glow.

**Сравнение:** Friday domain profiles уже разделяют e-commerce/SaaS/dashboard, требуют реальные visual/trust и разрешают dense layouts (`docs/core/design-profiles.md:19–68`); preflight уже запрещает одинаковые feature cards и проверяет реальные visuals (`.codex/commands/preflight.md:14–24`). Delta — не «запрет трёх карточек», а **контентный рецепт с входными материалами, адаптивом и typical failures**. Не переносить всю library без asset-worker оценки.

### 2.4 Фото и provenance

`references/photos.md:7–55` задаёт client-first + `data-source`/`data-subject`, detail-only curated library cap 1/3, draft exception, shot list реальных недостающих фотографий. `57–104`: product без фото — stand-in того же предметного класса, game без art — setting; full-size visual review обязателен, чужой логотип/команда/room не должны выдаваться за клиента. Это существенно сильнее «возьми Unsplash».

`photos.md:106–172`: pick→search→fetch→markup→credits; trade/craft/place/motif/quality/recent фильтры; недостаток подходящих frames объясняется, не маскируется. `174–236`: один visual world, одинаковая light/grade, ratio/subject focus, desktop/phone crop, responsive srcset/sizes, lazy/eager, byte cap и отсутствие пустого кадра. `238–248`: credit list с авторами/licence/source/adapted на собственной странице и одна footer-ссылка.

**Useful delta Friday:** machine-readable provenance, shot/slot replacement list, per-width crop/byte budget и отсутствие «красивая, но не та вещь». **Already partial:** текущий dirty handoff у taste-curator уже требует MASTER/UI-kit, отдельные scene/product/label originals, permission до vision, явный original просмотр и owner gate (`.codex/agents/design/taste-curator.md:20–33,50–77,111–116`). Не объявлять эту цепочку отсутствующей.

**Конфликт:** Taste запрещает AI images и добавляет stock stand-ins без sample note на самой странице (`photos.md:65–70,99–104,250–263`); Friday image route — отдельный native-image/approval workflow в dirty Nullume/handoff. Это разные режимы. Нельзя автоматически заменять identity-critical product клиента чужим stand-in либо публиковать такой draft. Лицензия на web-use также не доказывает AI-input permission.

### 2.5 Motion/effects/objects/scenes

- `motion.md:15–47`: обязательные hero entrance + dealt moment + hover/press на **каждом** kind. Остальное off-tech стоит. Это эстетическая система с числами, не общий стандарт доступности.
- `motion.md:49–89`: 150/120/90 ms hover/out/press, 2px card lift, 1.02–1.03 photo zoom, instant focus ring, one underline, no overshoot, fine-pointer only; keyboard/tap альтернативы.
- `motion.md:91–126`: hero line masks, fallback 700 ms timeout, no-script/reduced-motion/print читаемы; headless показывает завершённый state, если нет `data-motion="live"`.
- `motion.md:128–218`: короткие loops, pause после 5 s, fixed finished frames, один timed loop (исключения оговорены), native scroll и scoped sticky moments; no general reveals/parallax/smooth-scroll. На телефоне тяжёлое — still, лёгкие photo/type moments могут работать.
- `moments.md:39–127,167–214`: seeded dealing, place/product/service photo/type subset, tech budget/excludes, fixed final still/no-script/phone; mounting с конкретными data markers и check command.
- `effects-usage.md:10–133`: type→effect eligibility, one-effect/scene budget, effect не подменяет subject, deal с palette/slot/family/seed/history. `effects-creative.md:15–61,180–245`: применимость конкретных techniques и их стоимость, не разрешение на эффект во всяком месте.
- `effects-objects.md:13–53,78–275`: объекты и spec-driven product render, views/scene/materials/colourways/posters; render только при запросе 3D, не произвольный заменитель фотографии. `277–298`: live GPU budget и запреты.
- `scenes.md:8–52,54–115`: scene только tech/gaming/software/technical subject, native sticky section, hold/rest height, staged mounting, finished fallback при reduced motion/no script/module failure. Не распространять big award-site сцены на checkout.
- `perf.md:3–32`: конкретные budget rows и метод измерения; median нескольких loads, timing при WebGL-off — proxy, не GPU verdict; no FPS/soak. `34–46`: rendering каждого visual, image/font optimisation.

**Friday уже имеет** purpose/frequency gate, easing/durations, transform/opacity, reduced motion, interruption/choreography и no blanket will-change (`docs/core/motion.md:12–24,26–103,140–175`). **Conflict:** Friday допускает high-M stagger/reveal (`66–70`), выключает loops offscreen (`145–146`) и не требует animation на каждой странице. Taste запрещает reveals вне своих moments и требует entrance/moment всегда, некоторые loops держит по clock from load (`motion.md:182–204`). Не заменять один контракт другим без domain-specific opt-in.

## 3. Script dependency map и side effects

Runtime преимущественно Node built-ins. Browser tools используют встроенный WebSocket/CDP, не npm Playwright. **Исключение dependency тестов:** frontmatter требует npm `yaml`; это test dependency, не runtime skill. ffmpeg — опциональный executable. Network нужны Commons, icon CDNs, Google Fonts, иногда внешние карты; «без API keys» не означает offline или без third-party calls.

```text
SKILL.md / frontend task
 ├─ gate.mjs --start ──────────────> .taste-skill/build.json + gate state
 ├─ start.mjs deal/css/brand
 │   ├─ library/palettes.json + library/type.json
 │   ├─ assets/effects/fx.js : color helper
 │   └─ project history / optional TASTE_SKILL_RECENT / build marker
 ├─ assets/layout/deal.mjs ────────> heroes.json + history      [asset-worker]
 ├─ photos.mjs
 │   ├─ assets/photos/photos.json + bundled img/*
 │   ├─ Commons search API -> .taste-skill/found.json
 │   ├─ picsum/Commons image fetch -> assets/img/* + credits.json
 │   └─ optional ffmpeg -> WebP/mobile crop; credits -> credits.html
 ├─ icons.mjs
 │   ├─ assets/icons/index.json; assets/diagrams/presets.json for scan
 │   ├─ pinned jsDelivr/GitHub icon sources -> cache
 │   └─ local SVGs + credits; check/proof may update skill index
 ├─ moments.mjs
 │   ├─ assets/moments/index.json + assets/scenes/index.json
 │   ├─ seed/history/context-aware picks
 │   └─ index/shot/check -> indexes, browser artifacts, checks
 ├─ effects.mjs
 │   ├─ assets/effects/pick.js + moments.mjs:pageKind
 │   ├─ effect metadata/modules + palettes + fx-{gallery,lab}.template.html
 │   └─ index/gallery/lab/publish/shot/check -> skill files or chosen output
 ├─ copy-lint.mjs -> static findings JSON/text, exit status
 ├─ consistency.mjs -> local HTTP + Chrome/CDP + report/rendered.html/crops
 │   ├─ moments index; effects source scan; inline check modules
 │   └─ images/GLSL/fallback/keyboard/motion/phone probes (middle not fully read)
 ├─ assets/layout/check.mjs ───────> independent layout stress [asset-worker]
 ├─ shoot.mjs -> HTTP + Chrome/CDP + PNG + per-section tiles/manifest
 ├─ perf.mjs -> HTTP + Chrome/CDP + medians/budgets/optional JSON
 └─ gate.mjs
     ├─ spawn consistency --quick (1440/390 + narrow)
     ├─ spawn assets/layout/check (1440x900,390x844)
     ├─ spawn copy-lint on file or rendered.html
     ├─ kit-edited / checker-gaming static tests
     └─ waivers/rounds/session/block state -> manual exit or hook JSON
```

### Интерфейсы, выходы и ошибки

| Entry point | Вход → механизм → выход | Зависимости, writes и ограничения |
|---|---|---|
| `start.mjs:1–49,54–98,196–242,388–470` | kind/trade + material → eligibility/weighted anti-repetition → три palette/type кандидата, CSS variables/Google link либо brand-derived CSS | `Math.random`, **не весь run seeded**; JSON history, optional cross-folder recent; deal автоматически arm/join build marker; css/brand не arm. Unknown kind/palette/type — stderr/nonzero. Не безопасный «просто распечатать список» для deal. |
| `copy-lint.mjs:1–31,50–186,189–463` | HTML/MD/TXT/folder + kind/year → читает visitor copy, пропускает scripts/styles/templates/mock product words, отдельно проверяет names/hidden slop → per-file findings и cross-page shared heading phrases | node fs/path, нет сети/browser/writes. 0 no FAIL, 1 FAIL, 2 usage/read error. Heuristics преимущественно английские (`192–250,419`), не переносить механически на русский. CSS computed visibility не вычисляет. |
| `photos.mjs:1–80,642–735,785–1025` | list/pick/search/fetch/credits → trade/subject/place/quality filters, Commons metadata, download/variants/crop, чтение использованной markup → files + exact img/picture + credits | `photos.json`, optional history/recent/found store, ffmpeg даже проверяется через `-version` (`808`); search requires network; fetch retry 429/5xx, JPEG magic; cached Commons files могут работать offline. credits до использования фото в markup — ошибка. `--write` пишет credits page. |
| `icons.mjs:55–122,320–383,400–608` | list/find/resolve/fetch/scan/check/proof → pinned source resolution/cache, scan HTML/spec+diagram presets → локальные SVG + credits | logos pinned commit; vscode-icons 1.2.30, Lucide 1.2.100, Simple Icons 16.30.0; jsDelivr network; cache guard не даёт включить cache внутрь published out (`333`). check --mark/proof меняют skill index, proof запускает Chrome. Лицензия пакета и trademark не одно и то же (`references/icons.md:25–31`). |
| `moments.mjs:53–62,147–279,317–569` | kind/count/seed/fits/photo/excludes/scenes/effects/context count → eligibility + unfinished-cycle/history selection → picks/notes/context totals | Budget 4 и scene avoidMoments; JSON history (`271–275`), index/shot commands пишут indexes/artifacts; `check` анализирует указанную страницу. Ошибка пустого pool не выдаётся за успех (`206`). Браузерные подкоманды зависят от Chrome. |
| `effects.mjs:35–49,194–258,268–351,509–522` | index/pick/gallery/lab/publish/shot/check → modules+schema/seed/slot/palette selection, template generation, dependency copying и browser proof | index/gallery/lab меняют **установленную библиотеку**; index динамически импортирует effect.js (`134`) — запуск не чистое JSON чтение. publish создаёт output tree + files.json, не deployment API. Многофайловый tooling, не безусловно read-only. |
| `fx-lab.template.html:169–386` | embedded palettes/presets + local fx.js/index → palette/layout/UI overlays/seed/params/pause → interactive preview, copy mount snippet, ready flag | clipboard/history.replaceState; import runtime draws canvas. Все эффекты монтируются (`385`), не продуктовый production template. Ошибка index показывает empty-state. |
| `fx-gallery.template.html:473–1316` | generated asset root + indexes → live hero, still-baked grounds, component/card/object/photo/scene previews → filterable showcase + code snippets | localStorage history (`948–972`), fonts.googleapis/gstatic, local dynamic imports/fetch, clipboard, WebGL budget queue/stills/lazy teardown. Gallery использует caption/sample credits (`466,1147`), допустимые для showcase, не свидетельство универсальности house no-caption. |
| `consistency.mjs:1–279,4535–4714,11180–11485` | file/folder/URL + widths/type/flags → HTTP loopback server, собственный Chrome/CDP, scroll/viewport/pixel probes → JSON, rendered.html, crops, FAIL/WARN/PASS/not checked | server may lift root to resolve ../ (`4576–4579`); --root bounds; file server lexical containment, symlink boundary полностью не доказана. Удаляет прежние matching crop jpg (`4597`). CPU/SwiftShader + GL cap изменяют среду измерения, не real GPU benchmark. 0 clean, 1 FAIL, 2 could not check. Остальной код PARTIAL. |
| `shoot.mjs:1–58,85–120,168–312,316–483` | file/URL + width/height/root/reduced/dark/wait → local HTTP, свой CDP Chrome, walk/stitch → PNG, section JPEG tiles+JSON | Screenshot **не выносит verdict**, 32k-height cap и expected cuts сообщаются. CPU shaders; no real-user cookies/profile. No Chrome/error page → nonzero, not visual approval. |
| `perf.mjs:1–34,62–82,122–309,366–435` | file/folder/URL + widths/runs/root/profile → median loads, sizes/mount counts, timing with GL-off, extra GL-on INFO → rows/spread/JSON/status | Node + Chrome + optional Windows host-load probe. No FPS, no soak; busy host caps timing FAIL at WARN (`433`), поэтому не CI universal benchmark. Own profile writes/deletion; concurrency issue ниже. |
| `gate.mjs:1–88,399,494–511,705–891` | armed local target + waivers + current revision/session → sequential child checkers, result matching/cache, rounds → PASS/FAIL/OPEN/ERROR/OFF/SETUP/QUICK/DONE | `.taste-skill/{build,build.done,gate,waivers,gate-blocks,unarmed}.json`, artifacts. CPU browsers + timeout watchdog; session/idle/multi-build escape. Hook output differs by host; no generic Hermes hook compatibility established. |

**Что повторяемо:** copy-lint на одинаковом input и фиксированном `--year`; moments/effects с теми же seed + index + filters + history/context; gallery URL deal воспроизводит selection при неизменных assets. **Что не гарантировано:** start использует Math.random; SKILL inline section/navigation draw тоже Math.random (`204`); изменяемая history/recent меняет pool; live Commons/network/font/cache меняют результаты; shots/perf зависят от Chrome/OS/font completion/host load/времени/CPU. Для regression нужно сохранять SHA, chosen IDs/CSS, seeds, history snapshot, material inputs, Chrome/viewport; «есть seed» не делает весь pipeline deterministic.

## 4. Install scope, manifests и hooks

### Installer

`install.sh:29–50,126–165` по умолчанию symlink всех frontmatter install names в **глобальный** `$HOME/.claude/skills`; `--codex` — `$HOME/.codex/skills`, `--all-agents` — оба. Это не project-local и не только текущая сессия. На данном SHA skill один; wildcard loop добавит будущие skills при повторном install. Git pull изменяет содержимое linked skill, включая hook, во всех использующих его средах. Нет commit pin/lock (`4–6`).

`install.sh:146–157`: чужая symlink/реальная папка не затирается, возвращается problem; own link пересоздаётся. `85–102`: Windows native symlink/junction fallback; возможную копию от ln удаляет; uninstall снимает только принадлежащие repo links, реальные старые копии оставляет с warning (`106–120`). Нет npm install, изменения project config или копирования hooks settings самим installer. Но symlink содержит SKILL с hook — это значимый последующий effect при invocation.

### Manifests

- `.claude-plugin/marketplace.json:8–22`: version 2.5.1, local root, только `./skills/taste-skill`, MIT metadata. Не другой агентный код.
- `.codex-plugin/plugin.json:20–33`: `skills: ./skills/`, interface/prompt metadata, `capabilities: []`; **не** доказывает, что Stop hook установлен/поддерживается текущей Friday Codex IDE.
- `.agents/plugins/marketplace.json:9–17`: URL source на **main**, installation AVAILABLE, authentication ON_INSTALL — marketplace policy data, не найденный secret и не доказательство необходимости внешнего token в runtime.
- Отдельных hook source files/папки hooks в назначенной области нет. Активный Claude hook встроен в `SKILL.md:14–19`; manual host settings recipes в `references/gate.md:134–204`.

### Stop hook

`SKILL.md:18` — POSIX shell lookup gate.mjs по skill/plugin/project/home paths, затем `exec node ... --hook claude`, timeout 600. При not found разрешает stop, а существующей `.taste-skill` оставляет `gate-hook-missing.txt` с timestamp/paths и warning об armed build. Это не тихий неизменяющий prompt file.

`gate.mjs:20–87`, `gate.md:84–105,191–204`:

- Arm/re-arm, session ownership, build one/two levels below, unarmed-page prompt; оркестратор с несколькими active children не удерживается.
- Quick consistency + independent layout + copy lint + static kit-edited/checker-gaming. WARN normally non-blocking, но **hero-enter/moment-none повышаются до blocking FAIL** (`gate.mjs:43–44`, `gate.md:66–68`). Это проверка house motion, не обнаруженный bug пользователя.
- Waiver должен однозначно назвать одну finding + reason; max five, kit-edited/checker-gaming не waive (`47–53`).
- После cap rounds — OPEN, после повторных blocks/timeouts/session/24h idle — escape; manual ERROR/OFF не означает прошедший QA. `--done` только с реальными словами пользователя.
- Hook protocol: Claude/Codex `{decision:block,reason}`, Antigravity `{decision:continue,reason}` для продолжения; allow — пустой stdout и 0 (`71–87`). **В этом аудите host integration не исполнялась.**
- Skill-scoped hooks относятся к main session: subagent load может удерживать parent (`gate.md:203–204`). Для Friday с независимым lifecycle/task_gate это риск вторых конкурирующих критериев завершения. Разумный первый маршрут — **manual adapter**, не установка Stop hook.

## 5. Конкретные static findings / конфликты

### F1 — effects dealer не реализует задекларированный off-tech отказ

**Source:** `scripts/effects.mjs:199–218` вызывает `pageKind`, но отказывается только при `!pg.page`; `scripts/moments.mjs:169–173` возвращает `page` для любого известного kind, включая place/product/service. В `dealEffects(...)` page затем вообще не передаётся. Следовательно валидный `--page place` проходит gate, хотя comment/usage обещают refuse.

**Механизм:** moments API расширили до every-kind moments, effects сохранил прежнюю проверку «валидный kind = effect-eligible». Никакого запуска для вывода не требовалось; статический control flow. Последующий checker может ругаться на сделанный effect, то есть workflow сам создаёт запрещённый результат.

**Local delta:** до допуска effects CLI сделать явный allowlist software/gaming/tech + technical product, а не проверку truthiness. Owner будущего adapter: design-department/tooling, не taste-curator. Regression matrix всех шести kind + aliases, explicit tech-subject, empty/unknown kind. Сейчас тест не запускался.

### F2 — perf sweep может удалить профиль другого активного запуска

**Source:** `scripts/perf.mjs:382–386` удаляет **все** `run-\d+` под profileBase прежде чем создать `run-${process.pid}`; liveness/ownership/host marker не проверяется. Это противоречит concurrency-safe обещанию истории `CHANGELOG.md:68–69`, хотя тот changelog описывает прежний inspector; текущий perf sweep — отдельный код.

**Механизм:** два perf с одинаковой default/TASTE_SKILL_TMP/--profile base; второй удаляет каталог первого на Unix даже если Chrome активен. Возможность по control flow, не воспроизведённый инцидент.

**Local delta:** уникальная base per invocation + проверяемый owner marker и only-dead PID cleanup; пока запускать строго sequential и с отдельными профилями. Regression два одновременных процесса с общим base, живой профиль нельзя удалить; aborted own run должен убираться. Не запускать upstream в этом audit.

### F3 — profile safety prose шире фактической защиты

**Source:** `perf.mjs:370–378`: относительный путь наружу и cwd заменяются, но **absolute** path вне проекта принимается, равно как любая подпапка внутри, не только `.taste-skill`. Аналогичный contract явно признан `CHANGELOG.md:13` («absolute one used as given»). Поэтому слова «never outside project» в SKILL:255–257 не гарантируют filesystem confinement. `photos.mjs:859–860,994–1010` также строит output из CLI `--dir`/`--href` без containment guard в прочитанном участке.

**Механизм:** trusted CLI имеет широкие output права; нельзя принимать внешние значения как безопасные relative paths. Это не утверждение об удалённой эксплуатации.

**Local delta:** adapter сам назначает scratch-owned profiles/output, realpath containment для пользовательских payload paths и запрещает cwd/root/user browser profile; не передаёт arbitrary upstream flags из недоверенного brief. Проверить `../`, absolute, symlink, spaces. До этого не считать upstream «sandboxed».

### F4 — несовпадающий Chrome discovery

`moments.mjs:317–320` autodiscovery содержит env/Windows/Linux paths, без стандартного macOS `/Applications/Google Chrome.app/...`; consistency содержит macOS paths (`4600–4612`). README:94 обещает installed Chrome broadly. На macOS moments browser subcommands могут требовать `CHROME_PATH` при успешной работе consistency. Это отдельный runtime adapter, не byte-identical общий launcher. Test — macOS installed Chrome без env, затем explicit path; фактический запуск не проверен.

### F5 — house policy блокирует законные бренд/UX/production решения

- **No captions** (`SKILL.md:34–35`, `copy.md:128–137`) нельзя сделать универсальным законом: diagram descriptions, scientific/e-commerce/contextual/legal credit требования могут нуждаться в visible explanation.
- **One section exactly per viewport** (`layout-v4.md:22–96`) конфликтует с content-first responsive layouts, data-heavy interfaces; это optional landing composition, не новый global hard-fail.
- **Animation mandatory** (`motion.md:15–28`, gate WARN→FAIL) против Friday frequency/purpose/brand M=3. Такой fail — не объективная ошибка.
- **No street/house/company/VAT/real phone; .example contacts** (`SKILL.md:55–56`, `copy.md:144–171`) недопустимо применять к настоящему клиентскому сайту. Friday `/preflight` требует опубликованные реквизиты и правовой контур (`.codex/commands/preflight.md:26–38`). Даже внутри Taste `copy.md:146` требует печатать brief ровно, а house rule9 выше по приоритету — отдельная неоднозначность для adapter.
- **Assumed hours/prices** (`copy.md:110–117`) разрешены с data-assumed/report, но не соответствуют обещанию «nothing invented» без оговорки. В Friday production missing facts должны остаться blocker/запросом, не plausible content.
- **Palette/type dealt, first wins** (`SKILL.md:221–228`) может вытеснить утверждённый MASTER. В Friday бренд/MASTER уже authoritative, randomness только между подходящими допустимыми кандидатами, не генератор нового бренда.
- **Untouched kit enforced** (`gate.md:42–52,82–83`) конфликтует с адаптацией под существующие components, motion wrapper/CSP и обновления. Quasi-identical port ещё может получать gaming-suspect за kit's собственный headless detection; upstream предлагает waiver (`48–52`). Не перенимать «всегда не редактировать vendor kit» как запрет нормального adapter.
- **Only own headless script, no browser tool** (`SKILL.md:250–252`) — house tooling policy, несовместимая с доступным Friday/Hermes browser/visual search handoff; не переносить.

Это основание отделить policies, **не** исключить Taste из stack. Browser evidence, контентная работа, recipes и asset methods ценны независимо от этих запретов.

## 6. Friday: semantic equivalence, delta и current dirty state

| Область | Friday evidence | Оценка относительно Taste |
|---|---|---|
| Three dials | `docs/core/design-principles.md:21–30`, `/design-system:24–26`, `/preflight:7–8`, taste-curator:170–174,223–227 | **Already present**, не новый delta и не доказательство upstream происхождения. |
| Reference extraction/доминанта | design-principles:32–45; taste-curator:140–175,236–241 | **Already present**, включая exact token values и no averaging. |
| Domain fit | design-profiles:19–68,84–93 | **Already present/partial**: e-commerce/SaaS/dashboard и brand override; Taste добавляет recipes и material-aware plans, не саму идею domain switching. |
| Durable design system | `/design-system:28–66` | **Already present** MASTER/page deltas, кириллица, colour/on-colour. Taste CSS dealer не должен переписывать это. |
| Static deterministic lint | `.codex/scripts/design-lint.mjs:7–103,105–219,221–300` | **Partial**. Regex+MASTER check — не browser geometry. Важная деталь: main всегда exit0 (`300`), в отличие от Taste copy-lint exit1 на FAIL; clean stdout и process status нельзя отождествлять. |
| Browser visual review | screenshot.mjs:22–38,95–152; design-reviewer:40–76 | **Partial**, уже три viewport и explicit image read; delta не «нужен screenshot», а автоматические crops/measurements/not-checked + стресс/maxchars + GL/nojs/slow-network probes. |
| Copy integrity/anti-slop | marketing-agent:39–65; design-lint:98–102 | **Partial**, source-backed detailed fact/voice/structure method и multi-page diagnostics добавляют существенно больше. |
| Motion | docs/core/motion.md:12–103,140–175 | **Already/partial + conflict**; основа и измеримые durations есть, обязательные hero/moment/no-reveal не переносить глобально. |
| Provenance/vision/media handoff | dirty taste-curator:20–33,50–77; Nullume SKILL:10–29,476–479 | **Already dirty/partial**, stronger native inputs/approval gates. Добавить crop/size/replacement manifest, а не объявлять всё absent. |
| Review completion | `/preflight:45–50`, roles contract:5–6, `.codex/workflows/review-loop.md` ссылки | **Already lifecycle concept**, live implementation не проверялась. Taste local file gate не замена task_gate/independent reviewer. |

### Dirty MD/TOML отдельно от HEAD

Read-only `git diff` проверен. Релевантные изменения находятся в `.codex/agents/design/{taste-curator,design-reviewer,design-department}.md`, соответствующих flat `.toml`, `.codex/skills/nullume/SKILL.md`, `.codex/CODEX.md` и других файлах. Они чужие и не изменялись.

- В working tree **появились** runtime-readiness вместо обещанного browser, rights-before-vision, originals evidence, scene/product/label separation, native Codex images/KIE video distinction, single pilot/budget/owner acceptance, отсутствие permission на production по одному research. HEAD этого полного блока не содержит.
- `design-reviewer.md:66–76` заменяет старый абсолютный запрет внешних сайтов на проверку текущего runtime и честный blocker. Следовательно сравнивать Taste только с HEAD фразой «Friday не умеет внешний browser» — неверно.
- В Nullume dirty `SKILL.md:10–29` активный маршрут приоритетнее старых примеров; нижние historical recipes не являются разрешением KIE images, config write или cookie export. Сохранены как справочник.
- TOML `developer_instructions` у **taste-curator/design-reviewer/design-department** распарсены Python `tomllib` и сравнены с MD без первого `# role`: в текущем working tree тексты **равны** для всех трёх. Физическая ссылка на embedded instructions — `*.toml:3`; logical lines соответствуют MD body. Это проверка source parity, не доказательство live IDE reload/работающего browser.

## 7. История dials: связь есть, причинное происхождение не доказано

1. На текущем snapshot Taste 2.5.1 нет старого dial-driven primary workflow: он material/kind/deal/check driven. `CHANGELOG.md:204–206,271–275,297–299` прямо описывает dials как свойство v1 и v2-experimental; README:160–175 отправляет их в classics.
2. Friday git history: **9fa7681580aacf75ac7a1aa8fb59c8789205524f**, `Add design dials, brief inference, preflight checklist, redesign order`, 2026-07-11 — добавляет V/M/D 4/3/5 в тогдашний `docs/design.md`, привязку motion, brief inference/preflight и marketing-filler; commit message отдельно говорит, что em-dash ban **сознательно не взят для русской типографики**. Потом `98108cd8` переносит universal core; `8c6a67d8` добавляет reference extraction/choreography. Исторический `docs/design.md` называет Impeccable аналогом общей базы, но не атрибутирует dials Taste.
3. Для проверки версии, а не доверия поисковому snippet, **прочитаны supplemental source excerpts** по immutable Taste commit `ca50fb45124799ffede313598cda99251a09f086`: `skills/taste-skill-v1/SKILL.md:8–13` — dials 8/6/4, Art Gallery/Cockpit vocabulary; `skills/taste-skill-v2-experimental/SKILL.md:13–39,47–49,226–227,359,963–966` — brief inference, те же три имени/scale, CTA/preflight и motion reading. Эти файлы сохранены только в scratch как `historical-taste-skill-v1.md` и `historical-taste-skill-v2-experimental.md`; они **partial supplemental**, не входят в 50-файловый snapshot coverage.
4. Это доказывает **смысловое и лексическое родство** исторического Taste и уже существующего Friday; не доказывает конкретный акт переноса. Локальный commit не содержит explicit attribution URL/source SHA, checkout Taste shallow (1 commit), полученный immutable historical Taste snapshot сам по себе не доказывает, что именно он читался при июльском переносе. Поэтому формулировка «Friday dials точно произошли из Taste» здесь **не используется**.

Полезная будущая проверка provenance — session/PR evidence конкретного переноса или явное сообщение автора; не подменять этим тему сегодняшних useful deltas. Текущий Taste нельзя оценивать только по памяти о v1.

## 8. Рекомендуемые exact deltas: owner → target → output → acceptance

Ниже предложения, не выполненные изменения.

| Приоритет / delta | Owner и target | Expected output | Acceptance test |
|---|---|---|---|
| P1 Copy workbench | marketing-agent; новая `docs/core/copy-voice.md`, краткая ссылка в role MD + TOML | Fact sheet с source, claim/proof, voice card, register rationale, hero/body/error/empty/404 text; reader-question section plan | Один thin brief не создаёт reviews/prices/hours; два разных бренда не имеют одинаковой voice card; client exact quote preserved; native Russian typography разрешена. |
| P1 Render evidence adapter | design-reviewer/tooling; отдельный скрипт под `.codex/scripts/`, не raw Stop hook | Findings с viewport/selector/crop + explicit notChecked, source revision, build revision, public artifact paths | Blank image, missing font, 320 overflow, hidden content/nojs, reduced-motion и false-positive waiver fixtures; реальная operational ошибка никогда не PASS. Сначала дочитать consistency. |
| P1 Media slot manifest | taste-curator + media-generator + brand-guard; существующий `docs/core/media-reference-handoff.md` / JSON template, без обхода dirty gates | Для каждого visual: role/source/licence/AI permission/client-vs-stand-in/subject/desktop+mobile crop/budget/replacement shot | Несовпадающий product_id/SKU/label блокирует handoff; reference-only не уходит в AI; нет client photo — research draft, не auto production; mobile crop удерживает subject. |
| P2 Material-aware section plan | design-department / `/design-system`; ссылка на изолированный Taste recipe appendix | section id, job/question, source content, visual role, responsive behaviour, expected failure | Sparse brief сокращает section count, не заполняется fake proof; app/dashboard остаётся functional/dense; checkout не получает mandatory moments. |
| P2 Copy diagnostics | tooling + marketing-agent, отдельный optional RU-aware lint | JSON findings + each evidence sentence; warnings оставляются с reason; cross-page sameness | English literal harness/real brand не банятся; кириллица, тире и согласованный playful pet tone не false FAIL; repeated marketing templates находятся; exit status отражает verdict. |
| P2 Safe seeded option exploration | taste-curator; внутри approved descriptor/MASTER workflow | Reproducibility record: SHA, allowed pool, chosen IDs, seed/history snapshot, rationale | Один seed+state даёт одни choices; утверждённый MASTER не меняется; palette/font поддерживают language/contrast; history concurrent-safe. |
| P2 Media/perf budget report | performance-optimizer + design-reviewer, отдельный adapter | Image/fonts/request sizes, multiple-load median/spread, GL-off proxy честно подписан | No fps claim, busy host не success, isolated profiles, second run не удаляет первый; ffmpeg absence fallback truthful. |

**Не добавлять повторно:** V/M/D, общие anti-slop запреты, reference extraction, MASTER, кириллица, базовый reduced motion, сам факт screenshot review. Уточнять существующие owners/контракты, не плодить параллельный «Taste department».

**Применять как opt-in house landing style:** one-section-per-screen, конкретные edge coordinates, mandatory hero+moment, strict off-tech aesthetics, fixed fragment loops, no captions, first-deal-wins. Production truth/legal/privacy/brand decisions остаются Friday и владельцу.

## 9. Tests/examples/license и что проверено реально

- `.github/workflows/check-skills.yml:12–33`: Node22, pinned `yaml@2.6.1` install только в CI, frontmatter/text-encoding tests и `node --check` scripts/assets. **kit-clean browser suite здесь не вызывается.** Parse-clean не доказывает runtime correctness F1/F2 или эстетическое качество.
- `tests/frontmatter.mjs:22–60`: strict unique YAML names/types/length, JSON parse и listed plugin paths; **top-level Codex `skills` string не валидируется тем же loop**, который смотрит `j.plugins` (`51–55`). Library JSON проверяется синтаксически, не eligibility/contrast/UTF glyph schema.
- `tests/text-encoding.mjs:10–26`: рекурсивный mojibake regex по text extensions, skip `.git/node_modules` и >4 MB. Это targeted encoding check, не proof каждой Unicode строки.
- `tests/kit-clean.mjs:47–63,103–145,164–168`: hero demos + scratch starter symlink + in-page moments, optional individual demos, consistency quick и layout; starter placeholders/copy FAIL избирательно held. Browser errors/notChecked отличаются от clean; exit1 bad /2 lost. Не unit coverage всех state machines. На Windows tree kill, на POSIX timeout ветка убивает checker PID (`79–90`), полное cleanup зависит от обработчиков дочернего checker; запуск не проверялся.
- `examples/v2/CREDITS.md` содержит provenance примеров; четыре webp не открывались этим worker. Не считать наличие before/after картинок доказанным улучшением.
- `LICENSE:1–21`: MIT, copyright 2026 Leonxlnx, retain copyright/permission notice, без гарантий. **MIT repo не распространяется автоматически на отдельные photos/logos/fonts**; их metadata/attribution/trademark обязательны. Asset worker отдельно проверяет эти families.

Реально выполнено: source reading, git history/diff, semantic local comparator search, TOML parse + source-text parity, подсчёт coverage Python. Не выполнено по запрету: install, hook invocation, Node parse checks, browser check, ffmpeg, network fetch scripts, unit/regression tests. Read-only HTTP запросы GitHub использовались только для supplemental исторических текстов.

## 10. Остаток до полного content/runtime audit

1. Дочитать `scripts/consistency.mjs:531–4534,4715–11179` полностью; это уникальные handwritten check implementations, **не generated fixture и не alias**. Проверить forms network interception/side effects, all CDP injected scripts, fallback probes, source scanning, skip/notChecked propagation, path boundaries, timeout/cleanup.
2. Сопоставить asset-worker conclusion для actual `layout/check.mjs`, heroes/deal, motion/system.js и index producers: здесь endpoints связаны, но их реализация не заменена догадкой.
3. Runtime E2E testing требует отдельного разрешённого будущего этапа; сейчас запрещено. Ни один предложенный acceptance test нельзя засчитать pass по чтению.

**Итог:** Taste — полноценный и полезный кандидат в stack, особенно copy+content planning+media+measured browser review. Exact полезные additions выделены отдельно от уже имеющегося Friday и от house defaults. Полнота giant checker пока открыта и явно отражена coverage, rollout не выполнен.
