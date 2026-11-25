# Authored test infrastructure: закрытие замечания R2-B1

## Что исправлено

Независимое R2 review верно указало: префикс `tests/` не делает любой `.mjs` frozen fixture. Координатор отдельно содержательно прочитал **пять authored executable helpers**, а не повысил их до full по hashes/imports. Ни один upstream файл не импортировался/исполнялся. Source snapshot: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`.

| Файл | Прочитанные строки | Ответственность |
|---|---|---|
| `tests/live-e2e/agents/llm-agent.mjs` |1–1674, блоки1–550/551–1100/1101–1674|LLM-backed generate/manual-edit/steer test adapter, provider configuration, bounded correction, response/evidence validation|
| `tests/oracle/vectors/hooks-impl.mjs` |1–73|Node loader source transform для selected historical engine modules|
| `tests/oracle/vectors/hooks.mjs` |1–13|Loader registration|
| `tests/oracle/vectors/record-calls.mjs` |1–67|Удаление/создание output, subprocess record runs, aggregate count|
| `tests/oracle/vectors/recorder.mjs` |1–106|Plain-value encoder, dedupe, append vectors и skipped summary|

Точный ledger: `support-authored-test-coverage.json`. Прежний structural scan сам по себе **никогда не был** substantive reading этих helpers. В corpus ledger artifact kind исправлен на `authored-test-infrastructure`; более позднее содержательное чтение находится в отдельном support ledger и побеждает при merge. Первоначальный corpus assignment сохранён отдельно для воспроизводимого повторения scanner; он не должен зависеть от того, успел ли semantic merger повысить файл до full.

## LLM adapter: содержательный разбор

- **1–53,194–324:** header обещает прежний Anthropic-first, но реализация `resolveProvider` предпочитает OpenAI, затем Anthropic/DeepSeek; defaults/model overrides, missing key→null/skip, includeLiveSpec и API shim прочитаны. `createOpenAiShim` динамически импортирует AI SDK, переводит provider response/usage в Anthropic-подобную форму. Это не текущая версия/доступность модели во Friday. Подключение/вызовы не выполнялись.
- **54–192:** три prompt contracts: варианты, manual source plan, page-level steer. Копия считается literal data, preserved model types/lookup keys и exact source substring важнее DOM rewrite; no comments/scripts/runtime markers — это требования prompt, не полная enforced security boundary.
- **327–454:** generation имеет3 semantic attempts, provider retries/timeouts, JSON/CSS validation, count/progressive/insert-vs-replace checks. Retry добавляет failed predicates, не выдаёт source-identical вариант за успешный meaningful change. Сохранение visible text проверяется `includes` после whitespace normalization, не строгим равенством всех authored copy/DOM semantics.
- **456–596:** manual edit загружает actual event batch и current source evidence, отдельно проверяет planning coverage и source-edit coverage. При write/apply failure различает partial и fully failed, обновляет sourceContext перед ограниченным retry. Production result отбрасывает harness-only planning/sourceEdits, но не доказывает правильность всех source изменений без orchestrator validation.
- **599–713:** steer требует nonempty file/edits и required marker; actual apply делегирован `applySteerEdits` из уже отдельно разобранного `agent.mjs`. Контекстные файлы нормализуются лексически относительно tmp; здесь нет самостоятельной гарантии realpath/symlink confinement. Для steer явный request timeout задаётся DeepSeek, остальным передаются SDK defaults — отличие от bounded generate/manual paths, не измеренная бесконечная задержка.
- **715–1059:** planning rows, request payload/progressive delivery, JSON extraction и shallow CSS/HTML validators. CSS brace/string/comment scan не полноценный CSS parser. `hasSingleTopLevelElement` — regex/depth counter, не браузерный parser с matching-tag AST. Запрет `<script>`/framework constructs не равен sanitization всех event attributes, URLs или CSS/network. Это тестовая эвристика, не продуктовый sandbox.
- **1061–1422:** sourceHint/candidate priority, exact staged copy, typed-number vs quoted display, leading-zero preservation, JSX `>` quoting, coupled keys/count/maps. Предикаты сильнее одного model self-report, но основаны на string/regex inference. Не переносить их как универсальный compiler/type checker.
- **1424–1674:** schema guards, complete retry JSON, prior rejected response, production-field filtering, visible-text normalization/entity decoding и first balanced JSON value extraction. Текст с несколькими JSON values может дать первый подходящий блок; «JSON only» prompt строже реального parser.

## Oracle recorder: содержательный разбор

- `hooks-impl:15–26,29–72` выбирает пять suffix paths, находит named exports/plain declarations regex и внедряет wrappers после import block. Это ограниченная историческая instrumentation, не общий JS parser. Hoisting/transformation intent сам по себе не доказывает неизменное поведение module TDZ/циклических imports.
- `hooks:10–13` вызывает Node `register`; даже простой импорт меняет loader state, поэтому чтение не сопровождалось import.
- `record-calls:23–35` безусловно удаляет output `calls/`, затем запускает CLI/tests с унаследованным env и loader. `run` бросает на spawn error, но не на ненулевой `status`; итоговый счётчик не означает, что все subprocesses успешно выполнились. Frozen snapshot README прямо запрещает регенерацию этих vectors: удалённые исторические modules нельзя «восстановить» запуском текущего entrypoint.
- `recorder:19–46` кодирует специальные числа, bigint/Map/Set и plain objects с depth cap12; DOM/classes/functions/RegExp исключаются. Это явный предел differential coverage.
- `recorder:68–94` сначала вызывает оригинал: thrown exceptions не записываются; Promises проходят без result recording. Дедупликация только по encoded args и лимит5000 на function не доказывают детерминизм outputs. Skip counters/exit merge не покрывают все подобные потери наблюдения; concurrent append/summary не tested.

## Дельта Friday и пределы

Полезно заимствовать bounded correction с exact failed predicates, current-source refresh, literal user-copy/typed-model distinction и separates produced/applied/validated. Нельзя считать fixture count, frozen-vector count, skipped test, ненулевой subprocess с output или model JSON признаком runtime PASS. Нельзя подключать LLM test adapter к клиентским файлам ради аудита: он делает реальные API calls и source writes.

Все отмеченные риски — **статические границы authored test infrastructure**, не новые подтверждённые production bugs. Реально назначенный получатель — координатор текущего аудита; реализация изменений upstream/Friday не поручена. Snapshot hashes, line ranges и per-file методы проверяются merger; full означает содержательное чтение перечисленных файлов, не запуск SDK/тестов и не независимое runtime/security ревью.
