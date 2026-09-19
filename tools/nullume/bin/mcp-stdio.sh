#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then
  npm ci || npm install
fi
exec npx tsx src/mcp/index.ts
