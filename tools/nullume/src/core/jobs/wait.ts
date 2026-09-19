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

export async function waitJob(
  provider: Provider,
  jobId: string,
  options: WaitOptions = {}
): Promise<Job> {
  const { timeoutSec = 600, intervalSec: customInterval, onTick } = options;

  const job = await loadJob(jobId);

  const startTime = Date.now();
  let backoffIdx = 0;

  for (;;) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > timeoutSec) {
      job.state = "fail";
      job.failMsg = `Timeout after ${timeoutSec}s`;
      await saveJob(job);
      throw new Error(`Job timeout: ${jobId}`);
    }

    // Get status
    try {
      const status = await provider.status(job.taskId);
      job.state = status.state as any;
      if (status.urls) job.resultUrls = status.urls;
      if (status.failMsg) job.failMsg = status.failMsg;
      job.updatedAt = new Date().toISOString();

      if (onTick) onTick(job);

      if (status.state === "success" && job.resultUrls.length > 0) {
        // Download results
        await ensureDir(getDownloadsDir());

        for (let i = 0; i < job.resultUrls.length; i++) {
          const url = job.resultUrls[i];
          if (url.startsWith("data:")) {
            // Skip data URLs
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

        await saveJob(job);
        return job;
      }

      if (status.state === "fail") {
        await saveJob(job);
        throw new Error(`Job failed: ${job.failMsg}`);
      }
    } catch (e) {
      // Re-throw critical errors, retry others
      if (e instanceof TaskNotFound) throw e;
      // Continue polling on transient errors
    }

    // Wait before next poll
    const interval = customInterval ?? BACKOFF_STEPS[Math.min(backoffIdx, BACKOFF_STEPS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    backoffIdx++;
  }
}
