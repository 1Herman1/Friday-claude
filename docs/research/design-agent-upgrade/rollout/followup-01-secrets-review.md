# F1 — независимое bounded security-secrets review

## Вердикт: PASS в указанной области

**Утечек секретов не обнаружено.** Подтверждённых блокирующих findings по секретам, экспорту credentials или скрытым provider/network вызовам offline validator нет. Это PASS только frozen candidate из 21 файла, не всего репозитория, Git-истории, runtime или реальной медиа-цепочки.

Reviewer: **adapted Hermes security-secrets-scanner, OpenAI gpt-6.1-sol**, отдельный конечный reviewer-subagent; не native Codex. Реализацию не менял, другим агентам работу не делегировал. Прочитаны полный файл роли `.codex/agents/security/security-secrets-scanner.md`, `docs/core/anti-patterns/security.md` (включая §13), `.codex/CODEX.md` и review-loop. Они являются контекстом роли, не дополнительным проверенным publication scope.

## Точная revision и границы

- Repository: `/Users/germanbryzgalov/Friday-claude`.
- Base: `e9e31fd5b80f48729a87823409c966f9c2b36d42`.
- Candidate tree: `d727d8e34966162a9293929e7e2d1bc139a90d8b`.
- Frozen export: `/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/final/export`.
- Scope map: `/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/final/review-map.json`.
- Map SHA-256: `37c5c7ccdb8317ee910a2904ac1a1bfad95513209ef9bbfbf745d6dc4affaed2`.
- `proposal.json` SHA-256: `12a22b1f52581d253d91a70ffaea944309ca0e470af62cb7f0f80742ecd6ff53`.
- `publication.diff` SHA-256: `4626203549eef8be42804ec08fbeb336ea6cd76ee9a6cf02c34d0c3c5deab853` (идентификатор артефакта; проверка выполнена по полным файлам, не только diff).

Проверены все **21/21** полных файлов, **279447 байт**, включая весь исходный TOML и декодированные `developer_instructions`. Все пять TOML bodies программно сравнивались с полными прочитанными MD: равенство подтверждено; остальные TOML поля разобраны через `tomllib`. Это устраняет усечение длинной однострочной TOML-строки в первоначальном viewer output.

До чтения и после проверок: map hash неизменен; каждый export SHA-256 совпал с `sha256`, каждый source-work SHA-256 — с `working_sha256` карты, **0 несовпадений в обеих группах**. Рабочие routing-файлы использовались только для hash guards, не как содержимое candidate. Вычислены Git blob SHA-1 полных candidate bytes, сверены с map и read-only `git ls-tree` указанного tree: **21/21 blob/mode совпали**. `proposal.json` имеет ровно те же 21 пути и те же полные bytes по SHA-256. Содержимое остального dirty checkout не сканировалось.

### Полный allowlist / SHA-256 проверенных export bytes

| Путь | SHA-256 |
|---|---|
| `.codex/config.toml` | `fb37e0cade9d9a5902eabd3c1ae6c0dabbe7759d8cb824a67b50f122941d543d` |
| `.codex/agents/design/taste-curator.md` | `53cedda38d3a079f285040e736295e917ab5936c8656e7d4568cc96d02e9dcab` |
| `.codex/agents/taste-curator.toml` | `395f01ee61cd226bf46773b3765c1ef1b3872a25e9d55e81d62740bcc96160c7` |
| `.codex/agents/design/design-department.md` | `19e9829e0d541512b3e57787701a0f22a8ce8ea7376dae81c85125045f2d16ce` |
| `.codex/agents/design-department.toml` | `04234cf0c5a184cc85755c78aa6a5dd86e2a9e00eae3a15aa53a890d80206595` |
| `.codex/agents/design/media-generator.md` | `015ddfa039a61d6223a8828035f7e46d371c7b3806f9e8ce8bc709dc59e1bd43` |
| `.codex/agents/media-generator.toml` | `96ed1215a766b418e7e253a6502db37713f71c500781c3a424fb59e987122931` |
| `.codex/agents/design/brand-guard.md` | `eee1481fe25e97a16f404ffa6ed841e5b950f4b47bb18656eaec3b58a2c21e3a` |
| `.codex/agents/brand-guard.toml` | `e19414eadf15d194d983ec1f975bd4d6d3995fa3d1fda48e82b41dc51a279f08` |
| `.codex/agents/design/design-reviewer.md` | `547b4bbe2dde372ada4f017c518b301a1ff65d501c996bb6e51a6a8f632dec4f` |
| `.codex/agents/design-reviewer.toml` | `dcfbd08c27862126c4978231a8890035ce04411f10a883dac16bfbddfd5c9904` |
| `docs/core/media-reference-handoff.md` | `a087ceb703d309c55fd073652598231e25ad526e318bf645fa1b03e6c67e0e0a` |
| `docs/core/templates/media-handoff.json` | `2004fe80dc61882f07bd3df092acae3771f2e755186667e78139000d963828d4` |
| `.codex/scripts/validate_media_handoff.py` | `21aece625d70bed4581837cbe50812222cea5e4d4e116454aba96fe43b0528b7` |
| `.codex/scripts/test_media_handoff.py` | `51285a87e3aaa07dfffe3a607887494810471f1b9db5c25415d92e54bafc37b0` |
| `.codex/scripts/test_handoff_publication.py` | `ddbc7a163c6edd3212028e5f275a6e52cb3c9fd050e20a631501706840bffa8e` |
| `docs/research/design-agent-upgrade/rollout/followup-01-handoff.md` | `9c6bd4bce854ec2d4549d408a7abffd24c3d7df6df95184e7838ad01addc40c9` |
| `docs/research/design-agent-upgrade/rollout/followup-01-handoff-routing.md` | `e5b7b3d5e9219b7d9c1dfb5f1e39061a89e9019470f840940fc364f58dc84f4d` |
| `docs/research/design-agent-upgrade/rollout/FOLLOWUP-PLAN.md` | `06db3c20ca9fd79d5150980f1790c2835b2ca65777271bcd93e680d76e227d61` |
| `docs/research/design-agent-upgrade/rollout/recheck-2026-11-26.md` | `9bb145bec12dbb02ed66bf2aa1d334da02ba32031b0fa265e12092fbb9e006ec` |
| `docs/research/design-agent-upgrade/rollout/followup-01-parent-verification.md` | `936eb0f9f53c21d25aa8bd6f5226c6f7af672b922e890fe67c3265ef11f86b90` |

