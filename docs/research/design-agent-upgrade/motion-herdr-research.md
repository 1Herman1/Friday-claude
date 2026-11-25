# Remotion и Herdr: исследование для upgrade H&B design agents

## Статус, scope и revision

- Дата проверки: **25 ноября 2026**, часы среды: `2026-11-25T13:46:18Z`.
- Исполнитель: адаптированный researcher в Hermes, конечный специалист; без переделегирования, native Codex и Claude API.
- Scope записи: только этот новый отчёт. Установки, запуск Remotion/Herdr UI, платные сервисы, генерация медиа, изменение ролей/конфигов и коммиты не выполнялись.
- База: Friday `388ec708f39583172d7f36110f6424cc175b5512`, ветка `claude/greeting-nnz368`; рабочее дерево уже содержало чужие изменения. Revision документа: R1, содержимое этого файла; последующие правки требуют повторной проверки.
- Прочитаны семь локальных файлов: `.codex/CODEX.md`, `README.md`, `.codex/workflows/review-loop.md`, `.codex/agents/design/motion-curator.md`, `docs/projects/hb-landing/project.md`, `docs/core/templates/motion.ts` и этот отчёт при технической проверке. Лимит 15 файлов не исчерпан; изучение локальных механизмов остановлено после нахождения границы UI/video. Это **не полный аудит** design-department, зарегистрированных TOML или инфраструктуры.
- Доказательства: прочитанные тела официальных GitHub/доков; утверждения из README — документированные возможности, **не исполненные тесты**. Локальная совместимость проверена только командами чтения состояния.
- **Verdict по всему поручению: BLOCKED / не полный PASS.** Официальное исследование и контракт пилота подготовлены. Критерий «минимум две доступные Reddit-ветки» не выполнен: обе заданные ветки и две дополнительные не удалось прочитать; ниже точные ограничения. Независимое ревью должен выполнить координатор; самопроверка им не является.

## Краткий вывод

**Remotion имеет смысл пилотировать как отдельное производство управляемой кодом motion-графики, а не как замену нейровидеогенератору или UI motion-curator.** LLM пишет React-код и параметры сцены, а Remotion превращает вычисляемые по номеру кадра сцены в видео. Согласованный шрифт, точный текст, тайминг, подписи, графики, логотипы и переиспользуемые шаблоны — естественные задачи такого подхода.[3][5][6]

**Herdr — хост терминалов и транспорта агентной работы, а не готовый директор дизайн-отдела и не security sandbox.** У него есть реальные примитивы запуска помощников, сообщений, ожидания и persistence; решения о ролях, качестве, бюджете и приёмке нужно оставить студийному процессу.[16][17][19]

**Не объединять два пилота.** Сначала проверить художественный результат Remotion на одном брифе; отдельно — необходимость нового execution host. Добавление Herdr не улучшает вкус автоматически, а увеличивает поверхность доверия. Это рекомендация исследования, не утверждение о выполненной интеграции.

## 1. Что реально делает LLM + Remotion

### Цепочка от инструкции к механизму

1. `remotion-dev/skills` → агент получает правила создания проекта, markup, render, captions, interactivity и поиска API. Это инструкции для уже существующего coding agent, не новая обученная видеомодель.[1][2]
2. `skills/remotion-markup/SKILL.md` → агент пишет React-композицию и связывает движение с `useCurrentFrame()`, `interpolate()` и `fps`; указывает ассеты, сцены, audio/video и параметры. Прямо запрещены CSS transition/animation как источник хода рендера; отдельный animation guide подтверждает требование `useCurrentFrame()`.[3][4]
3. Номер кадра → React вычисляет вид сцены. Документация требует одинакового изображения для одинакового кадра, отсутствия зависимости от последовательного обхода кадров и от несинхронизированной случайности.[5]
4. `@remotion/renderer` → `renderMedia`, `renderFrames`, `renderStill`; CLI использует этот renderer. В справочнике присутствуют управление Chrome, сборка кадров в видео, FFmpeg/ffprobe helpers.[6]
5. Готовые кадры/ролик → визуальный контроль, исправления исходного кода, повторный рендер. Наличие render API не доказывает, что агент увидел весь ролик или что результат соответствует бренду.

