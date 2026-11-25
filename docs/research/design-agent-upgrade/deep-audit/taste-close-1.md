# Taste close-1 — implementation follow-up (PARTIAL, не закрытие всего scope)

## 0. Вердикт и доказательность

**Полное поручение не закрыто.** Назначено 108 файлов / 26 840 строк. В этом follow-up содержательно прочитаны 43 файла полностью и 1 частично; 64 файла не прочитаны. Прочитано 12 034 строки, осталось 14 806. Все назначенные пути, SHA-256, статусы, прочитанные диапазоны, line counts и смысловые заметки находятся в `taste-close-1-coverage.json`; `gaps` — точное дополнение диапазонов до полного файла. Непрочитанное не классифицировано как generated и не выдано за full. Предыдущее покрытие автоматически не наследовалось.

**Что действительно закрыто внутри этой части:** все 14 назначенных `effects/*/effect.js`; shared helpers компонентов, moments и scenes; 6 component implementations (map/chart/progress/button/tabs/avatar; shared отдельно); 6 конкретных moments; 4 scene implementations; 5 object implementations/adapters; layout DOM checker и его launcher; terminal-run и GLSL lint CLI. Точный список — ledger, не оценка «по семейству».

Scope: Taste snapshot `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/taste`, HEAD `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`; Friday `/Users/germanbryzgalov/Friday-claude`, HEAD `388ec708f39583172d7f36110f6424cc175b5512`. Оба HEAD прочитаны через git rev-parse. Сравнение ниже — с прочитанными файлами текущего working tree, не доказательство их live-применения. Роль researcher адаптирована к Hermes; дочерние агенты не запускались; лимит 15 файлов не использован.

Ничего из upstream не запускалось: ни JS, imports, installer, hooks, tests, browser, shaders, map fetch. Python использовался только для чтения текстов, хешей, ledger и проверки его полноты; git — для чтения revision. **Ни один предлагаемый regression test не выполнен.** Изменены только два назначенных отчётных файла. Runtime/визуальная работоспособность не подтверждена.

Пути `scripts/…` и `assets/…` ниже относительно `skills/taste-skill/` Taste. Friday отмечен явно. Это добавление к `taste-content-runtime.md` / `taste-assets.md`, не повторный пересказ метаданных.

## 1. Consistency: реально прочитанные implementation blocks

### 1.1 Полнота checker

Из 11 485 строк прочитаны **1–1295, 3359–4864, 7490–7589, 9758–10137, 10910–11485**. Осталось **1296–3358, 4865–7489, 7590–9757, 10138–10909**. Поэтому **нет заявления «проверены все checks»**. Заголовочный каталог checks не засчитан как чтение их внутренних реализаций.

Не закрыты address matcher; весь rhythm geometry/expansion; основной `lib()` с большинством layout/text/nav/button/phone probes; helper pixel algorithms; copy/audit/extras/more/shader-lint и большая часть `runWidth`. У `collide`/`tap-size` прочитана оркестрация narrow, **но не геометрия самих phone probes**. У busy-ground прочитаны значения `CC_BUSY_EDGE=1.4`, `CC_BUSY_RNG=0.25` (`4550`), **но не алгоритм**. Не путать эти два уровня.

### 1.2 Visuals: DOM, pixel thresholds, исключения

`scripts/consistency.mjs:700–838,1027–1088`:

- Берутся видимые `img/canvas/video/svg`, effect/product/diagram/scene mounts и несемантические элементы с background URL; минимум **120×80 CSS px**. Вложенные candidates заменяются внешним. Первые **40** по порядку DOM; остальные названы в errors (`756–757,1240`), но не измеряются.
- SVG children, data/blob textures и filter references не считаются отдельными картинками. Background на `body/main/section/header/footer/article/nav/aside` не становится кандидатом этого блока (`749`): не экстраполировать его покрытие на все hero background.
- Caption: TreeWalker сводит text runs к ближайшим block boxes. Подпись в пределах **32 px**, horizontal overlap **40%** меньшей ширины; short ≤2 строки /180 символов; small ≤15px. Figcaption/класс caption/англоязычные caption phrases — FAIL, small line — WARN. Overlay в нижней половине: ≥3 слова, ≥14 символов, absolute, без собственной непрозрачной card — WARN. Заголовки, ссылки/кнопки, nav/header/footer/quote, цены и credits исключены. Максимум **8** находок на check/width с FAIL-first (`1006–1023`). Это house no-caption policy, а не accessibility-дефект.
- Для PNG берётся screenshot clip **scale0.5**, каналы квантуются до **5 бит**. Значим цвет, занимающий ≥**0.1%** пикселей; detail — доля соседей с разницей ≥**10** в канале. <6 значимых цветов: **99.8%** одного цвета → FAIL; canvas/mount уже **98%** → FAIL; иначе WARN. ≥6 цветов при detail<**0.2%** → smooth-gradient WARN (`645–695`). Альфа при статистике отдельно не композится.
- После scroll ждёт **700ms**, подозрительное снимает повторно через **1300ms**. Fixed/sticky элементы, не входящие в visual, временно скрываются. В `finally` bars/style/scroll восстанавливаются. Часть visual вне viewport учитывается только видимым clip и помечается процентом, а не реконструируется целиком.
- `img/svg/bg`, имевшие ≥**12** цветов и detail≥0.2% на первой ширине, **не переснимаются на следующих ширинах** (`1031,1060`). Это экономия, но не доказательство, что responsive picture на телефоне не пустой.
- FAIL flatness понижается до WARN для moving/held scene или context, отказанного самим checker. Отсутствующий рисунок в diagram mount — FAIL, в scene — WARN даже если внешний ground насыщенный. Broken/loading/no-src images — отдельный FAIL. Background URL повторно грузится как Image, timeout6s просто завершает promise; только `onerror` добавляет broken (`841–843`): зависшее изображение не становится broken этим probe.

