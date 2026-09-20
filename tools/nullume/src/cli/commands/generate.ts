import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getApiKey } from "../../core/config.js";
import { getProviderWithCatalog, loadPricing } from "../provider.js";
import { createJobTask } from "../../core/jobs/run.js";
import { waitJob } from "../../core/jobs/wait.js";
import { loadJob, listJobs } from "../../core/jobs/store.js";
import { loadPresets, resolvePreset } from "../../core/presets.js";
import { UsageError } from "../../core/errors.js";
import { emit, table } from "../output.js";
import { getGlobalFlags } from "../context.js";

function parseSetOption(setStrings: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const item of setStrings) {
    const [key, ...valueParts] = item.split("=");
    if (!key) continue;

    const value = valueParts.join("=");

    if (value.startsWith("@")) {
      // File reference
      const filePath = value.slice(1);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        result[key] = JSON.parse(content);
      } catch (e) {
        throw new UsageError(`Не удалось прочитать файл ${filePath}: ${(e as Error).message}`);
      }
    } else if (value === "true") {
      result[key] = true;
    } else if (value === "false") {
      result[key] = false;
    } else if (/^\d+$/.test(value)) {
      result[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      result[key] = parseFloat(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

const generateCmd = new Command("generate").description("Генерация медиа");

generateCmd
  .command("create <model>")
  .requiredOption("--prompt <text>", "Текст промпта")
  .option("--image <file>", "Путь к файлу или URL изображения (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--set <k=v>", "Установить параметр (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--wait", "Ждать завершения")
  .option("--wait-timeout <sec>", "Таймаут ожидания в секундах", "600")
  .option("--out <dir>", "Скопировать результаты в этот каталог")
  .option("--wait-interval <sec>", "Интервал проверки статуса в секундах", "2")
  .option("--style <slug>", "Стиль из библиотеки вкуса (спринт 2)")
  .option("--yes", "Пропустить подтверждение при дорогой генерации")
  .description("Создать задачу генерации")
  .action(async function (model: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      if (options.style) {
        throw new UsageError("--style появится в спринте 2");
      }

      const providerName = process.env.NULLUME_PROVIDER || "kie";
      const apiKey = providerName === "mock" ? "mock" : await getApiKey();
      const provider = await getProviderWithCatalog(providerName, apiKey);

      const setParams = parseSetOption((options.set as string[]) || []);
      const images = (options.image as string[]) || [];

      // Estimate cost
      const modelInfo = await provider.model(model);
      const costEstimate = await provider.estimate(model, {
        [modelInfo.meta.promptField || "prompt"]: options.prompt,
        ...setParams,
      });

      if (costEstimate) {
        const { creditsMin, creditsMax, usdMin, usdMax, approximate, source } = costEstimate;
        const costMsg = `${creditsMin}-${creditsMax} кредитов ($${usdMin.toFixed(3)}-$${usdMax.toFixed(3)})${approximate ? " [≈]" : ""} (${source})`;

        if (!flags.quiet) {
          console.log(`Оценка стоимости: ${costMsg}`);
        }

        // Check if needs confirmation
        const needsConfirm =
          approximate ||
          usdMax > 1 ||
          source === "unknown" ||
          source === "vendored";

        if (needsConfirm && !options.yes) {
          throw new UsageError(
            `Стоимость неизвестна или высока. Подтверди с --yes\nОценка: ${costMsg}`
          );
        }
      } else if (!options.yes) {
        // Нет оценки — это и есть «цена неизвестна», шлюз обязан остановить.
        throw new UsageError("Стоимость оценить не удалось. Подтверди запуск с --yes");
      }

      // Create job
      const job = await createJobTask(provider, {
        model,
        prompt: options.prompt as string,
        images,
        input: setParams,
        style: options.style as string | undefined,
      });

      if (flags.json) {
        console.log(JSON.stringify({ taskId: job.id, jobId: job.id, state: job.state }, null, 2));
      } else {
        console.log(`Задача создана: ${job.id}`);
      }

      // Wait if requested
      if (options.wait) {
        const timeoutSec = parseInt(options["wait-timeout"] as string, 10);
        const intervalSec = parseInt(options["wait-interval"] as string, 10);

        let lastMsg = "";
        const completedJob = await waitJob(provider, job.id, {
          timeoutSec,
          intervalSec,
          onTick: (j) => {
            const msg = `Статус: ${j.state} (${Math.round((Date.now() - new Date(j.createdAt).getTime()) / 1000)}с)`;
            if (msg !== lastMsg) {
              console.error(msg);
              lastMsg = msg;
            }
          },
        });

        if (options.out) {
          await fs.promises.mkdir(options.out as string, { recursive: true });
          for (const localPath of completedJob.localPaths) {
            const filename = path.basename(localPath);
            const dest = path.join(options.out as string, filename);
            await fs.promises.copyFile(localPath, dest);
          }
        }

        if (flags.json) {
          console.log(
            JSON.stringify(
              {
                jobId: completedJob.id,
                state: completedJob.state,
                results: completedJob.localPaths.length
                  ? completedJob.localPaths
                  : completedJob.resultUrls,
              },
              null,
              2
            )
          );
        } else if (completedJob.localPaths.length > 0) {
          console.log(`Результаты сохранены:\n${completedJob.localPaths.join("\n")}`);
        }
      }
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("cost <model>")
  .option("--set <k=v>", "Установить параметр (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--prompt <text>", "Текст промпта (опционально)")
  .description("Оценить стоимость генерации")
  .action(async function (model: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const providerName = process.env.NULLUME_PROVIDER || "kie";
      const apiKey = providerName === "mock" ? "mock" : await getApiKey();
      const provider = await getProviderWithCatalog(providerName, apiKey);

      const setParams = parseSetOption((options.set as string[]) || []);
      const input: Record<string, unknown> = { ...setParams };
      if (options.prompt) {
        input.prompt = options.prompt;
      }
      const costEstimate = await provider.estimate(model, input);

      if (!costEstimate) {
        throw new Error(`Не удалось оценить стоимость для модели ${model}`);
      }

      const output = {
        model,
        creditsMin: costEstimate.creditsMin,
        creditsMax: costEstimate.creditsMax,
        usdMin: costEstimate.usdMin,
        usdMax: costEstimate.usdMax,
        approximate: costEstimate.approximate,
        source: costEstimate.source,
      };

      emit(flags, { data: output }, () => {
        const approxText = costEstimate.approximate ? " [≈]" : "";
        return (
          `Стоимость: ${costEstimate.creditsMin}-${costEstimate.creditsMax} кредитов ` +
          `($${costEstimate.usdMin.toFixed(3)}-$${costEstimate.usdMax.toFixed(3)})${approxText}\n` +
          `Источник: ${costEstimate.source}`
        );
      });
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("wait <jobId>")
  .option("--out <dir>", "Скопировать результаты в этот каталог")
  .option("--wait-timeout <sec>", "Таймаут ожидания в секундах", "600")
  .option("--wait-interval <sec>", "Интервал проверки статуса в секундах", "2")
  .description("Дождаться завершения задачи")
  .action(async function (jobId: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const providerName = process.env.NULLUME_PROVIDER || "kie";
      const apiKey = providerName === "mock" ? "mock" : await getApiKey();
      const provider = await getProviderWithCatalog(providerName, apiKey);

      const timeoutSec = parseInt(options["wait-timeout"] as string, 10);
      const intervalSec = parseInt(options["wait-interval"] as string, 10);

      const completedJob = await waitJob(provider, jobId, {
        timeoutSec,
        intervalSec,
      });

      if (options.out && completedJob.localPaths.length > 0) {
        await fs.promises.mkdir(options.out as string, { recursive: true });
        for (const localPath of completedJob.localPaths) {
          const filename = path.basename(localPath);
          const dest = path.join(options.out as string, filename);
          await fs.promises.copyFile(localPath, dest);
        }
      }

      emit(flags, { data: completedJob }, () => `Задача завершена: ${completedJob.localPaths.join(", ")}`);
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("get <jobId>")
  .description("Получить информацию о задаче")
  .action(async function (jobId: string) {
    const flags = getGlobalFlags();

    try {
      const job = await loadJob(jobId);
      emit(flags, { data: job }, () => {
        const lines = [
          `ID: ${job.id}`,
          `Модель: ${job.model}`,
          `Статус: ${job.state}`,
          `Создана: ${job.createdAt}`,
          job.failMsg ? `Ошибка: ${job.failMsg}` : "",
        ];
        return lines.filter((l) => l).join("\n");
      });
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("presets")
  .description("Список доступных пресетов")
  .action(async function () {
    const flags = getGlobalFlags();

    try {
      const presets = await loadPresets();
      const providerName = process.env.NULLUME_PROVIDER || "kie";
      const apiKey = providerName === "mock" ? "mock" : await getApiKey();
      const provider = await getProviderWithCatalog(providerName, apiKey);
      const pricing = await loadPricing();

      const rows = await Promise.all(
        presets.map(async (p) => {
          const modelInfo = await provider.model(p.model);
          const cost = modelInfo.price
            ? (modelInfo.price.creditsMax * pricing.usd_per_credit).toFixed(2)
            : "?";
          return {
            id: p.id,
            title: p.title,
            cost: `$${cost}`,
            category: p.category,
          };
        })
      );

      emit(flags, { data: presets }, () => {
        return table(rows, [
          { key: "id", header: "ID" },
          { key: "title", header: "Название" },
          { key: "category", header: "Категория" },
          { key: "cost", header: "Стоимость" },
        ]);
      });
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("preset <id>")
  .requiredOption("--prompt <text>", "Текст промпта")
  .option("--image <file>", "Путь к файлу или URL изображения (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--set <k=v>", "Установить параметр (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--wait", "Ждать завершения")
  .option("--wait-timeout <sec>", "Таймаут ожидания в секундах", "600")
  .option("--wait-interval <sec>", "Интервал проверки статуса в секундах", "2")
  .option("--yes", "Пропустить подтверждение при дорогой генерации")
  .description("Генерировать по пресету")
  .action(async function (presetId: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const providerName = process.env.NULLUME_PROVIDER || "kie";
      const apiKey = providerName === "mock" ? "mock" : await getApiKey();
      const provider = await getProviderWithCatalog(providerName, apiKey);

      const resolved = await resolvePreset(presetId, await provider.models());
      if (!resolved) {
        throw new UsageError(`Пресет не найден: ${presetId}`);
      }

      if (resolved.substituted && !flags.quiet) {
        console.error(
          `⚠️  Модель ${resolved.model} недоступна, использую ${resolved.resolvedModel}`
        );
      }

      const setParams = parseSetOption((options.set as string[]) || []);
      const images = (options.image as string[]) || [];

      // Merge preset input with CLI overrides
      const finalInput = { ...resolved.input, ...setParams };

      // Estimate cost
      const modelInfo = await provider.model(resolved.resolvedModel);
      const costEstimate = await provider.estimate(resolved.resolvedModel, {
        [modelInfo.meta.promptField || "prompt"]: options.prompt,
        ...finalInput,
      });

      if (costEstimate) {
        const { creditsMin, creditsMax, usdMin, usdMax, approximate, source } =
          costEstimate;
        const costMsg = `${creditsMin}-${creditsMax} кредитов ($${usdMin.toFixed(3)}-$${usdMax.toFixed(3)})${approximate ? " [≈]" : ""} (${source})`;

        if (!flags.quiet) {
          console.log(`Оценка стоимости: ${costMsg}`);
        }

        // Check if needs confirmation
        const needsConfirm =
          approximate ||
          usdMax > 1 ||
          source === "unknown" ||
          source === "vendored";

        if (needsConfirm && !options.yes) {
          throw new UsageError(
            `Стоимость неизвестна или высока. Подтверди с --yes\nОценка: ${costMsg}`
          );
        }
      } else if (!options.yes) {
        throw new UsageError("Стоимость оценить не удалось. Подтверди запуск с --yes");
      }

      // Create job
      const job = await createJobTask(provider, {
        model: resolved.resolvedModel,
        prompt: options.prompt as string,
        images,
        input: finalInput,
      });

      if (flags.json) {
        console.log(
          JSON.stringify({ taskId: job.id, jobId: job.id, state: job.state }, null, 2)
        );
      } else {
        console.log(`Задача создана: ${job.id}`);
      }

      // Wait if requested
      if (options.wait) {
        const timeoutSec = parseInt(options["wait-timeout"] as string, 10);
        const intervalSec = parseInt(options["wait-interval"] as string, 10);

        let lastMsg = "";
        const completedJob = await waitJob(provider, job.id, {
          timeoutSec,
          intervalSec,
          onTick: (j) => {
            const msg = `Статус: ${j.state} (${Math.round((Date.now() - new Date(j.createdAt).getTime()) / 1000)}с)`;
            if (msg !== lastMsg) {
              console.error(msg);
              lastMsg = msg;
            }
          },
        });

        if (flags.json) {
          console.log(
            JSON.stringify(
              {
                jobId: completedJob.id,
                state: completedJob.state,
                results: completedJob.localPaths.length
                  ? completedJob.localPaths
                  : completedJob.resultUrls,
              },
              null,
              2
            )
          );
        } else if (completedJob.localPaths.length > 0) {
          console.log(
            `Результаты сохранены:\n${completedJob.localPaths.join("\n")}`
          );
        }
      }
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("list")
  .option("--limit <n>", "Максимальное число записей", "50")
  .option("--failed", "Только ошибки")
  .description("История задач")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const limit = parseInt(options.limit as string, 10);
      let jobs = await listJobs(limit);

      if (options.failed) {
        jobs = jobs.filter((j) => j.state === "fail");
      }

      const rows = jobs.map((j) => {
        const prompt =
          typeof j.input.prompt === "string"
            ? j.input.prompt.slice(0, 60)
            : "";
        const costStr = j.cost ? `$${j.cost.toFixed(2)}` : "-";
        return {
          id: j.id.slice(0, 8),
          model: j.model,
          state: j.state,
          created: new Date(j.createdAt).toLocaleString("ru-RU"),
          prompt: prompt,
          cost: costStr,
        };
      });

      emit(flags, { data: jobs }, () => {
        return table(rows, [
          { key: "id", header: "ID" },
          { key: "model", header: "Модель" },
          { key: "state", header: "Статус" },
          { key: "created", header: "Создана" },
          { key: "prompt", header: "Промпт" },
          { key: "cost", header: "Стоимость" },
        ]);
      });
    } catch (error) {
      throw error;
    }
  });

generateCmd
  .command("rerun <jobId>")
  .option("--prompt <text>", "Новый промпт (если не указан, используется исходный)")
  .option("--image <file>", "Путь к файлу или URL изображения (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--set <k=v>", "Установить параметр (можно использовать несколько раз)", (val: string, prev: string[] = []) => {
    return [...prev, val];
  })
  .option("--wait", "Ждать завершения")
  .option("--wait-timeout <sec>", "Таймаут ожидания в секундах", "600")
  .option("--wait-interval <sec>", "Интервал проверки статуса в секундах", "2")
  .option("--yes", "Пропустить подтверждение при дорогой генерации")
  .description("Повторить задачу с изменениями")
  .action(async function (jobId: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const originalJob = await loadJob(jobId);

      const providerName = process.env.NULLUME_PROVIDER || "kie";
      const apiKey = providerName === "mock" ? "mock" : await getApiKey();
      const provider = await getProviderWithCatalog(providerName, apiKey);

      const setParams = parseSetOption((options.set as string[]) || []);
      const images = (options.image as string[]) || [];

      // Use original input as base
      const baseInput = { ...originalJob.input };
      const finalInput = { ...baseInput, ...setParams };

      // Use new prompt or original
      const prompt = (options.prompt as string) || (baseInput.prompt as string) || "";

      // Estimate cost
      const modelInfo = await provider.model(originalJob.model);
      const costEstimate = await provider.estimate(originalJob.model, {
        [modelInfo.meta.promptField || "prompt"]: prompt,
        ...finalInput,
      });

      if (costEstimate) {
        const { creditsMin, creditsMax, usdMin, usdMax, approximate, source } =
          costEstimate;
        const costMsg = `${creditsMin}-${creditsMax} кредитов ($${usdMin.toFixed(3)}-$${usdMax.toFixed(3)})${approximate ? " [≈]" : ""} (${source})`;

        if (!flags.quiet) {
          console.log(`Оценка стоимости: ${costMsg}`);
        }

        // Check if needs confirmation
        const needsConfirm =
          approximate ||
          usdMax > 1 ||
          source === "unknown" ||
          source === "vendored";

        if (needsConfirm && !options.yes) {
          throw new UsageError(
            `Стоимость неизвестна или высока. Подтверди с --yes\nОценка: ${costMsg}`
          );
        }
      } else if (!options.yes) {
        throw new UsageError("Стоимость оценить не удалось. Подтверди запуск с --yes");
      }

      // Create new job with rerunOf link
      const job = await createJobTask(provider, {
        model: originalJob.model,
        prompt,
        images: images.length > 0 ? images : undefined,
        input: finalInput,
      });

      job.rerunOf = jobId;
      // Save updated job
      const { saveJob } = await import("../../core/jobs/store.js");
      await saveJob(job);

      if (flags.json) {
        console.log(
          JSON.stringify({ taskId: job.id, jobId: job.id, state: job.state, rerunOf: jobId }, null, 2)
        );
      } else {
        console.log(`Задача создана: ${job.id} (повтор ${jobId.slice(0, 8)})`);
      }

      // Wait if requested
      if (options.wait) {
        const timeoutSec = parseInt(options["wait-timeout"] as string, 10);
        const intervalSec = parseInt(options["wait-interval"] as string, 10);

        let lastMsg = "";
        const completedJob = await waitJob(provider, job.id, {
          timeoutSec,
          intervalSec,
          onTick: (j) => {
            const msg = `Статус: ${j.state} (${Math.round((Date.now() - new Date(j.createdAt).getTime()) / 1000)}с)`;
            if (msg !== lastMsg) {
              console.error(msg);
              lastMsg = msg;
            }
          },
        });

        if (flags.json) {
          console.log(
            JSON.stringify(
              {
                jobId: completedJob.id,
                state: completedJob.state,
                rerunOf: jobId,
                results: completedJob.localPaths.length
                  ? completedJob.localPaths
                  : completedJob.resultUrls,
              },
              null,
              2
            )
          );
        } else if (completedJob.localPaths.length > 0) {
          console.log(
            `Результаты сохранены:\n${completedJob.localPaths.join("\n")}`
          );
        }
      }
    } catch (error) {
      throw error;
    }
  });

export default generateCmd;
