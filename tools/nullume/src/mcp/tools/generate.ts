import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { createJobTask } from "../../core/jobs/run.js";
import { waitJob } from "../../core/jobs/wait.js";
import { formatError, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  model: z.string().describe("ID модели"),
  prompt: z.string().optional().describe("Текстовый запрос для генерации"),
  images: z.array(z.string()).optional().describe("Пути к файлам или URL изображений"),
  input: z.record(z.string(), z.unknown()).optional().describe("Дополнительные параметры модели"),
  wait: z.boolean().optional().default(true).describe("Ждать завершения задачи"),
  wait_timeout_sec: z.number().optional().default(300).describe("Таймаут ожидания в секундах"),
  out_dir: z.string().optional().describe("Каталог для сохранения результатов"),
  confirm_cost: z.boolean().optional().describe("Подтверждение при стоимости > $1"),
});

export async function handler(args: {
  model: string;
  prompt?: string;
  images?: string[];
  input?: Record<string, unknown>;
  wait?: boolean;
  wait_timeout_sec?: number;
  out_dir?: string;
  confirm_cost?: boolean;
}) {
  try {
    const provider = await getProviderInstance();
    const usdPerCredit = getUsdPerCredit();

    // Create job
    const job = await createJobTask(provider, {
      model: args.model,
      prompt: args.prompt || "",
      images: args.images,
      input: args.input,
      out: args.out_dir,
    });

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
                  model: job.model,
                  estimate: {
                    credits_max: job.estimate.creditsMax,
                    usd_max: usdCost,
                  },
                  message: "Стоимость > $1, нужно подтверждение. Вызови generate снова с confirm_cost: true",
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
      // Timeout or error during wait
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                job_id: job.id,
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
      content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}
