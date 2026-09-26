import { z } from "zod";
import { listRecipes } from "../../core/recipes.js";

export const schema = z.object({});

export async function handler() {
  try {
    const recipes = await listRecipes();

    const data = recipes.map((r) => ({
      id: r.id,
      title: r.title,
      goal: r.goal,
      steps_count: r.steps_count,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data, null, 2),
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
