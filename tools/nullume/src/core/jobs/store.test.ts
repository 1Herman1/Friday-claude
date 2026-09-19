import { test } from "node:test";
import assert from "node:assert";
import { saveJob, loadJob, listJobs } from "./store.js";
import { createJob } from "./model.js";

test("saveJob and loadJob roundtrip", async () => {
  const job = createJob("test-id", "kie", "jobs", "task-1", "nano-banana-2", {
    prompt: "test",
  });

  await saveJob(job);
  const loaded = await loadJob("test-id");

  assert.strictEqual(loaded.id, "test-id");
  assert.strictEqual(loaded.state, "pending");
  assert.strictEqual(loaded.taskId, "task-1");
});

test("listJobs returns recent jobs first", async () => {
  const job1 = createJob("job-1", "kie", "jobs", "t1", "m1", {});
  const job2 = createJob("job-2", "kie", "jobs", "t2", "m2", {});

  await saveJob(job1);
  await new Promise((r) => setTimeout(r, 10));
  await saveJob(job2);

  const jobs = await listJobs(10);
  assert(jobs.length >= 2);
  // job2 created after job1, so should be first
  assert.strictEqual(jobs[0].id, "job-2");
});