**Ложные срабатывания/пропуски:** минималистичный логотип/line art; intentionally blank video frame; poster/цветовая заливка; фон вместо subject; полезная фигура с figcaption; первая богатая desktop-картинка скрывает mobile-specific failure; первые40 не весь сайт. Rich/held exemptions — не runtime pass.

### 1.3 Source graph и effect-kind

`consistency.mjs:424–641,866–990,1097–1256`:

- Source scan идёт **по HTTP**, same-origin HTML/scripts/styles/imports/dynamic literal imports/new URL soft guesses/iframe. Bare packages и другие origins только перечисляются. Не исполняет импортируемый JS в Node; сам проверяемый сайт browser исполнял бы. Лимиты **3MB/file**, **400 files**, **6 concurrent**, **20s**. Soft404 не считается missing; реальные missing и skipped сообщаются с ограничением вывода.
- Shader extraction — собственный lexical JS scanner, не AST/GLSL compiler. Template interpolation становится `ZZINTERPZZ`; ищутся structural GLSL signs/main/precision/declarations. Macro name, reserved identifiers, gl_/double underscores рассматриваются отдельно. Это полезная защита от word-list false positives, но не весь язык JS и не runtime compile guarantee. Основной поздний `shaderLint` здесь не дочитан.
- Particle probe временно перехватывает **2D arc/fillRect на600ms**, считает calls/s; **≥300** — particle signal. Вызовы charts/рисования тоже могут дать это число; offscreen particle system вне верхней части не гарантированно попадёт.
- Drift walk шагает **0.7H**, сравнивает box после100px scroll, settle400ms+170ms; deviation>**4px**. Кандидаты section≥160px, bounded cards/frames; fixed/sticky/finite-running и mounted moments исключаются. Не визуальное доказательство intentional parallax.
- Kind precedence не совпадает с простым «первый meta»: explicit flag; independent page-type/data-type/page-kind=place с приоритетом place/product/service; site-kind tech/software/gaming; другие page-kind; taste alias; title-derived type. Technical product разрешён по флагу или site-kind. Неверные значения пишутся в errors.
- `effect-kind` использует maxima по ширинам; product render contexts исключает, иногда по stack path/late microtask. Unknown/retired/off-kind moments, nested/failed/unmounted/unfetched `moment.js` → FAIL; top-level>2 → FAIL. Наличие marker недостаточно: проверяется fetched path конкретного kit moment.
- Plain place/service/product: shader/mount/print/particles/scroll-signals → house FAIL, подходящие photo/type moments разрешены. Tech: marked bigScene>1 либо bigScene+несвязанный data-fx → FAIL; прочие scenes>1/moments>2/created contexts>**8**/peak>4 → WARN. Comment `1215` говорит threshold16, код `1216` сравнивает с8 — переносить кодовую семантику, не комментарий.
- Branch coverage reduced/phone определяется **наличием строк regex** в объединённых sources, а не фактической корректностью ветки. `prefers-reduced-motion` в неиспользуемом helper удовлетворяет этот signal.
- Hero-enter и moment-none — WARN checker, обязательная kit motion policy; это не новый объективный дефект Friday. Проверка custom implementation без точных kit resource paths может дать moment-dead при реально работающем эквиваленте.

### 1.4 Motion hooks, tiles, empty-area

Полностью прочитаны `3359–3949`.

**motion-hooks:** только первая подходящая ширина≥700 (MOD_DONE). `data-motion` без motion.css → FAIL; обратное WARN. CSS распознаётся по href либо тексту selector/condition, не поведению hover. Counts regex: нет цифры/price/year1900–2099 → FAIL. Loop duration — longest infinite WAAPI/CSS или SVG indefinite `dur`, затем fallback `--m-cycle`; `--m-still` пропускает. **>4050ms FAIL, <2450ms WARN**, в пределах — без находки. Canvas/JS pulse cadence напрямую не измеряется. Годоподобный обычный count может быть false positive; отсутствие распознанной animation duration — не проверенная cadence.

**tiles:** только1440×900 или width<600,height844. Секции — main children с unwrap до3 wrapper levels + body sections/footer.closing; plain footer не считается вторым section. Fixed/sticky site header вычитается из видимой области. Две geometry reads через900ms; moved≥8px/held scene/large sticky/GSAP pin исключаются. Off1H/2H tolerance24px; phone проверяет лишь слишком короткие. Кандидатов максимум16; репортов8. Иной section с heading/text/picture≥8px под header → FAIL, только ground≥tol → WARN. Scroll snapping принудительно отключается на время; в finally style убирается/scroll возвращается. Дедуп с hero-screen/section-height/one-section. Это checker эстетической плитки, не общий responsive стандарт. Превышение16 сообщает errors, не явный per-check notChecked.

**empty-area:** per width, main sections/closing, минимум160×200. Statement hero без pictures, full-size photo/background/mounted moment специально исключены. Container `.wrap` либо padding-box — не любая `.container`. Content: text Range extents, media/mount/control, bounded card или ruled row. Ground/frame≥60%section не равно content; fills≥90% сразу заполняют section. Каждый content box расширяется на20px; occupancy grid16px; padding до12%H с каждой стороны не считается воздухом. Считаются полностью пустые rows и runs<50%width длиной≥25%H. Empty share>35% WARN, >50% FAIL; crop на largest histogram rectangle. `shownCss`/основной обход проверяют display/visibility, но **не opacity** (`3798,3839`): invisible-at-opacity0 box способен «заполнить» область. Отдельный hidden-content может обнаружить текст, но area сам не является pixel occupancy detector.

