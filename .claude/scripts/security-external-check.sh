#!/bin/bash
# Внешняя проверка живого сайта — взгляд глазами злоумышленника.
# Универсален: работает с любым сайтом на любом стеке.
#
#   .claude/scripts/security-external-check.sh example.com
#
# Только чтение: ничего не ломает, ничего не меняет, нагрузки не создаёт.
# Методика — docs/core/security-runtime.md, слой 1.

set -uo pipefail

HOST="${1:-}"
if [ -z "$HOST" ]; then
  echo "Использование: $0 <домен или URL>" >&2
  exit 1
fi

# Принимаем и "example.com", и "https://example.com/"
HOST=$(printf '%s' "$HOST" | sed -E 's#^https?://##; s#/.*$##')
BASE="https://$HOST"
UA="Mozilla/5.0 (compatible; security-check)"
FINDINGS=0
CRIT=0

say()  { printf '%s\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
warn() { printf '  ⚠ %s\n' "$*"; FINDINGS=$((FINDINGS+1)); }
bad()  { printf '  ✗ КРИТИЧНО: %s\n' "$*"; FINDINGS=$((FINDINGS+1)); CRIT=$((CRIT+1)); }

say "════ Внешняя проверка: $HOST ════"
say ""

# ── 1. Доступность ──
CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -A "$UA" "$BASE/" 2>/dev/null || echo "000")
if [ "$CODE" = "000" ]; then
  bad "сайт не отвечает по HTTPS — проверка невозможна"
  exit 1
fi
say "1. Доступность: HTTP $CODE"

# ── 2. Заголовки безопасности ──
say ""
say "2. Заголовки безопасности"
H=$(curl -sSI --max-time 15 -A "$UA" "$BASE/" 2>/dev/null | tr 'A-Z' 'a-z')

check_header() {
  local name="$1" why="$2"
  if printf '%s' "$H" | grep -q "^$name:"; then ok "$name"; else warn "нет $name — $why"; fi
}
check_header "strict-transport-security" "браузер может уйти на http и отдать сессию"
check_header "x-content-type-options"    "браузер угадывает тип файла (риск при загрузках)"
check_header "content-security-policy"   "нет подстраховки от XSS"

if printf '%s' "$H" | grep -qE '^(x-frame-options|content-security-policy:.*frame-ancestors)'; then
  ok "защита от встраивания в iframe"
else
  warn "нет x-frame-options и frame-ancestors — clickjacking"
fi

# ── 3. Утечка версий ──
say ""
say "3. Раскрытие версий"
LEAK=0
for hdr in "server" "x-powered-by" "x-aspnet-version" "x-generator"; do
  V=$(printf '%s' "$H" | grep "^$hdr:" | head -1 | cut -d' ' -f2- | tr -d '\r')
  # Версия = есть цифры в значении
  if [ -n "$V" ] && printf '%s' "$V" | grep -qE '[0-9]+\.[0-9]'; then
    warn "$hdr раскрывает версию: $V"
    LEAK=1
  fi
done
[ "$LEAK" = "0" ] && ok "версии не раскрыты"

# ── 4. Служебные пути ──
say ""
say "4. Служебные файлы и каталоги"
EXPOSED=0
for path in "/.git/HEAD" "/.env" "/.env.local" "/.env.production" "/docker-compose.yml" \
            "/backup.zip" "/backup.sql" "/dump.sql" "/database.sql" "/.DS_Store" \
            "/wp-config.php.bak" "/config.json" "/.htpasswd" "/phpinfo.php"; do
  C=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 -A "$UA" "$BASE$path" 2>/dev/null || echo "000")
  if [ "$C" = "200" ]; then
    bad "доступен $path — через это сливают исходники и секреты"
    EXPOSED=1
  fi
done
[ "$EXPOSED" = "0" ] && ok "служебные пути закрыты"

# ── 5. Листинг директорий ──
say ""
say "5. Листинг директорий"
LIST=0
for d in "/uploads/" "/files/" "/images/" "/static/" "/assets/" "/backup/"; do
  BODY=$(curl -sS --max-time 10 -A "$UA" "$BASE$d" 2>/dev/null | head -c 2000)
  if printf '%s' "$BODY" | grep -qiE '<title>index of|\[to parent directory\]'; then
    warn "листинг открыт: $d"
    LIST=1
  fi
done
[ "$LIST" = "0" ] && ok "листинг закрыт"

# ── 6. Перенаправление с HTTP ──
say ""
say "6. Перенаправление с HTTP на HTTPS"
LOC=$(curl -sSI --max-time 12 -A "$UA" "http://$HOST/" 2>/dev/null | tr 'A-Z' 'a-z' | grep '^location:' | head -1)
if printf '%s' "$LOC" | grep -q 'https://'; then
  ok "http перенаправляется на https"
else
  HC=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 -A "$UA" "http://$HOST/" 2>/dev/null || echo "000")
  if [ "$HC" = "200" ]; then bad "сайт отдаётся по http без перенаправления — сессию можно перехватить"
  else ok "http не обслуживается (код $HC)"; fi
fi

# ── 7. Сертификат ──
say ""
say "7. Сертификат"
END=$(echo | timeout 15 openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$END" ]; then
  END_TS=$(date -d "$END" +%s 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ "$END_TS" -gt 0 ]; then
    DAYS=$(( (END_TS - NOW) / 86400 ))
    if   [ "$DAYS" -lt 0 ];  then bad "сертификат истёк $DAYS дней назад"
    elif [ "$DAYS" -lt 14 ]; then bad "сертификат истекает через $DAYS дней"
    elif [ "$DAYS" -lt 30 ]; then warn "сертификат истекает через $DAYS дней"
    else ok "сертификат действителен ещё $DAYS дней"; fi
  fi
else
  warn "не удалось прочитать сертификат"
fi

# ── 8. Утечки в ошибках ──
say ""
say "8. Страница ошибки"
ERR=$(curl -sS --max-time 12 -A "$UA" "$BASE/этой-страницы-точно-нет-$RANDOM" 2>/dev/null | head -c 4000)
if printf '%s' "$ERR" | grep -qiE 'stack trace|at [a-z]+\.[a-z]+\(|/var/www/|/home/[a-z]+/|sqlstate|syntax error|traceback|\.js:[0-9]+:[0-9]+'; then
  bad "страница ошибки раскрывает внутренности (пути, трассировку, SQL)"
else
  ok "страница ошибки не течёт"
fi

# ── Итог ──
say ""
say "════ Итог ════"
if [ "$FINDINGS" -eq 0 ]; then
  say "Находок нет. Напоминание: это проверка снаружи — она не видит"
  say "внутренности сервера, бизнес-логику и поведение под нагрузкой."
else
  say "Находок: $FINDINGS, из них критичных: $CRIT"
fi
say "Слои 2–5 (сервер изнутри, активные тесты) — docs/core/security-runtime.md"
exit 0
