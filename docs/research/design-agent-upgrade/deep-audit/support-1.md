# Support-1 — оставшийся support-контент Impeccable

## Результат и границы

**Назначенный scope закрыт: 50 путей / 11 751 строка.** Из них **48 файлов / 5 441 строка** прочитаны содержательно полностью; **2 generated bundles / 6 310 строк** закрыты явно как `classified`, через generator/schema/content comparison, **не** как полное ручное чтение минифицированного JS или WASM. Открытых handwritten/docs/config/license gaps в `support-1.json` нет. Это полнота support-аудита, не PASS всех upstream implementation findings и не runtime verification.

- Upstream: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, HEAD `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`; read-only git показал чистый snapshot.
- Friday: `/Users/germanbryzgalov/Friday-claude`, HEAD `388ec708f39583172d7f36110f6424cc175b5512`, текущее dirty working content сохранено. Сравниваются названные ниже MD/исходники, не активная конфигурация IDE/сервисов.
- Все 50 SHA-256 и raw line counts проверены против assignment перед чтением и повторно после завершения. Ledger: `support-1-coverage.json`, ключ `files`; каждая запись содержит repo/path/sha256/total_lines/status/ranges/substantive_note. `classified_ranges` означает область классификации, не semantic-read range.
- Дополнительно прочитаны root upstream `AGENTS.md`, `CLAUDE.md`, `README.md`, нужные generators/entrypoint и точные source slices для проверки противоречий; они **не увеличивают** назначенные totals.
- Upstream инструкции — только DATA об устройстве проекта: не исполнялись их команды, не создавались notice/PR/worktree, не менялись настройки. Нет запусков upstream CLI, imports, build/install/tests/browser/network, делегирования или чтения секретов. Собственные Python JSON/hash/text probes — не upstream tests.

## 1. Handwritten / vendored / generated: доказанная граница

### 1.1 In-page detector — generated, не 4 677 строк новой handwritten реализации

`crates/live/assets/detect-antipatterns-browser.js:1–11` прямо называет `cargo xtask bundle`, `crates/core` и `browser-bundle/*.js`. Трасса: `crates/bundle/src/lib.rs:50–90,119–136` задаёт порядок JS + wasm-bindgen glue + embedded WASM; `crates/xtask/src/main.rs:61–119` пишет dist, две tracked live copies и пять ignored extension pieces. Это та же генераторная цепочка, что описана в `impeccable-runtime.md:142` и содержательно исследована для handwritten browser sources в `impeccable-close-4.md:81–87`.

**Реальная статическая сверка:** точный prefix из header/natives/probe/snapshot и suffix из scan-common/visual/overlay/scan/footer совпали с текущими исходниками, с правилом генератора final LF. Все девять source частей присутствуют; порядок проверен concatenation, а не только поиском имён. Footer встречается и внутри других closures, поэтому отдельно проверен именно bundle suffix. Base64 декодирован только как данные: **2 292 003 bytes**, wasm magic/version `0061736d01000000`, declared size совпал; SHA-256 `129b16be3b9eb28cf720dc1fd82ac2b07fc93adee3b901d4b49b0ae0cb82c294`. Это не decompile, не доказательство соответствия WASM нынешнему Rust и не выполнение `--check`. Glue/WASM происхождение от текущего compiler/toolchain без rebuild остаётся непроверенным.

### 1.2 Component review — минифицированный исполняемый bundle, не самостоятельный канон

`crates/context/assets/component-review.js` — **183 891 bytes / 1 633 lines**, включая длинный минифицированный JS и большие текстовые CSS fragments. `scripts/build-component-review.mjs:6–10` требует Bun **1.4.4** (`.bun-version:1`), берёт `ui/component-review/entry.ts`, `target: browser`, `format: iife`, `minify:true`, пишет ровно этот asset. `component_review/server.rs:14` embeds его через include_str; `entry.ts:37–58` загружает `/packet`, mounts review, POSTs `/decision`, ошибки заменяет role-alert/reload UI.

