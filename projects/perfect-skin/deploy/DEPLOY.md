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

### 4.4. Снять защиту от индексации

По SSH:

```bash
ssh root@<IP_СЕРВЕРА>

sudo nano /etc/nginx/sites-available/perfect-skin
# Найти строку: add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
# Удалить её или заменить на: add_header X-Robots-Tag "noindex";  # временно, пока готовим

sudo nginx -t && sudo systemctl reload nginx
```

После индексации основного сайта можно снять и эту строку вообще.

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

Оба импорта входят в bootstrap после посева, поэтому установка с нуля
получает тот же каталог, что и прод.

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
