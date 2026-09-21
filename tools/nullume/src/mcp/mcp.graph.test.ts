import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

/**
 * Проверить граф импортов: MCP не должен импортировать local-only импортёры
 * или src/library/sessions.ts
 */
test("MCP граф: no imports from local-only sources", async () => {
  const mcpDir = path.join(projectRoot, "src/mcp");

  // Рекурсивно собрать все .ts файлы кроме .test.ts
  const tsFiles: string[] = [];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        tsFiles.push(fullPath);
      }
    }
  }

  walkDir(mcpDir);

  assert.ok(tsFiles.length > 0, "Должны быть .ts файлы в src/mcp/");

  // Регулярное выражение для поиска импортов
  const importRegex = /import\s+[^;]*\s+from\s+["']([^"']+)["']/g;
  const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

  const forbiddenPaths = [
    "library/importers/local",
    "library/sessions",
    "library/importers/gate",
  ];

  const violations: string[] = [];

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, "utf-8");

    // Найти статические импорты
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Разрешить только абсолютные пути (на '..') и стандартные пакеты
      if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
        continue; // это пакет
      }

      for (const forbidden of forbiddenPaths) {
        if (importPath.includes(forbidden)) {
          violations.push(
            `${path.relative(projectRoot, file)}: импорт запрещённого модуля "${importPath}"`
          );
        }
      }
    }

    // Найти динамические импорты
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
        continue;
      }

      for (const forbidden of forbiddenPaths) {
        if (importPath.includes(forbidden)) {
          violations.push(
            `${path.relative(projectRoot, file)}: динамический импорт запрещённого модуля "${importPath}"`
          );
        }
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Граф импортов MCP нарушен:\n${violations.join("\n")}\n\n` +
      `Local-only импортёры и sessions.ts не должны быть доступны в MCP.`
  );
});
