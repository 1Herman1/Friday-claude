#!/usr/bin/env node
// Аргументы передаются массивом, без шелла: промпт — произвольный текст
// пользователя, и сборка строки для sh -c превращала его в инъекцию команд.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(dir, "..");

// Check if dist exists (npm installed) or use tsx for development
const distPath = path.join(projectRoot, "dist/cli/index.js");
const hasBuilt = fs.existsSync(distPath);

let cmd;
let args;

if (hasBuilt) {
  // Use node with built dist
  cmd = process.execPath;
  args = [distPath, ...process.argv.slice(2)];
} else {
  // Use tsx for development
  const tsx = path.join(projectRoot, "node_modules", ".bin", "tsx");
  cmd = tsx;
  args = [path.join(projectRoot, "src/cli/index.ts"), ...process.argv.slice(2)];
}

// Добавить NODE_OPTIONS для подавления экспериментальных предупреждений
const nodeOptions = process.env.NODE_OPTIONS || "";
const newNodeOptions = nodeOptions
  .split(" ")
  .filter((opt) => opt.trim())
  .concat("--no-warnings=ExperimentalWarning")
  .join(" ");

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  cwd: process.cwd(),
  env: { ...process.env, NODE_OPTIONS: newNodeOptions },
});
process.exit(result.status ?? 1);
