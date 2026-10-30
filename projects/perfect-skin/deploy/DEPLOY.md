# Деплой Perfect Skin на VPS Timeweb Cloud

Разворачиваем production-версию магазина на собственной базе с полным API.
Стек: Ubuntu 26.04 LTS, Docker (Postgres), Fastify под PM2, Nginx + Let's Encrypt.

Все команды выполняешь по SSH на сервере под root (или через `sudo`).
Если что-то падает — присылай вывод ошибки.

---

## 0. Требования к серверу

Заказать на Timeweb Cloud:
- **ОС:** Ubuntu 26.04 LTS
- **Ресурсы:** 2 vCPU / 4 ГБ RAM / 40 ГБ NVMe SSD
- **Регион:** Россия (локализация данных, 152-ФЗ)
- **Доступ:** SSH-ключ (публичный ключ добавить при создании, приватный сохранить локально)

После создания сервера:
1. Записать IP в GitHub Secrets как `PS_DEPLOY_HOST`
2. Записать пользователя (обычно `root`) в `PS_DEPLOY_USER`
3. Записать приватный SSH-ключ в `PS_DEPLOY_SSH_KEY`

---

## 1. Первичная настройка сервера (bootstrap)

Запускается через GitHub Actions: workflow **«Bootstrap Perfect Skin Server»**
→ **Run workflow**. Запусков будет **два**, и это не ошибка.

**Первый запуск.** Скрипт ставит окружение (Node 22, Docker, Nginx, certbot,
PM2), включает межсетевой экран (открыты только 22, 80, 443), создаёт каталоги
и генерирует на сервере ключ развёртывания. Дальше он **останавливается** и
печатает в логе открытый ключ примерно такого вида:

```
ssh-ed25519 AAAAC3NzaC1... perfect-skin-server
```

Репозиторий приватный, поэтому сервер должен получить к нему доступ. Ключ
нужно добавить: **репозиторий на GitHub → Settings → Deploy keys → Add deploy
key**, вставить строку целиком, галочку «Allow write access» **не ставить** —
серверу нужно только читать.

Закрытая половина ключа остаётся на сервере и никуда не уходит. Вариант с
токеном в адресе репозитория проще, но токен оседает в `.git/config` открытым
текстом — поэтому так не делаем.

**Второй запуск.** Тот же workflow, та же кнопка. Теперь он клонирует
репозиторий, создаёт `.env` со сгенерированными секретами, поднимает Postgres,
применяет миграции и ограничения уровня базы, засевает каталог товаров и
настраивает Nginx.

Скрипт **идемпотентен**: повторный запуск не перетирает уже созданные секреты
и не засевает каталог второй раз.

При ошибке — смотреть лог шага в GitHub Actions, исправить причину и запустить
снова.

---

## 2. Выпустить HTTPS сертификат

После успеха bootstrap подключиться по SSH и выполнить:

```bash
ssh root@<IP_СЕРВЕРА>

# Выпустить сертификат Let's Encrypt на текущий домен (new.perfect-skin.shop)
# certbot автоматически обновит конфиг Nginx и добавит редирект со старого на новый
sudo certbot --nginx -d new.perfect-skin.shop

# Проверить, что сертификат установлен
curl https://new.perfect-skin.shop
```

Ответ:
```
Server certificate:
	subject=CN = new.perfect-skin.shop
	issuer=C = US, O = Let's Encrypt, CN = R3
```

---

## 3. Первая выкатка кода

1. Убедиться, что ветка `deploy/perfect-skin` содержит готовый код
2. Открыть `.github/workflows/deploy-perfect-skin.yml`
3. Нажать **Run workflow** → **Run**

Скрипт:
- Заливает новый код на сервер
- Собирает `@ps/shared` → сервер → клиент (с правильным `VITE_API_URL`)
- Бэкапит БД перед миграциями
- Запускает миграции
- Перезагружает API через PM2
- Проверяет health-check: `GET /api/v1/health` → 200 OK

Если выкатка упала на health-check:
```bash
# Смотреть логи сервера
pm2 logs ps-server --lines 100
```