### 1.5 Basics: реальные DOM/keyboard действия и пределы

Полностью прочитан `3950–4495`.

- Имена controls вычисляются своей common-cases моделью aria-labelledby/label/text/alt/svg title/title. Не accessibility tree браузера. Drawn/inert/aria-hidden/UI mocks исключены; исключение для pause controls использует `.loop-pause,.ui-pause,[data-pause]`, не все возможные компоненты.
- Image alt отсутствует → FAIL; filename/bare image/photo word → WARN. Visible field-label обязателен: aria-label отдельно → FAIL, хотя Friday preflight:13 разрешает label/aria-label. Это **усиление policy**, не доказательство несоответствия WCAG любого icon-search поля.
- Heading jump>1 FAIL в main/WARN в header/footer; positive tabindex FAIL; focus-outline removal читается **по одному CSS rule**, без полного cascade. Cross-origin cssRules silently skipped (`4171`). Replacement property любого значения в том же rule удовлетворяет heuristic.
- Language syntax + stopword classifier9 европейских языков, ≥80words, dominant≥max(8,6%words) и≥2×runner-up. Русского классификатора нет. share-meta проверяет присутствие строк, не доступность og:image/значение twitter:card.
- map-link использует западноевропейские street suffixes и направление label. Coordinates/OSM links без query/POI могут стать FAIL при правильном target. Open-now смотрит `dl.hours` и data-assumed markers, не расписание/таймзону/реальность. Один unrelated data-assumed может подавить WARN о непомеченных hours (`4440`).
- form-fields **dispatches synthetic paste**, наличие `onpaste` уже считается blocking независимо от поведения (`4235–4236`). Определяет email/tel/name/count по ограниченным labels; проверяет атрибуты/status/initial-disabled. form-send — regex thank-you + наличие похожего endpoint/action. Не проверяет доставку или успешный ответ backend.
- Action-repeat сравнивает одинаковое normalized имя, не transaction identity: ≥3 controls на первом screen FAIL;2 nav+hero наdesktop≥1000 WARN. Повторённое `Edit` для разных entities может быть false positive.
- Menu probe впервыеwidth<1024 ищет toggle и **вызывает click()**; read-after450ms, сравнивает aria-expanded, кликает обратно только если оно изменилось. Это не проверка focus trap/Escape/связи panel с aria-controls.
- Keyboard at first width, включая quick: настоящий Tab key event, максимум40 уникальных selectors; pause60ms, недостаточное focus appearance повторно через350ms. Невидимость area<16/ancestor opacity<0.1/clip/etc → FAIL; change≥3:1 либо unmeasured pseudo/color difference достаточно для pass. Ring under photo получает условный contrast99, не pixel contrast. Covered5 sample points:100% → FAIL, часть→WARN; firststop skip-link regex. Не полное keyboard/a11y ревью всей страницы.

### 1.6 Hover, loops, form submission

`7490–7559,10967–11106` прочитаны, DOM helpers выбора большинства hover candidates — ещё gap.

- Hover cards: scroll-to-centre250ms; after mouse450ms; tilt delta≥0.5deg/new3D → FAIL; lift≥6.5px, scale>1.031, photoZoom>1.051 → WARN. Column spill увеличился≥12px → FAIL, после3spills прекращает sweep. Linked card без signature/box change → house FAIL. Generic filled/outline/text/nav hover sampled один раз на вид:350ms no change → WARN. Pointer events не равны touch/keyboard альтернативе.
- Hidden-on-hover первые8 candidates → WARN. Loops:40 type candidates, максимум16 screens, каждый ждёт5200ms, A/B/C shots с1200/1400ms gaps. Candidate pixel diff≥0.003 и нет распознанной pause button → FAIL. Generic pixel moving boxes тоже проверяются. **Pause button только ищется по labels/aria-pressed/role; НЕ нажимается**, реально останавливать animation она может и не уметь. Русская «Пауза» без других распознанных атрибутов может дать false FAIL. Реальные delayed image loads/clock/video могут дать pixel movement; это review signal.
- Remote page submit не выполняется и попадает в notChecked. `isLocal` допускает localhost/127.0.0.1/[::1]/.localhost/.test (`9199`, прочитан как targeted search, не full окружающего блока). Это hostname rule, не proof, что backend — disposable sandbox.
- До submit на local включает Fetch interception, каждому paused request synthetic200 text/plain empty. Вводятся test@example.com / Test /future date; required checkbox/radio включаются, native validation отключается. Click submit/requestSubmit; monkeypatch window.open и native submit; ждёт1600ms, возвращает before/after/action, восстанавливает patches. Это **активная мутация DOM и event execution**, не read-only inspector.
- Любой подходящий POST либо XHR/Fetch/Ping/Document/Other/EventSource GET, mailto или существующий action удовлетворяет sends. Не проверяет URL назначения/данные/semantic response/success UI. Аналитический request может сделать fake form «отправляющей»; synthetic200 не проверяет error states и доставку. См. F1–F2 ниже.

### 1.7 Fallback/slow/reduced/hidden/sweep и not-checked

Полностью прочитаны passes9758–10137 и11217–11485.

