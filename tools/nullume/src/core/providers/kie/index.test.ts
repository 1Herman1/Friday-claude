import { test } from "node:test";
import assert from "node:assert/strict";
import { KieProvider } from "./index.js";

/** Провайдер с подменённым клиентом: нас интересует только чтение баланса */
function providerWithCredits(resp: unknown): KieProvider {
  const p = new KieProvider("test-key");
  // @ts-expect-error — подмена приватного клиента в тесте
  p.client = { credits: async () => resp };
  return p;
}

test("balance: ответ по документации kie — data числом", async () => {
  const p = providerWithCredits({ code: 200, msg: "success", data: 100 });
  assert.deepEqual(await p.balance(), { total: 100 });
});

test("balance: ноль кредитов — честный ноль, а не ошибка", async () => {
  const p = providerWithCredits({ code: 200, msg: "success", data: 0 });
  assert.deepEqual(await p.balance(), { total: 0 });
});

test("balance: код ошибки не превращается в ноль кредитов", async () => {
  const p = providerWithCredits({ code: 401, msg: "Unauthorized" });
  await assert.rejects(() => p.balance(), (e: Error) => /401/.test(e.message));
});

test("balance: неожиданный вид data — ошибка, а не выдуманный ноль", async () => {
  for (const data of [{ total: 76 }, "100", null, undefined]) {
    const p = providerWithCredits({ code: 200, data });
    await assert.rejects(() => p.balance(), /неожиданном виде/, JSON.stringify(data));
  }
});