---

## 3.1. Временный доступ по IP (без домена)

Иногда нужно показать прогресс до того, как заведён домен — например, пока
разработка ещё не готова к переезду на боевой сервер. Сайт технически
доступен по IP сервера, но из коробки не работает: адрес API вшит в сборку
клиента на этапе `npm run build`, CORS разрешает только `new.perfect-skin.shop`,
а куки авторизации и корзины стоят с `secure: true` — браузер их не примет по
`http://`.

Через workflow «Run Command on Perfect Skin VPS»:

```bash
# 1. Дописать в projects/perfect-skin/server/.env (замените <IP>):
echo 'PS_CORS_ORIGIN=https://new.perfect-skin.shop,http://<IP>' >> projects/perfect-skin/server/.env
echo 'PS_COOKIE_INSECURE=1' >> projects/perfect-skin/server/.env
cd projects/perfect-skin && pm2 restart ps-server --update-env

# 2. Пересобрать клиента с адресом по IP и разложить
cd /var/www/ps-src
VITE_API_URL=http://<IP> npm run build --workspace=@ps/client
rsync -a --delete projects/perfect-skin/client/dist/ /var/www/perfect-skin/client/
```

Дальше сайт открывается по `http://<IP>/` — каталог, вход по коду, корзина,
профи-цены работают. Это только для внутренней проверки: без сертификата,
ссылку не рассылать; `X-Robots-Tag: noindex` уже стоит в конфиге.

**Откат перед переездом на домен** — обязателен, иначе `PS_COOKIE_INSECURE`
останется висеть на проде:

```bash
# Убрать обе строки из .env вручную (nano/sed), затем:
cd projects/perfect-skin && pm2 restart ps-server --update-env
```

Клиент пересоберётся сам обычной выкаткой `deploy-perfect-skin.yml` — она
всегда использует боевой `VITE_API_URL`.

---

## 4. Переезд на боевой домен `perfect-skin.shop`

Когда сайт готов, переезжаем с тестового домена на боевой. **Порядок важен.**

### 4.1. Обновить Nginx конфиг

```bash
ssh root@<IP_СЕРВЕРА>

# Отредактировать /etc/nginx/sites-available/perfect-skin:
# server_name new.perfect-skin.shop;  →  server_name perfect-skin.shop;

sudo nano /etc/nginx/sites-available/perfect-skin
# Найти строку с server_name, поменять на: server_name perfect-skin.shop;
# Сохранить Ctrl+O, выход Ctrl+X

# Проверить синтаксис
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

### 4.2. Выпустить новый сертификат

```bash
# Сертификат на новый домен (certbot автоматически обновит конфиг)
sudo certbot --nginx -d perfect-skin.shop

