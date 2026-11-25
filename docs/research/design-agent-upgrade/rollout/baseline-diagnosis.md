# Baseline diagnosis: Python checks, bounded read-only audit

## Verdict и границы

**Baseline воспроизведён: 62 tests, failures=5, errors=1. Это не шесть production-багов и не регрессия design-lint upgrade.** Четыре lifecycle-падения имеют одну причину: тест подменяет канонический production ROOT неканоническим путём через symlink. Два content-parity-падения относятся к незарегистрированной адаптации owner-правил и устаревшей проверке точной фразы. Отдельно обнаружено реальное противоречие исполняемых startup/config инструкций действующему CODEX.md.

Роль: adapted qa-engineer/researcher, самостоятельная диагностика без делегирования. Проверены полный `.codex/agents/quality/qa-engineer.md`, полный `.codex/CODEX.md`, lifecycle и его tests, parity checker/ledger, исходные owner-параграфы CLAUDE.md, hooks.json, config и все зарегистрированные role payloads. Это bounded source/reproduction audit, не полный семантический аудит всего CLAUDE.md, не проверка live Codex IDE activation.

Revision: `388ec708f39583172d7f36110f6424cc175b5512` + существующее грязное дерево. Чужие lifecycle/test/config/CODEX/parity изменения не исправлялись и не откатывались. `design-lint.mjs` и параллельно создаваемые tests не менялись. Единственная запись в репозитории этим специалистом — данный файл. Эксперименты/логи — только `~/.hermes/cache/scratch/`; сеть, платежи, публикация, установка и Git-записи в общем checkout не выполнялись. Git init/commit в штатных тестах происходят только в disposable scratch fixtures.

## Реальные команды и receipts

Все subprocess-запуски используют `sys.executable` Hermes Python 3.14, не системный Python 3.9. Рабочий каталог: `/Users/germanbryzgalov/Friday-claude`. Интерпретатор определяется без угадывания версии каталога:

```python
# Выполнено через execute_code; kernel импортирует стандартную библиотеку.
import os, sys, subprocess
from pathlib import Path
repo = Path('/Users/germanbryzgalov/Friday-claude')
scratch = Path('/Users/germanbryzgalov/.hermes/cache/scratch')
cmd = [sys.executable, '-B', '-m', 'unittest', 'discover',
       '-s', '.codex/scripts', '-p', 'test_*.py', '-v']
env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', TMPDIR=str(scratch))
p = subprocess.run(cmd, cwd=repo, env=env, capture_output=True, text=True)
```

1. **Canonical scratch TMPDIR, исходные tests без правок:** `Ran 62 tests in 13.575s`, `FAILED (failures=2)`, exit 1. Все 17 lifecycle tests проходят. Полный локальный вывод: `/Users/germanbryzgalov/.hermes/cache/scratch/baseline-diagnosis-unittest.log`.
2. **Та же команда, symlink TMPDIR внутри scratch:** `baseline-diag-alias -> baseline-diag-real`; `Ran 62 tests in 12.412s`, `FAILED (failures=5, errors=1)`, exit 1. Полный вывод: `/Users/germanbryzgalov/.hermes/cache/scratch/baseline-diagnosis-alias-unittest.log`.
3. **Контрфактическая проверка причины только в scratch-копии:** скопированы lifecycle.py и test_lifecycle.py; в двух setUp заменено `Path(self.tmp.name)` на `Path(self.tmp.name).resolve()`, в nested unborn fixture — `Path(temp)` на `Path(temp).resolve()`. Ни одна assertion и lifecycle implementation не менялись. С тем же alias TMPDIR: `Ran 17 tests in 2.023s`, `OK`, exit 0. Лог: `/Users/germanbryzgalov/.hermes/cache/scratch/baseline-diagnosis-canonical-fixtures.log`.

Воспроизведение alias-прогона после пункта 1:

```python
real = scratch / 'baseline-diag-real'
real.mkdir(exist_ok=True)
alias = scratch / 'baseline-diag-alias'
if not alias.exists():
    alias.symlink_to(real, target_is_directory=True)
env['TMPDIR'] = str(alias)
p = subprocess.run(cmd, cwd=repo, env=env, capture_output=True, text=True)
```

Проверка среды без записи в системный temp: `Path(tempfile.gettempdir())` в отдельном Python без override вернул `/var/folders/kp/b_v6ytv5479_ym5vsdzvkkzr0000gn/T`, `.resolve()` — `/private/var/folders/kp/b_v6ytv5479_ym5vsdzvkkzr0000gn/T`; равенство `False`. Это объясняет исходный macOS baseline; для повторного создания файлов использован только scratch alias, не `/var/folders`.

## Шесть падений: точные причины

