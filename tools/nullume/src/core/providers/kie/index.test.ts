import { test } from "node:test";
import assert from "node:assert/strict";
import { KieProvider } from "./index.js";
import { KieClient } from "./client.js";

/**
 * Провайдер с настоящим клиентом и подменённой сетью. Прежний тест подделывал
 * сам клиент и закрепил неверный контракт ({ code, data } вместо числа) —
 * поэтому был зелёным, пока живой kie падал.
 */
function providerAnswering(body: unknown): KieProvider {
  const p = new KieProvider("test-key");
  const fetchImpl = (async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as never;
  // @ts-expect-error — подмена приватного клиента в тесте
  p.client = new KieClient("test-key", "https://api.kie.ai", fetchImpl);
  return p;
}

test("balance: ответ по документации kie { code: 200, data: 100 }", async () => {
  assert.deepEqual(await providerAnswering({ code: 200, msg: "success", data: 100 }).balance(), { total: 100 });
});

test("balance: ноль кредитов — честный ноль (0 ложен, конверт не должен путать разбор)", async () => {
  assert.deepEqual(await providerAnswering({ code: 200, msg: "success", data: 0 }).balance(), { total: 0 });
});

test("balance: код ошибки — ошибка, а не ноль", async () => {
  await assert.rejects(() => providerAnswering({ code: 401, msg: "Unauthorized" }).balance(), /Unauthorized/);
});

test("balance: неожиданный вид data — ошибка, а не выдуманный ноль", async () => {
  for (const data of [{ total: 76 }, "100"]) {
    await assert.rejects(() => providerAnswering({ code: 200, data }).balance(), /неожиданном виде/, JSON.stringify(data));
  }
});
