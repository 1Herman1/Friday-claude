# Проверка переноса — 2026-11-07

Среда проверки: Linux, Codex CLI 0.167.0-alpha.4, Python 3.12.

## Выполнено

- `python3 .codex/scripts/selftest.py`: PASS. Все 45 исходных агентов и
  codex-docs, 22 скилла, 5 событий хуков, 3 MCP-конфигурации и 90 связей
  исходник → адаптация. Выборка не пустая, хеши исходников совпадают.
- `python3 .codex/scripts/sync-roles.py`: Drift: none. Markdown и нативные
  developer_instructions всех 46 ролей согласованы.
- `python3 -m unittest discover -s .codex/scripts -p test_lifecycle.py -v`:
  8 тестов прошли. Проверены контекст, ветка, архив без переписки и секретов,
  защита пути session_id, выбор UI-файлов и поведение Stop.
- config.toml и hooks.json проверены по официальной JSON Schema Codex.
- Синтаксис перенесённых JavaScript/Python и shell-обёрток проверен.
- CLI `codex plugin list --marketplace friday-local --available --json`
  с локальным источником распознал `friday-workflows@friday-local`, версию
  1.0.0 и путь .codex/. Это проверка распознавания, не установки плагина.
- Локальные MCP-процессы запущены через scripts/mcp-launch.py. MCP initialize
  и tools/list успешны: icon-library — 5 инструментов, nullume — 21.
  Для этого установлены зависимости по существующим lock-файлам в рабочей
  среде; сами зависимости и lock-файлы продуктов в изменение не входят.

## Границы этой проверки

- Полный app-server в текущем облачном контейнере не запущен: пользовательская
  конфигурация /home/agent/.codex доступна только для чтения; проект не доверен
  этой вложенной CLI-сессии. Штатное доверие не обходилось.
- Установка локального плагина и исполнение lifecycle-событий самим Codex на
  Mac не проверены. Обработчики протестированы напрямую, конфигурация валидна.
- Реальные LLM-запуски 46 ролей, браузерные сценарии продуктов, 21st с ключом,
  платная генерация kie.ai, вход в Hermes, деплои и cron на Mac не выполнялись.
- Эти проверки не заменяют тесты конкретного продукта или его боевой среды.

## Первая локальная проверка

В клоне Friday выполнить setup.sh, открыть новую сессию Codex из корня,
подтвердить штатное доверие к проекту/хукам. Проверить появление Friday skills,
запуск researcher на чтение и code-reviewer на его вывод, затем небольшую
правку с тестами. Наблюдать SessionStart и PostToolUse. Для Hermes следовать
workflows/hermes.md. Не выполнять публикацию или платную генерацию ради smoke-test.

## Официальные форматы

- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/hooks
- https://learn.chatgpt.com/docs/build-skills
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/codex/config-schema.json
