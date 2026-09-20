import { test } from "node:test";
import assert from "node:assert";
import { emit, table } from "./output.js";
import type { CommandFlags, EmitPayload } from "./types.js";

test("emit: JSON output", () => {
  const outputs: string[] = [];
  const mockStdout = {
    write: (data: string) => outputs.push(data),
  };

  // Patch stdout
  const originalWrite = process.stdout.write;
  (process.stdout.write as any) = mockStdout.write;

  try {
    const flags: CommandFlags = { json: true };
    const payload: EmitPayload = { data: { key: "value" } };
    emit(flags, payload);

    assert.strictEqual(outputs.length, 1);
    const result = JSON.parse(outputs[0]);
    assert.deepStrictEqual(result, { key: "value" });
  } finally {
    (process.stdout.write as any) = originalWrite;
  }
});

test("emit: human-readable output", () => {
  const outputs: string[] = [];
  const mockStdout = {
    write: (data: string) => outputs.push(data),
  };

  const originalWrite = process.stdout.write;
  (process.stdout.write as any) = mockStdout.write;

  try {
    const flags: CommandFlags = { json: false };
    const payload: EmitPayload = { data: { count: 5 } };
    emit(flags, payload, (data: unknown) => {
      const d = data as { count: number };
      return `Всего: ${d.count}`;
    });

    assert.strictEqual(outputs.length, 1);
    assert(outputs[0].includes("Всего: 5"));
  } finally {
    (process.stdout.write as any) = originalWrite;
  }
});

test("emit: quiet mode", () => {
  const outputs: string[] = [];
  const mockStdout = {
    write: (data: string) => outputs.push(data),
  };

  const originalWrite = process.stdout.write;
  (process.stdout.write as any) = mockStdout.write;

  try {
    const flags: CommandFlags = { quiet: true };
    const payload: EmitPayload = { data: { key: "value" } };
    emit(flags, payload);

    assert.strictEqual(outputs.length, 0);
  } finally {
    (process.stdout.write as any) = originalWrite;
  }
});

test("table: simple table", () => {
  const rows = [
    { id: "1", name: "Alice", age: "30" },
    { id: "2", name: "Bob", age: "25" },
  ];

  const result = table(rows, [
    { key: "id", header: "ID" },
    { key: "name", header: "Name" },
    { key: "age", header: "Age" },
  ]);

  assert(result.includes("ID"));
  assert(result.includes("Name"));
  assert(result.includes("Age"));
  assert(result.includes("Alice"));
  assert(result.includes("Bob"));
});

test("table: empty rows", () => {
  const result = table([], [{ key: "id", header: "ID" }]);
  assert.strictEqual(result, "Нет данных");
});

test("table: with formatter", () => {
  const rows = [{ value: 1000 }];
  const result = table(rows, [
    {
      key: "value",
      header: "Value",
      format: (v: unknown) => `$${v}`,
    },
  ]);

  assert(result.includes("$1000"));
});
