# H&B: дизайн-агенты, skills, MCP и motion

Исследование начато2026-11-25; локальное delta-only внедрение принято и опубликовано2026-11-26. **Ядро дополнено без переустановки основы: lint, runtime owner-policy, полная Taste-библиотека с маршрутизацией, реальный motion pilot и surface playbook.** Exact clean tree:60Python +57Node tests PASS, strict TypeScript/SSR/headless temporal PASS, role sync без drift. Working tree:79Python PASS. Отдельные внешние Figma/Canva/Remotion/Herdr pilots не выполнены; Reddit full scrape заблокирован. [Текущий rollout ledger](rollout/STATUS.md), [критерии](rollout/PLAN.md), [фактические receipts](rollout/final-verification.json). Сравнительный статический аудит: [deep-audit/README.md](deep-audit/README.md) и [таблица R2](deep-audit/COMPARISON.md); это не runtime/security certification upstream.

## Документы

- [Аудит существующей системы](repo-audit.md): 45 Claude-ролей, 46 Codex-ролей, 8 дизайн-ролей, реальные разрывы и границы проверки.
- [Дизайн-скиллы](design-skills-research.md): Emil Kowalski, Impeccable, Taste Skill, расшифровка диктовки, конфликты и ограничения Reddit.
- [Remotion и Herdr](motion-herdr-research.md): видео кодом, лицензии, persistence, security, дополнительные motion skills и pilot acceptance.
- [План внедрения](IMPLEMENTATION.md): роли Figma/Canva/Remotion, этапы, tool tests, разрешения и blockers.
- [GitHub metadata/HEAD lock](source-lock.json): canonical repos, branches, SHAs, GitHub license metadata. Не lock всех транзитивных dependencies и не security audit.
- [Глубокое сравнение Impeccable → Kowalski → Taste](deep-audit/COMPARISON.md): реальное наполнение, существующие аналоги Friday, конфликты и только недостающие улучшения.
- [Provenance Friday](deep-audit/friday-provenance.md): подтверждённые исторические переносы Impeccable/Kowalski. [Данные и positive libraries](deep-audit/data-families-final.md): Taste, typography, composition, assets и ограничения проверки.

## Вывод координатора

Сохранять существующий design-department: Friday уже перенял основные идеи Impeccable и Kowalski; переустановка не является необходимым первым шагом. Из Impeccable полезны surface-specific modes, структурированные evidence/waivers и точные playbooks; из Kowalski — закрытие разрыва доктрина/реализация и temporal QA. **Taste — отдельный обязательный источник улучшений**: positive typography/composition libraries, copy/voice, семантические diagrams/scenes. Его спорные house defaults и исполняемые hooks оставлять opt-in, а не отбрасывать всё содержимое. Figma/Canva/Remotion adapters — кандидаты только после реальных pilots. Эти роли **спроектированы, но не зарегистрированы и не исполнены**.

Herdr изучать отдельным pilot, не делать prerequisite дизайна/Remotion и не трактовать session/worktree/role prompt как security sandbox. Он имеет реальные coordination primitives; формулировка «только GUI» неточна. Durable workflow и приёмка по revision остаются отдельным слоем.

## Проверки координатора после получения отчётов

- Прочитаны основные разделы обоих отчётов, сопоставлены с первичным design-department/config и собственными source extracts.
- Независимый от исполнителя повторный программный подсчёт на Python 3.14.9: **45 Claude MD, 46 Codex MD, 46 registered roles, 46 TOML payloads, missing_payloads=[]**. Это inventory, не semantic parity/исполнение ролей.
- Повторно извлечена официальная Remotion licensing/pricing страница: Free eligibility для individuals/companies до трёх человек; Company licensing отдельно, Creators $25/seat/mo, Automators $0.01/render и $100/mo minimum. Это прочитанные условия, не выбранный/оплаченный план H&B; headcount и сценарий требуют квалификации.
- Повторно прочитан `herdrdev/herdr-core/master/docs/security.md`: прямо подтверждены отсутствие sandbox/permission broker, session ≠ security boundary, holders persistence, приватность state. Default branch проверен через GitHub API; путь main дал 404, использован реальный master.
- GitHub auth и свежий fetch выполнены координатором до исследования: HEAD и origin совпали. Дочерний аудит сам сеть не обновлял и честно ограничил собственное утверждение.
- Полный Reddit scrape не выполнен: extract/JSON/archives/browser blocked. Snippets отделены от прочитанных первоисточников. Это незакрытый критерий, не PASS.
- Попытки MCP/skill install завершились deadline без подтверждения. Нет установок, OAuth success, live Figma/Canva calls, Remotion render или Herdr runtime tests.
- Проверка структуры пакета и ссылок выполняется отдельно локально; её успех не означает working integration.

## Следующий исполнимый шаг

После нового явного запроса владельца повторить штатное подтверждение Figma/Canva и выбранных skills; получить Figma sandbox URL и Canva test target. Затем bounded read smoke → отдельный draft write/read-back → visual review. До этого не менять global configs, клиентские проекты и грязные .codex роли.

Принятые implementation commits: `1b63e10d` → `f4c6a8ab` → `e2d59981` → `ee24dc56` → `82a1d684`. Remote commit/tree каждого прочитаны обратно. Публикуются только owned дельты и исследовательские материалы; чужие незавершённые media/parity файлы не включены и не затёрты. GitHub Actions runs для этих ревизий не наблюдались — remote CI PASS не заявляется. Прежний selftest source-freshness WARNING `.claude/commands/feature.md` раскрыт, manifest ради сокрытия drift не изменялся.
