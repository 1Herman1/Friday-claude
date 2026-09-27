import { z } from "zod";
import { planRecipe, runRecipe as executeRecipe } from "../../core/recipes.js";
import { getProviderInstance } from "../provider.js";
import { loadCatalog } from "../../core/catalog.js";

export const schema = z.object({
  id: z.string().describe("Recipe ID (e.g., product-card)"),
  subject: z.string().describe("Что генерировать (e.g., ceramic vase)"),
  details: z.string().optional().describe("Что меняется — обязательно для Метаморфозы (before-after)"),
  style: z.string().optional().describe("Style preset slug (optional)"),
  max_credits: z
    .number()
    .int()
    .positive()
    .describe("Maximum credits to spend. Must be set to prevent overspending."),
});

export async function handler(input: z.infer<typeof schema>) {
  try {
    const { id, subject, details, style, max_credits } = input;

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

    // Run the recipe
    const result = await executeRecipe(plan, {
      provider,
      style,
      maxCredits: max_credits,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
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
