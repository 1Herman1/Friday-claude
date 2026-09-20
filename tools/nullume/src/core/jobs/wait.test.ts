import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Provider, NormalizedStatus } from "../providers/types.js";
import { createJob } from "./model.js";
import { saveJob, loadJob } from "./store.js";
import { waitJob } from "./wait.js";

function withTmpHome<T>(fn: () => Promise<T>): Promise<T> {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-wait-"));
  const prev = process.env.NULLUME_HOME;
  process.env.NULLUME_HOME = tmpdir;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.NULLUME_HOME;
    else process.env.NULLUME_HOME = prev;
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });
}

function stubProvider(statuses: NormalizedStatus[]): Provider {
  let i = 0;
  return {
    name: "mock",
    balance: async () => ({ total: 0, used: 0 }),
    models: async () => [],
    model: async () => {
      throw new Error("not used");
    },
    estimate: async () => null,
    create: async () => ({ taskId: "t", api: "jobs" }),
    status: async () => statuses[Math.min(i++, statuses.length - 1)],
    upload: async () => "",
  } as unknown as Provider;
}

async function seedJob(): Promise<string> {
  const id = randomUUID();
  await saveJob(createJob(id, "mock", "jobs", "task-1", "mock/image", {}));
  return id;
}

test("waitJob: успех возвращает задачу, data:-URL не скачивается", async () => {
  await withTmpHome(async () => {
    const id = await seedJob();
    const provider = stubProvider([
      { state: "pending", urls: [], raw: {} } as NormalizedStatus,
      { state: "success", urls: ["data:image/png;base64,iVBORw0KGgo="], raw: {} } as NormalizedStatus,
    ]);

    const job = await waitJob(provider, id, { timeoutSec: 5, intervalSec: 0.01 });

    assert.strictEqual(job.state, "success");
    assert.deepStrictEqual(job.localPaths, []);
    assert.strictEqual((await loadJob(id)).state, "success");
  });
});

test("waitJob: таймаут бросает ошибку и помечает задачу как fail", async () => {
  await withTmpHome(async () => {
    const id = await seedJob();
    const provider = stubProvider([{ state: "pending", urls: [], raw: {} } as NormalizedStatus]);

    await assert.rejects(
      () => waitJob(provider, id, { timeoutSec: 0.05, intervalSec: 0.01 }),
      /Job timeout/
    );

    const saved = await loadJob(id);
    assert.strictEqual(saved.state, "fail");
    assert.match(saved.failMsg || "", /Timeout/);
  });
});

test(
  "waitJob: провал задачи должен бросать Job failed с failMsg провайдера",
    async () => {
    await withTmpHome(async () => {
      const id = await seedJob();
      const provider = stubProvider([
        { state: "fail", urls: [], failMsg: "провайдер отказал", raw: {} } as NormalizedStatus,
      ]);

      await assert.rejects(
        () => waitJob(provider, id, { timeoutSec: 0.3, intervalSec: 0.01 }),
        /провайдер отказал/
      );

      const saved = await loadJob(id);
      assert.strictEqual(saved.failMsg, "провайдер отказал");
    });
  }
);

test("waitJob: onTick вызывается на каждом опросе", async () => {
  await withTmpHome(async () => {
    const id = await seedJob();
    const seen: string[] = [];
    const provider = stubProvider([
      { state: "pending", urls: [], raw: {} } as NormalizedStatus,
      { state: "pending", urls: [], raw: {} } as NormalizedStatus,
      { state: "success", urls: [], raw: {} } as NormalizedStatus,
    ]);

    await assert.rejects(
      () => waitJob(provider, id, { timeoutSec: 0.15, intervalSec: 0.01, onTick: (j) => seen.push(j.state) }),
      /Job timeout/
    );
    assert(seen.length >= 2, `ожидались тики, получено ${seen.length}`);
  });
});
