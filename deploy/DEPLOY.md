# Деплой Simba на VPS (тест-версия на IP 147.45.157.11)

Разворачиваем закрытую тест-версию: магазин `/`, админка `/admin` (под паролем),
API `/api`. Всё закрыто от поисковиков. HTTPS и домен добавим позже.

Стек: Ubuntu 26.04, Docker (Postgres + MinIO), Fastify под PM2, Nginx.

Все команды выполняешь по SSH на сервере под root (или через `sudo`).
Копируй блоки по одному и присылай мне вывод, если где-то ошибка.

---

## 0. Подключение
```bash
ssh root@147.45.157.11
```

## 1. Базовые пакеты (Node 20, Docker, Nginx, PM2, утилиты)
```bash
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Docker + compose plugin
apt install -y docker.io docker-compose-v2
systemctl enable --now docker

# Nginx + утилита для пароля админки (htpasswd) + git
apt install -y nginx apache2-utils git

# PM2 глобально
npm install -g pm2

# Проверка версий
node -v && docker --version && nginx -v && pm2 -v
```

## 2. Забрать код
```bash
mkdir -p /var/www && cd /var/www
# репозиторий «Пятница»; адрес на GitHub сменится после переименования
git clone https://github.com/1Herman1/project_simba.git simba-src
cd simba-src
git checkout claude/greeting-nnz368
```

## 3. Секреты и .env сервера
```bash
# Сгенерировать два случайных пароля/секрета — СОХРАНИ их себе:
openssl rand -hex 32   # это JWT_SECRET
openssl rand -hex 16   # это пароль БД (POSTGRES_PASSWORD)
openssl rand -hex 16   # это пароль MinIO (MINIO_PASSWORD)

# Создать server/.env из шаблона и отредактировать
cp deploy/env.production.example server/.env
nano server/.env
# Впиши: DATABASE_URL с паролем БД, JWT_SECRET, MINIO_SECRET_KEY,
# и (когда будет почта) SMTP_*. Сохрани Ctrl+O, выход Ctrl+X.
```

## 4. Поднять базу и хранилище (Docker)
```bash
# Экспортировать пароли для compose (те же, что в server/.env)
export POSTGRES_PASSWORD='ПАРОЛЬ_БД'
export MINIO_PASSWORD='ПАРОЛЬ_MINIO'

docker compose -f deploy/docker-compose.prod.yml up -d
docker ps   # имена контейнеров смотреть здесь: на текущем сервере это
            # deploy-postgres-1 и deploy-minio-1 (префикс зависит от того,
            # из какой папки поднимался docker compose)
```

### Пароль хранилища живёт в двух местах и умеет расходиться

`MINIO_PASSWORD` выше уходит контейнеру как `MINIO_ROOT_PASSWORD` — **и нигде
не сохраняется**: ни в файле, ни в GitHub. Сервер берёт тот же пароль из
`server/.env` (`MINIO_SECRET_KEY`). Поменяли одну сторону, забыли вторую —
и загрузка картинок отваливается **молча**: сайт работает, а в логе
`pm2 logs simba-server` появляется

```
The request signature we calculated does not match
```

Слово «signature» здесь и значит «не тот пароль». Ломается при этом не только
перенос фото из МоегоСклада: через то же хранилище идут логотипы брендов,
баннеры, обложки блога и фотографии в отзывах — в админке просто перестают
сохраняться картинки.

Сверка, не раскрывая пароль ни в логах, ни в чате:
```bash
CP=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' deploy-minio-1 \
     | sed -n 's/^MINIO_ROOT_PASSWORD=//p')
EP=$(sed -n 's/^MINIO_SECRET_KEY=//p' server/.env | tr -d '"')
[ "$CP" = "$EP" ] && echo SAME || echo DIFF
```

