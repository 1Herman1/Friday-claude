# F3 — независимое ревью frozen six-file candidate

## Вердикты и идентичность

- **code-reviewer / semantic migration: PASS.** Критичных проблем не обнаружено.
- **security-secrets-scanner, bounded six-file scope: PASS.** Утечек секретов не обнаружено.

Обе роли фактически исполнил один независимый от реализации Hermes reviewer, модель `gpt-6.1-sol`, provider `openai-codex`; это не два отдельных агента и не нативный Codex IDE. Reviewer ID: `Hermes-F3-review/20261127_181452_727c97` (наблюдаемый `HERMES_SESSION_ID` инструмента; actor `uid:501`). Делегирования и исправлений source не было. Загружены полные `.codex/agents/review/code-reviewer.md`, `.codex/agents/security/security-secrets-scanner.md`, review-loop и процедура instruction-migration audit Friday; прочитан §13 security anti-patterns. Findings с уверенностью ≥80% отсутствуют; неподтверждённые предположения не объявлялись дефектами.

Вердикты относятся только к следующей revision, не к общему dirty checkout:

- base: `0a7af7680f490ad6c738f454810c46fd25caa39d`;
- candidate tree: `d292c86611993ff2eff6e4df6e5692d4345a3285`;
- review map: `/Users/germanbryzgalov/.hermes/cache/scratch/feature-freshness-parent-0o4xiyqk/final/review-map.json`;
- SHA-256 map: `17fec76b1857203d86145ca686f546f1c649d07dd6ae5aae99faf62f0d07f02f`;
- тестируемый export: соседний `final/export`. Этот отчёт не входит в проверенное six-file tree.

## Integrity и provenance

Для всех шести файлов независимо сверены SHA-256 export и выбранного рабочего файла, Git blob (самостоятельно вычисленный object hash и `git ls-tree`), mode tree `100644` и export `0644`. `git diff base tree --name-only` содержит ровно эти шесть путей. Дополнительно сравнены все 481 присутствующих в export tracked blob с candidate tree: расхождений нет. Guards повторены после тестов.

| Путь | SHA-256 | Git blob |
|---|---|---|
| `.codex/skills/feature/SKILL.md` | `59f87be4e140e63f1be0d728024b3b30fd5db24f2a8adb39845058cbad716225` | `73a6230bb82fc7843ed33804fc44f5018e2624c7` |
| `.codex/workflows/new-feature.md` | `d34caee60ebe76d4b1b44db7221c4250929ac538f12cd1df4522ccc440347330` | `dd4734cba7c449bf6df4879d7b05a3bd16fb9cd9` |
| `.codex/migration-manifest.json` | `d5ad620c39c5eecdc3b44e58d997c43333134a54d43513d3a3790c874ad0f247` | `3e97f36fed70551bab0aabf98dad461f5d72aea9` |
| `.codex/scripts/test_feature_migration.py` | `cdb143b5e32c6419e72949d20dbb0fe3c21e23e7e7e86f36844faf1ee92fc77c` | `554ece65ae8b694fc542e5bb004eb6995cf7e8ee` |
| `docs/research/design-agent-upgrade/rollout/followup-03-feature-freshness.md` | `e417d347dfd93f04ec55679e0a0236c3d2207bab7a49cdc10dcffa025ec80953` | `fe2a6f62eae34e160881d019181353ef5e83d52f` |
| `docs/research/design-agent-upgrade/rollout/FOLLOWUP-PLAN.md` | `f468ddbf36dd4e6b93c4a29dad94ba2b24a2474b49640c7168ad5389e625bd95` | `fc545d41e7be7c449075b8dc1a242651977b6c1c` |

JSON comparison manifest: 90 entries; остальные 89 полностью неизменны, metadata неизменна, единственная разница — `files[59].source_sha256`. До F3 стоял SHA-256 пустых bytes; после стоит реальный source hash. Source `.claude/commands/feature.md` — 1455 bytes, 19 строк, SHA-256 `1b52ca3e9caf7208008f3bea0a5416db6d5476483623067a9ba659c9f2a39132`: одинаков в Git objects `1c41295b`, `567209de`, base/HEAD, export и рабочем файле до/после проверки. Freshness warning не означал фактическое изменение source после миграции.

Независимо выполнены bounded `git log --all -- <source/targets>`, `git blame` source и чтение исторических blobs обоих targets:

