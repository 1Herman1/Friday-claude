// Смоук MCP-сервера через официальный клиент SDK: поднимает сервер как
// дочерний процесс на mock-провайдере, проверяет список инструментов и одну
// генерацию. Ручные pipe-тесты ловили гонку на старте — клиент SDK ждёт
// рукопожатия сам.
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

test("MCP: tools/list отдаёт 9 инструментов со схемами, generate работает на mock", async () => {
  const home = mkdtempSync(path.join(tmpdir(), "nullume-mcp-"));
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverEntry],
    env: { ...process.env, NULLUME_PROVIDER: "mock", NULLUME_HOME: home } as Record<string, string>,
    stderr: "pipe",
  });
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 9);
    for (const tool of tools) {
      assert.ok(tool.inputSchema && typeof tool.inputSchema === "object", `${tool.name}: нет inputSchema`);
      assert.ok("properties" in tool.inputSchema, `${tool.name}: нет properties`);
    }
    const res = await client.callTool({ name: "generate", arguments: { model: "mock/image", prompt: "test", out_dir: home } });
    const text = (res.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";
    const job = JSON.parse(text);
    assert.ok(!res.isError, text);
    assert.ok(job.job_id ?? job.id, "нет id задачи");
  } finally {
    await client.close();
  }
});
