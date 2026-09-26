import type { LibraryStore } from "../store/types.js";
import type { RefCandidate } from "../importers/types.js";
import type { IngestResult } from "../ingest/ingest.js";

export const MAX_EXEMPLARS = 6;

export class EmptyCollectError extends Error {
  constructor(queryCount: number) {
    super(
      `Источник не вернул ни одного результата ни по одному из ${queryCount} запросов. ` +
        `Проверьте сессию или ключ источника и сообщения выше.`
    );
    this.name = "EmptyCollectError";
  }
}

export interface CollectQueryResult {
  query: string;
  limit: number;
  found: number;
  added: number;
}

export interface CollectResult {
  queries: CollectQueryResult[];
  /** Референсы, привязанные к семейству этим прогоном (новые и уже бывшие в библиотеке) */
  memberIds: string[];
  /** Сколько образцов проставлено сейчас; 0, если у стиля они уже были */
  exemplarsSet: number;
}

export interface CollectOptions {
  store: LibraryStore;
  familyId: string;
  queries: string[];
  limit: number;
  search: (query: string, limit: number) => AsyncIterable<RefCandidate>;
  ingest: (candidate: RefCandidate) => Promise<IngestResult>;
  log?: (msg: string) => void;
}

/** Общий лимит делится поровну, остаток уходит первым запросам */
export function splitLimit(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Собирает референсы под стиль и привязывает их к семейству.
 * Привязывается всё найденное, в том числе то, что уже лежало в библиотеке:
 * совпадение с собранным раньше — самое ценное. Образцы ставятся только
 * если у стиля их ещё нет — отобранное владельцем не перезаписываем.
 */
export async function collectStyle(opts: CollectOptions): Promise<CollectResult> {
  const { store, familyId, queries, log = () => {} } = opts;
  const family = store.getFamily(familyId);
  if (!family) throw new Error(`Семейство ${familyId} не найдено`);

  const limits = splitLimit(opts.limit, queries.length);
  const memberIds: string[] = [];
  const results: CollectQueryResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const limit = limits[i];
    const row: CollectQueryResult = { query, limit, found: 0, added: 0 };
    if (limit === 0) {
      results.push(row);
      continue;
    }

    log(`Поиск: "${query}" (лимит ${limit})`);
    for await (const candidate of opts.search(query, limit)) {
      row.found++;
      const res = await opts.ingest(candidate);
      if ((res.status === "ingested" || res.status === "dedup") && res.refId) {
        if (!memberIds.includes(res.refId)) {
          memberIds.push(res.refId);
          row.added++;
        }
      }
    }
    results.push(row);
  }

  // Ноль по всем запросам — почти наверняка отказ источника (сессия, ключ,
  // блокировка), а не «ничего подходящего». Успехом это не рапортуем.
  if (results.every((r) => r.found === 0)) {
    throw new EmptyCollectError(queries.length);
  }

  const members = store.getMembers(familyId);
  for (const refId of memberIds) {
    if (!members.some((m) => m.refId === refId)) {
      members.push({ familyId, refId, distance: 0, isExemplar: false });
    }
  }
  store.setMembers(familyId, members);

  let exemplarsSet = 0;
  const descriptor = family.descriptor as { exemplars?: string[] } | undefined;
  if (descriptor && (!descriptor.exemplars || descriptor.exemplars.length === 0) && memberIds.length > 0) {
    const exemplars = memberIds.slice(0, MAX_EXEMPLARS);
    store.updateFamily(familyId, { descriptor: { ...descriptor, exemplars } });
    exemplarsSet = exemplars.length;
  }

  return { queries: results, memberIds, exemplarsSet };
}
