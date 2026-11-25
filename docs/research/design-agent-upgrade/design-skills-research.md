# Дизайн-скиллы: проверенные источники и способ внедрения

Проверено 2026-11-25. Исследование для H&B / Friday. Это не отчёт об установленном или работающем наборе агентов.

## Расшифровка названий

- «Ковальский»: Emil Kowalski, первоисточник https://github.com/emilkowalski/skills. Не устанавливать стороннюю перепаковку вместо автора без причины.
- «Impeckable Design» / «Impeccable»: один продукт Paul Bakaus — https://github.com/pbakaus/impeccable.
- «Fluency4 AI, Hernesis»: вероятно части фразы **Design fluency for AI harnesses**. Эта точная фраза найдена в `.claude-plugin/marketplace.json` Impeccable. Это сильная гипотеза расшифровки диктовки, не доказанное намерение владельца. Отдельные дизайн-продукты с этими точными именами не идентифицированы. Не подменять их найденными курсами AI Fluency.
- «taste skills»: подтверждён https://github.com/Leonxlnx/taste-skill. Не всякий skill со словом taste является этим продуктом.
- «Ремонтшн»: предполагается Remotion; отдельное исследование — `motion-herdr-research.md`.
- **Herdr** найден точно: https://github.com/herdrdev/herdr. Не путать с Laravel Herd или сторонним координатором `vladzima/herd`.

## Рекомендуемая матрица

| Источник | Подтверждённая роль | Кому давать в Friday | Ограничение |
|---|---|---|---|
| Emil Kowalski | Design engineering, выбор easing/duration, interactions, mobile-native, typography details, анимационное ревью | motion-curator; отдельные правила design-reviewer и coder | Не заменять anime.js/Motion и весь стек ради примеров библиотеки; custom curve не догма клиента |
| Impeccable | shape, critique, audit, typeset, layout, polish, animate, harden; разделяет Persuade/Operate/Read/Experience | design-department и design-reviewer по конкретной задаче | Не загружать все playbooks сразу; не подменять brand/MASTER; launcher может скачивать бинарник |
| Taste Skill | Арт-направление, клиентский визуальный материал, композиции, локальные browser checks | taste-curator как исследуемая методика и отдельный экспериментальный preset | Не включать глобально: текущий upstream содержит конфликтующие house rules |
| Anthropic frontend-design | Базовый подход к выразительному frontend | Запасной/reference-only после просмотра конкретного SKILL.md | Это не отдельный штат дизайнеров и не гарантия оригинальности; библиотека лицензируется по файлам |
| Официальные Figma skills | figma-use, specs, design-to-code/Code Connect | Будущий figma-specialist | Skill не даёт MCP доступ или право записи |
| remotion-dev/skills | Best practices для code-driven видео | Будущий remotion-director + существующий coder | Skill не устанавливает renderer, не даёт лицензию на все случаи и не генерирует видеоматериал сам |

## Проверка текущих версий и воспроизводимость

`source-lock.json` получен через аутентифицированный `gh api`: repository, default branch, HEAD SHA, GitHub SPDX, archived/pushed_at. SPDX `null` означает отсутствие определённой GitHub лицензии, а не разрешение или запрет использования. Перед копированием проверять LICENSE конкретного пути и зависимости.

Прочитаны первичные README и SKILL.md Emil, Impeccable, Taste. Для Emil/Impeccable часть чтений выполнялась по moving main; SHA из lock — опорная версия для следующего воспроизводимого review, не ложное утверждение о hash каждого уже прочитанного байта. Taste SKILL прочитан по SHA `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`, путь `skills/taste-skill/SKILL.md`, frontmatter `design-taste-frontend`, version 2.5.1.

## Конкретные конфликты Taste Skill 2.5.1

В house rules первоисточника есть:

