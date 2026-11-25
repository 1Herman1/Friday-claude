# Owned-only publication: точные blobs и сохранение чужого baseline

## Verdict / revision

- Read-only Git audit; leaf devops/researcher. Рабочая ветка: `claude/greeting-nnz368`.
- Реальный HEAD: `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`. `ls-remote origin refs/heads/claude/greeting-nnz368` вернул тот же SHA.
- Baseline до спринта: `388ec708f39583172d7f36110f6424cc175b5512`. Между ним и HEAD: внешний `aef39998f9dac0a3dfa229fdf03d5c4748ed9c22`, затем stage01 `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`. Ни один из десяти существующих файлов proposal за этот промежуток не изменился в Git.
- Готовы **12 exact prospective UTF-8 contents** в `/Users/germanbryzgalov/.hermes/cache/scratch/design-rollout/publication-proposal.json`, массив `prospective_files`. Это 10 существующих файлов и 2 новых теста. Для каждого: HEAD blob, HEAD/worktree/before SHA-256, prospective SHA-256/Git blob SHA-1 и точный HEAD→prospective diff.
- Worktree/index не правились. Ни commit/push/fetch/checkout/reset/stash, ни hash-object -w/update-index/write-tree не выполнялись.

## Что именно публиковать

1. **Stage02**: `.codex/config.toml`, `.codex/scripts/lifecycle.py`, `.codex/scripts/test_lifecycle.py` и новый `.codex/scripts/test_published_owner_policy.py` из JSON.
2. **Stage03 каталог**: exact guarded новые `.codex/scripts/design-library.mjs`, `.codex/scripts/test-design-library.mjs`, `docs/core/design-library/**` — полный список/хеши `other_new_owned_files_allowlist`. Каталог можно публиковать независимо от media/parity.
3. **Stage03 маршрутизация**: `.codex/CODEX.md`, `.codex/agents/design/taste-curator.md`, `.codex/agents/taste-curator.toml`, `.codex/commands/design-system.md`, `.codex/skills/design-system/SKILL.md`, новый `.codex/scripts/test_design_routing.py` — contents из JSON. Публиковать вместе с каталогом либо после него.
4. **Stage04**: `docs/core/motion-engine.md`, `docs/core/templates/motion.ts`, guarded новый `.codex/scripts/test-motion-template.mjs` и owned `docs/research/design-agent-upgrade/rollout/motion-pilot/**`; независим от parity/media. Runtime template сам по себе не включает анимацию ни в одном проекте. Browser integration требует внешние изолированные зависимости; пока это отдельный gate.

55 других owned новых файлов перечислены явно в JSON; никакой wildcard stage не разрешается. Receipts — исторические доказательства, не замена проверки prospective tree. Эти два proposal-отчёта сами по себе не входят в публикационный allowlist.

## Трансформация грязных файлов, не копирование worktree

- **CODEX**: единственная собственная вставка 21 строки из before→current, перед `### Правовая обвязка (РКН)`, перенесена на реальный HEAD. Остальные HEAD bytes сохраняются; чужой media-adapter diff не включён.
- **taste MD**: только собственный suffix 16 строк из before→current, добавленный к HEAD. Чужие handoff-вставки не включены.
- **taste TOML**: разобраны before/current/HEAD через tomllib; вычислен только suffix `current.developer_instructions[len(before.developer_instructions):]`; он добавлен к **HEAD** body. Поле сериализовано как basic string с JSON-совместимыми escape. Остальные строки файла и все другие parsed keys неизменны. Проверено точное равенство тела prospective TOML телу prospective MD без первой `# taste-curator` строки.
- **config**: старое HEAD `Пользователь — только Гермес.` заменено собственным условным Гермес/сэр/greeting/tone policy. Не копируется dirty `Для медиа обязательно прочитай ...` и изменение иных keys. Все parsed keys кроме developer_instructions равны HEAD.
- **lifecycle**: одна HEAD строка owner policy заменена own policy. Получившийся lifecycle совпадает с current bytes, но получен из HEAD, а не blanket stage.
- **test_lifecycle**: собственные 3 canonical-root `.resolve()` исправления и 2 новых regression methods перенесены на HEAD. Чужая baseline `self.assertIn('сэр', text)` в старом startup-тесте **не включена**. Новый собственный тест уже проверяет условный policy.
- **command/SKILL и core motion**: before == HEAD доказано; поэтому current целиком допустим для этих clean-before файлов, при совпадении записанного хеша.

