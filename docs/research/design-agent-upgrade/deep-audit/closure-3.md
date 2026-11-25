# Closure-3 — содержательное закрытие назначенных диапазонов

## Область, ревизия и проверяемый результат

Сэр, назначение closure-3 закрыто: **32/32 диапазона, 17 974/17 974 строк, 59 ограниченных пакетов содержательного чтения**. После чтения повторно проверены SHA-256 и total_lines всех 32 файлов против соответствующих inventory; интервалы сопоставлены с assignment без пропусков/перекрытий. Подробный ledger — `closure-3-coverage.json`. Status каждого файла намеренно `partial`: это журнал назначенных диапазонов, а не заявление о чтении целого upstream-файла; `assigned_range_complete=true` подтверждает именно назначение.

Источники: локальные source-only snapshots из assignment. Inventory revisions: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`; Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`. В этом назначении **нет Kowalski**; это не вывод о нём. Friday: working-tree контекст BRIEF, не заявление о чистом HEAD. Дополнительно полностью прочитаны локальные `.codex/scripts/design-lint.mjs` и `.codex/scripts/screenshot.mjs` для адресного сравнения; они не включены в 17 974 строки upstream.

**Verdict: PASS только completeness назначенного статического чтения. Runtime/security/a11y/performance verdict: NOT RUN.** Не запускались installers, hooks, binaries, imports upstream, tests, браузер/UI; не менялись source/config/client сайты. Тестовые assertions ниже — намерение тестов; skip/early-return ограничивают доказательность даже будущего общего зелёного запуска. Код за пределами заданных срезов не объявляется изученным.

## Содержательные карточки всех назначенных диапазонов

Порядок — Impeccable, затем Taste; исходный номер сохранён для сопоставления с ledger. Ссылки `path:Lx–Ly` указывают фактически прочитанные строки соответствующего snapshot, не git remote.

## Impeccable

### 01. `crates/cli/src/loop_connect.rs:L1–L1600`

Таблица пяти harness задаёт разные config-root/env, transport, registration и hook/version gates (0.1.4/0.2.0); account→MCP ограничен production/staging allowlist. `status` читает реальные JSON/TOML/config root, instruction override и wake record: наличие одного MCP не равно Loop-connected. Два lock и helper prerequisite предшествуют установке; ошибки отдельного агента не откатывают удачные подключения других. Journal `connect_one` восстанавливает прежнюю запись при ошибке, а не демонтирует прежнюю рабочую установку; disconnect убирает instructions/wake и применяет undo с сохранением конфликтующих человеческих правок. CLI-registration может остаться после rollback. Manual jsonc/MCP-only — отдельные допустимые состояния, не доказательство установки hooks.
Executable обязан быть absolute regular executable; относительные PATH entries игнорируются. Relative config root разрешается от cwd, дочерний CLI получает явные env и cwd=root. Interactive add kill/wait deadline 300s не распространяется автоматически на noninteractive output/post_add. Codex trust — best effort в конце. macOS quarantine проверяется read-only xattr; helper guard с 0.1.3 предотвращает неразрешённый helper. Owner/0700 support dirs, O_NOFOLLOW+flock и 0600 staging+rename — полезный установочный контракт. Cleanup Taste не удаляет изменённые человеком файлы, deepest-first удаляет только пустые созданные каталоги. Тело offer_taste и конец файла вне назначения.

### 02. `extension/walks/consent-rules.js:L81–L1680`

Это исполняемый bundled autoconsent, не только словарь. Pending eval replies, CSS hide/opacity/pointer-events и CMP snippets могут менять Didomi, __cmp, Cookiebot, Klaro/cookiereports, input/click/scroll/history. Defaults включают optOut/prehide/generated/cosmetic, heuristic выключен. `TEST` часто проверяет наличие cookie, а не семантически или юридически корректный отказ.
Multilingual detection/reject/settings учитывает русские варианты, essential-only и CCPA do-not-sell; payment/subscribe/age/adult gates исключены, тексты ≥300 символов не считаются кнопкой. Settings требует verb+noun, «подробнее» не достаточно. Реальный classifier reject→settings→accept→acknowledge расходится с комментарием о раннем acknowledge/save: accept-regex может раньше захватить save settings. Settings блокирует fallback accept; tier1 позволяет ack, tier2 — ровно одну accept. Есть off/reject/tier1/tier2, text cap 100k, snippets 200, budget heuristic 100ms. Hit-test нескольких точек, open-shadow traversal, exclusion login/text-entry, climb8/expand6 и iframe только один уровень ограничивают полноту. Продолжение TreeWalker вне диапазона. Для Friday переносить как opt-in state-changing capability, не как безусловный screenshot-preprocess.

### 03. `crates/core/src/browser/visual.rs:L4801–L6400`