### React-анимация и нейросетевое видео — разные классы

| Вопрос | Remotion | Нейросетевой генератор видео — концептуальное сравнение |
|---|---|---|
| Что создаёт LLM | Исполняемое описание сцены на React/TS | Обычно prompt/параметры для отдельной модели |
| Кто формирует кадры | Renderer выполняет композицию | Генеративная модель синтезирует визуальное содержание |
| Повторяемость | Кадр — функция номера, props и зафиксированных ассетов/среды | Зависит от модели, seed и сервиса; в этом исследовании конкретный сервис не тестировался |
| Изменение текста/тайминга | Редактируемые параметры и исходники | Часто требует новой генерации/отдельного композитинга; не универсальное обещание |
| Новое снятое действие, жидкость, персонаж | Нужно готовое видео, процедурная сцена, 3D или внешняя генерация | Может быть основной задачей модели; качество здесь не измерялось |
| Точность упаковки | Можно сохранять исходные пиксели, если используются исходные изображения без перерисовки | Не предполагать сохранение надписей/геометрии без проверки результата |

Документальная основа колонки Remotion — правила frame-driven rendering, ассетов и render API. Конкретный нейровидеосервис в scope не исследован.[3][5][6]

**Ограничение слова «детерминированный».** Это требование к композиции, не гарантия бит-в-бит одинаковых MP4 на любых GPU/браузерах/кодеках. Незагруженный шрифт, remote URL, `Math.random()`, wall-clock, CSS animation и внешнее состояние могут сломать повторяемость. Remotion отдельно описывает многовкладочный параллельный рендер и необходимость дождаться ассетов.[5]

**Практический вывод для H&B:** типографический проморолик, титры, диаграммы, монтаж утверждённых кадров, точные product overlays — хороший bounded pilot. «Сделай фотореалистичное вращение флакона по одному packshot» не становится решённой задачей только из-за Remotion: нужно подтвердить геометрию/ассеты и способ рендера. Сходный React-синтаксис не делает Remotion заменой живым UI transitions.

## 2. Официальные skills: что брать, чего не обещать

Документация и GitHub подтверждают официальный источник `remotion-dev/skills`. На странице есть `remotion-best-practices`, create, markup, studio, render, maps, elements, captions, saas, interactivity, docs, license, upgrade и multimedia. GitHub README согласуется с документацией; открытый markup имеет `version: 4.0.547`.[1][2][3]

Приоритет для будущего пилота: **best-practices + create + markup + render + docs + license**, captions/audio/interactivity — по брифу. `studio` означает отдельный запуск UI и сейчас не разрешён. Автоматические установки, upgrades, импорт Elements или внешних моделей нельзя выполнять только потому, что они упомянуты в skill.

Официально описанные команды, **в этом исследовании не выполнялись**:

```text
npx remotion skills add
npx skills add remotion-dev/skills
gh skill install remotion-dev/skills
```

Это команды документации, не доказательство совместимости с текущим Hermes loader и не разрешение на глобальную установку.[1][2]

Важный конфликт с house rules: markup предлагает класть ассеты в `public/` отдельного Remotion-проекта, тогда как Friday запрещает выкладывать неутверждённые медиа в production/public целевого сайта. Решение пилота: отдельный непубликуемый workspace, его `public/` не связан с deploy сайта; финальный export переносится только после разрешения. Приоритет preview/rights gates задан `.codex/CODEX.md:20–29,75–84`.

## 3. Лицензия коммерческого студийного использования

### Что подтверждено и что нельзя смешивать