## Уже untracked parity: artifact, не скрытое присвоение

`.codex/content-parity.json` и `.codex/scripts/test_content_parity.py` уже принадлежали другой незаконченной задаче и отсутствуют в HEAD. Проверены оба before SHA и current SHA из stage02 manifest; совпали все пять записей manifest.

`untracked_foreign_baseline_owned_deltas_only` содержит **точные два owned unified patches** against `stage02-own-before`, before/after SHA и явный запрет add полного файла. Полный original `stage02-own.patch` также встроен с SHA. Его нельзя прямо применить к HEAD: двух paths нет, а config/lifecycle старый контекст не соответствует HEAD. Нельзя превращать diff against untracked baseline в new-file commit целого чужого baseline.

Новый полностью самостоятельный `test_published_owner_policy.py` проверяет **опубликованные config, lifecycle startup и CODEX** без content-parity, media-handoff или импортов untracked тестов. Он загружает lifecycle через compile/exec без pycache, подменяет только side effects startup (Git/context fixture/state save). Не заявляет проверку archive/state persistence. Полный lifecycle suite остаётся отдельной parent проверкой.

### Найденная реальная зависимость в собственном routing-тесте

Текущий новый `test_design_routing.py` на clean prospective имеет 3 FAIL: `один разрешённый пилот`, `отдельное разрешение масштаба`, `вне public/ и deployment` существуют лишь в чужом dirty CODEX, не в HEAD. Поэтому **текущий worktree-тест нельзя publish wholesale** даже при своей принадлежности.

JSON содержит exact alternative content того же нового owned теста: проверка опубликованной authority (MASTER, запрет новых веток, review completion) и собственных additive reference/brand/page override guards вместо требований отсутствующего media baseline. Own-test correction diff отдельный в `test_adjustment`. Чужие production gates не удалены: они вообще не были в HEAD и остаются нетронутыми в dirty worktree. Все четыре tests альтернативы проходят на prospective bytes. Если требуется доказать также все незакоммиченные media gates в GitHub — это **отдельная публикация чужого scope с решением владельца**, не причина блокировать каталог/motion.

## Проверено сейчас, и чего НЕ доказано

- Owner regression: на HEAD ожидаемый RED — 3 methods, 12 failing subtests; на exact prospective bytes — **3/3 PASS**.
- Routing на exact prospective bytes с own scope correction — **4/4 PASS**; исходный текущий test показывает описанные 3 failures.
- Python compile() prospective lifecycle/test_lifecycle/новых тестов — PASS, без записи pycache.
- TOML semantic invariants и MD/TOML body parity — PASS.
- Реальный readonly subset catalog suite: **7 PASS, 0 FAIL**. Команда сохранена в JSON. Он проверил published-кандидаты каталога, every record, IDs/counts/license/provenance hashes/ошибочные args, INDEX/list. Fixture/mutation tests не запускались из-за write scope. Наличие upstream source через TASTE_SOURCE не заявляется.
- Реальный `node .codex/scripts/test-motion-template.mjs` — `PASS createDraggable export contract`.
- **Не запускались** полный lifecycle suite, все catalog mutation tests, full selftest, motion browser integration и материализованный clean export. Virtual tests читают ровно prospective map с HEAD fallback; это не E2E опубликованного дерева. Прежние 69+51 локальных результатов нельзя приписывать этому prospective tree.

## Алгоритм parent: exact tree, только owned Git writes

Следующее — инструкция для parent, здесь команды Git write не выполнялись.

