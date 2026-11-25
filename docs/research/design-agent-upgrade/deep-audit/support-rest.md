# Support-rest — закрытие support-2 без CLI-CONTRACT

## Scope, revision и verdict

**Назначенный support-rest scope закрыт: 48 путей / 8 156 inventory lines.** Содержательно полностью прочитаны **44 файла / 4 520 строк**; **4 файла / 3 636 inventory lines** имеют честный статус `classified`, не `full`: два lockfile и два generated/golden JSON. `partial`: 0. Это **PASS полноты назначенного статического чтения/классификации**, а не PASS upstream продукта, runtime, motion, visual QA или security.

- Upstream `impeccable`, root `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, read-only `git rev-parse HEAD`: **`9e460a87ef338ee9d12c7beed8fedc597a5af5f7`**; `git status --porcelain` пуст.
- Friday: `/Users/germanbryzgalov/Friday-claude`, HEAD **`388ec708f39583172d7f36110f6424cc175b5512`**; сравнение текущих named working files и ранее подготовленной R2, не утверждение о включённых live hooks.
- Исполнитель: текущий Hermes subagent, адаптированная роль `.codex/agents/core/researcher.md`; полный файл роли, `.codex/CODEX.md` и `review-loop.md` прочитаны. Не native Codex и не независимый reviewer собственной работы. Дополнительное делегирование не выполнялось.
- `docs/CLI-CONTRACT.md` **полностью исключён**: не открывался, не хешировался, не включён в `files`; ссылки на него в других документах не считаются его чтением.
- Проверен старый `support-2.md:1–5`: это только `IN_PROGRESS`, пять названных полных чтений и начатый CLI, без финального ledger. Эти утверждения не наследовались как доказательства: все оставшиеся authored файлы перечитаны непосредственно. Старый partial оставлен без изменений; данный отчёт заменяет его только для 48 путей, не закрывает CLI.
- Все 48 SHA-256 совпали с assignment. Единственное расхождение строк: `crates/html/tests/fixtures/css-rules.json` — assignment **3**, фактически **1 непустая логическая строка / 0 LF**, hash точно тот же. Ledger сохраняет `lines`/`total_lines: 3`, отдельно `actual_lines: 1`, `newline_count: 0`. Итог actual lines **8 154**, не исправленная задним числом inventory.

Ledger: `support-rest-coverage.json`, массив **`files`**, в каждой строке `repo: impeccable`, path, exact sha256, inventory/actual lines, bytes, status, ranges и method/substantive_note. `ranges` у `full` — реально прочитанный весь текст; пустой массив у `classified` не является заявкой на semantic reading. GeneratedAt и vendored происхождение сами по себе не основание скрывать читаемый authored CSS/JSON narrative под generated exemption.

**Ничего не устанавливалось и upstream код не выполнялся**: нет CLI/build/tests/browser/import/генераторов или внешних сервисов. Собственные Python probes только читают/парсят/хешируют данные. Дополнительные source slices открывались ровно для происхождения golden/lock/public key и Friday comparison; они не увеличивают assignment totals. Отчёт не доказывает существование credentials, опубликованных подписей или доступность closed services. Изменены только два новых report-файла; роли, configs, чужие dirty, Git refs не менялись.

## 1. Реальные дельты и ограничения переноса в Friday

Каждая находка относится к pinned upstream выше. Ответственный за текущий handoff — **координатор deep-audit, которому возвращается этот отчёт**; implementer исправлений не назначен, профильные роли ниже — только рекомендуемые, не выдуманное завершённое назначение. Находки остаются **OPEN**, audit-only не разрешает их исправлять. Это уточнения/доказательства к COMPARISON R2, не шесть новых несуществовавших возможностей Friday.

### SR-01 — ВАЖНО: native static capture не является motion evidence

**Evidence:** `ui/component-review/README.md:21–27,80–106`. `prepare` оставляет `captureVerified:false`; только adapter `capture` может выставить true после frozen declared inputs, проверки observed response bytes, стабильности pixels/DOM/network и привязки manifest. Но V1 **отвергает animated WebP, активно анимированные, scripted, canvas и framed components**; reduced-motion preference уважается без переписывания стилей. Документ прямо ограничивает доказательство rendered state, не всеми future interactive states. `DESIGN-stage.md:21–25,35–39` описывает loupe/flip/240ms stage transition как желаемый UX, не измеренный temporal packet.

**Friday delta:** R2 уже правильно требует before/first/middle/last/settled, normal/reduced, entry/exit/interrupt. Не заменять это кнопкой native capture или receipt `captureVerified:true`. Полезный перенос — отдельные evidence types `static-layout/provenance` и `temporal-behavior`, с revision/dependency binding и явным `not tested`. Friday `.codex/CODEX.md:686–695` требует screenshots для layout; это полезно, но не превращается в проверку движения. Предлагаемые исполнители: motion-curator + qa-engineer после решения координатора. **Verdict: доказанная граница/дельта проверки; runtime не проверен.**

### SR-02 — ВАЖНО: font override должен быть scoped, а metadata не owner approval

**Evidence:** `.impeccable/surfaces/crates-context-src-question-page-rs.md:14–30,50–71` ограничивает system-font override **local picker**; глобальный DESIGN не переписывается. `.impeccable/config.json:10–46` ограничивает исключения rule/value/files и записывает reason; overlay font-size не обязан совпадать со шкалой сайта. `demos/landing-demo/DESIGN.md:13–49,129–143` разделяет Fraunces-display и Inter-body; `vendor/kinpaku-tokens.css:157–165` различает читаемый Albert, brand wordmark Alumni и mono с системными fallbacks.

**Подтверждённый Friday conflict:** `.codex/scripts/design-lint.mjs:9–12` ERROR на любой `Inter|Arial`; `docs/core/typography-pairs.md:29–30` уже допускает Inter-body, а `.codex/CODEX.md:353–355` ограничивает anti-reference default **основным бренд-шрифтом**. Поэтому дельта не «разрешить Inter впервые», а связать проверку с ролью/поверхностью/MASTER и не считать fallback нарушением бренда. Не создавать глобальный whitelist по upstream примеру.

**Authority:** фраза «user confirmed», recorded finish `ship`, `createdAt` и reason — содержимое repo, **не проверенный human receipt Гермеса**, не разрешение менять Friday. Предлагаемый исполнитель: владелец design-lint с design-reviewer; решение MASTER/исключения остаётся owner-scoped. **Verdict: OPEN static policy/implementation mismatch; owner approval переноса отсутствует.**

### SR-03 — ВАЖНО: local/open-source product ≠ service-independent/private

**Evidence:** `CLAUDE.md:89–99` отделяет private impeccable-site: catalog/review labs/world-image pipeline/API; `concept-seed` использует local override → service roll → degraded promotion-only seed. Полностью прочитана длинная `:96`: telemetry opt-out **не отключает сам roll request**, который несёт `X-Impeccable-Telemetry: off`; opt-out ограничивает telemetry-only отправку/хранение. Документ требует seed references вместо raw seed key в committed briefs и self-ignored runtime ledger. Это декларация протокола, не наше сетевое наблюдение.

`docs/DEVELOP.md:88–103`: journeys требуют private sign-in/personas/server, unpacked dev и store builds различаются; trust root — outing page, без отдельного вопроса перед полученной journey, up to eight origins. Known limits прямо допускают screenshot password в cross-origin frame/closed shadow root, filled-card screenshots и нераспознанный OTP без autocomplete. Это **документированные риски**, не подтверждённая эксплуатация текущего extension runtime. Detector и journey — разные возможности.

**Friday delta:** до пилота нужен feature→endpoint→payload→storage→opt-out→fallback→budget manifest. Отключение telemetry нельзя описывать как offline/no-network. Не отдавать клиентский код/дизайн/ПД closed service без отдельного разрешённого scope. Уже найденный account DESIGN sync/privacy conflict подробно закреплён в `support-1.md:97–99`; здесь он не переобъявлен новым source audit account-кода. Предлагаемые reviewers: security-api-surface / rkn-compliance по своим зонам. **Verdict: service/privacy acceptance BLOCKED до отдельного авторизованного пилота; установленной интеграции нет.**

### SR-04 — ВАЖНО: receipts/quote parser/UI draft не аутентифицируют владельца

**Evidence:** `ui/component-review/README.md:5–9,21–27` отделяет UI draft, local-browser feedback и authenticated human approval; host обязан проверить identity, malformed/duplicate/stale submissions. Store вне producer проекта защищает от редактирования builder JSON, но не от другого процесса с теми же OS permissions. `docs/COMP-GATE-INTEGRITY.md:59–78` связывает receipt с asset/region/comp hash; `--force --reason` требует direct attributed quote, однако parser **не аутентифицирует цитату**, calling harness должен хранить actual user answer; local receipts не security boundary против произвольного writer.

**Friday delta:** использовать revision-bound evidence и invalidation, не заменять существующий `owner acceptance` меткой `ship`, JSON `approved`, quote string или self-report агента. Нужен trusted host receipt, сохраняющий реальный ответ/контекст и точный scope. `.codex/CODEX.md:23–29,84–90` уже требует отдельного owner acceptance, поэтому это усиление реализации, не новая доктрина. Предлагаемый владелец механизма: координатор approval/handoff, specialist implementation не назначен. **Verdict: OPEN trust-boundary requirement, не обвинение в доказанном approval bypass.**

### SR-05 — КАЧЕСТВО: поверхностная копия chrome нарушает review и brand boundaries

**Evidence:** `ui/component-review/theme.css:1–46` меняет dark **chrome**, оставляя media variables/light img/iframe независимыми. `vendor/kinpaku-tokens.css:21–64,99–116,157–220` — собственный one-light-theme kit, semantic gold/patina, 26/32/44px control scales и 11px dense micro floor, не общая Friday design system. `extension/devtools/panel.css:322–343` делает finding description/copy видимыми на hover; `:651–653` локально снимает pulse scanning-dot, не является полным аудитом shared reduced-motion или keyboard поведения.

**Friday delta:** сохранять original comp/preview colours при переключении review UI theme, не перекрашивать evidence. Dense desktop DevTools и его 18/26px элементы нельзя автоматически переносить как mobile44px-compliant client UI; hover-only функции требуют отдельного focus/touch check. Ни браузер, ни общий cascade здесь не измерялись; CSS потенциальный риск не выдан за доказанный accessibility defect всего продукта. Предлагаемые роли: design-reviewer / qa-engineer. **Verdict: полезная локальная методика + compatibility checks до переноса.**

### SR-06 — КАЧЕСТВО: install/schema/golden PASS не доказывает portable runtime

**Evidence:** `docs/AGENTS-ENGINE.md:3–5,24–44,69–119` — explicit account root, owner/harness/root journal, drift refusal, atomic recovery, Codex `/hooks` approval/trust; **user scope Claude/Codex**, не Hermes registration. Caller commands trusted; engine не исполняет instruction bodies. `cli/platform-packages/*/package.json:2–16` — templates `0.0.0-engine`, target-specific os/cpu/bin; `README.md:9–15` объясняет release substitution. Это не найденный mismatch опубликованного npm.

`docs/WINDOWS-SIGNING.md:26–49` требует actual protected release для Azure/OIDC/Authenticode E2E. Golden `parity.json` и `css-rules.json` — differential data из frozen исторических JS modules, не свежий PASS; `crates/html/tests/css_rules.rs:8–11` требует сохранить **ручные signed-number corrections**, значит механическая регенерация не равна byte provenance.

**Friday delta:** отдельный capability matrix для Hermes/OS/host approvals/installed binary/framework/static-vs-browser engines, всегда различать unavailable/skip/fail/pass. Не ставить аккаунтный installer и не менять hooks ради исследования. Предлагаемые роли при будущем пилоте: automator/devops + qa-engineer. **Verdict: live compatibility НЕ ПРОВЕРЕНА, переноса/установки нет.**

## 2. Что содержательно закрыто помимо findings

### Authored docs / CSS / HTML / config

- `CLAUDE.md` и `AGENTS.md`: one skill/router, four per-surface modes vs orthogonal native platform, pinned Rust engine и binary download resolver; source-first vs generated release sync; cheap boot vs expensive doctor/staleness; test skips и real-API opt-ins; hook cost cold-process, native skip; release/version/checksum boundaries. Это repo instructions-as-data, не команды, которые мы исполнили. `CLAUDE.md:47` предлагает вынести a11y в audit ради design confidence: **не переносить как отмену ранних Friday a11y constraints**. Контекст режима полезен, откладывание accessibility не доказанное улучшение.
- `docs/DEVELOP.md`: provider config/placeholders/frontmatter/build/test ownership и private journeys. Общее «No external dependencies required» в `:51–53` не отменяет Rust/WASM/browser/version prerequisites конкретных функций, уже описанные в CLAUDE/README.
- `docs/COMP-GATE-INTEGRITY.md`: numeric score отдельно от blockers; unavailable measurements не старый capture; raw/effective labels согласованы; failures очищают/карантинируют partial/stale files; hash-bound waivers invalidated при drift; lowest raw score не основание regenerate. Полезный паттерн Friday evidence freshness; tests перечислены документом, нами не запускались.
- `map_inspection.html`: полностью прочитаны CSS/HTML/inline JS. Zoom/whole-comp, crop overlays, partial-mask очередь, связанные foreground regions, raw technical report, diagnostics; zero errors не скрывает crop accuracy inspection. `:299` прямо говорит reference-only/no build-state or approval changes. Report paths/data — входы генератора; без проверки host renderer не утверждается XSS/safety PASS.
- `demos/landing-demo/{classic/index.html,index.html,PRODUCT.md,DESIGN.md,DESIGN.json}`: classic glow/Inter и warm Fraunces варианты — **намеренные примеры анти-reference**, не approved output. PRODUCT отвергает и текущую warm-template страницу, generic features/claims; DESIGN описывает actual current state, не новую desired authority. В index есть external Google Fonts, `href="#"`, 10,000+ / SOC2 copy, фиксированная 3-column grid и hover lift. Нельзя брать демо за подтверждённые client claims, responsive baseline или motion acceptance. JSON narrative, компоненты с HTML/CSS, color roles/ramps, reserved-unused card motion и container widths прочитаны полностью, не classified из-за `generatedAt`.
- Review `README`, `DESIGN-stage`, tokens и theme: static provenance vs authenticated approvals, revision-aware repair/history/invalidation, inventory, future host integration, side-by-side/Before-After-Comp, клавиатура/undo, intended narrow layout. Private canonical kit недоступен в данном snapshot; header provenance не доказательство сверки его remote bytes/прав.
- Extension settings/walks/devtools/sidebar/offscreen HTML: реальные entrypoint/scaffold/styles/scripts, loading/disabled controls и status/aria-live; markup не доказывает fulfilled journey/account/scan. Offscreen WASM comment отделяет extension CSP от scanned-page CSP. Panel CSS прочитан целиком, включая switches/focus/hover, severity tokens, dense controls и scanning animation.
- `.impeccable/config.json`, surface record и live config: actual ignores/reasons/hook output caps; local `cspChecked:true` и target `site/layouts/Base.astro` — metadata, не текущая security проверка Friday. Никаких runtime flags из них не применялось. `biome.json` целиком: schema1.9.4/tailwindDirectives; это дополнительно опровергает слишком широкое чтение AGENTS «no formatter configured» как отсутствие любого config, но не доказывает active Biome invocation.

### Fixtures / лицензии / keys

Все назначенные tiny broken-image и unused-ignore fixtures прочитаны полностью: missing/empty/hash/lazy/srcset, Angular bound img, JS strings/comments/regex/tagged/nested templates, Astro map/apostrophe, Svelte regex attribute, unclosed quote; mixed live/stale/next-line/wildcard ignores. Deliberately malformed fixture не production bug, input corpus не test-pass.

`comp-copy/README.md`: synthetic artwork/independent seed, resample/blur/roll regression, prompt metadata не generation proof; ограничение «не любой transformed copy». `live/assets/README.md`: tracked WASM+JS/registry generator provenance vs embedded skill JS, не новая handwritten реализация.

Все три OFL прочитаны непосредственно: Albert copyright2021, Alumni2015; две Alumni копии имеют одинаковый SHA и больше не `alias-pending-canonical`. SIL OFL1.1 разрешает embed/bundle с notice+license, запрещает standalone-sale, ограничивает RFN/endorsement, распространяется на font software, не на созданный документ; termination/disclaimer учтены. Наличие license не проверяет glyph/Cyrillic coverage самих binaries.

`scripts/cli-pro-release-keys.json` прочитан целиком. `crates/account/src/pro/verify.rs:1–55` подтверждает **публичный** 32-byte Ed25519 trust root по key ID, не утечку private key. Формат 64 lowercase hex проверен; действительность remote artifact signature здесь не проверялась.

## 3. Classified данные: выполненный schema/generator/reference/provenance audit

| Путь | Проверено как данные | Чего это не доказывает |
|---|---|---|
| `Cargo.lock` (2 108 строк) | Header `@generated`, полный tomllib parse lock-v4: **220 packages**, **200 registry checksums**, только crates.io registry + workspace origins; Cargo.toml workspace0.1.30/path dependencies прочитаны для provenance | Нет semantic review каждого dependency, CVE scan, download checksum verification, resolver/build |
| `bun.lock` (475 строк) | Полный JSONC parse собственным string-aware удалением trailing commas, **222 package tuples**, все длины4 и **222 sha512 integrity**; root dev/optional dependency maps точно совпали с package.json; platform pins0.1.30 | Legacy workspace name `vibe-design-plugins` отличается от manifest `impeccable`; это metadata drift, не доказанная поломка install. Нет package execution/CVE/registry validation |
| `crates/comp/tests/golden/parity.json` (1 050 строк) | Полный JSON parse; **14 top-level sections** совпали с G.* assignments полностью прочитанного frozen `record.mjs:1–199`; consumer `parity.rs:1–24`, samples/CRC/raster/scores/fingerprint/index/hero provenance просмотрены | Не каждое числовое значение вручную, не Rust parity run, не подтверждение качества всех изображений |
| `crates/html/tests/fixtures/css-rules.json` (inventory3, actual1) | Полный JSON parse: **205 cases / 1 364 rules**, case/rule field sets и shapes; assigned `gen-css-rules.mjs:1–188` прочитан целиком, consumer `css_rules.rs:1–85`; historical source+hand corrections разграничены | Не 205 ручных семантических разборов CSS, не generator execution и не Rust parity PASS |

Frozen generators зависят от старых удалённых JS modules через `IMPECCABLE_PUBLIC_REPO`. Мы их не запускали, не подбирали другой checkout и не «обновляли» goldens для зелёного результата. Все четыре `classified` остаются таковыми при merge coverage; их нельзя суммировать как authored-source-full.

## 4. Проверка deliverables и handoff

- Assignment set equality: ровно 48 paths после единственного exclusion; unique(repo,path), все hashes совпадают; 44 full/4 classified/0 partial. Для каждого full ranges покрывают [1,actual_lines]. JSON syntax проверен write-tool; собственные data-only проверки не обозначены upstream tests.
- Сопоставление выполнено с `COMPARISON.md` R2 и `friday-provenance.md`, `support-1.md`; локальные шрифтовые regex/разрешённые пары перечитаны непосредственно. Claims другого worker о runtime не превращены в наше выполнение.
- Открытые SR-01…SR-06 переданы координатору с evidence и границами уверенности. Реальные дальнейшие исполнители, разрешения на интеграцию и независимое ревью назначаются координатором; task gate/approvals другой сессии не имитировались и не менялись.
- **Остаток outside scope:** весь CLI-CONTRACT у других workers; внешний private canonical/service, OS/browser/framework compatibility, actual signing release, glyph coverage и temporal/visual/security runtime verification здесь не проверены. Это не пропуски authored reading в назначенных 48 файлах.