- GitHub `LICENSE.md` — **собственная Remotion License**, не MIT/Apache. Разрешает коммерческое создание видео/изображений подходящим Free License пользователям; указывает individuals, for-profit organizations до трёх employees, nonprofits и некоммерческую оценку. Остальным нужна Company License. Перепродажа собственной производной Remotion отдельно ограничена.[8]
- Live pricing и FAQ подтверждают коммерческое использование и free eligibility для individual/team до трёх человек. В FAQ headcount — всего бизнеса/команды, а не только количество авторов ролика.[9][10]
- **Найдена важная версионная граница:** `/docs/terms` прямо помечен `Upcoming document` для **5.0**; там же дана ссылка на действующие условия **4.0**. Нельзя объявлять все будущие положения уже действующими для 4.x. `/docs/terms-4-0` это подтверждает; при конфликте в нём указан приоритет software license.[11][12]

### Тарифы — только прочитанные предложения, не выбранный план H&B

На момент чтения pricing и FAQ показывают **Creators: $25/месяц за seat**; **Automators: $0.01/render, минимум $100/месяц**; Enterprise — старт/минимум $500/месяц. FAQ говорит, что coding agents не требуют собственных seats: учитываются люди. Упоминаются отдельные условия совмещения опций. Это не расчёт стоимости H&B, не коммерческая оферта для нашего кейса и не бюджетное разрешение.[9][10]

**Не выбирать автоматически Creators из фразы «LLM делает ролик».** Pricing относит low-volume local motion design с AI к Creators, но FAQ считает программные render API/CLI и Player automation. Будущий unattended pipeline надо описать поставщику отдельно: кто запускает, каким кодом, кому отдаётся проект и каков headcount. Минимум Automators не распространяется на пользователя, действительно подходящего под Free License.[9][10]

FAQ различает агентство, отдающее клиенту только финальный MP4, и передачу/совместную эксплуатацию Remotion codebase. В первом случае считает агентский headcount, во втором описывает aggregation и ответственность IP owner. Там же разрешён сервис, генерирующий собственный Remotion-код по запросу клиента, но не произвольный BYO Remotion-code rendering service. Эти разъяснения полезны, однако их ссылки ведут и на будущие terms 5.0: для спорного контракта нужна письменная квалификация кейса и зафиксированная версия, не вывод по одной FAQ.[10][11]

### Gate перед коммерческим пилотом

Зафиксировать: юрлицо/команду и применимый headcount; подрядчиков/партнёров; клиента и владение кодом; версия Remotion; manual creation или automation; наличие Player/server API; trial или оплачиваемая работа; права на logo/font/music/product assets; будущая передача исходников. Если квалификация неоднозначна — получить ответ Remotion до коммерческого использования. Размер студии и договоры пользователя из контекста **не установлены**, поэтому «H&B бесплатно» здесь не утверждается.

FAQ отдельно сообщает, что Remotion self-hosted, а не включённый в лицензию облачный render service. Также описывает различия telemetry browser/server и предстоящее изменение для Automators в 5.0. Нельзя переносить будущую обязательность на 4.x без проверки версии.[10][11]

## 4. Требования и проверка текущей среды

Официальная getting-started страница на момент чтения: минимум Node 16 или Bun 1.0.3; macOS 15+; для Linux glibc 2.35+ с отмеченным ARM64 Amazon Linux исключением, дополнительные системные пакеты; Alpine и nixOS не поддерживаются. Это текст документации, не рекомендация ставить устаревший Node 16.[7]

`@remotion/renderer` требует согласованных **одинаковых exact versions** `remotion` и `@remotion/*`; docs показывают 4.0.547. В renderer APIs конфигурационный файл не действует — параметры надо передавать API явно, иначе настройка CLI может дать ложную уверенность.[6]

