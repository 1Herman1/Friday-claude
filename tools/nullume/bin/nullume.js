#!/usr/bin/env node
// Аргументы передаются массивом, без шелла: промпт — произвольный текст
// пользователя, и сборка строки для sh -c превращала его в инъекцию команд.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(dir, "..");
const tsx = path.join(projectRoot, "node_modules", ".bin", "tsx");

const result = spawnSync(tsx, [path.join(projectRoot, "src/cli/index.ts"), ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});
process.exit(result.status ?? 1);
