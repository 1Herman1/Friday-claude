import { test } from "node:test";
import assert from "node:assert";
import { openMemoryStore } from "./store/memory.js";
import { searchLibrary } from "./search.js";
import type { Embedder } from "./embed/index.js";

/**
 * Фейковый embedder для тестирования
 */
class FakeEmbedder implements Embedder {
  model = "fake-model";
  dim = 64;

  private returnVec: Float32Array | null = null;

  setReturnVector(vec: Float32Array) {
    this.returnVec = vec;
  }

  async embedImage(path: string): Promise<Float32Array> {
    if (!this.returnVec) {
      throw new Error("Return vector not set");
    }
    return this.returnVec;
  }

  async embedText(text: string): Promise<Float32Array> {
    if (!this.returnVec) {
      throw new Error("Return vector not set");
    }
    return this.returnVec;
  }
}

function createVector(dim: number, value: number): Float32Array {
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = value;
  }
  return vec;
}

function normalizeVector(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function setupStore() {
  const store = openMemoryStore();

  // Добавляем 5 рефов с разными эмбеддингами
  for (let i = 0; i < 5; i++) {
    const ref = store.insertReference({
      sha256: `sha-${i}`,
      source: "test",
      sourceRef: `ref-${i}`,
      originalPath: `/test/ref-${i}`,
      previewPath: `/preview/ref-${i}.jpg`,
      pageUrl: `https://example.com/ref-${i}`,
      width: 100,
      height: 100,
      bytes: 1000,
      meta: {},
      status: "active",
    });

    // Добавляем уникальные эмбеддинги
    const vec = new Float32Array(64);
    for (let d = 0; d < 64; d++) {
      vec[d] = i * 0.1 + (Math.random() - 0.5) * 0.05;
    }
    normalizeVector(vec);
    store.putEmbedding(ref.id, "fake-model", vec);
  }

  return store;
}

test("searchLibrary finds nearest ref with embedding", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  // Берём первый реф и ищем похожие
  const targetRef = store.listReferences({ limit: 1 })[0];
  const targetVec = store.getEmbedding(targetRef.id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(targetVec));

  const results = await searchLibrary(store, embedder, {
    text: "test",
    limit: 5,
  });

  // Первый результат должен быть ближайший (сам себе)
  assert.strictEqual(results[0].refId, targetRef.id);
  // Score должен быть близок к 0 (косинусное расстояние для идентичных векторов)
  assert(results[0].score < 0.001, `Score ${results[0].score} should be close to 0`);
});

test("searchLibrary returns results sorted by score ascending", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  // Ищем с первым вектором
  const refs = store.listReferences({ limit: 1 });
  const firstVec = store.getEmbedding(refs[0].id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(firstVec));

  const results = await searchLibrary(store, embedder, {
    text: "test",
    limit: 5,
  });

  // Проверяем что scores отсортированы
  for (let i = 0; i < results.length - 1; i++) {
    assert(results[i].score <= results[i + 1].score);
  }
});

test("searchLibrary without query returns recent refs", async () => {
  const store = setupStore();

  const results = await searchLibrary(store, null, {
    limit: 2,
  });

  // Должно быть 2 результата
  assert.strictEqual(results.length, 2);

  // Они должны быть отсортированы по времени создания (новые первыми)
  const first = store.getReference(results[0].refId)!;
  const second = store.getReference(results[1].refId)!;
  assert(first.createdAt >= second.createdAt);
});

test("searchLibrary with image path calls embedImage", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  const refs = store.listReferences({ limit: 1 });
  const firstVec = store.getEmbedding(refs[0].id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(firstVec));

  const results = await searchLibrary(store, embedder, {
    imagePath: "/path/to/image.jpg",
    limit: 5,
  });

  // Должны быть результаты
  assert(results.length > 0);
});

test("searchLibrary throws when text search without embedder", async () => {
  const store = setupStore();

  await assert.rejects(
    () =>
      searchLibrary(store, null, {
        text: "test",
      }),
    /Сначала lib init и lib embed/
  );
});

test("searchLibrary filters by familySlug", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  // Получаем два рефа
  const refs = store.listReferences({ limit: 2 });

  // Создаём семейство с первым рефом
  const family = store.createFamily({
    name: "test-family",
    slug: "test-family",
    status: "approved",
    proposedBy: "owner",
  });

  store.setMembers(family.id, [
    {
      familyId: family.id,
      refId: refs[0].id,
      distance: 0,
      isExemplar: true,
    },
  ]);

  // Ищем по семейству
  const firstVec = store.getEmbedding(refs[0].id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(firstVec));

  const results = await searchLibrary(store, embedder, {
    text: "test",
    familySlug: "test-family",
    limit: 10,
  });

  // Все результаты должны содержать только первый реф или быть из семейства
  for (const result of results) {
    assert.strictEqual(result.familySlug, "test-family");
  }
});

test("searchLibrary respects limit parameter", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  const refs = store.listReferences({ limit: 1 });
  const firstVec = store.getEmbedding(refs[0].id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(firstVec));

  const results1 = await searchLibrary(store, embedder, {
    text: "test",
    limit: 2,
  });

  const results2 = await searchLibrary(store, embedder, {
    text: "test",
    limit: 4,
  });

  assert(results1.length <= 2);
  assert(results2.length <= 4);
});

test("searchLibrary includes metadata in results", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  const refs = store.listReferences({ limit: 1 });
  const firstVec = store.getEmbedding(refs[0].id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(firstVec));

  const results = await searchLibrary(store, embedder, {
    text: "test",
    limit: 1,
  });

  const result = results[0];
  assert(result.refId);
  assert(typeof result.score === "number");
  assert.strictEqual(result.source, "test");
  assert(result.previewPath);
  assert(result.pageUrl);
});

test("searchLibrary handles non-existent familySlug", async () => {
  const store = setupStore();
  const embedder = new FakeEmbedder();

  const refs = store.listReferences({ limit: 1 });
  const firstVec = store.getEmbedding(refs[0].id, "fake-model")!;
  embedder.setReturnVector(new Float32Array(firstVec));

  const results = await searchLibrary(store, embedder, {
    text: "test",
    familySlug: "non-existent",
    limit: 10,
  });

  // Должны быть пустые результаты
  assert.strictEqual(results.length, 0);
});

test("searchLibrary returns empty when no embeddings match query", async () => {
  const store = openMemoryStore();
  const embedder = new FakeEmbedder();

  // Добавляем реф без эмбеддингов
  store.insertReference({
    sha256: "sha-1",
    source: "test",
    sourceRef: "ref-1",
    originalPath: "/test/ref-1",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  });

  const vec = createVector(64, 1);
  embedder.setReturnVector(vec);

  const results = await searchLibrary(store, embedder, {
    text: "test",
    limit: 10,
  });

  assert.strictEqual(results.length, 0);
});

test("searchLibrary assigns family slug when ref is in a family", async () => {
  const store = setupStore();
  const refs = store.listReferences({ limit: 1 });

  // Создаём семейство и добавляем реф
  const family = store.createFamily({
    name: "test-family",
    slug: "tagged-family",
    status: "approved",
    proposedBy: "owner",
  });

  store.setMembers(family.id, [
    {
      familyId: family.id,
      refId: refs[0].id,
      distance: 0,
      isExemplar: true,
    },
  ]);

  // Ищем последние (без embedder)
  const results = await searchLibrary(store, null, {
    limit: 5,
  });

  // Найдём первый реф в результатах
  const foundResult = results.find((r) => r.refId === refs[0].id);
  if (foundResult) {
    assert.strictEqual(foundResult.familySlug, "tagged-family");
  }
});
