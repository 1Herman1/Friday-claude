import { test } from "node:test";
import assert from "node:assert";
import { MockProvider } from "./index.js";

test("MockProvider balance returns mock data", async () => {
  const provider = new MockProvider();
  const balance = await provider.balance();
  assert.strictEqual(balance.total, 1000);
  assert.strictEqual(balance.used, 0);
});

test("MockProvider create returns taskId", async () => {
  const provider = new MockProvider();
  const result = await provider.create("mock/image", { prompt: "test" });
  assert(result.taskId);
  assert.strictEqual(result.api, "jobs");
});

test("MockProvider status goes pending -> success", async () => {
  const provider = new MockProvider();
  const { taskId } = await provider.create("mock/image", { prompt: "test" });

  const status1 = await provider.status(taskId);
  assert.strictEqual(status1.state, "pending");

  const status2 = await provider.status(taskId);
  assert.strictEqual(status2.state, "success");
  assert(status2.urls.length > 0);
});