Разошлись — подгоняем `.env` под контейнер (хранилище и файлы в нём не трогаем):
```bash
cp server/.env server/.env.bak-$(date +%F)     # откат в одну команду
TMP=$(mktemp); umask 077
grep -v '^MINIO_SECRET_KEY=' server/.env > "$TMP"
printf 'MINIO_SECRET_KEY="%s"\n' "$CP" >> "$TMP"
cat "$TMP" > server/.env && rm -f "$TMP"       # cat, а не mv: сохраняем права файла
pm2 reload simba-server --update-env           # .env читает Node при старте процесса
```

Чтобы это не повторялось, тот же пароль заведён в GitHub Secrets как
`MINIO_SECRET_KEY` и переносится в `server/.env` при каждой выкатке. Пока
секрет в GitHub пуст, выкатка печатает «empty in secrets, left as is» и
рабочее значение на сервере не трогает.

## 5. Установить зависимости и собрать
```bash
# Зависимости всех воркспейсов
npm install

# Prisma: сгенерировать клиент и применить схему к БД
cd server
npx prisma generate
npx prisma migrate deploy
cd ..

# Сборка сервера
npm run build --workspace=server

# Сборка фронтов с адресом API (наш IP)
VITE_API_URL=http://147.45.157.11 npm run build --workspace=client
VITE_API_URL=http://147.45.157.11 npm run build --workspace=admin
```

## 6. Разложить статику для Nginx
```bash
mkdir -p /var/www/simba/client /var/www/simba/admin
cp -r client/dist/* /var/www/simba/client/
cp -r admin/dist/*  /var/www/simba/admin/
```

## 7. Запустить сервер под PM2
```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup   # выполни команду, которую он выведет, чтобы автозапуск после ребута
pm2 logs simba-server --lines 20   # проверить что стартовал без ошибок
```

## 8. Настроить Nginx
```bash
# Пароль на админку (замени admin на свой логин, задаст пароль интерактивно)
htpasswd -c /etc/nginx/.htpasswd-simba admin

# Подключить наш конфиг
cp deploy/nginx-simba.conf /etc/nginx/sites-available/simba
ln -sf /etc/nginx/sites-available/simba /etc/nginx/sites-enabled/simba
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
```

## 9. Firewall (закрыть всё лишнее)
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable
ufw status   # 5432/9000 наружу быть НЕ должно (они на 127.0.0.1)
```

## 10. Проверка
```bash
curl -I http://127.0.0.1:3000/api/products/list   # сервер отвечает
curl -I http://147.45.157.11/                      # магазин (200)
curl -I http://147.45.157.11/robots.txt            # Disallow /
```
В браузере:
- `http://147.45.157.11/` — магазин
- `http://147.45.157.11/admin` — спросит логин/пароль (из шага 8)
- Заголовок ответа должен содержать `X-Robots-Tag: noindex` — сайт закрыт от поиска.

---

## Обновление (при новых изменениях в ветке)
```bash
cd /var/www/simba-src
git pull origin claude/greeting-nnz368
npm install                                   # линкует воркспейсы, в т.ч. shared
cd server && npx prisma migrate deploy        # применяет новые миграции
npx prisma generate                           # обязательно: иначе tsc не увидит новые модели
npm run build && cd ..
npm run build --workspace=client
npm run build --workspace=admin
rm -rf /var/www/simba/client/* /var/www/simba/admin/*   # старая сборка остаётся, если не удалить
cp -r client/dist/* /var/www/simba/client/
cp -r admin/dist/*  /var/www/simba/admin/
pm2 reload simba-server
```

Порядок обязателен: **схема → prisma generate → сборка → рестарт**. Наоборот нельзя —
код с новым клиентом на старой базе падает на каждом запросе.

