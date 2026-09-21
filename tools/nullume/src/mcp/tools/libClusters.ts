import { z } from "zod";
import { getStore, getEmbedderInstance } from "../library.js";
import { formatError } from "../utils.js";
import { clusterLibrary } from "../../library/cluster/index.js";
import { buildProposalContext } from "../../library/families/propose.js";

export const schema = z.object({
  k: z.number().int().min(2).optional().describe("Количество кластеров (если не задано, определяется автоматически)"),
  k_min: z.number().int().min(2).default(3).describe("Минимальное количество кластеров"),
  k_max: z.number().int().max(20).default(12).describe("Максимальное количество кластеров"),
  min_size: z.number().int().min(1).default(4).describe("Минимальный размер кластера"),
});

export async function handler(args: {
  k?: number;
  k_min?: number;
  k_max?: number;
  min_size?: number;
}) {
  try {
    const store = getStore();
    const embedder = await getEmbedderInstance();

    if (!embedder) {
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

    // Запустить кластеризацию
    const clusterResult = clusterLibrary(store, {
      k: args.k,
      kMin: args.k_min,
      kMax: args.k_max,
      minSize: args.min_size,
      model: embedder.model,
    });

    // Создать семейства и построить контекст для Claude
    const contextList = buildProposalContext(store, { exemplarsPerFamily: 6 });

    // Вернуть результат с контекстом
    const result = {
      run_id: clusterResult.runId,
      k: clusterResult.k,
      silhouette: clusterResult.silhouette,
      families_count: clusterResult.families.length,
      families: clusterResult.families.map((f) => ({
        family_id: f.familyId,
        size: f.size,
        exemplar_ref_ids: f.exemplarRefIds,
      })),
      unassigned: clusterResult.unassigned,
      proposal_context: contextList,
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
