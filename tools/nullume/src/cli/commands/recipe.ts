import { Command } from "commander";
import { listRecipes, getRecipe, planRecipe, runRecipe } from "../../core/recipes.js";
import { getProviderWithCatalog } from "../provider.js";
import { loadCatalog } from "../../core/catalog.js";
import { getApiKey } from "../../core/config.js";
import { emit, table } from "../output.js";
import { getGlobalFlags } from "../context.js";

const recipeCmd = new Command("recipe").description("Рецепты типовых задач");

recipeCmd
  .command("list")
  .description("Список доступных рецептов")
  .action(async function () {
    const flags = getGlobalFlags();

    try {
      const recipes = await listRecipes();

      const rows = recipes.map((r) => ({
        id: r.id,
        title: r.title,
        goal: r.goal,
        steps: String(r.steps_count),
      }));

      emit(flags, { data: recipes }, () =>
        table(rows, [
          { key: "id", header: "ID" },
          { key: "title", header: "Название" },
          { key: "goal", header: "Результат" },
          { key: "steps", header: "Шагов" },
        ])
      );
    } catch (error) {
      throw error;
    }
  });

recipeCmd
  .command("show <id>")
  .requiredOption("--subject <text>", "Что генерировать (e.g., ceramic vase)")
  .option("--style <slug>", "Стиль пресета (опционально)")
  .description("Показать план рецепта с оценкой стоимости")
  .action(
    async function (
      id: string,
      options: Record<string, unknown>
    ) {
      const flags = getGlobalFlags();

      try {
        const apiKey = await getApiKey();
        const providerName = process.env.NULLUME_PROVIDER || "kie";
        const provider = await getProviderWithCatalog(providerName, apiKey);
        const catalog = await loadCatalog();

        const plan = await planRecipe(id, {
          subject: options.subject as string,
          style: options.style as string | undefined,
          catalog,
          provider,
        });

        if (!plan) {
          throw new Error(`Рецепт не найден: ${id}`);
        }

        emit(flags, { data: plan }, () => {
          const lines: string[] = [];
          lines.push(`Рецепт: ${plan.recipe_id}`);
          lines.push(`Тема: ${plan.subject}`);
          if (plan.style) {
            lines.push(`Стиль: ${plan.style}`);
          }
          lines.push("");
          lines.push("Шаги:");

          for (const step of plan.steps) {
            lines.push(`  ${step.id}:`);
            lines.push(`    Модель: ${step.model}`);
            lines.push(`    Промпт: ${step.prompt}`);
            if (step.from) {
              lines.push(`    Источник: ${step.from}`);
            }
            lines.push(`    Цена: ${step.cost_credits} кр ($${step.cost_usd})`);
            if (step.cost_source !== "vendored") {
              lines.push(`    [${step.cost_source}]`);
            }
            lines.push("");
          }

          lines.push("---");
          lines.push(`Итого: ${plan.total_credits} кредитов ($${plan.total_usd})`);
          if (plan.has_unconfirmed_price) {
            lines.push("[⚠️  Часть цен не подтверждена (fuzzy/unknown)]");
          }

          return lines.join("\n");
        });
      } catch (error) {
        throw error;
      }
    }
  );

recipeCmd
  .command("run <id>")
  .requiredOption("--subject <text>", "Что генерировать (e.g., ceramic vase)")
  .option("--style <slug>", "Стиль пресета (опционально)")
  .requiredOption(
    "--max-credits <number>",
    "Максимум кредитов для траты (обязателен для безопасности)"
  )
  .option("--dry-run", "Показать план и выйти, ничего не создавать")
  .description("Запустить рецепт: создать генерации и дождаться результатов")
  .action(
    async function (
      id: string,
      options: Record<string, unknown>
    ) {
      const flags = getGlobalFlags();

      try {
        const apiKey = await getApiKey();
        const providerName = process.env.NULLUME_PROVIDER || "kie";
        const provider = await getProviderWithCatalog(providerName, apiKey);
        const catalog = await loadCatalog();

        const maxCredits = parseInt(options.maxCredits as string);
        if (isNaN(maxCredits) || maxCredits <= 0) {
          throw new Error(
            "max-credits должна быть положительным числом"
          );
        }

        const plan = await planRecipe(id, {
          subject: options.subject as string,
          style: options.style as string | undefined,
          catalog,
          provider,
        });

        if (!plan) {
          throw new Error(`Рецепт не найден: ${id}`);
        }

        // Show plan
        emit(flags, { data: plan }, () => {
          const lines: string[] = [];
          lines.push(`Рецепт: ${plan.recipe_id}`);
          lines.push(`Тема: ${plan.subject}`);
          lines.push(`Оценка: ${plan.total_credits} кредитов ($${plan.total_usd})`);
          if (plan.has_unconfirmed_price) {
            lines.push(
              "[⚠️  Часть цен не подтверждена (fuzzy/unknown)]"
            );
          }
          return lines.join("\n");
        });

        if (options.dryRun) {
          return;
        }

        // Run recipe
        const result = await runRecipe(plan, {
          provider,
          style: options.style as string | undefined,
          maxCredits,
        });

        emit(flags, { data: result }, () => {
          const lines: string[] = [];
          lines.push(`✓ Рецепт завершён: ${result.recipe_id}`);
          lines.push("");
          lines.push("Шаги:");

          for (const step of result.steps) {
            const statusIcon = {
              done: "✓",
              failed: "✗",
              pending: "⏳",
              skipped: "⊘",
            }[step.state];

            lines.push(`  ${statusIcon} ${step.id}: ${step.state}`);
            for (const path of step.local_paths) lines.push(`     → ${path}`);
            for (const url of step.result_urls ?? []) lines.push(`     ↗ ${url}`);
            if (step.error) {
              lines.push(`     Ошибка: ${step.error}`);
            }
            if (step.skip_reason) {
              lines.push(`     Пропущено: ${step.skip_reason}`);
            }
          }

          lines.push("");
          lines.push(
            `Потрачено: ${result.total_cost_credits} кредитов ($${result.total_cost_usd})`
          );

          return lines.join("\n");
        });
      } catch (error) {
        throw error;
      }
    }
  );

export default recipeCmd;