Назначенный фрагмент — визуальные регрессионные тесты, а не вся contrast implementation. Проверяются median/core glyph sampling без AA edges, строгий 4.5 (4.49 fail), alpha/compositing и отличие paint barrier от display:contents. Blur при alpha≥.8 допускает pixels, .79 блокирует; малое число pixels, repaint/churn/move, unreadable SVG, running reveal дают unresolved/исключение, не фиктивный PASS. Surface/text opacity и halo/stroke рассматриваются отдельно.
Gradient layers требуют opaque ground, worklet/url/незамощённые маленькие слои могут оставаться unknown. Pseudo/photo/badges, negative-z и stacking contexts, shear seam union, sibling scrim, group opacity, washes fail→pass и echoes — отдельные twins, предотвращающие blanket suppression. Не моделируются все mask/notch/3D/rotation случаи; matrix3d unknown. maxRoutedCandidates opt-in сохраняет исходный список и сначала предпочитает уникальные designs. Image underlay может отменить ошибочный verdict на page ground. Фрагмент заканчивается внутри setup на L6400: этот тест и весь visual.rs не объявляются полностью изученными.

### 04. `crates/detect/src/regex_matchers.rs:L1–L1600`

Фрагмент реализует helpers статического Rust matcher: CSS scanner/colors/fonts/JS UTF16 совместимость, scan_js со строками/templates/braces, но не полный JS parser. Gray/background pairing ограничен markup host и exclusive ternary arms; optional chaining/nullish не принимаются за ternary. Literal cn/clsx/cx/twMerge поддерживаются; bound/dynamic/spread — unknown. Scope, inline и styled props, shorthand/logical border и source order используются вместо line-nearness.
Side-tab учитывает dominant side ≥2px и ≥2× другие стороны либо thin rounded, исключает table rows/carets/equal frames. Радиусы наследуются только по same-element &/at-rule, не descendant; Sass mixin/spread/interpolation оставляет unknown до literal reset. Nonzero numeric sx нельзя считать CSS pixels: theme units неизвестны. Cross-rule CSS index, !important, per-corner overlays уменьшают false positives. `element_declares_radius` привязан к host, rounded-none удаляется до rough helper. Neutral authored RGB/hex spread<30 отличается от цветного, функции разбирает core parser. Главная matcher table за L1600 не прочитана; не выдавать все правила за изученные.

### 06. `tests/extension-walks.test.mjs:L1601–L2918`

VM/Chrome mocks описывают security intent extension walks: pause обесценивает stale shot/input и не допускает queued writes-open; takeover/human sign-in/handback разделены. Fetch hold блокирует writes (own service 409, Document abort); SW bypass, DNR worker/newtabs/frames fail-closed; free разрешает cross-origin writes кроме own service, но не произвольную навигацию. Trusted pointer/key короткого окна, а не page fake sign-in, открывает авторизационный маршрут. После handback query URL может содержать чувствительный code: это основание проверять redaction, не runtime-доказательство утечки.
Password/card/code sensitive focus запрещает type+Enter, разрешает только Tab/ShiftTab/Escape; invisible focus блокирует даже Tab. Upload принимает только встроенный PNG и локальный drop target, отвергает arbitrary path/url/data/name/type и race с pause. Stop обрывает held operations. Есть late tab attach/socket/replacement races, old epoch replies, adopted-tab навигация только по actual click, deed timeout120s как unanswered, не no. Adopted tab сохраняется open, но UA/touch/metrics сбрасываются; Yes badge требует IOv2/dwell/anti-clickjack, No/Stop всегда доступны. Store/Firefox packaging assertions разделяют permissions, prod modules, account/devHosts и отсутствие fixture/key/staging. Это не выполненный security test и не обзор всей production implementation.

### 07. `tests/live-agent-target.test.mjs:L1–L1176`

Интеграционные тесты живого binary условно пропускаются без engine; создают temporary server.json с credential, fake SSE overlay, reaper и cleanup. Проверяют 401 credential, 400 invalid action/count/selector, semantic200 noBrowser; target8hex, text/prompt/dryrun, count1..8. Один renewable lease, holder/client identity, expiry rescue, disconnect/reconnect last connection, busy/no_match grace150ms и late replay не должны смешивать разные клиенты. Result не раскрывает credential.
Generate атомарно связывает target и journal origin=agent; duplicate/wrong session/expired/unknown target409 не добавляют journal. hideLiveBar boolean сохраняется/broadcast/reconnect; result чужого holder409. wait-for-browser отличает browser_timeout от no_browser, invalid local input не должен запускать server. CLI negative paths дают JSON stdout/exit1 и конкретные hints (bold→bolder), finally чистит процессы. Статическое чтение тестов не подтверждает корректность lease реализации в работе.

### 08. `crates/browser/tests/fullpage_screenshot.rs:L1–L1053`