Сверены **полный `theme.css`** и три vendor stylesheet values: tokens/rail входят буквально, kit — буквально после template escaping backticks и `${`. `kit-css.ts` значения в свою очередь совпадают с текущими CSS. Значит CSS-содержимое bundle не заменено «по похожему названию». Decision/revision/inventory смысл сопоставлен с уже исследованными model/review источниками (`impeccable-close-4.md:89–91`), не приписан полному ручному чтению minified output. Без Bun rebuild **полная byte-for-byte reproducibility JS не установлена**.

### 1.3 Vendored kit — generated размещение, но читаемый authored дизайн

`ui/component-review/vendor/{kinpaku-kit.css,docs-rail.css}` полностью прочитаны, **не** спрятаны под generated exemption. Заголовки называют private impeccable-site canonical. `scripts/sync-kinpaku-kit.mjs:12–33` выбирает CSS sections по selectors, копирует tokens/instrument JS, вырезает rail по comment boundaries; `scripts/lib/kit-css-module.mjs:5–9` JSON-encodes CSS в TS. Private canonical source не входит в этот snapshot, поэтому сверка с ним/его лицензией не заявляется.

Kit: ink primary с gold arrow, secondary/ghost/disabled, tab aria-selected, inputs/toggle/checkbox/select, focusable icon tooltip, recessed instrument strips/raised keys, grain только на материале, paper variant, moving thumb и coarse-pointer enlargement. Rail: жирная hierarchy групп, muted links, current-page gold left line. Этот navigation indicator — не автоматически запрещённый декоративный side-tab на rounded карточке. Цвет primary **на сайте ink**, **в extension popup gold** — явная surface-разница (`kinpaku-kit.css:6–8`, `extension/popup/popup.css:66–72`), не повод унифицировать всё под один внешний бренд.

### 1.4 Registry — generated, но полностью прочитанные policy descriptions

`crates/live/assets/antipatterns.json:1–392`: **62 unique rules**, **31 slop / 31 quality**, **16 advisory / 2 explicit error / 44 default severity**. Все id/name/category/description строки реально сравнены с `crates/foundation/src/registry.rs`, совпали. Generator: `bundle/src/lib.rs:263–285` добавляет optional severity и final LF. Это metadata-only список policy, **не** новый аудит алгоритмов всех checks.

Значимые содержательные различия: overused-font расширен на Fraunces/Geist/Space Grotesk и другие; decorative kicker ban жёсткий, а em-dash/straggler/unbalanced-heading/neobrutalist shadow/часть shape/animation rules advisory/contextual. Body measure опирается на rendered lines; CJK/Thai/Arabic имеют justification exceptions; long allcaps требуют own sentence-like text; functional11px/legal10px не отменяются design ramp; hidden content/script errors — error. Не переносить весь список как универсальную истину Friday или «62 одинаковые проверки любого файла»: source JSX/TSX и rendered paths покрывают разные классы.

## 2. Документы и contracts: полный смысл и ограничения

### ENGINE / environment / supply chain

`docs/ENGINE.md` описывает Rust binary за skill launcher, foundation/core split, Io/path/http, text/static/browser/WASM, downstream process-lifetime rule packs. Registry install и передача hook reference — разные операции; builtins не могут shadow, collisions panic; static-only/text-only fallback избегает double reporting; inline ignores применяются после pack. JSON wasm detect feature — для sandbox hosts, Rust-only setter, не динамическая установка JS-плагинов. Extension vendored WASM не execs CLI binary. `cargo xtask bundle --check` по source должен сравнивать generated bytes; в данном проходе не запускался.

`docs/RUNTIME-ENV.md` полностью покрывает skill/provider/self discovery, per-user seed salt; OAuth PKCE/state/issuer, own-origin/loopback/no redirect, file/keychain threat model и same-user исключение; login/logout/refresh locks и generation tombstones. Health — default-on при sign-in и дополнительных gates, fingerprints/ruleset baselines, no retry queue. Pro — signed manifest+artifact digest+lease+revision floor, login-bound current state, refresh concurrency/offline grace, explicit off/BIN/child guards. Это download/exec/account integration, не просто дизайн-контент; открытый source не удостоверяет closed Pro pack или будущий release.