- `1c41295b787a154950da03d53ef034cdb1d27c2e`, `2026-11-07T23:43:38+03:00`: skill имел adapter/пояснение arguments, workflow — подробную цепочку; command-specific obligations не были полностью представлены в skill.
- `567209de81642cbcf384a5f146bedd93a76712b0`, `2026-11-09T23:41:07+03:00`: targets стали generic loop. Их base bytes действительно равны этой revision.
- Blame подтверждает `a4acbcdbf` для brief/planner/researcher/review, `be4318524` для conditional architect/стека, `e6736f60c` для QA/build/E2E, `2e1aa1fd4` для рабочей ветки.

История доказывает происхождение, не согласие владельца. Основание sequenced repair — явное поручение владельца, переданное в scope, а не автор или сообщение коммита. Source workflow и candidate review-loop равны base. SHA-256 review-loop: `e2f5985cc87035f9f81d1156cfc06028669d46e1e96b5c40c83a4323574b4f49`. Candidate selftest равен base; существующая foreign dirty версия root selftest отличается и не использовалась/не исправлялась.

## Независимая смысловая проверка

Полностью прочитаны source command C (19 строк), source workflow W (38), target skill S (10), target workflow N (43), shared review-loop R, новый test (134), весь receipt с crosswalk, FOLLOWUP-PLAN и publication diff; manifest разобран полностью. Crosswalk проверен по исходным требованиям, а не принят за доказательство сам по себе.

| Source / действующее требование | Проверенное target поведение |
|---|---|
| C1–8: описание, brief, workflow | S8–10 принимает описание пользователя и явно направляет в N; `$ARGUMENTS` не выдан за работающий механизм Codex. N3 явно направляет в существующий R. |
| C10; W8–11: planner, файлы, риски, понятный план до реализации | N10–11: planner первым, поэтапный план/критерии до coder. |
| C11; W13–16: аналоги, интеграции, архитектура, все затронутые файлы, handoff | N12–15: все требования восстановлены. 15 файлов ограничивают первоначальный поиск аналогов, не full review или явно исчерпывающий аудит. |
| C12: architect при БД/API, схема/контракт/стек проекта | N16–17: отдельный conditional architect между research и coder. |
| C13; W18–21: стиль/стек, минимальный код, правила, план и контекст | N18–20: сохранены, плюс TDD. |
| C14; W23–28,32: профильные параллельные review и silent failures | N21–26: TS/React/DB predicates, общий fallback, secrets и unconditional для feature silent-failure-hunter. Волны ограничены слотами, независимость не отменена. |
| C15–16; W35–38: QA денег/доступа/инвариантов, stock/idempotency; ручной сценарий остального | N27–29: сохранены. Исторический blanket отказ от тестов вёрстки не переопределяет более сильные требования ТЗ/R; это явное согласование с текущим loop, не скрытая потеря QA. |
| C17: сборка и ключевой E2E | N30–31: обязательны, требуются реальные команды/результаты; skip/нет среды не PASS. |
| W30–32 и stronger loop: исправления, актуальное независимое review | N32–34 + R: текущая revision, все критерии, отсутствие открытых дефектов; self-check не заменяет независимость. |
| C19; W33: рабочая ветка, commit/push после проверки | N35–39: память/scope/gate перед Git, рабочая ветка берётся из существующего registry. Прочитанный `docs/projects/README.md` действительно хранит общую `claude/greeting-nnz368`; deployment branch/context остаются в project.md. Новые ветки не предписаны. |
| Усиление 567209de/current R, gates и полномочия | N3–8,21–43 + неизменённый R: полный staged/unstaged/untracked/deleted/committed scope, task gate, актуальность evidence, повторный цикл, post-publication verification, бюджет/права/pilot/owner acceptance, запреты Git/deploy, явный blocker сохранены. |

Отдельно проверены config role registrations и наличие зависимостей route. Runtime placeholder `<проект>` остаётся шаблоном конкретного project.md, не утверждением о существовании буквального пути. Доступный spawn требуется проверить; отсутствие механизма объявлено blocker. Файлы инструкций не объявляют уже выполненными native activation, hook execution или customer build. Подтверждённых пропущенных source obligations либо отката stronger review-loop не найдено.

## Независимо выполненные проверки

Только clean candidate export; root не использовался как среда тестов. Python 3.14.9 из уже установленного Hermes interpreter, `PYTHONDONTWRITEBYTECODE=1`, явный `TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch`, существующий `MOTION_DEPS=/Users/germanbryzgalov/.hermes/cache/scratch/motion-stage04`. Никаких installs/setup/network/provider/browser actions.