Browser integration fixtures проверяют реальный JPEG/pixel/luma контракт при установленном браузере, но здесь не запускались. Tall/wide/body, fixed-inner scroll/virtual rows, RTL negative origin_x, mid-scroll shell/footer и coordinate mapping покрывают то, чего не доказывает обычный fullPage. Fixed badge/tooltip остаются только в первом tile; 4×4 sampling избегает AA.
Element screenshot временно скрывает только viewport-fixed cover с hidden_covers, оставляя backdrop-under-text, pointer-events none, transformed-CB fixed и корректные open/wrapped modal случаи. Shared tile нельзя использовать для второго cover без повторной проверки. Sticky должен появляться один раз в естественной позиции, resize должен settle; endless marquee/transform slide может остаться beyondViewport. Некоторые modal tests выходят раньше при отсутствии target shot: conditional assertion не даёт безусловного покрытия.

### 09. `tests/extension-popup.test.mjs:L1–L969`

VM stubs читают real HTML, но не являются browser a11y verification. Popup различает clean/unscanned/failed, удаляет fragment из copy URL, блокирует copy до visual-pass, epoch-защищает navigation/reload/clipboard completion, сохраняет findings при clipboard failure. Sidepanel сохраняет own-tab/issue-count contract и Stop all tabs; plan→risky confirmation→walk, edit/expiry, server Pro authority и signedout fallback Scan.
Persona max3 own, trimmed description/device/disability, data-only face; refusal сохраняет ввод. Faceless polling3/6/12/20s прекращается при уходе; Pro polling5s заканчивается на signout/success/walk. Origin-specific app cast, no persistence для loopback/.test, запрет чужих personas. Mic recognition и waveform stream имеют отдельный cleanup audio/RAF; loading dots не показывают преждевременный Send. Connected 2s once/session, inline settings, delete default No/Escape, focus/grid refresh после Yes. History имеет loading/empty/error/retry/running/signedout; Scan переживает visits и следует tab. First-run privacy→tabgroup→home once; store no-account terminal copy-only.

### 10. `crates/core/src/browser/text_geometry.rs:L1–L752`

Чистая DOM geometry логика: unions direct text Range/inline phrasing без смешивания block descendants; fallback box только при отсутствии данных. Weighted actual run fontsize/glyph advance (mono .6, proportional .5) отличает дочерний шрифт от paragraph inherited; strut и line-height учитываются отдельно. line count приближённый, zero/NaN→1. Фактический scrollWidth>client+1 отличается от CSS overflow declaration; slots/flat parent, track transform, clipping и paired animation names/count/state уточняют moving row. Infinite moving и scale-only/paused различаются. Намеренный ellipsis clamp ограничен собственным padding, не случайным ancestor clip. Встроенные positive/negative tests объясняют эти исключения; не запускались.

### 11. `crates/cli/src/entry_capture.rs:L1–L574`

Frozen entry capture связывает spec+comp hash/размеры, но не обслуживает reference как web asset. Hero/responsive1440/390, pinned Date и stableCapture/batchStability создают воспроизводимый artifact contract. Raster plates допускаются только по manifest, вне region строго <15%; reference bytes/base64 prefix ≥64 помогает ловить embed, но не доказывает выявление любого reencode. Mobile исключает plate paths и снимает первый region, не оценивает desktop placement.
Text-only использует тот же assembled renderer/fonts/dependency closure и double shot. Matching hero manifest задаёт closure, malformed manifest может молча уйти в static fallback — наблюдаемость слабее, чем hard validation. Static inventory rejects symlinks, depth12/entries8192/files1024, slash/UTF8 path requirements. Собственный renderer/browser выполнял бы page scripts; здесь его не запускали.

### 12. `crates/core/src/browser/page_checks.rs:L9601–L10136`

Тестовый хвост page_checks содержит важные exclusions, а не blanket no-nested-card: chart/canvas+caption, code/output с Copy/menu и настоящий media player отличаются от illustration+CTA, Upgrade, lone play/hidden audio/avatar video. Dialog panel first nesting exempt, role=region сам по себе не освобождает всё subtree. Cream проверяется по visible fullwidth solid bands, включая SPA overrides; alpha/image/shift/unmeasured не считаются доказанным безопасным фоном.
Hidden text не принимает fixed overlay за весь app/main, distinguishes offscreen transitioned drawer от static/3D/tiny shifted. Running opacity0→1 forwards считается shown, fill-none/missing и reversed end0 — другие исходы; infinite phase/observed running различаются. Смысл assertions изучен, detector implementation вне хвоста не объявляется проверенной.

### 15. `tests/oracle/cases/hooks.mjs:L1–L381`

