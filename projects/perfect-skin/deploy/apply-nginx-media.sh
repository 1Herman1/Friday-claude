#!/usr/bin/env bash
# Выкладка медиа-локаций видеоотзывов в живой конфиг nginx Perfect Skin.
# Живой файл содержит HTTPS-блок certbot, поэтому весь файл из репозитория не перезаписываем:
# убираем старую локацию /uploads/video-reviews/ и вставляем include сниппета в каждый server-блок.
# Без аргумента — только diff. С --apply — бэкап, запись, nginx -t, reload; при ошибке откат из бэкапа.
# Скрипт идемпотентен: повторный запуск не дублирует include.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIVE="${PS_NGINX_LIVE:-/etc/nginx/sites-available/perfect-skin}"
SNIPPET="${PS_NGINX_SNIPPET:-/etc/nginx/snippets/perfect-skin-media.conf}"
BACKUP_DIR="${PS_NGINX_BACKUP_DIR:-/var/backups/perfect-skin/nginx}"
NGINX_TEST="${PS_NGINX_TEST:-nginx -t}"
RELOAD="${PS_NGINX_RELOAD:-systemctl reload nginx}"
INCLUDE_LINE="include ${SNIPPET};"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
NEW="$WORK/new.conf"

awk -v inc="$INCLUDE_LINE" '
  skip == 0 && $0 ~ /^[ \t]*# Видеоотзывы: готовые MP4/ { next }
  skip == 0 && $0 ~ /^[ \t]*location \/uploads\/video-reviews\/ \{/ { skip = 1; depth = 0 }
  skip == 1 {
    depth += gsub(/\{/, "{") - gsub(/\}/, "}")
    if (depth <= 0) skip = 0
    next
  }
  index($0, inc) { next }
  { print }
  /^server \{/ { print "    " inc }
' "$LIVE" > "$NEW"

SERVERS="$(grep -c '^server {' "$NEW" || true)"
INCLUDES="$(grep -cF "$INCLUDE_LINE" "$NEW" || true)"
if [ "$SERVERS" -eq 0 ] || [ "$SERVERS" -ne "$INCLUDES" ]; then
  echo "Не сошлось: server-блоков $SERVERS, include $INCLUDES. Файл не тронут."
  exit 1
fi
if grep -q 'location /uploads/video-reviews/ {' "$NEW"; then
  echo "Старая локация осталась в новом файле. Файл не тронут."
  exit 1
fi

echo "==> Изменения в $LIVE (server-блоков: $SERVERS):"
diff -u "$LIVE" "$NEW" || true

if [ "${1:-}" != "--apply" ]; then
  echo "==> Без --apply ничего не записано."
  exit 0
fi

mkdir -p "$BACKUP_DIR" "$(dirname "$SNIPPET")"
BACKUP="$BACKUP_DIR/nginx-perfect-skin.$(date +%Y%m%d_%H%M%S).conf"
cp -a "$LIVE" "$BACKUP"
echo "==> Бэкап: $BACKUP"

install -m 0644 "$REPO_DIR/nginx-perfect-skin-media.conf" "$SNIPPET"
cat "$NEW" > "$LIVE"

restore() {
  echo "==> Откат из $BACKUP"
  cat "$BACKUP" > "$LIVE"
  $NGINX_TEST && $RELOAD
}

$NGINX_TEST || { restore; exit 1; }
$RELOAD || { restore; exit 1; }
echo "==> Готово: nginx перечитан, include подключён в $SERVERS server-блоках"
