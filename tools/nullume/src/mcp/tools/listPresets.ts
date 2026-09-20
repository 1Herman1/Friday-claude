import { z } from "zod";
import { getProviderInstance } from "../provider.js";
import { loadPresets, resolvePreset } from "../../core/presets.js";
import { getUsdPerCredit } from "../provider.js";

export const schema = z.object({});

export async function handler() {
  try {
    const provider = await getProviderInstance();
    const presets = await loadPresets();
    const catalog = await provider.models();
    const usdPerCredit = getUsdPerCredit();

    const resolved = await Promise.all(
      presets.map(async (p) => {
        const r = await resolvePreset(p.id, catalog);
        if (!r) return null;

        const modelInfo = await provider.model(r.resolvedModel);
        const cost = modelInfo.price
          ? (modelInfo.price.creditsMax * usdPerCredit).toFixed(2)
          : "?";

        return {
          id: r.id,
          title: r.title,
          category: r.category,
          task: r.task,
          model: r.resolvedModel,
          substituted: r.substituted,
          cost_usd: cost,
          prompt_hint: r.promptHint,
          notes: r.notes,
        };
      })
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(resolved.filter(Boolean), null, 2),
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