| Команда в export | Реальный результат |
|---|---|
| `<python> -m unittest discover -s .codex/scripts -p test_feature_migration.py -v` | RC 0, 4 tests, OK |
| `<python> -m unittest discover -s .codex/scripts -p 'test_*.py'` | RC 0, 83 tests, OK |
| `node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs` | RC 0, 64 tests, 64 pass, 0 fail/skip/cancel |
| `<python> .codex/scripts/selftest.py` | RC 0, оба PASS, WARNING отсутствуют |
| `<python> .codex/scripts/sync-roles.py` без `--apply` | RC 0, `Drift: none` |
| `git diff --check BASE TREE` | RC 0 |

Дополнительно suite исполнена с подсчётом фактически вызванных subtests: 16 (11 rule/route deletions + 5 dependency deletions), плюс реально отклонённый empty-hash mutant = **17 negative probes**, не 17 самостоятельных unittest cases. Fixtures на диске изолированы; удалённые зависимости действительно отсутствуют, а не берутся из root.

Независимый RED→GREEN replay в удаляемом scratch fixture:

1. Candidate semantic contract и receipt сначала GREEN.
2. Подставлен исходный skill blob base: настоящий `AssertionError` о недостижимом N из S.
3. Возвращён candidate skill: semantic GREEN.
4. Подставлен manifest blob base с empty-file hash: настоящий `AssertionError: Stale feature receipt` при неизменённых source bytes, до восстановления hash.
5. Возвращён candidate manifest: receipt GREEN.

Прочитаны исходные реальные RED logs исполнителя: `f3-feature/red-semantics.log` — 1 test/1 failure (route); `red-receipt.log` — 4 tests/2 failures (stale receipt и precondition hash mutation). Их SHA-256 соответственно `7a37ec8bbce2a7d3a269c7d543f622f2939ca7c24450928617b1a4524874524b` и `f60fe2e314f3732b26461bd52f557d0e4babdbbbc03fbc6e6319a06d29b9f77f`. Логи сами по себе не доказывают хронологию редактирования, но отказ старых bytes воспроизведён независимо; hash repair не подменяет semantic restoration.

Проверка не ограничилась string tests: действующие S/N/R прочитаны целиком; обязательства расположены в реальных директивах, не в комментариях или orphan markers. При этом substring checks не являются универсальным parser/proof поведения произвольной инструкции. `assert` в новом helper — **offline unit contract**, не backend validation/security boundary и не обещание защиты при `python -O`.

## Bounded secrets / I/O / boundaries

Полностью проверены все шесть файлов, не только added lines: signatures AWS/Stripe/GitHub/private keys/JWT, literal credential assignments, credential-bearing connection strings; проверено содержимое prose/manifest/test вручную. Подозрительных совпадений нет. В six-file delta нет `.env`, CI secret config, production code или auth endpoint. Применимого repository/research security-profile не найдено; стек bounded delta — Markdown/JSON и Python standard library unittest, использованы общие сигнатуры и имена credential variables. Это не проверка профилей всех клиентских проектов.

Новый test читает fixed repository paths, копирует ограниченный список файлов в `TemporaryDirectory`, удаляет/восстанавливает только fixture files и меняет receipt dictionary в памяти. Нет network client, subprocess, eval, provider calls, записи source/root или загрузки зависимостей. Markdown не расширяет бюджет, публикацию, доступы либо полномочия агента. Не обнаружено секретов, требующих ротации. Ротация/переписывание истории не выполнялись.

**Не заявлены:** full-repository/full-history secrets PASS, проверка production infra или backend security. История читалась только для provenance указанных source/targets, не сканировалась целиком на секреты. Native Codex activation/reload, реальный specialist spawn/hook runner, customer build, product E2E, design acceptance, remote publication/read-back не выполнялись и этим PASS не покрыты. Working 90 Python и прежние parent/child runs — отдельные предоставленные evidence, не мои fresh root runs.

## Изменения и ограничения

Единственный созданный repository artifact — этот отчёт. Source, шесть frozen файлов, review-map/proposal/plan, индекс, refs и чужие dirty файлы не изменялись; Git writes отсутствуют. Для replay использован только автоматически удаляемый scratch fixture. Проверка base-equality root selftest выявила уже известную foreign dirty версию: проверялся base-identical selftest export, а не исправлялся root. Других блокеров bounded review нет. Любое изменение candidate требует новой проверки затронутой revision; PASS не закрывает следующие этапы FOLLOWUP-PLAN.
