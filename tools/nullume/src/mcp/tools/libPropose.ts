import { z } from "zod";
import { getStore } from "../library.js";
import { formatError } from "../utils.js";
import { applyProposal } from "../../library/families/index.js";
import { StyleDescriptorSchema } from "../../library/families/descriptor.js";

export const schema = z.object({
  families: z
    .array(
      z.object({
        family_id: z.string().describe("ID семейства"),
        name: z.string().describe("Имя семейства"),
        slug: z.string().describe("Слаг семейства (lowercase, hyphen-separated)"),
        descriptor: StyleDescriptorSchema.describe("Дескриптор стиля"),
      })
    )
    .describe("Список семейств с дескрипторами для применения"),
});

export function handler(args: {
  families: Array<{
    family_id: string;
    name: string;
    slug: string;
    descriptor: any;
  }>;
}) {
  try {
    const store = getStore();

    // Применить предложение
    applyProposal(store, {
      families: args.families.map((f) => ({
        familyId: f.family_id,
        name: f.name,
        slug: f.slug,
        descriptor: f.descriptor,
      })),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              updated: args.families.length,
              next: "утвердить в nullume lib dashboard",
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
