# Проверка исправлений — 2026-11-09

## Выполнено
- Friday: 44 unittest (lifecycle + task gate) PASS.
- Девять первоначальных сценариев аудита, ранее 5 FAIL, теперь 9 PASS.
- Selftest ролей/команд/MCP/хуков PASS; 46 native ролей согласованы с Markdown.
- JSON Schema Codex: config.toml/hooks.json PASS.
- Проверены индекс/рабочая копия, staged deletion с untracked replacement,
  смена executable mode, stale evidence, self-review, skip, scope и owner-session.
- Архив: реальный temp Git, commit/unborn, Unicode/spaces/newline names,
  сохранение пояснений, конкурентные хуки, retry неуспешного lint — PASS.
- Screenshot helper: dependency импортируется, ошибка отсутствующего browser ясная.
- SEO: 23 offline tests, canonical inventory88 и offline installer — PASS.
- Perfect Skin E2E: loader/config4 проверки независимого ревью, syntax — PASS.
- Два независимых финальных ревью: новых подтверждённых P1/P2 не обнаружено.

## Границы
Это проверки кода/контрактов и локальных сценариев. Установка плагина и доверие
к проекту/хукам в новой сессии на Mac, фактический запуск всех 46 LLM-ролей,
боевые заказы, платные API, деплой и расписание Hermes не выполнялись.
Task gate проверяет полноту/актуальность evidence, не истинность произвольного
текста отчёта. Критерии и результаты реальных проверок обязан фиксировать агент.

## Первая локальная проверка
bash .codex/setup.sh; новая сессия codex из корня, штатное доверие проекту/хукам.
Инициализировать небольшую задачу по workflows/review-loop.md и довести её
до complete с реальным независимым ревью. Повторный запрос чтения CODEX.md
не нужен в активной доверенной конфигурации.
