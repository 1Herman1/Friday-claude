# Surface-aware playbook — дополнение к основе Friday

## Приоритет и узкие scopes

**global base сохраняет приоритет по safety, a11y и anti-slop guards.** Читать
`docs/core/design-principles.md`, `design-profiles.md`, `typography-pairs.md`,
`ux-guidelines.md`, `motion.md`, `motion-engine.md` и review-loop. Проектные brand
и MASTER — authority по identity и токенам; approved page overrides приоритетнее
MASTER только для своей страницы и согласованного поля. Библиотека кандидатов,
mode и референс не отменяют global base. При конфликте без явного узкого
уточнения остановить зависимую правку и передать владельцу; не переписать MASTER
или базовый запрет ради PASS. Этот документ добавляет scopes, не удаляет bans.

- **Font scope:** запрет Inter/Arial/system-default как неутверждённого главного
  бренд-шрифта остаётся. Точное имя в fonts, полученном `loadDesignSystem` из
  MASTER проверяемого проекта, допускает существующий approved body/fallback.
  Это не broad whitelist Inter и не разрешение превратить body в новый brand
  display. Target path projects/tools приоритетнее active другого проекта;
  если у названного target нет MASTER, чужой active MASTER не даёт font approval.
  Исключение линтера относится только к точным parsed fontFamily values:
  упоминание Inter в prose, Inter Tight или lowercase inter не одобряет Inter;
  approved Inter не одобряет Arial. Без approval legacy ERROR сохраняется.
  Линтер **не AST**, не знает фактическую роль шрифта и не парсит page overrides;
  role/page conflict проверяется вручную, не объявляется автоматически закрытым.
- **Layout scope:** hero/nav/list numeric defaults — не универсальные hard-fail
  для Read/Operate. Рецепт hero не требует от docs/editor 100svh, marketing
  display-scale, фиксированного числа nav links или количества элементов списка.
  Число оправдывается задачей, плотностью и evidence. Но реальные clipping,
  overlap, недостижимое действие, hit areas <44×44px и a11y defects — blocker
  независимо от mode. Контраст текста ≥4.5:1 (крупного ≥3:1), labels и accessible
  names не становятся advisory. Строковый detector **не вычисляет WCAG**:
  grey-on-color, small-target и другие seeds — pattern signals, не computed
  contrast/hit-box audit. Их существующие уровни/exit codes не понижаются.
- **Motion scope:** decorative bounce/elastic остаётся запрещённым (включая
  animate-bounce/ease-elastic). Inertial motion — не синоним декоративного bounce:
  inertial spring с damping около 0.8 возможен только после реального флика/свайпа
  с разгоном, через существующую wrapper и с continuity evidence. Таблица drawer
  не даёт blanket overshoot без жеста. Default UI — no-overshoot, damping 1.0;
  keyboard/high-frequency feedback не задерживать. Нельзя обойти запрет переименованием
  easing. Transform/opacity-only, запрет прямого animejs import, transition-all,
  ease-in, scale-from-zero guards и reduced-motion path остаются действующими;
  filter/mask/layout animation этим документом не разрешаются.

**Protected gates:** права на исходники/AI-input, бюджет и лимиты попыток,
pilot/preview, явное owner acceptance и разрешение на публикацию остаются
обязательными по media-reference-handoff и разрешённому scope. Этот policy не
запускает генерацию, сервисы, uploads, hooks, deployments или upstream runtime.

## Surface brief и identity/refinement lock

Режим задаётся per-page / per-surface, не на весь продукт. До изменения записать
route, аудиторию, задачу и working action, use scene (устройство, частоту,
освещение), mode, evidence и разрешённый scope. Доменные profiles и dials
уточняют бриф, но не заменяют цель страницы.