`docs/BUNDLE-SIGNING.md:3–14,68–96,98–117`: подпись над artifact/version/size/digest/key ID до extraction, compiled public keyring, unknown/repeated fields rejection, signature-first rollout и dual-key rotation; replay старого valid release отдельно не решён. Local link/BUNDLE_PATH сознательно unsigned developer trust path, не сетевой fallback. dry-run не читает 1Password, не доказывает credentials. `scripts/bundle-signing-keys.json` содержит **публичный**, не секретный Ed25519 key; это не факт опубликованной signature. `crates/cli/loop-checksums.txt` — семь SHA pins для loop0.1.0–0.2.2, recorder и требование engine release, а не самостоятельно проверенные remote artifacts.

### Comp fidelity: не выдавать историческую оценку за текущую гарантию

`docs/COMP-FIDELITY.md:1–78` меняет reproduction memory на measured regions: comp-diff structure/color/detail/bands, per-kind weights и paired crops, comp-spec grid/map, plates regenerated from reference, font fingerprint/rank, disk phases comps→spec→plates→hero→sections→motion→responsive→review. Organic clip path и buried raster сохраняют материал вместо CSS-подмены. Модель всё ещё выбирает regions; неизвестная/грубая карта не становится complete от green score. Metric не судит характер lettering/ornament/motion, numeric thresholds калиброваны на ограниченных примерах.

Прочитаны **все десять sweeps**, включая failed runs, hidden force/escape hatches, packet-prefix inertia/state absence, browser font fallback, cost caps, model quitting over open gates. Увеличение prose не заставило агента следовать gates. Sweep10 содержит один реально заявленный полный unforced traversal; «high fidelity» и «hero/все phases closed» не одно и то же. Решение в конце (`:299–301`) переводит numeric readings above HERO_MIN в advisories, оставляя hard vetoes. Это **историческое decision/rationale**, не свежий прогон новой pass condition.

`docs/comp-fidelity-review-2026-08-17.json` — человеческий authored corpus, не автоматически generated golden. Все verdicts/notes/pins прочитаны: missing footer/index/legend, неверные размер/вес/позиция/перенос текста, invented chrome/copy, SVG вместо plate, low-res/crop/clipping, неправильные controls, иногда хороший результат с конкретными nits. Отдельно помечены letterboxing review artifacts. Даже «arguably better» label/contrast relocation считались fidelity deviation: пользователь должен решить во втором проходе. Это прямо конфликтует с Friday запретом копировать a11y-дефект референса.

`region-map.schema.json`: required regions>=1; id/kind/note; six kinds; **ровно один** pixelBox/normalized box/grid; positive sizes; snap, container, parentId, peer reviewGroup, bleed/codeDrawn и draft:false. Описанные unique IDs, fit-within-comp, x+w<=1, valid grid grammar, existing enclosing parent/peer-only grouping не все выражены constraints JSON Schema. Без runtime validator schema-pass **не** доказательство семантической корректности карты. `comp_spec.rs:1133–1138` embeds schema как `--schema` authoring output; не следует считать сам JSON единственным валидатором.

`docs/NATIVE-CAPTURE.md` — более поздний opt-in доказательный protocol: freeze HTML/static dependencies/spec/approved comp; comp/spec никогда не serve; запрещены source/capture copies и вне-regions raster painting; isolated measurement/restoration; host-owned loopback service capability+PID/port audit, immutable objects и final source recheck. Saved JSON/PNG alone не provenance. Text-only capture имеет другой explicit method/coverage с empty receipts; raster требует region receipts/known dependency policy. Software raster/full repaint, bounded transitions, pseudo-background suppression и explicit unsupported coverage — не обещание работы с любым canvas/shadow/SVG. Final finish повторно проверяет current responsive; crop marker не proof генерации при отсутствии. Это сильнее документарного approval, но не отменяет rights/owner vision gates Friday.

### Historical live ADR и platform README

`docs/adr-live-variant-mode.md` полностью прочитан как историческое **Implemented** решение: source/HMR variants вместо чисто DOM, SSE+fetch и agent long-poll, display:contents wrappers, original retained, accept/discard cleanup, no-HMR source fallback, localStorage resume, localhost/session token/path guard, debounced disconnect. Числа 26 wrap/15 server tests и 15–20s — заявления документа, не наши проверки. Pure-Node и `.mjs` paths уже не текущий engine architecture. Текущие roots/preview-module/native-accept details надо брать из реализации/поздних отчётов, не реставрировать старый flow.

