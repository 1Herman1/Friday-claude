#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Имя ветки читаем из файла активного проекта, а не зашиваем: хук приходит из
# общей базы во все репозитории, и зашитая ветка Симбы уводила бы чужие проекты
# не туда. Активный проект — единственная папка в docs/projects, кроме _template.
PROJECTS=$(find docs/projects -mindepth 2 -maxdepth 2 -name project.md -not -path '*/_template/*' 2>/dev/null)
COUNT=$(printf '%s\n' "$PROJECTS" | grep -c . || true)

# Проектов должно быть ровно столько же, сколько репозиториев — один. Если их
# несколько, угадывать нельзя: не тот выбор переключит рабочую ветку вслепую.
if [ "$COUNT" -ne 1 ]; then
  echo "session-start: в docs/projects найден не один проект ($COUNT) — переключение пропущено" >&2
  exit 0
fi

BRANCH=$(sed -n 's/^Ветка: `\(.*\)`.*/\1/p' "$PROJECTS" 2>/dev/null | head -1)

# Без ветки в доках лучше не трогать репозиторий: молча переключиться «куда-то»
# хуже, чем не переключиться вовсе.
if [ -z "$BRANCH" ]; then
  echo "session-start: рабочая ветка не найдена в $PROJECTS — переключение пропущено" >&2
  exit 0
fi

CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" != "$BRANCH" ]; then
  git checkout "$BRANCH"
fi

git pull origin "$BRANCH" --ff-only 2>/dev/null || true

# MCP-сервер иконок лежит вне npm workspaces, поэтому корневой npm install его
# зависимости не ставит. В свежем контейнере он падал с ERR_MODULE_NOT_FOUND, и
# Claude Code показывал его как «сервер не подключился».
if [ -f tools/icon-mcp-server/package.json ] && [ ! -d tools/icon-mcp-server/node_modules ]; then
  (cd tools/icon-mcp-server && npm install --no-audit --no-fund >/dev/null 2>&1) \
    || echo "session-start: не удалось поставить зависимости icon-mcp-server" >&2
fi

# Память прошлых сессий: stdout SessionStart попадает прямо в контекст Claude.
"$CLAUDE_PROJECT_DIR/.claude/scripts/archive-read.sh" 2>/dev/null || true
