import { cosine } from "./embed/math.js";
import type { LibraryStore, Reference } from "./store/types.js";
import type { Embedder } from "./embed/index.js";
import { UsageError } from "../core/errors.js";

export interface SearchHit {
  refId: string;
  score: number;
  previewPath?: string;
  pageUrl?: string;
  source: string;
  familySlug?: string;
}

export interface SearchOptions {
  text?: string;
  imagePath?: string;
  familySlug?: string;
  limit?: number;
}

/**
 * Ищет похожие рефы по тексту или изображению
 * Без embedder и без text/imagePath возвращает последние N рефов по createdAt
 */
export async function searchLibrary(
  store: LibraryStore,
  embedder: Embedder | null,
  opts: SearchOptions
): Promise<SearchHit[]> {
  const { text, imagePath, familySlug, limit = 12 } = opts;

  // Если нет запроса (ни text, ни imagePath), возвращаем последние
  if (!text && !imagePath) {
    const refs = store.listReferences({
      status: "active",
      limit,
      offset: 0,
    });

    // Сортируем по createdAt в обратном порядке (новые первыми)
    refs.sort((a, b) => b.createdAt - a.createdAt);

    const hits: SearchHit[] = refs.slice(0, limit).map((ref) => {
      let familySlugForHit: string | undefined;
      if (familySlug) {
        // Фильтруем по семейству если задан
        const members = store.getMembers(ref.id);
        if (!members.some((m) => m.familyId)) {
          return null as any;
        }
      }

      // Пытаемся найти семейство для этого рефа
      const allFamilies = store.listFamilies();
      for (const family of allFamilies) {
        const members = store.getMembers(family.id);
        if (members.some((m) => m.refId === ref.id)) {
          familySlugForHit = family.slug;
          break;
        }
      }

      return {
        refId: ref.id,
        score: 0, // No scoring without embedding
        previewPath: ref.previewPath,
        pageUrl: ref.pageUrl,
        source: ref.source,
        familySlug: familySlugForHit,
      };
    });

    return hits.filter((h) => h !== null);
  }

  // Если есть текст или изображение, но нет embedder - ошибка
  if (!embedder) {
    throw new UsageError("Сначала lib init и lib embed");
  }

  // Вычисляем эмбеддинг запроса
  let queryVec: Float32Array;
  if (text) {
    queryVec = await embedder.embedText(text);
  } else if (imagePath) {
    queryVec = await embedder.embedImage(imagePath);
  } else {
    throw new UsageError("Требуется text или imagePath");
  }

  // Получаем все эмбеддинги
  const embeddings = store.listEmbeddings(embedder.model);
  if (embeddings.length === 0) {
    return [];
  }

  // Вычисляем косинусные расстояния
  const scores: Array<{ refId: string; score: number }> = embeddings.map(
    (e) => ({
      refId: e.refId,
      score: cosine(queryVec, e.vec),
    })
  );

  // Сортируем по score (меньше = ближе)
  scores.sort((a, b) => a.score - b.score);

  // Если задан familySlug, фильтруем
  let candidateRefIds = scores.map((s) => s.refId);
  if (familySlug) {
    const family = store.getFamilyBySlug(familySlug);
    if (!family) {
      return [];
    }
    const members = store.getMembers(family.id);
    const memberRefIds = new Set(members.map((m) => m.refId));
    candidateRefIds = candidateRefIds.filter((id) => memberRefIds.has(id));
  }

  // Берём топ limit и преобразуем в SearchHit
  const hits: SearchHit[] = [];
  const scoreMap = new Map(scores.map((s) => [s.refId, s.score]));

  for (const refId of candidateRefIds.slice(0, limit)) {
    const ref = store.getReference(refId);
    if (!ref) continue;

    let hitFamilySlug: string | undefined;
    if (familySlug) {
      hitFamilySlug = familySlug;
    } else {
      // Пытаемся найти семейство для этого рефа
      const allFamilies = store.listFamilies();
      for (const family of allFamilies) {
        const members = store.getMembers(family.id);
        if (members.some((m) => m.refId === refId)) {
          hitFamilySlug = family.slug;
          break;
        }
      }
    }

    hits.push({
      refId,
      score: scoreMap.get(refId) || 0,
      previewPath: ref.previewPath,
      pageUrl: ref.pageUrl,
      source: ref.source,
      familySlug: hitFamilySlug,
    });
  }

  return hits;
}