Проверено read-only командами: `sw_vers -productVersion` → **15.6**, `uname -m` → **arm64**, `node --version` → **v24.21.0**; PATH содержит `/usr/local/bin/node` и `/Users/germanbryzgalov/.hermes/bin/ffmpeg`. `command -v hc`, `herdr`, `herdr-app` путей не вернул. Это означает «не обнаружены в текущем PATH», не «нигде не установлены».

Базовый OS/runtime минимум выглядит совместимым, но Chrome renderer, зависимости, лицензии ассетов, реальный memory/time/disk budget и render success **не проверены**. Отсутствие нужды в inference GPU для обычной React-композиции не означает, что эффекты/браузер не используют GPU или что любой проект дешёвый; CPU/GPU benchmark не выполнялся.

## 5. Herdr: точная идентификация и границы

`https://github.com/herdr-app/core` был запрошен буквально: GitHub вернул **404**. Поиск нашёл подтверждённые авторские репозитории **`herdrdev/herdr-app` и `herdrdev/herdr-core`**; они прочитаны. Это предложенное разрешение названия, не утверждение, что неверный URL существовал/переехал. С `herd`-координаторами другого происхождения не смешивать.[14][15][16]

| Компонент | Как работает по первичным источникам | Что это не доказывает |
|---|---|---|
| `herdrdev/herdr` | Исходный Rust TUI/multiplexer со своим background server, CLI/socket API, panes, remote connections, agents/plugins | Не тождественен новому desktop app/core |
| `herdrdev/herdr-app` | Native окно: spaces, tabs, layouts, панели/mods, отображение агентов; терминалы выполняет core | Закрытие окна и закрытие pane имеют разные последствия |
| `herdrdev/herdr-core` / `hc` | Headless terminal runtime; holder processes держат PTY/программы, core предоставляет CLI/API, events, streams, remote SSH | Не модель LLM, не проектный директор, не автоматическая приёмка |

Это различие подтверждено README всех трёх компонентов и отдельным core security contract.[13][15][16]

### Механизмы координации, а не «вообще никакой оркестрации»

Core реально позволяет `hc run --bg`, `hc send`, `hc read`, `hc wait --children all`; дочерние агенты связаны с родителем, получают opening role/task и могут отправить результат. Родитель получает notes о завершении/внимании. Поэтому называть Herdr **только UI** неверно: имеются исполняемые coordination primitives.[16][19]

Но assignment policy, граф зависимостей проекта, независимость reviewer, revision-bound quality gates, бюджет и owner acceptance эти README не заменяют. Рекомендация: Hermes/Friday остаётся координатором, Herdr — опциональным execution/observation host. Наличие template reviewer с текстом «read-only» **не делает его файловый доступ read-only**: это prompt, а не enforcement.[17][19]

### Persistent workflows: что сохраняется

| Событие | TUI `herdr` | Новый `herdr-core` / app |
|---|---|---|
| Закрытие viewer/window | Background server продолжает работу | Core/holders продолжают терминалы |
| Закрытие pane/tab | Не считать эквивалентом detach | README app: заканчивает её терминалы |
| Core/server update/restart | TUI: обычный restart теряет процессы; experimental handoff best-effort отдельно | Core README: holders позволяют пережить core update/restart |
| Reboot, power loss, утрата программы | Снимок layout, optional screen history, native agent session resume при поддержке; исходные процессы не живы | `--keep` восстанавливает **свежий shell**, не выполняет заново задачу; saved screen opt-in |
| Потеря родителя | Проверять поведение данной версии | Дети обычно заканчиваются с родителем; `--outlive-parent` — явное исключение; detached programs имеют отдельные caveats |

Основание таблицы — не маркетинговый слоган «never let go», а конкретные documented recovery paths.[15][16][20]

Persistent terminal полезен для длительного рендера, тестов и параллельных review: можно вернуться к процессу/выводу. **Durable business workflow** требует дополнительного собственного журнала job ID, input revision/hash, этапов, output paths, retries, idempotency, cancellation, budget/approval receipts. Показанная persistence не доказывает exactly-once, retry после reboot, восстановление всех RPC или продолжение LLM turn. В TUI docs прямо предупреждено, что при handoff in-flight waits/API/messages могут прерваться.[20]

