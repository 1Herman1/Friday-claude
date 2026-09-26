import { test } from "node:test";
import assert from "node:assert/strict";
import { openMemoryStore } from "../store/memory.js";
import type { RefCandidate } from "../importers/types.js";
import type { IngestResult } from "../ingest/ingest.js";
import { collectStyle, splitLimit, MAX_EXEMPLARS, EmptyCollectError } from "./collect.js";

function candidate(n: number): RefCandidate {
  return { url: `https://example.com/${n}.jpg`, source: "fake", sourceRef: `fake:${n}` };
}

/** Поиск, отдающий по запросу столько кандидатов, сколько попросили */
function fakeSearch(perQuery: Record<string, number[]>) {
  const calls: Array<{ query: string; limit: number }> = [];
  return {
    calls,
    search: async function* (query: string, limit: number) {
      calls.push({ query, limit });
      for (const n of (perQuery[query] ?? []).slice(0, limit)) yield candidate(n);
    },
  };
}

type Store = ReturnType<typeof openMemoryStore>;

function insertRef(store: Store, key: string): string {
  return store.insertReference({
    sha256: key,
    source: "fake",
    sourceRef: key,
    originalPath: `/tmp/${key}.jpg`,
    width: 800,
    height: 600,
    bytes: 1024,
    meta: {},
    status: "active",
  }).id;
}

/**
 * Ingest, как настоящий, кладёт референс в хранилище: номера из `dedupOf` —
 * уже лежащие в библиотеке, `failed` — не скачались. Возвращает карту
 * «номер → id», чтобы тесты сверялись с настоящими идентификаторами.
 */
function fakeIngest(store: Store, opts: { dedupOf?: Record<number, string>; failed?: number[] } = {}) {
  const ids = new Map<number, string>();
  const fn = async (c: RefCandidate): Promise<IngestResult> => {
    const n = Number(c.sourceRef.split(":")[1]);
    if (opts.failed?.includes(n)) return { status: "failed", reason: "download" };
    if (opts.dedupOf?.[n]) return { status: "dedup", reason: "sha256", refId: opts.dedupOf[n] };
    if (!ids.has(n)) ids.set(n, insertRef(store, `n${n}`));
    return { status: "ingested", refId: ids.get(n)! };
  };
  return { fn, ids };
}

function seedFamily(exemplars: string[] = []) {
  const store = openMemoryStore();
  const family = store.createFamily({
    name: "Тёплый органический",
    slug: "warm-organic",
    status: "proposed",
    proposedBy: "claude",
    descriptor: { slug: "warm-organic", exemplars },
  });
  return { store, familyId: family.id };
}

test("splitLimit: остаток уходит первым запросам", () => {
  assert.deepEqual(splitLimit(40, 3), [14, 13, 13]);
  assert.deepEqual(splitLimit(40, 5), [8, 8, 8, 8, 8]);
  assert.deepEqual(splitLimit(2, 3), [1, 1, 0]);
});

test("collectStyle: лимит делится между запросами, а не повторяется на каждый", async () => {
  const { store, familyId } = seedFamily();
  const s = fakeSearch({ a: range(1, 30), b: range(31, 60), c: range(61, 90) });
  await collectStyle({ store, familyId, queries: ["a", "b", "c"], limit: 40, search: s.search, ingest: fakeIngest(store).fn });
  assert.deepEqual(s.calls.map((c) => c.limit), [14, 13, 13]);
});

test("collectStyle: к семейству привязывается всё найденное, не только образцы", async () => {
  const { store, familyId } = seedFamily();
  const s = fakeSearch({ a: range(1, 10) });
  const res = await collectStyle({ store, familyId, queries: ["a"], limit: 10, search: s.search, ingest: fakeIngest(store).fn });

  assert.equal(res.memberIds.length, 10);
  assert.equal(store.getMembers(familyId).length, 10, "все десять, а не первые шесть");
});