# Проверить редирект со старого домена
curl -I https://new.perfect-skin.shop
# Ответ должен быть: 301 Moved Permanently → https://perfect-skin.shop
```

### 4.3. Пересобрать клиент с новым API URL

**ВАЖНО:** фронт-бандл содержит адрес API, поменять его в рантайме нельзя.

```bash
# Запустить выкатку с новым VITE_API_URL через GitHub Actions
# Workflow сам пересоберёт клиент с правильным адресом
```

1. Открыть `.github/workflows/deploy-perfect-skin.yml`
2. Поменять строку:
   ```bash
   VITE_API_URL=https://new.perfect-skin.shop npm run build --workspace=@ps/client
   ```
   на:
   ```bash
   VITE_API_URL=https://perfect-skin.shop npm run build --workspace=@ps/client
   ```
3. Поменять `PS_CORS_ORIGIN` в переменных окружения сервера (или через GitHub Secrets).

### 4.4. Открыть индексацию

Индексация закрыта по умолчанию. Открывается она двумя переключателями, оба в один заход:

1. **Nginx** — один файл, одна строка. На сервере:

   ```bash
   sudo nano /etc/nginx/snippets/perfect-skin-indexing.conf
   # было:  default "noindex, nofollow, noarchive";
   # стало: default "";
   sudo nginx -t && sudo systemctl reload nginx
   ```

   Пустое значение означает «заголовок X-Robots-Tag не отдавать». Все HTML, статика и API
   берут его из этого же переключателя.

2. **Приложение** — `projects/perfect-skin/server/.env` на сервере:

   ```bash
   PS_INDEXING="on"
   PS_PUBLIC_URL="https://perfect-skin.shop"   # без слэша в конце: canonical, sitemap, robots
   ```

   Потом перезапуск: `pm2 restart ps-server --update-env`.

Что меняется: `robots.txt` перестаёт запрещать всё и начинает закрывать только служебные
пути и фильтры; страницы получают `<meta name="robots" content="index,follow">`.

Закрыть обратно — тот же порядок: `default "noindex, nofollow, noarchive";` и `PS_INDEXING="off"`.

Проверка после открытия:

```bash
curl -sI https://perfect-skin.shop/ | grep -i x-robots        # ничего не выведет
curl -s https://perfect-skin.shop/robots.txt | head -3        # нет строки «Disallow: /»
curl -s https://perfect-skin.shop/ | grep -o 'name="robots"[^>]*'   # index,follow
```

Старый способ «удалить строку add_header» больше не нужен: строка осталась в одном месте, а не в пяти.

### 4.5. SEO-выдача для роботов

Сервер подставляет в собранный `index.html` клиента title, description, canonical, Open Graph,
JSON-LD и текст страницы. Шаблон берётся из `PS_CLIENT_INDEX`, по умолчанию
`/var/www/perfect-skin/client/index.html`. Выкатка кладёт туда сборку клиента, поэтому отдельных
действий не нужно. Служебные адреса (`/admin`, `/auth`, `/checkout` и другие) отдаются с noindex.

Снятые с продажи товары из `server/assets/discontinued.json` отдают 410, неизвестные адреса — 404.

---

## 4.1. Телеграм-бот для уведомлений о заявках специалистов

Уведомления о новых заявках специалистов приходят сотрудникам в Telegram.

### Настройка бота

1. **Создать бота в @BotFather:**
   - Напишите `@BotFather` в Telegram
   - `/newbot` → укажите имя и username
   - Скопируйте полученный токен (например, `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

2. **Положить секреты в GitHub:**
   - Перейти в репозиторий → **Settings** → **Secrets and variables** → **Actions**
   - Добавить два секрета:
     - `PS_TG_BOT_TOKEN`: токен от @BotFather
     - `PS_TG_BOT_USERNAME`: username бота (без @)

3. **Настроить сервер (уже в .env из выкатки):**
   - `PS_TG_BOT_TOKEN`: автоматически подтянется из GitHub Secrets при выкатке
   - `PS_TG_BOT_USERNAME`: автоматически подтянется из GitHub Secrets при выкатке
   - `PS_PUBLIC_URL`: базовый URL сайта (например, `https://perfect-skin.shop`) — для ссылок в кнопках

   Если нужно изменить `PS_PUBLIC_URL` после развёртывания:
   ```bash
   ssh root@<IP_СЕРВЕРА>
   nano projects/perfect-skin/server/.env
   # Отредактировать PS_PUBLIC_URL
   cd projects/perfect-skin && pm2 restart ps-server --update-env
   ```

### Привязка сотрудников

1. Открыть админку → вкладка **Заявки специалистов**
2. Блок **Уведомления в Telegram** → кнопка **Подключить Telegram**
3. Скопировать 8-символьный код (действителен 10 минут)
4. Отправить боту команду: `/start КОД` (например, `/start ABCDEFGH`)
5. Бот ответит: «Готово. Сюда будут приходить заявки специалистов»

**Важно:** ПДн не уходят в Telegram. Уведомления содержат только признак приоритета (✓ в реестре или нет), количество заявок в очереди и управляющие кнопки. Скан документа смотрится по одноразовой ссылке с таймаутом 10 минут, никогда не отправляется в чат.

### Что видят сотрудники в Telegram

