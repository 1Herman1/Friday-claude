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

test("balance: нормальный ответ читается как есть", async () => {
  const p = providerWithCredits({ code: 200, data: { total: 76, used: 4 } });
  assert.deepEqual(await p.balance(), { total: 76, used: 4 });
});

test("balance: код ошибки не превращается в ноль кредитов", async () => {
  const p = providerWithCredits({ code: 401, msg: "Unauthorized" });
  await assert.rejects(() => p.balance(), (e: Error) => /401/.test(e.message));
});

test("balance: ответ без total — ошибка, а не ноль", async () => {
  const p = providerWithCredits({ code: 200, data: {} });
  await assert.rejects(() => p.balance(), (e: Error) => /total/.test(e.message));
});