| Mode | Назначение и структура | Проверка |
|---|---|---|
| Persuade | Посетитель решает и действует: offer → proof → working action уже в первом экране. Поиск, запись или add-to-cart действительно работают, не декоративный CTA. | Понятны предложение, доказательство и следующий шаг. |
| Operate | Повторяемая задача: familiarity, скорость, знакомые navigation/controls. World задаёт type/palette/density и один signature move, не новый костюм управления. Fixed rem scale и одна UI family допустимы. | Задача доступна сразу, без page-load шоу, с semantic states и structural responsive. |
| Read | Документ и wayfinding: спокойная колонка около 60–75ch, ориентир 16px; world — в frame/masthead/rail/code-tables, не позади текста. Docs index также Read. | Читаются длинный текст, оглавление, код и таблицы, не теряется место чтения. |
| Experience | Работа/произведение доступно с первого viewport, chrome отступает. | Навигация, управление, выход и a11y остаются доступны. |

Один SaaS: landing — Persuade, editor — Operate, docs — Read; интерактивная
работа — Experience, только если цель действительно опыт, а не выбор тарифа.

**Identity lock:** сначала прочитать brand, MASTER и page overrides; выписать
что сохраняем: logo, palette, type roles, voice, navigation, density, узнаваемый
composition/motion. Refinement не даёт полномочия на redesign. При refinement
исправлять конкретные дефекты внутри существующей идентичности; не устраивать
турнир новых worlds, не менять бренд-шрифт ради моды. Redesign требует явного
scope владельца; предложенный вариант не равен approval. Если identity неполна,
отделить известное от вопросов, не выдавать выдуманный бренд за существующий.

## Порядок работы: задача до косметики

Это additive policy, а не новый runtime. Потребители: `.codex/CODEX.md`,
`.codex/commands/design-system.md`, `.codex/skills/design-system/SKILL.md` и
зарегистрированный taste-curator (MD/TOML). Эти маршруты проверяются отдельным
`test_surface_routing.py`; наличие маршрута не доказывает reload открытой IDE
или приёмку клиентского UI. На исходной leaf-ревизии маршруты **не подключены**;
это историческая граница отчёта stage05. Названия ниже обозначают intents и
не являются установленными командами.

### 1. Intent

Сформулировать, кто что должен понять/сделать и по какому наблюдаемому результату
это проверим. Отделить audit-only, refinement и redesign; зафиксировать lock.
`polish` начинается с triage: blocked task, потеря данных, a11y и неверные states
исправляются до декоративной шлифовки. Нет scope на исправление — finding + owner,
не молчаливый PASS и не самовольное расширение задачи.

### 2. Content structure

Сначала реальный content inventory: вопросы пользователя, ответы, порядок чтения,
proof и working action. `clarify` — конкретный глагол + объект + последствие:
«Сохранить черновик» вместо «Продолжить», если именно это произойдёт. Ошибка
объясняет что случилось, какие данные сохранены и как восстановиться; не обвиняет
пользователя. Destructive action называет удаляемый объект, обратимость и confirm.

Voice брать из brand: словарь терминов, обращение, степень формальности; один
термин на сущность, sentence case, краткие labels, подробности в help, не в CTA.
Для каждого численного/коммерческого утверждения хранить источник и актуальность:
**fabricated claims запрещены** — никаких придуманных процентов, отзывов, логотипов
клиентов, scarcity, сертификатов, сроков или гарантий. Неизвестное обозначить как
вопрос/placeholder в development-only brief, не публиковать как факт. Не делать
новый юридический текст вместо проверки по `docs/core/rkn-compliance.md`.

### 3. Typography

`typeset` — использовать утверждённые type roles и кириллический subset; проверить
иерархию, длину строки, реальные заголовки и длинный русский label, переносы,
цифры/таблицы, optical alignment. `text-wrap: balance/pretty` — progressive
улучшение, не условие доступа к тексту. Проверить 200% zoom, fallback metrics и
late font load: отсутствие обрезки и layout shift подтверждается в браузере.
Существующий approved body/fallback не менять из-за вкусового запрета по имени.

### 4. Functional states

`harden` — матрица default/loading/empty/no-results/error/success/permission/offline,
а не один «пустой» экран на всё. Slow и stale response, retry, двойной submit,
cancel/undo и сохранение ввода проверяются реальными сценариями. Не прятать
существующий контент при background refresh; статус объявлять доступно, без
ложного success. Проверить cancel drag → новый drag и keyboard alternative.