Status в core приходит от программы по **OSC 7501**; core не угадывает по тексту экрана. Отсутствие status у незнакомого агента — допустимое состояние, а не green. Templates не устанавливают агент и не настраивают его status integration; `ready: quiet` — fallback, тишина не доказывает готовность пройти trust dialog.[16][19]

### Security: важная отрицательная находка

**`herdr-core/docs/security.md`: “It is not a sandbox or a permission broker for agents.”** Команды выполняются с filesystem/network доступом пользователя core; любой API client в trust boundary может запускать команды и читать/менять файлы. Unix socket/local directories ограничивают подключение, но отдельного API password и per-client permissions нет. Sessions разделяют state, а не права безопасности.[17]

**`herdr-app/docs/security.md`: mods — доверенный JavaScript.** Может выполнять программы, читать файлы, обращаться к сети и подключённым машинам; file API restriction обходится запуском программы и не считается sandbox. Нет разрешения на каждый exec/network request.[18]

Практические следствия для H&B:

- Не запускать core под root/admin; не выдавать доступ к его socket недоверенным агентам/ученикам.
- Для настоящего ограничения использовать отдельного OS user/VM/container с доказанными mounts, credentials и egress rules; один `HC_SESSION` или role prompt недостаточен.
- Терминальные истории, saved screens и app/core state приватны и не шифруются продуктом; не переносить их автоматически в Git/общую память.
- Remote SSH добавляет доступ к аккаунту целевой машины; забыть machine локально не значит остановить/очистить её процессы.
- Release checksum с того же сервиса не равен независимой подписи supply chain. Документация уточняет conditional Windows signing, macOS bundle verification и отсутствие независимо подписанного manifest.

Все эти ограничения описаны самими авторами; penetration test здесь не выполнялся.[17][18]

App releases включают usage telemetry по умолчанию; есть `telemetry: false`, `DO_NOT_TRACK=1`, `HERDR_TELEMETRY=0`. Отключение telemetry не отключает update checks или сеть mods. Настройки пользователя исследованием не менялись.[18]

Herdr app/core/TUI заявлены Apache-2.0; это отдельная лицензия, не Remotion. Core binaries доступны macOS/Linux x86_64/aarch64 и Windows x86_64; desktop macOS binary — Apple Silicon, Linux требует desktop session/Vulkan. Сборка из исходников требует Rust/Zig/just, у app также Bun для doc checks; такие зависимости не устанавливались.[13][15][16]

## 6. Дополнительные GitHub motion skills — без установки

### A. `greensock/gsap-skills` — приоритетный источник по альтернативному UI engine

Официальный авторский репозиторий GSAP, MIT для **skills**; прочитаны README и `skills/gsap-core/SKILL.md`, а не только поисковая карточка. Есть связанные core/timeline/scrolltrigger/plugins/react/performance/frameworks skills, примеры, `matchMedia`/reduced-motion, cleanup и типовые ловушки immediateRender.[21][22]

Оценка: качественный кандидат по происхождению и конкретности API. Но engine GSAP — **не Remotion** и не текущий house anime.js. Встроенная рекомендация «предлагай GSAP по умолчанию» должна уступить утверждённому стеку. Внешние elastic/bounce examples тоже не становятся принятой моторикой H&B. MIT skill не следует автоматически трактовать как лицензию всего движка и всех ассетов. Тесты примеров не запускались.[21][22]

### B. `github/awesome-copilot/.../gsap-framer-scroll-animation`

Прочитан реальный SKILL.md. Даёт выбор GSAP vs Motion, scroll recipes, references, reduced-motion, registerPlugin, client hooks и cleanup. Это community contribution в GitHub-hosted сборнике, не авторская спецификация Motion/GSAP и не лицензия на добавление второго движка.[23]