1. Зафиксировать HEAD, branch, remote SHA, весь index (`ls-files --stage -z` плюс index-file bytes/checksum), статус и worktree hashes. JSON содержит 207 preservation SHA для baseline files + всех tracked dirty/target paths. Снять дополнительно hash каждого чужого untracked файла, если нужен полный all-untracked byte-preservation ledger, а не только сохранение списка. Две parity SHA уже включены. Не удалять/не чистить существующие файлы.
2. Перечитать remote read-only. Если он не совпадает с ожидаемым HEAD — STOP/recompute against actual HEAD; не rebase/pull поверх dirty checkout. При очередных собственных stages base SHA изменяется: допустимо продолжить, только если HEAD blob каждого следующего path всё ещё совпадает с записанным base blob и new path всё ещё отсутствует. Не переписывать внешний aef39998.
3. Для каждого publish path проверить текущий worktree hash; для existing path проверить HEAD blob; для new path проверить HEAD absent и разрешённую ownership. Любой drift требует нового предложения. Проверить prospective content SHA-256 и вычисленный blob hash по JSON перед записью Git object.
4. **Предпочтительно изолированный временный index**, seeded из actual HEAD, а не общего грязного index. Родитель может записать verified blobs в object database и внести строго allowlist entries в этот temporary index, сохраняя HEAD executable mode (новым текстовым файлам 100644). Не `git add .`, не `git add -A`, не blanket stage dirty CODEX/TOML.
5. В temporary index `write-tree`; `diff-tree`/`diff --cached` должен перечислять строго выбранную stage allowlist. Сверить каждый tree blob и mode с JSON. Никаких посторонних staged entries из основного index в commit tree. Если parent выбирает основной index, обычный `git commit` при чужих staged entries **нельзя**: он включит их; всё равно нужен отдельный commit index/tree.
6. **Материализовать именно этот prospective tree**, не копию worktree: `git archive <tree> | tar -x -C <fresh-scratch-export>`. Не создавать ветку/worktree. Новые exact test contents экспортируются из candidate tree, а не подмешиваются из живой папки. Экспорт не должен иметь PYTHONPATH на исходный repo и не должен видеть его untracked файлы. Node tools только из экспортированного scope.
7. В actual export выполнить минимум stage02 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .codex/scripts -p test_published_owner_policy.py`, затем отдельно `... -p test_lifecycle.py`; stage03 `node --test .codex/scripts/test-design-library.mjs` и `... -p test_design_routing.py`; stage04 contract и при заявлении integration — полный `--integration` с `MOTION_DEPS`/`MOTION_BROWSER` и экспортированными fixture/dependency locks. TMPDIR указать в новый scratch, не system tmp. Не запускать parity/media тесты, которых нет в tree. Full selftest запускать, но результат интерпретировать относительно actual exported HEAD scope, не требовать чужие untracked additions.
8. Только после PASS actual scope и независимого review parent создаёт commit на existing `claude/greeting-nnz368` с ровно candidate tree и actual prior HEAD parent; CAS HEAD/remote guards, обычный fast-forward push без force. Гонки/не-fast-forward — STOP и пересборка. Не создавать branches и PR.
9. При работе temporary index основной index можно оставить untouched до commit. После commit синхронизировать **только owned paths**, чьи main-index entries перед операцией были равны старому HEAD и не принадлежали чужому staging; иначе STOP. Все прочие entries сохранить byte-for-byte. Нельзя делать read-tree/reset всего main index для синхронизации. Сравнение сырого index-file hash после selective update не обязано совпадать; сравнивать сохранённые не-owned entries/modes/stages семантически.
10. Worktree bytes должны совпасть с исходными guards **даже для dirty publish paths**: commit идёт из blobs, не из перезаписанного worktree. Оставшийся diff относительно нового HEAD — ожидаемый чужой незавершённый baseline; его не отменять и не выдавать за новую собственную ошибку. Пара untracked parity остаётся untracked с теми же SHA.
11. Прочитать remote exact commit/tree/blobs обратно; проверить отсутствие paths вне allowlist, выбранные SHA и GitHub CI для именно опубликованного SHA, если CI заявляется. Зафиксировать экспортный manifest, выполненные команды и фактические результаты. GitHub push != CI PASS.

## Решение владельца / hard blocker

Для owned config/startup, catalog/routing в scope-adjusted тесте и clean-before motion **нет hard dependency на чужой parity/media baseline**. Они публикуются независимо, после parent clean-export gates.

Если нужно опубликовать **саму semantic-parity миграцию или full media handoff**, нужен explicit owner handoff/permission для полного foreign untracked baseline и связанных dirty docs/roles/scripts. До решения — два owned delta artifacts сохранены, полные чужие файлы не публиковать. Отсутствие разрешения на этот отдельный scope не блокирует независимый дизайн-каталог.
