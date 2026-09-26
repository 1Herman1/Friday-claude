import { z } from "zod";
import { waitJobs } from "../../core/jobs/wait.js";
import type { Job } from "../../core/jobs/model.js";
import { getProviderInstance } from "../provider.js";
import { formatError } from "../utils.js";

export const schema = z.object({
  job_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(20)
    .describe("ID задач для ожидания (1–20 UUID)"),
  timeout_sec: z
    .number()
    .int()
    .min(1)
    .max(1800)
    .default(300)
    .describe("Таймаут ожидания в секундах (по умолчанию 300, максимум 1800)"),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(3)
    .optional()
    .describe("Одновременных запросов статуса (по умолчанию 3, не больше 5 — иначе kie отвечает 429)"),
});

interface JobResult {
  job_id: string;
  state: string;
  model: string;
  result_urls: string[];
  local_paths: string[];
  fail_msg?: string;
  error?: string;
}

export async function handler(args: {
  job_ids: string[];
  timeout_sec: number;
  concurrency?: number;
}) {
  try {
    const provider = await getProviderInstance();

    const result = await waitJobs(provider, args.job_ids, {
      timeoutSec: args.timeout_sec,
      concurrency: args.concurrency || 3,
    });

    const formatJob = (job: Job): JobResult => ({
      job_id: job.id,
      state: job.state,
      model: job.model,
      result_urls: job.resultUrls ?? [],
      local_paths: job.localPaths ?? [],
      fail_msg: job.failMsg,
    });

    const done = result.done.map((job) => ({
      ...formatJob(job),
      group: "done" as const,
    }));

    const failed = result.failed.map((job) => ({
      ...formatJob(job),
      group: "failed" as const,
    }));

    const pending = result.pending.map((job) => ({
      ...formatJob(job),
      group: "pending" as const,
    }));

    const output: {
      summary: { done_count: number; failed_count: number; pending_count: number; total: number };
      done: JobResult[];
      failed: JobResult[];
      pending: JobResult[];
      errors?: Record<string, string>;
    } = {
      summary: {
        done_count: done.length,
        failed_count: failed.length,
        pending_count: pending.length,
        total: args.job_ids.length,
      },
      done: done,
      failed: failed,
      pending: pending,
    };

    if (result.errors && Object.keys(result.errors).length > 0) {
      output.errors = result.errors;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}