## Реальные методы и результаты

1. **Сигнатуры по полному содержимому:** AWS AKIA/ASIA; Stripe secret/restricted live/test; GitHub gh-prefix/PAT; OpenAI sk/proj/service-account; трёхчастный JWT; PEM/PGP private key; URL с user:password; secret-bearing query parameters; строковые присваивания api-key/password/passwd/secret/token/access-key/client-secret. Все категории, кроме одного literal-context кандидата, дали 0. Кандидат `.codex/config.toml:218` — имя переменной окружения `TWENTYFIRST_API_KEY` в `env_http_headers`, **не значение ключа**. AST трёх Python файлов: 0 строковых secret assignments.
2. **Энтропия:** выделение ASCII token-like последовательностей `[A-Za-z0-9_+/=-]` длиной ≥24 с Shannon entropy ≥4.3 бит/символ, затем контекстная проверка. Получены 7 кандидатов, все — части документированных локальных scratch/dependency paths на строках F1 report:47, F1b report:98/105/107, FOLLOWUP-PLAN:5, parent verification:21; не credentials. Hex hashes и низкоэнтропийные fixture digests рассмотрены как hashes/fixtures при полном чтении, не объявлены секретами. Порог — эвристика, не доказательство отсутствия произвольного секрета.
3. **Ручная трассировка и AST:** прочитаны все imports, вызовы, путь данных manifest → проверки → stdout, subprocess/importlib границы обоих тестов, provider/upload команды в документации, config env mapping. Код из manifest не интерпретируется как Python/команда.
4. **Фактические локальные probes** существующим Python 3.11.15 (`/Users/germanbryzgalov/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none/bin/python3 -I -B`): точный validator загружался из frozen bytes в память, без записи модулей. Проверены 9 validate-сценариев: synthetic dry-run, отказ без dry-run, отказ AI rights, owner/budget, scale, publication, dropped native ref, dropped transfer ref, `fixture:false` с dry-run. Все ожидания подтверждены; последний negative probe перенаправлял пути на отсутствующие scratch inputs и использовал `stage: ready`, не читал реальные host originals/evidence.
5. **Дополнительный guarded запуск:** после прогрева ленивых stdlib imports аудит-хук запрещал `open`, socket events, subprocess.Popen, os.system и изменение environment. Под ним повторены 7 fixture-validation сценариев и оба `main()` сценария. Для `main()` только `Path.read_text` заменён на точный synthetic JSON в памяти, `sys.argv` задавал manifest и наличие/отсутствие `--dry-run`; stdout реально разобран как JSON. Получены соответственно exit **0 / 1**, `valid: true / false`, в обоих случаях `generation_executed: false`; попыток запрещённых границ **0**. Это вызов настоящего `main()` с mocked input I/O, не полноценный отдельный CLI subprocess и не provider test.

Первый audit-probe остановился на ленивом чтении Python stdlib при создании argparse parser: собственный слишком ранний `open` guard, не network/product defect. После предварительной загрузки этой stdlib зависимости guarded rerun завершился exit 0; ошибка не замолчана и не засчитана как успешный первый запуск. Общие regression suites других reviewers здесь не перезапускались и их GREEN не выдаётся за собственное доказательство.

## Actual I/O, credentials и provider boundaries

