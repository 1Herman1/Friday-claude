import fs from "node:fs";
import path from "node:path";
import type { Provider } from "../providers/types.js";
import { TaskNotFound } from "../errors.js";
import { downloadFile } from "../download.js";
import { getDownloadsDir, ensureDir } from "../paths.js";
import { loadJob, saveJob } from "./store.js";
import type { Job } from "./model.js";

const BACKOFF_STEPS = [2, 3, 5, 8, 10];

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastPart = pathname.split("/").pop() || "";
    const dotIdx = lastPart.lastIndexOf(".");
    if (dotIdx > 0) return lastPart.slice(dotIdx);
  } catch {
    // Invalid URL
  }

  // Default by content
  if (url.includes("mp3") || url.includes("audio")) return ".mp3";
  if (url.includes("mp4") || url.includes("video")) return ".mp4";
  if (url.includes("wav")) return ".wav";
  if (url.includes("webm")) return ".webm";
  return ".png";
}

export interface WaitOptions {
  timeoutSec?: number;
  intervalSec?: number;
  onTick?: (job: Job) => void;
}

export interface WaitJobsOptions {
  timeoutSec?: number;
  concurrency?: number;
  intervalSec?: number;
  onTick?: (job: Job) => void;
}

export interface WaitJobsResult {
  done: Job[];
  failed: Job[];
  pending: Job[];
  errors?: Record<string, string>;
}

export class JobFailed extends Error {
  name = "JobFailed";
}

/**
 * Check status of one job once, update local state, download if success.
 * Throws JobFailed if provider reports failure, TaskNotFound if job doesn't exist.
 * Returns true if done (success), false otherwise.
 */
/** Проверку статуса стоит повторить: сеть, 5xx, лимит запросов */
export class TransientStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientStatusError";
  }
}

async function checkJobOnce(provider: Provider, job: Job): Promise<boolean> {
  try {
    const status = await provider.status(job.taskId);
    job.state = status.state as any;
    if (status.urls) job.resultUrls = status.urls;
    if (status.failMsg) job.failMsg = status.failMsg;
    job.updatedAt = new Date().toISOString();

    if (status.state === "success") {
      // Download results if any
      if (job.resultUrls.length > 0) {
        await ensureDir(getDownloadsDir());

        for (let i = 0; i < job.resultUrls.length; i++) {
          const url = job.resultUrls[i];
          if (url.startsWith("data:")) {
            continue;
          }

          const ext = getExtFromUrl(url);
          const name = `${job.model.replace(/\//g, "-")}-${job.id.slice(0, 8)}-${i}${ext}`;
          const dest = path.join(getDownloadsDir(), name);

          try {
            await downloadFile(url, dest, getDownloadsDir());
            job.localPaths.push(dest);
          } catch (e) {
            console.error(`Failed to download ${url}:`, e);
          }
        }
      }

      await saveJob(job);
      return true;
    }

    if (status.state === "fail") {
      await saveJob(job);
      throw new JobFailed(`Задача завершилась ошибкой: ${job.failMsg ?? "без описания"}`);
    }
  } catch (e) {
    if (e instanceof TaskNotFound || e instanceof JobFailed) throw e;
    // Сбой сети или провайдера — повод опросить снова, но не повод молчать:
    // без текста ошибки таймаут потом не объяснить.
    throw new TransientStatusError((e as Error).message || "неизвестная ошибка");
  }

  return false;
}

export async function waitJob(
  provider: Provider,
  jobId: string,
  options: WaitOptions = {}
): Promise<Job> {
  const { timeoutSec = 600, intervalSec: customInterval, onTick } = options;

  const job = await loadJob(jobId);

  const startTime = Date.now();
  let backoffIdx = 0;
  let lastError: string | undefined;

  for (;;) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > timeoutSec) {
      const reason = lastError ? `; последняя ошибка проверки: ${lastError}` : "";
      job.state = "fail";
      job.failMsg = `Timeout after ${timeoutSec}s${reason}`;
      await saveJob(job);
      throw new Error(`Job timeout: ${jobId}${reason}`);
    }

    try {
      const isDone = await checkJobOnce(provider, job);
      lastError = undefined;
      if (isDone) {
        return job;
      }

      if (onTick) onTick(job);
    } catch (e) {
      if (!(e instanceof TransientStatusError)) throw e;
      lastError = e.message;
    }

    // Wait before next poll
    const interval = customInterval ?? BACKOFF_STEPS[Math.min(backoffIdx, BACKOFF_STEPS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    backoffIdx++;
  }
}