Оценка: полезен для сравнительного review и проверок scroll interactions, но правила слишком широкие, чтобы переносить без адаптации. Например, «never plain useEffect» строже, чем официальный GSAP README, допускающий scoped `gsap.context()` с cleanup. Сопоставлять с первичным API и конкретным проектом, не копировать формулировку как универсальную истину.[21][23]

**Рекомендация:** не ставить каталог целиком; зафиксировать commit, прочитать нужные references/scripts/license, убрать конфликтующие stack defaults и только после отдельного разрешения проводить baseline pilot. Эти кандидаты найдены/прочитаны, но не installed/loaded/callable/output-verified в студии.

## 7. Reddit: точные ограничения доказательств

Две заданные ветки проверялись как страницы, **не засчитаны по snippet**:

| Ветка | Фактический результат | Что разрешено заключить |
|---|---|---|
| r/Remotion — `1uoqbrl`, building a consistent animation style with Claude | web_extract: 403, backend не поддерживает сайт; archive recovery: `recovered:false`; www/old JSON: HTTP 403; реальный browser после challenge: “You've been blocked by network security” | Контент поста/комментариев и claimed style recipe не проверены |
| r/MotionDesign — `1qkqxwm`, complete guide how to setup Remotion agent skills | Такие же extract/archive/JSON failures; browser www и old frontend: network-security block | Нельзя утверждать, что guide работает или отражает актуальные skills |

Адреса даны в источниках именно как неуспешные попытки доступа, не как supporting evidence о продукте.[24][25]

Дополнительно поиск обнаружил:

- https://www.reddit.com/r/Remotion/comments/1sdvok2/an_open_library_for_reusable_remotion_animation/ — поисковая выдача описывает проблему visual references/reuse; попытка прочитать страницу вернула 403.
- https://www.reddit.com/r/Remotion/comments/1x60he2/i_made_this_in_claude_remotion_then_built_a_skill/ — поисковая выдача содержит self-promotion QA-сервиса и числа экономии; попытка extract вернула 403.

Их заявления **не используются как доказательство** качества, времени, стоимости или доступности. Даже доступный Reddit-пост был бы свидетельством личного опыта/маркетинга автора, не независимым benchmark и не юридическим источником. Числа из QA-рекламы не включены в расчёты.

**Что закрывает gap:** координатор/владелец предоставляет тела хотя бы двух доступных веток с URL/датой либо открывает разрешённый доступ, после чего исследователь проверяет post + релевантные комментарии, отделяет авторскую рекламу от независимого опыта, отмечает актуальность относительно pinned skills и обновляет verdict. Покупка сервисов, ввод логина и обход защит этой задачей не разрешались.

## 8. Точки входа Friday → механизм → что менять после разрешения

| Локальное доказательство | Как работает сейчас | Предлагаемая будущая правка, не выполнена |
|---|---|---|
| `.codex/agents/design/motion-curator.md:20–45` | Живые UI interactions; CSS transition как база, anime.js через wrapper | Оставить UI scope; Remotion не смешивать с живыми scroll/hover transitions |
| `docs/core/templates/motion.ts:1–16,33–47,86–119` | Это **шаблон, не собранный модуль**; есть `matchMedia`, reduced-motion transform handling и scroll reveal | Не импортировать шаблон в Remotion; для видео отдельные frame-driven primitives, для сайта сохранить wrapper |
| `.codex/CODEX.md:366–372,510–528` | Маршрутизация UI motion и media → brand-guard, дополнительные UI review gates | Добавить routing по результату: UI interaction / code-rendered media / neural footage; не создавать новую роль на каждую библиотеку |
| `.codex/CODEX.md:20–29,53–66` | Исследование не разрешает генерацию/публикацию и не доказывает работающий backend | Не менять gates; output-verified отдельно от skill discovered |
| `docs/projects/hb-landing/project.md:12–17,44–60,84–88` | H&B — Astro static; Friday mirror не deploy source; жёсткий бюджет JS/видео | Если approved Remotion output пойдёт на сайт — начать с offline video/poster, не тащить React Player в initial bundle автоматически |
| `.codex/workflows/review-loop.md:15–18,29–44,75–80` | Реальные checks/revision и независимое ревью; prompt не заменяет результат | Herdr callback/status учитывать как transport receipt, не как pass reviewer/owner |