Declarative oracle cases описывают inputs/expected snapshots, не самостоятельное выполненное доказательство hooks. Corpus различает post-edit types, generated/sensitive/outside/missing paths, malformed/depth/disabled/quiet, duplicate tool ID, active Stop/reentry/suppression after6 и session isolation. Claude/Codex/Github/Cursor/Grok/Hermes имеют разные output envelopes; одинаковое имя hook не означает одинаковую интеграцию. Baseline позволяет new-vs-import-only, DESIGN purple waiver, ignored linked stylesheet и image-cache без decode.
Before-edit projection Write/StrReplace/heredoc не эквивалентен cp/неизвестному content; native skip и downgrade после6 ограничивают deny. Admin corpus проверяет idempotent on/off, account override, allow rule/file/value/reason/wildcard scope, reset/migration/foreign keep. Repair сохраняет чужие permissions/hooks, broken manifest backup .bak; retired Cursor pregate→post. Это потенциальные writes настройки; они здесь не выполнялись.

### 16. `crates/browser/tests/shadow_trees.rs:L1–L336`

Shadow tests задают parser maxElements100: light40 P сохраняются, oversized shadow subtree исключается целиком, но оставшееся tree animation state учитывается. Open shadow перечисляет STYLE/DIV, closed shadow empty; disabled/checked parity и nested tree проверяются отдельно. Inner shadow scroll frame12×400 должен дать stitched≥4800; fixed shadow host и widget chrome отличаются, blank band<800. translate(0) у ancestor создаёт fixed containing block: контент на1600 нельзя ошибочно скрывать как viewport chrome. Есть skip при отсутствии/launch failure браузера; статически прочитанные assertions не означают успешно снятый screenshot.

### 17. `crates/comp/src/font_index.rs:L1–L286`

FontIndex читает JSON fingerprints, не реальные font files. Quantized vectors×1000/base36 triplets с ___ для null, feature-distance ranking, size buckets48/14/48c и cap22, finite distance, default25/max2 weights per family, optional categories и non-text-family filter дают candidate generation. Это геометрическое подобие, не проверка Cyrillic, лицензии, font load или фактического screenshot.
Malformed index часто возвращает None/default, но schema не валидируется жёстко. Локальные static robustness findings: unpack_vector режет UTF8 по byte offsets L98–111 и может panic на произвольном non-ASCII; route_size L200–210 индексирует пустой numeric список; opts.n=0 проверяется после push L274–282 и может вернуть один результат. Достижимость через внешние callers не проверена; не утверждается production exploit.

### 18. `crates/browser/tests/html_snapshot.rs:L1–L266`

Snapshot tests требуют immutable bytes и digest independent of order; mutation served/bound asset либо symlink replacement обнаруживаются verify. Strict path allowlist разрешает query у entry, но не alias /, private/bound/other, traversal, encoded dot/slash/backslash или absolute URL; entry обязан HTML. Host check404, old frozen content после disk edit и private immutable cache отделяют artifact от live filesystem.
Проверяются exact3MiB response, idle connection не блокирует следующий <1.5s, late2.5s request ещё работает, Drop закрывает connections <4s. Это важный provenance/server lifecycle contract; сервер и тесты не запускались.

### 19. `crates/browser/tests/computed_forms.rs:L1–L189`

Browser computed-rule twins показывают, почему source regex не равен rendered verdict: gray class при computed white pass, cyan/mint не равно cyan/blue, all-caps tracking не mixed-case; tiny section counters отличаются от badges. Side-bar variants включают logical/inset/pseudo/cross-rule/state CSS, hover/focus, square/equal frame/caret/grid/focus-ring negatives. Assertions требуют конкретного количества findings, не «любого совпадения». Окружение runtime rule driver за пределами файла; широкий static helper и более узкие browser tests не объявляются семантически эквивалентными.

## Taste

### 05. `skills/taste-skill/scripts/consistency.mjs:L1296–L2895`

Одна назначенная часть consistency содержит окончание address phase и большую, но не полную rhythm phase. Address имеет пять FAIL-категорий: street number, postcode, coordinates, company number, phone. Unicode/европейская грамматика, tel/sms/WA/geo/maps и query decode, JSON-LD/microdata/title/clipboard/head дополняют текст. Probe обходит shown/hidden DOM, open shadows и same-origin frames, Range crops и joined short leaves; cap300 hits, 8 на check. Телефон 7–15 цифр с stand-in/Ofcom/US555/AU исключениями и guards от цен/units/dates/SKU. Это fictional-contact safety, не универсальная privacy/compliance. Allow substring и phone last7 достаточно широки и требуют осторожности.
Rhythm открывает свой tab, прокручивает lazy content, ждёт fonts/finite animation и может кликать expansion: это side effects. Точное несоответствие viewport останавливает измерение, no viewport FAIL; прочие значения нельзя трактовать как measured. House-style SR1 требует fold-fit/нет next peek; SR2 H/2H с ±2 PASS/8 WARN, photo chapters до4H, scroll-snap FAIL; SR3 большие gaps 128–480 desktop/112–420 phone и fill55%; SR4 различает peek8/24 и две полные секции; SR5 фактически НЕ БОЛЕЕ одного h2, а не обязательный h2. SR6 требует edges/wrap/split, H1/H2 left2px, horizontal page scroll>0 FAIL с exemptions для hero/product/boxed. SR7 проверяет row alignment/heights ±2px и overflow-x>2 кроме code.wrap. Геометрия содержит sticky/moving downgrades, approximate clipping/CB chain, product/media/modal/nav/footer heuristics. Назначение обрывается внутри SR7; SR8 не изучен. Эти численные запреты не превращать в универсальную политику Friday.

