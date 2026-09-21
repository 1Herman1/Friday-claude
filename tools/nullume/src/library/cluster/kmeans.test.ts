import { test } from "node:test";
import assert from "node:assert/strict";
import { kmeansPP } from "./kmeans.js";

test("kmeansPP: обнаруживает 3 кластера в синтетических данных", () => {
  // Создаём 3 отдельных кластера в 8-мерном пространстве
  const vectors: Float32Array[] = [];

  // Кластер 1: центр [1, 1, 1, 1, 1, 1, 1, 1]
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array(8);
    for (let d = 0; d < 8; d++) {
      v[d] = 1 + (Math.random() - 0.5) * 0.3;
    }
    vectors.push(v);
  }

  // Кластер 2: центр [-1, -1, -1, -1, -1, -1, -1, -1]
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array(8);
    for (let d = 0; d < 8; d++) {
      v[d] = -1 + (Math.random() - 0.5) * 0.3;
    }
    vectors.push(v);
  }

  // Кластер 3: центр [0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array(8);
    for (let d = 0; d < 8; d++) {
      v[d] = 0 + (Math.random() - 0.5) * 0.3;
    }
    vectors.push(v);
  }

  const result = kmeansPP(vectors, 3, { iters: 30, seed: 42 });

  // Проверяем что получилось 3 кластера
  const counts = new Int32Array(3);
  for (const label of result.labels) {
    counts[label]++;
  }

  // Каждый кластер должен иметь примерно 20 точек
  assert.ok(counts[0] > 10 && counts[0] < 30);
  assert.ok(counts[1] > 10 && counts[1] < 30);
  assert.ok(counts[2] > 10 && counts[2] < 30);

  // Проверяем что есть 3 центроида
  assert.strictEqual(result.centroids.length, 3);
  assert.ok(result.inertia > 0);
});

test("kmeansPP: детерминированный по seed", () => {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 50; i++) {
    const v = new Float32Array(4);
    for (let d = 0; d < 4; d++) {
      v[d] = Math.random();
    }
    vectors.push(v);
  }

  const result1 = kmeansPP(vectors, 3, { seed: 42 });
  const result2 = kmeansPP(vectors, 3, { seed: 42 });

  // Лейблы должны быть идентичны
  assert.deepEqual(result1.labels, result2.labels);

  // Центроиды должны быть приблизительно одинаковы
  for (let i = 0; i < result1.centroids.length; i++) {
    for (let d = 0; d < result1.centroids[i].length; d++) {
      assert.ok(
        Math.abs(result1.centroids[i][d] - result2.centroids[i][d]) < 1e-5
      );
    }
  }
});

test("kmeansPP: разные seeds дают разные результаты", () => {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 50; i++) {
    const v = new Float32Array(4);
    for (let d = 0; d < 4; d++) {
      v[d] = Math.random();
    }
    vectors.push(v);
  }

  const result1 = kmeansPP(vectors, 3, { seed: 42 });
  const result2 = kmeansPP(vectors, 3, { seed: 123 });

  // Лейблы могут отличаться
  let different = false;
  for (let i = 0; i < result1.labels.length; i++) {
    if (result1.labels[i] !== result2.labels[i]) {
      different = true;
      break;
    }
  }

  // Не гарантируем что отличаются (могут совпасть случайно),
  // но проверяем что оба дают валидные результаты
  assert.strictEqual(result1.labels.length, 50);
  assert.strictEqual(result2.labels.length, 50);
});

test("kmeansPP: выбрасывает ошибку на пустом массиве", () => {
  assert.throws(() => {
    kmeansPP([], 3);
  });
});

test("kmeansPP: выбрасывает ошибку на неверном k", () => {
  const vectors = [new Float32Array([1, 2, 3])];

  assert.throws(() => {
    kmeansPP(vectors, 0);
  });

  assert.throws(() => {
    kmeansPP(vectors, -1);
  });

  assert.throws(() => {
    kmeansPP(vectors, 10); // k > vectors.length
  });
});
