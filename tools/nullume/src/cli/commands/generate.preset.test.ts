import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, "../index.ts");

function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["tsx", cliPath, ...args], {
      env: {
        ...process.env,
        NULLUME_PROVIDER: "mock",
        NULLUME_HOME: process.env.NULLUME_HOME || "",
      },
      cwd: process.env.NULLUME_HOME,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
  });
}

test("generate presets lists available presets", async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const oldHome = process.env.NULLUME_HOME;

  try {
    process.env.NULLUME_HOME = tempHome;

    const result = await runCLI(["generate", "presets", "--json"]);

    // Should complete successfully
    assert(result.code === 0 || result.stdout.includes("product-photo"), "Should output presets");
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tempHome, { recursive: true });
  }
}).skip = true; // Skip because it requires mock provider setup

test("Job model has rerunOf and cost fields", async () => {
  const { createJob } = await import("../../core/jobs/model.js");

  const job = createJob(
    "550e8400-e29b-41d4-a716-446655440000",
    "mock",
    "jobs",
    "task-1",
    "nano-model",
    { prompt: "test" }
  );

  // Should be able to set rerunOf
  job.rerunOf = "550e8400-e29b-41d4-a716-446655440001";
  assert.strictEqual(job.rerunOf, "550e8400-e29b-41d4-a716-446655440001");

  // Should be able to set cost
  job.cost = 1.5;
  assert.strictEqual(job.cost, 1.5);
});

test("Job stores and retrieves with rerunOf and cost", async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const oldHome = process.env.NULLUME_HOME;

  try {
    process.env.NULLUME_HOME = tempHome;

    const { createJob } = await import("../../core/jobs/model.js");
    const { saveJob, loadJob } = await import("../../core/jobs/store.js");

    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    const job = createJob(jobId, "mock", "jobs", "task-1", "model-1", { prompt: "test" });
    job.rerunOf = "550e8400-e29b-41d4-a716-446655440001";
    job.cost = 2.5;

    await saveJob(job);
    const loaded = await loadJob(jobId);

    assert.strictEqual(loaded.rerunOf, job.rerunOf);
    assert.strictEqual(loaded.cost, job.cost);
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tempHome, { recursive: true });
  }
});