| Test / место assertion | Наблюдение | Причина и классификация |
|---|---|---|
| `test_lifecycle.LifecycleTests.test_apply_patch_detects_ui_file_and_hash`, `.codex/scripts/test_lifecycle.py:66–72` | `IndexError` на `found[0]`: список пуст | **Fixture/root-routing**, не regex patch parser: setUp:18 подставляет неразрешённый ROOT; changed_ui:132 разрешает путь, relative_to:134 сравнивает его с неразрешённым ROOT и исключает свой же файл через ValueError:135–136. |
| `test_lifecycle.GitLifecycleTests.test_failed_lint_is_retried`, `test_lifecycle.py:188–200` | `0 != 2` node calls | Та же fixture:93 и changed_ui containment. До node lifecycle.py:157 управление вообще не доходит. Не доказательство сломанного retry/cache. В canonical fixtures исходный test проходит два failed-lint вызова; cache сохраняется только при returncode 0 на lifecycle.py:163–164. |
| `test_shell_created_ui_and_journal_are_detected`, `test_lifecycle.py:120–125` | ожидаемые shell-created TSX не попадают в found | Git discovery не потерял файлы: changed_files:39–44 работает; их отбрасывает та же проверка containment:134. Оба пути, включая journal вне projects/, проходят при canonical ROOT. |
| `test_unicode_spaces_and_newline_paths_are_not_quoted_or_dropped`, `test_lifecycle.py:202–214` | assertion:207 changed_files проходит; assertion:208 changed_ui теряет все пять путей | Та же причина ROOT; это не ошибка Unicode/пробелов/newline или Git quoting. Переход на canonical fixture устраняет падение с неизменённым полным набором имён и assertions. |
| `test_content_parity.ContentParityTests.test_every_source_section_and_obligation_is_covered`, `test_content_parity.py:72–76` | ровно четыре missing source obligation: CLAUDE.md:357,358,377,875 | **Instruction-obligation crosswalk gap** + text-level mismatch. Ledger не содержит adaptation, покрывающей эти строки. Checker:57–60 потому требует literal normalized inclusion. Смысл уважительного тона/инициативы сохранён в CODEX:467–470; но безусловное «сэр» сознательно отличается от текущего условного правила и без reviewed adaptation не должно исчезать бесследно. |
| `test_owner_identity_in_effective_instructions`, `test_content_parity.py:154–165` | assertion:160 требует точную `Обращение к пользователю — «сэр»` | **Outdated parity expectation**: current CODEX:5,467–470,490,1004 допускает «Гермес» в обычной беседе и «сэр» для сложного объяснения. Это не потерянная identity и не основание восстановить старое безусловное обращение ради зелени. |

### Почему четыре UI-падения — не production lifecycle bug

Production `.codex/scripts/lifecycle.py:16` задаёт `ROOT = Path(__file__).resolve().parents[2]`, то есть уже canonical. Лишь тесты на `test_lifecycle.py:18,93` подменяют его неканоническим `Path(self.tmp.name)`; nested fixture:218 также нуждается в единообразии. Проверка containment правильно не разрешает выход из checkout, убирать её опасно.

Контроль seam в scratch: один существующий Unicode TSX, changed_files замокан пустым только для изоляции parser. Пять входов — tool_input string patch, dict.patch, dict.file_path, dict.path, dict.input — дают `[0,0,0,0,0]` с alias ROOT и `[1,1,1,1,1]` с `.resolve()` ROOT. `/etc/passwd` даёт `[]` в обоих случаях. Поэтому менять parser, suffix whitelist, Git `-z`, retry threshold или node routing по этим failures не нужно.

Read-only `git show HEAD:.codex/scripts/lifecycle.py` подтвердил: участок `def changed_ui` и весь последующий файл идентичны current. Dirty lifecycle diff меняет только строку startup identity; dirty test diff добавляет `assertIn('сэр', text)`. Следовательно, эти четыре падения не внесены рассматриваемыми UI-lint изменениями. Более того, штатный пост-edit hook зарегистрирован в `.codex/hooks.json:25–34` без matcher; actual live firing в Codex этой проверкой не подтверждался.

## Owner policy: исходник, current MD и исполняемые payloads

| Поверхность | Наблюдение / последствия |
|---|---|
| `CLAUDE.md:346,356–359,369,377,875` | Identity — Гермес, greeting `Привет, Гермес!`, после него безусловное «сэр», собранный/уважительный/инициативный тон. Исходник не изменять. |
| `.codex/CODEX.md:5,457,467–470,480,490,1004` | Те же identity/greeting/тон, но обращение условное: обычная беседа «Гермес», сложное объяснение «сэр». Read-only HEAD comparison подтвердил, что это правило уже существует в HEAD, а не изобретено design upgrade. В этом аудите current CODEX — действующий адаптер; отдельный owner approval на смену общения по истории чатов не разыскивался и не выдумывается. |
| `.codex/config.toml:2` | **Реальный effective-instruction conflict:** `после приветствия обращение «сэр»`, то есть абсолютное правило. Это не совпадает с current CODEX. Наличие слов «Гермес»/«сэр» в тестах не обнаруживает конфликт. |
| `.codex/scripts/lifecycle.py:102` | **Реальный production lifecycle instruction bug, не UI routing bug:** SessionStart additionalContext снова вводит безусловное «сэр». Конфликт воспроизводится чтением точного startup текста; не требуется запускать hook на общем checkout. |
| `.codex/agents/quality/qa-engineer.md:8` и `.codex/agents/qa-engineer.toml:3` | Роль говорит «Пользователь — только Гермес», читает CODEX, не задаёт отдельное правило исключить «сэр». Это identity, не запрет обращения. Нет основания массово переписывать 46 payloads. |
| Все зарегистрированные config_file | Через tomllib прочитаны developer_instructions всех 46 ролей и сравнены с MD body по алгоритму selftest.py:35–36 (без первой строки заголовка). **46 совпадений, 0 drift.** Наивное сравнение с полным MD вместе с `# role` неправильно: это не runtime drift. В owner-строках payloads нет собственной условной/безусловной «сэр»-политики, которая устраняла бы конфликт config/startup. |
| `.codex/content-parity.json:367–764` | Нет adaptation для 357–358/377/875. Простое удаление source lines из контроля или пустые target_required недопустимы; checker:26–48 специально проверяет bounds, source_text, reason и непустые replacement obligations. |

