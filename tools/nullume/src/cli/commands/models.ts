import { Command } from "commander";
import { loadCatalog, searchModels } from "../../core/catalog.js";
import { getProviderWithCatalog } from "../provider.js";
import { getApiKey } from "../../core/config.js";
import type { ModelInfo, ModelCategory } from "../../core/providers/types.js";
import { emit, table } from "../output.js";
import { getGlobalFlags } from "../context.js";

const modelsCmd = new Command("models").description("Управление моделями");

modelsCmd
  .command("list")
  .option("--category <category>", "Фильтр по категории (image|video|audio)")
  .option("--search <query>", "Поиск по названию")
  .option("--refresh", "Перезагрузить каталог с сервера")
  .description("Список доступных моделей")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      let models = await loadCatalog();

      if (options.category) {
        models = models.filter((m) => m.category === options.category);
      }

      if (options.search) {
        models = searchModels(models, options.search as string);
      }

      const rows = models.map((m) => ({
        id: m.id,
        category: m.category,
        price: m.price ? `${m.price.creditsMin}-${m.price.creditsMax}` : "—",
        stale: m.stale ? "[stale]" : "",
        approx: m.price?.approximate ? "[≈]" : "",
      }));

      emit(flags, { data: models }, () => table(rows, [
        { key: "id", header: "Модель" },
        { key: "category", header: "Тип" },
        { key: "price", header: "Кредиты" },
        { key: "stale", header: "" },
        { key: "approx", header: "" },
      ]));
    } catch (error) {
      throw error;
    }
  });

modelsCmd
  .command("get <id>")
  .description("Информация о модели")
  .action(async function (id: string) {
    const flags = getGlobalFlags();

    try {
      const models = await loadCatalog();
      const model = models.find((m) => m.id === id);

      if (!model) {
        throw new Error(`Модель не найдена: ${id}`);
      }

      // Get price from provider if available
      let priceInfo = null;
      try {
        const providerName = process.env.NULLUME_PROVIDER || "kie";
        if (providerName !== "mock") {
          const apiKey = await getApiKey();
          const provider = await getProviderWithCatalog(providerName, apiKey);
          const cost = await provider.estimate(id, {});
          if (cost) {
            priceInfo = {
              credits: `${cost.creditsMin}-${cost.creditsMax}`,
              usd: `$${cost.usdMin.toFixed(3)}-$${cost.usdMax.toFixed(3)}`,
              approximate: cost.approximate,
              source: cost.source,
            };
          }
        }
      } catch {
        // Ignore provider errors
      }

      const output = {
        id: model.id,
        name: model.id,
        type: model.category,
        api: model.api,
        docUrl: model.docUrl,
        description: model.description,
        schemaSource: model.schemaSource,
        stale: model.stale ? true : false,
        promptField: model.meta?.promptField,
        imageField: model.meta?.imageField,
        requiredFields: model.meta?.required || [],
        defaultFields: model.meta?.defaults || {},
        price: priceInfo || (model.price
          ? {
              credits: `${model.price.creditsMin}-${model.price.creditsMax}`,
              usd: `$${model.price.usdMin.toFixed(3)}-$${model.price.usdMax.toFixed(3)}`,
              approximate: model.price.approximate,
            }
          : null),
        fields: Object.entries(model.fields || {}).map(([key, spec]) => ({
          name: key,
          type: spec.type,
          required: spec.required,
          description: spec.description,
          default: spec.default,
        })),
      };

      emit(flags, { data: output }, () => {
        const lines = [
          `Модель: ${model.id}`,
          `Тип: ${model.category}`,
          model.docUrl ? `Документация: ${model.docUrl}` : "",
          model.description ? `Описание: ${model.description}` : "",
          "",
          `Поле для промпта: ${model.meta?.promptField || "—"}`,
          `Поле для изображений: ${model.meta?.imageField || "—"}`,
          `Обязательные поля: ${model.meta?.required?.join(", ") || "—"}`,
          "",
          priceInfo || model.price
            ? `Цена: ${priceInfo ? priceInfo.credits : model.price?.creditsMin}-${model.price?.creditsMax} кредитов ($${priceInfo ? priceInfo.usd : `$${model.price?.usdMin}-${model.price?.usdMax}`})${priceInfo && priceInfo.approximate ? " [≈]" : ""}`
            : "Цена: не известна",
        ];
        return lines.filter((l) => l).join("\n");
      });
    } catch (error) {
      throw error;
    }
  });

modelsCmd
  .command("recommend <category>")
  .description("Рекомендуемая модель по категории")
  .action(async function (category: string) {
    const flags = getGlobalFlags();

    try {
      const models = await loadCatalog();
      const inCategory = models.filter((m) => m.category === category);

      if (inCategory.length === 0) {
        throw new Error(`Нет моделей в категории: ${category}`);
      }

      // Recommend cheapest with good schema
      const sorted = inCategory.sort((a, b) => {
        const aPrice = a.price?.creditsMin || 999999;
        const bPrice = b.price?.creditsMin || 999999;
        return aPrice - bPrice;
      });

      const recommended = sorted[0];

      emit(flags, { data: recommended }, () => `Рекомендуемая модель: ${recommended.id}`);
    } catch (error) {
      throw error;
    }
  });

export default modelsCmd;