`vscode/README.md:7–25` — **skill-only** package: VS Code1.109.3+, trusted local terminal host, no extension activation/runtime/hooks/telemetry code. Engine launcher всё равно может download/run и команды могут писать проект/preview. Поэтому «у extension нет telemetry code» не значит «engine ничего не отправляет». Remote SSH/WSL/containers явно not smoke-tested, browser-only VS Code unsupported; duplicate skill names ambiguity. `.vscodeignore` разрешает только manifest/README/LICENSE/icon/skills. Не приписывать marketplace package hooks/native sidecars, существующие у другого install method.

## 3. Sample design context / HTML / CSS / fixtures / licenses

### Reference sidecar и реальные extension surfaces

`.impeccable/design.json` полностью прочитан: schemaVersion2, generatedAt metadata, color roles/canonical/ramp, typography purposes, shadows/motion/breakpoints/rounded metadata, **6 реальных HTML+CSS examples**, narrative/northStar/rules/dos/donts. Это reference/sample context, **не** универсальная схема Friday и не установленный живой дизайн. Наличие generatedAt не доказывает автоматический generator всех authored narrative/example полей.

Характер: neutral chroma0 paper/ink; gold jewelry, не читаемый text-on-paper; patina-deep для читаемого цветного текста, vermilion failure; operational recessed/raised hardware, LED только у lit indicators; mono для machine labels, fixed dense floor; one light theme внутри dark DevTools с hardened seam. У hand-typed exceptions честно указано no-token-yet (button radius/shadows). Не заявляется математически проверенный contrast по описанию токена.

`extension/shared/kinpaku.css`, `devtools/sidebar.css`, `popup/{popup.css,popup.html}`, `devtools/panel.html`, `walks/{panel/panel.css,mic/mic.html}` прочитаны **полностью**. Это разные authored consumers, не byte aliases. Popup резервирует высоту count/error, держит disabled copy/toggle до результата и polite error status; initial0 в HTML не доказательство clean scan. DevTools содержит settings/auto-scan/line-length/blur/findings scaffold, title-named icon buttons. Side panel: persona face-sheet crop geometry, task scroll fades/field sizing, device/disability choices/tooltips, risky plan/confirm, stable current-step number column, only-steps scroll, pause/stop bar, history/outcome/name, account modal, speech waveform, timed onboarding/final rest-state и global reduced-motion override. Это полезные конкретные patterns, но браузер не открывался: layout/CLS/a11y behavior не сертифицированы.

`extension/icons/icon.svg` текстом разобран: dark tile/gold two-path mark, сознательно иной, чем ink toolbar glyph. Ни SVG, ни шрифты визуально не проверялись.

### Source fixtures и manifests

Все **8 broken-image fixture files / 89 строк** прочитаны без исполнения. JSX/TSX проверяют реальные img vs strings/template/regex/division, less-than, apostrophes/URLs в children, JSX inside attrs, multiline tags, dynamic src/spread/srcSet. Svelte/Astro — shorthand/bind/spread/srcset/quoted decoys, Svelte block close и division; Vue — :src/v-bind/modifiers/object spread/srcset. Tooltip strings на одной/нескольких строках содержат fake `<img>` и не должны считаться actual nodes. Эти deliberately incomplete fixtures не application bugs; сами inputs не доказывают прошедшие parser tests.

Три `cli/platform-packages/*/package.json` — release **templates**: version0.0.0-engine, explicit target os/cpu/bin, bin+LICENSE, SEE LICENSE. Не dedupe по одинаковой структуре и не объявлять placeholder опубликованным npm mismatch: publish pipeline подставляет реальную версию. `demos/landing-demo/package.json` — private ESM Vite8 dev/build/preview, не обещание production runtime. `skills-lock.json` version1/empty skills не pins upstream dependencies. `.bun-version` — strict generator pin, Bun не запускался.

`.gitignore` разделяет canonical PRODUCT/DESIGN/config/design/surfaces и ephemeral live sessions/recovery/cache, игнорирует binaries/detector outputs, сохраняет fixture dist exceptions и tracked provider permutations. `.gitattributes` задаёт CMD CRLF vs sh LF, oracle/fixture bytes без conversion, review CSS embedding LF, generated/-diff flags; скрытый diff не значит запрет читать или автоматический semantic PASS.