- GL fallback: отдельная вкладка с injected shader rejection, максимум60 steps0.85H, wait1100ms. При150+sample pixels flatshare≥0.985 FAIL; если не flat — strip canvases/pictures/script background, diff threshold3, changedshare<0.004 FAIL. Context guard injection, shader rejection injection и ряд probe calls имеют `.catch(()=>{})`: нельзя считать успешность инъекции доказанной. Helper flat/diff algorithms ещё gap.
- Slow mobile:390,400ms latency,1.6Mbit/s download,0.75Mbit/s upload,cache disabled; настройка также catch-ignored. Img≥120×80 и60%видимой высоты: через≈1s не loaded → late. После дополнительного ожидания FAIL если>400KB или !done или naturalWidth>4×CSSclipWidth; иначе WARN.40steps, затем до3nav-photo targets послеfresh load. Не backgrounds/video, не cold provider/network benchmark; timing message «3.5s later» неточен для списка, который взвешивается в конце долгого walk. DOM image index/имя файла может меняться.
- Reduced: first width only,14screens max; motionNow160ms послеscroll, затем1500ms settle,3shots separated1200/1300ms; retry screenshot один раз. Finite entry FAIL, ongoing pixel movement FAIL/controlled video WARN. Скрытое читает дважды через500ms.14screens не entire page guarantee.
- Hidden: opacity<0.1, transparent letters<0.05, determinant transform<0.01, ≥90%inset clip, masked transform offscreen; исключает closed menus/details/dialog/aria-hidden/inert/sr-only и overlap-соседа≥50%area. Отдельные nojs/dead-IO/reduced reloads,40screens cap. NoJS wait1500ms, deadIO4000ms, reduced2000ms. Dead IO stub не эмулирует весь no-support браузер. Соседний visible sibling может скрыть реальный missing-text дефект. NoJS pass осмыслен не для каждого client-only приложения.
- Quick действительно пропускает scroll stepping/revealwalk/hover/loops/formsubmit/reduced moving pass/deadIO, **но всё ещё запускает basics keyboard/menu/paste и nojs+reduced hiddenWalk**, если не отключены. Это не «только безопасные статические проверки».
- Narrow320×640: предварительныйwalk40screens, phoneLook ещё40, fold severity→WARN,6crops; overflow список8outermost blocks,3crops. Excludes clipped ancestors (кроме body/html) и endless animations. То есть обещание body-clip не скрывает overflow не означает проверку всех overflow-hidden widget cuts.
- Sweep1280/1152/1024/896/768, skipnear main±8px, толькоfirstscreen; измеряет повторно900ms, box movementtol4px. Если второй probe failed, `!m2` разрешает первоначальную finding (`11239`), а не доказывает стабильность. Dedupe across widths по check+selector может скрывать width-specific различие severity/объекта.
- Safe/lost mapping создаёт per-check WARN `partly measured`, а не PASS, если named error попал в map. Ошибки добавленные напрямую `errors.push` без `errors.lost`, catch-to-empty и limits обходят этот механизм.
- Основная ширина с0screens retry через5s; послеfailure → notCheckedAt иexit2. Reportchecks агрегирует worst finding; без findings+recognized skip → not checked; иначе PASS. Exit0 приWARN и notChecked (кроме missed main widths),exit1 FAIL,exit2 operational global error. **PASS отдельного check не доказывает все widths и все elements; notChecked не делаетexit2 автоматически.** no-slow/no-gl-fallback/no-sweep caps не полностью отражены отдельными notChecked записями в прочитанном финальном run.

### 1.8 Browser/server side effects и инструментированная среда

`4500–4864`: loopback static server может поднять root на число `../` в самом HTML; `--root` lexical confinement. Статическая проверка пути не realpath: symlink снаружи root не блокируется этими guards. Отчётный directory создаётся и matching old crop JPG удаляются. Profile принимает absolute path внеproject; внутри него Chrome получает уникальный run-PID-timestamp, удаляется только этот run; не переносить прежнюю perf cleanup находку на этот launcher.

Chromium headlessCPU/SwiftShader, force-sRGB, autoplay allowed, background throttling отключён. WebGL guard перехватывает HTMLCanvasElement/OffscreenCanvas.getContext; cap4, перед отказом теряет старейший far-offscreen context, считает asked/peak/refused/evicted; product contexts исключает по host/call stack. Считает disconnected-after-ever-connected canvas освобождённым, хотя реальный context необязательно потерян. Captures максимум80 shaders,60kchars/source,30compile/link failures. IO_HOOK после callback через90ms ищет finite animations≤500ms currentTime приscrollY>0. Это меняет страницу и её resource/lifecycle режим; не natural GPU/perf benchmark.

## 2. Assets: реализация, состояния и действительная функциональность

### 2.1 Общие зависимости, не сводимые к meta.json

Весь следующий вывод основан на прочитанных implementations. Файлы зависимостей `effects/fx.js`, `objects/_scenes/kit.js`, `objects/photo-kit/photo.js`, `product-render/build.js`, `_print-core/print3d.js`, `ui/ui.js`, `moments/moments.js`, `scenes/scenes.js`, `layout/heroes.json` существуют (metadata check), **но в этом follow-up повторно содержательно не прочитаны**. Их contracts называются по call sites, не приписывается полный dependency audit. Ссылка на прежний assets report не устраняет этот предел.

`assets/components/shared.js:155–255,295–359,388–423,447–553` — реальный mini-runtime, а не декор-JSON:

- still(): IO12%/RO/visibility, serial promise chain, pending `html[data-cx-baking]`; mount/pause, ждёт canvas5s, intercepts drawArrays и копирует pixels в CPU2Dcanvas; grab1500ms+set nudge250ms, resize>4% rebake. CSS fallback/2D controller kept. Уничтожает context через ctrl.destroy, хранит picture/extras, fade450ms. Ошибка mount прекращает retries, ready при этом не resolve/reject; destroy тоже не settle ready.
- fill(): aria-hidden/inert/data-nosnippet sibling overlay, копия content безid, heading→div (не duplicate h1), шрифт из computed CSS; blend/mask, RO/resize/fonts, undo. Fallback исходный текст зависит от CSS. windows(): один host mask наunion целей+intersections, RO; ни live chart, ни business action сам по себе.
- whileVisible(): interval толькоonscreen/tab-visible/notreduced/notpaused; change listener умеет остановить timer при изменении preference. pauser(): реальная pause/resume controllers + bubbling cx-pause, останавливает CSS transitions, class дляCSSanimations. bag(): LIFO cleanup и **destroy late async resolved controller**, полезный production pattern.

`moments/lib.js` — native scroll scrub, initially-on доIO report; once threshold/talltarget/rescue3000ms/starvation1500ms; сохраняет доступные имена при nested split, оборачивает whole blocks и restore opacity. `scenes/lib.js` — native scroll live/rest, dampedRAF tau0.07, minHeight420, phoneplan/reduced/print, IO±100%viewport/readyfontremeasure, stage `data-edge-free` толькоlive. SharedGL counter take/free и shader guard, а не externalGSAP. См. lifecycle defects ниже.

### 2.2 Все 14 назначенных effects прочитаны полностью

Общие `shader()` / `lifecycle()` передают управление временем, visibility, reduced motion и resize в `fx.js`; эти guarantees внутри fx.js здесь не перепроверены. Все grounds ниже — **декорация**, не фотография клиента, карта, данные или working product. `still` — параметр времени finished sample, не runtime-доказательство отсутствия движения.

| Effect | Реальная конструкция | Fallback и lifecycle |
|---|---|---|
| grid-pulse | Два 2D canvas: статическая grid + seeded agents со states run/turn/fade/wait, tails и traces 2.4s; число pulses растёт до 2.5× с area | Без GL; lifecycle 60fps/still3; RO/params/palette redraw, destroy. Не telemetry. |
| ridgeline | Seeded noise, depth-row cache, адаптивные curve samples; painter-order fills и AA strokes одним triangle strip | Near: GL surface; far: free. Ошибка/loss GL → новый 2D canvas; still6. |
| ascii-shade | Glyph atlas сортируется по измеренному ink coverage; half-resolution field, interpolation, Bayer, hysteresis; перерисовывает только changed cells | 2D 24fps/still7; fonts/RO rebuild с dead guard; no-canvas/forced → CSS dotted sphere. |
| orb-sphere | Analytic sphere normals, 3D noise, near/far stars, Fresnel; grid-search размещения вдали от текста | shader still6; CSS layered sphere. Не product viewer. |
| painterly-landscape | Sky и три слоя hills; noise dabs, lighting и calm lightness cap | maxDpr0.6/still4; отдельный full-resolution grain DOM; CSS landscape fallback; forwarding controller cleanup. |
| film-light-leak | Seeded edge/corner, exposure/halation/burn, warping, grain, breathing, vignette | 30fps/still4; grainCSS + radial fallback. Нет source photo. |
| silk-folds | Аналитические noise derivatives, fold normals и anisotropic sheen; 7-step chroma gamut search | still6; CSS cloth gradient; calm contrast targets 5.5/4.5, hue turns azure/pink. |
| fluted-glass | Analytic cylinder ribs преломляют **свой generated field**, blur2taps, clear/calm/bevel | still5; repeating ribs + fallbackCSS. **Не DOM backdrop/refraction.** |
| prism-dispersion | Beam/fan/wall spectrum/haze/sway/calm mirror | still2; CSS radial approximation; hard violet avoidance. Не физический prism trace. |
| dot-terrain | 3 fixed-point ground intersections, nearest 3rows×2points, perspective/fog/stipple | still4; CSS perspective rows и distant tone. Imaginary point cloud, не данные. |
| grain-gradient | Seeded blobs, OKLab ramp, weight-space dissolve, moving/static grain | still4; fallbackCSS; hue-distance guard может заменить accent. |
| contour-lines | Noise imaginary terrain, gradient/finite-difference GL1 branch, pixel-width/index lines/hillshade | still5; seeded SVG из 16 closed contours + radial ground. **Не географическая карта.** |
| caustics | Voronoi F2−F1/F3−F1 net, noise warp, focus/depth/calm | maxDpr1.5/still5; radial CSS. Не физическая модель бассейна. |
| spotlight-cone | Analytic lamp/cone/haze/floor pool/vignette; pool уходит от текста | still2; radial CSS. Не освещение реальных DOM объектов. |

Hue guards: fluted-glass:105–111; silk-folds:147–159; prism:112–131; orb:161–164; caustics:101–119. «Palette-derived» не гарантирует сохранение brand hue; запрет violet нельзя переносить как colour science.

### 2.3 Components и map bake

