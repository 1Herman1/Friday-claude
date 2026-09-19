# Агенты по департаментам

Агенты лежат подкаталогами-департаментами. Claude Code читает каталог
рекурсивно, имя агента берётся из поля `name` в шапке файла, поэтому вызов не
меняется: `Agent(coder, "задача")`, а не `Agent(core/coder, ...)`.

Деление — по зоне ответственности, а не по алфавиту: где искать агента и куда
класть нового, видно без чтения всех сорока файлов.

| Департамент | Каталог | Кто внутри | Зона ответственности |
|-------------|---------|------------|----------------------|
| Штаб | `core/` | orchestrator, planner, architect, researcher, coder, debugger | Ведут работу: исследовать, спланировать, спроектировать, написать, починить |
| Ревью кода | `review/` | code-reviewer, typescript-reviewer, react-reviewer, database-reviewer, migration-guard | Проверяют чужой код перед коммитом и выкаткой |
| Качество | `quality/` | qa-engineer, performance-optimizer, silent-failure-hunter, refactor-cleaner | Тесты, скорость, проглоченные ошибки, чистота |
| Дизайн и медиа | `design/` | design-department, design-reviewer, brand-guard, icon-curator, motion-curator, component-curator, media-generator | Как выглядит и как движется интерфейс, генерация и проверка ассетов |
| Безопасность | `security/` | security-department + 8 специалистов | Техническая защита: доступ, секреты, инфра, логика, поверхность API |
| Право | `legal/` | rkn-compliance | Правовая обвязка: 152-ФЗ, согласия, cookie, реклама. Намеренно отдельно от `security/` — это не техническая защита |
| Маркетинг | `marketing/` | marketing-agent, seo-department, seo-specialist | Тексты, классическое SEO, видимость в ИИ-ответах |
| Инфраструктура | `ops/` | devops, automator, documenter, anthropic-docs | CI/CD, сервер, автоматизация, документация |
| Мета | `meta/` | agent-auditor, agent-evaluator, strategist, archivarius, challenger | Работа над самой системой и над качеством суждений: аудит ростера, оценка агентов, возражение против решений, синтез, память |

Точки входа отделов (`design-department`, `security-department`,
`seo-department`) вызывают специалистов своего каталога — им нужен
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "3"` в `.claude/settings.json`.

## Новый агент

1. Положить файл в каталог своего департамента. Департамента нет — завести
   новый каталог и строку в таблице выше, а не сваливать в `core/`.
2. В шапке обязательны `name`, `description`, `tools`; `model` — по надобности.
3. Прописать агента в таблицах `CLAUDE.md` (делегирование и зона
   ответственности ревьюеров), иначе главный агент его не позовёт.
4. Агент виден только со следующей сессии — определения читаются при старте.
