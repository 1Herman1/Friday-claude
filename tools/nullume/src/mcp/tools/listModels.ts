import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { searchModels } from "../../core/catalog.js";
import { formatError, truncateList, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  category: z.enum(["image", "video", "audio"]).optional().describe("Фильтр по категории"),
  search: z.string().optional().describe("Поиск по имени/описанию"),
  refresh: z.boolean().optional().default(false).describe("Обновить каталог с сервера"),
});

export async function handler(args: { category?: string; search?: string; refresh?: boolean }) {
  try {
    const provider = await getProviderInstance();
    let models = await provider.models();

    if (args.search) {
      models = searchModels(models, args.search);
    }

    if (args.category) {
      models = models.filter((m: any) => m.category === args.category);
    }

    const usdPerCredit = getUsdPerCredit();
    const [limited, truncated] = truncateList(models, 60, 60);

    const compact = limited.map((m: any) => ({
      id: m.id,
      category: m.category,
      credits_min: m.price?.creditsMin,
      credits_max: m.price?.creditsMax,
      usd_min: m.price ? formatPrice(m.price.creditsMin, usdPerCredit) : undefined,
      usd_max: m.price ? formatPrice(m.price.creditsMax, usdPerCredit) : undefined,
      approximate: m.price?.approximate ?? false,
      stale: m.stale ?? false,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              models: compact,
              ...(truncated > 0 && { truncated }),
            },
            null,
            2
          ),
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
