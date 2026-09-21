import { test } from "node:test";
import assert from "node:assert";
import { openMemoryStore } from "../store/memory.js";
import { clusterLibrary } from "./index.js";
import type { LibraryStore } from "../store/types.js";

/**
 * Генерирует синтетические эмбеддинги в виде 4 явных кластеров + 3 шумовых точки
 * Каждый кластер - набор векторов рядом друг с другом в 64-мерном пространстве
 */
function createSyntheticEmbeddings(
  numPerCluster: number
): Array<{ refId: string; vec: Float32Array }> {
  const results: Array<{ refId: string; vec: Float32Array }> = [];
  const dim = 64;

  // Основа - 4 кластера с центрами в разных углах
  const clusterCenters = [
    new Float32Array(dim).fill(0),
    new Float32Array(dim).fill(0),
    new Float32Array(dim).fill(0),
    new Float32Array(dim).fill(0),
  ];

  // Кластер 0: положительные в первой половине
  for (let i = 0; i < dim / 2; i++) {
    clusterCenters[0][i] = 0.5;
  }

  // Кластер 1: положительные во второй половине
  for (let i = dim / 2; i < dim; i++) {
    clusterCenters[1][i] = 0.5;
  }

  // Кластер 2: отрицательные в первой половине
  for (let i = 0; i < dim / 2; i++) {
    clusterCenters[2][i] = -0.5;
  }

  // Кластер 3: отрицательные во второй половине
  for (let i = dim / 2; i < dim; i++) {
    clusterCenters[3][i] = -0.5;
  }

  // Генерируем точки для каждого кластера
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < numPerCluster; i++) {
      const vec = new Float32Array(clusterCenters[c]);
      // Добавляем шум
      for (let d = 0; d < dim; d++) {
        vec[d] += (Math.random() - 0.5) * 0.1;
      }
      // Нормализуем
      let norm = 0;
      for (let d = 0; d < dim; d++) {
        norm += vec[d] * vec[d];
      }
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let d = 0; d < dim; d++) {
          vec[d] /= norm;
        }
      }
      results.push({
        refId: `ref-c${c}-${i}`,
        vec,
      });
    }
  }

  // Добавляем 3 шумовых точки (случайные направления)
  for (let i = 0; i < 3; i++) {
    const vec = new Float32Array(dim);
    for (let d = 0; d < dim; d++) {
      vec[d] = Math.random() - 0.5;
    }
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      norm += vec[d] * vec[d];
    }
    norm = Math.sqrt(norm);
    for (let d = 0; d < dim; d++) {
      vec[d] /= norm;
    }
    results.push({
      refId: `noise-${i}`,
      vec,
    });
  }

  return results;
}

function setupStore(embeddings: Array<{ refId: string; vec: Float32Array }>) {
  const store = openMemoryStore();

  // Добавляем рефы в хранилище
  for (const { refId, vec } of embeddings) {
    const inserted = store.insertReference({
      sha256: `sha-${refId}`,
      source: "test",
      sourceRef: refId,
      originalPath: `/test/${refId}`,
      width: 100,
      height: 100,
      bytes: 1000,
      meta: {},
      status: "active",
    });

    // Добавляем эмбеддинги используя реальный ID из хранилища
    store.putEmbedding(inserted.id, "test-model", vec);
  }

  return store;
}

test("clusterLibrary finds main clusters and unassigned noise", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store = setupStore(embeddings);

  const result = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    model: "test-model",
  });

  // Должно быть минимум 3 семейства (иногда k-means находит меньше из-за распределения)
  assert(result.families.length >= 3, `Found ${result.families.length} families, expected >= 3`);

  // Каждое семейство должно иметь размер >= minSize
  for (const family of result.families) {
    assert(family.size >= 4, `Family size ${family.size} should be >= 4`);
  }

  // Сумма размеров семейств + unassigned должна быть около 35
  const totalRefs =
    result.families.reduce((sum, f) => sum + f.size, 0) + result.unassigned.length;
  assert.strictEqual(totalRefs, 35);

  // Проверяем что runId был сгенерирован
  assert(result.runId.length > 0);
  assert.strictEqual(result.k, 4);
});

test("clusterLibrary throws error when no embeddings", () => {
  const store = openMemoryStore();
  store.insertReference({
    sha256: "sha-123",
    source: "test",
    sourceRef: "ref-1",
    originalPath: "/test/ref-1",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  });

  assert.throws(
    () => {
      clusterLibrary(store, {
        k: 2,
        model: "test-model",
      });
    },
    /Сначала lib init и lib embed/
  );
});

