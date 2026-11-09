# review

Следуй .codex/workflows/review-loop.md. Получи полный scope через
`python3 .codex/scripts/changes.py --level standard`; для выполненных
коммитов передай --base с SHA начала задачи. Не ограничивайся git diff.

- code-reviewer — общий владелец логики любого стека, включая Python,
  shell, YAML, конфигурацию и удалённый код.
- security-secrets-scanner — секреты в каждом наборе изменений.
- TS/JS — typescript-reviewer; React — react-reviewer.
- UI, CSS, HTML, Astro — design-reviewer с реальными снимками при изменении вида.
- Prisma/миграции — database-reviewer; миграции на сервер — migration-guard.
- auth/пользовательские роуты — security-auth-access и security-api-surface.
- платежи, заказы, бонусы, торговый риск — security-business-logic и qa-engineer.
- .github workflows, shell/YAML — devops.
- Критические изменения — также silent-failure-hunter.

Запускай независимые проверки волнами по свободным слотам. Каждый получает
ТЗ, критерии, revision, scope и результаты тестов. Не подавляй находку,
если её профильный владелец не запущен: передай координатору.

Собери findings с владельцами. После исправлений повтори необходимые тесты
и ревью новой revision до отсутствия подтверждённых дефектов. Pass старой
revision не закрывает новую. Критерий завершения — task_gate.py complete.
