#!/bin/bash
# Старт сессии: подать память прошлых сессий и переключиться на рабочую ветку.
#
# Порядок важен. Память идёт ПЕРВОЙ и не зависит ни от чего: раньше её вызов
# стоял в конце, после цепочки ранних выходов, и не выполнялся никогда —
# проектов в docs/projects оказалось четыре вместо ожидаемого одного, хук
# выходил на первой же проверке, а память молча не загружалась.

set -uo pipefail
cd "$CLAUDE_PROJECT_DIR" || exit 0

# ── 1. Память прошлых сессий. Первым делом, что бы дальше ни случилось. ──
"$CLAUDE_PROJECT_DIR/.claude/scripts/archive-read.sh" 2>/dev/null || true

# ── 2. Рабочая ветка активного проекта ──
# Активный проект задан строкой в CLAUDE.md, а не единственностью каталога:
# проектов в репозитории несколько, и так будет дальше.
ACTIVE=$(sed -n 's/.*\*\*Активный проект:[^*]*\*\*[^`]*`docs\/projects\/\([a-z0-9_-]*\)\/.*/\1/p' CLAUDE.md 2>/dev/null | head -1)

if [ -z "$ACTIVE" ]; then
  echo "session-start: активный проект не указан в CLAUDE.md — переключение пропущено" >&2
  exit 0
fi

PROJECT_FILE="docs/projects/$ACTIVE/project.md"
if [ ! -f "$PROJECT_FILE" ]; then
  echo "session-start: $PROJECT_FILE не найден — переключение пропущено" >&2
  exit 0
fi

# Формулировка ветки в проектах разная («Ветка: `x`» и «работа ведётся ТОЛЬКО
# в одной ветке: `x`»). Регистр кириллицы grep -i в этой локали не складывает,
# поэтому класс задан явно. Отбрасываем всё, что похоже на имя файла или на
# команду, — остаётся имя ветки.
BRANCH=$(grep '[Вв]етк' "$PROJECT_FILE" 2>/dev/null \
         | grep -oP '`\K[^`]+' \
         | grep -vE '\.(md|sh|json|ts|js)$|^git |^[A-Z]+\.md$' \
         | head -1)

if [ -z "$BRANCH" ]; then
  echo "session-start: рабочая ветка не найдена в $PROJECT_FILE — переключение пропущено" >&2
  exit 0
fi

CURRENT=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "$BRANCH" ]; then
  git checkout "$BRANCH" 2>/dev/null || \
    echo "session-start: не удалось переключиться на $BRANCH (текущая: $CURRENT)" >&2
fi

git pull origin "$BRANCH" --ff-only 2>/dev/null || true