Проверка после обновления:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/products/list   # 200
pm2 logs simba-server --lines 20 --nostream                                          # без ошибок запуска
grep -rl "localhost:3000" /var/www/simba/client /var/www/simba/admin                 # пусто
```

### Адрес API вшивается в сборку
`VITE_API_URL` читается на этапе сборки, не в рантайме. Он лежит в `client/.env` и
`admin/.env` на сервере. Если файла нет, подставится `http://localhost:3000`, сайт
соберётся без ошибок и будет выглядеть рабочим — но браузер посетителя будет стучаться
сам в себя, и вход в админку отвалится с «Ошибка входа». Проверять командой с `grep` выше.

### Разовый переход на миграции (делается один раз)
Если проект ещё жил без папки `prisma/migrations`, сначала убедиться, что боевая
база в точности совпадает со схемой, и только потом регистрировать `0_init`:
```bash
cd /var/www/simba-src/server
set -a; . ./.env; set +a
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```
Ответ должен быть `-- This is an empty migration.` — расхождений нет.
**Если выводится SQL — сначала привести базу в соответствие (см. раздел про миграции
ниже), и только потом:**
```bash
npx prisma migrate resolve --applied 0_init   # база не меняется,только отметка в _prisma_migrations
npx prisma migrate status                      # должно быть «Database schema is up to date»
```
Порядок важен: отметка «применено» без совпадения схемы приведёт к падению следующего
`migrate deploy` на проде.

### Чистка складских позиций, попавших в каталог
```bash
cd /var/www/simba-src/server
npx tsx --env-file=.env src/scripts/cleanup-non-products.ts            # только показать
npx tsx --env-file=.env src/scripts/cleanup-non-products.ts --apply    # удалить
```
Товары, которые уже были в заказах, скрипт не удаляет — только скрывает: история
заказов на них ссылается.

### Синхронизация с МойСклад по расписанию
Ставится ПОСЛЕ того, как ручной прогон отработал верно хотя бы раз.
```bash
crontab -e
```
Строка (каждые 30 минут; первую неделю лучше раз в час — `0 * * * *`):
```
*/30 * * * * cd /var/www/simba-src/server && SYNC_TRIGGER=cron /usr/bin/npx tsx --env-file=.env src/scripts/sync-moysklad.ts --apply >> /var/log/simba-sync.log 2>&1
```
`--force` в расписании НЕ ставить: без него работает защита, которая
останавливает прогон, если разом меняется больше 30% цен.
`SYNC_TRIGGER=cron` помечает прогон в истории как автоматический.

Проверка через час: в админке на главной строка «Цены обновлены N минут назад»,
в разделе «Синхронизация» — записи с пометкой «по расписанию».
Хвост лога: `tail -30 /var/log/simba-sync.log`.

### Чистка гостевых записей по расписанию

Политика конфиденциальности (`client/src/pages/PrivacyPage.tsx`) обещает:
«Гостевые сессии — 30 дней без заказа». Без крона это обещание не выполняется —
скрипт `cleanup-guests.ts` без расписания просто лежит и ничего не делает.
Раздел ниже закрывает разрыв между документом и кодом.

**Отсчёт — от последней активности (`lastSeenAt`), а не от даты создания.**
Гостевой пропуск (JWT) живёт 30 дней, и если человек продолжает заходить —
корзина не должна исчезнуть у него из-под рук только потому, что учётная
запись была заведена больше месяца назад. Удаляются только те гости, кто
не появлялся 30+ дней (либо `lastSeenAt` вовсе пуст — такие есть до выкатки
этой правки, для них берётся `createdAt`).

Ставится ПОСЛЕ того, как ручной прогон отработал верно хотя бы раз — сначала
без `--apply`, посмотреть отчёт, и только потом с ним:
```bash
cd /var/www/simba-src/server
npx tsx --env-file=.env src/scripts/cleanup-guests.ts --days=30            # только показать
npx tsx --env-file=.env src/scripts/cleanup-guests.ts --days=30 --apply    # удалить
```
`--days` принимает 7..365 (по умолчанию 30), значение вне диапазона или
нечисловое — отказ, а не тихая подстановка дефолта.

