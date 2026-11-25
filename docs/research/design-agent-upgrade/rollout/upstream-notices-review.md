# Независимое ограниченное ревью upstream licence notices

## Вердикт: PASS

Критичных проблем не обнаружено. Подтверждённых замечаний нет. Утечек секретов в проверенных пяти файлах не обнаружено.

- Ревьюер: текущий независимый Hermes subagent; адаптированные роли `code-reviewer` и `security-secrets-scanner`, без повторного делегирования.
- Revision Friday: HEAD `82a1d6847365adb3ecb9dfaeec3b0c7fb6e96fa9`; пять проверенных файлов на момент проверки — untracked. Снимок содержания зафиксирован SHA-256 ниже, а не только HEAD.
- Scope: только `docs/research/design-agent-upgrade/upstream-notices/{README.md,impeccable-LICENSE.txt,impeccable-NOTICE.md,kowalski-LICENSE.txt,taste-LICENSE.txt}` и предоставленная карта источников. Подтверждено программно: каталог содержит ровно эти пять файлов.
- Карта: `/Users/germanbryzgalov/.hermes/cache/scratch/design-rollout/upstream-notice-source-map.json`; SHA-256 `07638c93b65b1cf09cd505b5592c60fd5dea6901acaa616152bbc9d8a745f5e4`.

## Проверка оригинальных Git objects

Использованы локальные исходные клоны `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/{impeccable,kowalski,taste}`. Для каждой записи проверен формат полного commit SHA, разрешён `<pin>^{commit}`, получены blob ID через `git rev-parse <pin>:<source-path>` и исходные байты через `git show <pin>:<source-path>`. Затем Python сравнил исходные и целевые `bytes` напрямую и вычислил SHA-256 через `hashlib.sha256`. Все четыре сравнения байтов и все четыре сравнения с SHA-256 карты — true. README содержит соответствующие repo/pin/SHA-256.

| Файл | Upstream и pinned commit | Исходный путь | Git blob SHA-1 | Байты | SHA-256 целевого файла и оригинала |
|---|---|---|---|---:|---|
| `impeccable-LICENSE.txt` | `pbakaus/impeccable` @ `9e460a87ef338ee9d12c7beed8fedc597a5af5f7` | `LICENSE` | `bb3f6d23b1f8025514a62a12b51b47d73e3c9aa9` | 10766 | `02bb8c3b4e70190e3986c0404ad2fd8d639b4f534252d82379cc1b502b6d1812` |
| `impeccable-NOTICE.md` | `pbakaus/impeccable` @ `9e460a87ef338ee9d12c7beed8fedc597a5af5f7` | `NOTICE.md` | `03538a22d990f52223c976eba9d80dc1ff9e422f` | 1731 | `01bf53e5d24d64e19e9e1c33b24c37cef0d314323df7bf678c6ba22d4528a115` |
| `kowalski-LICENSE.txt` | `emilkowalski/skills` @ `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c` | `LICENSE` | `57b46f1fd11dc62351ea548104a88aa3f659c11b` | 1070 | `4ff5bdb7887ec1435c9cab0e8d1a7caee704d894d65c2a008ccc68b1cc2f260b` |
| `taste-LICENSE.txt` | `Leonxlnx/taste-skill` @ `d1a2bb41d927083ac7118f60cfc9cdf711810ea0` | `LICENSE` | `48a2f6640b81ff8eca9ce7f6a96337692713ef5b` | 1065 | `4575a543ab88dad12ccea7d97e563d0bce5b448b06072e65d3264497dad326df` |

Авторский `README.md`: 1741 байт, SHA-256 `242bfa9e781ed44e09e02a9bbce945385d7b4c9601e3063e2a2ec68bbfcaee3b`. Это сопроводительный текст Friday, не копия upstream object.

## Проверенные критерии

- **Apache LICENSE + NOTICE:** полный Apache-2.0 текст с copyright Paul Bakaus и полный корневой Impeccable NOTICE сохранены без изменения байтов. NOTICE не сокращён: остаются platform-design-skills/MIT, Albert Sans и Alumni Sans/OFL, DuckDuckGo autoconsent/MPL-2.0. Их упоминание не объявлено импортом или лицензионным разрешением на все сторонние бинарные компоненты.
- **MIT:** оба полных текста с copyright Emil Kowalski / Leonxlnx, условиями включения notices и отказом от гарантий сохранены без изменения байтов.
- **Атрибуция и разделение:** README:3–7 отделяет исходные тексты и excerpts от Friday-authored analysis/annotations; README:9–14 точно указывает источники, pins, исходные пути и хеши. README:5–6,15–19 не обещает юридическую чистоту всех компонентов, не перелицензирует fonts/images/logos/trademarks/binaries и не утверждает установку/активацию runtime. Упоминания extension в неизменённом upstream NOTICE читаются вместе с явным уточнением README:15–17, а не как заявление о поставке extension в Friday.
- **Относительные файловые ссылки:** извлечены Markdown-ссылки из всех пяти полных текстов; найдены ровно четыре относительные ссылки — все в README, все ведут к существующим файлам. Backtick-пути внутри оригинального NOTICE — обозначения upstream путей, не локальные Markdown-ссылки и не обещание наличия этих файлов в Friday.
- **Bounded secrets:** прочитано всё содержимое всех пяти файлов, не только diff. Дополнительно выполнен regex-проход по AWS access IDs, Stripe/GitHub/OpenAI/Google/Slack-подобным ключам, PEM private keys, JWT, строковым присваиваниям password/passwd/api_key/secret/token/database_url/access_key и URL с credentials. Реальный результат: `files=5 hits=0`; ручное чтение не выявило секретов. Repo-specific runtime security profile не применялся: scope состоит исключительно из лицензионных текстов и сопроводительного README, не конфигурации конкретного продукта.

## Ограничения и побочные эффекты

Это PASS только для указанного снимка пяти файлов и критериев данного ревью. Полные 92 metadata-файла, Git history, `.env`, CI, runtime, установленные пакеты и сторонние assets/binaries не сканировались. Отсутствие импортов во всём rollout и утверждения README о других пилотах/существующем design-library приняты из предоставленного контекста, не перепроверены вне scope. Исходные pins сверены с локальными Git objects по авторитетной карте; удалённая подлинность репозиториев, подписи коммитов и внешние URL не проверялись. Проверка не является юридическим заключением, гарантией отсутствия любых секретов или blanket licence clearance.

Сеть, установки, провайдеры и credentials не использовались; Git writes и изменения исходников не выполнялись. Единственный созданный файл — данный отчёт. Ошибок выполнения проверок и блокеров нет.
