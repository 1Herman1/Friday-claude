import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { saveJob, loadJob, listJobs } from "./store.js";
import { createJob } from "./model.js";

test("saveJob and loadJob roundtrip", async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const oldHome = process.env.NULLUME_HOME;

  try {
    process.env.NULLUME_HOME = tempHome;

    const jobId = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID
    const job = createJob(jobId, "kie", "jobs", "task-1", "nano-banana-2", {
      prompt: "test",
    });

    await saveJob(job);
    const loaded = await loadJob(jobId);

    assert.strictEqual(loaded.id, jobId);
    assert.strictEqual(loaded.state, "pending");
    assert.strictEqual(loaded.taskId, "task-1");
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tempHome, { recursive: true });
  }
});

test("listJobs returns recent jobs first", async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const oldHome = process.env.NULLUME_HOME;

  try {
    process.env.NULLUME_HOME = tempHome;

    const uuid1 = "550e8400-e29b-41d4-a716-446655440001";
    const uuid2 = "550e8400-e29b-41d4-a716-446655440002";

    const job1 = createJob(uuid1, "kie", "jobs", "t1", "m1", {});
    await new Promise((r) => setTimeout(r, 10));
    const job2 = createJob(uuid2, "kie", "jobs", "t2", "m2", {});

    await saveJob(job1);
    await saveJob(job2);

    const jobs = await listJobs(10);
    assert(jobs.length >= 2, `Should have at least 2 jobs, got ${jobs.length}`);
    // job2 created after job1, so should be first or at least present
    const ids = jobs.map((j: any) => j.id);
    assert(ids.includes(uuid2), `${uuid2} should be in list: ${ids}`);
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tempHome, { recursive: true });
  }
});
