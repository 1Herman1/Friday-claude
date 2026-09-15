#!/bin/bash
# Проверка переносимости агентов безопасности: не просочилась ли специфика
# стека в определения, которые должны работать в любом проекте.
#
#   .claude/scripts/security-portability-check.sh
#
# Появился потому, что разовый греп «на глаз» пропустил целый блок привязки:
# проверка была регистрозависимой и по слишком узкому шаблону. Тот же принцип,
# что у design-lint.mjs — детерминированная проверка вместо внимательности.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 1

# Маркеры стека: фреймворки, ORM, хранилища, хостинги, пути воркспейсов.
# Регистронезависимо и широко — лучше ложное срабатывание, чем пропуск.
MARKERS='fastify|prisma|minio|timeweb|vercel|supabase|nextauth|next\.js|nginx|pm2|docker-compose|postgres|mysql|mongodb|redis|nodemailer|wordpress|wp-config|laravel|django|codeigniter|sentry|axiom|server/|client/|admin/'

# `.env` намеренно не в маркерах: это межстековое соглашение (Node, Python,
# PHP, Ruby), а не привязка к конкретному проекту.

# Что разрешено: примеры в кавычках-ёлочках и упоминания в контексте «профиль».
ALLOW='security-profile|профил|_template|<проект>|например|<путь>|<напр'

FOUND=0
echo "═══ Переносимость агентов безопасности ═══"
echo

for f in .claude/agents/security-*.md .claude/commands/secure.md .claude/commands/security-profile.md \
         docs/core/anti-patterns/security.md docs/core/security-runtime.md; do
  [ -f "$f" ] || continue
  HITS=$(grep -inE "$MARKERS" "$f" 2>/dev/null | grep -viE "$ALLOW" || true)
  if [ -n "$HITS" ]; then
    echo "✗ $f"
    printf '%s\n' "$HITS" | sed 's/^/    /' | cut -c1-120
    FOUND=$((FOUND + $(printf '%s\n' "$HITS" | grep -c .)))
    echo
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "✓ Привязок к стеку не найдено — агенты переносятся в любой проект."
  echo "  Специфика должна жить в docs/projects/<проект>/security-profile.md"
  exit 0
fi

echo "─────────────────────────────────────────"
echo "Найдено привязок: $FOUND"
echo "Специфика стека должна быть в профиле проекта, а не в определении агента."
exit 1
