#!/usr/bin/env node
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(dir, "..");

try {
  execSync(`tsx "${path.join(projectRoot, "src/cli/index.ts")}" ${process.argv.slice(2).join(" ")}`, {
    stdio: "inherit",
    cwd: projectRoot,
  });
} catch (error) {
  process.exit(error?.status ?? 1);
}