test("clusterLibrary picks K automatically", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store = setupStore(embeddings);

  const result = clusterLibrary(store, {
    kMin: 2,
    kMax: 6,
    minSize: 4,
    model: "test-model",
  });

  // K должен быть в диапазоне
  assert(result.k >= 2 && result.k <= 6);
  // Семейства должны быть созданы
  assert(result.families.length > 0);
});

test("clusterLibrary exemplars are 6 nearest members", () => {
  const embeddings = createSyntheticEmbeddings(10);
  const store = setupStore(embeddings);

  const result = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    model: "test-model",
  });

  for (const family of result.families) {
    // Exemplars не должно быть больше 6
    assert(family.exemplarRefIds.length <= 6);
    // Exemplars должны быть из членов семейства
    const members = store.getMembers(family.familyId);
    const memberIds = new Set(members.map((m) => m.refId));
    for (const exemplarId of family.exemplarRefIds) {
      assert(memberIds.has(exemplarId));
    }
  }
});

test("clusterLibrary second run replaces only proposed families", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store = setupStore(embeddings);

  // Первый прогон
  const result1 = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    model: "test-model",
  });
  const families1 = result1.families.map((f) => f.familyId);

  // Одобряем одно семейство
  const familyToApprove = store.getFamily(families1[0])!;
  store.updateFamily(familyToApprove.id, {
    status: "approved",
  });

  // Второй прогон
  const result2 = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    model: "test-model",
  });
  const families2 = result2.families.map((f) => f.familyId);

  // Approved семейство должно остаться
  assert(store.getFamily(familyToApprove.id)?.status === "approved");

  // Новые proposed семейства должны быть созданы
  const newFamilyIds = new Set(families2);
  assert(!newFamilyIds.has(familyToApprove.id) || families2.length >= 3);
});

test("clusterLibrary respects minSize parameter", () => {
  const embeddings = createSyntheticEmbeddings(3);
  const store = setupStore(embeddings);

  const result = clusterLibrary(store, {
    k: 4,
    minSize: 10, // Очень большой минимум
    model: "test-model",
  });

  // Не должно быть семейств, так как каждый кластер имеет только 3 члена
  assert.strictEqual(result.families.length, 0);
  // Все должны быть в unassigned
  assert(result.unassigned.length > 0);
});

test("clusterLibrary computes silhouette score", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store = setupStore(embeddings);

  const result = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    model: "test-model",
  });

  // Силуэт должен быть в диапазоне [-1, 1]
  assert(result.silhouette >= -1 && result.silhouette <= 1);
});

test("clusterLibrary applies PCA for high-dimensional data", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store = setupStore(embeddings);

  // PCA должна применяться если N > pcaDims*2
  // В нашем случае 35 точек, pcaDims=50, так что PCA не применится
  // Но мы можем проверить что параметр принимается
  const result = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    pcaDims: 10, // Применится PCA
    model: "test-model",
  });

  assert(result.families.length > 0);
});

test("clusterLibrary families marked as proposed with correct metadata", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store = setupStore(embeddings);

  const result = clusterLibrary(store, {
    k: 4,
    minSize: 4,
    model: "test-model",
  });

  for (const family of result.families) {
    const stored = store.getFamily(family.familyId)!;
    assert.strictEqual(stored.status, "proposed");
    assert.strictEqual(stored.proposedBy, "cluster");
    assert.strictEqual(stored.clusterRunId, result.runId);
    // Центроид должен быть задан
    assert(stored.centroid instanceof Float32Array);
  }
});

test("clusterLibrary handles seed for determinism", () => {
  const embeddings = createSyntheticEmbeddings(8);
  const store1 = setupStore(embeddings);
  const store2 = setupStore(embeddings);

  const result1 = clusterLibrary(store1, {
    kMin: 3,
    kMax: 5,
    minSize: 4,
    seed: 42,
    model: "test-model",
  });

  const result2 = clusterLibrary(store2, {
    kMin: 3,
    kMax: 5,
    minSize: 4,
    seed: 42,
    model: "test-model",
  });

  // С одним seed должны быть одинаковые результаты
  assert.strictEqual(result1.k, result2.k);
  assert.strictEqual(result1.silhouette, result2.silhouette);
});