- **fx-map/component.js:** inline JSON или fetch data-cx-map → SVG paths, street names, route, station и scale. Card-aware fit, binary search, label collision culling, RO/fonts refresh; clipboard success/failure timer. Pointer/focus запускает route decoration. **Нет pan/zoom/map search/live routing.** Без данных — still contour/dot/ruled ground и fixed pin: **схематический декоративный fallback, не география**. Street SVG не требует GL; fallback может попросить effect runtime. Schema после data.box не валидируется.
- **fx-map/bake.mjs:** Node fs + fetch Overpass, `--in` offline, optional save/out writes. Polyline/ring clipping, RDP, coast chains, classification, straightness-ranked labels. Walk graph учитывает foot/access, bidirectional edges, nearest-segment endpoints; Dijkstra с binary heap до4000m; auto station150–1600m, time≈distance/80m/min. Это приблизительный static route, не проверка безопасного/доступного прохода. Fetch retry3 только по HTTP errors, **нет client abort timeout**, network throw не retry. Lat/lon проверены лишь finite, w/h и ranges не валидированы. Relation member role inner/outer теряется (`282–297`): holes могут заполниться как outer polygons.
- **fx-chart:** SVG curve/area mask, CSS fade либо still ruling; реальные pointer/arrow/Home/End/Escape readouts и table. **DATA/MAX/dates захардкожены** (`8–31`), analytics API нет. Destroy снимает pointer/key, оставляет focus/blur (`91–93`).
- **fx-progress:** sample import preview: elapsed-time progress по data-size, native progress, clipped FX, pause/IO/visibility, reduced still64%. **Нет upload/readFile/jobs/cancellation/errors.** FX mount происходит до reduced early return. Настоящий progress нужен снаружи.
- **fx-button:** hover/focus modifier, action underlying button/link остаётся в markup. Lazy async mount/dead guard, pause500ms/free4000ms; teardown событий/timers. Не submit implementation.
- **fx-tabs:** реальная local panel switching с aria-selected, roving tabindex, arrows/Home/End; flat/still pill, RO/fonts/scroll edge. Init вызывает place(current), не choose: initial hidden/tabindex — ответственность markup. Destroy не reset states.
- **fx-avatar:** sample speaker order `[0,2,1,0,3,2]` каждые3400ms, ring tracking/pause/RO. **Нет audio analysis, WebRTC или call state**.
- **terminal-run/fragment.js:** клонирует command/output markup, печатает string, рисует spinners/meter и whole20px-row scroll; reset/still через ui.js loop. **Не запускает команду и не наблюдает процесс**, зелёный check — декор.

### 2.4 Objects, moments, scenes

**Objects:**

- dither-sequence: до6 photos, ordered-dither wipe + accent front, hold2.2s/move1.5s/30fps; surviving loaded images order, hover/touch scrub, optional drift/captions. Stage kit supplies GL/lifecycle. Failed image исключается; all fail → stage fail; fallback первый surviving URL, ready после all-settled. Без src используются явно заданные stock photos. **Реальный image player**, не source provenance guarantee.
- exploded-layers: 4 sheets — photo/halftone/dither/contours — в одном canvas; hover lean/touch toggle, leaders≥560px, fit cache. First photo failure → fallback; secondary failure → first texture. **Визуальное разложение фотографии, не CAD или конструкция реального товара.** Fallback — original photo.
- photo-dither: photoGL adapter, 2/3 tones из photoPalette8clusters, blue-noise/Bayer, clean-paper/local sharpness/pointer trail8, entry0, optional breathe. photo-engraving: AA swelling lines, photo colour wash, lens двигает линии, не фото; entry0/maxScale2, optional light. Это изменение representation исходной фотографии, не генерация корректного товара.
- product-render/auto.js: URL cache → loadProduct/build.js; data attrs → mount opts; MutationObserver switches colour/view/scene; swatches с aria-pressed и product:set. **Есть local variant wiring; нет cart/price/inventory/order backend.** claimed ставится до async mount, failed load не retry; Map/document listeners/watchers без unmount API здесь (`87–128`). Реальный renderer build.js вне назначенного follow-up.
- `_print-core/lint-glsl.mjs`: без args **динамически импортирует** каждый print-* object и вызывает source(), не только читает текст. Explicit files: regex template extraction, blank interpolations, glslProblems; implicit texture() в march models запрещает. Ничего не запускалось; regex не compile proof.

**Moments:**

| Implementation | Поведение и fallback | Lifecycle предел |
|---|---|---|
| liquid-hover |128×128 ping-pong flow, 8-bit neutral dead zone, time decay, pointer displacement/shine/RGB split; DPR≤1.5/≈1.2MP. Original img для touch/reduced/GL failure | Near IO20% mount/far4s free/shared GL, RO/visibility; pending load может remount после destroy, F4. |
| photo-chapters | Native held photo wipe45% share/zoom1.06/count panel; 3–4screens; height≥600 live даже на portrait phone; reduced/short/nojs — original chapters | Переносит figures/list в stage, rest возвращает. Resize120ms timer не очищается, F5. |
| pinned-chapters |≥1024×640 live2screens, step+crossfade visual; иначе original rows/stack | scrub до переноса DOM, rest возвращает figures; timer120ms не очищается, F5. |
| line-carries-colour | Native inset cover/hairline reveal; whole-block opacity не режет слова; reduced finished | RO/fonts remeasure, release blocks; late font callback без dead guard. |
| lines-rise | Finite WAAPI masks90ms stagger/1000ms +follow800ms; mo-safe/reduced skip | fonts→once rescue; finish cancel/shows content, destroy observers. |
| closing-lift | Sticky uncover final photo/CTA, settle1.05–1.3; reduced static | focus-visible action убирает закрывающий sheet; cleanup scrub/styles/event. |

**Scenes:** powers-of-ten-pullback — log-space zoom от app screen к device +copy; parts-lock-into-the-whole — panel entrances с четырёх сторон/word FLIP/detail layers/settle/column только≥1200, **не backend сборки продукта**; dot-becomes-the-full-stop — accessible word split/moving dot/log shrink/phone2rows/optional cut, rest unsplit; fly-into-the-shape — scale SVG path numbers (arc flags сохранены)/CSS clip/3D turn/log grow, cloned face+band, phone/rest. Все используют прочитанный scene helper; source image/UI внутри — отдельный контент, app screen не означает working app.