**Проверка часового пояса — до того, как ставить строку в crontab.** `TZ` в
системе не задан, cron работает по системному времени сервера:
```bash
date; date -u
```
Если `date` (локальное) и `date -u` (UTC) показывают одно и то же — сервер в
UTC, и строка `20 0 * * *` сработает в 03:20 по Москве. Если `date` уже
показывает московское время — писать `20 3 * * *`, иначе чистка уйдёт на
6:20 утра.

```bash
crontab -e
```
Строка (сервер в UTC — 03:20 МСК; если сервер в МСК, заменить `0` на `3`):
```
20 0 * * * cd /var/www/simba-src/server && SYNC_TRIGGER=cron /usr/bin/npx tsx --env-file=.env src/scripts/cleanup-guests.ts --days=30 --apply >> /var/log/simba-cleanup.log 2>&1
```
Минуты `:20`, а не `:00` или `:30`, — намеренно: синхронизация МойСклад ходит
в базу ровно в эти минуты, и незачем нагружать её двумя тяжёлыми запросами
одновременно. `SYNC_TRIGGER=cron` помечает прогон в истории как автоматический
(`source='guest_cleanup'`), так же как у синхронизации МойСклад.

Коды выхода скрипта — по ним видно причину падения в логе, не читая стектрейс:
- `0` — прогон завершился (даже если кандидатов не нашлось);
- `1` — ошибка во время прогона;
- `2` — неверные аргументы (`--days` вне 7..365 или не число);
- `3` — прогон уже идёт (сработает, если ночная чистка почему-то не уложилась
  в минуту — второй cron-тик не запустится поверх первого).

**Ротация логов.** Оба cron-лога (`simba-sync.log`, `simba-cleanup.log`)
растут бесконечно без logrotate — конфиг уже в репозитории:
```bash
cp /var/www/simba-src/deploy/logrotate-simba.conf /etc/logrotate.d/simba
logrotate --debug /etc/logrotate.d/simba   # сухой прогон, файлы не трогает
```
`--debug` только показывает, что логротейт сделал бы — реальную ротацию
проверить раньше недели (`weekly`) не получится, но синтаксис и права на файлы
конфиг проверяет сразу.

Если в выводе `--debug` появится «skipping ... because parent directory has
insecure permissions» — это про сам каталог `/var/log` (он `root:syslog`, открыт
группе на запись), а не про наши файлы. В конфиге на этот случай стоит
`su root syslog`; права каталога менять не нужно. Молчаливый пропуск и есть
опасность: без директивы логи просто не вращаются, а ошибку видно только в
`--debug`.

Проверка через сутки: в админке, на странице «Пользователи», строка
«Последняя чистка» с датой и числом удалённых. Хвост лога:
```bash
tail -30 /var/log/simba-cleanup.log
```
Строка вида «пропущено батчей: N» в отчёте — штатная, не авария: значит, у
кого-то из гостей появился заказ ровно во время ночного прогона (гонка), этот
чанк пропущен целиком без удаления. Запись просто проверится заново следующей
ночью — если заказ и правда есть, предикат чистки её больше не выберет (гость
перестал быть «пустым»), нет заказа — удалится тогда.

### Резервная копия перед изменениями схемы
```bash
docker exec deploy-postgres-1 pg_dump -U simba simba > ~/simba-backup-$(date +%F-%H%M).sql
echo "exit=$?"                                        # обязательно exit=0
tail -1 ~/simba-backup-*.sql                          # «-- PostgreSQL database dump complete»
grep -c "COPY public.orders" ~/simba-backup-*.sql     # 1
grep -c "COPY public.users"  ~/simba-backup-*.sql     # 1
```
Ненулевого размера **недостаточно**: `pg_dump` пишет ошибки в stderr, а в файл уходит
то, что успело выйти. Оборванный дамп весит прилично и выглядит целым. Без всех
четырёх «ок» — не выкатывать.

`pg_dump` в системе не установлен — работать только через контейнер `deploy-postgres-1`.

