import { z } from "zod";
import { searchLibrary } from "../../library/search.js";
import { getStore, getEmbedderInstance } from "../library.js";
import { formatError } from "../utils.js";

export const schema = z.object({
  query: z.string().optional().describe("Текстовый запрос для поиска"),
  image: z.string().optional().describe("Путь к файлу изображения для поиска по визуальному сходству"),
  family: z.string().optional().describe("Слаг семейства для фильтрации результатов"),
  limit: z.number().int().min(1).max(50).default(12).describe("Максимум результатов (1-50)"),
});

export async function handler(args: {
  query?: string;
  image?: string;
  family?: string;
  limit?: number;
}) {
  try {
    const store = getStore();
    const embedder = await getEmbedderInstance();

    // Если есть запрос но нет эмбеддера
    if ((args.query || args.image) && !embedder) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Эмбеддер не инициализирован. Запустите: nullume lib init",
              isError: true,
            }),
          },
        ],
        isError: true,
      };
    }

    const results = await searchLibrary(store, embedder, {
      text: args.query,
      imagePath: args.image,
      familySlug: args.family,
      limit: args.limit || 12,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(results, null, 2),
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