Rest часто делает `style.cssText=''`, не восстанавливает прежний style (`powers:52`, `parts:101–105`, `fly:95–97`, `dot:93–98`). Это assumption «kit владеет узлами», конфликтующий с интеграцией в existing component. Пустая dfs__line не проверяется перед last.textContent — guard gap при изменении контента, не воспроизведённый crash.

## 3. Static findings (открыты; исправления не выполнялись)

Это **source/control-flow evidence**, не runtime incident. Находки переданы координатору отчётом. Future tooling/asset adapter owner ниже — рекомендация, не реально назначенный исполнитель.

### F1 — P1: form submit fail-open при отказе request interception

`consistency.mjs:11088–11095`: ошибка Fetch.enable подавляется `.catch(()=>{})`, затем trySubmit вызывается безусловно. `7538–7556` генерирует input/change/click events. Если Fetch.enable отказал или timed out, submit handler может отправить request в реальный endpoint; local hostname не гарантирует disposable backend.

**Fix:** fail closed: enable должен успешно завершиться, иначе forms notChecked/operational error, без submit. Будущий test: mock CDP rejects Fetch.enable → assert trySubmit не вызван; затем sandbox request trap. Не выполнен.

### F2 — P2: form PASS означает «какой-то request», не передачу формы

`11090,11102–11103`: подходящие XHR/Fetch/Ping/Document/Other GET и любые non-GET без корреляции с action/payload удовлетворяют sends. Аналитический request после click достаточен. `4451–4454` также считает похожую endpoint string send path для thank-you heuristic.

**Fix:** expected request URL/method/payload, разделение transport-observed и backend-accepted. Fixture fake form + analytics-only request должен fail; synthetic200 не доказывает успешную обработку или error UI. Не выполнен.

### F3 — P2: shared GL budget не освобождается после внешней context loss

`assets/scenes/lib.js:280–281,303,326`: take увеличивает counter; webglcontextlost ставит lost=true; destroy при lost сразу возвращается, не вызывает free. Внешняя потеря context оставляет занятый slot на window.__tpGl. Обычный destroy без предшествующей loss освобождает slot: утечка не приписывается каждому destroy.

**Fix:** separate held flag, idempotent release на loss и destroy. Test take → external loss → destroy → baseline held без double-free. Не выполнен.

### F4 — P2: liquid-hover может создать canvas после destroy

`assets/moments/liquid-hover/moment.js:72,110,202,212`: dead=false меняется лишь в fail; незагруженная img получает once load→mount. Destroy не снимает img load и не ставит dead=true; после очистки canvas поздний load снова разрешает mount.

**Fix:** dead=true в destroy, снятие load listener и guard pending callbacks. Test destroy до image load → никаких новых canvas/context. Не выполнен.

### F5 — P2: отложенный media/resize rebuild переживает destroy

`scenes/lib.js:190–191,209–214` не clearTimeout(t); `moments/photo-chapters/moment.js:120–125` и `pinned-chapters/moment.js:79–84` аналогичны. Уже queued callback после destroy может снова вызвать build/go, повесить events или переместить DOM.

**Fix:** cancel timer + destroyed guard. Test resize → destroy до60/120ms → нет is-live/listeners/DOM moves. Не выполнен.

### F6 — P2: failure start() в scene не запоминается

`scenes/lib.js:176–179`: built=true ставится перед spec.start; false/throw → rest. Следующий build начинает с локального ok=true и из-за built пропускает start, затем переходит toLive с неинициализированным spec.

**Fix:** хранить persistent result или явно retry initialization; не переходить live без успешного start. Test start returns false → media change → всё ещё rest. Не выполнен.

### F7 — P2: layout launcher может закончить exit0 при page runtime exception

`assets/layout/check.mjs:135–136,175,196,198–199`: exceptionThrown сохраняется и печатается, но exit зависит лишь от failed или findings count. Clean geometry с page exception допускает0.

**Fix:** operational/page errors дают отдельный nonzero/incomplete, не geometry finding. Fixture known page exception + clean geometry → не exit0. Не выполнен.

### F8 — P2: неполное измерение не всегда отражено в verdict

`consistency.mjs:9912,10058,11050–11052,9770`: caps14/40/16/60 screens без проверки endReached после cap; `11452–11453` без finding/recognized skip получает PASS. Часть errors — прямые push без lost mapping (`3678–3679,3730`); narrow errors не превращаются в lostFindings в финале.

**Fix:** expected/visited/endReached/limitReason по check/width; typed partial отдельно от WARN. Test long page + late intentional defect должен incomplete, не PASS. Не выполнен.

### F9 — P2: rich desktop image подавляет mobile visual probe

`consistency.mjs:1031,1060`: cache по kind+selector, не currentSrc/width/render state. Responsive picture может измениться, но later pixel check пропущен.

**Fix:** cache по source/render state либо пересъёмка responsive images на каждой ширине. Fixture same selector/mobile source becomes blank. Не выполнен.

### F10 — Качество: CSS focus без cascade, paste attribute без поведения

`4161–4168`: outline:none в одном rule даёт FAIL, даже если отдельный :focus-visible rule возвращает ring. `4236`: любое onpaste attribute считается block. Обратный риск: `4315,4473–4474` принимает unmeasured pseudo/color change за достаточный focus, даже без доказанного contrast.

