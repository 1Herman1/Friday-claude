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

  const familyByRef = new Map<string, string | undefined>();
  const familyIdBySlug = new Map<string, string>();
  for (const family of store.listFamilies()) {
    if (family.slug) familyIdBySlug.set(family.slug, family.id);
    for (const m of store.getMembers(family.id)) {
      if (!familyByRef.has(m.refId)) familyByRef.set(m.refId, family.slug);
    }
  }
  const familyId = familySlug ? familyIdBySlug.get(familySlug) : undefined;
  if (familySlug && !familyId) return [];
  const inFamily = (refId: string): boolean =>
    !familyId || store.getMembers(familyId).some((m) => m.refId === refId);

  // Без модели: без запроса — последние; с текстом — подстрочный поиск по
  // источнику, ссылке, автору и тегам. Поиск по картинке требует модель.
  if (!embedder || !text && !imagePath) {
    if (imagePath && !embedder) {
      throw new UsageError("Поиск по картинке требует модель: сначала lib init и lib embed");
    }
    const needle = text?.toLowerCase();
    const refs = store
      .listReferences({ status: "active", limit: needle ? 10000 : limit, offset: 0 })
      .filter((ref) => inFamily(ref.id))
      .filter((ref) => {
        if (!needle) return true;
        const hay = [
          ref.sourceRef,
          ref.source,
          ref.pageUrl,
          ref.author,
          ...store.getTags(ref.id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    refs.sort((a, b) => b.createdAt - a.createdAt);
    return refs.slice(0, limit).map((ref) => ({
      refId: ref.id,
      score: 0,
      previewPath: ref.previewPath,
      pageUrl: ref.pageUrl,
      source: ref.source,
      familySlug: familyByRef.get(ref.id),
    }));
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
  if (familyId) {
    candidateRefIds = candidateRefIds.filter((id) => inFamily(id));
  }

  // Берём топ limit и преобразуем в SearchHit
  const hits: SearchHit[] = [];
  const scoreMap = new Map(scores.map((s) => [s.refId, s.score]));

  for (const refId of candidateRefIds.slice(0, limit)) {
    const ref = store.getReference(refId);
    if (!ref) continue;

    const hitFamilySlug = familySlug ?? familyByRef.get(refId);

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
