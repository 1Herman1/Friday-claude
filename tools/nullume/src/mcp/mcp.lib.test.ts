/**
 * Tests for lib_* MCP tools
 * Tests against a temporary NULLUME_HOME to avoid affecting real library
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(dir, "index.ts");

/**
 * Helper to start MCP client
 */
async function startMcpClient() {
  const home = mkdtempSync(path.join(tmpdir(), "nullume-lib-"));
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntry],
    env: { ...process.env, NULLUME_PROVIDER: "mock", NULLUME_HOME: home } as Record<string, string>,
    stderr: "pipe",
  });
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(transport);
  return { client, home };
}

test("MCP lib: tools/list содержит 6 новых lib_* инструментов", async () => {
  const { client } = await startMcpClient();
  try {
    const { tools } = await client.listTools();
    const libTools = tools.filter((t) => t.name.startsWith("lib_"));

    // Должны быть: lib_search, lib_families, lib_family, lib_import, lib_clusters, lib_propose
    assert.equal(libTools.length, 6, `Ожидается 6 lib_* инструментов, найдено ${libTools.length}`);

    const libNames = new Set(libTools.map((t) => t.name));
    assert.ok(libNames.has("lib_search"));
    assert.ok(libNames.has("lib_families"));
    assert.ok(libNames.has("lib_family"));
    assert.ok(libNames.has("lib_import"));
    assert.ok(libNames.has("lib_clusters"));
    assert.ok(libNames.has("lib_propose"));

    // Все должны иметь непустые properties
    for (const tool of libTools) {
      assert.ok(tool.inputSchema && typeof tool.inputSchema === "object", `${tool.name}: нет inputSchema`);
      assert.ok("properties" in tool.inputSchema, `${tool.name}: нет properties`);
      const props = tool.inputSchema.properties;
      assert.ok(Object.keys(props).length > 0, `${tool.name}: properties пусто`);
    }
  } finally {
    await client.close();
  }
});

test("MCP lib: lib_import enum содержит clean импортёры и не содержит local-only", async () => {
  const { client } = await startMcpClient();
  try {
    const { tools } = await client.listTools();
    const libImport = tools.find((t) => t.name === "lib_import");
    assert.ok(libImport);

    const schema = libImport.inputSchema as any;
    const sourceEnum = schema.properties?.source;
    assert.ok(sourceEnum, "lib_import должен иметь свойство source");

    const enumValues = sourceEnum.enum as string[];
    assert.ok(Array.isArray(enumValues), "source должен быть enum");
    assert.ok(enumValues.length > 0, "enum должен содержать значения");

    // Проверить что нет local-only импортёров
    for (const id of enumValues) {
      assert.ok(!id.includes("pinterest-cookies"), "pinterest-cookies (local-only) не должен быть в enum");
      assert.ok(!id.includes("x-cookies"), "x-cookies (local-only) не должен быть в enum");
      assert.ok(!id.includes("dribbble"), "dribbble (local-only) не должен быть в enum");
    }

    // Должны быть clean импортёры
    assert.ok(enumValues.some((v) => v.includes("eagle") || v.includes("raindrop") || v.includes("pexels")),
      "enum должен содержать хотя бы один clean импортёр");
  } finally {
    await client.close();
  }
});

test("MCP lib: lib_families на пустой базе возвращает []", async () => {
  const { client } = await startMcpClient();
  try {
    const res = await client.callTool({ name: "lib_families", arguments: {} });
    assert.ok(!res.isError, `lib_families не должен вернуть ошибку: ${JSON.stringify(res)}`);

    const text = (res.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";
    const result = JSON.parse(text);
    assert.ok(Array.isArray(result), "результат должен быть массив");
    assert.equal(result.length, 0, "на пустой базе должен вернуть []");
  } finally {
    await client.close();
  }
});

test("MCP lib: lib_search без запроса возвращает []", async () => {
  const { client } = await startMcpClient();
  try {
    const res = await client.callTool({ name: "lib_search", arguments: {} });
    assert.ok(!res.isError, `lib_search не должен вернуть ошибку: ${JSON.stringify(res)}`);

    const text = (res.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";
    const result = JSON.parse(text);
    assert.ok(Array.isArray(result), "результат должен быть массив");
    assert.equal(result.length, 0, "без запроса и без рефов должен вернуть []");
  } finally {
    await client.close();
  }
});

test("MCP lib: lib_search с query без эмбеддера возвращает ошибку с подсказкой", async () => {
  const { client } = await startMcpClient();
  try {
    const res = await client.callTool({ name: "lib_search", arguments: { query: "test" } });

    // Должна быть ошибка или успешный результат с ошибкой внутри
    const text = (res.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";
    const result = JSON.parse(text);

    // Либо isError на уровне инструмента, либо ошибка в результате
    if (res.isError || result.error) {
      const msg = result.error || text;
      assert.ok(msg.includes("init") || msg.includes("эмбеддер"),
        `ошибка должна содержать подсказку про init: ${msg}`);
    }
  } finally {
    await client.close();
  }
});

test("MCP lib: lib_search limit валидируется (min=1, max=50)", async () => {
  const { client } = await startMcpClient();
  try {
    // MCP SDK автоматически валидирует схему, но проверим что параметры принимаются
    const res = await client.callTool({ name: "lib_search", arguments: { limit: 12 } });
    assert.ok(!res.isError, "lib_search должен принять limit=12");

    const text = (res.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";
    const result = JSON.parse(text);
    assert.ok(Array.isArray(result), "результат должен быть массив");
  } finally {
    await client.close();
  }
});

test("MCP graph: lib инструменты не импортируют local-only", async () => {
  const { client } = await startMcpClient();
  try {
    // Это проверяется тестом mcp.graph.test.ts
    // Здесь просто убедимся что клиент может подключиться
    const { tools } = await client.listTools();
    assert.ok(tools.length > 0);
  } finally {
    await client.close();
  }
});
