import { test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const commandsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "commands");

/**
 * commander кладёт --skip-models в options.skipModels, а не в options["skip-models"].
 * Обращение по имени с дефисом всегда даёт undefined, и флаг молча не работает:
 * так однажды перестали действовать --dry-run, --skip-models и таймауты ожидания.
 */
test("опции читаются в camelCase, а не по имени с дефисом", () => {
  const offenders: string[] = [];

  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".ts") || file.includes(".test.")) continue;
    const source = fs.readFileSync(path.join(commandsDir, file), "utf-8");
    source.split("\n").forEach((line, i) => {
      if (/options\["[a-z]+(-[a-z]+)+"\]/.test(line)) {
        offenders.push(`${file}:${i + 1} — ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(offenders, [], `Читайте опции в camelCase:\n${offenders.join("\n")}`);
});
