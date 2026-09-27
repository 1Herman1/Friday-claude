import { z } from "zod";
import { planRecipe } from "../../core/recipes.js";
import { getProviderInstance, getUsdPerCredit } from "../provider.js";
import { loadCatalog } from "../../core/catalog.js";

export const schema = z.object({
  id: z.string().describe("Recipe ID (e.g., product-card)"),
  subject: z.string().describe("Что генерировать (e.g., ceramic vase)"),
  details: z.string().optional().describe("Что меняется — обязательно для Метаморфозы (before-after)"),
  style: z.string().optional().describe("Style preset slug (optional)"),
});

export async function handler(input: z.infer<typeof schema>) {
  try {
    const { id, subject, details, style } = input;

    const provider = await getProviderInstance();
    const catalog = await loadCatalog();

    const plan = await planRecipe(id, {
      subject,
      details,
      style,
      catalog,
      provider,
    });

    if (!plan) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Recipe ${id} not found` }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(plan, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
}