### 13. `skills/taste-skill/assets/backgrounds/backgrounds.css:L1–L516`

CSS grounds связывают p→local bg/surface/ink/muted/fx/buttons, при этом paper/topglow не переопределяют page tokens. Hue remap anti-violet, dark/inverse и tint headroom зависят от внешнего backgrounds.js; комментарии о contrast7/4.5 не являются measurement. Mist/halo/grain/paper/dusk, ruled grid с heading hole, dots/arcs, stage, photo scrim и horizon — реально разные recipes, не aliases. Photo scrim .88/.80/.76, text-zone66/86 и mobile object position демонстрируют content-ground coupling.
Liquid использует два160% transform meshes26/34s; off/held pauses, reduced-motion no animation, print hidden. Зависимости: system/ui/cards, relative OKLCH/color-mix/round и SVG grain; browser support не проверен. Повторное чтение L272 сняло первоначальное подозрение syntax error: gradient скобки корректны, дефект не заявляется.

### 14. `skills/taste-skill/assets/effects/soft-light-bars/effect.js:L1–L403`

Soft-light-bars — shader effect с schema controls и deterministic seed: 4..7 bars, tilt≤22, pack уменьшает число при fit<.7, protected calm gap .12 frame у текста. GLSL имеет flat core/blur/bloom, breath10..16s, five-color OKLab ramp, CSS-pixel grain/stipple и edge/calm masks. Hue guard с несколькими sampled interpolation points избегает purple, fallback companion→ground→white, light ground даёт natural tinted shadows. Это aesthetic policy, не универсальное требование.
CSS fallback повторяет seeded layout статическими gradients. Shader handle still5/fps30/maxDpr1.5 возвращается из общего fx shader; cleanup/context loss/reduced-motion lifecycle определяет dependency, не этот файл. Перенос одного effect.js без shader/color/grain/fx не является работающим компонентом.

### 20. `skills/taste-skill/assets/icons/icon.css:L1–L186`

Icon CSS поддерживает fetched image, inline currentColor SVG и HTTP mask; sizes16..56 с optical wide logo correction. Ink/paper logo инвертируется по ground, цвет сохраняется ic-keep; landscape/portrait .7/.68 и wordmark2.4 отличают logo от произвольного square icon. Chips32/40, avatar stack, connected dot+word, integrations auto168/mosaic64, responsive list truncation→wrap и file labels overflow-wrap — реальные reusable layouts. Decorative chip не автоматически touch target44. JS/network loading/alt semantics потребителя этим CSS не доказываются.

### 21. `skills/taste-skill/assets/diagrams/demo.html:L1–L168`

Diagram gallery содержит разные topology presets: hub/ring/tree/lanes/fanin/bowtie/sync/timeline/grid/free с software/tech/gaming copy. Импортирует diagram.js, presets, cards/diagram CSS и Google Geist; icon-base local ../icons/demo. Query ids/theme/type/show/ground/labels выбирают демонстрацию; размеры card340/560, mobile300/420. Trusted local preset IDs вставляются через innerHTML, copy textContent. После fonts+dg.ready seek выбирает restT−.05 либо mid stillT и выставляет ready после RAF. Ready marker не является осмотренной графикой, backend/реальные метрики не представлены.

### 22. `skills/taste-skill/assets/scenes/descend-through-weather/scene.js:L1–L150`

Weather scene строит deterministic CPU value-noise 5-octave cloud layers560×220 и fill360×420×2, не WebGL/внешнюю картинку. Shared scene lifecycle/ease дают hold1≈2screens, phone rest; missing DOM возвращает no-op destroy со sc-is-rest. Progress stages поднимают clouds .04–.94, скрывают above>.5, по очереди hero/note/below/statement, zoom1.1/1.12 и stagger lines; aria-hidden для декора. rest очищает cssText, значит inline styles потребителя могут быть потеряны; destroy удаляет controller/layers, custom wx var остаётся. Полноту restoration/reduced guarantees определяет shared scene dependency. Два h2 внутри scene нельзя бездумно оценивать house rhythm one-heading.

### 23. `skills/taste-skill/assets/components/base.css:L1–L142`

