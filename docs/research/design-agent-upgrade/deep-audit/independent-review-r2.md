# Независимое ревью R2 — сравнительная сводка и disclosure

## Verdict / scope / revision

**REQUEST_CHANGES — один blocker disclosure/classification.** Содержательные исправления прежних B1/B2/B3 подтверждены. Delta-only, самостоятельная ценность Taste, приоритет brand/core и отделение исследования от интеграции согласованы. Числа merged coverage воспроизводятся. Однако blanket-классификация остатка `tests/` как fixture/reference data скрывает также authored test infrastructure; текущая сводка этого исключения не раскрывает. Это не утверждение о найденном production exploit или runtime FAIL.

Reviewer: независимый Hermes researcher R2, не автор сводки/support/merge; native Codex execution не использовался. Проверка bounded: четыре итоговых документа, R1, support CLI-A/B/rest, targeted source slices, программный пересчёт ledgers и corpus. Не повторён semantic audit всех upstream файлов.

Объект — текущая локальная revision, зафиксированная SHA256:

| Файл | SHA256 |
|---|---|
| `deep-audit/README.md` | `c95c29b39dc5dae96ba70a83c475d37a234a3749c810d399c172863869a16111` |
| `deep-audit/COMPARISON.md` | `a798215bc861228fa80cc7a24c18a083bd7aa5097af3e463b470adfee18e93f1` |
| `../README.md` | `b0e3d2065d20708577818f7deaa91c54fc78a11caf3a316e8d9cde1a6fdb3d72` |
| `../IMPLEMENTATION.md` | `1462178218fb7c5bcab25a726014c049cce7356768f4ec70fc9f6ab2dbe3cd07` |
| `coverage-merged.json` | `6128ad33f5dd66d44a95bda8ee91bb4971ef594465d1bdb092f34f80a09d197f` |

Upstream snapshots: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`, Kowalski `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c`, Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`. Source root: `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/`. Friday baseline в документах — `388ec708f39583172d7f36110f6424cc175b5512`; неизменность всего Friday working tree этим review не утверждается.

## Открытая находка

### R2-B1 · ВАЖНО: residual corpus включает authored harness/generators, не только fixture/reference data

**Summary claims:** `README.md:69–79` объединяет classified как структурно проверенные данные/fixtures/vendor, говорит о разобранных назначенных authored implementations и описывает 2468 paths как fixture/reference corpus. `COMPARISON.md:3` аналогично отделяет назначенные реализации от справочных/генерируемых данных.

**Точное воспроизведение:** фильтр `classified-reviewed` в merged ledger, затем исключение fixture/workspace/golden/call-data directories обнаруживает, в частности:

- `tests/live-e2e/agents/llm-agent.mjs`: `coverage-merged.json:41317–41326`; `corpus-fixtures-coverage.json:17197–17206` помечает 1674 строки как `test-corpus-input-or-expected-data`, method прямо признаёт отсутствие substantive implementation reading. Реальный source `impeccable/tests/live-e2e/agents/llm-agent.mjs:1–25,28–33` — LLM-backed LiveAgent с generate/manual-edit/steer контрактами, SDK/imports и provider selection, а не frozen input или expected output.
- `tests/oracle/vectors/hooks-impl.mjs`: ledger `corpus-fixtures-coverage.json:59606–59615`; source `:1–9,15–26` — loader transform/export wrapping engine modules.
- `tests/oracle/vectors/hooks.mjs`: ledger `:59621–59630`; source `:1–13` — реальная регистрация Node loader hook.
- `tests/oracle/vectors/record-calls.mjs`: ledger `:59636–59645`; source `:17–35` — generator/orchestrator с `spawnSync`, удалением output directory и запуском CLI под loader hooks.
- `tests/oracle/vectors/recorder.mjs`: ledger `:59651–59660`; source `:1–19,24–37` — recorder/serializer implementation, не recorded vectors.

Причина воспроизводима в собственном `scratch/design-deep-audit/audit_fixture_corpus.py`: selection ограничен префиксом `tests/`, а fallback только сканирует relative imports/assertion patterns и присваивает всем таким paths один data artifact_kind. Hash/schema scan не устанавливает, что executable helper является данными. Я не исполнял ни один из перечисленных файлов; полного semantic review llm-agent этим review также не заявляю.

**Scope finding:** это authored **test infrastructure**, не доказанно production runtime. Неизвестных authored production paths среди оставшихся non-test classified при targeted проверке не обнаружено: там locks, goldens, два явно описанных generated bundles, font-index и minified vendor. Но отсутствие production gap не превращает authored test helpers в fixtures и не подтверждает all-read. Арифметика totals при этом может быть полностью правильной.

**Исправление / owner:** реально назначенный получатель — координатор текущего deep-audit. Не требуются upstream execution или повтор всего аудита. Достаточно явно выделить `authored test-support: structural scan only, semantic unreviewed` с названными исключениями и исправить соответствующий artifact_kind/summary disclosure; либо поручить bounded semantic closure этих helpers и пересчитать статусы по настоящим evidence. Не повышать до full за один hash/import scan. Acceptance: итоговый README и corpus ledger не называют executable harness/recorders просто fixture data, а оставшийся semantic предел виден без поиска по тысячам ledger rows. До этого R2-B1 OPEN.

## Старые B1/B2/B3 — закрыты именно в сводке