GitHub feature/bug/PR templates задают reproduction/problem/provider/maintainer approval/AI disclosure; CODEOWNERS global wildcard сохраняет ownership даже при stale source/ row. Реального GitHub action здесь нет.

### Правовая граница

Оба assigned OFL файла прочитаны **напрямую полностью**, Albert Sans не оставлен alias-pending. Albert copyright2021 и JetBrains copyright2020 различаются, SHA разные. SIL OFL1.1 позволяет bundle/embed/redistribute с notice+license, запрещает standalone продажу шрифта, ограничивает RFN у derivatives и endorsement, сохраняет OFL для fonts, **не** для созданных документов; termination/disclaimer присутствуют. Root Apache claim не заменяет OFL уведомления. Vendored private-site kit provenance само по себе не независимое доказательство прав private canonical источника; публичный snapshot license coverage и actual binary packaging отдельно не проверялись.

## 4. Подтверждённые contradictions / claims vs implementation

Это открытые статические findings для координатора; **предложенный owner не назначен автоматически**. Источники не исправлялись.

### S1-01 — ВАЖНО: README privacy guarantee шире реального account path

`README.md:234` обещает «Your project name, files, code, and PRODUCT.md are never sent». На деле `crates/account/src/health.rs:757–807,1048` добавляет repo **label**, а для remote-less repo иногда **parent-folder place**; это не полный absolute path, но уже не «project name never sent». `docs/RUNTIME-ENV.md:110–115` сам себе противоречит: «counts and opaque hashes only», затем label. Далее `account/src/design.rs:4–5,68–116,225–229` имеет default-on DESIGN sync, payload **text+sidecar**, POST `/cli/v1/design`; `health.rs:173–182` вызывает его после scan при подходящих gates. Это подтверждает ранее найденный data-flow в `impeccable-close-8.md:71–76`, а не новый сетевой эксперимент.

**Scope оговорка:** telemetry-off исключения различаются. Обычный scan проверяет opt-out; sign-in scan специально обходит telemetry opt-out, но **не отправляет DESIGN contents** (`health.rs:185–192`). Не утверждается, что данные уже ушли с этой машины, что отправляется произвольный source code, либо что PRODUCT обязательно отправляется. Проблема — безусловное публичное «never» и неполный payload summary.

**Предложенный owner/target:** upstream docs/privacy/account owner, README telemetry/account distinction и RUNTIME-ENV data inventory. Expected check: truth table anonymous/signed-in/opt-out/health-off/design-off/sign-in; перечень label/place/DESIGN/report bodies согласован с actual payload constructors. **Не подключать account sync Friday автоматически.**

### S1-02 — КАЧЕСТВО: stale migration docs могут отправить к несуществующему runtime

- `docs/RUNTIME-ENV.md:20–22` говорит launcher не exports skill/self; actual `skill/scripts/impeccable:102–111` exports оба до любого exec. Указанный `launcher/impeccable` отсутствует.
- `docs/adr-live-variant-mode.md:28–37` объявляет pure Node `.mjs` runtime; current `docs/ENGINE.md:3–6` и Cargo workspace описывают Rust. Названные live-server/live-poll/live-wrap.mjs отсутствуют.
- `docs/COMP-FIDELITY.md:3,20–49` owner/scripts .mjs — исторические, текущие thresholds уже отсылают к Rust (`:76`). Не копировать старые invocation snippets как рабочие команды.
- `RUNTIME-ENV.md:136–138` renew under two days, actual `account/src/pro/mod.rs:42` **86400 seconds**. Этот mismatch также найден close-8:83.
- PR checklist/CODEOWNERS называют `source/`, которого нет; actual canonical `skill/`, `crates/` (`AGENTS.md:7`). Global owner остаётся, поэтому не утверждать ownerless defect.

**Owner/target:** upstream documenter, пометить ADR historical/superseded, обновить current links/constants/checklist. Expected static doc-link/path check + single-source release constants. Это не доказательство failing executable.

### S1-03 — КАЧЕСТВО: comp evaluation prose не совпадает с приложенным человеческим corpus