Component base задаёт cx tokens/panel/radius/shadow/ease и selected-text fill overlays: JS positioned sibling, transparent source, knock clone без media/styles и screen/multiply masks. Forced-colors удаляет overlay и возвращает CanvasText. Ring/glow декоративны и pointer-none; pause CSS descendant animations и shared.js behavior разделены. Solid32 pseudo-hit40, inline28+8=36 не достигают Friday44; reduced CSS скрывает кнопку, но не доказывает прекращение каждого effect. Нужен общий lifecycle, не копирование CSS в изоляции.

### 24. `skills/taste-skill/assets/ui/terminal-run/fragment.css:L1–L97`

Terminal-run — CSS mock, не протокол исполнения команды. Mono13/20, pane440, row grid, transform120/fade и whole-row stream, prompt parent trimming/ellipsis, caret typing/paused. Progress accent только на scaleX180 bar, нейтральные ticks, один OK green. Reveal140 и check200..240, container379/299 hide counts/branch/parent/timings; phone100%. No actual terminal, subprocess, test results или queue в этом файле. Reduced behavior зависит от общего base.

### 25. `skills/taste-skill/assets/components/_lab.html:L1–L96`

Lab query whitelist20 components/5 palettes, выбирает effect/object/fallback/width/studio. Параллельный fetch meta/html и dynamic import, CSS onload И onerror, fonts, mount, затем фиксированные1200ms и ready marker: ошибка CSS тоже «settled», GPU-stability этим не доказана. fx maxLive4 отличается от глобального __tpGlMax16. Accent fallback при contrast<2.2→ink не означает WCAG текст4.5. Explicit effect заменяет defaults, смешанные own effects сохраняются иначе. Network fetch/import без общего catch; нужен error artifact, а не молчаливый readiness. Remote fonts и system/base/fx — обязательные зависимости.

### 26. `skills/taste-skill/assets/objects/_scenes/demo.css:L1–L72`

Object scene demo CSS задаёт .9/1.25 asymmetric hero gap56, title40..68 и9em, lede40ch, CTA44, panel520..740/radius22, cards4:3/21:9, responsive900 stack/520 gutter16. Это демонстрационный layout, не универсальная rhythm formula. Segmented toolbar30 ниже44, chip28 pointer-none — декор, не interactive defect. overflow-x:hidden может маскировать overflow вместо устранения. Радиус22 конфликтует с unconditional Friday>16 rule, значит перенос требует brand/role exemptions.

### 27. `skills/taste-skill/assets/ui/voice/fragment.css:L1–L67`

Voice mock264/orb76 использует light pearl blur7/18s CSS rotation; слово still в комментарии означает no-WebGL fallback, не отсутствие motion. has-fx на dark убирает CSS layers для внешнего orb-sphere. Talking ring/caption.72, deterministic waveform heights .35..1.15 с640/820/1040 phases, кнопки32, max300 скрывает19+ bars. Ни microphone, ни audio permission/stream не создаются этим CSS. Локального reduced-motion override нет: интеграция base/fx должна подтвердить остановку и доступный hit target.

### 28. `skills/taste-skill/assets/moments/iris-opens/demo.html:L1–L64`

Iris-opens demo — fictional Nodeline pipeline dashboard, dark sage hero split OnTime/Late/Idle, flipped photo section и ground-inverse iris-opens from alerts. Модуль moments.js и preload moments/lib/moment, system/demo/momentCSS и remote Schibsted/Hanken обязательны. Ранний mo-js + mo-safe2500ms — fail-safe от навечно скрытого init, не доказательство smooth animation. Explicit photo alt/dim, footer credits/demo label; placeholder # links, реальных pipeline данных нет. Сам moment implementation не входит в файл.

### 29. `skills/taste-skill/assets/moments/closing-lift/demo.html:L1–L59`

Closing-lift demo — white/sky Northbound cycling. Portrait road4:5, FAQ sheet и under beach image+CTA находятся в data-moment wrapper с settle1.18/focus50%60%. Две секции под wrapper требуют contextual section parsing; direct-main heuristic может их потерять. Длины30..62km, bike45€/day, ride640€ и группа8 — пример content specificity, не реальные оферты. Unsplash attribution, alt/dim, mo-safe/font/module зависимости указаны. Booking/FAQ backend отсутствует; эффект изучен только как integration markup.

### 30. `skills/taste-skill/assets/moments/liquid-hover/demo.html:L1–L47`

Liquid-hover — отдельный dark/sky Northbound demo, не byte alias closing-lift. Content-first hero photo figure strength.8, desktop16:8/mobile4:5, далее guesthouse split; alt/dim и отдельные Unsplash credits. Remote fonts, system/demo/momentCSS, mo-safe и moments runtime такие же по интерфейсу, но layout/options/copy различаются. Distortion/pointer/reduced behavior нельзя приписать HTML без moment.js; цены и жильё fictional demo, ссылки #.

