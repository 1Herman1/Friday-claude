import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { formatError } from "../utils.js";

export const schema = z.object({
  path: z.string().describe("Путь к файлу для загрузки"),
});

export async function handler(args: { path: string }) {
  try {
    const provider = await getProviderInstance();
    const url = await provider.upload(args.path);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ path: args.path, uploaded_url: url }, null, 2),
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