`docs/COMP-FIDELITY.md:194` — «32 builds, 230 pins»; `:198–203` распределение pass4 / pass-except-bug1 / unsure10 / fail27 (его сумма уже 42). Реальный fully-read JSON содержит **42 samples, 325 pins, pass4 / unsure8 / fail30**. Случай «would be a pass if … clipping bug» в JSON честно `fail`, а narrative выделяет отдельно. Поздние sweep7 rows объясняют возможное накопление corpus, но **не** делают заголовок/распределение актуальными.

**Owner/target:** upstream eval/documentation owner; summary derive из canonical JSON с явно named cohort/sweep/failure-exception policy, не смешивать разные cohorts. Expected: exact programmatic totals и понятные exclusions. Новые оплачиваемые sweeps для исправления этих счётчиков не нужны. Не переносить проценты/сравнение моделей как доказанную эффективность Friday.

### S1-04 — КАЧЕСТВО: sample design обещает functional floor11px, но сам задаёт9px tags

`design.json:183–189,313` и `extension/shared/kinpaku.css:107–110` называют11px functional floor. Но sample Tag CSS `design.json:291–296`, shared `.ks-tag` `kinpaku.css:163–177` и actual sidebar finding-kind `sidebar.css:60–75` задают **9px**, сообщая AI tell/Quality. Registry undersized-ui-text (`antipatterns.json:301–304`) прямо включает meta/decorative micro labels и не позволяет scale laundering.

Это **содержательная self-consistency проблема**, не утверждение, что detector фактически flag-нул UI: DOM exemptions/rendered run не проверены. Отдельно `panel.html:53–57` blur checkbox имеет соседний текст, но нет for/aria-labelledby или текста внутри wrapping label — source-only gap в доступном имени. Title на toolbar buttons сам по себе не объявляется отсутствием имени.

**Owner/target:** upstream design-system/extension owner; уточнить семантику tags или поднять functional text и associated label, затем нужные rendered/a11y checks. Не заимствовать9px tags как успешный a11y-пример Friday.

### S1-05 — ограничить широкий «offline / no runtime Node» marketing scope

`ENGINE.md:12–13` и `CLAUDE.md:19` утверждают offline/no build-time downloads. Реально `rust-toolchain.toml:1–6` предупреждает auto-install stable+WASM target; Cargo external dependencies нужны provisioned/cache, `bundle/src/lib.rs:303–347` вызывает внешние wasm-pack/wasm-bindgen build tools. Это **не** скрытая external rule-engine download: собственные checks действительно в workspace. Корректная формулировка — engine source available, offline build после подготовки toolchain/dependencies, а не гарантия первого build без сети.

Likewise native CLI core не требует Node, но framework live adapters могут использовать compiler пользовательского Svelte (`CLAUDE.md:225`), уже отражено в implementation audits. Не продавать no-Node guarantee как свойство всех adapter paths. Proposed owner: documentation/runtime; qualifier + reproducible offline prerequisites, без установки в этом аудите.

### Что НЕ является contradiction

- Listing62 current rules vs «now61» в **version1.4.0 notes** — разные временные срезы; generated registry сейчас62 подтверждён.
- Local detector scan vs remote journeys — разные functions; `STORE_LISTING.md:8–18,74–80,115–119` прямо разделяет store/unpacked и journey network. Не превращать draft «outside a journey nothing» в доказанный deployed privacy breach без package/implementation review. Older-server page scripts прямо раскрыты, поэтому не обещать абсолютный no-remote-code по наличию helpers.
- `vscode/README` no telemetry **extension code** не отменяет engine account behavior: scopes разные.
- Site ink primary vs popup gold, dense desktop controls vs kit coarse-pointer sizing, selected nav rail vs decorative rounded side-tab — контекстные различия, не byte drift.
- Public Ed25519 key/checksum tables не секреты и не фактический результат signature/download verification.

## 5. Friday: только доказанный delta, не wholesale import

