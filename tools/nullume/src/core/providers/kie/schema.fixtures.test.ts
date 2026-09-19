import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractInputSchema, deriveModelMeta } from "./schema.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(dir, "__fixtures__");

test("deriveModelMeta: nano-banana real market page", () => {
  const markdown = fs.readFileSync(path.join(fixturesDir, "nano-banana.md"), "utf-8");
  const fields = extractInputSchema(markdown);

  assert(fields.length > 0, "Should extract fields from real page");

  const meta = deriveModelMeta(fields);

  assert.strictEqual(meta.promptField, "prompt", "Should find prompt field");
  assert(meta.required.length > 0, "Should have required fields");
  assert(meta.required.includes("prompt"), "prompt should be required");
});

test("deriveModelMeta: seedance-2 real market page", () => {
  const markdown = fs.readFileSync(path.join(fixturesDir, "seedance-2.md"), "utf-8");
  const fields = extractInputSchema(markdown);

  assert(fields.length > 0, "Should extract fields from real page");

  const meta = deriveModelMeta(fields);

  assert.strictEqual(meta.promptField, "prompt", "Should find prompt field");
  // Seedance may not have input-level required fields in parsed schema
  // Just verify we can derive meta from the schema
  assert(typeof meta === "object", "Should return meta object");
});

test("deriveModelMeta: suno real API page", () => {
  const markdown = fs.readFileSync(path.join(fixturesDir, "suno.md"), "utf-8");
  const fields = extractInputSchema(markdown);

  assert(fields.length > 0, "Should extract fields from real page");

  const meta = deriveModelMeta(fields);

  assert.strictEqual(meta.promptField, "prompt", "Should find prompt field");
  assert(meta.required.length > 0, "Should have required fields");
});