### 31. `skills/taste-skill/assets/ui/diff-review/fragment.html:L1–L40`

Diff-review fragment — статический mock harbor/api settle.ts: old/new line numbers, del/add/word marks, cfg.max/backoff/log и suggestion8000→cfg.timeout. data-diff-target/sug/act/apply задают внешней animation state spinner→Applied, но не изменяют репозиторий. Apply button tabindex=-1 недоступна через обычный Tab standalone; для декоративного mock это осознанный интерфейс, для продуктового review tool потребовались бы семантика/focus и настоящая операция. Embedded code не исполняется, TypeScript icon ожидает assets/ui/icons output root.

### 32. `skills/taste-skill/assets/ui/calendar/fragment.html:L1–L31`

Calendar fragment — fixed October2026, range12..16, today9, marked24, adjacent month days, kickoff12/drafts16/launch24. data-cal-range/data-d/data-ev — hooks для внешней визуализации; days/nav spans, nav aria-hidden, нет интерактивного picker/grid/keyboard contract. Это не реальная запись в календарь, time zone, availability или deadline source. Подходит как иллюстрация состояния, не как готовый production calendar.

## Сравнение с реально прочитанным Friday

Сравнение ниже ограничено двумя локальными script implementation. Readable инструкции/дизайн-система могут требовать большего, но это не доказывает executing enforcement и не означает отсутствие другой capability во всём Friday.

| Смысл | Friday evidence | Классификация и существенный delta |
|---|---|---|
| Gray text на цвете / contrast | `.codex/scripts/design-lint.mjs:20–26,221–241`: две regex на одной строке; hint утверждает `<4.5:1`, ratio не вычисляется | **partial**. Upstream computed_forms и visual tests различают computed override, stacks, opacity, pixels, unknown. Friday hint не следует выдавать за измерение. |
| Side-border decoration | `design-lint.mjs:28–32` ищет только `border-l-4|border-r-4` | **partial**. Rust helpers учитывают same host, scope, logical borders, frame/caret/table, !important и unknown. Browser intent ещё отличает rounded/square/state. Нужен parser/context, не расширение regex любой ценой. |
| Палитра и typography | `design-lint.mjs:9–17,115–184,187–219`: global Inter/Arial и gradient запрет, project MASTER hex/font extraction, 4px spacing | **partial / conflict**. Brand-scoped MASTER уже есть — не предлагать его заново. Upstream font candidate index — другой, measurement-oriented инструмент, в этих scripts отсутствует; generic font blacklist не равно candidate selection. Taste anti-violet house policy может конфликтовать с утверждённым брендом. |
| Border radius / hit targets | `design-lint.mjs:40–51`: подозрение h1..4/w1..4 и radius>16 | **conflict** с Taste demo radius22 и pause/voice/toolbar targets32/36/40. Не переносить размеры как production defaults. Это также **partial enforcement** Friday: class regex не измеряет реальный hit region и роль элемента. |
| Snapshot геометрия | `.codex/scripts/screenshot.mjs:34–38,107–138`: 1440×900/834×1112/390×844, DPR1, fullPage option | **partial**. Multi-viewport уже есть; не предлагать его как отсутствующее. Но inner-scroller stitching, RTL offsets, shadow/fixed/cover evidence, immutable asset provenance в этих scripts **absent in inspected scope**. |
| Capture readiness/errors | `screenshot.mjs:113–139`: DOMContentLoaded, click catch снимает as-is, wait1200; ошибки navigation→continue; finally browser.close `141–143` | **partial**. Cleanup есть. Fonts/scene readiness, repeated-frame stability, frozen digest и явный failed requested-state artifact в этом script не реализованы. Taste lab тоже имеет fixed1200 и CSS-onerror-ready, то есть не идеальный эталон. |
| Enforcement verdict | `design-lint.mjs:276–303` печатает findings и всегда `process.exit(0)` | **partial**. ERROR — уровень текста, не CI rejection. Upstream oracle intent различает predeny/postadvice/stop/suppression. Нельзя называть Friday ERROR hard gate без отдельной политики. |
| Fictional contacts, SR rhythm | Address/rhythm в Taste `consistency.mjs:1296–2895`; в двух Friday scripts аналогов нет | **absent in inspected scope**, не repository-wide absence. Address useful opt-in для synthetic content, но brief-approved real contacts должны сохраняться. Exact H/2H, gaps128+, bans scroll-snap не universal QA. |
| Walk consent/security и MCP install | Impeccable loop_connect/consent-rules/extension/live tests | **not applicable** как быстрый lint patch. Это отдельные stateful capabilities с привилегиями, lease/epoch/trust/recovery, не набор aesthetic prompts. |
| Decorative UI assets | Taste calendar/diff/terminal/voice и moments demos | **not applicable** как готовая бизнес-функция. Полезные references/recipes, но fake test results/calendar/review actions не должны выглядеть настоящими в клиентском продукте. |