- **Validator** `.codex/scripts/validate_media_handoff.py:1–159`: только argparse/json/pathlib/hashlib/re. CLI читает указанный manifest (:151); при `fixture:false` проверяет пути, читает original bytes для SHA-256 (:99–106), native evidence JSON (:127–132), проверяет MASTER/UI-kit (:138–141). Эти входные пути не sandboxed: инструмент рассчитан на разрешённые локальные manifests, не публичный недоверенный upload endpoint. Нет network/provider/backend клиента, subprocess, shell, getenv/environ, записи файлов или загрузки auth. Выход — JSON в stdout (:154); он не выводит manifest/байты originals. Ошибки могут включать пользовательские ref IDs/пути/OS error: **не следует помещать credentials в manifest, IDs или paths**. Автоматической redaction произвольного недоверенного текста validator не обещает.
- **Adopted test** `test_media_handoff.py:14–23,60–78,144–150`: importlib исполняет только локальный фиксированный validator; чтение template/config/role files. Subprocess — список аргументов локального Python + validator + template, без `shell=True`; не backend. Этот тест наследует environment родителя, то есть не является credential-isolation sandbox.
- **Publication test** `test_handoff_publication.py:63–85`: записывает synthetic JSON и копию validator только в TemporaryDirectory, заменяет `/fixture/` paths на disposable missing prefix, запускает локальный Python `-I` со списком аргументов, timeout=30 и capture_output. `env={**os.environ,...}` наследует environment, а не очищает его; секреты не сериализует и наружу не отправляет. Для исполнения suite TMPDIR должен указывать в Hermes scratch. Сам suite в этом review не исполнялся; новых temp файлов reviewer не создавал.
- **Config** `.codex/config.toml:215–230`: присутствуют реальные декларации MCP readiness/launch boundaries — HTTPS endpoint 21st.dev и bash launchers icon-library/Nullume; `env_http_headers`/`env_vars` с именами TWENTYFIRST_API_KEY, LOTTIEFILES_API_KEY, KIE_API_KEY. Это потенциальная передача разрешённых credentials настроенным MCP при отдельной активации runtime, **не отсутствие сетевых возможностей всего config**. Literal credential values в candidate нет; launcher-файлы и их поведение вне 21-file scope не проверены и не запускались. Offline validator не загружает config и не стартует MCP.
- **Документация/роли:** readiness/native generation/Nullume/Artlist upload примеры являются инструкциями для отдельной разрешённой задачи, не исполненным кодом review. Условность backend, AI-input rights, owner/budget/pilot/scale/visual/production gates сохранена (`media-generator.md:3–13,37–47`; contract:26–51,94–114,132–198). Contract:47–49 запрещает export cookies/auth и обход WAF; :172–184 требует compact native evidence без auth/base64 и ручную проверку. Никакие такие команды reviewer не запускал.

## Synthetic fixture и approval

`media-handoff.json:3–4` явно помечен synthetic и предупреждает, что не подтверждает research/rights/vision/generation. `fixture://`, `/fixture/`, повторяющиеся a/b/c digests и approval strings — искусственные данные. `publication.approved` исходно false (:24). Validator требует явный boolean fixture и допускает `fixture:true` лишь с dry-run (:29–32); `fixture:false` не получает exemption даже с этим флагом (:99–106,127–141). Успешный dry-run **не выдаёт реальные права или approval** и не запускает генерацию.

Проверка наличия строк `owner_approval`, `ai_evidence`, native paths и vision evidence не удостоверяет их подлинность. Это прямо оговорено в contract:180–184; reviewer/владелец должны проверять реальные evidence. Поэтому возможность структурно заполнить synthetic approval поля не трактуется как runtime authorization bypass: реального authorization backend здесь нет. Одного green JSON недостаточно для генерации, загрузки в vision/provider, публикации или принятия результата.

## Ограничения и изменения

- Project-specific security-profile для **этого Friday tooling scope** не предоставлен и среди 21 файлов отсутствует; профили клиентских проектов не подставлялись и за пределами allowlist не искались. Стек определён по фактическому коду: Python stdlib + JSON + TOML/Markdown, не клиентский Next.js/Stripe backend. Это явное ограничение, а не утверждение об отсутствии профилей во всём repository.
- `.env`/CI secrets/history не входят в frozen allowlist; не читались `.env`, runtime accounts, cookies, credential stores, реальные owner/backend inputs. Не проверялись действительность ключей, разделение production/test credentials, реальная политика ротации и состояние аккаунтов. Никакие кандидаты не проверялись у провайдеров.
- Это эвристический signature/context/entropy + code-boundary review, не gitleaks/trufflehog certification, не full-repo/history PASS, не security sandbox/SSRF/authorization аудит всего runtime. Отсутствие находок не гарантирует отсутствие неизвестного секрета или уязвимости.
- Реальных network/provider/upload/browser/generation действий, Git writes, установок, ротации или переписывания истории не было. Исходные 21 source paths и export не менялись; постпроверка hash guards прошла без ошибок.
- Единственный созданный файл: `docs/research/design-agent-upgrade/rollout/followup-01-secrets-review.md` — этот отчёт; он вне frozen candidate и не меняет его revision. При изменении любого candidate/source guard потребуется повторная привязка и review.