`onboard` — отдельно first-use (следующий реальный шаг), returning user, новый
account без данных, permission denied, обновлённая версия/новая feature, dismissed
и completed. Не повторять tour навсегда; состояние хранить в корректном
account/version scope. Onboarding не блокирует рабочее действие без необходимости.

### 5. Responsive / a11y

Проверить mobile/tablet/desktop и фактический контент: длинные labels, пустые и
большие списки, ошибки, code/tables. Keyboard/focus order, visible focus, label,
accessible name, hit areas, zoom и measured contrast обязательны. Для локализации
проверять RTL и смешанный текст; не разрушать Arabic/Persian normalization ради
унификации. Structural responsive меняет структуру задачи осмысленно, не просто
уменьшает весь desktop. Неразрешимые clipping/overlap и недоступное действие — blocker.

### 6. Evidence

Текущая revision + route/state/data/viewport + actual commands/results и inspected
captures. Blank, wrong state, missing mobile или stale capture → recapture, не PASS.
`critique`: independent A — свежая визуальная оценка без detector findings;
deterministic B — отдельный technical audit известных pattern signals; затем
synthesis с устранением дублей и владельцем каждой находки. Если независимый
reviewer недоступен — independence degraded, не выдавать self-review за независимое.
Технические проверки остаются deterministic-first; порядок critique не отключает их.

`extract/refresh` — документировать реально использованные reusable tokens и
components после build. Planned-but-unused не канонизировать; page-only strategy
оставить на странице. Перед overwrite получить явный выбор владельца; единственный
MASTER остаётся источником токенов, не создавать конкурирующий source of truth.
Открытый подтверждённый дефект не закрывается числом раундов. Verdict ограничен
проверенной revision и scope; fixed findings не означают whole-surface acceptance.

## Temporal evidence

Motion acceptance — **не static PNG**. Нужен воспроизводимый temporal packet:
revision, route, viewport/device, trigger, исходное состояние, input sequence,
normal/reduced preference, timestamps и recording/frames **before → first → mid
→ last → settled** одной области/одного состояния. Для входа и выхода отдельно;
settled снимать после окончания, не подменять последним кадром transition.
Статический PNG доказывает только layout конкретного момента, не continuity,
interruptibility, performance или cleanup. Указать paths и фактически просмотренные
кадры/видео; frame-time evidence получать измерением, не по ровности bounding boxes.

| Сценарий | Что реально воспроизвести / доказать |
|---|---|
| interrupt | Прервать в mid новым вводом/обратным действием: продолжение от текущего значения, без snap, stale callback или блокировки управления. |
| repeat | Несколько повторов entry/exit и drag → cancel → drag; нет накопления listeners, replay entrance, orphan linger, рассинхронизации и удвоения скорости. |
| reduced | Повторить те же actions с prefers-reduced-motion: без spatial motion, доступное конечное состояние и meaningful feedback; runtime preference change проверить отдельно, если поддерживается. |
| offscreen | Увести элемент за viewport и скрыть tab: perpetual motion останавливается; возврат не порождает дубликаты и неверный state. |
| destroy | Уничтожить/unmount в mid и после settled: нет timers/listeners/RAF callbacks, style writes в detached node или оживления старого instance; новый mount работает. |

При просмотре искать brightness dip crossfade, скачок shadow/opacity, последний
кадр с end-paint swap, orphan layer, потерю фокуса и дерганье после прерывания.
Smooth geometry не доказывает smooth paint. Записать normal/reduced separately;
недоступный browser/device/profiler — «не измерено» с named gap, а не PASS.
При missing/blank/wrong-state evidence — recapture; при дефекте — fix + repeat
на новой revision. Сначала рабочая задача и корректный state, потом motion polish.

Основание delta: `docs/research/design-agent-upgrade/deep-audit/impeccable-content.md`
(Visitor modes:49–58; findings F3/F4/F7/F8/F10/F11/F12/F14). Это адаптация методики,
не установка upstream и не утверждение owner visual acceptance клиентского UI.
