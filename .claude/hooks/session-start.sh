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
# Активный проект задан файлом docs/projects/.active, а не единственностью
# каталога: проектов в репозитории несколько, и так будет дальше. Тот же файл
# читает design-lint.mjs — источник истины один.
ACTIVE=$(head -1 docs/projects/.active 2>/dev/null | tr -d '[:space:]')

if [ -z "$ACTIVE" ]; then
  echo "session-start: docs/projects/.active пуст или отсутствует — переключение пропущено" >&2
  exit 0
fi

PROJECT_FILE="docs/projects/$ACTIVE/project.md"
if [ ! -f "$PROJECT_FILE" ]; then
  echo "session-start: $PROJECT_FILE не найден — переключение пропущено" >&2
  exit 0
fi

# Рабочая ветка одна на репозиторий, поэтому основной источник — реестр
# проектов. В project.md она лежала во всех четырёх копиях; чтение оттуда
# оставлено запасным путём, чтобы старый проект не остался без ветки.
BRANCH=$(grep -oP 'Рабочая ветка: *`\K[^`]+' docs/projects/README.md 2>/dev/null | head -1)

# Запасной путь. Формулировка в проектах разная («Ветка: `x`» и «работа
# ведётся ТОЛЬКО в одной ветке: `x`»). Регистр кириллицы grep -i в этой локали
# не складывает, поэтому класс задан явно. Отбрасываем всё, что похоже на имя
# файла или на команду, — остаётся имя ветки.
if [ -z "$BRANCH" ]; then
  BRANCH=$(grep '[Вв]етк' "$PROJECT_FILE" 2>/dev/null \
           | grep -oP '`\K[^`]+' \
           | grep -vE '\.(md|sh|json|ts|js)$|^git |^[A-Z]+\.md$' \
           | head -1)
fi

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

# ── 2а. Сторож одной ветки ──────────────────────────────────────────────────
# Среда выдаёт каждому чату свою ветку claude/<имя>; писать в неё нельзя.
# Удалять ветки из среды запрещено (403), поэтому хук только перечисляет
# лишние — удаляет Гермес в GitHub. Ветки выкатки берём из таблицы реестра.
NOW=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -n "$NOW" ] && [ "$NOW" != "$BRANCH" ]; then
  echo "session-start: ВНИМАНИЕ — текущая ветка $NOW, рабочая $BRANCH. Переключись перед любой правкой." >&2
fi
DEPLOY_BRANCHES=$(grep -oP '^\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*`\K[^`]+' docs/projects/README.md 2>/dev/null | paste -sd'|' -)
EXTRA=$(git ls-remote --heads origin 2>/dev/null | awk '{print $2}' | sed 's|refs/heads/||' \
        | grep -vxF "$BRANCH" | grep -vE "^(${DEPLOY_BRANCHES:-__none__})$" | paste -sd' ' -)
if [ -n "$EXTRA" ]; then
  echo "session-start: лишние ветки на GitHub (удалить в интерфейсе GitHub, из среды нельзя): $EXTRA" >&2
fi

# ── 3. Установка зависимостей в tools/* ────────────────────────────────────
# Каждый инструмент в tools/ может иметь свой package.json (вне npm workspaces).
# Если node_modules отсутствуют, устанавливаем зависимости. История: блок был
# в коммите e0b5a88, удалён в последующих ревизиях, и из-за этого icon-library
# MCP-сервер падал с CONNECTION_CLOSED. Без установки зависимостей новые серверы
# (например, nullume) также не будут запускаться.

for tool_dir in tools/*/; do
  [ -d "$tool_dir" ] || continue
  [ -f "$tool_dir/package.json" ] || continue
  [ -d "$tool_dir/node_modules" ] && continue

  if [ -f "$tool_dir/package-lock.json" ]; then
    npm ci --no-audit --no-fund -C "$tool_dir" 2>&1 >&2 || true
  else
    npm install --no-audit --no-fund -C "$tool_dir" 2>&1 >&2 || true
  fi
done

exit 0