- **B1 / local arbitrary hard-fails:** `COMPARISON.md:23,79`, `README.md:19,49` теперь симметрично называют собственные hero/nav/list/accent ограничения Friday и требуют surface/domain scope, не отменяя их аудитом. Независимо перечитаны `.codex/commands/audit-design.md:22–27`, `polish.md:26–31`, invoking `.codex/skills/audit-design/SKILL.md:40–45`, `polish/SKILL.md:44–49`: claim точен.
- **B2 / typography:** `COMPARISON.md:22,79`, `README.md:19` правильно различают scoped MD и blanket regex. Реальные source: `docs/core/design-principles.md:58`, `typography-pairs.md:29–30`, `.codex/scripts/design-lint.mjs:9–12,227–230`. Synthetic probe прямо не назван owner approval. Не предлагается впервые разрешить уже разрешённый Inter-body.
- **B3 / bounce:** `COMPARISON.md:43,79`, `README.md:30` разделяют decorative ban, inertial spring и Taste no-overshoot. Source: `design-principles.md:76–78`, `motion.md:105–119`, `templates/motion.ts:70–77`, `motion-engine.md:53–60`; regex ловит только `.codex/scripts/design-lint.mjs:35–38`. Дополнительно сверены pinned Kowalski `skills/animate/SKILL.md:134–141`, Impeccable `skill/reference/animate.md:61,65`, Taste `skills/taste-skill/references/motion.md:54–61`. Никакого spring runtime PASS не заявлено.

## Выполненные проверки / реальные результаты

1. **Согласованность четырёх документов:** `COMPARISON.md:55–80`, `README.md:33–56`, `../README.md:15–19`, `../IMPLEMENTATION.md:91–99` сохраняют Taste как positive library, не сводят его к house rules; adaptation идёт в существующую команду, brand/MASTER выше библиотеки. Figma/Canva/Remotion — отдельные будущие pilots. `README.md:5,75–92`, `../README.md:3,28–34`, `../IMPLEMENTATION.md:11,28,99,131–135` честно отделяют static audit от installed/loaded/executed/verified. Blocked installs не блокируют сам методический анализ.
2. **Все snapshot inventory hashes:** собственный stdlib проход по трём inventories, проверка каждого non-symlink source SHA256 — mismatch list `[]`. Это byte integrity, не semantic reading.
3. **CLI-A/B:** ровно по одной partial row; hashes обоих совпадают с source `3b682454ca051019659f005a0253051eb5338d73b963ac2f7bac6654e2ee6afe`; actual 3594 строки. Независимый set-union `[1,1797]` и `[1798,3594]`: 3594 covered, gaps 0. Merged full имеет метод exact union, не ложный одиночный full. См. `support-cli-a.md:7–10`, `support-cli-b.md:7–10`, `README.md:67`.
4. **Support-rest:** set equality с `support-2.json` минус CLI — true; 48 unique rows, 44 full / 4 classified, hash errors 0; inventory lines 8156, actual 8154. Единственное line discrepancy — `css-rules.json` inventory3/actual1, открыто раскрыто в `support-rest.md:12–14,87–100`; не hash drift.
5. **Merged totals:** coordinator-owned `validate_coverage.py` прочитан и выполнен только в памяти с заменой output write на возврат объекта. Существующий файл не перезаписывался. Recomputed object == saved object: **True**. Дополнительный независимый Counter согласован с `README.md:71–73`: Impeccable 5034 = full1641 + alias-full823 + classified2476 + alias-classified46 + binary48; Kowalski36 full; Taste1664 = full531 + classified970 + binary163. Нет partial/unclassified в итоговой таксономии. Это не доказательство отсутствия semantic gaps (см. R2-B1).
6. **Aliases:** для каждого итогового alias найден same-hash canonical требуемого статуса в том же snapshot; неподтверждённых canonical links — 0 во всех трёх repos. Alias-to-classified не повышен до full. Generated reconstruction/full отдельно раскрыт в `README.md:75`; независимое ручное чтение каждой generated копии не обещается.
7. **Corpus receipt:** `audit_fixture_corpus.py` прочитан и повторён в памяти, без output writes; selected set взят из сохранённого corpus ledger, поскольку итоговый merge уже не содержит первоначальных unread statuses. Recomputed object == saved corpus object: **True**. 2468 corpus paths + 1 vendor; JSON1621, JSONL78 / vector rows16058, markup534, other235; parse issues `[]`, missing framework-reference candidates `[]`. Это подтверждает результаты scanner, не корректность его широкого semantic artifact_kind (R2-B1).
8. **Classified vs authored production:** просмотрены все non-test classified families Impeccable и extension/path census Taste: Taste classified — SVG964, JSON5 и один JS data literal (`print-globe/land.js`, LAND/LAKES coordinates). Authored production implementation, скрытая под таким data exemption, не выявлена. Generated browser bundles имеют отдельные methods/provenance evidence в `support-1-coverage.json`, не названы ручным semantic full. Полная rebuild reproducibility не проверена.

## Remaining limits

- Verdict относится только к корректности сравнительной сводки и disclosure указанной revision. Реальных интеграций/runtime/visual/security PASS нет и не требовалось.
- Не переоценивались вручную все semantic-full observations, provider-transform proofs или каждая fixture/SVG/photo/license; сохранены ограничения `README.md:75–81,90–94`.
- Полное чтение authored test-support не выполнено этим reviewer и не заменяется scanner receipt. Это конкретный открытый semantic предел, не «всё прочитано».
- Upstream CLI/imports/build/install/tests/network/browser не выполнялись. Coordinator-owned Python probes обрабатывали данные; записи отключены в памяти. Никаких правок clients/core/configs/Git.
- Первоначальный поиск probes в repo-local `scratch/` дал path-not-found; использован фактический Hermes scratch source root из report evidence. Это не blocker проверки.

**Создан только `independent-review-r2.md`.** Исходные отчёты и ledgers не исправлялись. Следующий разрешённый шаг — координатору исправить disclosure R2-B1 и передать изменённую revision на узкую повторную проверку; runtime или интеграционный rollout этим review не разрешается.