Не проверено, синхронизированы ли readable MD с исполняемыми TOML в грязном дереве. Поэтому таблица показывает контракты/направления, а не подтверждает live routing и не предлагает прямо сейчас переписывать роли.

## 9. Практический pilot acceptance — будущие проверки, НЕ результаты запуска

### P0. Предусловия

Письменный approved scope одного пилота, отдельный непубликуемый workspace, pinned dependency/skill revision, проверенная лицензия и headcount, утверждённые logo/fonts/product originals. Нулевые paid API calls и отдельный лимит compute/time. Указать, кто implementer, независимые brand/design/technical reviewers, что считается approved artifact. Установка требует отдельного разрешения.

### P1. Remotion: один воспроизводимый motion-ассет

**Начальные условия:** один согласованный 8–12-секундный storyboard, формат/fps зафиксированы до работы; ассеты локальные, rights manifest заполнен, версия renderer/skills pinned. Нет генерации новых упаковок и remote mutable assets.

**Действие:** coding agent делает композицию и рендерит локально, затем изменяет только заранее выбранный текст/цвет/тайминг по одному revision. Проводится повторный рендер и независимый просмотр полного ролика.

**Ожидаемый результат и проверки:**

- Есть edit-ready TSX, props/schema, lockfile, source/asset manifest, команда рендера и её реальный exit code; есть видео и poster вне production/public сайта.
- `ffprobe` подтверждает выбранные dimensions/fps/duration/audio policy; полный decode без ошибок. Если нужен silent export — ноль audio streams, не просто muted player.
- Выбранные кадры рендерятся повторно и в переставленном порядке, совпадают в фиксированной среде с заранее установленным допуском. Не использовать общий hash MP4 как единственный тест детерминизма.
- Нет blank/missing-font frames, непредусмотренных смен ассетов, обрезанного текста/кириллицы, flicker, нарушения safe areas; source diff подтверждает scope правки.
- Собственные label/logo originals не перерисованы; brand-guard и владелец подтверждают точный итоговый артефакт, не ранний preview.
- Результат сравнивается с baseline на том же брифе: активное человеческое время, iterations, render wall time, file size, дефекты и стоимость реальных вызовов. Без измерений не обещать экономию/«уровень After Effects».
- Автоматизация/перенос в сайт/масштабирование отдельно разрешаются только после acceptance. Для H&B при будущем встраивании отдельно проверить poster/lazy/preload, reduced-motion поведение самого сайта и budget из project.md.

### P2. Herdr: независимый headless persistence/coordination пилот

**Начальные условия:** отдельное разрешение на установку; pinned core version, изолированный session **и** scratch XDG homes, без studio secrets/production tokens, непривилегированный пользователь. Для security isolation — реальный отдельный аккаунт/VM, а не только session.

**Действие:** сначала без LLM запустить безопасную длительную fixture-задачу и logger, сохранить адрес терминала, disconnect/reconnect viewer, проверить read/wait/exit code; затем протестировать child completion/blocked/error с OSC 7501 и явным receipt. После этого, только в пределах разрешения, подключить доступный Hermes CLI как агент; не подменять его Codex CLI и не предполагать readiness.

**Ожидаемый результат и проверки:**

