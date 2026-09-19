import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { formatError, formatPrice } from "../utils.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({
  model: z.string().describe("ID модели"),
  input: z.record(z.string(), z.unknown()).optional().describe("Input параметры для модели"),
});

export async function handler(args: { model: string; input?: Record<string, unknown> }) {
  try {
    const provider = await getProviderInstance();
    const estimate = await provider.estimate(args.model, args.input || {});
    const usdPerCredit = getUsdPerCredit();

    if (!estimate) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              model: args.model,
              estimate: null,
              reason: "Стоимость неизвестна",
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              model: args.model,
              estimate: {
                credits_min: estimate.creditsMin,
                credits_max: estimate.creditsMax,
                usd_min: formatPrice(estimate.creditsMin, usdPerCredit),
                usd_max: formatPrice(estimate.creditsMax, usdPerCredit),
                approximate: estimate.approximate,
                source: estimate.source,
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