| Дельта | Сравнение с текущим Friday | Предложенный owner / target / expected output |
|---|---|---|
| Brand context и decomposition reference | **already equivalent policy**: `docs/core/design-principles.md:9–17,32–45,106–116`; `.codex/CODEX.md:347–385` уже brand/MASTER, values from ref, screenshots | Не добавлять второй PRODUCT/DESIGN как shadow source. Использовать нынешний project/brand/MASTER/pages. |
| Per-surface mode, не один стиль проекта | **partial**: Friday dials/domain profiles и reviewer interpretation есть (`design-principles.md:21–30`, reviewer:86–95,115); upstream CLAUDE:30–45 отделяет task/surface success | Design owner, существующий brief/reviewer contract: назвать цель поверхности Persuade/Operate/Read/Experience только если помогает; пример product Operate + marketing Persuade без сброса бренда. Не считать mode ключом project global. |
| Byte budgets/context-loading trace | **delta, absent в inspected MD как числовой контракт**; не заявляется поиск по всему Friday | Workflow owner; маршрут reviewer/commands и безопасный future CI budget: bytes + реальный files-loaded trace для polish/audit/new-work; threshold отдельно reviewed, не копировать upstream values/tokens. |
| Revision-bound review inventory / missing marks | **partial**: Friday review-loop.md:22–44 уже current revision/repair; media handoff:60–75,168–198 уже hash/rights/vision/owner | Review tooling owner; region packet + per-item revision/decision/affected invalidation и explicit inventory completion. Test unchanged carries, changed bytes pending, grouped sibling не inherits approval. Не объявлять эту идею отсутствующей с нуля. |
| Numeric fidelity/immutable native receipts | **partial policy / execution delta**: screenshot/owner evidence есть, exact native pixel provenance не доказан inspected files | Capture/review tooling owner; отдельный opt-in local prototype spec (не install): frozen input hashes/current responsive proof/measured-vs-unresolved; expected stale source→reject. .72/.95 не универсальные thresholds. |
| Comp first, a11y second | **conflict**: upstream review pins допускают fidelity-first defective contrast, `CLAUDE.md:47` переносит a11y в audit; Friday design-principles:43–45,80–101 не разрешает копировать дефекты | Сохранить Friday early a11y/legal gates; изменение comp, нарушающего доступность, явно согласовать/зафиксировать, не выдавать fidelity pass за готовность. |
| Broader anti-slop style bans | **partial/conflict**: основные fonts/gradient/cards/motion уже есть `design-principles.md:57–84`; upstream cream/kicker/italic-serif и body11px не универсальные нормы | Design owner; candidate advisory с contextual waiver и Cyrillic/brand tests. Нельзя стирать intentional тёплый бренд или придумывать WCAG absolute pixel threshold. |
| Stable popup/loading/error footprint и side-panel long text | **already required / concrete examples**: preflight:20 loading/empty/error, reviewer:63–65 responsive; upstream CSS показывает reserve-space, min-width0, fixed numeric columns | UI owner конкретного проекта; reuse pattern, не brand values. Expected slow/error/long labels/narrow/keyboard/reduced-motion screenshots; CSS source не proof проверенных states. |
| Supply-chain pinned signatures / generated content check | **not applicable для переноса prose**, полезно лишь при отдельно approved external executable supply | Tooling/security owner; signed artifact+digest+version+no-skip validation, provenance classifications. Никаких hooks/account/Pro/global writes из этого аудита. |
| Account sync / auto downloads / bypass fallback live agent | **conflict с audit-only и consent boundaries**; README:70–72 сам раскрывает auto PATH agent с approval/sandbox bypass | Не переносить автоматически. Separate threat model/data-flow approval; Friday `.codex/CODEX.md:53–66,86–90` и media-handoff:7–17,94–114,194–198 сохраняются. |

## 6. Итоговый verdict

**Coverage COMPLETE_SUPPORT_SCOPE**, но **не** runtime PASS и **не** рекомендация установить upstream. Отдельно остаются открытыми document/privacy/self-consistency findings выше и implementation findings основных аудитов. Минифицированный JS/WASM classified честно; private site/evals/service/release/store состояние не проверено. Отчёты предыдущих workers использованы как сравнительные leads; назначенные actual docs/CSS/HTML/config/license прочитаны сами, а критичные contradictions дополнительно привязаны к actual source.

Созданы только `support-1.md` и `support-1-coverage.json` в разрешённом report_root. Upstream, Friday runtime/config/client files и чужие отчёты не изменялись. Повторная проверка ledger: ровно50 уникальных paths, все assignment hashes/line counts совпадают; full ranges покрывают все48 full файлов, у2 generated явно отделены read ranges и classification.
