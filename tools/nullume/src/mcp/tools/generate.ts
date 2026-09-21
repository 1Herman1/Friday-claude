import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { createJobTask } from "../../core/jobs/run.js";
import { waitJob } from "../../core/jobs/wait.js";
import { resolvePreset } from "../../core/presets.js";
import { formatError, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  model: z.string().optional().describe("ID модели (не требуется если указан preset)"),
  preset: z.string().optional().describe("ID пресета (product-photo, banner-16x9 и т.д.)"),
  prompt: z.string().optional().describe("Текстовый запрос для генерации"),
  images: z.array(z.string()).optional().describe("Пути к файлам или URL изображений"),
  input: z.record(z.string(), z.unknown()).optional().describe("Дополнительные параметры модели"),
  style: z.string().optional().describe("Стиль из библиотеки вкуса (slug или ID семейства)"),
  wait: z.boolean().optional().default(true).describe("Ждать завершения задачи"),
  wait_timeout_sec: z.number().optional().default(300).describe("Таймаут ожидания в секундах"),
  confirm_cost: z.boolean().optional().describe("Подтверждение при стоимости > $1"),
});

export async function handler(args: {
  model?: string;
  preset?: string;
  prompt?: string;
  images?: string[];
  input?: Record<string, unknown>;
  style?: string;
  wait?: boolean;
  wait_timeout_sec?: number;
  confirm_cost?: boolean;
}) {
  try {
    const provider = await getProviderInstance();
    const usdPerCredit = getUsdPerCredit();

    let modelId = args.model;
    let finalInput = { ...args.input };

    // Resolve preset if provided
    if (args.preset) {
      const resolved = await resolvePreset(args.preset, await provider.models());
      if (!resolved) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Пресет не найден: ${args.preset}` }),
            },
          ],
          isError: true,
        };
      }
      modelId = resolved.resolvedModel;
      finalInput = { ...resolved.input, ...finalInput };
    }

    if (!modelId) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Требуется либо model, либо preset" }),
          },
        ],
        isError: true,
      };
    }

    // Estimate cost BEFORE creating job
    const modelInfo = await provider.model(modelId);
    const costEstimate = await provider.estimate(modelId, {
      [modelInfo.meta.promptField || "prompt"]: args.prompt || "",
      ...finalInput,
    });

    // Check cost BEFORE creating job
    if (costEstimate) {
      const usdCost = formatPrice(costEstimate.creditsMax, usdPerCredit);
      if ((costEstimate.creditsMax > 200 || usdCost > 1.0) && !args.confirm_cost) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  needs_confirmation: true,
                  model: modelId,
                  estimate: {
                    credits_max: costEstimate.creditsMax,
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
    } else if (!args.confirm_cost) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Стоимость оценить не удалось. Подтверди запуск с confirm_cost: true",
            }),
          },
        ],
        isError: true,
      };
    }

    // Create job AFTER cost check
    const job = await createJobTask(provider, {
      model: modelId,
      prompt: args.prompt || "",
      images: args.images,
      input: finalInput,
      style: args.style,
    });

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