При новой заявке:
- Тип заявки (найдена в реестре МСП или нет)
- Количество этого ИНН в очереди и одобренных
- Количество всего заявок на проверке
- Кнопка **Открыть** (ссылка на 10 минут)
- Кнопка **Одобрить**
- Кнопка **Отклонить** (запросит причину текстом)
- Кнопка **Админка** (прямо в наш админ-панель)

При решении (одобрении или отказе):
- Сообщение обновляется: «Заявка — одобрена (Имя сотрудника)» или «отклонена»
- Кнопки убираются

---

## 4.2. СДЭК: включение и переключение edu → бой

Интеграция выключена, пока пуст `PS_CDEK_CLIENT_ID`. Выключатель `PS_CDEK=off` срабатывает всегда, даже с ключами: `upsert_env` в деплое пустое значение не записывает, поэтому выключить интеграцию пустым секретом нельзя — ставим `PS_CDEK=off`.

**Секреты GitHub** (Settings → Secrets → Actions): `PS_CDEK_CLIENT_ID`, `PS_CDEK_CLIENT_SECRET`, `PS_CDEK_WEBHOOK_SECRET` (`openssl rand -hex 32`, не короче 32 символов). Для edu и для боя секрет вебхука разный.

**Переменные GitHub** (Variables): `PS_CDEK` (`on`/`off`), `PS_CDEK_BASE_URL`, `PS_CDEK_FROM_CITY_CODE`, `PS_CDEK_FROM_POSTAL_CODE`, `PS_CDEK_FROM_ADDRESS`, `PS_CDEK_SHIPMENT_POINT`, `PS_CDEK_TARIFF_PVZ`, `PS_CDEK_TARIFF_POSTAMAT`, `PS_CDEK_TARIFF_COURIER`, `PS_CDEK_BOX`, `PS_CDEK_BOX_WEIGHT_G`, `PS_CDEK_ITEM_WEIGHT_G`, `PS_CDEK_PAID_DELIVERY`, `PS_CDEK_AUTO_CREATE`, `PS_CDEK_WEBHOOK`, `PS_CDEK_ORDER_PREFIX`. Пустая переменная ничего не меняет на сервере: работает значение по умолчанию из `services/cdek/config.ts`, поэтому выключать значением `off`, а не пустотой.

**Nginx** (один раз, вручную, деплой его не перезаписывает): добавить в `/etc/nginx/sites-available/perfect-skin` блок `location /api/v1/delivery/cdek/webhook/` из `deploy/nginx-perfect-skin.conf`, затем проверить и перезагрузить:
```bash
nginx -t && systemctl reload nginx
```
Выполнить можно через `run-command-perfect-skin.yml`. Вебхук регистрируется у СДЭК только при `PS_CDEK_WEBHOOK=on` и заданном `PS_PUBLIC_URL` (по умолчанию `off`); иначе работает фоновая сверка раз в 20 минут. Включать `PS_CDEK_WEBHOOK=on` только после того, как location вебхука установлен в nginx (блок выше).

**Переключение на бой:** одновременно сменить `PS_CDEK_BASE_URL=https://api.cdek.ru/v2`, боевые `PS_CDEK_CLIENT_ID` и `PS_CDEK_CLIENT_SECRET`, новый `PS_CDEK_WEBHOOK_SECRET` и `PS_CDEK_ORDER_PREFIX` пустым. Переключать только после ответов клиента по договору СДЭК (вопросы А1–А3 в `docs/projects/perfect-skin/client/06-cdek.md`).

**Логи:** адрес вебхука с секретом не пишется в логи приложения (`lib/log-mask.ts`) и в лог доступа Nginx (`access_log off`). Ошибки самого Nginx могут содержать адрес запроса — при инциденте проверять `error.log` вручную.

---

## 5. Обслуживание

### Конфиг Nginx правит certbot — выкатка его не трогает

Осознанное решение, не недоработка. При выпуске сертификата certbot дописывает
в `/etc/nginx/sites-available/perfect-skin` строки про 443-й порт, пути к
сертификату и перенаправление с HTTP. Этих строк в репозитории нет.

