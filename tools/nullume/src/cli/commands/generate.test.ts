import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Mock parseSetOption - inline for testing
function parseSetOption(setStrings: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const item of setStrings) {
    const [key, ...valueParts] = item.split("=");
    if (!key) continue;

    const value = valueParts.join("=");

    if (value.startsWith("@")) {
      // File reference
      const filePath = value.slice(1);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        result[key] = JSON.parse(content);
      } catch (e) {
        throw new Error(`Не удалось прочитать файл ${filePath}: ${(e as Error).message}`);
      }
    } else if (value === "true") {
      result[key] = true;
    } else if (value === "false") {
      result[key] = false;
    } else if (/^\d+$/.test(value)) {
      result[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      result[key] = parseFloat(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

test("parseSetOption: parse integers", () => {
  const result = parseSetOption(["count=5", "timeout=30"]);
  assert.deepStrictEqual(result, { count: 5, timeout: 30 });
});

test("parseSetOption: parse floats", () => {
  const result = parseSetOption(["temperature=0.7", "ratio=1.5"]);
  assert.deepStrictEqual(result, { temperature: 0.7, ratio: 1.5 });
});

test("parseSetOption: parse booleans", () => {
  const result = parseSetOption(["enabled=true", "disabled=false"]);
  assert.deepStrictEqual(result, { enabled: true, disabled: false });
});

test("parseSetOption: parse strings", () => {
  const result = parseSetOption(["name=Alice", "description=hello world"]);
  assert.deepStrictEqual(result, { name: "Alice", description: "hello world" });
});

test("parseSetOption: parse JSON from file", () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const jsonFile = path.join(tmpdir, "config.json");
  fs.writeFileSync(jsonFile, JSON.stringify({ nested: "value" }));

  try {
    const result = parseSetOption([`config=@${jsonFile}`]);
    assert.deepStrictEqual(result, { config: { nested: "value" } });
  } finally {
    fs.rmSync(tmpdir, { recursive: true });
  }
});

test("parseSetOption: mixed types", () => {
  const result = parseSetOption(["count=42", "ratio=0.5", "enabled=true", "name=test"]);
  assert.deepStrictEqual(result, {
    count: 42,
    ratio: 0.5,
    enabled: true,
    name: "test",
  });
});

test("parseSetOption: empty input", () => {
  const result = parseSetOption([]);
  assert.deepStrictEqual(result, {});
});

test("parseSetOption: values with equals sign", () => {
  const result = parseSetOption(["equation=a=b+c"]);
  assert.deepStrictEqual(result, { equation: "a=b+c" });
});
