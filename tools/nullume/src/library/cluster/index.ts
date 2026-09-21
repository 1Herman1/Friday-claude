import { randomUUID } from "node:crypto";
import { cosine, normalize } from "../embed/math.js";
import { kmeansPP } from "./kmeans.js";
import { pca } from "./pca.js";
import { silhouette, pickK } from "./silhouette.js";
import type { LibraryStore, Family, FamilyMember } from "../store/types.js";
import { UsageError } from "../../core/errors.js";

export interface ClusterRunResult {
  runId: string;
  k: number;
  silhouette: number;
  families: Array<{
    familyId: string;
    size: number;
    exemplarRefIds: string[];
  }>;
  unassigned: string[];
}

export interface ClusterOptions {
  k?: number;
  kMin?: number;
  kMax?: number;
  minSize?: number;
  pcaDims?: number;
  seed?: number;
  model: string;
}

/**
 * Кластеризует библиотеку рефов на основе эмбеддингов
 */
export function clusterLibrary(
  store: LibraryStore,
  opts: ClusterOptions
): ClusterRunResult {
  const {
    k: providedK,
    kMin = 3,
    kMax = 12,
    minSize = 4,
    pcaDims = 50,
    seed = 42,
    model,
  } = opts;

  // Получаем все эмбеддинги для модели
  const embeddings = store.listEmbeddings(model);
  if (embeddings.length === 0) {
    throw new UsageError("Сначала lib init и lib embed");
  }

  const runId = randomUUID();

  // Нормализуем векторы (обычно уже нормализованы, но на всякий случай)
  const vectors = embeddings.map((e) => {
    const normalized = new Float32Array(e.vec);
    normalize(normalized);
    return normalized;
  });

  const refIds = embeddings.map((e) => e.refId);
  let workingVectors = vectors;
  let workingRefIds = refIds;

  // Применяем PCA если данных много
  if (vectors.length > pcaDims * 2) {
    const pcaModel = pca(vectors, pcaDims);
    workingVectors = pcaModel.projected.map((v) => new Float32Array(v));
  }

  // Определяем K
  let finalK = providedK;
  if (!finalK) {
    const pickKResult = pickK(workingVectors, { kMin, kMax, seed });
    finalK = pickKResult.k;
  }

  // K-means++
  const kmeansResult = kmeansPP(workingVectors, finalK, {
    iters: 50,
    seed,
  });

  // Вычисляем silhouette
  const silhouetteScore = silhouette(workingVectors, kmeansResult.labels);

  // Удаляем предыдущие proposed-семейства только один раз в начале
  store.deleteProposedFamilies();

  // Группируем рефы по кластерам
  const clusters = new Map<number, string[]>();
  for (let i = 0; i < refIds.length; i++) {
    const clusterIdx = kmeansResult.labels[i];
    if (!clusters.has(clusterIdx)) {
      clusters.set(clusterIdx, []);
    }
    clusters.get(clusterIdx)!.push(refIds[i]);
  }

  // Создаём семейства для кластеров размером >= minSize
  const resultFamilies: Array<{
    familyId: string;
    size: number;
    exemplarRefIds: string[];
  }> = [];
  const unassigned: string[] = [];

  for (let clusterIdx = 0; clusterIdx < finalK; clusterIdx++) {
    const memberRefIds = clusters.get(clusterIdx) || [];

    if (memberRefIds.length < minSize) {
      // Кластер слишком маленький - в unassigned
      unassigned.push(...memberRefIds);
    } else {
      // Создаём семейство
      const centroid = kmeansResult.centroids[clusterIdx];
      const family = store.createFamily({
        name: `cluster-${clusterIdx}`,
        slug: `cluster-${runId.slice(0, 6)}-${clusterIdx}`,
        status: "proposed",
        proposedBy: "cluster",
        clusterRunId: runId,
        centroid: new Float32Array(centroid),
      });

      // Вычисляем расстояния до центроида и выбираем exemplars
      // Используем workingVectors для расчёта, поскольку centroid в этом пространстве
      const membersWithDistance = memberRefIds.map((refId) => {
        const index = refIds.indexOf(refId);
        const vec = workingVectors[index];
        const distance = 1 - cosine(vec, centroid);
        return { refId, distance };
      });

      // Сортируем по расстоянию и берём 6 ближайших как exemplars
      membersWithDistance.sort((a, b) => a.distance - b.distance);
      const exemplarRefIds = membersWithDistance
        .slice(0, 6)
        .map((m) => m.refId);

      // Создаём members
      const members: FamilyMember[] = membersWithDistance.map((m) => ({
        familyId: family.id,
        refId: m.refId,
        distance: m.distance,
        isExemplar: exemplarRefIds.includes(m.refId),
      }));

      store.setMembers(family.id, members);

      resultFamilies.push({
        familyId: family.id,
        size: memberRefIds.length,
        exemplarRefIds,
      });
    }
  }

  return {
    runId,
    k: finalK,
    silhouette: silhouetteScore,
    families: resultFamilies,
    unassigned,
  };
}