## Открытые статические findings и приоритеты

Это самостоятельные выводы по исходникам, не runtime bugs с воспроизведением. Владельцы ниже — **предлагаемые роли**, не реально назначенные люди; upstream и Friday здесь не менялись.

1. **Font index robustness — средний приоритет, условная достижимость.** `impeccable/crates/comp/src/font_index.rs:98–111` byte-slices произвольного UTF8; `200–210` индексирует numeric sizes без проверки пустоты; `274–282` n=0 проверяет после push. Target: upstream font-index maintainer. Expected tests: non-ASCII packed input возвращает ошибку/None без panic; sizes=[]/caps-only валидируются/маршрутизируются явно; n=0 возвращает []. Caller prevalidation не проверена, exploitability не установлена.
2. **Observation ≠ decision.** `Friday design-lint.mjs:20–26,300` говорит «контраст <4.5», но не измеряет и не делает nonzero exit. Target: Friday design-QA maintainer, proposed `.codex/scripts/design-lint.mjs`. Output: separate heuristic suspicion/measured fail/unresolved и явно selectable CI policy; tests computed-white override, class false positive, ERROR exit policy. Не менять ради совместимости текущие pipelines без отдельного согласования.
3. **Readiness/provenance delta.** Target: Friday capture maintainer, proposed `.codex/scripts/screenshot.mjs` и отдельный новый evidence helper. Output: URL/viewport/DPR/requested-state success/fonts/stability/asset digest manifest, refusal/error artifact при несостоявшемся click. Tests late-font, finite/continuous animation, inner shadow scroller, fixed-underlay/cover, RTL, asset mutation. Переносить по этапам; existing screenshot workflow сохраняется.
4. **State/consent безопасность — высокий риск только при будущем adoption.** Target: proposed browser-automation security owner, отдельный capability design, не текущий rollout. Требуются explicit opt-in autoconsent, user-visible side effects, trusted-human epochs, sensitive-field block, fail-closed network hold, adopted-tab cleanup, redacted callback telemetry. Extension tests дают список acceptance scenarios, но не сертификат безопасности. Callback fixture с чувствительным query code не доказывает, что production log его записывает.
5. **Taste assets требуют dependency contract.** Target: proposed design-system/motion owner, future asset manifest. Expected output: recipe+fonts/icons/modules/CSS/runtime/reduced-motion/forced-colors/cleanup contract и явная маркировка mock. Tests destroy/rest сохраняет чужой inline style, CSS failure не ready, reduced stop (а не только hidden pause button), real hit≥44 у interactive controls. Do not copy demo radius/house hue/SR thresholds как универсальные запреты.
6. **Contact allowlist не должна быть обходом по случайному совпадению.** Target: proposed content-QA owner. Address substring/last7 normalization удобна для brief exceptions, но слишком широка как самостоятельная authorization. Expected tests country prefixes, overlapping numbers, hidden/shown на разных widths, approved actual contact, invented contact. Включать только по content mode brief, не автоматически на клиентском сайте.

## Что сознательно не утверждается

- loop_connect L1601–1900, matcher table после1600, visual.rs вне4801–6400, page_checks до9601, extension tests до1601 и продолжения consent/rhythm не прочитаны в этом назначении. SR8 не оценён; это не uncovered assigned work.
- Ни JSX/CSS scan, ни comments «contrast7» или «reduced», ни vm assertions не заменяют rendered evidence. Не проверялись webfont availability, Cyrillic coverage, licenses, frame/GPU performance или работа browser/engine.
- Демо с разным HTML/CSS прочитаны отдельно, не объявлены aliases по имени или похожему boilerplate. Все назначенные text ranges содержательно прочитаны; classified/metadata-only не подставлялись вместо чтения.
- Изначальное подозрение broken topglow gradient L272 после повторного контекстного чтения снято. В список дефектов оно не входит.
- Секретные значения не включены. Пример callback authorization query рассматривается без значения. Source/config/client files не изменялись; выполнялись только безопасные чтения и запись двух назначенных отчётов.

## Ledger и метод верификации

`closure-3-coverage.json` содержит repo/path/SHA256/total_lines/status=partial/ranges/substantive_note для каждой строки назначения. Ranges — реальные 59 пакетов, а не механическое переименование assignment в full. Для каждой записи: сортировка ranges, первый start=assignment.start, каждый следующий start=previous.end+1, последний end=assignment.end; повторный hash и splitlines count соответствуют inventory. Сумма длины интервалов=17 974, count=32. Русские содержательные карточки сохранены также в ledger; исходные incremental reading notes сохраняют границы и конкретику пакетов.