1. Секция ровно в один или два desktop viewport. Для длинного каталога, таблицы CRM или юридической страницы это не универсальный UX-закон.
2. Hover lift карточки 2px и обязательный hero entrance. Это напрямую расходится с текущим owner запретом hover lift на отдельных проектах.
3. Запрет captions под любым visual. Подпись товара, источника или диаграммы иногда необходима.
4. Правило contacts с `.example`, без реальных телефонных форматов/номеров домов. Это режим демонстрации, неприемлемый как глобальная инструкция production-сайту.
5. Запрет violet/lavender. Если это утверждённый бренд, skill не имеет права его отменять.
6. Собственный kit, полноэкранные композиции и Stop hook. Подключение всего набора может создать новый узнаваемый шаблон и конфликт жизненного цикла вместо индивидуального дизайна.

**Решение-рекомендация:** не ставить Taste глобальным авто-триггером. Сначала отдельная sandbox-ветка/копия, явный выбор режима и сравнение с базой. Брать методику клиентской специфики и проверок; исключения документировать, не править сторонние checker scripts только ради PASS. Сохранять upstream и адаптер раздельно.

## Как именно избежать «AI-конвейера»

Признаки качества не сводятся к отсутствию градиента. Для каждой задачи нужен контракт:

- Факты и материалы этого клиента, сценарий пользователя и аргумент страницы до layout.
- Два действительно разных направления: композиция, пропорции, типографическая иерархия, изображения, ритм; не одна сетка с двумя акцентами.
- Референсы с объяснением конкретного приёма, не копирование фирменной сцены/кода/картинок.
- Типографика с проверенной кириллицей, реальными длинными заголовками, загрузкой шрифтов и fallback. Размеры оцениваются в контексте, не по одному модному масштабу.
- Сначала один выбранный экран/сценарий, затем owner acceptance направления; только после — масштабирование.
- Реальный viewport review: desktop/tablet/mobile, keyboard, reduced motion, loading/error/empty/long content. Скриншоты должен просмотреть исполнитель и независимый reviewer.
- Проверка «замени логотип на ближайшего конкурента»: если ничего не меняется, идея недостаточно специфична. Это эвристика, не автоматическая метрика.
- Не обещать рост конверсии без эксперимента. Оценки LLM — rubric, не объективная дизайнерская приёмка.

## Reddit: что найдено и чего не проверено

Найдены индексированные обсуждения:

- https://www.reddit.com/r/ClaudeCode/comments/1u8c5qi/design_skills/
- https://reddit.com/r/ClaudeCode/comments/1wn6eb1/how_do_you_get_claude_code_to_create_a_genuinely
- https://reddit.com/comments/1vkxzef

В доступных search extracts встречаются противоположные мнения: Impeccable полезен при явном вызове audit/layout, но накопление frontend-design + taste + Impeccable само по себе не решает арт-дирекцию; советуют несколько mockups и реальные референсы. Это мнения сообщества, не независимый benchmark и не результаты нашего теста.

**Ограничение:** полный парсинг веток и комментариев не выполнен. `web_extract` возвращает отказ провайдера HTTP403; реальный browser получил `You've been blocked by network security` для одной ветки и пустую страницу для другой. Поэтому нет заявлений о числе комментариев, консенсусе или полном прочтении. Не обходить авторизацию, не использовать чужие cookies или прокси.

## Источники

- https://github.com/emilkowalski/skills — README, список специализаций.
- https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md — interaction/motion framework.
- https://emilkowal.ski/ui/agents-with-taste — авторская методика передачи правил вкуса (найдено поиском, не отдельная полная проверка статьи).
- https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md — команды, modes, контекст и реальные screenshot checks.
- https://github.com/pbakaus/impeccable/blob/main/.claude-plugin/marketplace.json — точная фраза Design fluency for AI harnesses.
- https://github.com/Leonxlnx/taste-skill/blob/d1a2bb41d927083ac7118f60cfc9cdf711810ea0/skills/taste-skill/SKILL.md — проверенные ограничения 2.5.1.
- https://developers.figma.com/docs/figma-mcp-server/ — MCP и официальные skills.
