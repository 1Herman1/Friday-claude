# Impeccable — закрытие impeccable-close-4

## Вердикт и границы

**Назначенное substantive-чтение закрыто: 125/125 файлов, 51 079/51 079 строк, каждый файл `full`.** Это не inventory-PASS и не runtime-PASS. Все назначенные тексты прочитаны последовательными ограниченными диапазонами, осмыслены и снабжены индивидуальной заметкой. Ранее усечённые диапазоны UI дочитаны отдельно. Поиск ниже использован только для уточнения ссылок, не как основание `full`.

- Assignment: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/followup-assignments/impeccable-close-4.json`.
- Upstream: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, HEAD **9e460a87ef338ee9d12c7beed8fedc597a5af5f7**; текущий HEAD прочитан read-only git-командой.
- Friday: `/Users/germanbryzgalov/Friday-claude`, HEAD **388ec708f39583172d7f36110f6424cc175b5512**. Сравнение относится к прочитанному working tree, а не утверждает отсутствие чужих dirty edits.
- Ledger: `impeccable-close-4-coverage.json`; для каждого пути: SHA-256 фактических bytes, `status`, полный диапазон `[1,total_lines]`, количество строк и substantive_note.
- Финальная механическая сверка: scope assignment = scope ledger, 125 уникальных путей; SHA/длины/диапазоны/status/непустые заметки проверены, расхождений нет. Эта сверка подтверждает привязку чтения к содержимому, но сама по себе не заменяет чтение.
- Роль researcher адаптирована к Hermes; лимит 15 файлов отменён заданием. Делегирования, импорта/запуска upstream-кода, тестов, binaries, hooks, installers, браузера и изменения конфигураций не было. Записаны только два собственных audit-файла.

**Инженерный verdict: переносить механизмы выборочно после исправления открытых статических находок.** Наличие тестов, parity-комментариев, manifests и interface traits не доказывает работоспособность на машине пользователя. Предыдущие `impeccable-content.md` / `impeccable-runtime.md` — контекст; этот follow-up закрывает только явно назначенные файлы и не переписывает их verdict.

| Область assignment | Файлы | Строки | Результат |
|---|---:|---:|---|
| HTML engine + cascade/parser | 32 | 18 653 | full |
| comp-verbs, включая parity test | 14 | 11 374 | full |
| scripts + scripts/lib | 33 | 7 249 | full |
| hook | 9 | 6 261 | full |
| browser-bundle | 10 | 3 230 | full |
| component-review | 18 | 2 699 | full |
| core: decorative/third-party/snapshot bridge | 3 | 1 352 | full |
| CLI capture examples | 6 | 261 | full |
| **Всего** | **125** | **51 079** | **READ_COMPLETE** |

## 1. Реально реализованные цепочки

### 1.1 Static HTML: не браузер и не оценка дизайна целиком

`engine.rs:197–267` принимает файл/исходник → html5ever DOM → сбор доступных CSS → частичная cascade → optional image decode-ahead → упорядоченные element/page проверки → design-system вывод → один custom rule-pack pass (`engine.rs:539–559`). `STATIC_ELEMENT_RULES` начинается на `engine.rs:131`; упаковка findings и waiver-политики отделены от вычисления checks. Static rule-pack имеет приоритет над текстовым: оба не запускаются по одному HTML дважды. Profiling callbacks — внешние callbacks; гарантий изоляции их panic из чтения не следует.

`dom.rs:97–119,328–386` нормализует template fragments и синтетические html/head/body под прежний JS DOM. Это осознанно не полная браузерная семантика: различаются построение таблиц, uppercase attributes, noscript, adoption agency. Query включает script/style, но plain-element children/cascade исключают их (`dom.rs:683–710`); textContent сохраняет payload. Unsupported selectors кешируются и возвращают пустой результат, а не исключение (`dom.rs:433–494`). `select.rs:168–244` поддерживает structural selectors и css-select aliases, но hover/active/visited сами не совпадают, focus/target/pseudo-elements отвергаются; hover/placeholder разобраны отдельными проходами. :lang — упрощённый prefix matching. Списки alias и :empty имеют JS-совместимую, не универсально браузерную семантику.

Cascade: tolerant tokenizer → AST/parser → generator → flatten collector → regex specificity + important/inline/source order → inheritance/defaults. CSS-tree port — subset; Raw recovery, zero-progress guards, CSS string escapes, numeric-space divergence намеренно сохраняют пригодность shorthand-парсера. `parser.rs:1193–1238` хранит at-rule prelude как Raw; collector не вычисляет media/supports условия. Layer priority, browser layout, @import fetch, CSS nesting/container query semantics полноценного браузера здесь не реализованы. Радиусы под неподдержанным правилом могут стать unknown вместо ошибочного square; неизвестность через unread stylesheet/utility classes доходит до side-accent gate (`background.rs:643–660`). Это полезный fail-conservative подход, но не доказательство общего покрытия CSS.

Сборщик читает local linked CSS, не remote stylesheets; root-relative path ищет project-like ancestor, но обычные ../ и symlinks не имеют общего filesystem sandbox. HTML-разбор сам не исполняет scripts. Не надо путать read-only engine с отсутствием IO: linked stylesheets читаются с диска, sampling имеет cache writes.

### 1.2 Checks: конкретные design-правила и пределы

- **Типографика.** `page.rs:41–73` ищет overused primary face по direct text, без универсального visibility gate; flat hierarchy использует видимость предков и размеры 8≤px<200 (`page.rs:83–137`). `quality.rs:970–1020` — leading ниже 1.3 с округлением, heading/caps/code/fine-print исключениями. Tiny body text <12px отделён от functional UI text с разными floors и 0.1px tolerance (`quality.rs:1054–1145`). Uppercase long-run и tracking проверяются по контексту/CJK (`quality.rs:1148–1231`). Это не запрет любого маленького/моноширинного/uppercase текста.
- **Layout.** Nested cards — признаки shadow/border/radius/background, а не измеренные карточки. Есть dialog, media player, caption/figure и monospace-output исключения; deepest instances группируются по outer panel (`page.rs:211–503`). Output classifier ограничен 2000 узлами и долями 60%/90%/80%, а не названием класса. Repeated container text ограничен 250 descendants, текстом 4–48 UTF-16 chars с ASCII letters и минимум тремя различными структурными местами (`page.rs:523–635`).
- **Spacing.** Без rect не работают line-length/viewport-edge/measured cramped-padding. Отдельная static flush-boundary эвристика всё же работает: 2px inset threshold, 4px child insulation, depth 4, отрицательные offsets/margin collapse/transparent shell/flex centering (`quality.rs:448–961`). Unknown lengths могут снимать finding; это не геометрическое доказательство.
- **Цвет и изображения.** Analytic surface walk и image-ground walk — разные цепочки. Первый может завершиться opaque color до image; второй разбирает URL layers, washes, clip/origin/repeat/attachment и знает, когда прекратить вывод (`background.rs:305–403,1062–1327`). Градиенты без layout оцениваются по stops, не по фактической точке под glyph. Неизвестные paint/filter/blend/pseudo-layer прекращают sampling. Blur/drop-shadow read-through — эвристика среднего цвета.
- **Contrast adapter.** Disabled controls, hidden markup, glyph/icon/emoji, text-clipped ancestors и повтор уже scored ancestor имеют отдельные исключения (`adapters.rs:1057–1322`). Дедуп получает keep-predicate до claim: ignored первая ссылка не должна скрывать остальные. Декоративность понижает severity, а не даёт произвольный blanket waiver. Image sampling заменяет analytic answer и при PASS, и при FAIL (`adapters.rs:1238–1269`). Placeholder оценивается только у пустого подходящего control с явным ::placeholder style; visible field label может демотировать finding.
- **Interaction/motion.** Hover — реконструированный CSS pass, не реальная наведённая мышь (`adapters.rs:1633–1744`). Icon tile использует static declared sizes/zero coordinates; clipped overflow — structural positioned-popover/axis эвристика с nearest owner и intentional viewport исключениями (`adapters.rs:2285–2328`). Motion/glow/hero-eyebrow/italic serif/side stripe/GPT border-shadow и hard-offset shadow делегируют pure core checks. Broken-image здесь проверяет наличие usable src/srcset/binding, **не HTTP 404** (`adapters.rs:1953–1973`).

Общий decorative classifier в `crates/core/src/checks/decorative_text.rs` различает avatar initials, brand/ghost type, mockup, micro-label и прочие формы, а не просто `aria-hidden` или слово mock. Пороговые примеры: ghost brand 120px либо 80px+3×H1, opacity .25; avatar 12–72px, aspect .8–1.25, 1–2 letters. Тесты классификатора прочитаны, не запускались. `third_party.rs` содержит vendor signatures/stack heuristics и attribution, не полноценный license bundle и не доказательство происхождения всех frames.

### 1.3 Image sampling: bounded decode, но cache — не evidence store

`image_sampling.rs:38–62,623–676`: local file/base64 only, 24MiB compressed input, 8192 side, 24MP header budget, decoder allocation limit 128MiB, повторная проверка header на реально декодируемых bytes. JPEG completeness проверяется marker scan. Выход — 6×6 alpha-weighted средние небольших boxes, квантованные для одинакового cold/warm результата; не actual pixel контраст под каждой буквой.

CacheOnly hook не открывает изображение: stat + persistent JSON (`image_sampling.rs:367–413`). Decode-ahead использует до четырёх scoped threads. Per-document URL/node misses, process cache до 256 entries, persistent default HOME/.impeccable/sample-cache. Key файла — path+size+mtime, не content hash; data URI — FNV64+length. Writes tempPID→rename best effort (`image_sampling.rs:477–568`). Прочитанные тесты **намеренно** сохраняют прежний результат после подмены same-size/mtime файла (`:907–923`) и принимают отредактированный cache sentinel (`:959–984`): это speed cache, не trusted provenance. Cache JSON читается без собственного byte cap, GC не найден в этом модуле; read failures молча дают skip. Feature-off stub не декодирует вообще.

### 1.4 Comp build: evidence/state machine, а не универсальный quality gate

`comp-verbs/src/lib.rs` оркестрирует comp-spec, comp-diff, font-match, build-phase; FontRenderer/EntryRenderer/OrganicScan инъецируются. `asset_capture.rs` валидирует finite viewport/region limits, 1–4096 dimensions, 16MiB asset/64MiB reference; default batch не поддержан. URL policy — обязанность adapter, не trait. `entry_capture.rs` задаёт capture/freshness interface, но само не является браузерной реализацией.

`build_phase.rs` реализует восемь фаз **comps → spec → plates → hero → sections → motion → responsive → review**. Comps: минимум три варианта+sidecars, ровно один approved. Approved comp связывается с decoded RGBA identity, а не только названием файла. `approved_comp.rs` хранит исходную копию/record и допускает legacy context; это не cryptographic user consent. Утверждения о consent не выводятся из существования sidecar или английской строки force.

`comp_spec.rs:587–708`: уникальный непустой id, известный kind, note минимум восемь characters, geometry минимум 1px, material/painted-note и code-area проверки. 10×10 inclusive grid, mask/coverage, uncovered detail cells, snap сохраняет минимум 95% геометрии. English painted-note classifier и independently supplied medium/kind остаются heuristic inputs; rasterkind сам по себе не обеспечивает material semantics. Автоматическая band draft помечается как draft, не измеренный element map. Prior typography переносится при равных pixel hash/kind/medium/box/px/text, не просто одинаковом id. Map inspection создаёт owned новый каталог, numbered filenames, crops/masks/contact sheets/escaped HTML; cleanup ограничен собственным каталогом, это диагностический вывод без approval.

Plate gate требует min(1536,1.5×) resolution, проверяет anti-crop/material similarity и hash-bound receipts. Gate reasons отделены от raw metrics. Hero min .72 и responsive .65 (`build_phase.rs:31–32`); accepted human viewport с общим .95 может смягчить numeric, но не material reasons. Native capture opt-in fail-closed: unavailable не превращается в manual fallback; есть verify_current и финальная recapture связанного input manifest. Manual screenshot mode хранит input fingerprint, **но не доказывает, что screenshot снят именно с этих inputs**. Mobile artifact проверяется на наличие; равнозначного fidelity-gate мобильной композиции в прочитанной реализации нет. Sections/motion/review не обеспечивают автоматически working interactions, a11y или reduced-motion.

Completion проверяет phase/session ownership, artifact/input fingerprints, post-finish drift. Frontend tree fingerprint отказывает symlinks и ограничен 10k files/256MiB (`completion.rs:53–91`); hidden/node_modules/target исключены. Это объявленная verification scope, не all-dependency attestation. Receipt должен инвалидироваться после изменения source/assets; игнорируемая запись state — отдельная находка ниже.

Font-match меряет crop, shortlist/catalog candidates + variants, рендерит тот же текст/weight через injected renderer, выдаёт top candidates/proof best effort. Width >10%, weight >15% расхождения имеют смысл только для измеримого lettering; слишком маленький/unseparable crop не выдаётся за точную идентификацию. SHA1-short stamp проверяет согласованность полей, не авторство. Catalog build латинский; нельзя прямо переносить на кириллицу Friday.

### 1.5 Hooks: envelope normalization и реальные filesystem side effects

`hook_lib.rs` нормализует provider events → project/path/extension/generated/sensitive fences → bounded target/related-file selection → detector → cache/baseline → filter exceptions → bounded findings. Default 5 findings/8000 UTF-16 chars; файлы до 128KiB, до шести related targets. Canonical nearest-existing-ancestor containment (`hook_lib.rs:2476–2523`) полезнее lexical prefix. JS UTF16 helpers и BOM/preimage handling не означают произвольный binary support.

`before_edit.rs` — отдельный retired Cursor preToolUse path: heuristic shell projection без запуска shell, temp HTML/CSS, 1MiB/path fences и fail-open при невозможности надёжно проверить. Повторный deny signature ограничен, после шести блокировок предупреждает и пропускает. Поэтому это не security boundary. Не приписывать такой blocking loop post-edit providers.

`hook_sessions.rs`, `stop_baseline.rs`, `stop_discovery.rs`, `hook_claim.rs`, `build_completion.rs` дают hashed private session state, preimage/baseline allowance, bounded old-session sweep и O_EXCL claims. Stop-discovery key из metadata/direct CSS refs не равен полному content/transitive graph fingerprint. Hook cache имеет ограниченное число sessions; merge-lock для всех конкурирующих read-modify-write не установлен чтением. Админка умеет status/consent/on/off/reset, JSONC backup и merge own hooks; user config atomic, некоторые nonuser записи direct. Reset не гарантирует удаление всех ранее repaired global targets. Реальные эффекты: git excludes, config/cache/audit writes и hook manifests; факт генерации manifest не доказывает live activation.

Provider transformers различаются существенно: Claude launcher shell/Windows fields, Cursor anchored Write postToolUse, Gemini session/completion без эквивалентного edit check, Codex dir-derived path. Missing launcher может сознательно завершаться success/no-op. Нельзя считать эти adapters byte-identical aliases или одинаковым runtime контрактом. Ignore-value с reason и scoped file отличается от blanket ignore-rule; prompt советует писать user confirmed только если user действительно подтвердил (`hook_lib.rs:1352`), но текстовая рекомендация сама не является проверкой actor.

### 1.6 Browser bundle и review UI

Browser bundle — страницы/extension bridge, а не набор автономных pure checks. Header/footer и captured natives собирают общий execution closure; захват natives не защищает все prototypes. Probe читает CSSOM/open shadow, CORS sheets пропускает. Scan-common/visual/scan оркестрируют common core и async image/pixel IO, generation guards покрывают не все continuations. Same-window postMessage marker не следует считать аутентификацией отправителя.

`15-snapshot.js`: geometry/styles/attrs/media/states/animations, style interning, container probes с restoration, bounds 30k elements/48MiB (`:73–74`). Ограничение bytes сравнивается с UTF-16 JSON.length **после** построения (`:970–971`); это не allocation cap и не UTF-8 byte count. Нет iframe internals/closed shadow. body.innerText/attributes могут захватить больше, чем excluded node walk; snapshot — потенциально чувствительные page data. Font/drawable caps и timeout не дают полной render fidelity, hit-test может уже относиться к изменившейся странице.

Offscreen driver держит один loaded snapshot, продолжает coroutine через scan-continue (`60-offscreen.js:44–70`). Отдельный snapshot bridge `crates/core/src/browser/snapshot.rs` лишь reexport/protocol entry; foundation implementation — внешняя зависимость назначенной области. CLI capture examples — демонстрации loopback protocol/capability и injected service; не production proof. Service limits включают header/body/capture TTL/count/bytes; capability в argv request-example может быть виден process listing, HTTP status не проверяет всю семантику ответа.

Component review model: решения привязаны к packet/component revision, missing marks, inventory confirmation и stale invalidation (`model.ts:37–69`); grouped code instances отличаются от raster geometry. Model tests проверяют намерения этих invariants. Plan v3 guard (`plan-model.ts:37–39`) — discriminator, не full runtime schema validation. View `review.ts` экранирует текст, ограничивает URL http(s), рендерит iframe с empty sandbox (`:15,244`), использует native dialog/inert и запрещает send при незавершённом edit. Реальная запись/actor validation находится за adapter; UI нельзя считать достаточной авторизацией.

Plan-review: flagged queue, split/reclassify, missing marks, same-scale pair/loupe, undo 6s, localStorage только hint; custom modal не наследует всю a11y семантику native dialog. CSS содержит light tokens/локальные overrides и неполное forced-colors/reduced-motion поведение; generated kit CSS provenance не доказывает license compliance. `viewport.test.ts`, model/plan-model tests прочитаны, не запускались. Button/Space и timer lifecycle остаются static review leads, не воспроизведённые UI bugs.

### 1.7 Build/release/test/support scripts: точные эффекты

- `build.js` читает canonical skill/commands/registry, генерирует provider variants/hooks/version/dist, удаляет/пересоздаёт output subtrees; universal ZIP создаётся до всех validations. Ошибка поздней проверки не откатывает ранние записи. Token budget приблизительно bytes/4, не реальный model tokenizer. Root-command sync сохраняет неизвестные local files/dirs. Version validation требует совпадения присутствующих derivatives; отсутствие optional output не равно ошибке. Manifest validator проверяет loader surface, не live install.
- Extension emitters/manifests формируют Chromium/Firefox variants и permissions; Firefox min140 декларативен. Import graph статический и не включает произвольный dynamic import. VSCode/OpenAI/Cursor/Codex capabilities — metadata, не proof реально вызванного hook. ZIP helper streams archive, включает dotfiles кроме DS_Store и отвергает пустой output.
- `sign-bundle.mjs` Ed25519 связывает version/artifact/size/hash в schema1, ограничивает 256MiB, self-verifies; private material идёт через op pipe, ошибки redacted/PEM zeroed best effort. Никаких ключей/credential values аудит не считывал и не сохранял.
- `release.mjs` проверяет clean/pushed/changelog, build/tag/assets/sign → push tag (`:338–344`) → GitHub release. Нет транзакционного rollback после push. Dry-run не следует переводить как offline: read-only network probes/fetches остаются; разные components имеют разные publish contracts.
- `publish-platform-packages.mjs` скачивает binary+mandatory SHA sidecar, stages platform npm, registry retry/skip; dry-run тоже скачивает/stages/npm dry-run. `check-loop-release.mjs` HTTPS/loopback, redirects≤10, deadline и streamed hashes; пустой manifest может дать ноль verified. `check-engine-release.mjs` parallel5/retries4 проверяет доступность/range/sidecar/registry, обычный check не доказывает digest всего binary/npm archive; record заменяет manifest.
- `run-tests.mjs` — serial suite expansion, Bun или Node concurrency4, detached process groups, wall clock kill, opaque run/repo markers и orphan sweep 10×200ms. Env skip leak возможен; command.wallClockMs имеет приоритет над default override. process-group leader exit не гарантирует смерть descendants. Live process enumeration зависит от Linux /proc или BSD ps -E, Windows даёт пустое покрытие. Reaper EOF/error cleanup best effort. Эти исходники прочитаны, сам runner не запускался.
- Rust changed-tests selection строится из Cargo metadata/reverse deps + heuristics external string refs; это экономия, не доказательство отсутствия влияния. --print всё ещё выполняет git/cargo metadata, не pure offline parser.
- launch-smoke/staging-cli-e2e делают реальные install/OAuth/uploads/credential rotation/logout; opt-in forgetting может удалить историю. Unsupported INFO skip не равен выполненному assertion. Provider smoke ещё опаснее: конкретная находка F07.
- Promo tile/icons требуют Puppeteer и пишут PNG, tile содержит фиксированные promotional counts — не результаты измерения. Kinpaku sync зависит от sibling/private tree, exact selectors/docsrail delimiters и делает immediate writes без rollback. Font index требует Playwright + отсутствующие legacy modules (F01); latin300/400/700 и two-pass calibration, batch20/schema2/resume, font8s/page30s timeouts.
- GitHub sheriff использует contributor-responsibility clock, а не просто возраст PR; CI не объявлен contributor blocker, 7d warning/14d close, maintainer handoff/never-close/security exemptions. PR/comments/label-events пагинируются, но reviews/threads/thread-comments/draft timeline имеют bounded windows. Apply меняет comments/labels/state последовательно без re-fetch/rollback. Это unrelated maintenance tool, не Friday design feature.

## 2. Открытые статические находки

Все ниже — **static findings, не выполненные exploits/reproducers**. Severity — приоритет исправления; owner ниже только предлагаемая зона ответственности, реальный владелец не назначен. Findings не исправлялись в audit-only scope.

### F01 · P1 · Два support entrypoint не замыкают imports

`smoke-provider-hooks.mjs:15` импортирует `scripts/lib/cli-args.mjs`; файла нет в данном snapshot. `build-font-index.mjs:29–31` импортирует `skill/scripts/lib/font-fingerprint.mjs`, `png.mjs`, `font-index.mjs`; все три отсутствуют. Существование точных путей проверено Python is_file; никакой запуск для вывода module-not-found не выполнялся. Это блокер указанных entrypoints **в source snapshot без дополнительной генерации**. Не утверждаю, что весь runtime неработоспособен. Fix: восстановить tracked deps или явно задокументировать/проверить generator prerequisite; expected test — read-only resolver всех relative imports перед runtime CI.

### F02 · P1 · Successful phase/spec вывод при провале persistence

`build_phase.rs:152–159` игнорирует create_dir/write state errors; `comp_spec.rs:1368–1371` игнорирует запись и печатает WROTE. Аналогичные best-effort ветки crop/grid (`:1214–1257`), font-match spec (`font_match.rs:415–417`), initial approved-comp keep (`approved_comp.rs:150–164`). Дисковая ошибка может оставить UI/CLI успешным без сохранённых evidence/state. Исправление: typed Result, atomic write и явный ненулевой exit до сообщения успеха; test intent — readonly destination/disk-error injection не должен выдавать WROTE/advanced. Не смешивать это с допустимым best-effort performance cache.

### F03 · P1 · Region id становится filesystem path

`comp_spec.rs:597–605` требует только непустой unique id. `comp_diff.rs:575–581` делает `out_dir/regions/(id+'.png')`; `:550–555` создаёт parents и пишет файл. Absolute id либо ../ может вывести PNG за outdir с правами процесса. Локальные/агентские spec inputs не считать доверенными filename-компонентами. Fix: numbered filename/map либо strict path-safe id и canonical containment; tests на absolute, ../../, separators, collision и symlink parents. Это статически прослеженный path traversal sink, без запуска payload.

### F04 · P2 · Edge detector не ограничивает band размером crop

`comp_spec.rs:170,187–196` индексирует gray по x/y из `0..band`, а `:700–701` вызывает с band=2. 1px geometry разрешена. У crop шириной/высотой 1 при отсутствии early any-hit возможен out-of-bounds panic. Fix: clamp band по каждой оси и обработать пустой image; test 1×1/1×N/N×1 однотонный crop. Это не доказанный passing/failing runtime test.

### F05 · P2 · Case-sensitive CSS custom property names понижаются в регистр

`cascade/shorthand.rs:1094–1101` lowercases prop до ветки starts_with('--'). Имена --Accent и --accent сливаются, тогда как `var(--Accent)` сохраняет аргумент. Normal cascade через expansion получает неверные keys; pseudo path отдельно хранит original names, что ещё и создаёт расхождение веток. Fix: сохранить исходное имя custom property до normal-property lowercase; test два case-distinct vars и inherited usage. Не объявлять static contrast точным при unresolved token.

### F06 · P2 · Source order link/style не соответствует DOM interleaving

`cascade/build.rs:215–220` собирает сначала все style, затем все link. Для `<link ...><style>same-specificity override</style>` linked rule оказывается позднее inline style block, независимо от DOM order. Это не inline style attribute, а author stylesheet order. Fix: один document-order проход style/link с сохранением URL base; test обе перестановки и important. Отдельно unconditional media/supports — **заявленный static capability limit**, не выдаю его за случайно обнаруженный browser bug.

### F07 · P1 · Provider smoke разрушителен за пределами disposable fixture

`smoke-provider-hooks.mjs:236–289` удаляет local install trees, user-scope plugins/marketplace и global homedir caches; `:309–331` удаляет весь settings file при отсутствии remaining hooks, даже с unrelated keys, и при JSON parse error. Snapshot/restore покрывает только `.impeccable/config*.json` (`:74,335–351`), **не** `.claude/settings*.json`. Explicit target repo не обеспечивает HOME isolation. Дополнительно optional curl|bash (`:793`) и Codex approval/sandbox bypass (`:642–643`). F01 сейчас блокирует запуск snapshot, но восстановление dependency без исправления isolation активирует этот риск. Fix: disposable HOME/worktree + snapshot всех затрагиваемых files либо запрет workstation mode; тест сохранения unrelated settings и failure cleanup. Никогда не переносить этот smoke как безопасную verification-команду Friday.

### F08 · P2 · Sheriff marker может блокировать retry закрытия

`github/sheriff.mjs:290–301` запрещает close при любом trusted историческом CLOSE_MARKER. `:562–564` постит marker-comment **до** close PATCH. Если comment успешен, а PATCH падает, следующий run видит marker и не повторяет close; reopened PR тоже сохраняет marker. Fix: idempotency по текущему desired state/action epoch, не наличию вечного comment; test partial failure/reopen. Прикладной риск maintenance, не design engine.

### F09 · P2 · Offscreen serialized queue без deadline на parked continuation

`60-offscreen.js:44–54` паркует Promise до scan-continue; `:64–70` сериализует scans на одном chain. Если клиент не отвечает, следующий scan может ждать бесконечно; в этом файле timeout/cancellation recovery не найден. Нужны session deadline, cancellation и snapshot cleanup в finally; test исчезновение content client между asks. Внешний host teardown может смягчать сценарий — lifecycle вне назначенного bundle не проверен; не называю это воспроизведённым whole-extension hang.

### F10 · P2 · Overlay remove не выполняет полный teardown

`40-overlay.js:167–170,224,246–248,305` регистрирует window/document listeners. `:574–579` удаляет overlays/style/backdrop/body class, но не снимает соответствующие listeners/RAF handles. Повторный mount/remove может сохранять closures и callbacks к уже удалённому UI. Fix: единый cleanup registry/AbortController, RAF cancellation/observer disconnect; test несколько mount→remove и pending resize callbacks. Runtime leak не измерялся.

### F11 · P2 · Некорректный numeric threshold превращается в успешный gate

`comp_diff.rs:798–800` парсит threshold с fallback NaN; сравнение overall<NaN ложно, validation finite/range здесь нет. Текстовый invalid threshold может не отказать, а оставить exit0. Fix: finite threshold в допустимом интервале и usage exit при invalid; test bad string/NaN/infinity/negative/out-of-range. Metrics как diagnostics допустимы, silent fail-open gate — нет.

Дополнительные leads, не повышенные до подтверждённых findings: decode-ahead `image_sampling.rs:274–288` flatten-ит результаты chunks с join().unwrap_or_default(); при panic одного worker пропадает позиционная длина chunk, последующий zip может связать оставшиеся samples не с тем source. Нужны indexed Results и panic-injection test. Special filesystem nodes в completion traversal, plan-review Space/default button activation и lifecycle timers также требуют отдельного разрешённого воспроизведения. Их наличие не оставляет unread-файлов, но ограничивает уверенность runtime-выводов.

## 3. Что реально полезно Friday

Сравнение ограничено полностью прочитанными `.codex/scripts/design-lint.mjs`, `.codex/agents/design/design-reviewer.md`, `.codex/commands/design-system.md`, `docs/core/typography-pairs.md`. Ссылки reviewer на другие документы не означают, что вся linked Friday библиотека заново проаудирована здесь. `absent` ниже всегда означает **absent in inspected executing scope**, не «во всём Friday ничего нет».

| Кандидат upstream | Friday evidence / статус | Delta, предлагаемый target и проверяемый output |
|---|---|---|
| Typography/layout/contrast/motion taste rules | Reviewer `:127–167`, design-system `:30–40`; **уже есть policy / частично equivalent** | Не копировать второй anti-pattern список. Сохранить brand/domain context и dials; добавить только недостающую формализацию severity/unknown. |
| Source regex lint → DOM/computed style evidence | design-lint `:1–105` line-oriented patterns; `:189–205` DS hex/font checks; **partial, не semantic equivalent** | Owner: design tooling, target `.codex/scripts/design-lint.mjs` (отдельный opt-in adapter предпочтительнее переписывания). Output: rule id, file/selector, actual fg/bg/font, engine mode, confidence/unknown. Tests: inherited vars, link/style order, ignored-first dedupe, hidden/template/control. Не трактовать regex hint `<4.5` как вычисленный ratio. |
| Hash-bound approved reference + per-region receipts + stale invalidation | Reviewer `:25–28,49–75` уже требует reference evidence/owner approval/screenshots; **policy exists, executing ledger absent в прочитанном lint** | Owner: reference/review tooling; target reviewer contract + отдельный будущий artifact schema. Output source/asset/viewport hashes, approval actor+revision, affected-region invalidation. Tests: source изменился после approval → stale; same id/new bytes → pending. Не добавлять upstream manual screenshot provenance claim. |
| Inventory confirmation и revision-bound human decisions | Upstream model `:37–69`; reviewer требует evidence, но в прочитанном lint такого state machine нет; **partial** | Target reviewer workflow/новый review packet. Output complete inventory+missing marks+current revision decisions. Tests: stale per-item approval, one group exception, uncommitted edits prevent submit. Проверка actor на стороне trusted host, не TypeScript guard. |
| Context-aware typography and decorative severity | Reviewer `:127–167` broad criteria; **partial** | Target lint/reviewer: differentiate functional control/fine print/mockup/decorative. Output advisory vs failure с конкретным reading job; preserve failure у interactive demo. Tests: 12px legal text vs small purchase button, glyph/icon vs real copy, CJK tracking. |
| Cyrillic-aware font proof | Friday typography-pairs `:8–17` требует cyrillic/cyrillic-ext; upstream build-font-index latin-only; **conflict with direct reuse** | Сохранить Friday Cyrillic requirement. Если добавлять ranking — explicit language/subset+same real text render+font-loaded proof, иначе отказ. Owner typography tooling, target typography-pairs guidance и новый отдельный opt-in tool, не импорт отсутствующего legacy JS. |
| Native capture/final input freshness | Reviewer `:49–61` уже требует screenshots; upstream freshness сильнее file-presence; **partial** | Target screenshot/review contract (implementation screenshot.mjs отдельно здесь не исследован). Output capture receipt tied to source/viewport; tests late edit/asset swap/unavailable renderer. Нельзя утверждать, что текущий screenshot tool этого не умеет: его source вне сравнения. |
| Reduced-motion/interaction/a11y | Friday reviewer `:148–165` явно проверяет reduced-motion/labels/touch; upstream build phases не гарантируют; **не заменять** | Preserve Friday gate; comp score не должен разрешать broken keyboard/control. Expected output отдельный interaction/a11y checklist и runtime evidence при разрешении, не score-only approval. |
| Provider auto-hook installation, global smoke, release/sheriff | Нет потребности дублировать в design policy; **not applicable / reject direct transplant** | Не добавлять global mutation/runtime trust bypass. При будущей адаптации только явный opt-in и isolated test HOME, no-op отдельно от activated. |

Приоритет переноса: **(1) evidence schema + stale invalidation, (2) context/severity + unknown, (3) human inventory/revision model**. Не начинать с установки большого detector runtime, портирования 16 checks ради числа или замены текущих Friday правил. Numeric reproduction thresholds .72/.65/.95 — upstream calibration, не универсальные Friday acceptance criteria.

## 4. Test intent и оставшиеся ограничения

Прочитаны embedded unit tests назначенных Rust/TS modules, отдельный `build_phase/integrity_tests.rs` (2126 строк), comp-verbs parity source, model/plan-model/viewport tests. Integrity tests описывают ownership/post-finish changes, native unavailable/drift, force, anti-copy, geometry/coverage/source drift, readonly/invalid/quarantine/symlinks и approvedcomp restore. Fake renderers часто возвращают заранее подготовленные frames и verify_current; это **не реальные browser screenshots**. Parity harness/fixture references — test intent/dependency, не выполненное сравнение outputs. Никакой test pass не заявляется.

**Remaining unread scope assignment: нет.** Все 125 строк ledger full с substantive notes, без aliases/classified вместо чтения. Полный source dependency graph всего upstream, foundation/native browser internals, browser host lifecycle, все linked fixtures, private sibling Kinpaku и вся Friday library **не** объявляются прочитанными/проверенными этим follow-up. Два broken entrypoint и compiler/runtime compatibility остаются непроверенными исполнением. Это явные границы, не скрытая подмена inventory на full.

Для следующих исполнителей, если пользователь разрешит runtime: сначала F01 dependency closure и isolated workspace/HOME, затем минимальные regression cases F02–F11, только после — реальный native/manual capture, multi-tab cancellation и keyboard/a11y. Не запускать существующие smoke/install/release на рабочем профиле ради «проверки» отчёта.

## 5. Проверка deliverable и проблемы работы

Финальная проверка выполнена внешним Python над текстами без imports upstream: exact path set, unique count, total lines, SHA-256 и ranges. Суммы приведены в таблице, machine-readable детализация — companion ledger. Git HEAD обоих snapshot прочитан без hooks/fsmonitor. Проверка не подтверждает сборку/тесты.

Во время продолжения был один ошибочный read-path `crates/html/src/page_context.rs` (такого файла нет); путь восстановлен из authoritative unread ledger как `crates/html/src/page.rs`, все 692 строки затем прочитаны. Ранее усечённые batches дочитаны ограниченными ranges; ни FileNotFound, ни хеширование не использованы для присвоения full. Progress сохранялся после групп в собственный ledger. Отдельную procedural skill не записывал: scope разрешает только эти audit deliverables; воспроизводимый протокол и ограничения записаны здесь.