Поэтому обычная выкатка **не копирует** конфиг из репозитория: она бы затёрла
правки certbot, и HTTPS отвалился бы при первом же деплое после выпуска
сертификата. Конфиг раскладывает только первичная установка (bootstrap).

Изменили `nginx-perfect-skin.conf` в репозитории — доставка такая:

1. Запустить bootstrap-workflow (он идемпотентен), затем
2. `certbot --nginx -d new.perfect-skin.shop` ещё раз — он вернёт свои строки
   в перезаписанный файл, не перевыпуская сертификат.

Либо, если правка мелкая, внести её на сервере руками через
workflow «Run Command on Perfect Skin VPS» и не забыть повторить в репозитории.

Локации видеоотзывов живут в сниппете `nginx-perfect-skin-media.conf`, который
подключается строкой `include` в обоих server-блоках. Чтобы выложить его на
живой сервер, сначала выкатить код (deploy), затем через «Run Command on Perfect
Skin VPS» запустить `bash projects/perfect-skin/deploy/apply-nginx-media.sh`
(только diff), и ту же команду с `--apply`: бэкап, `nginx -t`, reload, при
ошибке откат из бэкапа. Повтор безопасен.

### Оптовые цены и признак «профессиональный» из прайса

Скрипт `server/prisma/import-prices.ts`, вход — `server/assets/price-import.json`
(записи `name`, `volume`, `wholesaleKopecks`, `retailKopecks`, `isProfessional`).
Сопоставляет с каталогом по названию (точно или по префиксу) и объёму;
несколько кандидатов — в «неоднозначные», ничего не выбирается наугад.
Розничную цену не перезаписывает — расхождения только показывает.

На сервере через workflow «Run Command on Perfect Skin VPS»:

```bash
# сухой прогон — таблица «запись → товар/фасовка → что изменится»
npm run import:prices --workspace=@ps/server
# запись одной транзакцией + пересчёт цен товаров; повторный запуск ничего не меняет
npm run import:prices --workspace=@ps/server -- --apply
# другой входной файл
npm run import:prices --workspace=@ps/server -- --file путь.json --apply
```

Сначала всегда сухой прогон: разобрать несопоставленные и неоднозначные,
поправить JSON, и только затем `--apply`. Флаг `--apply-retail` (только вместе
с `--apply`) дополнительно выставляет розницу из прайса и обнуляет «старую
цену» — решение Гермеса от 22.09: истина — колонка РРЦ прайса, а не сайт.

### Кабинетные товары из прайса

Позиции «только ПРОФ» на сайте отсутствуют, а сид их не знает. Скрипт
`server/prisma/import-pro-products.ts`, данные — `server/assets/pro-products.json`
(24 товара без фото, `images: []` — карточка рисует штатную заглушку; плюс
5 профессиональных фасовок к существующим товарам). Идемпотентен: товар — по
`slug`, фасовка — по `externalId = bmg-<артикул>`; повторный запуск ничего
не меняет. Категорию «Пилинги и эликсиры» создаёт сам, остальные категории и
линии должны существовать.

```bash
npm run import:pro-products --workspace=@ps/server            # сухой прогон
npm run import:pro-products --workspace=@ps/server -- --apply
```

### Состав (INCI)

`server/prisma/import-inci.ts` пишет `products.inciText` из
`docs/projects/perfect-skin/content/inci/isseimi.json` — только позиции с
`clientDecision: "keep"` (проверены клиентом). Пустой состав не ставит и
существующий не стирает; товар из файла, которого нет на сайте, останавливает
`--apply` без записи. Правки клиента к карточкам (активы, удаление пунктов «Как работает», замены фраз) — в
`server/assets/product-details-overrides.json`, их применяет `parse:client-docx`,
на сайт они попадают через `import:content`.

```bash
npm run import:inci --workspace=@ps/server               # сухой прогон
npm run import:inci --workspace=@ps/server -- --apply    # одна транзакция; повтор ничего не меняет
```

### Карточки товаров («Аптечная карта»)