**Fix:** static rule — hint; главным должен быть computed keyboard state + measured appearance. Paste выводить по defaultPrevented, атрибут — только lead. Fixtures cascade и benign onpaste. Не выполнены.

F1/F3–F7 — конкретные локальные control-flow дефекты. F2/F8/F9 — ограничения корректности verdict. F10 — источники heuristic false±. Дополнительные наблюдения map relation holes/chart cleanup/product auto lifecycle/ready unresolved выше не выданы за production incidents.

## 4. Friday: useful deltas без повторного переноса rules

Перечитаны Friday `.codex/scripts/design-lint.mjs` (303 строки), `.codex/scripts/screenshot.mjs` (152), `docs/core/templates/motion.ts` (122), `.codex/commands/preflight.md` (50), CODEX/README/review-loop. Absent ограничен этими comparator implementations. Остальные Friday области на semantic equivalence заново не проверялись; dirty role/TOML/live state этой частью не подтверждены.

| Delta | Сопоставление / статус | Future owner → target → acceptance (не выполнено) |
|---|---|---|
| Per-check/width evidence и partial/endReached | screenshot:34–38,107–139 уже даёт3viewport/full/click; design-lint:221–243 — source only. **Partial**, автоматического DOM/pixel verdict в этих scripts нет | design-reviewer/tooling → отдельный render-evidence adapter, не Stop hook. Revision/selector/crop/width/status/reason; limit и CDP failure никогда не PASS. |
| Degraded modes | motion template:33–47,86–119 уже имеет reduced logic. Delta не «добавить reduced», а проверить finished content при nojs/deadIO/reduced/GL failure/slow image | tooling+qa → sandbox fixtures; инъекция обязана успешно установиться. Для client-only app nojs может быть N/A с причиной, не global FAIL. |
| Hero maximum-content stress | preflight:14 уже требует hero-fit, screenshot не удлиняет контент. **Useful delta в осмотренной реализации** | layout QA → max-length content fixture, не правка live page. RU long words/labels/320px/font fallback. Без универсального1H/2H. |
| Native-scroll lifecycle и late async disposal | motion template — эталон, не live bundle (`1–4`); anime/reduced subscription есть, shared GPU/still baking нет. **Отдельный runtime pattern** | motion-curator/tooling → opt-in helper. Bag/IO/visibility/dead guards; исправить F3–F6 перед reuse; не копировать raw kit в роль. |
| Resource-light decoration | Still readback, one-host masks/glyph overlay, CPU glyph atlas, GL→2D fallback конкретнее общих motion rules | component-curator+performance → isolated approved component; zero active GL после still/unmount/hidden, readable base/forced-colours. Проверить реально позже. |
| Functional scope в каталоге | preflight:20,22 уже требует states/real visuals; progress/avatar/terminal — mock. **Уточнение acceptance**, не permission публиковать fake feature | component-curator → поле decorator/local interaction/backend. Demo done не receipt; реальные loading/error/empty отдельно. |
| Build-time geographic bake | OSM→SVG полезен, contour fallback не map. Эквивалент в прочитанных comparator scripts не обнаружен; глобальное отсутствие не заявлено | tooling/media owner → data-backed map adapter, provenance/rights/route caveat. Offline cached Overpass/inner holes/invalid coordinates/unavailable fetch/copy fallback fixtures. Actual walk не обещать. |
| Реальные focus states | preflight:13/19 policy уже есть; screenshot — manual. Delta — Tab/cover evidence, не WCAG certification | design-reviewer+qa → cascade/icon search/RU labels/pause/photo overlay fixtures. |

**Не переносить как hard gates:** no captions; обязательный kit hero/moment; запрет адресов/телефонов/реквизитов; все секции1H/2H; repeated CTA house count; price/year count ban; hue shift away violet; cadence2.5–4s; no-hover-change=FAIL; data-edge-free как бездоказательное исключение собственного дефекта.

Конфликты: Friday preflight:13 допускает aria-label, Taste field-label требует visible label. Friday motion template:83–97 оставляет opacity/colour до200ms под reduced, Taste запрет scroll entrance может считать это FAIL: нужна domain policy, не автоматическая находка. Friday preflight:26–38 требует настоящие реквизиты/согласия; Taste house contact ban не должен заменять production требования.

## 5. Точный остаток / handoff

1. Consistency: **1296–3358** (address+rhythm), **4865–7489** (основные DOM checks), **7590–9757** (audit/extras/more/copy/helper pixels/shader lint), **10138–10909** (runWidth/measurement aggregation). Требуется substantive чтение source, не grep/catalogue. Уже описанные thresholds не заменяют непрочитанную реализацию.
2. **64 assigned asset files unread**, каждый в ledger с gap `[1,total_lines]`. Galleries/indexes/shared CSS/diagram CSS/hero HTML/demo HTML/poster/fallback generators/UI fragments — handwritten, не classified. В частности objects/index654, components/index365, effects/gallery528 и motion/demo475 ещё не прочитаны.
3. Зависимости существуют, но эта часть **не повторяет полный аудит** fx.js/stage kit/photoGL/product build/ui.js. Наличие обоих концов import не доказывает совместимость runtime контракта.
4. Browser/pixel output/GLSL compile/CORS/map geometry/keyboard/unmount tests требуют отдельного разрешённого этапа. Сейчас запрещены, PASS им не назначен.

Артефакты: этот отчёт и `taste-close-1-coverage.json`. Полнота ledger проверяется по всем108 назначенным путям/хешам/counts/ranges; **полнота аудита ещё не достигнута**. Координатору нельзя объявлять follow-up закрытым только по наличию двух файлов.