### Выкатка изменений, затрагивающих деньги (бонусы, цены, остатки)

Обычный порядок из раздела «Обновление» здесь не годится: между `migrate deploy`
и `pm2 reload` в нём стоят три сборки, то есть минуты работы **старого** кода на
**новой** схеме. Для бонусов это означает двойное начисление — старый код начислит
при оформлении, а новый начислит те же бонусы ещё раз при отметке «оплачен».

Правильный порядок:
```bash
cd /var/www/simba-src
git pull origin claude/greeting-nnz368
npm install

# 1. Собрать ВСЁ, не трогая базу. prisma generate читает schema.prisma (файл),
#    в базу не ходит — собирать до миграции безопасно.
cd server && npx prisma generate && npm run build && cd ..
npm run build --workspace=client
npm run build --workspace=admin
rm -rf /var/www/simba/client/* /var/www/simba/admin/*
cp -r client/dist/* /var/www/simba/client/
cp -r admin/dist/*  /var/www/simba/admin/

# 2. Запомнить границу «старый код / новый код»
date -u +'%Y-%m-%d %H:%M:%S'

# 3. Схема и рестарт — одной строкой, зазор в секунды вместо минут
cd server && npx prisma migrate deploy && pm2 reload simba-server && cd ..
```

Затем закрыть остаток окна — заказы, проскочившие на старом коде (бонусы им уже
начислены, а флаг остался `false`). Сначала посмотреть, потом чинить, подставив
время из шага 2:
```sql
SELECT id, "createdAt", "bonusEarned" FROM orders
WHERE "bonusEarnedCredited" = false AND "createdAt" < TIMESTAMP 'ВРЕМЯ_ИЗ_ШАГА_2';

UPDATE orders SET "bonusEarnedCredited" = true
WHERE "bonusEarnedCredited" = false AND "createdAt" < TIMESTAMP 'ВРЕМЯ_ИЗ_ШАГА_2';
```
Условие по `createdAt` обязательно — без него апдейт заденет заказы, оформленные
уже новым кодом, которым начислять положено позже.

После — `VACUUM (ANALYZE) orders;` и сверка: сумма `bonusPoints` по всем
пользователям до и после миграции обязана совпасть, миграция денег не двигает.

**Первые сутки не отмечать оплату и отмены пачками.** Провести один заказ,
проверить баланс покупателя запросом, и только потом работать в обычном режиме:
движения бонусов нигде не журналируются, откатить их нечем — в базе только
текущее число на пользователе.

### Миграции: только migrate deploy, никогда db push
`prisma db push` на проде запрещён: он сравнивает схему целиком, решает сам и может
сделать больше, чем вы ожидаете, без предварительного показа. Если база и схема разошлись
— сначала посмотреть разницу, потом применять:
```bash
cd /var/www/simba-src/server
set -a; . ./.env; set +a
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/drift.sql
cat /tmp/drift.sql                # прочитать глазами: нет ли DROP
docker exec -i deploy-postgres-1 psql -U simba -d simba -v ON_ERROR_STOP=1 -1 < /tmp/drift.sql
```
Флаг `-1` выполняет всё одной транзакцией: при любой ошибке откатится целиком.

## Когда купишь домен simbazoo.ru
1. A-запись домена → 147.45.157.11.
2. В `nginx-simba.conf` добавить `server_name simbazoo.ru;`.
3. `apt install certbot python3-certbot-nginx && certbot --nginx -d simbazoo.ru` — бесплатный HTTPS.
4. Пересобрать фронты с `VITE_API_URL=https://simbazoo.ru`.
5. Снять noindex: убрать `add_header X-Robots-Tag ...` из Nginx, `<meta name="robots">` из client/index.html, и заменить robots.txt на разрешающий + sitemap.
6. Тогда же — подключить Google Search Console и Яндекс.Вебмастер (см. рекомендации SEO).
