import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { formatError, formatPrice } from "../utils.js";

export const schema = z.object({});

export async function handler() {
  try {
    const provider = await getProviderInstance();
    const balance = await provider.balance();
    const usdPerCredit = 0.005;
    const usd = balance.total * usdPerCredit;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            credits: balance.total,
            spent_credits: balance.used,
            usd: formatPrice(balance.total, usdPerCredit),
            spent_usd: formatPrice(balance.used, usdPerCredit),
          }, null, 2),
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
