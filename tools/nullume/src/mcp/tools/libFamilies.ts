import { z } from "zod";
import { getStore } from "../library.js";
import { formatError } from "../utils.js";

export const schema = z.object({
  status: z.enum(["approved", "proposed"]).optional().describe("Фильтр по статусу"),
});

export function handler(args: { status?: "approved" | "proposed" }) {
  try {
    const store = getStore();

    const families = store.listFamilies(args.status);
    const result = families.map((f) => {
      const members = store.getMembers(f.id);
      const descriptor = f.descriptor as any;
      return {
        slug: f.slug,
        name: f.name,
        status: f.status,
        size: members.length,
        summary: descriptor?.summary || null,
      };
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
      content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}