Структурированные описания из файлов клиента лежат в `server/assets/product-details/<slug>.json`
(63 файла; `_pending/` и файлы с `_` в начале не читаются). Скрипт
`server/prisma/import-content.ts` пишет карточку в `products.details` и пересобирает из неё
`description` и `usage`. `inciText` не трогает. Если в карточке нет способа применения, `usage`
в базе остаётся прежним. Превышение лимитов (описание 20000 знаков, применение 10000) останавливает
весь прогон без записи.

```bash
npm run import:content --workspace=@ps/server               # сухой прогон
npm run import:content --workspace=@ps/server -- --apply    # одна транзакция; повтор ничего не меняет
```

Перед `--apply` на живой базе — копия прежних текстов (имя вне маски ротации дампов, не удалится):

```bash
docker compose -f projects/perfect-skin/deploy/docker-compose.prod.yml exec -T postgres \
  psql -U ps -d perfect_skin -c "COPY (SELECT id, slug, name, description, usage, details, \"inciText\" FROM products) TO STDOUT WITH (FORMAT csv, HEADER)" \
  > /var/backups/perfect-skin/products_text_before_content_$(date +%Y%m%d_%H%M%S).csv
```

Откат без перевыкатки: `UPDATE products SET details = NULL` — страница покажет текст из
`description`/`usage`, а он останется таким, каким его собрала карточка. Полный возврат текстов —
из CSV-копии выше (загрузить во временную таблицу и `UPDATE … FROM` по `id`), не из полного дампа:
`pg_restore` сотрёт заказы и заявки, появившиеся после него.

Для товаров с карточкой тексты правятся только во вкладке «Карточка (JSON)» в админке: при
сохранении «Описание» и «Применение» пересобираются из карточки. `bootstrap-perfect-skin.yml`
импортирует карточки только на только что засеянной базе.

Локальный снимок каталога без базы (`client/public/snapshot/catalog.json`) — тем же планом:
`npm run content:snapshot --workspace=@ps/server`.

Все импорты (цены, кабинетные товары, карточки) входят в bootstrap после посева, поэтому установка
с нуля получает тот же каталог, что и прод.

Фото придут от клиента — положить файлы в `client/public/products-optimized/<slug>/`
(card.webp, card@2x.webp, full.webp) и добавить путь в `Product.images`
через админку не получится (загрузки там нет) — только правкой данных.

### Где искать логи

**API:**
```bash
pm2 logs ps-server
```

**Nginx (входящие запросы):**
```bash
tail -f /var/log/nginx/perfect-skin.access.log
tail -f /var/log/nginx/perfect-skin.error.log
```

**Cron-задачи:**
```bash
tail -f /var/log/ps-cleanup.log
```

### Где бэкапы БД

```bash
ls -la /var/backups/perfect-skin/
ps_backup_20260920_143052.dump  # <-- последний бэкап
```

Хранятся последние 10 дампов, остальные автоматически чистятся.

### Восстановление из бэкапа

```bash
# 1. Остановить приложение
pm2 stop ps-server

# 2. Восстановить БД из дампа
pg_restore -U ps -d perfect_skin -c /var/backups/perfect-skin/ps_backup_ХХХ.dump

# 3. Перезагрузить приложение
pm2 restart ps-server
```

### Ежедневная чистка (purge)

Workflow «Perfect Skin — daily purge of expired specialist documents» запускается каждый
день в 02:30 UTC и делает три вещи:

1. **Снимок БД** перед чисткой: `/var/backups/perfect-skin/purge/ps_purge_<дата>.dump`.
   Хранятся 14 последних, файлы старше 14 дней удаляются.
2. **Сканы документов специалистов** удаляются через 30 дней после решения менеджера
   (и сразу у удалённых аккаунтов).
3. **Заявки консультаций и Отдела заботы** (шаг 4 скрипта): заявка без движения 90 дней
   закрывается автоматически со статусом «отменена» и заметкой «Закрыта автоматически».
   Ещё через 90 дней персональные данные стираются: имя, телефон, email, сообщение,
   тип кожи, задача. Связь с аккаунтом снимается. Остаются дата, источник, канал, статус,
   заметка о закрытии и записи о согласиях (с IP-адресом и версией текста).