test("collectStyle: образцы ставятся первыми до шести, если их не было", async () => {
  const { store, familyId } = seedFamily();
  const s = fakeSearch({ a: range(1, 10) });
  const ing = fakeIngest(store);
  const res = await collectStyle({ store, familyId, queries: ["a"], limit: 10, search: s.search, ingest: ing.fn });

  const d = store.getFamily(familyId)!.descriptor as { exemplars: string[] };
  assert.equal(res.exemplarsSet, MAX_EXEMPLARS);
  assert.deepEqual(d.exemplars, [1, 2, 3, 4, 5, 6].map((n) => ing.ids.get(n)));
});

test("collectStyle: отобранные владельцем образцы не перезаписываются", async () => {
  const { store, familyId } = seedFamily(["owner-pick"]);
  const s = fakeSearch({ a: range(1, 5) });
  const res = await collectStyle({ store, familyId, queries: ["a"], limit: 5, search: s.search, ingest: fakeIngest(store).fn });

  const d = store.getFamily(familyId)!.descriptor as { exemplars: string[] };
  assert.deepEqual(d.exemplars, ["owner-pick"]);
  assert.equal(res.exemplarsSet, 0, "не рапортуем образцы, которых не ставили");
});

test("collectStyle: уже лежащий в библиотеке референс тоже становится членом", async () => {
  const { store, familyId } = seedFamily();
  const fromRss = insertRef(store, "from-rss");
  const s = fakeSearch({ a: [1, 2, 3] });
  const res = await collectStyle({
    store,
    familyId,
    queries: ["a"],
    limit: 3,
    search: s.search,
    ingest: fakeIngest(store, { dedupOf: { 2: fromRss } }).fn,
  });

  assert.ok(res.memberIds.includes(fromRss));
  assert.ok(store.getMembers(familyId).some((m) => m.refId === fromRss));
});

test("collectStyle: неудачная загрузка не считается добавленной", async () => {
  const { store, familyId } = seedFamily();
  const s = fakeSearch({ a: [1, 2, 3] });
  const res = await collectStyle({
    store,
    familyId,
    queries: ["a"],
    limit: 3,
    search: s.search,
    ingest: fakeIngest(store, { failed: [2] }).fn,
  });

  assert.equal(res.queries[0].found, 3);
  assert.equal(res.queries[0].added, 2);
  assert.equal(store.getMembers(familyId).length, 2);
});

test("collectStyle: один референс по двум запросам не дублируется", async () => {
  const { store, familyId } = seedFamily();
  const s = fakeSearch({ a: [1, 2], b: [2, 3] });
  const res = await collectStyle({ store, familyId, queries: ["a", "b"], limit: 4, search: s.search, ingest: fakeIngest(store).fn });

  assert.equal(res.memberIds.length, 3);
  assert.equal(store.getMembers(familyId).length, 3);
});

test("collectStyle: повторный сбор дополняет, а не заменяет", async () => {
  const { store, familyId } = seedFamily();
  await collectStyle({ store, familyId, queries: ["a"], limit: 2, search: fakeSearch({ a: [1, 2] }).search, ingest: fakeIngest(store).fn });
  await collectStyle({ store, familyId, queries: ["a"], limit: 2, search: fakeSearch({ a: [3, 4] }).search, ingest: fakeIngest(store).fn });

  assert.equal(store.getMembers(familyId).length, 4);
});

test("collectStyle: ноль по всем запросам — ошибка, а не пустой успех", async () => {
  const { store, familyId } = seedFamily();
  await assert.rejects(
    () => collectStyle({ store, familyId, queries: ["a", "b"], limit: 10, search: fakeSearch({}).search, ingest: fakeIngest(store).fn }),
    EmptyCollectError
  );
  assert.equal(store.getMembers(familyId).length, 0);
});

test("collectStyle: ноль по одному запросу из нескольких — нормально", async () => {
  const { store, familyId } = seedFamily();
  const res = await collectStyle({ store, familyId, queries: ["a", "b"], limit: 4, search: fakeSearch({ a: [1, 2] }).search, ingest: fakeIngest(store).fn });
  assert.equal(res.queries[1].found, 0);
  assert.equal(res.memberIds.length, 2);
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
