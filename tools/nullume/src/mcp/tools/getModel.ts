import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { formatError, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  id: z.string().describe("ID модели (например: nano-banana-2-lite)"),
});

export async function handler(args: { id: string }) {
  try {
    const provider = await getProviderInstance();
    const model = await provider.model(args.id);
    const usdPerCredit = getUsdPerCredit();

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: model.id,
              category: model.category,
              description: model.description,
              api: model.api,
              doc_url: model.docUrl,
              schema_source: model.schemaSource,
              stale: model.stale,
              price: model.price
                ? {
                    credits_min: model.price.creditsMin,
                    credits_max: model.price.creditsMax,
                    usd_min: formatPrice(model.price.creditsMin, usdPerCredit),
                    usd_max: formatPrice(model.price.creditsMax, usdPerCredit),
                    approximate: model.price.approximate,
                  }
                : null,
              fields: model.fields,
              meta: {
                prompt_field: model.meta.promptField,
                image_field: model.meta.imageField,
                image_list: model.meta.imageList,
                required: model.meta.required,
                defaults: model.meta.defaults,
              },
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
