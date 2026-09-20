import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { createJobTask } from "../../core/jobs/run.js";
import { waitJob } from "../../core/jobs/wait.js";
import { loadJob, saveJob } from "../../core/jobs/store.js";
import { formatError, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  job_id: z.string().describe("ID задачи для повтора"),
  prompt: z.string().optional().describe("Новый промпт (если не указан, используется исходный)"),
  input: z.record(z.string(), z.unknown()).optional().describe("Новые параметры модели (сливаются с исходными)"),
  wait: z.boolean().optional().default(true).describe("Ждать завершения"),
  wait_timeout_sec: z.number().optional().default(300).describe("Таймаут ожидания"),
  confirm_cost: z.boolean().optional().describe("Подтверждение при стоимости > $1"),
});

export async function handler(args: {
  job_id: string;
  prompt?: string;
  input?: Record<string, unknown>;
  wait?: boolean;
  wait_timeout_sec?: number;
  confirm_cost?: boolean;
}) {
  try {
    const provider = await getProviderInstance();
    const usdPerCredit = getUsdPerCredit();

    // Load original job
    const originalJob = await loadJob(args.job_id);

    // Build final input
    const baseInput = { ...originalJob.input };
    const finalInput = { ...baseInput, ...(args.input || {}) };

    // Use new prompt or original
    const prompt = args.prompt || (baseInput.prompt as string) || "";

    // Create job with rerunOf link
    const job = await createJobTask(provider, {
      model: originalJob.model,
      prompt,
      input: finalInput,
    });

    job.rerunOf = args.job_id;
    await saveJob(job);

    // Check cost
    if (job.estimate) {
      const usdCost = formatPrice(job.estimate.creditsMax, usdPerCredit);
      if ((job.estimate.creditsMax > 200 || usdCost > 1.0) && !args.confirm_cost) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  needs_confirmation: true,
                  job_id: job.id,
                  rerun_of: args.job_id,
                  estimate: {
                    credits_max: job.estimate.creditsMax,
                    usd_max: usdCost,
                  },
                  message: "Стоимость > $1, нужно подтверждение. Вызови rerun_job снова с confirm_cost: true",
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }

    // If no wait, return job immediately
    if (!args.wait) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                job_id: job.id,
                rerun_of: args.job_id,
                state: job.state,
                task_id: job.taskId,
                model: job.model,
                created_at: job.createdAt,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Wait for completion
    try {
      const completed = await waitJob(provider, job.id, {
        timeoutSec: args.wait_timeout_sec,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                job_id: completed.id,
                rerun_of: args.job_id,
                state: completed.state,
                model: completed.model,
                result_urls: completed.resultUrls,
                local_paths: completed.localPaths,
                created_at: completed.createdAt,
                updated_at: completed.updatedAt,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (waitError) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                job_id: job.id,
                rerun_of: args.job_id,
                state: "pending",
                task_id: job.taskId,
                message: "Задача ещё обрабатывается. Вызови get_job чтобы проверить статус",
                error: formatError(waitError),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}
