import { z } from "zod";
import { getStore } from "../library.js";
import { formatError } from "../utils.js";

export const schema = z.object({
  slug: z.string().describe("Слаг семейства"),
});

export function handler(args: { slug: string }) {
  try {
    const store = getStore();

    const family = store.getFamilyBySlug(args.slug);
    if (!family) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Семейство "${args.slug}" не найдено` }),
          },
        ],
        isError: true,
      };
    }

    const members = store.getMembers(family.id);

    // Собрать exemplars (первые N членов с previewPath)
    const exemplarPaths = members
      .slice(0, 6)
      .map((m) => {
        const ref = store.getReference(m.refId);
        return ref?.previewPath || null;
      })
      .filter((p) => p !== null);

    const result = {
      id: family.id,
      slug: family.slug,
      name: family.name,
      status: family.status,
      size: members.length,
      descriptor: family.descriptor || null,
      exemplar_paths: exemplarPaths,
    };

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
      content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}
