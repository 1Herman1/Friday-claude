import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { formatError, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  category: z.enum(["image", "video", "audio"]).describe("Категория моделей"),
});

export async function handler(args: { category: string }) {
  try {
    const provider = await getProviderInstance();
    const models = await provider.models();
    const filtered = models
      .filter((m: any) => m.category === args.category)
      .sort((a: any, b: any) => {
        // Sort by price (cheaper first), then by name
        const priceA = a.price?.creditsMin ?? Infinity;
        const priceB = b.price?.creditsMin ?? Infinity;
        if (priceA !== priceB) return priceA - priceB;
        return a.id.localeCompare(b.id);
      })
      .slice(0, 10);

    const usdPerCredit = getUsdPerCredit();

    const compact = filtered.map((m: any) => ({
      id: m.id,
      description: m.description,
      credits_min: m.price?.creditsMin,
      usd_min: m.price ? formatPrice(m.price.creditsMin, usdPerCredit) : undefined,
      approximate: m.price?.approximate ?? false,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ category: args.category, recommended: compact }, null, 2),
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
