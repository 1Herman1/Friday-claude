#!/bin/bash
# Сторож переносимости универсальной базы.
#
#   .claude/scripts/portability-check.sh
#
# Проекты в этом репозитории равноправны, поэтому универсальная часть —
# CLAUDE.md, docs/core/, агенты, команды, воркфлоу — не должна знать ни одного
# проекта по имени и ни одного его каталога по пути. Специфика живёт в
# docs/projects/<проект>/.
#
# Появился после того, как разовый греп «на глаз» пропустил целый блок
# привязки: проверка была регистрозависимой и по слишком узкому шаблону.
# Принцип тот же, что у design-lint.mjs — детерминированная проверка вместо
# внимательности. Предшественник (security-portability-check.sh) смотрел только
# на агентов безопасности, да ещё и по устаревшей маске путей: после
# перегруппировки агентов по департаментам он рапортовал «чисто», проверив ноль
# файлов. Зелёная галочка, которая ничего не проверяет, хуже её отсутствия.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 1

# ── Имена проектов берутся с диска, а не зашиваются ──────────────────────────
# Поэтому скрипт переносится в новый репозиторий без правок.
PROJECT_NAMES=$(find docs/projects -maxdepth 1 -mindepth 1 -type d -printf '%f\n' 2>/dev/null \
                | grep -v '^_template$' | paste -sd'|' -)
[ -z "$PROJECT_NAMES" ] && PROJECT_NAMES='__нет_проектов__'

# Корни кода проектов — каталоги верхнего уровня, не входящие в служебные.
CODE_ROOTS=$(find . -maxdepth 1 -mindepth 1 -type d -printf '%f\n' 2>/dev/null \
             | grep -vE '^(\.git|\.claude|\.github|docs|node_modules|\..*)$' \
             | sed 's|$|/|' | paste -sd'|' -)
[ -z "$CODE_ROOTS" ] && CODE_ROOTS='__нет_каталогов__'

# Маркеры стека: фреймворки, ORM, хранилища, хостинги.
STACK='fastify|prisma|minio|timeweb|vercel|supabase|nextauth|nginx|pm2|docker-compose|postgres|mysql|mongodb|redis|nodemailer|wordpress|laravel|django'

# Два разных греха, и смешивать их нельзя.
#
#   ПРИВЯЗКА К ПРОЕКТУ — имя проекта или корень его кода. Дефект всегда и
#   везде: универсальный файл не вправе знать, что проект зовут «simba», а его
#   фронтенд лежит в `client/`.
#
#   МАРКЕР СТЕКА — Prisma, Fastify и прочее. Дефект только в определении
#   агента: агент обязан работать на любом стеке. В `docs/core/stack.md`,
#   `rules*` и `anti-patterns/*` стек назван по прямому назначению файла —
#   это дефолт для новых проектов, а не привязка.
PROJECT_COUPLING="$PROJECT_NAMES|$CODE_ROOTS"

# Что разрешено. Главное — контекст «это пример» и «это профиль проекта»:
# универсальный файл вправе СОСЛАТЬСЯ на проектный, но не вправе его заменять.
ALLOW='docs/projects|project\.md|brand\.md|security-profile|\.active|_template|<проект>|<активный|<имя>|<путь>|например|напр\.|пример|по умолчанию|стек по умолчанию'

# Файлы универсальной базы. Шаблоны кода исключены намеренно: в них живой
# импорт библиотеки, это эталон для копирования, а не правило.
FILES=$( { echo CLAUDE.md
           find docs/core -name '*.md' -not -path 'docs/core/templates/*' 2>/dev/null
           find .claude/agents .claude/commands .claude/workflows -name '*.md' \
                -not -name 'README.md' 2>/dev/null
         } | sort -u )

FOUND=0
FILES_HIT=0
echo "═══ Переносимость универсальной базы ═══"
echo "Проекты на диске: ${PROJECT_NAMES//|/, }"
echo

for f in $FILES; do
  [ -f "$f" ] || continue

  PATTERN="$PROJECT_COUPLING"
  # Маркеры стека спрашиваем только с агентов и команд — они переносимые.
  case "$f" in
    .claude/*) PATTERN="$PROJECT_COUPLING|$STACK" ;;
  esac

  # Корень кода засчитывается, только когда он начинает путь: `client/...`,
  # но не `.claude/scripts/...`, где совпал бы каталог `scripts/`.
  HITS=$(grep -inP "(?i)(?<![\w./-])($PATTERN)" "$f" 2>/dev/null | grep -viE "$ALLOW" || true)
  [ -z "$HITS" ] && continue
  N=$(printf '%s\n' "$HITS" | grep -c .)
  echo "✗ $f  ($N)"
  printf '%s\n' "$HITS" | head -4 | cut -c1-110 | sed 's/^/    /'
  [ "$N" -gt 4 ] && echo "    … ещё $((N - 4))"
  echo
  FOUND=$((FOUND + N))
  FILES_HIT=$((FILES_HIT + 1))
done

if [ "$FOUND" -eq 0 ]; then
  echo "✓ Привязок к конкретному проекту не найдено."
  echo "  Универсальная база переносится в новый репозиторий как есть."
  exit 0
fi

echo "─────────────────────────────────────────"
echo "Привязок: $FOUND в $FILES_HIT файлах."
echo "Специфика проекта должна жить в docs/projects/<проект>/, а не в"
echo "универсальной базе. Если упоминание намеренное — оформи его как пример"
echo "или ссылку на проектный файл."
exit 1