Отдельно от шести tests: именно **config/startup рассогласование** требует production instruction repair. Source-to-target différence без разрешённой и проверяемой адаптации остаётся открытой, но копировать в current CODEX старое безусловное «сэр» лишь для literal PASS нельзя. При отсутствии у координатора основания приоритета current owner policy нужен owner-policy blocker, не самостоятельная смена предпочтения.

## Минимальный безопасный путь к зелёной системе

Это предложение на отдельный ограниченный fix scope; оно здесь не применялось. Владельца реализации назначает parent, не считается уже назначенным или исправленным.

| Область изменения | Минимальная дельта | Риск | Acceptance без ослабления guards |
|---|---|---|---|
| Только `test_lifecycle.py:18,93,218` | Канонизировать ROOT disposable fixtures через `.resolve()`; согласовать nested fixture. Production ROOT и containment не менять. | Низкий; можно скрыть будущую ошибку production ROOT, если не сохранить явный canonical-root invariant. | Все 17 tests с исходными assertions зелёные и при canonical, и при symlink TMPDIR; external paths по-прежнему не linted; пять странных имён, journal, patch hash и два failed retries сохранены. Добавить проверку canonical production-root contract/эквивалентный focused symlink test. Scratch evidence уже подтверждает исправление именно fixtures. |
| `config.toml:2`, `lifecycle.py:102`, owner tests | Синхронизировать compact effective instructions с **нынешним условным CODEX правилом**; identity, greeting и тон сохранять. Не переписывать unrelated role payloads/основу. | Средний: текст runtime может переопределять базу; already-open client может не перечитать config. | Проверить оба контекста обращения, exact greeting/identity, чтение CODEX; запрещать старое абсолютное `после приветствия обращение «сэр»` в config/startup. Проверять actual startup output на isolated ROOT, а не только MD. Reload live Codex отдельно от static PASS. |
| `content-parity.json`, `test_content_parity.py:154–165` | После подтверждения приоритета current owner policy добавить точные reviewed adaptations для source 357–358,377,875 с frozen source_text, причиной различия и непустыми requirements: условные обращения **и сохранённый тон/инициатива**. Заменить устаревшую единственную literal-проверку на более полный контракт identity + greeting + оба случая обращения + отсутствие противоречий во всех effective surfaces. | Средний: широкая adaptation может замаскировать настоящую потерю требований. | Crosswalk ноль failures; mutation удаления «Гермес»/«сэр»/greeting/уважительного тона/инициативы отдельно должна падать; malformed adaptations по-прежнему fail; не ослаблять tests invalid/empty requirements; не менять CLAUDE.md; отдельно сохранять явную разницу source/current и её reviewed основание. |

Нельзя «исправлять» систему через удаление падающих tests, skip, расширение допусков, отключение containment, обновление manifest/hash без смысловой проверки, восстановление устаревшего owner-правила или обход текущих gates. Простая смена TMPDIR даёт полезную диагностику, но сама по себе не закрывает переносимость fixtures и два parity failures.

Финальная приёмка будущего repair: полный `unittest discover` на canonical и alias scratch TMPDIR, исходные 62 tests не потеряны, новые тесты добавляются сверху; 0 failures/errors/skips; отдельные существующие/new design-lint regression checks parent/coder; selftest/native role sync после ограниченных instruction правок; независимое ревью новой revision. Открытые baseline-проблемы не выдавать за новые design-regressions, но и не считать полный rollout зелёным до их закрытия.

## Что подтверждено и что осталось

- Причина всех шести baseline failures установлена реальным воспроизведением; четыре lifecycle failures причинно изолированы сменой одной переменной — canonical ROOT.
- В repo ничего не чинилось; 62/62 green не заявляется. Текущий исходный suite даёт два instruction/parity failure на canonical TMPDIR и исходные шесть на alias TMPDIR.
- Production instruction конфликт подтверждён; production UI routing defect из этих четырёх failures **не подтверждён**.
- Ограничения: не проверялись весь UI lint corpus, реальный запуск native Codex hooks/агентов, загрузка конфигурации открытым IDE или история owner approval. Это остаётся отдельным acceptance scope координатора.
