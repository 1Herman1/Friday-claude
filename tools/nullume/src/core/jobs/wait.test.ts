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
    let callCount = 0;
    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async () => {
        callCount++;
        // Return success after 3 calls to ensure we get ticks
        return { state: callCount >= 3 ? "success" : "pending", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const job = await waitJob(provider, id, { timeoutSec: 10, intervalSec: 0.05, onTick: (j) => seen.push(j.state) });

    assert.strictEqual(job.state, "success");
    assert(seen.length >= 2, `ожидались тики, получено ${seen.length}`);
  });
});

// waitJobs tests
import { waitJobs } from "./wait.js";

test("waitJobs: три задачи разной скорости, одна падает → done 2, failed 1", async () => {
  await withTmpHome(async () => {
    const id1 = await seedJob();
    const id2 = await seedJob();
    const id3 = await seedJob();

    // Update jobs with different taskIds
    const job1 = await loadJob(id1);
    job1.taskId = "task-1";
    await saveJob(job1);

    const job2 = await loadJob(id2);
    job2.taskId = "task-2";
    await saveJob(job2);

    const job3 = await loadJob(id3);
    job3.taskId = "task-3";
    await saveJob(job3);

    const callCounts: Record<string, number> = {};

    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async (taskId: string) => {
        callCounts[taskId] = (callCounts[taskId] || 0) + 1;
        const count = callCounts[taskId];

        // task-1: success on 2nd call
        if (taskId === "task-1") {
          return { state: count >= 2 ? "success" : "pending", urls: [], raw: {} } as NormalizedStatus;
        }
        // task-2: success on 3rd call
        if (taskId === "task-2") {
          return { state: count >= 3 ? "success" : "pending", urls: [], raw: {} } as NormalizedStatus;
        }
        // task-3: fail on first call
        if (taskId === "task-3") {
          return { state: "fail", urls: [], failMsg: "test error", raw: {} } as NormalizedStatus;
        }
        return { state: "pending", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [id1, id2, id3], { timeoutSec: 20, intervalSec: 0.1, concurrency: 2 });

    assert.strictEqual(result.done.length, 2, `ожидали 2 успешных, получили ${result.done.length}`);
    assert.strictEqual(result.failed.length, 1, `ожидали 1 упавшую, получили ${result.failed.length}`);
    assert.strictEqual(result.pending.length, 0, `ожидали 0 в очереди, получили ${result.pending.length}`);
  });
});

test("waitJobs: таймаут - одна задача не успевает → она в pending, остальные завершены", async () => {
  await withTmpHome(async () => {
    const id1 = await seedJob();
    const id2 = await seedJob();

    const job1 = await loadJob(id1);
    job1.taskId = "task-1";
    await saveJob(job1);

    const job2 = await loadJob(id2);
    job2.taskId = "task-2";
    await saveJob(job2);

    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async (taskId: string) => {
        // task-1: success immediately
        if (taskId === "task-1") {
          return { state: "success", urls: [], raw: {} } as NormalizedStatus;
        }
        // task-2: always pending (won't finish before timeout)
        return { state: "pending", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [id1, id2], { timeoutSec: 0.2, intervalSec: 0.05 });

    assert.strictEqual(result.done.length, 1, `ожидали 1 успешную`);
    assert.strictEqual(result.failed.length, 0, `ожидали 0 упавших, pending не должна быть в failed`);
    assert.strictEqual(result.pending.length, 1, `ожидали 1 в очереди`);
  });
});

test("waitJobs: провайдер бросает один раз, потом отвечает → задача завершается", async () => {
  await withTmpHome(async () => {
    const id = await seedJob();

    const job = await loadJob(id);
    job.taskId = "task-1";
    await saveJob(job);

    let callCount = 0;
    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network error");
        }
        return { state: "success", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [id], { timeoutSec: 20, intervalSec: 0.1 });

    assert.strictEqual(result.done.length, 1, `ожидали 1 успешную после retry`);
    assert.strictEqual(result.failed.length, 0);
    assert.strictEqual(result.errors?.[id], undefined, "прошедший сбой не висит ошибкой на готовой задаче");
  });
});

test("waitJobs: провайдер ошибается всегда → задача в ожидании с последней ошибкой, остальные готовы", async () => {
  await withTmpHome(async () => {
    const good = await seedJob();
    const bad = await seedJob();
    for (const [id, task] of [[good, "task-good"], [bad, "task-bad"]] as const) {
      const j = await loadJob(id);
      j.taskId = task;
      await saveJob(j);
    }

    let attempt = 0;
    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async (taskId: string) => {
        if (taskId === "task-bad") throw new Error(`HTTP 502 попытка ${++attempt}`);
        return { state: "success", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [good, bad], { timeoutSec: 0.5, intervalSec: 0.05 });

    assert.deepStrictEqual(result.done.map((j) => j.id), [good]);
    assert.deepStrictEqual(result.pending.map((j) => j.id), [bad], "таймаут не превращает незавершённую в упавшую");
    assert.strictEqual(result.failed.length, 0);
    assert.ok(attempt > 1, "задачу опрашивали повторно");
    assert.strictEqual(result.errors?.[bad], `HTTP 502 попытка ${attempt}`, "в отчёте последняя ошибка, а не первая");
  });
});

test("waitJobs: провайдер ошибка на одной задаче - она остаётся в pending с попыткой retry", async () => {
  await withTmpHome(async () => {
    const id1 = await seedJob();
    const id2 = await seedJob();

    const job1 = await loadJob(id1);
    job1.taskId = "task-1";
    await saveJob(job1);

    const job2 = await loadJob(id2);
    job2.taskId = "task-2";
    await saveJob(job2);

    let call1Count = 0;
    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async (taskId: string) => {
        if (taskId === "task-1") {
          call1Count++;
          // Первый вызов - ошибка, второй - success
          if (call1Count === 1) {
            throw new Error("Provider error");
          }
          return { state: "success", urls: [], raw: {} } as NormalizedStatus;
        }
        return { state: "success", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [id1, id2], { timeoutSec: 5, intervalSec: 0.1, concurrency: 2 });

    assert.strictEqual(result.done.length, 2, `ожидали обе успешные после retry`);
    assert.strictEqual(result.pending.length, 0);
    assert.strictEqual(result.failed.length, 0);
  });
});

test("waitJobs: одновременно в полёте не больше concurrency запросов", async () => {
  await withTmpHome(async () => {
    const jobIds = [await seedJob(), await seedJob(), await seedJob(), await seedJob()];

    // Set unique taskIds
    for (let i = 0; i < jobIds.length; i++) {
      const job = await loadJob(jobIds[i]);
      job.taskId = `task-${i}`;
      await saveJob(job);
    }

    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 5)); // Simulate work
        currentConcurrent--;
        return { state: "success", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    await waitJobs(provider, jobIds, { timeoutSec: 10, intervalSec: 0, concurrency: 2 });

    assert(maxConcurrent <= 2, `ожидали макс 2 одновременных, получили ${maxConcurrent}`);
  });
});

test("waitJobs: несуществующий jobId → failed с причиной, пачка не падает", async () => {
  await withTmpHome(async () => {
    const id1 = await seedJob();
    const invalidId = "00000000-0000-0000-0000-000000000000";

    const job1 = await loadJob(id1);
    job1.taskId = "task-1";
    await saveJob(job1);

    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async () => {
        return { state: "success", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [id1, invalidId], {
      timeoutSec: 5,
      intervalSec: 0.1,
    });

    assert.strictEqual(result.done.length, 1, `ожидали 1 успешную`);
    assert.strictEqual(result.failed.length, 1, `ожидали 1 упавшую (load error)`);
    assert(
      result.failed.some((j) => j.id === invalidId),
      `неправильный id должен быть в failed`
    );
  });
});

test("waitJobs: пустой список → пустой результат", async () => {
  await withTmpHome(async () => {
    const provider = stubProvider([]);

    const result = await waitJobs(provider, [], { timeoutSec: 10 });

    assert.strictEqual(result.done.length, 0);
    assert.strictEqual(result.failed.length, 0);
    assert.strictEqual(result.pending.length, 0);
  });
});

test("waitJobs: уже завершённая задача не опрашивается повторно", async () => {
  await withTmpHome(async () => {
    const id = await seedJob();
    const job = await loadJob(id);
    job.state = "success";
    job.resultUrls = [];
    job.taskId = "task-1";
    await saveJob(job);

    let statusCallCount = 0;
    const provider = {
      name: "mock",
      balance: async () => ({ total: 0, used: 0 }),
      models: async () => [],
      model: async () => {
        throw new Error("not used");
      },
      estimate: async () => null,
      create: async () => ({ taskId: "t", api: "jobs" }),
      status: async () => {
        statusCallCount++;
        return { state: "pending", urls: [], raw: {} } as NormalizedStatus;
      },
      upload: async () => "",
    } as unknown as Provider;

    const result = await waitJobs(provider, [id], { timeoutSec: 0.1, intervalSec: 0.01 });

    assert.strictEqual(
      statusCallCount,
      0,
      `завершённая задача не должна опрашиваться (status не вызывалась)`
    );
    assert.strictEqual(result.done.length, 1, `завершённая задача должна быть в done`);
  });
});

