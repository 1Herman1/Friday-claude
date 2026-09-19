#!/usr/bin/env tsx
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stderr, stdout, exit } from "node:process";
import type { CommandFlags } from "./types.js";
import { NullumeError, UsageError } from "../core/errors.js";
import { setGlobalFlags } from "./context.js";
import setupCommand from "./commands/setup.js";
import balanceCommand from "./commands/balance.js";
import modelsCommand from "./commands/models.js";
import catalogCommand from "./commands/catalog.js";
import generateCommand from "./commands/generate.js";
import uploadCommand from "./commands/upload.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(dir, "../..");
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf-8"));

async function main() {
  const program = new Command();

  program
    .name("nullume")
    .version(packageJson.version)
    .description("CLI для генерации медиа через kie.ai")
    .option("--json", "Вывод в JSON")
    .option("--quiet", "Минимальный вывод")
    .hook("preAction", () => {
      const opts = program.opts() as Record<string, unknown>;
      if (opts.json && opts.quiet) {
        throw new UsageError("--json и --quiet не могут использоваться одновременно");
      }
      setGlobalFlags({ json: opts.json as boolean, quiet: opts.quiet as boolean });
    });

  program.addCommand(setupCommand);
  program.addCommand(balanceCommand);
  program.addCommand(modelsCommand);
  program.addCommand(catalogCommand);
  program.addCommand(generateCommand);
  program.addCommand(uploadCommand);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof NullumeError) {
      stderr.write(`Ошибка: ${error.message}\n`);
      const opts = program.opts() as Record<string, unknown>;
      if (opts.json) {
        stdout.write(JSON.stringify({ error: { message: error.message, code: error.name } }, null, 2) + "\n");
      }
      exit(error.exitCode);
    }
    stderr.write(`Неожиданная ошибка: ${(error as Error).message}\n`);
    exit(1);
  }
}

main().catch((error) => {
  stderr.write(`Неожиданная ошибка: ${error.message}\n`);
  exit(1);
});