export async function waitJobs(
  provider: Provider,
  jobIds: string[],
  options: WaitJobsOptions = {}
): Promise<WaitJobsResult> {
  const { timeoutSec = 600, concurrency = 3, intervalSec: customInterval } = options;

  if (jobIds.length === 0) {
    return { done: [], failed: [], pending: [] };
  }

  // Load all jobs first
  const jobs: Record<string, Job> = {};
  const errors: Record<string, string> = {};

  for (const jobId of jobIds) {
    try {
      jobs[jobId] = await loadJob(jobId);
    } catch (e) {
      errors[jobId] = `Failed to load: ${(e as Error).message}`;
    }
  }

  const startTime = Date.now();
  let backoffIdx = 0;

  // Track which jobs are pending, done, failed
  const done = new Set<string>();
  const failed = new Set<string>();
  const pending = new Set<string>();

  // Categorize loaded jobs: already done/failed or still pending
  for (const jobId of Object.keys(jobs)) {
    const job = jobs[jobId]!;
    if (job.state === "success") {
      done.add(jobId);
    } else if (job.state === "fail") {
      failed.add(jobId);
    } else {
      pending.add(jobId);
    }
  }

  for (;;) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > timeoutSec) {
      // Timeout reached, stop polling
      break;
    }

    if (pending.size === 0) {
      // All jobs are resolved or errored
      break;
    }

    // Poll pending jobs with concurrency limit
    const jobsToCheck = Array.from(pending);
    for (let i = 0; i < jobsToCheck.length; i += concurrency) {
      const batch = jobsToCheck.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (jobId) => {
          const job = jobs[jobId]!;

          try {
            const isDone = await checkJobOnce(provider, job);
            // Сбой прошёл — старая ошибка больше не про эту задачу
            delete errors[jobId];
            if (isDone) {
              done.add(jobId);
              pending.delete(jobId);
            }
          } catch (e) {
            // Храним последнюю ошибку: по ней видно, почему задача не дождалась
            errors[jobId] = (e as Error).message || "Unknown error";

            if (e instanceof JobFailed || e instanceof TaskNotFound) {
              failed.add(jobId);
              pending.delete(jobId);
            }
            // Network/provider errors: leave in pending for next iteration
          }
        })
      );

      // Check for promise rejections (shouldn't happen due to allSettled, but be safe)
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "rejected") {
          const jobId = batch[j];
          const error = (results[j] as PromiseRejectedResult).reason;
          errors[jobId] = (error as Error).message || "Unknown error";
          if (error instanceof TaskNotFound || error instanceof JobFailed) {
            failed.add(jobId);
            pending.delete(jobId);
          }
        }
      }
    }

    if (pending.size === 0) {
      break;
    }

    // Wait before next poll
    const interval = customInterval ?? BACKOFF_STEPS[Math.min(backoffIdx, BACKOFF_STEPS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    backoffIdx++;
  }

  // Collect results
  const doneJobs: Job[] = [];
  const failedJobs: Job[] = [];
  const pendingJobs: Job[] = [];

  // Jobs with load errors go to failed
  for (const [jobId, error] of Object.entries(errors)) {
    if (!done.has(jobId) && !failed.has(jobId)) {
      // Load error (not from provider check)
      if (!jobs[jobId]) {
        failedJobs.push({
          id: jobId,
          provider: "unknown",
          api: "",
          taskId: "",
          model: "",
          input: {},
          state: "fail",
          resultUrls: [],
          localPaths: [],
          failMsg: error,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        continue;
      }
    }
  }

  for (const jobId of done) {
    doneJobs.push(jobs[jobId]!);
  }

  for (const jobId of failed) {
    failedJobs.push(jobs[jobId]!);
  }

  for (const jobId of pending) {
    pendingJobs.push(jobs[jobId]!);
  }

  const result: WaitJobsResult = {
    done: doneJobs,
    failed: failedJobs,
    pending: pendingJobs,
  };

  if (Object.keys(errors).length > 0) {
    result.errors = errors;
  }

  return result;
}