- Тот же process/PID остаётся жив после закрытия viewer; read показывает новый вывод, а не старую saved screen. Состояние агента подтверждается status protocol, завершение — exit code и артефактом.
- Роль/template действительно переданы, opening task sent подтверждён; child report достигает родителя. Scope/revision в отчёте совпадают с заданными; transport успех не заменяет review pass.
- Проверены parent exit и explicit `--outlive-parent`; cleanup не оставляет fixture-порты/процессы. Не выполнять тесты detached cleanup на реальных студийных задачах.
- Core restart/update и потеря holder/reboot — **отдельные** сценарии с разными ожиданиями: при потере процесса восстановленный shell не выдаётся за продолжившуюся работу.
- Повтор callback/reconnect не создаёт второй рендер и не расходует бюджет повторно: на стороне workflow есть durable job manifest + idempotency key. Потерянный RPC обнаруживается, не записывается pass по молчанию.
- Убедиться, что непривилегированный test client не получает доступ к production files/socket/remote credentials; если запускается под тем же аккаунтом, честный ожидаемый результат — отсутствие sandbox, а не успешная изоляция.
- Все артефакты, логи, terminal history остаются приватными. Никаких auto-install mods/auto-updates и remote machines без отдельного scope.

### P3. Решение по результатам

Remotion вводить только при принятом motion-артефакте, измеримом улучшении против baseline и закрытом licensing gate. Herdr вводить только если потеря/наблюдение долгих jobs — реальная проблема, а persistence и transport pilot это решают. Эти решения независимы; провал Herdr не блокирует офлайн motion design.

## 10. Проверки отчёта и открытые вопросы

Выполнены: чтение официальных страниц/реального SKILL.md, cross-check license/pricing/FAQ и **current 4.0 vs upcoming 5.0 terms**, точная проверка ошибочного URL Herdr, ограниченный repo trace, read-only environment discovery; citation integrity проверяется скриптом ledger перед передачей координатору.

Не выполнялись: установка, renderer execution, Herdr process/API tests, UI inspection продукта, performance benchmark, security penetration tests, независимое ревью, owner acceptance. Наличие файла не объявляется работающей интеграцией.

Открытые вопросы: доступ к двум Reddit-телам; юридический scope H&B; нужен ли unattended render/Player; кто владеет будущими исходниками; художественная приёмка одного пилота; реальная надобность нового host. До них — **исследование с явно указанным blocker, не rollout-ready PASS**.

## Sources

[1] https://www.remotion.dev/docs/agents/skills
[2] https://github.com/remotion-dev/skills
[3] https://github.com/remotion-dev/skills/blob/main/skills/remotion-markup/SKILL.md
[4] https://www.remotion.dev/docs/animating-properties
[5] https://www.remotion.dev/docs/flickering
[6] https://www.remotion.dev/docs/renderer
[7] https://www.remotion.dev/docs
[8] https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
[9] https://www.remotion.dev/pricing
[10] https://www.remotion.dev/docs/license/faq
[11] https://www.remotion.dev/docs/terms
[12] https://www.remotion.dev/docs/terms-4-0
[13] https://github.com/herdrdev/herdr
[14] https://github.com/herdr-app/core
[15] https://github.com/herdrdev/herdr-app
[16] https://github.com/herdrdev/herdr-core
[17] https://github.com/herdrdev/herdr-core/blob/master/docs/security.md
[18] https://github.com/herdrdev/herdr-app/blob/master/docs/security.md
[19] https://github.com/herdrdev/herdr-core/blob/master/docs/templates.md
[20] https://herdr.dev/tui/docs/session-state
[21] https://github.com/greensock/gsap-skills
[22] https://github.com/greensock/gsap-skills/blob/main/skills/gsap-core/SKILL.md
[23] https://github.com/github/awesome-copilot/blob/main/skills/gsap-framer-scroll-animation/SKILL.md
[24] https://reddit.com/r/Remotion/comments/1uoqbrl/building_a_consistent_animation_style_with_claude
[25] https://reddit.com/r/MotionDesign/comments/1qkqxwm/complete_guide_how_to_setup_remotion_agent_skills