**Выключить только шаг 3.** В `projects/perfect-skin/server/.env` на сервере добавить строку:

```bash
PS_RETENTION_CONSULTATIONS=off
```

`off` отключает только заявки консультаций и Отдела заботы; сканы документов и остальные
шаги идут как обычно. Любое другое значение или отсутствие строки — шаг включён.
Строка правится на сервере вручную: выкатка её не трогает. Вернуть шаг — удалить строку.

**Сухой прогон** (ничего не пишет, только считает) на сервере:

```bash
cd /var/www/ps-src/projects/perfect-skin/server
set -a; . ./.env; set +a
npm run purge:pro-docs
```

Без `--apply` скрипт печатает, сколько заявок закроется и сколько будет стёрто.

### Команды PM2

```bash
# Статус приложения
pm2 status

# Перезагрузить
pm2 restart ps-server

# Остановить
pm2 stop ps-server

# Запустить
pm2 start ps-server

# Лог последних 100 строк
pm2 logs ps-server --lines 100
```

### Команды Postgres (в контейнере)

```bash
# Подключиться к БД
docker exec -it deploy-postgres-1 psql -U ps -d perfect_skin

# Примеры команд в psql:
\dt                   # список таблиц
SELECT COUNT(*) FROM users;  # количество пользователей
\q                    # выход
```

---

## 5.1. Переименованная миграция и существующие базы

22.09.2026 каталог `17883872961960_add_partners_and_synclog` переименован в
`20260920000001_add_partners_and_synclog`. Он был назван unix-временем в
миллисекундах и поэтому сортировался раньше базовой миграции, создающей
таблицы, которые он изменяет: собрать базу с нуля было невозможно.

Содержимое `migration.sql` не менялось, контрольная сумма Prisma осталась
прежней. Но учётная таблица хранит **имя** каталога, поэтому на любой базе,
где миграция уже применена под старым именем (например, база разработки),
перед первым `prisma migrate deploy` нужно выполнить один раз:

```sql
UPDATE "_prisma_migrations"
SET migration_name = '20260920000001_add_partners_and_synclog'
WHERE migration_name = '17883872961960_add_partners_and_synclog';
```

`UPDATE 1` — готово. `UPDATE 0` — миграция там не применялась, делать ничего
не нужно. Без этого Prisma сочтёт миграцию новой и упадёт на
`relation "partners" already exists`.

Правило на будущее: имя каталога миграции всегда в формате `ГГГГММДДЧЧММСС`.

## 6. Откат выкатки

Если что-то упало, откатиться просто:

### Откат одного коммита

```bash
# На локальной машине
git log deploy/perfect-skin
# Найти коммит, который надо откатить

git revert COMMIT_SHA
git push origin <локальная_ветка>:deploy/perfect-skin
```

Сервер автоматически вытянет новый коммит и перезагрузит приложение.

### Полный откат на версию из бэкапа

```bash
# На сервере
pm2 stop ps-server

# Восстановить БД
pg_restore -U ps -d perfect_skin -c /var/backups/perfect-skin/ps_backup_ХХХ.dump

# Откатить код локально и пушить на deploy/perfect-skin
git reset --hard COMMIT_SHA
git push -f origin COMMIT_SHA:deploy/perfect-skin

# На сервере будет вытянут старый код и перезагружен
```

---

## 7. Переезд на новый сервер (горячая подмена)

Если появится нужда переезжать на новый сервер без простоя:

1. Запустить bootstrap на новом сервере
2. Залить последний бэкап старого сервера в новый:
   ```bash
   pg_restore -U ps -d perfect_skin -c /var/backups/perfect-skin/ps_backup_latest.dump
   ```
3. Обновить DNS на новый IP
4. Выпустить новый сертификат Let's Encrypt на новом сервере
5. Вывести старый из эксплуатации

---

## Готово!

Сайт доступен по адресу: https://new.perfect-skin.shop (тест) или https://perfect-skin.shop (боевой).

При вопросах — смотреть логи PM2 или Nginx, выше в этом файле примеры всех основных команд.
